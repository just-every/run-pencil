import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie='',serial=0
const request=(path:string,data?:unknown,method=data===undefined?'GET':'POST',extra:Record<string,string>={})=>SELF.fetch('http://localhost'+path,{method,headers:{Host:'localhost',Origin:'http://localhost',cookie,'content-type':'application/json','CF-Connecting-IP':`198.18.209.${++serial%250}`,...extra},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'manual'})
async function call<T=any>(path:string,data?:unknown,method?:string,extra?:Record<string,string>):Promise<T>{const r=await request(path,data,method,extra);expect(r.ok,r.ok?path:await r.clone().text()).toBe(true);return r.status===204?undefined as T:r.json<T>()}
beforeAll(async()=>{
  await applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__);await call('/health')
  const owner=await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{email:string}>()
  await call('/auth/magic-link',{email:owner!.email});const inbox=await developmentInbox(path=>SELF.fetch('http://localhost'+path,{headers:{Host:'localhost',...devKeyHeaders}}),owner!.email)
  const login=await request('/auth/confirm',{token:inbox.messages[0].magicLinkToken});cookie=login.headers.get('set-cookie')!.split(';')[0]
})
contract('DIST-019','restricted collection gates graph and session doors, verifies identity, serializes email uniqueness and binds app signatures to their revision',async()=>{
  const slug='aurora-private',flow=await call('/api/app/flows',{title:'Aurora team survey',slug}),root=`/api/app/flows/${flow.id}`,pub=`/api/public/flows/${slug}`
  let draft=await call(root+'/draft')
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'question',questionType:'short_text',required:true,prompt:'Private team planning question'}})
  draft=await call(root+'/draft');const stepId=draft.steps[0].id
  await call(root+'/draft/steps',{expectedVersion:draft.flow.draftVersion,step:{kind:'completion',questionType:null,prompt:'Thanks for your team feedback.'}})
  const setAccess=async(rule:unknown)=>{draft=await call(root+'/draft');await call(root+'/access',{expectedVersion:draft.flow.draftVersion,rule},'PUT');draft=await call(root+'/draft');await call(root+'/publish',{expectedVersion:draft.flow.draftVersion});return (await call(root+'/draft')).revision.id}
  await setAccess({mode:'password',password:'Aurora-team-access-2026'})
  const preflight=await request(pub,undefined,'OPTIONS',{Origin:'null','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-pencil-access'})
  expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-pencil-access')
  const denied=await request(pub);expect(denied.status).toBe(403);const descriptor=await denied.json<any>();expect(descriptor.restriction.mode).toBe('password');expect(JSON.stringify(descriptor)).not.toContain('Private team planning question');expect(JSON.stringify(descriptor)).not.toContain('verifier')
  const revisionId=descriptor.restriction.revisionId
  expect((await request(pub+'/sessions',{source:'direct',deviceClass:'desktop'})).status).toBe(400)
  expect((await request(pub+'/access',{revisionId,password:'incorrect'})).status).toBe(400)
  const passwordGrant=await call(pub+'/access',{revisionId,password:'Aurora-team-access-2026'})
  const opened=await call(pub,undefined,undefined,{'x-pencil-access':passwordGrant.accessToken});expect(opened.steps[0].prompt).toBe('Private team planning question')
  const session=await call(pub+'/sessions',{source:'direct',deviceClass:'desktop',accessToken:passwordGrant.accessToken});expect(session.revisionId).toBe(revisionId)
  // Password access does not turn anonymous collection into identified feedback.
  await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now()-6000).toISOString(),session.sessionId).run()
  const {matureLoad}=await import('./load-time-fixture');await matureLoad(session)
  const receipt=await call(pub+'/responses',{...session,idempotencyKey:'private-password-submit',answers:[{stepId,value:'Keep the morning workshop.'}]})
  expect(receipt.disposition).toBe('released')
  expect(JSON.parse((await env.DB.prepare('SELECT response_context_json AS context FROM responses WHERE id=?').bind(receipt.responseId).first<any>()).context).identityMode).toBe('anonymous')

  await setAccess({mode:'email',domains:['aurora.example'],emails:['guest@example.com']})
  const gate=await (await request(pub)).json<any>(),emailRevision=gate.restriction.revisionId
  expect((await request(pub+'/sessions',{source:'direct',deviceClass:'desktop',accessToken:passwordGrant.accessToken})).status).toBe(400)
  expect((await request(pub+'/access/code',{revisionId:emailRevision,email:'outsider@example.net'})).status).toBe(400)
  const challenge=await call(pub+'/access/code',{revisionId:emailRevision,email:'Jo@Aurora.Example'})
  const mails=await SELF.fetch('http://localhost/__test/mail',{headers:{Host:'localhost',...devKeyHeaders}}).then(r=>r.json<any>())
  const message=mails.messages.find((m:any)=>m.deliveryId===`access:${challenge.challengeId}`)
  expect(message).toBeTruthy();const code=/verification code is (\d{6})/.exec(message.text)![1]
  expect((await request(pub+'/access',{revisionId:emailRevision,challengeId:challenge.challengeId,code:code==='000000'?'111111':'000000'})).status).toBe(400)
  const grant=await call(pub+'/access',{revisionId:emailRevision,challengeId:challenge.challengeId,code});expect(grant.verifiedEmail).toBe('jo@aurora.example')
  expect((await request(pub+'/access',{revisionId:emailRevision,challengeId:challenge.challengeId,code})).status).toBe(400)
  const exhausted=await call(pub+'/access/code',{revisionId:emailRevision,email:'guest@example.com'})
  const captured=await SELF.fetch('http://localhost/__test/mail',{headers:{Host:'localhost',...devKeyHeaders}}).then(r=>r.json<any>())
  const guestCode=/verification code is (\d{6})/.exec(captured.messages.find((m:any)=>m.deliveryId===`access:${exhausted.challengeId}`).text)![1]
  for(let attempt=0;attempt<5;attempt++)expect((await request(pub+'/access',{revisionId:emailRevision,challengeId:exhausted.challengeId,code:guestCode==='000000'?'111111':'000000'})).status).toBe(400)
  expect((await request(pub+'/access',{revisionId:emailRevision,challengeId:exhausted.challengeId,code:guestCode})).status).toBe(400)
  const expired=await call(pub+'/access/code',{revisionId:emailRevision,email:'guest@example.com'})
  await env.DB.prepare('UPDATE access_challenges SET expires_at=? WHERE id=?').bind(new Date(Date.now()-1).toISOString(),expired.challengeId).run()
  expect((await request(pub+'/access',{revisionId:emailRevision,challengeId:expired.challengeId,code:'000000'})).status).toBe(400)
  const sessions=await Promise.all([0,1].map(()=>call(pub+'/sessions',{deviceClass:'desktop',source:'direct',accessToken:grant.accessToken})))
  await Promise.all(sessions.map(s=>matureLoad(s)))
  const bodies=sessions.map((s,i)=>({...s,idempotencyKey:'private-verified-submit-'+i,answers:[{stepId,value:'Offer a later session.'}]}))
  const submissions=await Promise.all(bodies.map(body=>request(pub+'/responses',body)))
  expect(submissions.map(r=>r.status).sort()).toEqual([201,400])
  const winner=submissions.findIndex(r=>r.status===201),saved=await submissions[winner].json<any>()
  const repeat=await call(pub+'/responses',bodies[winner]);expect(repeat.responseId).toBe(saved.responseId)
  expect((await request(pub+'/access/code',{revisionId:emailRevision,email:'JO@AURORA.EXAMPLE'})).status).toBe(400)
  const ledger=await call(root+'/ledger');expect(ledger.responses.find((r:any)=>r.id===saved.responseId)).toMatchObject({identityMode:'identified',verifiedEmail:'jo@aurora.example'})

  const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']) as CryptoKeyPair
  const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  const publicKey=b64(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)))
  await setAccess({mode:'signed',publicKey})
  const signedGate=await (await request(pub)).json<any>(),signedRevision=signedGate.restriction.revisionId
  const signed=async(revisionId:string,expiresAt=Date.now()+600000)=>{const payload=b64(new TextEncoder().encode(JSON.stringify({revisionId,expiresAt,subject:'account:aurora-team'})));return payload+'.'+b64(new Uint8Array(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(payload))))}
  const link=await signed(signedRevision)
  expect((await request(pub+'/access',{revisionId:signedRevision,signedLink:await signed(emailRevision)})).status).toBe(400)
  expect((await request(pub+'/access',{revisionId:signedRevision,signedLink:await signed(signedRevision,Date.now()-1)})).status).toBe(400)
  expect((await request(pub+'/access',{revisionId:signedRevision,signedLink:link.slice(0,-1)+(link.endsWith('A')?'B':'A')})).status).toBe(400)
  const appGrant=await call(pub+'/access',{revisionId:signedRevision,signedLink:link});expect(appGrant.verifiedSubject).toBe('account:aurora-team')
  const appSession=await call(pub+'/sessions',{source:'direct',deviceClass:'desktop',accessToken:appGrant.accessToken});await matureLoad(appSession)
  const appResponse=await call(pub+'/responses',{...appSession,idempotencyKey:'signed-app-submit-key',answers:[{stepId,value:'Keep the planning group small.'}]})
  expect((await call(root+'/ledger')).responses.find((r:any)=>r.id===appResponse.responseId)).toMatchObject({identityMode:'identified',verifiedSubject:'account:aurora-team'})
  for(const format of ['csv','json']){
    let {token}=await call(root+`/responses/export/start?format=${format}`),output=''
    while(token){const part=await request(root+'/responses/export',{token});expect(part.status).toBe(200);output+=await part.text();token=part.headers.get('x-export-next')??''}
    expect(output).toContain('jo@aurora.example');expect(output).toContain('account:aurora-team')
    if(format==='json')expect(JSON.parse(output).responses.find((r:any)=>r.id===saved.responseId)).toMatchObject({verifiedEmail:'jo@aurora.example',identityMode:'identified'})
  }
  await call(`/api/app/responses/${saved.responseId}`,undefined,'DELETE')
  expect(await env.DB.prepare('SELECT 1 FROM response_access WHERE response_id=?').bind(saved.responseId).first()).toBeNull()
  expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({results:[]})
},60000)
