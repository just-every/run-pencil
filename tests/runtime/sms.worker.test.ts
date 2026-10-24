import { applyD1Migrations,env,type D1Migration } from 'cloudflare:test'
import { beforeAll,expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { actionsHttp,everyStoredValue } from './actions-fixture'
declare const __PENCIL_CORE_MIGRATIONS__:D1Migration[]
beforeAll(()=>applyD1Migrations(env.DB,__PENCIL_CORE_MIGRATIONS__))
const receiver=(env as unknown as {TASK_RECEIVER_ORIGIN:string}).TASK_RECEIVER_ORIGIN
contract('DIST-011','SMS invitations require recorded consent, use sealed owner custody, and signed STOP cancels the reminder while HELP names the business',async()=>{
 await fetch(receiver+'/__control/reset',{method:'POST',body:'{}'})
 const f=await actionsHttp({},'sms-'+crypto.randomUUID().slice(0,8)),token='synthetic-pencil-sms-secret',mobile='+15555550101'
 const connection={accountId:'synthetic-pencil-1',authToken:token,fromNumber:'+15555550100',a2pState:'approved',apiOrigin:receiver}
 const accepted=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>}
 await env.DB.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 expect((await f.call('/api/app/connections/sms',connection,{method:'PUT'})).status).toBe(403)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(f.lead.operatorId).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(f.lead.operatorId).run()
 const status=await accepted(await f.call('/api/app/connections/sms',connection,{method:'PUT'}));expect(status).toMatchObject({saved:true,a2pState:'approved',fromNumber:connection.fromNumber});expect(JSON.stringify(status)).not.toContain(token)
 expect((await f.call('/api/app/connections/sms',undefined,{auth:false})).status).toBe(401)
 const contacts='/api/app/distribution/contacts',path=`/api/app/flows/${f.flowId}/distribution`
 expect((await f.call(contacts,{name:'Synthetic invalid',email:'invalid@synthetic.test',mobile:'5555',fields:{}})).status).toBe(400)
 const unconsented=await accepted(await f.call(contacts,{name:'Synthetic unconsented',email:'unconsented@synthetic.test',mobile:'+15555550102',fields:{}}),201)
 expect((await f.call(path,{channel:'sms',contactIds:[unconsented.id],commandKey:'synthetic-pencil-no-consent'})).status).toBe(400)
 const wording='I agree to receive invitations and reminders by SMS. Reply STOP to opt out.'
 const contact=await accepted(await f.call(contacts,{name:'Synthetic SMS recipient',email:'sms@synthetic.test',mobile,smsConsent:{given:true,wording},fields:{}}),201)
 expect(await env.DB.prepare('SELECT mobile,given,wording,actor_operator_id AS actor,actor_kind AS kind,source,created_at AS at FROM sms_consent_events WHERE contact_id=?').bind(contact.id).first()).toMatchObject({mobile,given:1,wording,actor:f.lead.operatorId,kind:'operator',source:'operator-recorded',at:expect.any(String)})
 await env.DB.prepare("UPDATE workspaces SET name='Synthetic pencil business',sending_window_start='00:00',sending_window_end='00:00' WHERE id=?").bind(f.workspaceId).run()
 await accepted(await f.call(path,{channel:'sms',contactIds:[contact.id],commandKey:'synthetic-pencil-consented'}),201)
 const state=await (await fetch(receiver+'/__control/state')).json() as {requests:Array<{body:string;authorization:string;idempotencyKey:string}>}
 expect(state.requests).toHaveLength(1)
 const body=new URLSearchParams(state.requests[0].body);expect(body.get('To')).toBe(mobile);expect(body.get('Body')).toMatch(/http:\/\/localhost\/i\/[a-f0-9]{64} Reply STOP to opt out\.$/)
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
 expect((await f.call(path,{channel:'sms',contactIds:[contact.id],commandKey:'synthetic-pencil-after-stop'})).status).toBe(400)
 expect((await everyStoredValue()).join('\n')).not.toContain(token)
 const backup=await accepted(await f.call('/api/app/backup/export',{}));expect(JSON.stringify(backup)).not.toContain(token)
 await accepted(await f.call(contacts+'/'+contact.id+'/erase',{confirm:true}))
 expect(await env.DB.prepare('SELECT count(*) AS n FROM sms_consent_events WHERE contact_id=?').bind(contact.id).first()).toEqual({n:0})
 expect((await everyStoredValue()).join('\n')).not.toContain(mobile)
})
