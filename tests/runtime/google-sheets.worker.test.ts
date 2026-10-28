import { privacyRequestJourney } from './privacy-journey'
import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { actionsHttp,everyStoredValue } from './actions-fixture'
import { matureLoad } from './load-time-fixture'
import { materializeConfirmations } from '../../src/core/features/notifications/confirmation-queue'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
contract(['INTEG-001','INTEG-015','GOV-006'],'Google OAuth seals owner tokens and Sheets backfills, appends stable columns, replays failed rows without duplicates and clears an erased response',async()=>{
 await fetch(receiver+'/__control/reset',{method:'POST',body:'{}'})
 const f=await actionsHttp({},'sheets-'+crypto.randomUUID().slice(0,8)),base=`/api/app/flows/${f.flowId}`,book='synthetic-pencil-1'
 const accepted=async(response:Response,status=200)=>{expect(response.status,'Google proof HTTP status').toBe(status);return response.status===204?undefined:response.json() as Promise<any>}
 const config={clientId:'synthetic-pencil-2',clientSecret:'synthetic-pencil-google-secret',authOrigin:receiver,tokenOrigin:receiver,apiOrigin:receiver}
 await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 expect((await f.call('/api/app/connections/google/start',config)).status).toBe(403)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 const start=await accepted(await f.call('/api/app/connections/google/start',config)),authorization=new URL(start.authorizationUrl)
 expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');expect(authorization.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
 const grant=await fetch(authorization.href,{redirect:'manual'});expect(grant.status).toBe(302)
 const callback=new URL(grant.headers.get('location')!)
 expect((await f.as(f.owner.token)(callback.pathname+callback.search)).status).toBe(403)
 expect((await f.call(callback.pathname+callback.search)).status).toBe(303)
 expect((await f.call(callback.pathname+callback.search)).status).toBe(403)
 const status=await accepted(await f.call('/api/app/connections/google'));expect(status).toMatchObject({connected:true})
 const audit=await accepted(await f.call('/api/app/audit?kind=connection.saved'));expect(audit.rows.some((row:any)=>row.details.connection==='google')).toBe(true)
 expect((await f.call(base+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'})).status).toBe(400)
 const readDraft=async()=>accepted(await f.call(base+'/draft'))
 let current=await readDraft()
 await accepted(await f.call(base+'/draft/steps',{expectedVersion:current.flow.draftVersion,step:{kind:'question',questionType:'email',prompt:'Sheet receipt mailbox',required:true}}),201)
 current=await readDraft()
 const mailbox=current.steps.find((step:any)=>step.prompt==='Sheet receipt mailbox')
 const comments=current.steps.find((step:any)=>step.prompt==='Anything else?')
 await accepted(await f.call(base+'/draft',{expectedVersion:current.flow.draftVersion,stepId:comments.id,prompt:comments.prompt,required:comments.required,nextStepId:mailbox.id},{method:'PUT'}))
 current=await readDraft()
 await accepted(await f.call(base+'/draft/settings',{expectedVersion:current.flow.draftVersion,settings:{...current.formSettings,hiddenFields:[{id:"synthetic-pencil-campaign",name:"utm_campaign",type:"text",category:"campaign"},{id:"synthetic-pencil-total",name:"order_total",type:"number",category:"plain"},{id:"synthetic-pencil-flag",name:"subscribed",type:"boolean",category:"plain"}],googleSheets:true,responseEdits:{enabled:true,deadline:new Date(Date.now()+86400000).toISOString()},confirmation:{enabled:true,includeAnswers:false,answerTypes:[],emailStepId:mailbox.id,subject:'Synthetic sheet receipt',body:'Recorded.'}}},{method:'PUT'}))
 await accepted(await f.call(base+'/publish',{expectedVersion:(await readDraft()).flow.draftVersion}),201)
 const slug=(await readDraft()).flow.slug
 const submit=async(n:number)=>{
  const session=await accepted(await f.call(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop'}),201);await matureLoad(session,5000)
  const graph=session.flow,answers=graph.steps.filter((step:any)=>step.kind==='question').map((step:any)=>({stepId:step.id,value:step.questionType==='email'?'synthetic-pencil-sheet@example.test':step.questionType==='single_choice'?graph.choices.find((choice:any)=>choice.stepId===step.id).id:step.questionType==='multiple_choice'?[graph.choices.find((choice:any)=>choice.stepId===step.id).id]:`Synthetic sheet row ${n}`}))
  const result=await accepted(await f.call(`/api/public/flows/${slug}/responses`,{...session,answers,hidden:n===2?{}:{utm_campaign:'=SUM(1,2) synthetic campaign '+n,order_total:'12.50',subscribed:'false'},idempotencyKey:`synthetic-pencil-${n}`,honeypot:''}),201)
  expect(result.disposition).toBe('released');return result.responseId as string
 }
 const first=[] as string[];for(let n=1;n<=3;n++)first.push(await submit(n))
 const tabs=await accepted(await f.call('/api/app/connections/google/worksheets?spreadsheetId='+book));expect(tabs.worksheets).toContainEqual({title:'Synthetic responses',id:1})
 await accepted(await f.call(base+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'}))
 const sheet=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {sheets:Record<string,string[][]>}).sheets[book]??[]
 expect((await sheet()).filter(row=>row[0])).toHaveLength(4)
 const oldHeader=(await sheet())[0]
 const hiddenIndex=oldHeader.indexOf('Hidden: utm_campaign [hidden:synthetic-pencil-campaign]')
 expect(hiddenIndex).toBeGreaterThan(0)
 expect(oldHeader).toContain('Hidden: order_total [hidden:synthetic-pencil-total]')
 expect(oldHeader).toContain('Hidden: subscribed [hidden:synthetic-pencil-flag]')
 const initialRows=await sheet()
 const firstRow=initialRows.find(row=>row.includes('Synthetic sheet row 1'))!
 expect(firstRow.slice(hiddenIndex,hiddenIndex+3)).toEqual(['=SUM(1,2) synthetic campaign 1','12.5','false'])
 expect(initialRows.find(row=>row.includes('Synthetic sheet row 2'))!.slice(hiddenIndex,hiddenIndex+3)).toEqual(['','',''])
 const fourth=await submit(4)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 expect((await sheet()).filter(row=>row[0])).toHaveLength(5)
 current=await readDraft()
 await accepted(await f.call(base+'/draft/steps',{expectedVersion:current.flow.draftVersion,step:{kind:'question',questionType:'multiple_choice',prompt:'Synthetic additional column',required:false,choices:[{value:'workshop',label:'Workshop'},{value:'consultation',label:'Consultation'}]}}),201)
 current=await readDraft()
 const previous=current.steps.find((step:any)=>step.prompt==='Sheet receipt mailbox'),newStep=current.steps.find((step:any)=>step.prompt==='Synthetic additional column')
 await accepted(await f.call(base+'/draft',{expectedVersion:current.flow.draftVersion,stepId:previous.id,prompt:previous.prompt,required:previous.required,nextStepId:newStep.id},{method:'PUT'}))
 current=await readDraft()
 await accepted(await f.call(base+'/draft/settings',{expectedVersion:current.flow.draftVersion,settings:{...current.formSettings,hiddenFields:[...current.formSettings.hiddenFields,{id:'synthetic-pencil-added',name:'added_hidden',type:'text',category:'plain'}]}},{method:'PUT'}))
 await accepted(await f.call(base+'/publish',{expectedVersion:(await readDraft()).flow.draftVersion}),201)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 const after=await sheet();expect(after.filter(row=>row[0])).toHaveLength(5);expect(after[0].slice(0,oldHeader.length)).toEqual(oldHeader)
 const added=(await readDraft()).steps.find((step:any)=>step.prompt==='Synthetic additional column')
 expect(after[0].at(-2)).toContain(added.id);expect(after[0].at(-2)).toContain('Synthetic additional column');expect(after[0].at(-1)).toBe('Hidden: added_hidden [hidden:synthetic-pencil-added]');expect(after.some(row=>row.includes('Synthetic sheet row 4'))).toBe(true)
 // The respondent follows the confirmation's single-use public edit door. The receiver must update the same keyed row.
 await materializeConfirmations(env.DB,new Date().toISOString())
 const confirmation=(await env.DB.prepare('SELECT message_json AS message FROM confirmation_deliveries WHERE response_id=?').bind(fourth).first<{message:string}>())!
 const token=/\?edit=([a-f0-9]{64})/.exec(JSON.parse(confirmation.message).text)![1]
 const beforeEdit=await sheet(),rowIndex=beforeEdit.findIndex(row=>row.includes('Synthetic sheet row 4')),rowKey=beforeEdit[rowIndex][0]
 expect(rowIndex).toBeGreaterThan(0)
 const editable=await accepted(await f.call(`/api/public/flows/${slug}/edit?token=${token}`,undefined,{auth:false}))
 const editedAnswers=editable.answers.map((answer:any)=>answer.stepId===comments.id?{...answer,value:'=SUM(1,2)\nSynthetic edited sheet answer'}:answer)
 expect((await accepted(await f.call(`/api/public/flows/${slug}/edit`,{token,answers:editedAnswers},{auth:false}))).version).toBe(2)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 const afterEdit=await sheet()
 expect(afterEdit[rowIndex].slice(hiddenIndex,hiddenIndex+3)).toEqual(['=SUM(1,2) synthetic campaign 4','12.5','false']);
 expect(afterEdit[rowIndex][0]).toBe(rowKey);expect(afterEdit[rowIndex]).toContain('=SUM(1,2)\nSynthetic edited sheet answer')
 expect(afterEdit.filter(row=>row[0])).toHaveLength(5);expect(afterEdit.filter(row=>row[0]===rowKey)).toHaveLength(1)
 expect((await f.call(`/api/public/flows/${slug}/edit`,{token,answers:editedAnswers},{auth:false})).status).toBe(404)
 await fetch(receiver+'/__control/google-mode',{method:'POST',body:JSON.stringify({down:true})})
 const missing=[] as string[];for(let n=5;n<=9;n++)missing.push(await submit(n))
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 let ledger=await accepted(await f.call('/api/app/integration-deliveries?state=failed'))
 const failed=ledger.deliveries.filter((row:any)=>row.kind==='sheet');expect(failed.map((row:any)=>row.responseId).sort()).toEqual(missing.sort())
 expect(failed.every((row:any)=>row.attempts.some((attempt:any)=>attempt.httpStatus===503&&attempt.reason.includes('503')))).toBe(true)
 const alert=await accepted(await f.call('/api/app/webhooks/alerts'));expect(alert.alerts.some((row:any)=>row.message.includes('5 Google Sheets'))).toBe(true)
 await fetch(receiver+'/__control/google-mode',{method:'POST',body:JSON.stringify({down:false})})
 for(const row of failed)await accepted(await f.call(`/api/app/google-sheet/deliveries/${row.id}/replay`,{}))
 const addedChoice=(await readDraft()).choices.find((choice:any)=>choice.stepId===added.id).id
 expect((await sheet()).flat()).toContain(JSON.stringify([addedChoice]))
 expect((await sheet()).filter(row=>row[0])).toHaveLength(10)
 ledger=await accepted(await f.call('/api/app/integration-deliveries?state=confirmed'));expect(ledger.deliveries.filter((row:any)=>row.kind==='sheet')).toHaveLength(9)
 const replay=ledger.deliveries.find((row:any)=>row.kind==='sheet');await accepted(await f.call(`/api/app/google-sheet/deliveries/${replay.id}/replay`,{}));expect((await sheet()).filter(row=>row[0])).toHaveLength(10)
 const erasedRowIndex=(await sheet()).findIndex(cells=>cells.includes('Synthetic sheet row 1'));expect(erasedRowIndex).toBeGreaterThan(0)
 await accepted(await f.call('/api/app/responses/'+first[0],undefined,{method:'DELETE'}),204)
 await accepted(await f.call(base+'/google-sheet/sync',{}))
 expect((await sheet()).flat()).not.toContain('Synthetic sheet row 1');expect((await sheet()).filter(row=>row[0])).toHaveLength(9);expect((await sheet())[erasedRowIndex]).toEqual([])
 const all=(await everyStoredValue()).join('\n');for(const secret of [config.clientSecret,'synthetic-pencil-google-access','synthetic-pencil-google-refresh'])expect(all).not.toContain(secret)
 const backup=await accepted(await f.call('/api/app/backup/export',{}));for(const secret of [config.clientSecret,'synthetic-pencil-google-access','synthetic-pencil-google-refresh'])expect(JSON.stringify(backup)).not.toContain(secret)
 expect(backup.payload.tables.find((table:any)=>table.name==='google_oauth_states').rows).toEqual([])
 // The receiver is the provider edge, so each limit is exercised by the public sync or picker door.
 const control=async(options:unknown)=>{expect((await fetch(receiver+'/__control/google-mode',{method:'POST',body:JSON.stringify(options)})).status).toBe(200)}
 const captured=async()=>(await (await fetch(receiver+'/__control/state')).json()) as {requests:Array<{path:string;body:string}>;sheets:Record<string,string[][]>}
 for(const [count,status] of [[100,200],[101,400]]){
  await control({tabs:count});const result=await f.call('/api/app/connections/google/worksheets?spreadsheetId='+book);expect(result.status).toBe(status)
  if(status===200)expect((await result.json() as any).worksheets).toHaveLength(count)
 }
 for(const [bytes,status] of [[2*1024*1024,200],[2*1024*1024+1,400]]){
  await control({bytes});expect((await f.call('/api/app/connections/google/worksheets?spreadsheetId='+book)).status).toBe(status)
 }
 await control({})
 const link=(await accepted(await f.call(base+'/google-sheet'))).link
 expect((await f.call(base+'/google-sheet',{spreadsheetId:'synthetic-pencil-other-book',tab:'Synthetic responses'},{method:'PUT'})).status).toBe(409)
 const other=await accepted(await f.call('/api/app/flows',{title:'Synthetic worksheet reservation',slug:'sheet-reservation-'+crypto.randomUUID().slice(0,8),template:'feedback'}),201)
 const otherBase='/api/app/flows/'+other.id,otherDraft=await accepted(await f.call(otherBase+'/draft'))
 await accepted(await f.call(otherBase+'/draft/settings',{expectedVersion:otherDraft.flow.draftVersion,settings:{...otherDraft.formSettings,googleSheets:true}},{method:'PUT'}))
 await accepted(await f.call(otherBase+'/publish',{expectedVersion:(await accepted(await f.call(otherBase+'/draft'))).flow.draftVersion}),201)
 // Empty attachment writes its header immediately and a second attachment never duplicates it.
 await accepted(await f.call(otherBase+'/google-sheet',{spreadsheetId:'synthetic-pencil-count-book',tab:'Synthetic responses'},{method:'PUT'}))
 const emptySheet=async()=>((await (await fetch(receiver+'/__control/state')).json()) as {sheets:Record<string,string[][]>}).sheets['synthetic-pencil-count-book']
 const emptyHeader=await emptySheet();expect(emptyHeader).toHaveLength(1);expect(emptyHeader[0][0]).toContain('Pencil response key')
 await accepted(await f.call(otherBase+'/google-sheet',{spreadsheetId:'synthetic-pencil-count-book',tab:'Synthetic responses'},{method:'PUT'}))
 expect(await emptySheet()).toEqual(emptyHeader)
 expect((await f.call(otherBase+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'})).status).toBe(409)
 const row=(await accepted(await f.call('/api/app/integration-deliveries?state=confirmed'))).deliveries.find((r:any)=>r.kind==='sheet'&&r.responseId===fourth)
 const replayRow=async()=>accepted(await f.call('/api/app/google-sheet/deliveries/'+row.id+'/replay',{}))
 const rowState=async()=> (await accepted(await f.call('/api/app/integration-deliveries'))).deliveries.find((r:any)=>r.id===row.id)
 const savedRows=await sheet()
 for(const count of [1000,1001]){
  const rows=[...savedRows,...Array.from({length:count+1-savedRows.length},(_,i)=>['synthetic-pencil-reserved-'+i])]
  await control({book,rows});await replayRow()
  expect((await rowState()).state).toBe(count===1000?'confirmed':'failed')
  if(count===1001)expect((await rowState()).attempts.at(-1).reason).toContain('1,000-row limit')
 }
 await control({book,rows:savedRows})
 expect(JSON.parse(link.columnsJson).filter((column:{id:string})=>column.id.startsWith('hidden:'))).toHaveLength(4)
 const savedColumns=JSON.parse(link.columnsJson) as Array<{id:string;label:string}>
 for(const count of [499,500]){
  // Archive/history fixture: retained columns from prior publications count toward the bound too.
  const columns=[...savedColumns,...Array.from({length:count-savedColumns.length},(_,i)=>({id:'synthetic-pencil-prior-question-'+i,label:'Previous question '+i}))]
  await env.DB.prepare('UPDATE google_sheet_links SET columns_json=? WHERE id=?').bind(JSON.stringify(columns),link.id).run()
  const boundary=await f.call(base+'/google-sheet',{spreadsheetId:book,tab:'Synthetic responses'},{method:'PUT'})
  expect(boundary.status).toBe(count===499?200:400)
  if(count===500)expect(await boundary.json()).toMatchObject({error:'VALIDATION_ERROR',message:expect.stringContaining('499 question columns, including hidden fields')})
  await replayRow();expect((await rowState()).state).toBe(count===499?'confirmed':'failed')
  if(count===499)expect((await sheet())[0]).toHaveLength(500)
  else expect((await rowState()).attempts.at(-1).reason).toContain('499 question columns')
 }
 await env.DB.prepare('UPDATE google_sheet_links SET columns_json=? WHERE id=?').bind(link.columnsJson,link.id).run()
 await control({book,rows:savedRows});await replayRow()
 const writes=(await captured()).requests.filter(r=>r.path.startsWith('/v4/spreadsheets/')&&r.body)
 expect(writes.length).toBeGreaterThan(0)
 for(const write of writes.filter(r=>!r.path.includes(':clear')))expect(new URL(write.path,'http://localhost').searchParams.get('valueInputOption')).toBe('RAW')
 expect((await sheet()).some(cells=>cells.includes('=SUM(1,2)\nSynthetic edited sheet answer'))).toBe(true)
 // A stored write with a dropped reply stays unknown. Explicit replay reads its key before updating it in place.
 const uncertain=await submit(10),beforeUnknown=(await sheet()).filter(cells=>cells[0]).length
 await control({dropWrite:true});await accepted(await f.call(base+'/google-sheet/sync',{}))
 const unknown=(await accepted(await f.call('/api/app/integration-deliveries?state=unknown'))).deliveries.find((r:any)=>r.responseId===uncertain)
 expect(unknown).toBeTruthy();expect((await sheet()).filter(cells=>cells[0])).toHaveLength(beforeUnknown+1)
 const callsBefore=(await captured()).requests.length
 await accepted(await f.call(base+'/google-sheet/sync',{}));expect((await captured()).requests).toHaveLength(callsBefore)
 await accepted(await f.call('/api/app/google-sheet/deliveries/'+unknown.id+'/replay',{}))
 const reconciled=(await captured()).requests.slice(callsBefore)
 expect(reconciled[0].path).toContain('/values/');expect(reconciled[0].body).toBe('')
 expect(reconciled.slice(1).every(r=>!r.path.includes(':append'))).toBe(true)
 expect((await sheet()).filter(cells=>cells[0])).toHaveLength(beforeUnknown+1)
 // Known read failures get four automatic attempts, then remain failed until explicit replay.
 const bounded=await submit(11);await control({down:true})
 const readStart=(await captured()).requests.length
 for(let attempt=0;attempt<5;attempt++){
  await env.DB.prepare("UPDATE google_sheet_rows SET available_at='2000-01-01T00:00:00.000Z' WHERE response_id=?").bind(bounded).run()
  await accepted(await f.call(base+'/google-sheet/sync',{}))
 }
 const stopped=(await accepted(await f.call('/api/app/integration-deliveries?state=failed'))).deliveries.find((r:any)=>r.responseId===bounded)
 expect(stopped.attempts).toHaveLength(4);expect((await captured()).requests.slice(readStart)).toHaveLength(4)
 await control({});await accepted(await f.call('/api/app/google-sheet/deliveries/'+stopped.id+'/replay',{}))
 expect((await accepted(await f.call('/api/app/integration-deliveries?state=confirmed'))).deliveries.some((r:any)=>r.responseId===bounded)).toBe(true)
 // A historical released-response fixture also proves attachment's count guard at 1,000 and one over.
 const responseFixture=(await env.DB.prepare('SELECT * FROM responses WHERE id=?').bind(fourth).first())!
 const otherRevision=(await env.DB.prepare("SELECT id FROM flow_revisions WHERE flow_id=? AND state='published' AND is_current=1").bind(other.id).first<{id:string}>())!.id
 const insertFixture=(n:number)=>{
  const id='synthetic-pencil-count-'+n,record={...responseFixture,id,flow_id:other.id,revision_id:otherRevision,session_id:id,session_token_hash:id,idempotency_key:id}
  const columns=Object.keys(record);return env.DB.prepare('INSERT INTO responses('+columns.map(c=>'"'+c+'"').join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').bind(...Object.values(record))
 }
 for(let offset=0;offset<1000;offset+=100)await env.DB.batch(Array.from({length:100},(_,i)=>insertFixture(offset+i)))
 await accepted(await f.call(otherBase+'/google-sheet',{spreadsheetId:'synthetic-pencil-count-book',tab:'Synthetic responses'},{method:'PUT'}))
 await insertFixture(1000).run()
 expect((await f.call(otherBase+'/google-sheet',{spreadsheetId:'synthetic-pencil-count-book',tab:'Synthetic responses'},{method:'PUT'})).status).toBe(400)
 await privacyRequestJourney(f,receiver)
})
