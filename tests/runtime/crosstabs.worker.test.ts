import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import type { BuilderDraft, LedgerResponse } from '../../src/core/app/api'
import type { ImportReview } from '../../src/core/features/importing/model'
import type { CrossTabInput, CrossTabOptions, CrossTabReport } from '../../src/core/features/reporting/crosstabs'
import { authoringClient } from './choice-recall-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

contract(['RSLT-006'], 'categorical crosstabs count released native and imported respondents with paired percentages, independent-table chi-square and disclosure-safe margins', async()=>{
  const f=await authoringClient()
  const definition={title:'Northstar category comparisons',fields:[
    {id:'segment',ref:'segment',type:'multiple_choice',title:'Customer segment',properties:{allow_other_choice:true,choices:[{id:'a',label:'Business'},{id:'b',label:'Personal'}]}},
    {id:'channel',ref:'channel',type:'multiple_choice',title:'Preferred channel',properties:{choices:[{id:'x',label:'Online'},{id:'y',label:'In person'}]}},
    {id:'services',ref:'services',type:'multiple_choice',title:'Services used',properties:{allow_multiple_selection:true,allow_other_choice:true,choices:[{id:'p',label:'Planning'},{id:'q',label:'Support'},{id:'r',label:'Unused category'}]}},
    {id:'number',ref:'number',type:'number',title:'Unbounded number',properties:{}},
  ]}
  const fixed=[[1,9],[9,1],[5,5]],items:unknown[]=[]
  for(let row=0;row<3;row++)for(let column=0;column<2;column++)for(let index=0;index<fixed[row][column];index++)items.push({submitted_at:`2024-01-02T12:00:${String(items.length).padStart(2,'0')}Z`,answers:[
    {field:{id:'segment'},type:'choice',choice:row===2?{other:'Private custom segment'}:{id:row===0?'a':'b'}},
    {field:{id:'channel'},type:'choice',choice:{id:column===0?'x':'y'}},
    {field:{id:'services'},type:'choices',choices:{ids:['p','q'],...(row===2?{other:'Private custom service'}:{})}},
  ]})
  const input={definition:JSON.stringify(definition),csv:'',responses:JSON.stringify({items})}
  const review=await f.call<ImportReview>('/api/app/imports/review',input)
  expect(review.rowErrors).toEqual([]);expect(review.responseCount).toBe(30)
  let job=await f.call<{id:string;state:string}>('/api/app/imports/commit',{...input,plannedAt:review.plannedAt,columns:review.columns,fingerprint:review.fingerprint,acknowledged:true})
  while(job.state!=='completed')job=await f.call(`/api/app/imports/${job.id}/resume`,{})
  const root=`/api/app/flows/${review.flowId}`,draft=await f.call<BuilderDraft>(root+'/draft')
  const ledger=await f.call<{responses:LedgerResponse[]}>(root+'/ledger')
  const revisionId=ledger.responses[0].revisionId
  const options=await f.call<CrossTabOptions>(root+'/crosstabs/options?revisionId='+revisionId)
  const segment=options.dimensions.find(dimension=>dimension.label==='Customer segment')!,channel=options.dimensions.find(dimension=>dimension.label==='Preferred channel')!,services=options.dimensions.find(dimension=>dimension.label==='Services used')!
  const policy=(threshold:number)=>f.call('/api/app/analysis/policies',{autorunEnabled:false,autorunMinimum:5,disclosureThreshold:threshold,selection:'highest-impact'},'PUT')
  await policy(1)
  const query:CrossTabInput={revisionId,row:segment.dimension,column:channel.dimension}
  const read=(change:Partial<CrossTabInput>={})=>f.call<CrossTabReport>(root+'/crosstabs',{...query,...change})
  const cell=(report:CrossTabReport,r:number,c:number)=>report.cells.find(cell=>cell.rowKey===report.rows[r].key&&cell.columnKey===report.columns[c].key)!
  const baseline=await read()
  expect(baseline).toMatchObject({totalRespondents:30,pairedRespondents:30,unpairedRespondents:0,chiSquare:{eligible:true,df:2,minimumExpected:5}})
  expect(baseline.chiSquare.statistic).toBeCloseTo(12.8)
  for(let row=0;row<3;row++)for(let column=0;column<2;column++){
    expect(cell(baseline,row,column).count).toBe(fixed[row][column])
    expect(cell(baseline,row,column).rowPercent).toBeCloseTo(fixed[row][column]/10*100)
    expect(cell(baseline,row,column).columnPercent).toBeCloseTo(fixed[row][column]/15*100)
  }
  expect(JSON.stringify(baseline)).not.toContain('Private custom segment')
  const multi=await read({row:services.dimension})
  expect(multi.chiSquare).toMatchObject({eligible:false,statistic:null,df:null})
  expect(multi.rows.map(row=>row.pairedRespondents)).toEqual([30,30,0,10])
  expect(cell(multi,0,0)).toMatchObject({count:15,rowPercent:50,columnPercent:100})
  expect(cell(multi,1,0).columnPercent!+cell(multi,0,0).columnPercent!).toBeGreaterThan(100)
  expect(cell(multi,2,0)).toMatchObject({count:0,rowPercent:null,columnPercent:0,suppressed:false})
  expect(JSON.stringify(multi)).not.toContain('Private custom service')
  const byCollector=await read({row:{kind:'collector'}})
  expect(byCollector.rows.find(row=>row.value===ledger.responses[0].collector.id)?.pairedRespondents).toBe(30)
  expect(byCollector.rows.some(row=>row.pairedRespondents===0)).toBe(true)
  expect(byCollector.chiSquare.eligible).toBe(false)

  // Publishing opens a new native revision; historical responses keep their own.
  const publication=await f.call<{revision:{id:string}}>(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const nativeQuery={...query,revisionId:publication.revision.id}
  const nativeBefore=await f.call<CrossTabReport>(root+'/crosstabs',nativeQuery)
  expect(nativeBefore).toMatchObject({pairedRespondents:0,totalRespondents:0})
  const session=await f.call<{sessionId:string;sessionToken:string;revisionId:string}>(`/api/public/flows/${draft.flow.slug}/sessions`,{source:'direct',deviceClass:'desktop'})
  expect(session.revisionId).toBe(publication.revision.id)
  await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now()-6000).toISOString(),session.sessionId).run()
  expect(await f.call(`/api/public/flows/${draft.flow.slug}/responses`,{...session,idempotencyKey:session.sessionId,answers:[
    {stepId:segment.dimension.kind==='question'?segment.dimension.stepId:'',value:segment.buckets[0].value},
    {stepId:channel.dimension.kind==='question'?channel.dimension.stepId:'',value:channel.buckets[0].value},
    {stepId:services.dimension.kind==='question'?services.dimension.stepId:'',value:services.buckets.slice(0,2).map(bucket=>bucket.value)},
  ]})).toMatchObject({disposition:'released'})
  const partial=await f.call<{sessionId:string;sessionToken:string;revisionId:string}>(`/api/public/flows/${draft.flow.slug}/sessions`,{source:'direct',deviceClass:'desktop'})
  await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now()-6000).toISOString(),partial.sessionId).run()
  expect(await f.call(`/api/public/flows/${draft.flow.slug}/responses`,{...partial,idempotencyKey:partial.sessionId,answers:[{stepId:segment.dimension.kind==='question'?segment.dimension.stepId:'',value:segment.buckets[0].value}]})).toMatchObject({disposition:'released'})
  expect(await f.call<CrossTabReport>(root+'/crosstabs',nativeQuery)).toMatchObject({totalRespondents:2,pairedRespondents:1,unpairedRespondents:1})
  expect((await f.call<CrossTabReport>(root+'/crosstabs',{...nativeQuery,cutoff:nativeBefore.cutoff})).pairedRespondents).toBe(0)
  expect((await read()).pairedRespondents).toBe(30)
  expect((await read({cutoff:baseline.cutoff})).pairedRespondents).toBe(30)
  expect((await read({filter:{source:'imported'}})).pairedRespondents).toBe(30)
  expect((await read({filter:{source:'direct'}})).pairedRespondents).toBe(0)
  expect((await f.call<CrossTabReport>(root+'/crosstabs',{...nativeQuery,filter:{source:'direct'}})).pairedRespondents).toBe(1)
  expect((await f.call<CrossTabReport>(root+'/crosstabs',{...nativeQuery,filter:{source:'imported'}})).pairedRespondents).toBe(0)
  const collectorFilter={revisionId,collectorId:ledger.responses[0].collector.id}
  expect((await read({filter:collectorFilter})).pairedRespondents).toBe(30)
  expect((await f.call<{total:number}>(root+'/ledger?'+new URLSearchParams(collectorFilter))).total).toBe(30)
  expect((await read({filter:{from:'2024-01-01T00:00:00Z',to:'2024-12-31T23:59:59Z'}})).pairedRespondents).toBe(30)
  const answerFilter={revisionId,answerStepId:channel.dimension.kind==='question'?channel.dimension.stepId:'',answerValue:String(channel.buckets[0].value)}
  expect((await read({filter:answerFilter})).pairedRespondents).toBe(15)
  expect((await f.call<{total:number}>(root+'/ledger?'+new URLSearchParams(answerFilter))).total).toBe(15)

  await policy(5)
  const hidden=await read({cutoff:baseline.cutoff})
  expect(cell(hidden,0,0)).toMatchObject({count:null,rowPercent:null,columnPercent:null,suppressed:true})
  expect(cell(hidden,0,1)).toMatchObject({count:9,rowPercent:null,columnPercent:null,suppressed:false})
  expect(hidden.rows.map(row=>row.pairedRespondents)).toEqual([null,null,10])
  expect(hidden.columns.every(column=>column.pairedRespondents===null)).toBe(true)
  expect(hidden).toMatchObject({totalRespondents:null,pairedRespondents:null,unpairedRespondents:null,chiSquare:{eligible:false,statistic:null,df:null,minimumExpected:null},disclosure:{suppressed:true}})
  expect((await read({row:services.dimension,cutoff:baseline.cutoff})).rows[2]).toMatchObject({pairedRespondents:0,suppressed:false})
  expect((await f.request(root+'/crosstabs',{...query,column:query.row})).status).toBe(400)
  const numeric=review.questions.find(question=>question.questionType==='number')!
  expect((await f.request(root+'/crosstabs',{...query,row:{kind:'question',stepId:numeric.id}})).status).toBe(400)
  expect((await f.request(root+'/crosstabs',{...query,workspaceId:'elsewhere'})).status).toBe(400)
  expect((await f.request(root+'/crosstabs',{...query,filter:{revisionId:'wrong-revision'}})).status).toBe(400)
  expect((await f.request(`/api/app/flows/unrelated/crosstabs`,query)).status).toBe(404)
  expect((await SELF.fetch(`http://localhost${root}/crosstabs`,{method:'POST',headers:{Host:'localhost',Origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(query)})).status).toBe(401)
},60000)
