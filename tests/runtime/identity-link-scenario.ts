import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import type { BuilderDraft, FlowStep, PublicFlow } from '../../src/core/app/api'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { googleHttp } from './google-import-http'

type Fixture = {base:string;slug:string;id:string;workspace:string;question:FlowStep;read:()=>Promise<BuilderDraft>;publish:()=>Promise<Response>;call:Awaited<ReturnType<typeof googleHttp>>['call']}
export async function proveRevisionIdentityLinks(f:Fixture) {
  const email=['synthetic-pencil-1','example.test'].join(String.fromCharCode(64))
  const replacementEmail=['synthetic-pencil-2','example.test'].join(String.fromCharCode(64))
  const original=await (await f.call(`/api/public/flows/${f.slug}`)).json() as PublicFlow
  const issue=async(values:Record<string,unknown>={email})=>{
    const response=await f.call(`${f.base}/identity-links`,{revisionId:original.revision.id,values})
    expect(response.status,await response.clone().text()).toBe(201)
    const {path}=await response.json() as {path:string}
    return new URL(path,'http://localhost').searchParams.get('identity')!
  }
  const link=await issue(),replacement=await issue({email:replacementEmail})
  expect((await f.call(`${f.base}/identity-links`,{revisionId:original.revision.id,values:{email}},{auth:false})).status).toBe(401)
  const foreign=await googleHttp()
  expect((await foreign.call(`${f.base}/identity-links`,{revisionId:original.revision.id,values:{email}})).status).toBe(404)
  const fixed=await f.call(`/api/public/flows/${f.slug}?identity=${encodeURIComponent(link)}`)
  expect(await fixed.json()).toMatchObject({revision:{id:original.revision.id},hiddenContext:{hidden:{email}},identityLink:link})
  const start=async(identityLink=link)=>{
    const response=await f.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'desktop',source:'direct',identityLink})
    expect(response.status,await response.clone().text()).toBe(201)
    return await response.json() as {sessionId:string;sessionToken:string;revisionId:string}
  }
  const count=async()=>(await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE flow_id=?').bind(f.id).first<{n:number}>())!.n
  const command=async()=>({...await start(),identityLink:link,loadTime:await issueLoadTime(env.SESSION_SECRET,original.revision.id,Date.now()-5000),idempotencyKey:crypto.randomUUID(),answers:[{stepId:f.question.id,value:35}],hidden:{email,plan:'enterprise'}})
  const input=await command(),before=await count()
  for(const altered of [{...input,hidden:{...input.hidden,email:replacementEmail}},{...input,identityLink:replacement},{...input,identityLink:undefined},{...input,identityLink:link.slice(0,-3)+'abc'},{...input,removeIdentity:true}]) {
    const response=await f.call(`/api/public/flows/${f.slug}/responses`,altered)
    expect(response.status,await response.clone().text()).toBe(400)
    expect(await response.text()).toMatch(/identifying/i)
    expect(await count()).toBe(before)
  }
  const accepted=await f.call(`/api/public/flows/${f.slug}/responses`,input)
  expect(accepted.status,await accepted.clone().text()).toBe(201)
  const receipt=await accepted.json() as {responseId:string}
  expect(await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(receipt.responseId).first()).toMatchObject({context:expect.stringContaining(email)})
  expect(await (await f.call(`/api/public/flows/${f.slug}/responses`,input)).json()).toMatchObject({...receipt,idempotent:true})
  expect(await count()).toBe(before+1)
  const removal=await command()
  const removed=await f.call(`/api/public/flows/${f.slug}/responses`,{...removal,hidden:{plan:'enterprise'},removeIdentity:true})
  expect(removed.status,await removed.clone().text()).toBe(201)
  const removedReceipt=await removed.json() as {responseId:string}
  const removedContext=await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(removedReceipt.responseId).first<{context:string}>()
  expect(JSON.parse(removedContext!.context)).toMatchObject({hidden:{plan:'enterprise'},identityMode:'identified'})
  expect(removedContext!.context).not.toContain(email)
  const saved=await command(),commandKey=crypto.randomUUID()
  const saveInput={...saved,commandKey,email,currentStepId:f.question.id,answers:[]}
  const badSave=await f.call(`/api/public/flows/${f.slug}/sessions/save`,{...saveInput,hidden:{email:replacementEmail}})
  expect(badSave.status).toBe(400)
  expect(await env.DB.prepare('SELECT session_id FROM respondent_saves WHERE session_id=?').bind(saved.sessionId).first()).toBeNull()
  const save=await f.call(`/api/public/flows/${f.slug}/sessions/save`,saveInput)
  expect(save.status,await save.clone().text()).toBe(200)
  const resumed=await f.call(`/api/public/flows/${f.slug}/resume`,{token:await resumeBearer(env.SESSION_SECRET,saved.sessionId,commandKey)})
  const resumedState=await resumed.json() as {sessionId:string;sessionToken:string;flow:PublicFlow}
  expect(resumedState.flow).toMatchObject({identityLink:link,hiddenContext:{hidden:{email}}})
  expect((await f.call(`/api/public/flows/${f.slug}/responses`,{...saved,...resumedState,identityLink:replacement})).status).toBe(400)
  expect((await f.call(`/api/public/flows/${f.slug}/responses`,{...saved,sessionId:resumedState.sessionId,sessionToken:resumedState.sessionToken})).status).toBe(201)
  const metrics=await env.DB.prepare('SELECT * FROM respondent_sessions WHERE id=?').bind(input.sessionId).first()
  expect(JSON.stringify(metrics)).not.toContain(email)
  expect(JSON.stringify(metrics)).not.toContain(link)
  // Erasing the completed capture revokes its receipt; replay cannot restore the identity or response.
  expect((await f.call(`/api/app/responses/${receipt.responseId}`,undefined,{method:'DELETE'})).status).toBe(204)
  const afterErase=await count()
  expect((await f.call(`/api/public/flows/${f.slug}/responses`,input)).status).toBe(400)
  expect(await count()).toBe(afterErase)
  const alienSlug=`identity-isolation-${crypto.randomUUID()}`
  const alien=await (await foreign.call('/api/app/flows',{title:'Isolated form',slug:alienSlug})).json() as {id:string}
  const alienBase=`/api/app/flows/${alien.id}`
  const alienRead=async()=>await (await foreign.call(`${alienBase}/draft`)).json() as BuilderDraft
  for(const step of [{kind:'question',questionType:'number',prompt:'A number',required:true},{kind:'completion',questionType:null,prompt:'Complete'}]) {
    expect((await foreign.call(`${alienBase}/draft/steps`,{expectedVersion:(await alienRead()).flow.draftVersion,step})).status).toBe(201)
  }
  expect((await foreign.call(`${alienBase}/draft/settings`,{expectedVersion:(await alienRead()).flow.draftVersion,settings:original.formSettings},{method:'PUT'})).status).toBe(200)
  expect((await foreign.call(`${alienBase}/publish`,{expectedVersion:(await alienRead()).flow.draftVersion})).status).toBe(201)
  expect((await foreign.call(`/api/public/flows/${alienSlug}?identity=${encodeURIComponent(link)}`)).status).toBe(400)
  const alienSessions=await env.DB.prepare('SELECT COUNT(*) AS n FROM respondent_sessions WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id=?)').bind(alien.id).first()
  expect((await foreign.call(`/api/public/flows/${alienSlug}/sessions`,{deviceClass:'desktop',source:'direct',identityLink:link})).status).toBe(400)
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM respondent_sessions WHERE revision_id IN (SELECT id FROM flow_revisions WHERE flow_id=?)').bind(alien.id).first()).toEqual(alienSessions)
  // A pending A capture must not become a B response, even when A was admitted before B existed.
  const pending=await command(),beforeB=await count()
  expect((await f.publish()).status).toBe(201)
  const current=await (await f.call(`/api/public/flows/${f.slug}`)).json() as PublicFlow
  expect(current.revision.id).not.toBe(original.revision.id)
  for (const response of [
    await f.call(`/api/public/flows/${f.slug}?identity=${encodeURIComponent(link)}`),
    await f.call(`/api/public/flows/${f.slug}/sessions`,{deviceClass:'mobile',source:'direct',identityLink:link}),
    await f.call(`/api/public/flows/${f.slug}/responses`,pending),
  ]) {expect(response.status).toBe(400);expect(await response.text()).toContain('earlier published revision');expect(await count()).toBe(beforeB)}
}
