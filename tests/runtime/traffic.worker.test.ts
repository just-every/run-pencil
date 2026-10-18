import { issueLoadTime } from '../../src/core/features/traffic'
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
contract('RSLT-013','anonymous view and durable start buckets report native conversion cohorts without retaining visitor metadata',async()=>{
  const {id}=await call<{id:string}>('/api/app/flows',{title:'Workshop feedback',slug:'traffic-form',template:'feedback'})
  const root=`/api/app/flows/${id}`
  let draft=await call<BuilderDraft>(root+'/draft')
  await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  draft=await call<BuilderDraft>(root+'/draft')
  const revision=await call<{revision:{id:string}}>('/api/public/flows/traffic-form')
  const revisionId=revision.revision.id,view='/api/public/flows/traffic-form/views'
  expect((await call<{totals:{views:number;starts:number;submissions:number}}>(root+'/traffic?revisionId='+revisionId)).totals).toEqual({views:0,starts:0,submissions:0})
  const input={revisionId,source:'direct'}
  await Promise.all([call(view,input),call(view,input),call(view,input),call(view,{...input,source:'embed'})])
  const prefetched=await SELF.fetch('http://localhost'+view,{method:'POST',headers:{'content-type':'application/json','Sec-Purpose':'prefetch'},body:JSON.stringify(input)})
  expect(prefetched.status).toBe(204)
  expect((await request(view,{...input,visitorId:'forbidden'})).status).toBe(400)
  expect((await request(view,{...input,revisionId:'not-a-published-revision'})).status).toBe(400)
  expect((await request(root+'/traffic?revisionId='+revisionId,undefined,'GET',false)).status).toBe(401)
  const start=()=>call<{sessionId:string;sessionToken:string;revisionId:string;loadTime:string}>('/api/public/flows/traffic-form/sessions',{source:'direct',deviceClass:'desktop'})
  const first=await start(),second=await start()
  await matureLoad(first)
  const submit=(session:Awaited<ReturnType<typeof start>>)=>call<{responseId:string;disposition:string}>('/api/public/flows/traffic-form/responses',{...session,idempotencyKey:'traffic-'+session.sessionId,answers:[{stepId:draft.steps[0].id,value:draft.choices[0].id}]})
  const completed=await submit(first)
  expect(completed.disposition).toBe('released')
  type Report={totals:{views:number;starts:number;submissions:number};rows:Array<{source:string;day:string;views:number;starts:number;submissions:number}>}
  const report=()=>call<Report>(root+'/traffic?revisionId='+revisionId)
  expect((await report()).totals).toEqual({views:4,starts:2,submissions:1})
  const native=(await report()).rows.find(row=>row.source==='direct')!
  expect(native).toMatchObject({views:3,starts:2,submissions:1})
  expect((await report()).rows.find(row=>row.source==='embed')).toMatchObject({views:1,starts:0,submissions:0})
  const countBefore=await env.DB.prepare('SELECT * FROM revision_view_counters WHERE revision_id=?').bind(revisionId).all()
  for(const row of countBefore.results)expect(Object.keys(row).sort()).toEqual(['count','day','revision_id','source'])
  expect(JSON.stringify(countBefore)).not.toContain(first.sessionId)
  expect(JSON.stringify(countBefore)).not.toContain(completed.responseId)
  // Expiry removes private session state without losing the source/day start.
  const {createPencilPlatform}=await import('../../src/core/platform/runtime')
  const {initializePencil}=await import('../../src/core/app/worker')
  const services=await initializePencil(createPencilPlatform('http://localhost',env))
  await env.DB.prepare('UPDATE respondent_sessions SET expires_at=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),second.sessionId).run()
  await services.responses.expireSessions(new Date().toISOString(),100)
  expect(await env.DB.prepare('SELECT session_id FROM session_traffic WHERE session_id=?').bind(second.sessionId).first()).toBeNull()
  expect((await report()).totals).toEqual({views:4,starts:2,submissions:1})
  const quarantined=await submit(await start())
  expect(quarantined.disposition).toBe('quarantined')
  expect((await report()).totals.submissions).toBe(1)
  await call(`/api/app/responses/${quarantined.responseId}/release`,{})
  expect((await report()).totals.submissions).toBe(2)
  await call(`/api/app/responses/${completed.responseId}`,undefined,'DELETE')
  expect((await report()).totals.submissions).toBe(1)
  // Preview is isolated, and later workspace-zone changes cannot move a bucket.
  await call(root+'/draft/preview',{answers:{}})
  await env.DB.prepare("UPDATE workspaces SET time_zone='Pacific/Honolulu' WHERE id=(SELECT workspace_id FROM flows WHERE id=?)").bind(id).run()
  expect((await report()).rows.find(row=>row.source==='direct')?.day).toBe(native.day)
  expect((await call<Report>(root+'/traffic?revisionId='+revisionId+'&from=2000-01-01&to=2000-01-02')).totals).toEqual({views:0,starts:0,submissions:0})
  const collector=await call<{id:string;publicKey:string}>(root+'/collectors',{name:'Workshop poster',channel:'qr'})
  await call(view,{...input,collectorKey:collector.publicKey})
  const named=await call<Awaited<ReturnType<typeof start>>>('/api/public/flows/traffic-form/sessions',{source:'direct',deviceClass:'mobile',collectorKey:collector.publicKey})
  await matureLoad(named)
  await submit(named)
  expect((await report()).rows.find(row=>row.source==='collector:'+collector.id)).toMatchObject({views:1,starts:1,submissions:1})
  const contact=await call<{id:string}>('/api/app/distribution/contacts',{name:'Invited workshop attendee',email:'attendee@example.test'})
  const launch=await call<{id:string}>(root+'/distribution',{contactIds:[contact.id],commandKey:'traffic-invitation-launch'})
  const participant=await env.DB.prepare('SELECT token FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{token:string}>()
  expect(participant).not.toBeNull()
  await call(view,{...input,invitationToken:participant!.token})
  const invited=await call<Awaited<ReturnType<typeof start>>>('/api/public/flows/traffic-form/sessions',{source:'direct',deviceClass:'desktop',invitationToken:participant!.token})
  await matureLoad(invited)
  await call('/api/public/flows/traffic-form/responses',{...invited,invitationToken:participant!.token,idempotencyKey:'traffic-invited-response',answers:[{stepId:draft.steps[0].id,value:draft.choices[0].id}]})
  expect((await report()).rows.find(row=>row.source==='invitation')).toMatchObject({views:1,starts:1,submissions:1})
  expect((await request(view,{...input,invitationToken:participant!.token})).status).toBe(400)
  const privateViews=await env.DB.prepare('SELECT * FROM revision_view_counters WHERE revision_id=?').bind(revisionId).all()
  expect(JSON.stringify(privateViews)).not.toContain(participant!.token)
  expect(JSON.stringify(privateViews)).not.toContain('attendee@example.test')
  await call(root+'/close',{})
  expect((await request(view,input)).status).toBe(409)
  expect((await report()).totals.views).toBe(6)
})

contract('RSLT-013','signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review',async()=>{
  const {id}=await call<{id:string}>('/api/app/flows',{title:'Training evaluation',slug:'traffic-load-time',template:'feedback'})
  const root=`/api/app/flows/${id}`
  const draft=await call<BuilderDraft>(root+'/draft')
  await call(root+'/publish',{expectedVersion:draft.flow.draftVersion})
  const revision=await call<{revision:{id:string}}>('/api/public/flows/traffic-load-time')
  const revisionId=revision.revision.id,view='/api/public/flows/traffic-load-time/views'
  const load=()=>call<{loadTime:string}>(view,{revisionId,source:'direct'})
  const start=()=>call<{sessionId:string;sessionToken:string;revisionId:string;loadTime:string}>('/api/public/flows/traffic-load-time/sessions',{source:'direct',deviceClass:'desktop'})
  const submit=(session:Awaited<ReturnType<typeof start>>,loadTime:string,honeypot='')=>request('/api/public/flows/traffic-load-time/responses',{
    ...session,loadTime,honeypot,idempotencyKey:'time-'+session.sessionId,answers:[{stepId:draft.steps[0].id,value:draft.choices[0].id}],
  })
  const firstLoad=await load()
  await new Promise(resolve=>setTimeout(resolve,3200))
  // A fresh session is accepted because the signed *document* load is mature.
  const human=await start()
  const tampered=firstLoad.loadTime.slice(0,-1)+(firstLoad.loadTime.endsWith('0')?'1':'0')
  expect((await submit(human,tampered)).status).toBe(400)
  expect((await submit(human,'')).status).toBe(400)
  for(const [revision,at] of [[revisionId,Date.now()-31*86400000],[revisionId,Date.now()+86400000],['another-revision',Date.now()]] as const) {
    expect((await submit(human,await issueLoadTime(env.SESSION_SECRET,revision,at))).status).toBe(400)
  }
  const accepted=await submit(human,firstLoad.loadTime)
  expect(accepted.status).toBe(201)
  const humanReceipt=await accepted.json<{responseId:string;disposition:string}>()
  expect(humanReceipt.disposition).toBe('released')
  const early=await start()
  await matureLoad(early)
  const newLoad=await load()
  // An old session cannot bypass the new, signed load-time minimum.
  const earlyReply=await submit(early,newLoad.loadTime)
  const earlyReceipt=await earlyReply.json<{responseId:string;disposition:string}>()
  expect(earlyReceipt.disposition).toBe('quarantined')
  const bot=await start(), botLoad=await load()
  const botReply=await submit(bot,botLoad.loadTime,'automated website')
  const botReceipt=await botReply.json<{responseId:string;disposition:string}>()
  expect(botReceipt.disposition).toBe('quarantined')
  const held=await call<Array<{id:string;quarantineReason:string;answers:unknown[]}>>(`/api/app/revisions/${revisionId}/quarantine`)
  expect(held.map(row=>row.quarantineReason).sort()).toEqual(['honeypot','minimum-fill-time'])
  expect(held.every(row=>row.answers.length===1)).toBe(true)
  expect((await env.DB.prepare('SELECT id FROM response_outbox WHERE response_id IN (?,?)').bind(earlyReceipt.responseId,botReceipt.responseId).all()).results).toEqual([])
  const report=()=>call<{totals:{views:number;starts:number;submissions:number}}>(root+'/traffic?revisionId='+revisionId)
  expect((await report()).totals).toEqual({views:3,starts:3,submissions:1})
  const counters=async()=>{
    const result=await env.DB.batch(['revision_view_counters','revision_start_counters'].map(table=>env.DB.prepare(`SELECT * FROM ${table} WHERE revision_id=? ORDER BY source,day`).bind(revisionId)))
    return result.map(item=>item.results)
  }
  const before=await counters()
  await call(`/api/app/responses/${earlyReceipt.responseId}/release`,{})
  await call(`/api/app/responses/${botReceipt.responseId}/release`,{})
  expect(await counters()).toEqual(before)
  expect((await report()).totals).toEqual({views:3,starts:3,submissions:3})
  const retried=await submit(bot,botLoad.loadTime,'automated website')
  expect(await retried.json()).toMatchObject({responseId:botReceipt.responseId,idempotent:true,disposition:'released'})
  expect((await call<{total:number}>(root+'/ledger')).total).toBe(3)
  const privateRows=JSON.stringify(await env.DB.prepare('SELECT * FROM revision_view_counters WHERE revision_id=?').bind(revisionId).all())
  for(const privateValue of [human.sessionId,early.sessionId,bot.sessionToken,humanReceipt.responseId,firstLoad.loadTime])expect(privateRows).not.toContain(privateValue)
})
