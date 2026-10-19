import { matureLoad } from './load-time-fixture'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import type { BuilderDraft } from '../../src/core/app/api'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = '', serial = 0
const request = (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', signedIn = true) => SELF.fetch('http://localhost' + path, {
  method, headers: { Host: 'localhost', Origin: 'http://localhost', cookie: signedIn ? cookie : '', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.209.${++serial % 250}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
})
async function call<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await request(path, body, method)
  expect(response.ok, response.ok ? path : `${path}: ${await response.clone().text()}`).toBe(true)
  return response.status === 204 ? undefined as T : response.json<T>()
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await call('/health')
  const owner = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{ email: string }>()
  expect(owner).not.toBeNull()
  await call('/auth/magic-link', { email: owner!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})
contract('TMPL-002','workspace templates preserve branching and settings without copying private source history',async()=>{
  const flow=await call<{id:string}>('/api/app/flows',{title:'Client intake',slug:'team-source',template:'feedback'})
  const root=`/api/app/flows/${flow.id}`
  let draft=await call<BuilderDraft>(root+'/draft')
  const [question,followup,end]=draft.steps
  await call(root+'/draft',{stepId:question.id,prompt:'How was your visit?',required:true,expectedVersion:draft.flow.draftVersion,
    rules:[{sourceStepId:question.id,predicateKind:'equals',expectedValue:draft.choices[0].id,destinationStepId:end.id,position:0}]},'PUT')
  draft=await call<BuilderDraft>(root+'/draft')
  await call(root+'/draft',{stepId:followup.id,prompt:followup.prompt,required:false,expectedVersion:draft.flow.draftVersion,questionSettings:{minLength:3,maxLength:100,validationMessage:'Please give a little more detail.'}},'PUT')
  draft=await call<BuilderDraft>(root+'/draft')
  const deadlineAt=new Date(Date.now()+86_400_000).toISOString(),targetCompletedResponses=25
  await call(root+'/publish',{expectedVersion:draft.flow.draftVersion,deadlineAt,targetCompletedResponses})
  const session=await call<{sessionId:string;sessionToken:string;loadTime:string;revisionId:string}>('/api/public/flows/team-source/sessions',{source:'direct',deviceClass:'desktop'})
  await matureLoad(session)
  await call('/api/public/flows/team-source/responses',{...session,idempotencyKey:'source-response',answers:[{stepId:question.id,value:draft.choices[0].id}]})
  draft=await call<BuilderDraft>(root+'/draft')
  const published=await call<{id:string}>(root+'/templates',{name:'Published intake',source:'published',expectedVersion:draft.flow.draftVersion})
  await call(root+'/draft',{stepId:question.id,prompt:'Updated intake question',required:true,expectedVersion:draft.flow.draftVersion},'PUT')
  draft=await call<BuilderDraft>(root+'/draft')
  const template=await call<{id:string}>(root+'/templates',{name:'Team intake',source:'draft',expectedVersion:draft.flow.draftVersion})
  expect((await request(root+'/templates',{name:'Stale',source:'draft',expectedVersion:0})).status).toBe(400)
  expect((await request('/api/app/templates',undefined,'GET',false)).status).toBe(401)
  const list=await call<Array<{id:string;createdBy:string}>>('/api/app/templates')
  expect(list.map(t=>t.id)).toContain(template.id);expect(list.find(t=>t.id===template.id)?.createdBy).toBeTruthy()
  const copy=await call<{id:string}>(`/api/app/templates/${template.id}/flows`,{title:'New client intake',slug:'team-copy'})
  const copied=await call<BuilderDraft>(`/api/app/flows/${copy.id}/draft`)
  expect(copied.steps.map(s=>s.prompt)).toEqual(draft.steps.map(s=>s.prompt))
  expect(copied.steps.map(s=>s.questionSettings)).toEqual(draft.steps.map(s=>s.questionSettings))
  expect(copied.steps.every(s=>!draft.steps.some(old=>old.id===s.id))).toBe(true)
  expect(copied.choices.every(c=>!draft.choices.some(old=>old.id===c.id))).toBe(true)
  expect(copied.branchRules[0]).toMatchObject({sourceStepId:copied.steps[0].id,expectedValue:copied.choices[0].id,destinationStepId:copied.steps[2].id})
  await call(`/api/app/flows/${copy.id}/publish`,{expectedVersion:copied.flow.draftVersion})
  const preview=await call<{screens:Array<{stepId:string}>;complete:boolean}>(`/api/app/flows/${copy.id}/draft/preview`,{answers:{[copied.steps[0].id]:copied.choices[0].id}})
  expect(preview.complete).toBe(true)
  expect(preview.screens.map(s=>s.stepId)).toEqual([copied.steps[0].id,copied.steps[2].id])
  const publishedContent=await env.DB.prepare('SELECT structure_json FROM team_templates WHERE id=?').bind(published.id).first<{structure_json:string}>()
  expect(publishedContent).not.toBeNull()
  const savedContent=JSON.parse(publishedContent!.structure_json)
  expect(savedContent).not.toHaveProperty('revision')
  for(const field of ['deadlineAt','deadlineTimeZone','targetCompletedResponses'])expect(publishedContent!.structure_json).not.toContain(field)
  expect(publishedContent!.structure_json).not.toContain(deadlineAt)
  const publicCopy=await call<{id:string}>(`/api/app/templates/${published.id}/flows`,{title:'Published copy',slug:'published-copy'})
  const publishedCopy=await call<BuilderDraft>(`/api/app/flows/${publicCopy.id}/draft`)
  expect(publishedCopy.steps[0].prompt).toBe('How was your visit?')
  expect(publishedCopy.revision).toMatchObject({deadlineAt:null,targetCompletedResponses:null})
  for(const table of ['responses','analysis_runs'])expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE flow_id=?`).bind(copy.id).first()).toEqual({n:0})
  const content=await env.DB.prepare('SELECT structure_json FROM team_templates WHERE id=?').bind(template.id).first<{structure_json:string}>()
  for(const forbidden of [flow.id,draft.revision.id,'operator.example','credentials','externalId'])expect(content!.structure_json).not.toContain(forbidden)
  const now=new Date().toISOString(),foreign=crypto.randomUUID()
  await env.DB.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES (?,'Other workspace','UTC','09:00','17:00',?,?)").bind(foreign,now,now).run()
  await env.DB.prepare('INSERT INTO team_templates(id,workspace_id,name,structure_json,created_at) VALUES (?,?,?,?,?)').bind('foreign-template',foreign,'Foreign','{}',now).run()
  expect((await request('/api/app/templates/foreign-template/flows',{title:'No',slug:'no'})).status).toBe(404)
  expect((await request('/api/app/templates/foreign-template',undefined,'DELETE')).status).toBe(404)
  expect((await call<Array<{id:string}>>('/api/app/templates')).some(t=>t.id==='foreign-template')).toBe(false)
  await call(`/api/app/templates/${template.id}`,undefined,'DELETE')
  expect((await request(`/api/app/templates/${template.id}/flows`,{title:'Retired',slug:'retired'})).status).toBe(404)
  expect((await call<Array<{id:string}>>('/api/app/templates')).some(t=>t.id===template.id)).toBe(false)
  expect((await call<BuilderDraft>(`/api/app/flows/${copy.id}/draft`)).steps).toHaveLength(3)
})
