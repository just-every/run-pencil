import './access.css'
import { useEffect, useState, type FormEvent } from 'react'
import type { PublicFlow } from '../../app/api'
import type { PublicSeedConfig } from '../../shared/config'
import { BrandIdentity, brandStyle } from '../brand'
import { useRespondentFocus } from '../../shared/ui/useRespondentFocus'
import { RespondentFlowPage } from '../responses/ui'
import { KioskFlow } from '../responses/ui'
import type { AccessRequirement } from './service'

export function AccessGate({config,restriction,collectorKey,embedded,invitationToken,kioskIdleSeconds}:{config:PublicSeedConfig;restriction:AccessRequirement;collectorKey?:string;embedded?:boolean;invitationToken?:string;kioskIdleSeconds?:number}){
  const [password,setPassword]=useState(''),[email,setEmail]=useState(''),[code,setCode]=useState(''),[signedLink,setSignedLink]=useState('')
  const [challenge,setChallenge]=useState<string>(),[error,setError]=useState<string>(),[busy,setBusy]=useState(false)
  const [ready,setReady]=useState<{flow:PublicFlow;accessToken:string;identity?:string}>()
  useRespondentFocus(ready?'open':'access',true,'access-title')
  const base=`/api/public/flows/${encodeURIComponent(restriction.slug)}`
  useEffect(()=>{
    if(restriction.mode!=='signed')return
    const token=new URLSearchParams(location.hash.slice(1)).get('access')
    if(token){setSignedLink(token);history.replaceState(null,'',location.pathname+location.search)}
  },[restriction.mode])
  const call=async<T,>(path:string,input:unknown):Promise<T>=>{
    const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},credentials:'omit',body:JSON.stringify(input)})
    const value=await response.json() as T & {message?:string};if(!response.ok)throw new Error(value.message??'Access could not be verified.');return value
  }
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError(undefined)
    try{
      if(restriction.mode==='email'&&!challenge){const value=await call<{challengeId:string}>(base+'/access/code',{revisionId:restriction.revisionId,email});setChallenge(value.challengeId);return}
      const verified=await call<{accessToken:string;verifiedEmail?:string;verifiedSubject?:string}>(base+'/access',{revisionId:restriction.revisionId,...(restriction.mode==='password'?{password}:restriction.mode==='signed'?{signedLink}:{challengeId:challenge,code})})
      const query=new URLSearchParams({source:embedded?'embed':'direct',...(collectorKey?{collector:collectorKey}:{})})
      const url=invitationToken?`/api/public/invitations/${encodeURIComponent(invitationToken)}`:`${base}?${query}`
      const response=await fetch(url,{credentials:'omit',headers:{'x-pencil-access':verified.accessToken}}),flow=await response.json() as PublicFlow & {message?:string}
      if(!response.ok)throw new Error(flow.message??'The form could not open. Try again.')
      setPassword('');setCode('');setSignedLink('');setReady({flow,accessToken:verified.accessToken,identity:verified.verifiedEmail??verified.verifiedSubject})
    }catch(reason){setError((reason as Error).message)}finally{setBusy(false)}
  }
  const reset=()=>{setReady(undefined);setChallenge(undefined);setEmail('');setPassword('');setCode('');setSignedLink('');setError(undefined)}
  if(ready){
    if(kioskIdleSeconds)return <KioskFlow config={config} data={{flow:ready.flow,collectorKey}} slug={restriction.slug} idleSeconds={kioskIdleSeconds} accessToken={ready.accessToken} verifiedIdentity={ready.identity} onResetAccess={reset}/>
    return <RespondentFlowPage config={config} initialFlow={ready.flow} slug={restriction.slug} collectorKey={collectorKey} embedded={embedded} invitationToken={invitationToken} accessToken={ready.accessToken} verifiedIdentity={ready.identity}/>
  }
  return <main className="pencil-canvas respondent-shell brand-surface" style={brandStyle(config)}><article className="respondent-card respondent-note-sheet"><BrandIdentity config={config}/><h1 id="access-title" tabIndex={-1} className="display">Access to {restriction.title}</h1>
    <p>{restriction.mode==='password'?'Enter the password provided by the business.':restriction.mode==='email'?'Verify an allowed email address before seeing the form. Your response will be identified by that verified email; only one response is allowed per email.':'This form requires a signed link from the business’s app. Your response will be identified by the account named in that link.'}</p>
    <form className="restricted-access-form" onSubmit={event=>void submit(event)}>
      {restriction.mode==='password'?<label className="inspector-field">Form password<input className="text-input" type="password" autoComplete="off" required maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/></label>:restriction.mode==='signed'?<p role="status">{signedLink?'Your app link is ready to verify.':'Open the access link supplied by the business app.'}</p>:<><label className="inspector-field">Your email<input className="text-input" type="email" required maxLength={320} disabled={!!challenge} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)}/></label>{challenge?<><p role="status">A code was sent to your email. It expires in 10 minutes.</p><label className="inspector-field">Verification code<input className="text-input" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={event=>setCode(event.target.value)}/></label><button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>{setChallenge(undefined);setCode('');setError(undefined)}}>Use another email or request a new code</button></>:null}</>}
      {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}
      <button className="primary-button focus-ring" disabled={busy||(restriction.mode==='signed'&&!signedLink)} type="submit">{busy?'Verifying…':restriction.mode==='email'&&!challenge?'Send verification code':'Open form'}</button>
    </form>
  </article></main>
}
