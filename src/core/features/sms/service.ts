import { ulid } from 'ulid'
import type { IntegrationConnections } from '../../platform/config/connections'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors'
import type { MailDeliveries } from '../distribution'

const encoder=new TextEncoder()
export const e164=/^\+[1-9][0-9]{7,14}$/
export class SmsService {
  constructor(private readonly db:D1Database,private readonly connections:IntegrationConnections,private readonly origin:string) {}
  async consent(contactId:string,mobile:string,given:boolean,wording:string,source:string,actor?:string) {
    if(!e164.test(mobile)||!wording.trim()||wording.length>500)throw new ValidationError('SMS consent needs an E.164 number and the exact wording, up to 500 characters.')
    const now=new Date().toISOString()
    await this.db.batch([
      this.db.prepare('INSERT INTO sms_consent_events(id,contact_id,mobile,given,wording,source,created_at,actor_operator_id,actor_kind) SELECT ?,id,?,?,?,?,?,(SELECT id FROM operators WHERE id=? AND workspace_id=distribution_contacts.workspace_id),? FROM distribution_contacts WHERE id=? AND mobile=?').bind(ulid(),mobile,given?1:0,wording,source,now,actor??null,source==='recipient'?'recipient':'operator',contactId,mobile),
      this.db.prepare('UPDATE distribution_contacts SET sms_consent_at=?,sms_consent_mobile=?,sms_stopped_at=?,updated_at=? WHERE id=? AND mobile=?').bind(given?now:null,mobile,given?null:now,now,contactId,mobile),
    ])
  }
  async send(to:string,text:string,key:string):Promise<Parameters<MailDeliveries['record']>[2]> {
    let saved:Awaited<ReturnType<IntegrationConnections['sms']>>
    try{saved=await this.connections.sms()}catch{return {kind:'permanent',reason:'The SMS connection cannot be unlocked. Reconnect in Settings.'}}
    if(!saved)return {kind:'permanent',reason:'Connect Twilio in Settings before sending SMS.'}
    if(saved.a2pState!=='approved')return {kind:'permanent',reason:'The owner must complete A2P registration before sending SMS.'}
    try {
      const response=await fetch(`${saved.apiOrigin}/2010-04-01/Accounts/${encodeURIComponent(saved.accountId)}/Messages.json`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10_000),headers:{Authorization:`Basic ${btoa(`${saved.accountId}:${saved.authToken}`)}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key},body:new URLSearchParams({To:to,From:saved.fromNumber,Body:text,StatusCallback:new URL('/api/public/sms/twilio/status',this.origin).href})})
      if(response.status===429)return {kind:'transient',reason:'Twilio rate limited the message.'}
      // A 4xx carrying a Twilio error code is a definite refusal: Twilio created no message (DIST-008 keeps the provider reason).
      const refusal=response.status>=400&&response.status<500?await response.json().then(body=>(body as {code?:unknown})?.code,()=>null):null
      if(typeof refusal==='number'&&Number.isInteger(refusal)&&refusal>0&&refusal<1_000_000)return {kind:'permanent',reason:`Twilio refused the message (error ${refusal}).`}
      if(!response.ok)return {kind:response.status>=500?'unknown':'permanent',reason:`Twilio answered ${response.status}. Reconcile uncertain delivery before retrying.`}
      const receipt=await response.json() as {sid?:unknown}
      if(typeof receipt.sid!=='string'||receipt.sid.length>200)return {kind:'unknown',reason:'Twilio returned no usable delivery receipt. Reconcile before retrying.'}
      return {kind:'sent',providerId:receipt.sid}
    } catch{return {kind:'unknown',reason:'Twilio delivery was not confirmed. Reconcile before retrying.'}}
  }
  private async callback(request:Request) {
    const saved=await this.connections.sms();if(!saved)throw new ForbiddenError('The SMS connection is unavailable.')
    if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new ValidationError('Twilio callbacks require a signed form body.')
    const reader=request.body?.getReader();if(!reader)throw new ValidationError('A signed Twilio callback is required.')
    let bytes=0,text='';const decoder=new TextDecoder()
    while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192){await reader.cancel();throw new ValidationError('The SMS callback is too large.')}text+=decoder.decode(part.value,{stream:true})}
    text+=decoder.decode()
    const params=new URLSearchParams(text),signature=request.headers.get('X-Twilio-Signature')??''
    const url=new URL(request.url),signedUrl=new URL(url.pathname+url.search,this.origin).href
    let verified=false
    try {
      const key=await crypto.subtle.importKey('raw',encoder.encode(saved.authToken),{name:'HMAC',hash:'SHA-1'},false,['verify'])
      const data=signedUrl+[...params.keys()].sort().map(name=>name+params.get(name)).join('')
      if(new Set(params.keys()).size!==[...params.keys()].length)throw new Error('Repeated callback fields')
      verified=await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),encoder.encode(data))
    }catch{verified=false}
    if(!verified)throw new ForbiddenError('The Twilio signature is invalid.')
    return {saved,params}
  }
  /** Provider receipts share the existing append-only invitation attempts and erasure/archive policy. */
  async status(request:Request){
    const {saved,params}=await this.callback(request)
    const sid=params.get('MessageSid')??'',status=params.get('MessageStatus')??'',error=params.get('ErrorCode')??''
    if(!sid||sid.length>200||!['queued','sent','delivered','undelivered','failed'].includes(status)||error&&!/^\d{1,10}$/.test(error))throw new ValidationError('The SMS status receipt is invalid.')
    const delivery=await this.db.prepare(`SELECT d.id,d.participant_id AS participantId,d.kind,d.attempts FROM mail_deliveries d JOIN invitation_participants p ON p.id=d.participant_id JOIN invitation_launches l ON l.id=p.launch_id
      WHERE d.provider_id=? AND p.workspace_id=? AND json_extract(l.policy_json,'$.channel')='sms'`).bind(sid,saved.workspaceId??null).first<{id:string;participantId:string;kind:string;attempts:number}>()
    if(!delivery)throw new NotFoundError('The SMS receipt is unavailable.')
    const hash=await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify([sid,status])))
    const id='sms-status:'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join(''),event='sms-status:'+status,now=new Date().toISOString()
    const failure=['undelivered','failed'].includes(status),terminal=status==='delivered'||failure
    const reason='Twilio '+status+(error?' (error '+error+')':'')+'.'
    // Once a terminal receipt exists, late queued/sent receipts are history only. Delivery confirmation wins over late failures.
    const mayAdvance=`NOT EXISTS(SELECT 1 FROM mail_delivery_attempts WHERE delivery_id=mail_deliveries.id AND event='sms-status:delivered')
      AND (? OR NOT EXISTS(SELECT 1 FROM mail_delivery_attempts WHERE delivery_id=mail_deliveries.id AND event IN('sms-status:failed','sms-status:undelivered')))`
    await this.db.batch([
      this.db.prepare(`UPDATE mail_deliveries SET status=?,reason=?,updated_at=? WHERE id=? AND provider_id=? AND status<>'cancelled'
        AND NOT EXISTS(SELECT 1 FROM mail_delivery_attempts WHERE id=?) AND ${mayAdvance}`).bind(failure?'failed':'sent',reason,now,delivery.id,sid,id,status==='delivered'?1:0),
      this.db.prepare(`UPDATE invitation_participants SET delivery_status=(SELECT status FROM mail_deliveries WHERE id=?) WHERE id=? AND ?='invitation'
        AND EXISTS(SELECT 1 FROM mail_deliveries WHERE id=? AND status IN('sent','failed')) AND NOT EXISTS(SELECT 1 FROM mail_delivery_attempts WHERE id=?)`).bind(delivery.id,delivery.participantId,delivery.kind,delivery.id,id),
      this.db.prepare(`UPDATE mail_deliveries SET status='cancelled',reason='The SMS invitation failed; its reminder is cancelled.',updated_at=? WHERE participant_id=? AND kind='reminder' AND status='pending'
        AND ? AND ?='invitation' AND EXISTS(SELECT 1 FROM mail_deliveries WHERE id=? AND status='failed') AND NOT EXISTS(SELECT 1 FROM mail_delivery_attempts WHERE id=?)`).bind(now,delivery.participantId,terminal&&failure?1:0,delivery.kind,delivery.id,id),
      this.db.prepare(`INSERT OR IGNORE INTO mail_delivery_attempts(id,delivery_id,ordinal,event,reason,provider_id,created_at)
        SELECT ?,id,attempts,?,?,?,? FROM mail_deliveries WHERE id=? AND provider_id=?`).bind(id,event,reason,sid,now,delivery.id,sid),
    ])
  }
  async inbound(request:Request) {
    const {saved,params}=await this.callback(request)
    const mobile=params.get('From')??'',to=params.get('To')??'',command=(params.get('Body')??'').trim().toUpperCase()
    if(!e164.test(mobile)||to!==saved.fromNumber)throw new ValidationError('The SMS callback addresses are invalid.')
    if(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(command)){
      const contacts=await this.db.prepare('SELECT id FROM distribution_contacts WHERE mobile=? AND workspace_id=?').bind(mobile,saved.workspaceId??null).all<{id:string}>()
      for(const contact of contacts.results)await this.consent(contact.id,mobile,false,'Recipient replied STOP.','recipient')
      return '<Response><Message>You are unsubscribed. No more invitations or reminders will be sent.</Message></Response>'
    }
    if(['HELP','INFO'].includes(command)){
      const business=await this.db.prepare('SELECT name FROM workspaces WHERE id=?').bind(saved.workspaceId??null).first<{name:string}>()
      if(!business)throw new ValidationError('Reconnect the receiving SMS number to its business in Settings.')
      const name=business.name.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!))
      return `<Response><Message>${name}: contact the business for help. Reply STOP to opt out.</Message></Response>`
    }
    return '<Response></Response>'
  }
}
