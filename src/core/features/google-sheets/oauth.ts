import { sealValue,unsealValue } from '../../platform/config/sealing'
import type { IntegrationConnections,GoogleConnection } from '../../platform/config/connections'
import { ForbiddenError,ValidationError } from '../../shared/errors'
const encoder=new TextEncoder()
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const hash=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')
export async function providerJson(response:Response){
 if(!response.ok)throw new ValidationError(`Google answered HTTP ${response.status}. Repair the connection and replay the delivery.`)
 const reader=response.body?.getReader();if(!reader)throw new ValidationError('Google returned no data.')
 let size=0,text='';const decoder=new TextDecoder()
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024){await reader.cancel();throw new ValidationError('Google data exceeds the bounded sheet limit.')}text+=decoder.decode(value,{stream:true})}
 try{return JSON.parse(text+decoder.decode()) as Record<string,any>}catch{throw new ValidationError('Google returned invalid JSON.')}
}
export class GoogleOAuth {
 constructor(private readonly db:D1Database,private readonly connections:IntegrationConnections,private readonly secret:string,private readonly origin:string){}
 async start(config:GoogleConnection,operatorId:string,workspaceId:string){
  this.connections.validateGoogle(config)
  const state=random(),verifier=random(),challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  await this.db.prepare('DELETE FROM google_oauth_states WHERE expires_at<=?').bind(new Date().toISOString()).run()
  await this.db.prepare('INSERT INTO google_oauth_states(hash,operator_id,workspace_id,sealed,expires_at) VALUES(?,?,?,?,?)').bind(await hash(state),operatorId,workspaceId,await sealValue(this.secret,'google-oauth',{verifier,config}),new Date(Date.now()+600000).toISOString()).run()
  const url=new URL('/o/oauth2/v2/auth',config.authOrigin)
  url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:this.origin+'/api/app/connections/google/callback',response_type:'code',scope:'https://www.googleapis.com/auth/spreadsheets',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}).toString()
  return {authorizationUrl:url.href}
 }
 async callback(state:string,code:string,operatorId:string,workspaceId:string){
  const row=await this.db.prepare('DELETE FROM google_oauth_states WHERE hash=? AND operator_id=? AND workspace_id=? AND expires_at>? RETURNING sealed').bind(await hash(state),operatorId,workspaceId,new Date().toISOString()).first<{sealed:string}>()
  if(!row)throw new ForbiddenError('The Google sign-in state is invalid, expired or already used.')
  const {verifier,config}=await unsealValue<{verifier:string;config:GoogleConnection}>(this.secret,'google-oauth',row.sealed)
  const result=await providerJson(await fetch(config.tokenOrigin+'/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:verifier,redirect_uri:this.origin+'/api/app/connections/google/callback'})}))
  if(typeof result.access_token!=='string'||typeof result.refresh_token!=='string'||!Number.isFinite(result.expires_in)||result.expires_in<60||result.expires_in>86400)throw new ValidationError('Google did not grant durable access. Reconnect and grant offline access.')
  await this.connections.saveGoogle({...config,accessToken:result.access_token,refreshToken:result.refresh_token,expiresAt:Date.now()+result.expires_in*1000})
 }
 async request(path:string,method='GET',body?:unknown){
  let saved=await this.connections.google();if(!saved?.accessToken)throw new ValidationError('Connect Google in Settings first.')
  if(!saved.expiresAt||saved.expiresAt<Date.now()+60000){
   if(!saved.refreshToken)throw new ValidationError('Reconnect Google to renew access.')
   const token=await providerJson(await fetch(saved.tokenOrigin+'/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refreshToken,client_id:saved.clientId,client_secret:saved.clientSecret})}))
   if(typeof token.access_token!=='string'||!Number.isFinite(token.expires_in)||token.expires_in<60||token.expires_in>86400)throw new ValidationError('Google did not renew access. Reconnect in Settings.')
   saved={...saved,accessToken:token.access_token,expiresAt:Date.now()+token.expires_in*1000};await this.connections.saveGoogle(saved)
  }
  return providerJson(await fetch(saved.apiOrigin+path,{method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+saved.accessToken,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}))
 }
}
