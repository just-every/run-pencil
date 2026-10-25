import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { httpExport } from '../helpers/report-download'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import type { FormSettings } from '../../src/core/shared/hiddenFields'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))

async function fixture() {
  const f=await googleHttp(),slug=`hidden-${crypto.randomUUID()}`
  const created=await f.call('/api/app/flows',{title:'Campaign consultation',slug})
  const {id}=await created.json() as {id:string},base=`/api/app/flows/${id}`
  const read=async()=>await (await f.call(`${base}/draft`)).json() as BuilderDraft
  for(const step of [
    {kind:'question',questionType:'number',prompt:'Team size',required:true},
    {kind:'completion',questionType:null,prompt:'Standard consultation'},
    {kind:'completion',questionType:null,prompt:'Enterprise consultation'},
    {kind:'completion',questionType:null,prompt:'Choose your plan'},
  ])expect((await f.call(`${base}/draft/steps`,{expectedVersion:(await read()).flow.draftVersion,step})).status).toBe(201)
  const settings:FormSettings={identityMode:'anonymous',hiddenFields:[{id:'campaign',name:'utm_campaign',type:'text',category:'campaign'},{id:'plan',name:'plan',type:'text',category:'plain'}]}
  const save=async(value=settings)=>f.call(`${base}/draft/settings`,{settings:value,expectedVersion:(await read()).flow.draftVersion},{method:'PUT'})
  expect((await save()).status).toBe(200)
  const draft=await read(),[question,,enterprise,blank]=draft.steps
  expect((await f.call(`${base}/draft/branches`,{expectedVersion:draft.flow.draftVersion,rules:[
    {sourceStepId:question.id,predicateKind:'equals',expectedValue:null,destinationStepId:enterprise.id,position:0,condition:{kind:'test',stepId:'hidden:plan',operator:'equals',value:'enterprise'}},
    {sourceStepId:question.id,predicateKind:'equals',expectedValue:null,destinationStepId:blank.id,position:1,condition:{kind:'test',stepId:'hidden:plan',operator:'is_blank'}},
  ]},{method:'PUT'})).status).toBe(200)
  const publish=()=>read().then(d=>f.call(`${base}/publish`,{expectedVersion:d.flow.draftVersion}))
  const submit=async(hidden:Record<string,unknown>,idempotencyKey=crypto.randomUUID())=>{
    const start=await (await f.call(`/api/public/flows/${slug}/sessions`,{deviceClass:'desktop',source:'direct'})).json() as {sessionId:string;sessionToken:string;revisionId:string}
    const input={...start,loadTime:await issueLoadTime(env.SESSION_SECRET,start.revisionId,Date.now()-5000),idempotencyKey,answers:[{stepId:question.id,value:75}],hidden}
    const response=await f.call(`/api/public/flows/${slug}/responses`,input)
    expect(response.status,await response.clone().text()).toBe(201)
    return {receipt:await response.json() as {responseId:string;completionStepId:string},input}
  }
  return {...f,id,slug,base,read,save,publish,settings,question,enterprise,blank,submit}
}

contract(["FIELD-001"], 'declared hidden link values preserve typed admission and custody while refusing unsafe identity and parameters', async () => {
  for (const [caseName, executeCase] of [
    ["collects only declared typed link values, routes present and blank values, and retains filtered exports and copy custody", async()=>{
  const f=await fixture()
  expect((await f.publish()).status).toBe(201)
  const first=await f.submit({plan:'  ENTERPRISE ',utm_campaign:'spring',secret:'never-retain'})
  expect(first.receipt.completionStepId).toBe(f.enterprise.id)
  expect((await f.submit({utm_campaign:'summer'})).receipt.completionStepId).toBe(f.blank.id)
  const replay=await f.call(`/api/public/flows/${f.slug}/responses`,{...first.input,hidden:{plan:'different'}})
  expect(await replay.json()).toMatchObject({...first.receipt,idempotent:true})
  const ledger=await (await f.call(`${f.base}/ledger?search=spring`)).json() as Ledger
  expect(ledger.total).toBe(1)
  expect(ledger.responses[0]).toMatchObject({id:first.receipt.responseId,identityMode:'anonymous',discardedParameters:1,hiddenFields:expect.arrayContaining([{id:'campaign',name:'utm_campaign',type:'text',value:'spring'}])})
  const query=new URLSearchParams({answerStepId:'hidden:campaign',answerValue:JSON.stringify('spring')})
  const exported=await httpExport<{responses:Array<{id:string;hiddenFields:unknown[]}>}>(path=>f.call(path),`${f.base}/responses/export?${query}`)
  expect(exported.responses.map(row=>row.id)).toEqual([first.receipt.responseId])
  expect(JSON.stringify(exported)).not.toContain('never-retain')
  const savedSession=await (await f.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'mobile',source:'direct'})).json() as {sessionId:string;sessionToken:string;revisionId:string}
  const commandKey=crypto.randomUUID()
  const saved=await f.call(`/api/public/flows/${f.slug}/sessions/save`,{...savedSession,commandKey,email:'resume@example.test',currentStepId:f.question.id,answers:[],hidden:{plan:'enterprise',utm_campaign:'saved-spring'}})
  expect(saved.status,await saved.clone().text()).toBe(200)
  const resume=await f.call(`/api/public/flows/${f.slug}/resume`,{token:await resumeBearer(env.SESSION_SECRET,savedSession.sessionId,commandKey)})
  const resumed=await resume.json() as {flow:BuilderDraft;sessionId:string;sessionToken:string;loadTime:string}
  expect(resumed.flow.hiddenContext).toMatchObject({hidden:{plan:'enterprise',campaign:'saved-spring'}})
  expect((await (await f.call(`${f.base}/ledger`)).json() as Ledger).total).toBe(2)
  const completed=await f.call(`/api/public/flows/${f.slug}/responses`,{sessionId:resumed.sessionId,sessionToken:resumed.sessionToken,loadTime:await issueLoadTime(env.SESSION_SECRET,savedSession.revisionId,Date.now()-5000),idempotencyKey:crypto.randomUUID(),answers:[{stepId:f.question.id,value:15}],hidden:{plan:'enterprise',utm_campaign:'saved-spring'}})
  expect(completed.status,await completed.clone().text()).toBe(201)
  expect(await env.DB.prepare('SELECT response_context_json AS context FROM respondent_saves WHERE session_id=?').bind(savedSession.sessionId).first()).toEqual({context:null})
  const copied=await (await f.call(`${f.base}/duplicate`,{title:'Campaign copy',slug:`copy-${f.slug}`})).json() as {id:string}
  const copy=await (await f.call(`/api/app/flows/${copied.id}/draft`)).json() as BuilderDraft
  expect(copy.formSettings!.hiddenFields.map(field=>field.id)).not.toContain('plan')
  expect((await f.call(`/api/app/flows/${copied.id}/publish`,{expectedVersion:copy.flow.draftVersion})).status).toBe(201)
  const draft=await f.read()
  const changedSettings=await f.call(`${f.base}/draft/settings`,{settings:{identityMode:'anonymous',hiddenFields:[]},expectedVersion:draft.flow.draftVersion},{method:'PUT'})
  expect(changedSettings.status).toBe(200)
  const refused=await f.publish()
  expect(refused.status).toBe(400)
  expect(await refused.text()).toContain('condition 1')
  expect((await f.call(`${f.base}/draft/settings`,{settings:f.settings,expectedVersion:draft.flow.draftVersion},{method:'PUT'})).status).toBe(200)
  expect(await (await f.call(`/api/public/flows/${f.slug}`)).json()).toMatchObject({formSettings:f.settings})
  const contactResponse=await f.call('/api/app/distribution/contacts',{name:'Invited customer',email:'invited@example.test'})
  expect(contactResponse.status).toBe(201)
  const contact=await contactResponse.json() as {id:string}
  const launch=await f.call(`${f.base}/distribution`,{contactIds:[contact.id],commandKey:crypto.randomUUID()})
  expect(launch.status,await launch.clone().text()).toBe(201)
  const participant=await env.DB.prepare('SELECT token FROM invitation_participants WHERE contact_id=?').bind(contact.id).first<{token:string}>()
  const session=await (await f.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'desktop',source:'direct',invitationToken:participant!.token})).json() as {sessionId:string;sessionToken:string;revisionId:string}
  const invited=await f.call(`/api/public/flows/${f.slug}/responses`,{...session,invitationToken:participant!.token,loadTime:await issueLoadTime(env.SESSION_SECRET,session.revisionId,Date.now()-5000),idempotencyKey:crypto.randomUUID(),answers:[{stepId:f.question.id,value:12}],hidden:{plan:'enterprise'}})
  expect(invited.status,await invited.clone().text()).toBe(201)
  const receipt=await invited.json() as {responseId:string}
  const invitedLedger=await (await f.call(`${f.base}/ledger`)).json() as Ledger
  expect(invitedLedger.responses.find(row=>row.id===receipt.responseId)).toMatchObject({identityMode:'identified',participant:{name:'Invited customer',email:'invited@example.test'}})
  const stored=await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(receipt.responseId).first<{context:string}>()
  expect(JSON.parse(stored!.context).identityMode).toBe('identified')
  await env.DB.prepare("UPDATE responses SET response_context_json=json_set(response_context_json,'$.identityMode','anonymous') WHERE id=?").bind(receipt.responseId).run()
  expect(((await (await f.call(`${f.base}/ledger`)).json()) as Ledger).responses.find(row=>row.id===receipt.responseId)?.identityMode).toBe('identified')
}],
    ["requires identified publication for identity fields and rejects merge tags, invalid values and anonymous click IDs", async()=>{
  const f=await fixture(),settings:FormSettings={...f.settings,hiddenFields:[...f.settings.hiddenFields,{id:'email',name:'email',type:'email',category:'identifying'},{id:'number',name:'order_total',type:'number',category:'plain'},{id:'click',name:'gclid',type:'text',category:'click_id'}]}
  expect((await f.save(settings)).status).toBe(200)
  const refused=await f.publish();expect(refused.status).toBe(400);expect(await refused.text()).toContain('email')
  settings.identityMode='identified';expect((await f.save(settings)).status).toBe(200);expect((await f.publish()).status).toBe(201)
  const identified=await f.submit({email:'jo@example.com',plan:'enterprise',order_total:'12.50'})
  const row=await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(identified.receipt.responseId).first<{context:string}>()
  expect(JSON.parse(row!.context)).toMatchObject({identityMode:'identified',hidden:{email:'jo@example.com',number:12.5}})
  const invalid=await f.submit({email:'*|EMAIL|*',order_total:'NaN',plan:'basic'})
  const bad=await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(invalid.receipt.responseId).first<{context:string}>()
  expect(JSON.parse(bad!.context)).toEqual({hidden:{plan:'basic'},discarded:2,identityMode:'identified'})
  const anonymous={...settings,identityMode:'anonymous' as const,hiddenFields:settings.hiddenFields.filter(field=>field.id!=='email')}
  expect((await f.save(anonymous)).status).toBe(200);expect((await f.publish()).status).toBe(201)
  const click=await f.submit({gclid:'do-not-store',email:'jo@example.com'})
  expect(await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(click.receipt.responseId).first()).toEqual({context:JSON.stringify({hidden:{},discarded:2,identityMode:'anonymous'})})
}],
  ] as const) {
    try { await executeCase() } catch (cause) {
      throw new Error(`Hidden-value admission case "${caseName}" failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    }
  }
}, 60_000)
