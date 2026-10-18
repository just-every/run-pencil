import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import { completionFixture } from '../fixtures/completion-redirects'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import type { PublicFlow } from '../../src/core/app/api'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
async function fixture() {
  const http=await googleHttp(),slug=`consultation-${crypto.randomUUID()}`
  const call=async<T,>(path:string,data?:unknown,method?:string):Promise<T>=>{
    const response=await http.call(path,data,method?{method}:{})
    expect(response.status,await response.clone().text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  return {...await completionFixture(call,slug),http,slug}
}
contract('LOGIC-005','chooses screen or approved redirect from accepted answer, hidden, calculation and score conditions; replay and copies preserve revision custody',async()=>{
  const f=await fixture(), mappings=[{name:'team',operand:f.size.id},{name:'campaign',operand:'hidden:plan'},{name:'quote',operand:'variable:total'}]
  await f.call(`${f.base}/draft`,{expectedVersion:(await f.read()).flow.draftVersion,stepId:f.redirect.id,prompt:f.redirect.prompt,required:false,questionSettings:{redirect:{url:'https://sales.example.test/book?fixed=consultation',parameters:mappings}}},'PUT')
  await f.call(`${f.base}/publish`,{expectedVersion:(await f.read()).flow.draftVersion})
  let original:{input:unknown;receipt:unknown}|undefined
  for(const [size,plan,ready,score,shouldRedirect] of [[60,'enterprise',true,5,true],[40,'enterprise',true,5,false],[60,'basic',true,5,false],[60,'enterprise',false,5,false],[60,'enterprise',true,1,false]] as const) {
    const session=await f.http.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'desktop',source:'direct'},{auth:false}).then(response=>response.json()) as {sessionId:string;sessionToken:string;revisionId:string}
    const input={...session,idempotencyKey:crypto.randomUUID(),hidden:{plan,secret:'never-forward'},loadTime:await issueLoadTime(env.SESSION_SECRET,session.revisionId,Date.now()-5000),answers:[{stepId:f.score.id,value:score},{stepId:f.size.id,value:size},{stepId:f.ready.id,value:ready}]}
    const response=await f.http.call(`/api/public/flows/${f.slug}/responses`,input,{auth:false})
    expect(response.status,await response.clone().text()).toBe(201)
    const receipt=await response.json() as {completionStepId:string;redirectUrl:string|null;responseId:string}
    expect(receipt.completionStepId).toBe(shouldRedirect?f.redirect.id:f.ordinary.id)
    expect(receipt.redirectUrl).toBe(shouldRedirect?'https://sales.example.test/book?fixed=consultation&team=60&campaign=enterprise&quote=120':null)
    if(shouldRedirect)original={input,receipt}
  }
  const excludedSession=await f.http.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'desktop',source:'direct'},{auth:false}).then(response=>response.json()) as {sessionId:string;sessionToken:string;revisionId:string}
  const excludedInput={...excludedSession,idempotencyKey:crypto.randomUUID(),honeypot:'https://spam.example.test',hidden:{plan:'enterprise'},loadTime:await issueLoadTime(env.SESSION_SECRET,excludedSession.revisionId,Date.now()-5000),answers:[{stepId:f.score.id,value:5},{stepId:f.size.id,value:60},{stepId:f.ready.id,value:true}]}
  for(let retry=0;retry<2;retry++) {
    const excluded=await f.http.call(`/api/public/flows/${f.slug}/responses`,excludedInput,{auth:false})
    expect(excluded.status).toBe(201)
    expect(await excluded.json()).toMatchObject({disposition:'quarantined',completionStepId:f.redirect.id,redirectUrl:null,idempotent:retry>0})
  }
  // Changing approvals on the new draft cannot reinterpret the admitted revision.
  await f.call(`${f.base}/draft/settings`,{expectedVersion:(await f.read()).flow.draftVersion,settings:{...f.settings,redirectOrigins:[]}},'PUT')
  const retry=await f.http.call(`/api/public/flows/${f.slug}/responses`,{...original!.input as object,hidden:{plan:'changed'},answers:[]},{auth:false})
  expect(await retry.json()).toMatchObject({...original!.receipt as object,idempotent:true})
  await f.call(`${f.base}/draft/settings`,{expectedVersion:(await f.read()).flow.draftVersion,settings:f.settings},'PUT')
  const copied=await f.call<{id:string}>(`${f.base}/duplicate`,{title:'Copied consultation',slug:`copy-${crypto.randomUUID()}`})
  const draft=await f.call<import('../../src/core/app/api').BuilderDraft>(`/api/app/flows/${copied.id}/draft`)
  const copyMappings=(draft.steps.find(step=>step.kind==='completion'&&step.questionSettings?.redirect)?.questionSettings?.redirect as {parameters:Array<{operand:string}>}).parameters
  expect(copyMappings.every(item=>draft.steps.some(step=>step.id===item.operand)||draft.formSettings?.hiddenFields.some(field=>`hidden:${field.id}`===item.operand)||draft.formSettings?.calculations?.some(value=>`variable:${value.id}`===item.operand))).toBe(true)
  await f.call(`/api/app/flows/${copied.id}/publish`,{expectedVersion:draft.flow.draftVersion})
  expect((await f.http.call(`${f.base}/ledger`).then(response=>response.json()) as {total:number}).total).toBe(5)
},60_000)
contract('LOGIC-005','refuses unapproved, insecure, credential-bearing and invalid operand redirects at publish without changing the live revision',async()=>{
  const f=await fixture()
  for(const [url,parameters] of [
    ['https://unapproved.example.test/book',[]],['http://sales.example.test/book',[]],['https://user:password@sales.example.test/book',[]],['https://sales.example.test/{{hidden:plan}}',[]],['https://sales.example.test/book',[{name:'value',operand:'deleted-question'}]],['https://sales.example.test/book',[{name:'x',operand:f.size.id},{name:'x',operand:f.score.id}]],
  ] as const) {
    await f.call(`${f.base}/draft`,{expectedVersion:(await f.read()).flow.draftVersion,stepId:f.redirect.id,prompt:f.redirect.prompt,required:false,questionSettings:{redirect:{url,parameters}}},'PUT')
    const publish=await f.http.call(`${f.base}/publish`,{expectedVersion:(await f.read()).flow.draftVersion})
    expect(publish.status).toBe(400);expect(await publish.text()).toContain(f.redirect.id)
    expect((await f.http.call(`/api/public/flows/${f.slug}`,undefined,{auth:false})).status).toBe(404)
  }
  expect((await f.http.call(`${f.base}/draft/settings`,{expectedVersion:(await f.read()).flow.draftVersion,settings:{...f.settings,redirectOrigins:['https://sales.example.test/path']}},{method:'PUT'})).status).toBe(400)
})
