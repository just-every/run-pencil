import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { actionsHttp,everyStoredValue } from './actions-fixture'
import { sealValue } from '../../src/core/platform/config/sealing'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
contract('DIST-011','SMS invitations require recorded consent, use sealed owner custody, and signed STOP cancels the reminder while HELP names the business',async()=>{
 await fetch(receiver+'/__control/reset',{method:'POST',body:'{}'})
 const f=await actionsHttp({},'sms-'+crypto.randomUUID().slice(0,8)),token='synthetic-pencil-27',mobile='+15555550101'
 const connection={accountId:'synthetic-pencil-1',authToken:token,fromNumber:'+15555550100',a2pState:'approved',apiOrigin:receiver}
 const accepted=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>}
 await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 expect((await f.call('/api/app/connections/sms',connection,{method:'PUT'})).status).toBe(403)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 const status=await accepted(await f.call('/api/app/connections/sms',connection,{method:'PUT'}));expect(status).toMatchObject({saved:true,a2pState:'approved',fromNumber:connection.fromNumber});expect(JSON.stringify(status)).not.toContain(token)
 // Upgrade fixture: old sealed settings have no workspace binding; their original owner-save audit retains it.
 await env.DB.prepare("UPDATE integration_connections SET sealed=? WHERE kind='sms'").bind(await sealValue(env.SESSION_SECRET,'sms',connection)).run()
 expect((await f.call('/api/app/connections/sms',undefined,{auth:false})).status).toBe(401)
 const contacts='/api/app/distribution/contacts',path=`/api/app/flows/${f.flowId}/distribution`
 expect((await f.call(contacts,{name:'Synthetic invalid',email:'invalid@synthetic.test',mobile:'5555',fields:{}})).status).toBe(400)
 const unconsented=await accepted(await f.call(contacts,{name:'Synthetic unconsented',email:'unconsented@synthetic.test',mobile:'+15555550102',fields:{}}),201)
 expect((await f.call(path,{channel:'sms',contactIds:[unconsented.id],commandKey:'synthetic-pencil-no-consent'})).status).toBe(400)
 const wording='I agree to receive invitations and reminders by SMS. Reply STOP to opt out.'
 const contact=await accepted(await f.call(contacts,{name:'Synthetic SMS recipient',email:'sms@synthetic.test',mobile,smsConsent:{given:true,wording},fields:{}}),201)
 expect(await env.DB.prepare('SELECT mobile,given,wording,actor_operator_id AS actor,actor_kind AS kind,source,created_at AS at FROM sms_consent_events WHERE contact_id=?').bind(contact.id).first()).toMatchObject({mobile,given:1,wording,actor:f.lead.operatorId,kind:'operator',source:'operator-recorded',at:expect.any(String)})
 // A mixed selection is refused atomically, including its otherwise eligible recipient.
 const beforeMixed=await accepted(await f.call(path))
 expect((await f.call(path,{channel:'sms',contactIds:[contact.id,unconsented.id],commandKey:'synthetic-pencil-mixed-consent'})).status).toBe(400)
 expect(await accepted(await f.call(path))).toEqual(beforeMixed)
 expect(((await (await fetch(receiver+'/__control/state')).json()) as {requests:unknown[]}).requests).toHaveLength(0)
 await env.DB.prepare("UPDATE workspaces SET name='Synthetic pencil business',sending_window_start='00:00',sending_window_end='00:00' WHERE id=?").bind(f.workspaceId).run()
 await accepted(await f.call(path,{channel:'sms',contactIds:[contact.id],commandKey:'synthetic-pencil-consented'}),201)
 const state=await (await fetch(receiver+'/__control/state')).json() as {requests:Array<{body:string;authorization:string;idempotencyKey:string}>}
 expect(state.requests).toHaveLength(1)
 const body=new URLSearchParams(state.requests[0].body);expect(body.get('StatusCallback')).toBe('http://localhost/api/public/sms/twilio/status');expect(body.get('To')).toBe(mobile);expect(body.get('Body')).toMatch(/http:\/\/localhost\/i\/[a-f0-9]{64} Reply STOP to opt out\.$/)
 expect(state.requests[0].authorization).toBe('Basic '+btoa(connection.accountId+':'+token));expect(state.requests[0].idempotencyKey).toMatch(/^invitation:/)
 const reminder=await env.DB.prepare("SELECT d.id,d.status FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=? AND d.kind='reminder'").bind(contact.id).first<{id:string;status:string}>();expect(reminder?.status).toBe('pending')
 const inbound='/api/public/sms/twilio',params=new URLSearchParams({From:mobile,To:connection.fromNumber,Body:'STOP'})
 const webhook=async(signature?:string)=>f.app.request('http://localhost'+inbound,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(signature?{'X-Twilio-Signature':signature}:{})},body:params})
 expect((await webhook()).status).toBe(403);expect((await webhook('invalid')).status).toBe(403)
 expect((await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(reminder!.id).first<{status:string}>())?.status).toBe('pending')
 const sign=async()=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('http://localhost'+inbound+[...params.keys()].sort().map(k=>k+params.get(k)).join('')));return btoa(String.fromCharCode(...new Uint8Array(bytes)))}
 expect((await webhook(await sign())).status).toBe(200)
 expect((await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(reminder!.id).first<{status:string}>())?.status).toBe('cancelled')
 expect(await env.DB.prepare("SELECT given,actor_kind AS kind,source,created_at AS at FROM sms_consent_events WHERE contact_id=? AND given=0").bind(contact.id).first()).toMatchObject({given:0,kind:'recipient',source:'recipient',at:expect.any(String)})
 await f.services.distribution.dispatcher.run(new Date(Date.now()+7*86400000).toISOString())
 expect(((await (await fetch(receiver+'/__control/state')).json()) as {requests:unknown[]}).requests).toHaveLength(1)
 params.set('Body','HELP');const help=await webhook(await sign());expect(help.status).toBe(200);expect(await help.text()).toContain('Synthetic pencil business')
 // Unknown-number HELP uses the receiving number's owner, without creating a contact or consent.
 const contactFacts=async()=>({contacts:(await env.DB.prepare('SELECT * FROM distribution_contacts ORDER BY id').all()).results,consents:(await env.DB.prepare('SELECT * FROM sms_consent_events ORDER BY id').all()).results})
 const beforeUnknown=await contactFacts()
 params.set('From','+15555550999');params.set('Body','HELP')
 const unknownHelp=await webhook(await sign());expect(unknownHelp.status).toBe(200);expect(await unknownHelp.text()).toContain('Synthetic pencil business')
 expect(await contactFacts()).toEqual(beforeUnknown)
 params.set('Body','STOP');const unknownStop=await webhook(await sign());expect(unknownStop.status).toBe(200);expect(await unknownStop.text()).not.toContain('Synthetic pencil business')
 expect(await contactFacts()).toEqual(beforeUnknown)
 params.set('From',mobile)
 expect((await f.call(path,{channel:'sms',contactIds:[contact.id],commandKey:'synthetic-pencil-after-stop'})).status).toBe(400)
 // Changing a number cancels frozen deliveries; new consent does not rewrite an old invitation.
 const moved=await accepted(await f.call(contacts,{name:'Synthetic moved mobile',email:'moved@synthetic.test',mobile:'+15555550103',smsConsent:{given:true,wording},fields:{}}),201)
 await accepted(await f.call(path,{channel:'sms',contactIds:[moved.id],commandKey:'synthetic-pencil-before-mobile-change'}),201)
 const frozen=await accepted(await f.call(path)),oldInvitation=frozen.participants.find((p:any)=>p.email==='moved@synthetic.test'&&p.kind==='invitation')
 const oldReminder=frozen.participants.find((p:any)=>p.email==='moved@synthetic.test'&&p.kind==='reminder');expect(oldReminder.status).toBe('pending')
 await accepted(await f.call(contacts+'/'+moved.id,{name:'Synthetic moved mobile',email:'moved@synthetic.test',mobile:'+15555550104',fields:{}},{method:'PUT'}))
 expect((await accepted(await f.call(path))).participants.find((p:any)=>p.deliveryId===oldReminder.deliveryId).status).toBe('cancelled')
 expect((await f.call(path,{channel:'sms',contactIds:[moved.id],commandKey:'synthetic-pencil-new-number-no-consent'})).status).toBe(400)
 await accepted(await f.call(contacts+'/'+moved.id,{name:'Synthetic moved mobile',email:'moved@synthetic.test',mobile:'+15555550104',smsConsent:{given:true,wording},fields:{}},{method:'PUT'}))
 const already=await accepted(await f.call(path,{channel:'sms',contactIds:[moved.id],commandKey:'synthetic-pencil-new-number-old-revision'}),201)
 expect(already.counts.alreadyInvited).toBe(1);expect(already.counts.invited).toBe(0)
 const fresh=await accepted(await f.call('/api/app/flows',{title:'Synthetic new eligible SMS form',slug:'sms-fresh-'+crypto.randomUUID().slice(0,8),template:'feedback'}),201)
 const freshBase='/api/app/flows/'+fresh.id, freshDraft=await accepted(await f.call(freshBase+'/draft'))
 await accepted(await f.call(freshBase+'/publish',{expectedVersion:freshDraft.flow.draftVersion}),201)
 await accepted(await f.call(freshBase+'/distribution',{channel:'sms',contactIds:[moved.id],commandKey:'synthetic-pencil-new-number-fresh-form'}),201)
 const movedRequests=((await (await fetch(receiver+'/__control/state')).json()) as {requests:Array<{body:string}>}).requests
 expect(movedRequests.map(r=>new URLSearchParams(r.body).get('To'))).toEqual([mobile,'+15555550103','+15555550104'])
 expect((await accepted(await f.call(path))).participants.find((p:any)=>p.deliveryId===oldInvitation.deliveryId).status).toBe('sent')
 // Every send supplies the signed status door. The provider SID binds each receipt to its existing attempt.
 const providerState=await (await fetch(receiver+'/__control/state')).json() as {tasks:Record<string,string>;requests:Array<{body:string;idempotencyKey:string}>}
 for(const request of providerState.requests)expect(new URLSearchParams(request.body).get('StatusCallback')).toBe('http://localhost/api/public/sms/twilio/status')
 const sids=providerState.requests.map(request=>providerState.tasks[request.idempotencyKey])
 const statusPath='/api/public/sms/twilio/status',statusUrl='http://localhost'+statusPath
 const statusParams=new URLSearchParams({MessageSid:sids[0],MessageStatus:'queued',From:connection.fromNumber,To:mobile})
 const statusSign=async(url=statusUrl,raw=statusParams)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(url+[...raw.keys()].sort().map(k=>k+raw.get(k)).join('')));return btoa(String.fromCharCode(...new Uint8Array(bytes)))}
 const receipt=(signature?:string,raw=statusParams,url=statusUrl)=>f.app.request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(signature?{'X-Twilio-Signature':signature}:{})},body:raw})
 const deliveryFacts=async()=>({deliveries:(await env.DB.prepare('SELECT * FROM mail_deliveries ORDER BY id').all()).results,attempts:(await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results})
 const beforeUnsigned=await deliveryFacts()
 expect((await receipt()).status).toBe(403)
 expect((await receipt('invalid')).status).toBe(403)
 expect((await receipt(await statusSign('https://localhost'+statusPath))).status).toBe(403)
 const wrongBody=new URLSearchParams(statusParams);wrongBody.set('MessageStatus','delivered')
 expect((await receipt(await statusSign(),wrongBody)).status).toBe(403)
 expect(await deliveryFacts()).toEqual(beforeUnsigned)
 expect((await receipt(await statusSign(),new URLSearchParams({padding:'x'.repeat(8193)}))).status).toBe(413)
 expect(await deliveryFacts()).toEqual(beforeUnsigned)
 const deliveryBySid=(sid:string)=>env.DB.prepare('SELECT id,status,reason FROM mail_deliveries WHERE provider_id=?').bind(sid).first<{id:string;status:string;reason:string|null}>()
 for(const status of ['queued','delivered']){
  statusParams.set('MessageStatus',status)
  expect((await receipt(await statusSign())).status).toBe(204)
  expect(await deliveryBySid(sids[0])).toMatchObject({status:'sent',reason:'Twilio '+status+'.'})
  const once=await deliveryFacts();expect((await receipt(await statusSign())).status).toBe(204);expect(await deliveryFacts()).toEqual(once)
 }
 // The exact public query string also participates in the signature.
 statusParams.set('MessageStatus','sent')
 expect((await receipt(await statusSign(),statusParams,statusUrl+'?receipt=synthetic-pencil-1')).status).toBe(403)
 expect((await receipt(await statusSign(statusUrl+'?receipt=synthetic-pencil-1'),statusParams,statusUrl+'?receipt=synthetic-pencil-1')).status).toBe(204)
 expect(await deliveryBySid(sids[0])).toMatchObject({status:'sent',reason:'Twilio delivered.'})
 expect((await env.DB.prepare("SELECT event FROM mail_delivery_attempts WHERE provider_id=? AND event LIKE 'sms-status:%' ORDER BY event").bind(sids[0]).all()).results).toEqual([{event:'sms-status:delivered'},{event:'sms-status:queued'},{event:'sms-status:sent'}])
 statusParams.set('MessageSid',sids[1]);statusParams.set('MessageStatus','sent')
 expect((await receipt(await statusSign())).status).toBe(204);expect(await deliveryBySid(sids[1])).toMatchObject({status:'sent',reason:'Twilio sent.'})
 for(const [sid,status,code] of [[sids[1],'undelivered','30003'],[sids[2],'failed','30005']]){
  statusParams.set('MessageSid',sid);statusParams.set('MessageStatus',status);statusParams.set('ErrorCode',code)
  expect((await receipt(await statusSign())).status).toBe(204)
  expect(await deliveryBySid(sid)).toMatchObject({status:'failed',reason:'Twilio '+status+' (error '+code+').'})
  expect((await env.DB.prepare('SELECT event,reason FROM mail_delivery_attempts WHERE provider_id=? AND event=?').bind(sid,'sms-status:'+status).first())).toEqual({event:'sms-status:'+status,reason:'Twilio '+status+' (error '+code+').'})
  statusParams.set('MessageStatus','sent');statusParams.delete('ErrorCode')
  expect((await receipt(await statusSign())).status).toBe(204)
  expect(await deliveryBySid(sid)).toMatchObject({status:'failed',reason:'Twilio '+status+' (error '+code+').'})
 }
 const beforeMissing=await deliveryFacts()
 statusParams.set('MessageSid','synthetic-pencil-unknown')
 const unknownReceipt=await receipt(await statusSign());expect(unknownReceipt.status).toBe(404);expect(await unknownReceipt.json()).toEqual({error:'NOT_FOUND',message:'The SMS receipt is unavailable.'})
 statusParams.set('MessageSid','synthetic-pencil-other-unknown')
 const otherUnknown=await receipt(await statusSign());expect(otherUnknown.status).toBe(404);expect(await otherUnknown.json()).toEqual({error:'NOT_FOUND',message:'The SMS receipt is unavailable.'})
 expect(await deliveryFacts()).toEqual(beforeMissing)
 // A provider can store a send and drop its reply: the ambiguous attempt remains unknown across scheduler ticks.
 await accepted(await f.call(contacts+'/'+unconsented.id,{name:'Synthetic unconsented',email:'unconsented@synthetic.test',mobile:'+15555550102',smsConsent:{given:true,wording},fields:{}},{method:'PUT'}))
 await fetch(receiver+'/__control/sms-mode',{method:'POST',body:JSON.stringify({drop:true})})
 await accepted(await f.call(path,{channel:'sms',contactIds:[unconsented.id],commandKey:'synthetic-pencil-ambiguous-send'}),201)
 const uncertain=await env.DB.prepare("SELECT d.id,d.status,d.provider_id AS provider FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id WHERE p.contact_id=? AND d.kind='invitation'").bind(unconsented.id).first<{id:string;status:string;provider:string|null}>()
 expect(uncertain).toMatchObject({status:'unknown',provider:null})
 await f.services.distribution.dispatcher.run(new Date(Date.now()+14*86400000).toISOString())
 expect(((await (await fetch(receiver+'/__control/state')).json()) as {requests:unknown[]}).requests).toHaveLength(4)
 expect(await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(uncertain!.id).first()).toEqual({status:'unknown'})
 expect((await everyStoredValue()).join('\n')).not.toContain(token)
 const backup=await accepted(await f.call('/api/app/backup/export',{}));expect(JSON.stringify(backup)).not.toContain(token)
 const archivedAttempts=backup.payload.tables.find((table:any)=>table.name==='mail_delivery_attempts')
 expect(JSON.stringify(archivedAttempts)).toContain('sms-status:delivered');expect(JSON.stringify(archivedAttempts)).toContain('30003')
 await accepted(await f.call(contacts+'/'+contact.id+'/erase',{confirm:true}))
 expect(await env.DB.prepare('SELECT count(*) AS n FROM sms_consent_events WHERE contact_id=?').bind(contact.id).first()).toEqual({n:0})
 expect((await everyStoredValue()).join('\n')).not.toContain(mobile)
 const erasedReceipt=await env.DB.prepare("SELECT reason,provider_id AS provider FROM mail_delivery_attempts WHERE event='sms-status:delivered'").first()
 expect(erasedReceipt).toEqual({reason:null,provider:null})
})
