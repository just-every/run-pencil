import { ulid } from 'ulid'
import { ConflictError,NotFoundError,ValidationError } from '../../shared/errors'
import type { GoogleOAuth } from './oauth'
import { formSettings, type ResponseContext } from '../../shared/hiddenFields'
type Link={id:string;workspaceId:string;flowId:string;spreadsheetId:string;tab:string;columnsJson:string;armed:number}
type Column={id:string;label:string}
type Row={id:string;linkId:string;responseId:string|null;generation:number;attempts:number;state:string}
class UncertainSheetWrite extends Error {}
const columns='id,workspace_id AS workspaceId,flow_id AS flowId,spreadsheet_id AS spreadsheetId,tab,columns_json AS columnsJson,armed'
const rowColumns='id,link_id AS linkId,response_id AS responseId,generation,attempts,state'
export class GoogleSheets {
 constructor(private readonly db:D1Database,private readonly oauth:GoogleOAuth){}
 private async owned(workspaceId:string,flowId:string){if(!await this.db.prepare('SELECT id FROM flows WHERE id=? AND workspace_id=?').bind(flowId,workspaceId).first())throw new NotFoundError('This form is not in your workspace.')}
 async get(workspaceId:string,flowId:string){await this.owned(workspaceId,flowId);return this.db.prepare(`SELECT ${columns} FROM google_sheet_links WHERE flow_id=? AND workspace_id=?`).bind(flowId,workspaceId).first<Link>()}
 async tabs(spreadsheetId:string){const data=await this.oauth.request('/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+'?fields=spreadsheetId,properties(title),sheets(properties)');if(!Array.isArray(data.sheets)||data.sheets.length>100)throw new ValidationError('Choose a spreadsheet with at most 100 worksheets.');return data.sheets.map((sheet:{properties:{title:string;sheetId:number}})=>({title:sheet.properties.title,id:sheet.properties.sheetId}))}
 async attach(workspaceId:string,flowId:string,spreadsheetId:string,tab:string){
  await this.owned(workspaceId,flowId)
  if(!(await this.tabs(spreadsheetId)).some(sheet=>sheet.title===tab))throw new ValidationError('Choose an existing worksheet.')
  const revision=await this.db.prepare("SELECT r.form_settings_json AS settings FROM flow_revisions r JOIN flows f ON f.id=r.flow_id WHERE f.id=? AND r.is_current=1 AND r.state='published'").bind(flowId).first<{settings:string}>()
  if(!revision||JSON.parse(revision.settings).googleSheets!==true)throw new ValidationError('Publish the Google Sheets disclosure before attaching a worksheet.')
  const count=await this.db.prepare("SELECT count(*) AS n FROM responses WHERE flow_id=? AND state='released'").bind(flowId).first<{n:number}>();if((count?.n??0)>1000)throw new ValidationError('This sync supports up to 1,000 rows. Split the responses before attaching.')
  if(await this.db.prepare('SELECT id FROM google_sheet_links WHERE spreadsheet_id=? AND tab=? AND flow_id<>?').bind(spreadsheetId,tab,flowId).first())throw new ConflictError('That worksheet already belongs to another form.')
  const existing=await this.get(workspaceId,flowId)
  if(existing&&(existing.spreadsheetId!==spreadsheetId||existing.tab!==tab))throw new ConflictError('This form already owns a worksheet. Retain its current mapping until destination migration is available.')
  const id=existing?.id??ulid(),now=new Date().toISOString()
  await this.db.batch([
   this.db.prepare('INSERT INTO google_sheet_links(id,workspace_id,flow_id,spreadsheet_id,tab,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(flow_id) DO UPDATE SET armed=1,updated_at=excluded.updated_at').bind(id,workspaceId,flowId,spreadsheetId,tab,now),
   this.db.prepare("INSERT OR IGNORE INTO google_sheet_rows(id,link_id,response_id,state,available_at,updated_at) SELECT lower(hex(randomblob(16))),?,id,'pending',?,? FROM responses WHERE flow_id=? AND state='released'").bind(id,now,now,flowId),
  ])
  await this.deliver((await this.get(workspaceId,flowId))!,null)
  await this.run(workspaceId,flowId)
  return this.get(workspaceId,flowId)
 }
 private range(link:Link,suffix:string){return encodeURIComponent("'"+link.tab.replace(/'/g,"''")+"'!"+suffix)}
 private async fields(link:Link){
  const revisions=await this.db.prepare("SELECT id,form_settings_json AS settings FROM flow_revisions WHERE flow_id=? AND state='published' ORDER BY number").bind(link.flowId).all<{id:string;settings:string}>()
  const merged=new Map<string,Column>((JSON.parse(link.columnsJson) as Column[]).map(column=>[column.id,column]))
  for(const revision of revisions.results){
   const questions=await this.db.prepare("SELECT stable_id AS id,prompt AS label FROM flow_steps WHERE revision_id=? AND kind='question' ORDER BY position,id").bind(revision.id).all<Column>()
   for(const column of questions.results)merged.set(column.id,column)
   for(const field of formSettings(revision.settings).hiddenFields)merged.set('hidden:'+field.id,{id:'hidden:'+field.id,label:'Hidden: '+field.name})
  }
  const fields=[...merged.values()];if(fields.length>499)throw new ValidationError('This worksheet supports up to 499 question columns, including hidden fields.')
  return fields
 }
 private async deliver(link:Link,row:Row|null){
  const prefix='/v4/spreadsheets/'+encodeURIComponent(link.spreadsheetId)+'/values/'
  const current=await this.oauth.request(prefix+this.range(link,'A1:SF1001'))
  const values=current.values??[];if(!Array.isArray(values)||values.length>1001)throw new ValidationError('The worksheet exceeds the 1,000-row limit.')
  const marker=`Pencil response key [${link.id}]`
  if(values.length&&values[0]?.[0]!==marker)throw new ValidationError('Choose an empty worksheet reserved for Pencil responses.')
  const index=values.findIndex((cells:unknown[])=>cells[0]===row?.id)
  const write=async(path:string,method:string,body:unknown)=>{try{return await this.oauth.request(path,method,body)}catch{throw new UncertainSheetWrite('A Google Sheets write was not confirmed. Reconcile and replay with the same row key.')}}
  const fields=await this.fields(link)
  const header=[marker,...fields.map(column=>`${column.label} [${column.id}]`)]
  if(JSON.stringify(values[0])!==JSON.stringify(header))await write(prefix+this.range(link,'A1:SF1')+'?valueInputOption=RAW','PUT',{values:[header]})
  await this.db.prepare('UPDATE google_sheet_links SET columns_json=? WHERE id=?').bind(JSON.stringify(fields),link.id).run()
  if(!row)return
  if(!row.responseId){if(index>0)await write(prefix+this.range(link,`A${index+1}:SF${index+1}`)+':clear','POST',{});return}
  const response=await this.db.prepare("SELECT r.state,r.response_context_json AS context,v.form_settings_json AS settings FROM responses r JOIN flow_revisions v ON v.id=r.revision_id WHERE r.id=?").bind(row.responseId).first<{state:string;context:string;settings:string}>()
  if(!response||response.state!=='released'){if(index>0)await write(prefix+this.range(link,`A${index+1}:SF${index+1}`)+':clear','POST',{});return}
  if(JSON.parse(response.settings).googleSheets!==true)throw new ValidationError('This published revision does not disclose Google Sheets. No answers were sent.')
  const answers=await this.db.prepare('SELECT step_id AS id,value_json AS value FROM response_answers WHERE response_id=?').bind(row.responseId).all<{id:string;value:string}>()
  const map=new Map(answers.results.map(answer=>[answer.id,JSON.parse(answer.value)]))
  const context=JSON.parse(response.context) as ResponseContext
  for(const [id,value] of Object.entries(context.hidden??{}))map.set('hidden:'+id,value)
  const cells=[row.id,...fields.map(column=>{const value=map.get(column.id);return value===undefined||value===null?'':typeof value==='string'?value:JSON.stringify(value)})]
  if(index>0)await write(prefix+this.range(link,`A${index+1}:SF${index+1}`)+'?valueInputOption=RAW','PUT',{values:[cells]})
  else {if(values.length>=1001)throw new ValidationError('The worksheet exceeds the 1,000-row limit.');await write(prefix+this.range(link,'A:SF')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{values:[cells]})}
 }
 async run(workspaceId?:string,flowId?:string){
  const now=new Date().toISOString()
  await this.db.prepare("UPDATE google_sheet_rows SET state='unknown',reason='A sheet write was interrupted. Reconcile and replay with the same row key.' WHERE state='sending' AND started_at<?").bind(new Date(Date.now()-300000).toISOString()).run()
  const due=await this.db.prepare(`SELECT r.id FROM google_sheet_rows r JOIN google_sheet_links l ON l.id=r.link_id WHERE l.armed=1 AND (r.state='pending' OR (r.state='failed' AND (SELECT count(*) FROM google_sheet_attempts a WHERE a.row_id=r.id AND a.generation=r.generation)<4)) AND r.available_at<=? AND (? IS NULL OR l.workspace_id=?) AND (? IS NULL OR l.flow_id=?) ORDER BY r.available_at,r.id LIMIT 50`).bind(now,workspaceId??null,workspaceId??null,flowId??null,flowId??null).all<{id:string}>()
  if(!due.results.length){
   const links=await this.db.prepare(`SELECT ${columns} FROM google_sheet_links WHERE armed=1 AND (? IS NULL OR workspace_id=?) AND (? IS NULL OR flow_id=?)`).bind(workspaceId??null,workspaceId??null,flowId??null,flowId??null).all<Link>()
   for(const link of links.results)if(JSON.stringify(await this.fields(link))!==link.columnsJson)await this.deliver(link,null)
  }
  for(const candidate of due.results){
   const row=await this.db.prepare(`UPDATE google_sheet_rows SET state='sending',attempts=attempts+1,started_at=?,updated_at=? WHERE id=? AND state IN('pending','failed') RETURNING ${rowColumns}`).bind(now,now,candidate.id).first<Row>();if(!row)continue
   const link=await this.db.prepare(`SELECT ${columns} FROM google_sheet_links WHERE id=? AND armed=1`).bind(row.linkId).first<Link>();if(!link)continue
   let state='confirmed',reason:string|null=null
   try{await this.deliver(link,row)}catch(error){state=error instanceof UncertainSheetWrite?'unknown':'failed';reason=error instanceof ValidationError?error.message:'The sheet write was not confirmed. Reconcile and replay with the same row key.'}
   await this.db.batch([
    this.db.prepare('INSERT INTO google_sheet_attempts(id,row_id,ordinal,generation,outcome,http_status,reason,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(ulid(),row.id,row.attempts,row.generation,state,reason&&/HTTP (\d{3})/.test(reason)?Number(/HTTP (\d{3})/.exec(reason)![1]):null,reason,now),
    this.db.prepare('UPDATE google_sheet_rows SET state=?,reason=?,available_at=?,updated_at=? WHERE id=? AND generation=?').bind(state,reason,state==='failed'?new Date(Date.now()+60000*Math.min(60,2**Math.min(row.attempts,6))).toISOString():now,now,row.id,row.generation),
   ])
  }
  return {attempted:due.results.length}
 }
 async replay(workspaceId:string,id:string){const row=await this.db.prepare("UPDATE google_sheet_rows SET state='pending',available_at=?,reason=NULL WHERE id=? AND state IN('failed','unknown','confirmed') AND link_id IN(SELECT id FROM google_sheet_links WHERE workspace_id=? AND armed=1) RETURNING id").bind(new Date().toISOString(),id,workspaceId).first();if(!row)throw new NotFoundError('This sheet delivery cannot be replayed.');await this.run(workspaceId)}
}
