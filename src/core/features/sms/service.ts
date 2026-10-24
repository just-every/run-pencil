import { ulid } from 'ulid'
import type { IntegrationConnections } from '../../platform/config/connections'
import { ForbiddenError, ValidationError } from '../../shared/errors'
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
      const response=await fetch(`${saved.apiOrigin}/2010-04-01/Accounts/${encodeURIComponent(saved.accountId)}/Messages.json`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10_000),headers:{Authorization:`Basic ${btoa(`${saved.accountId}:${saved.authToken}`)}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key},body:new URLSearchParams({To:to,From:saved.fromNumber,Body:text})})
      if(response.status===429)return {kind:'transient',reason:'Twilio rate limited the message.'}
      if(!response.ok)return {kind:response.status>=500?'unknown':'permanent',reason:`Twilio answered ${response.status}. Reconcile uncertain delivery before retrying.`}
      const receipt=await response.json() as {sid?:unknown}
      if(typeof receipt.sid!=='string'||receipt.sid.length>200)return {kind:'unknown',reason:'Twilio returned no usable delivery receipt. Reconcile before retrying.'}
      return {kind:'sent',providerId:receipt.sid}
    } catch{return {kind:'unknown',reason:'Twilio delivery was not confirmed. Reconcile before retrying.'}}
  }
  async inbound(request:Request) {
    const saved=await this.connections.sms();if(!saved)throw new ForbiddenError('The SMS connection is unavailable.')
    const text=await request.text();if(text.length>8192)throw new ValidationError('The SMS callback is too large.')
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
    const mobile=params.get('From')??'',to=params.get('To')??'',command=(params.get('Body')??'').trim().toUpperCase()
    if(!e164.test(mobile)||to!==saved.fromNumber)throw new ValidationError('The SMS callback addresses are invalid.')
    if(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT'].includes(command)){
      const contacts=await this.db.prepare('SELECT id FROM distribution_contacts WHERE mobile=?').bind(mobile).all<{id:string}>()
      for(const contact of contacts.results)await this.consent(contact.id,mobile,false,'Recipient replied STOP.','recipient')
      return '<Response><Message>You are unsubscribed. No more invitations or reminders will be sent.</Message></Response>'
    }
    if(['HELP','INFO'].includes(command)){
      const business=await this.db.prepare('SELECT w.name FROM workspaces w JOIN distribution_contacts c ON c.workspace_id=w.id WHERE c.mobile=? ORDER BY c.created_at,c.id LIMIT 1').bind(mobile).first<{name:string}>()
      if(!business)throw new ValidationError('No inviting business is associated with this number.')
      const name=business.name.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!))
      return `<Response><Message>${name}: contact the business for help. Reply STOP to opt out.</Message></Response>`
    }
    return '<Response></Response>'
  }
}
