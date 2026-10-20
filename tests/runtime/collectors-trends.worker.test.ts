import { matureLoad } from './load-time-fixture'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { collectDisclosureScenario } from '../disclosure-scenario'
import { csvRows } from '../e2e/export-helpers'
import type { FlowResults, QuestionReport, LedgerResponse, BuilderDraft, Ledger, WorkspaceSettings } from '../../src/core/app/api'
import type { CollectorService } from '../../src/core/features/collectors'
import type { Crosstab, TrendReport } from '../../src/core/features/reporting'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
type Collector = Awaited<ReturnType<CollectorService['create']>>
type Session = { sessionId:string;sessionToken:string;loadTime:string;revisionId:string }
let cookie='',serial=0
const request=(path:string,data?:unknown,method=data===undefined?'GET':'POST')=>SELF.fetch('http://localhost'+path,{method,headers:{Host:'localhost',Origin:'http://localhost',cookie,'content-type':'application/json','CF-Connecting-IP':`198.18.203.${++serial%250}`},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'manual'})
async function call<T>(path:string,data?:unknown,method?:string):Promise<T>{const response=await request(path,data,method);expect(response.ok,response.ok?path:`${path}: ${await response.text()}`).toBe(true);return response.status===204?undefined as T:response.json<T>()}
beforeAll(async()=>{
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__);await call('/health')
  const owner=await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{email:string}>();expect(owner).not.toBeNull()
  await call('/auth/magic-link',{email:owner!.email});const inbox=await developmentInbox(path=>SELF.fetch('http://localhost'+path,{headers:{Host:'localhost',...devKeyHeaders}}),owner!.email)
  const login=await request('/auth/confirm',{token:inbox.messages[0].magicLinkToken});expect(login.status).toBe(303);cookie=login.headers.get('set-cookie')!.split(';')[0]
})
contract(['DIST-017','RSLT-007','RSLT-006','LEDG-005'],'named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports',async()=>{
  const workspace=await call<WorkspaceSettings>('/api/app/workspace')
  await call('/api/app/workspace',{timeZone:'America/New_York',sendingWindowStart:workspace.sendingWindowStart,sendingWindowEnd:workspace.sendingWindowEnd},'PUT')
  const slug='northstar-collector-trends',flow=await call<{id:string}>('/api/app/flows',{title:'Northstar customer feedback',slug}),root=`/api/app/flows/${flow.id}`
  let draft=await call<BuilderDraft>(root+'/draft')
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'question',questionType:'nps',required:true,prompt:'Would you recommend Northstar?'}})
  draft=await call<BuilderDraft>(root+'/draft');const stepId=draft.steps[0].id
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Thank you for helping us improve.'}})
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const a=await call<Collector>(root+'/collectors',{name:'July mailing',channel:'email',responseLimit:2}),b=await call<Collector>(root+'/collectors',{name:'Product feedback',channel:'embed',responseLimit:10,closeAt:'2026-12-01T17:00'})
  expect(b.deadlineAt).toBe('2026-12-01T22:00:00.000Z');expect(b.deadlineTimeZone).toBe('America/New_York')
  const start=async(collector:Collector)=>{const session=await call<Session>(`/api/public/flows/${slug}/sessions`,{source:collector.id===b.id?'embed':'direct',deviceClass:'desktop',collectorKey:collector.publicKey});await matureLoad(session);return session}
  const body=(session:Session,value:number)=>({...session,idempotencyKey:'collector-'+session.sessionId,answers:[{stepId,value}]})
  const dateResponse=async(id:string,time:string)=>{await env.DB.prepare('UPDATE responses SET started_at=?,completed_at=?,released_at=?,created_at=?,updated_at=? WHERE id=?').bind(new Date(Date.parse(time)-6000).toISOString(),time,time,time,time,id).run()}
  const sessions=await Promise.all([start(a),start(a),start(a)])
  const attempts=await Promise.all(sessions.map((session,index)=>request(`/api/public/flows/${slug}/responses`,body(session,index===0?10:6))))
  expect(attempts.map(response=>response.status).sort()).toEqual([201,201,409])
  const admitted:Array<{id:string;session:Session;value:number}>=[]
  for(const [index,response] of attempts.entries()){
    if(response.status===201){const receipt=await response.json<{responseId:string;disposition:string}>();expect(receipt.disposition).toBe('released');admitted.push({id:receipt.responseId,session:sessions[index],value:index===0?10:6})}
    else expect(await response.json()).toMatchObject({error:'COLLECTOR_CLOSED'})
  }
  // Give the real admitted responses a deterministic fixture calendar, including exact local midnight.
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('10',admitted[0].id).run();await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=?').bind('6',admitted[1].id).run()
  await dateResponse(admitted[0].id,'2026-07-06T04:00:00.000Z');await dateResponse(admitted[1].id,'2026-07-06T04:02:00.000Z')
  expect((await request(`/api/public/flows/${slug}/sessions`,{source:'direct',deviceClass:'desktop',collectorKey:a.publicKey})).status).toBe(409)
  const retry=await call<{responseId:string;idempotent:boolean}>(`/api/public/flows/${slug}/responses`,body(admitted[0].session,0));expect(retry).toMatchObject({responseId:admitted[0].id,idempotent:true})
  const submit=async(value:number,time:string)=>{const session=await start(b);const receipt=await call<{responseId:string;disposition:string}>(`/api/public/flows/${slug}/responses`,body(session,value));expect(receipt.disposition).toBe('released');await dateResponse(receipt.responseId,time);return {session,id:receipt.responseId}}
  await submit(9,'2026-07-01T03:59:59.000Z');await submit(9,'2026-07-13T04:00:00.000Z')
  const oldRevision=admitted[0].session.revisionId
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/draft',{stepId,prompt:'Would you recommend our updated service?',required:true,expectedVersion:draft.flow.draftVersion},'PUT')
  draft=await call<BuilderDraft>(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const august=await submit(0,'2026-08-03T04:00:00.000Z');await submit(5,'2026-08-03T05:00:00.000Z');await submit(10,'2026-09-07T04:00:00.000Z')
  await env.DB.prepare('UPDATE flow_revisions SET published_at=? WHERE id=?').bind('2026-07-01T04:00:00.000Z',oldRevision).run();await env.DB.prepare('UPDATE flow_revisions SET published_at=? WHERE id=?').bind('2026-08-01T04:00:00.000Z',august.session.revisionId).run()
  const collectors=await call<Collector[]>(root+'/collectors');expect(collectors.find(item=>item.id===a.id)).toMatchObject({released:2,retained:2,state:'full',remaining:0});expect(collectors.find(item=>item.id===b.id)).toMatchObject({released:5,retained:5,state:'open',remaining:5})
  const ledger=await call<Ledger>(root+`/ledger?collectorId=${a.id}`);expect(ledger.total).toBe(2);expect(ledger.responses.map(row=>row.id).sort()).toEqual(admitted.map(row=>row.id).sort());expect(ledger.responses.every(row=>row.collector.id===a.id&&row.collector.name==='July mailing')).toBe(true)
  const trend=(unit:string,minimum=2,extra='')=>call<TrendReport>(root+`/trends?stepId=${stepId}&metric=score&unit=${unit}&minimum=${minimum}&from=2026-07-01&to=2026-10-01${extra}`)
  const monthly=await trend('month');expect(monthly.zone).toBe('America/New_York');expect(monthly.periods.map(point=>point.denominator)).toEqual([3,2,1]);expect(monthly.periods[0].value).toBeCloseTo(100/3);expect(monthly.periods[1].value).toBe(-100);expect(monthly.periods[2]).toMatchObject({value:null,suppressed:true})
  expect(monthly.periods[1].revisions).toContainEqual(expect.objectContaining({revisionId:august.session.revisionId,revisionNumber:2,prompt:'Would you recommend our updated service?'}));expect(monthly.periods[0].startAt).toBe('2026-07-01T04:00:00.000Z')
  const weekly=await trend('week');expect(weekly.periods.find(point=>point.label==='Week of 2026-07-06')).toMatchObject({denominator:2,value:0});expect(weekly.periods.find(point=>point.label==='Week of 2026-07-13')).toMatchObject({denominator:1,value:null,suppressed:true});expect(weekly.periods.some(point=>point.denominator===0&&point.value===null)).toBe(true)
  const cohort=await trend('month',1,`&collectorId=${b.id}`);expect(cohort.periods.map(point=>point.denominator)).toEqual([1,2,1]);expect(cohort.periods.map(point=>point.value)).toEqual([100,-100,100])
  const share=await call<TrendReport>(root+`/trends?stepId=${stepId}&metric=share&shareValue=10&unit=month&minimum=1&from=2026-07-01&to=2026-10-01`);expect(share.periods[0].value).toBeCloseTo(100/3)
  await call(root+`/collectors/${b.id}/close`,{});expect((await request(`/api/public/flows/${slug}/sessions`,{source:'embed',deviceClass:'desktop',collectorKey:b.publicKey})).status).toBe(409);await call(root+`/collectors/${b.id}/reopen`,{});expect((await start(b)).sessionId).toBeTruthy()
  for(const format of ['json','csv']){let {token}=await call<{token:string}>(root+`/responses/export/start?format=${format}&collectorId=${a.id}`);let output='';while(token){const response=await request(root+'/responses/export',{token});expect(response.status).toBe(200);output+=await response.text();token=response.headers.get('x-export-next')??''}if(format==='json')expect(JSON.parse(output).responses.map((row:{id:string})=>row.id).sort()).toEqual(admitted.map(row=>row.id).sort());else{expect(output).toContain('collector_id,collector_name,collector_channel');expect(output).toContain('July mailing');expect(output).not.toContain('Product feedback')}}
  const frozen=await call<{token:string}>(root+`/responses/export/start?format=csv&collectorId=${a.id}`)
  await call(root+`/collectors/${a.id}`,{name:'July customer mailing',channel:'email',responseLimit:2},'PUT')
  const invalidated=await request(root+'/responses/export',{token:frozen.token});expect(invalidated.status).toBe(400);expect(await invalidated.json()).toMatchObject({error:'VALIDATION_ERROR'})
  await call(`/api/app/responses/${admitted[0].id}`,undefined,'DELETE');expect(await env.DB.prepare('SELECT count(*) AS n FROM response_collector WHERE response_id=?').bind(admitted[0].id).first()).toEqual({n:0});expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({results:[]})

  // RSLT-006: a 3-choice by 2-choice crossing over a fixed dataset of 43 released responses.
  const xslug='northstar-crosstab',xflow=await call<{id:string}>('/api/app/flows',{title:'Northstar plan study',slug:xslug}),xroot=`/api/app/flows/${xflow.id}`
  for(const step of [{kind:'question',questionType:'single_choice',required:true,prompt:'Which plan?',choices:[{value:'a',label:'Starter'},{value:'b',label:'Growth'},{value:'c',label:'Scale'}]},{kind:'question',questionType:'single_choice',required:true,prompt:'Renew?',choices:[{value:'x',label:'Renew'},{value:'y',label:'Leave'}]},{kind:'completion',questionType:null,prompt:'Thanks.'}]){draft=await call<BuilderDraft>(xroot+'/draft');await call(xroot+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step})}
  draft=await call<BuilderDraft>(xroot+'/draft');await call(xroot+'/draft/settings',{expectedVersion:draft.flow.draftVersion,settings:{identityMode:'anonymous',hiddenFields:[{id:'tier',name:'tier',type:'text',category:'plain'}]}},'PUT')
  draft=await call<BuilderDraft>(xroot+'/draft');const xpublication=await call<{revision:{id:string}}>(xroot+'/publish',{expectedVersion:draft.flow.draftVersion})
  const [plan,renew]=draft.steps.filter(step=>step.kind==='question'),choice=(stepId:string,index:number)=>draft.choices.filter(item=>item.stepId===stepId)[index].id
  const mail=await call<Collector>(xroot+'/collectors',{name:'Renewal mailing',channel:'email'}),web=await call<Collector>(xroot+'/collectors',{name:'Account page',channel:'web'})
  const groups:Array<[number,number,number,string|undefined,Collector]>=[[0,0,10,'pro',mail],[0,1,5,'team',web],[1,0,6,'team',web],[1,1,9,'pro',mail],[2,0,3,'pro',web],[2,1,5,'team',mail],[2,1,5,undefined,web]]
  for(const [p,q,count,tier,collector] of groups)for(let n=0;n<count;n++){
    const session=await call<Session>(`/api/public/flows/${xslug}/sessions`,{source:'direct',deviceClass:'desktop',collectorKey:collector.publicKey});await matureLoad(session)
    const receipt=await call<{disposition:string}>(`/api/public/flows/${xslug}/responses`,{...session,idempotencyKey:'cross-'+session.sessionId,answers:[{stepId:plan.id,value:choice(plan.id,p)},{stepId:renew.id,value:choice(renew.id,q)}],...(tier?{hidden:{tier}}:{})});expect(receipt.disposition).toBe('released')
  }
  const policies={autorunEnabled:true,autorunMinimum:5,selection:'highest-impact'}
  const cross=(rows:string,columns:string,extra:Record<string,string>={})=>call<Crosstab>(xroot+`/crosstab?${new URLSearchParams({revisionId:xpublication.revision.id,rows,columns,...extra})}`)
  const counts=(table:Crosstab)=>table.cells.map(row=>row.map(cell=>cell.suppressed?null:cell.count))
  const stated=(table:Crosstab,i:number,j:number,side:'rowShare'|'columnShare')=>{const cell=table.cells[i][j];return cell.suppressed?'suppressed':cell[side]}
  await call('/api/app/analysis/policies',{...policies,disclosureThreshold:1},'PUT')
  const full=await cross(`question:${plan.id}`,`question:${renew.id}`)
  expect(full.rows.map(row=>row.label)).toEqual(['Starter','Growth','Scale']);expect(full.columns.map(column=>column.label)).toEqual(['Renew','Leave'])
  expect(counts(full)).toEqual([[10,5],[6,9],[3,10]]);expect(full.rowTotals).toEqual([15,15,13].map(count=>({withheld:false,count})));expect(full.columnTotals).toEqual([19,24].map(count=>({withheld:false,count})));expect(full.total).toEqual({withheld:false,count:43})
  for(const [i,j,row,column] of [[0,0,15,19],[0,1,15,24],[1,0,15,19],[1,1,15,24],[2,0,13,19],[2,1,13,24]]){
    const count=[[10,5],[6,9],[3,10]][i][j]
    expect(stated(full,i,j,'rowShare')).toEqual({numerator:count,denominator:row,percentage:count/row*100});expect(stated(full,i,j,'columnShare')).toEqual({numerator:count,denominator:column,percentage:count/column*100})
  }
  // Hand-computed: expected counts from 15/15/13 by 19/24 of 43; df 2, so p = exp(-χ²/2).
  expect(full.chiSquare).toMatchObject({offered:true,withheld:false,degreesOfFreedom:2,flagged:true});if(!full.chiSquare.offered||full.chiSquare.withheld)throw new Error('chi-square missing')
  expect(full.chiSquare.statistic).toBeCloseTo(5.529262,5);expect(full.chiSquare.pValue).toBeCloseTo(Math.exp(-5.529262258/2),6);expect(full.chiSquare.minimumExpected).toBeCloseTo(13*19/43,6)
  expect(full.notes).toContain('Rows (Which plan?): Unanswered — none in this selection.')
  // Default analysis.disclosure.v1 threshold 5: the 3-response cell is suppressed; 5 is shown; table totals and shares that would back it out are withheld.
  await call('/api/app/analysis/policies',{...policies,disclosureThreshold:5},'PUT')
  const guarded=await cross(`question:${plan.id}`,`question:${renew.id}`)
  expect(guarded.threshold).toBe(5);expect(guarded.suppressedCells).toBe(1);expect(guarded.cells[2][0]).toEqual({suppressed:true});expect(counts(guarded)).toEqual([[10,5],[6,9],[null,10]])
  expect(guarded.rowTotals).toEqual([{withheld:false,count:15},{withheld:false,count:15},{withheld:true}]);expect(guarded.columnTotals).toEqual([{withheld:true},{withheld:false,count:24}]);expect(guarded.total).toEqual({withheld:true})
  expect(stated(guarded,2,1,'rowShare')).toBeNull();expect(stated(guarded,0,0,'columnShare')).toBeNull();expect(stated(guarded,0,1,'rowShare')).toEqual({numerator:5,denominator:15,percentage:5/15*100});expect(stated(guarded,2,1,'columnShare')).toEqual({numerator:10,denominator:24,percentage:10/24*100})
  expect(guarded.chiSquare).toMatchObject({offered:true,withheld:true});expect(JSON.stringify(guarded)).not.toContain('"count":3,')
  await call('/api/app/analysis/policies',{...policies,disclosureThreshold:1},'PUT')
  // A hidden field with its own Unanswered column; a zero cell is below any threshold and suppressed.
  const hidden=await cross(`question:${plan.id}`,'hidden:tier')
  expect(hidden.columns.map(column=>column.label)).toEqual(['pro','team','Unanswered']);expect(counts(hidden)).toEqual([[10,5,null],[9,6,null],[3,5,5]])
  expect(hidden.rowTotals[2]).toEqual({withheld:false,count:13});expect(stated(hidden,2,2,'rowShare')).toEqual({numerator:5,denominator:13,percentage:5/13*100});expect(hidden.columnTotals.map(total=>total.withheld)).toEqual([false,false,true]);expect(stated(hidden,0,0,'columnShare')).toEqual({numerator:10,denominator:22,percentage:10/22*100})
  const byCollector=await cross('collector',`question:${renew.id}`)
  expect(byCollector.rows.map(row=>row.label)).toEqual(['Renewal mailing','Account page']);expect(counts(byCollector)).toEqual([[10,14],[9,10]]);expect(byCollector.rowTotals).toEqual([24,19].map(count=>({withheld:false,count})))
  expect(byCollector.chiSquare).toMatchObject({offered:true,withheld:false,degreesOfFreedom:1,flagged:true})
  // A LEDG-003 filter moves numerator and denominator together.
  const filtered=await cross(`question:${plan.id}`,`question:${renew.id}`,{collectorId:web.id})
  expect(counts(filtered)).toEqual([[null,5],[6,null],[3,5]]);expect(stated(filtered,2,1,'rowShare')).toEqual({numerator:5,denominator:8,percentage:62.5});expect(stated(full,2,1,'rowShare')).toEqual({numerator:10,denominator:13,percentage:10/13*100})
  expect(filtered.filter).toMatchObject({collectorId:web.id,revisionId:xpublication.revision.id})
  expect((await request(xroot+`/crosstab?${new URLSearchParams({revisionId:xpublication.revision.id,rows:`question:${plan.id}`,columns:`question:${plan.id}`})}`)).status).toBe(400)
  // LEDG-005 across export parts: 43 responses span two cursor pages, so the XLSX CRC and the SAV command block carry over.
  const reader=(env as unknown as {EXPORT_READER_ORIGIN:string}).EXPORT_READER_ORIGIN
  const exported=async(format:string)=>{let {token}=await call<{token:string}>(xroot+`/responses/export/start?format=${format}`);const parts:Uint8Array[]=[];while(token){const response=await request(xroot+'/responses/export',{token});expect(response.status).toBe(200);parts.push(new Uint8Array(await response.arrayBuffer()));token=response.headers.get('x-export-next')??''}expect(parts.length).toBe(2);return new Uint8Array(await new Blob(parts).arrayBuffer())}
  const csvIds=new TextDecoder().decode(await exported('csv')).split('\r\n').slice(1).map(line=>line.slice(1,line.indexOf('"',1)))
  const read=async<T,>(kind:string,bytes:Uint8Array)=>{const response=await fetch(`${reader}/${kind}`,{method:'POST',body:bytes});expect(response.status,await response.clone().text()).toBe(200);return response.json<T>()}
  const workbook=await read<{sheets:Array<{rows:unknown[][]}>}>('xlsx',await exported('xlsx'));expect(workbook.sheets[0].rows.slice(1).map(row=>row[0])).toEqual(csvIds)
  const sav=await read<{header:{n_cases:number};rows:Array<Record<string,unknown>>}>('sav',await exported('sav'));expect(sav.header.n_cases).toBe(43);expect(sav.rows.map(row=>row.response_id)).toEqual(csvIds)
  expect(sav.rows.map(row=>row.hidden_tier??'')).toEqual(await Promise.all(csvIds.map(async id=>(await env.DB.prepare("SELECT COALESCE(json_extract(response_context_json,'$.hidden.tier'),'') AS tier FROM responses WHERE id=?").bind(id).first<{tier:string}>())!.tier)))
  await call('/api/app/analysis/policies',{...policies,disclosureThreshold:5},'PUT')

  // ct exposure phase: a different matrix with Scale = 8, including Renew = 3 and Churn = 5.
  const exposure = await collectDisclosureScenario(call, 'operator-disclosure')
  const exposureTable = await call<Crosstab>(exposure.path + '/crosstab?' + new URLSearchParams({ revisionId: exposure.revisionId, rows: `question:${exposure.planId}`, columns: `question:${exposure.renewalId}` }))
  expect(exposureTable.revision.id).toBe(exposure.revisionId)
  expect(exposureTable.filter).toEqual({ revisionId: exposure.revisionId })
  expect(counts(exposureTable)).toEqual([[10,5],[10,10],[null,5]])
  expect(exposureTable.rowTotals[2]).toEqual({ withheld: true })
  expect(exposureTable.columnTotals[0]).toEqual({ withheld: true })
  expect(exposureTable.total).toEqual({ withheld: true })
  expect(exposureTable.chiSquare).toMatchObject({ offered: true, withheld: true })
  const summaries = await call<QuestionReport[]>(exposure.path + '/questions?revisionId=' + exposure.revisionId)
  const planSummary = summaries.find(question => question.id === exposure.planId)!
  expect(planSummary.answered).toBe(43)
  expect(planSummary.distribution.find(bucket => bucket.label === 'Scale')).toMatchObject({ count: 8 })
  const results = await call<FlowResults>(exposure.path + '/results?revisionId=' + exposure.revisionId)
  expect(results.revision.id).toBe(exposure.revisionId); expect(results.completedResponses).toBe(43)
  const selected = await call<Ledger>(exposure.path + '/ledger?' + new URLSearchParams(exposure.filter))
  expect(selected.total).toBe(3)
  expect(selected.responses.map(row => row.id).sort()).toEqual([...exposure.exposedIds].sort())
  for (const row of selected.responses) {
    expect(row.revisionId).toBe(exposure.revisionId); expect(row.state).toBe('released')
    expect(row.completedAt <= exposureTable.cutoff && row.releasedAt! <= exposureTable.cutoff).toBe(true)
    expect(row.answers.find(answer => answer.stepId === exposure.planId)?.value).toBe(exposure.scaleId)
    expect(row.answers.find(answer => answer.stepId === exposure.renewalId)?.value).toBe(exposure.renewId)
  }
  const exposureExport = async (format: string, filter: Record<string, string> = exposure.filter) => {
    let { token } = await call<{ token: string }>(exposure.path + '/responses/export/start?' + new URLSearchParams({ format, ...filter }))
    const parts: Uint8Array[] = []
    while (token) {
      const response = await request(exposure.path + '/responses/export', { token }); expect(response.status).toBe(200)
      parts.push(new Uint8Array(await response.arrayBuffer())); token = response.headers.get('x-export-next') ?? ''
    }
    return new Uint8Array(await new Blob(parts).arrayBuffer())
  }
  const snapshot = JSON.parse(new TextDecoder().decode(await exposureExport('json'))) as { responses: LedgerResponse[]; filter: unknown }
  expect(snapshot.filter).toMatchObject(exposure.filter)
  expect(snapshot.responses).toEqual(selected.responses.map(row => ({ ...row, answers: row.answers.map(answer => ({ ...answer, value: answer.stepId === exposure.planId ? 'scale' : 'renew' })) })))
  const [head, ...csv] = csvRows(new TextDecoder().decode(await exposureExport('csv')))
  expect(csv).toHaveLength(3)
  expect(csv.map(row => row[head.indexOf('response_id')])).toEqual(selected.responses.map(row => row.id))
  for (const row of csv) expect(JSON.parse(row[head.indexOf('answers_json')])).toEqual(snapshot.responses.find(item => item.id === row[0])!.answers)
  const exposureWorkbook = await read<{ sheets: Array<{ rows: unknown[][] }> }>('xlsx', await exposureExport('xlsx'))
  expect(exposureWorkbook.sheets[0].rows[0]).toEqual(head)
  for (const [index, row] of exposureWorkbook.sheets[0].rows.slice(1).entries()) {
    expect(row.map(value => String(value ?? '')).filter((_, i) => head[i] !== 'cutoff')).toEqual(csv[index].filter((_, i) => head[i] !== 'cutoff'))
  }
  expect(exposureWorkbook.sheets[0].rows).toHaveLength(4)
  const exposureSav = await read<{ rows: Array<Record<string, unknown>> }>('sav', await exposureExport('sav'))
  expect(exposureSav.rows.map(row => row.response_id)).toEqual(selected.responses.map(row => row.id))
  const [metadataHead, ...metadata] = exposureWorkbook.sheets[1].rows
  for (const [stepId, choiceId] of [[exposure.planId, exposure.scaleId], [exposure.renewalId, exposure.renewId]]) {
    const entry = metadata.find(row => row[metadataHead.indexOf('step_id')] === stepId && row[metadataHead.indexOf('choice_id')] === choiceId)!
    for (const row of exposureSav.rows) expect(row[String(entry[metadataHead.indexOf('sav_variable')])]).toBe(entry[metadataHead.indexOf('sav_code')])
  }
  const raw = JSON.parse(new TextDecoder().decode(await exposureExport('json', { revisionId: exposure.revisionId }))) as { responses: LedgerResponse[] }
  expect(raw.responses.map(row => row.id).sort()).toEqual([...exposure.receipts].sort())
},120000)
