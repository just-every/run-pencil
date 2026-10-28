import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { ai, analysisHttp, answer, theme } from './analysis-fixture'
import { matureLoad } from './load-time-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

contract('RSLT-012','codes twenty answers by hand and twenty by exact AI quotes, rejects without assigning, charts and filters with source custody',async()=>{
  await ai.reset()
  const f=await analysisHttp(),manual:string[]=[],suggested:string[]=[]
  const json=async(path:string,body?:unknown,method?:string,status=200)=>{
    const result=await f.call(path,body,method);expect(result.status,await result.clone().text()).toBe(status);return result.json() as Promise<any>
  }
  const code=await json('/api/app/codes',{label:'Queue'},'POST',201),other=await json('/api/app/codes',{label:'Prices'},'POST',201),rejectedCode=await json('/api/app/codes',{label:'Rejected'},'POST',201)
  expect((await json('/api/app/codes',{label:' QUEUE '},'POST',201)).id).toBe(code.id)
  for(let i=0;i<20;i++) manual.push(await f.respond(`Manual queue feedback number ${i}.`))
  for(let i=0;i<20;i++) suggested.push(await f.respond(`Suggested queue feedback number ${i}.`))
  const assign=(id:string,codeId=code.id)=>`/api/app/responses/${id}/answers/${f.questions.improve}/codes/${codeId}`
  for(const id of manual) expect((await json(assign(id),{},'PUT')).source).toBe('manual')
  const first=await json(assign(manual[0]),{},'PUT');expect((await json(assign(manual[0]),{},'PUT')).id).toBe(first.id)
  const quotes=suggested.map(responseId=>({responseId,questionId:f.questions.improve,start:10,end:15,text:'queue'}))
  const rejectQuote={responseId:manual[0],questionId:f.questions.improve,start:7,end:12,text:'queue'}
  await ai.script(answer({outcome:'findings',reason:'',themes:[theme('Queue',suggested,quotes),theme('Another suggestion',manual,[rejectQuote]),theme('Withheld',manual.slice(0,4),[rejectQuote])],recommendations:[]}))
  const run=await f.request();expect(run.state).toBe('completed')
  const suggestions=await json(`/api/app/flows/${f.flowId}/coding/suggestions`)
  expect(suggestions.suggestions).toHaveLength(21)
  const accepted=suggestions.suggestions.filter((q:any)=>q.suggestedLabel==='Queue')
  for(const quote of accepted){
    expect(quote.excerpt).toBe('queue');expect(quote).toMatchObject({start:10,end:15,runId:run.id})
    const decision=await json(`/api/app/coding/suggestions/${quote.id}`,{decision:'accepted',codeId:code.id},'PUT')
    expect(decision.actorOperatorId).toBe(f.operatorId)
  }
  const decisionPath=`/api/app/coding/suggestions/${accepted[0].id}`
  expect((await json(decisionPath,{decision:'accepted',codeId:code.id},'PUT')).decision).toBe('accepted')
  expect((await f.call(decisionPath,{decision:'rejected'},'PUT')).status).toBe(409)
  const reject=suggestions.suggestions.find((q:any)=>q.suggestedLabel==='Another suggestion')
  expect((await json(`/api/app/coding/suggestions/${reject.id}`,{decision:'rejected'},'PUT')).codeId).toBeNull()
  const hidden=(await env.DB.prepare('SELECT q.id FROM analysis_quotes q JOIN analysis_themes t ON t.id=q.theme_id WHERE t.run_id=? AND t.title=?').bind(run.id,'Withheld').first<{id:string}>())!.id
  expect((await f.call(`/api/app/coding/suggestions/${hidden}`,{decision:'accepted',codeId:code.id},'PUT')).status).toBe(404)
  const counts=await json(`/api/app/flows/${f.flowId}/coding/counts`)
  expect(counts).toMatchObject({responseDenominator:40,answerDenominator:40})
  expect(counts.codes.find((c:any)=>c.id===code.id)).toMatchObject({answerCount:40,responseCount:40})
  expect(counts.codes.find((c:any)=>c.id===rejectedCode.id).responseCount).toBe(0)
  const answers=await json(`/api/app/flows/${f.flowId}/coding/answers`)
  expect(answers.answers).toHaveLength(40)
  expect(answers.answers.flatMap((a:any)=>a.assignments).filter((a:any)=>a.source==='manual')).toHaveLength(20)
  expect(answers.answers.flatMap((a:any)=>a.assignments).filter((a:any)=>a.source==='ai_suggestion')).toHaveLength(20)
  expect(answers.answers.find((a:any)=>a.responseId===suggested[0]).assignments[0]).toMatchObject({actorOperatorId:f.operatorId,runId:run.id,quoteId:accepted.find((a:any)=>a.responseId===suggested[0]).id})
  await json(assign(manual[0],other.id),{},'PUT')
  const filtered=await json(`/api/app/flows/${f.flowId}/ledger?codeId=${other.id}`)
  expect(filtered.responses.map((r:any)=>r.id)).toEqual([manual[0]])
  const filteredCounts=await json(`/api/app/flows/${f.flowId}/coding/counts?codeId=${other.id}`)
  expect(filteredCounts).toMatchObject({responseDenominator:1,answerDenominator:1})
  const cross=await json(`/api/app/flows/${f.flowId}/coding/crosstab?rowCodeId=${code.id}&columnCodeId=${other.id}`)
  expect(cross).toMatchObject({responseDenominator:40,cells:[{rowPresent:false,columnPresent:false,count:0},{rowPresent:false,columnPresent:true,count:0},{rowPresent:true,columnPresent:false,count:39},{rowPresent:true,columnPresent:true,count:1}]})
  const snapshot=await json(`/api/app/flows/${f.flowId}/responses/export/start`,{format:'json',codeId:other.id},'POST')
  await json(assign(manual[1],other.id),{},'PUT')
  expect((await f.call(`/api/app/flows/${f.flowId}/responses/export`,{token:snapshot.token},'POST')).status).toBe(400)
  expect((await f.call(assign(manual[1],other.id),{},'DELETE')).status).toBe(204)
  const foreign=await analysisHttp({},'coding-foreign')
  expect((await foreign.call(assign(manual[0]),{},'PUT')).status).toBe(404)
  expect((await foreign.call(`/api/app/flows/${f.flowId}/coding/answers`)).status).toBe(404)
  expect((await foreign.call(decisionPath,{decision:'accepted',codeId:code.id},'PUT')).status).toBe(404)
  expect((await foreign.call('/api/app/codes')).status).toBe(200)
  expect((await (await foreign.call('/api/app/codes')).json() as any).codes).toEqual([])
  const quarantined=await f.respond('Secret held answer',{quarantine:true})
  expect((await f.call(assign(quarantined),{},'PUT')).status).toBe(404)
  expect((await f.call(`/api/app/responses/${manual[0]}/answers/${f.questions.email}/codes/${code.id}`,{},'PUT')).status).toBe(404)
  expect((await f.call(`/api/app/responses/${manual[0]}`,{},'DELETE')).status).toBe(204)
  const redacted=await json(`/api/app/flows/${f.flowId}/coding/suggestions`);expect(redacted.suggestions).toEqual([])
  expect((await json(`/api/app/flows/${f.flowId}/coding/counts`)).codes.find((c:any)=>c.id===code.id).responseCount).toBe(19)
  expect((await json(assign(suggested[0]),{},'PUT')).source).toBe('manual')
  expect((await json(`/api/app/flows/${f.flowId}/coding/counts`)).codes.find((c:any)=>c.id===code.id).responseCount).toBe(20)
  await ai.script(answer({outcome:'findings',reason:'',themes:[theme('Fresh queue',suggested,[quotes[1]])],recommendations:[]}))
  const fresh=await f.request();expect(fresh.state).toBe('completed')
  const freshQuote=(await json(`/api/app/flows/${f.flowId}/coding/suggestions`)).suggestions[0]
  await json(`/api/app/coding/suggestions/${freshQuote.id}`,{decision:'accepted',codeId:code.id},'PUT')
  expect((await json(`/api/app/flows/${f.flowId}/coding/counts`)).codes.find((c:any)=>c.id===code.id).responseCount).toBe(21)
  expect((await f.call(assign(manual[1]),{},'DELETE')).status).toBe(204)
  expect((await f.call(assign(manual[1]),{},'DELETE')).status).toBe(204)
})

contract(["RSLT-012","FIELD-010","FIELD-017"],'codes retained Other write-ins as text while refusing plain choice labels and quarantined or foreign answers',async()=>{
  const f=await analysisHttp({},'coding-other')
  const created=await f.services.flows.createDraftFlow({workspaceId:f.workspaceId,title:'Other coding',slug:'coding-other-text'})
  const draft=()=>f.services.flows.getBuilderDraft(f.workspaceId,created.id)
  for(const step of [{kind:'question' as const,questionType:'single_choice' as const,prompt:'Other feedback',required:true,choices:[{value:'a',label:'Alpha'},{value:'other',label:'Other'}]},{kind:'completion' as const,questionType:null,prompt:'Done'}]) await f.services.flows.addDraftStep({workspaceId:f.workspaceId,flowId:created.id,expectedVersion:(await draft()).flow.draftVersion,step})
  let d=await draft();const q=d.steps[0],choices=d.choices.filter(c=>c.stepId===q.id)
  await f.services.flows.updateBuilderDraft({workspaceId:f.workspaceId,flowId:created.id,expectedVersion:d.flow.draftVersion,stepId:q.id,prompt:q.prompt,required:true,questionSettings:{otherChoiceId:choices[1].id}})
  d=await draft();await f.services.flows.publishDraft({workspaceId:f.workspaceId,flowId:created.id,expectedVersion:d.flow.draftVersion})
  const submit=async(value:unknown)=>{
    const session=await f.services.responses.startPublicSession({slug:'coding-other-text',source:'direct',deviceClass:'mobile',clientAddress:crypto.randomUUID()});await matureLoad(session,5000)
    const response=await f.call('/api/public/flows/coding-other-text/responses',{sessionId:session.sessionId,sessionToken:session.sessionToken,loadTime:session.loadTime,idempotencyKey:`code-${session.sessionId}`,honeypot:'',answers:[{stepId:q.id,value}]})
    expect(response.status,await response.clone().text()).toBe(201);return (await response.json() as {responseId:string}).responseId
  }
  const otherId=await submit({choiceIds:[choices[1].id],otherText:'Evening appointments'}),plainId=await submit(choices[0].id)
  const code=await (await f.call('/api/app/codes',{label:'Scheduling'})).json() as {id:string}
  const path=(id:string)=>`/api/app/responses/${id}/answers/${q.id}/codes/${code.id}`
  expect((await f.call(path(otherId),{},'PUT')).status).toBe(200)
  expect((await f.call(path(plainId),{},'PUT')).status).toBe(404)
  const result=await (await f.call(`/api/app/flows/${created.id}/coding/answers`)).json() as any
  expect(result.answers).toMatchObject([{responseId:otherId,text:'Evening appointments',assignments:[{codeId:code.id,source:'manual'}]}])
  const counts=await (await f.call(`/api/app/flows/${created.id}/coding/counts`)).json() as any
  expect(counts).toMatchObject({responseDenominator:2,answerDenominator:1})
  expect(counts.codes.find((c:any)=>c.id===code.id)).toMatchObject({answerCount:1,responseCount:1})
})
