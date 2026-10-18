import { useEffect, useState, type FormEvent } from 'react'
import type { BuilderDraft } from '../../app/api'

export function AccessSettings({draft,disabled,onSaved}:{draft:BuilderDraft;disabled:boolean;onSaved:()=>Promise<void>}){
  const [mode,setMode]=useState('open'),[password,setPassword]=useState(''),[domains,setDomains]=useState(''),[emails,setEmails]=useState(''),[publicKey,setPublicKey]=useState('')
  const [error,setError]=useState<string>(),[notice,setNotice]=useState<string>(),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false)
  const path=`/api/app/flows/${encodeURIComponent(draft.flow.id)}/access`
  useEffect(()=>{let active=true;void fetch(path).then(async response=>{const value=await response.json() as {mode:string;domains?:string[];emails?:string[];publicKey?:string;message?:string};if(!response.ok)throw new Error(value.message);if(active){setMode(value.mode);setDomains((value.domains??[]).join('\n'));setEmails((value.emails??[]).join('\n'));setPublicKey(value.publicKey??'');setLoaded(true)}}).catch(reason=>{if(active)setError(reason.message)});return()=>{active=false}},[path])
  const lines=(value:string)=>value.split(/[\n,]/).map(item=>item.trim()).filter(Boolean)
  const save=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError(undefined);setNotice(undefined)
    try{
      const rule=mode==='open'?{mode}:mode==='password'?{mode,password}:mode==='email'?{mode,domains:lines(domains),emails:lines(emails)}:{mode,publicKey:publicKey.trim()}
      const response=await fetch(path,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:draft.flow.draftVersion,rule})}),value=await response.json() as {kind?:string;message?:string}
      if(!response.ok||value.kind==='conflict')throw new Error(value.message??'Another operator saved first. Reload before changing access.')
      setPassword('');await onSaved();setNotice('Access saved to the draft. Publish to apply it to new respondents.')
    }catch(reason){setError((reason as Error).message)}finally{setBusy(false)}
  }
  return <details className="quiet-panel" style={{minWidth:0}}><summary className="focus-ring">Form access</summary><form onSubmit={event=>void save(event)}><fieldset style={{border:0,padding:0,minWidth:0}} disabled={disabled||busy||!loaded}><legend>Who can respond</legend>
    <label className="inspector-field">Access requirement<select className="text-input" value={mode} onChange={event=>setMode(event.target.value)}><option value="open">Anyone with the link</option><option value="password">Password</option><option value="email">Verified email</option><option value="signed">Signed link from your app</option></select></label>
    {mode==='password'?<label className="inspector-field">New form password<input className="text-input" type="password" autoComplete="new-password" required maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/><span className="muted">The saved password is never shown. Enter a replacement when saving.</span></label>:mode==='email'?<><label className="inspector-field">Allowed email domains<textarea className="text-area" rows={3} value={domains} onChange={event=>setDomains(event.target.value)} placeholder="example.com"/></label><label className="inspector-field">Allowed email addresses<textarea className="text-area" rows={3} value={emails} onChange={event=>setEmails(event.target.value)} placeholder="person@example.com"/></label><p>One domain or address per line. Development email is suppressed; verification requires a working production sender. Respondents verify by email code and may complete once per email across this form’s revisions. Their verified email is retained with the response.</p></>:mode==='signed'?<><label className="inspector-field">App signing public key<input className="text-input" required maxLength={43} value={publicKey} onChange={event=>setPublicKey(event.target.value)}/></label><p>Use a raw Ed25519 public key in base64url. Your app keeps the private key. <a className="focus-ring" href="/docs/publish-and-share#restricted-forms" target="_blank" rel="noreferrer">Signed-link format</a></p></>:null}
    <button className="secondary-button focus-ring" type="submit">{busy?'Saving…':'Save form access'}</button>
  </fieldset>{error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}{notice?<p role="status" className="status-note">{notice}</p>:null}</form></details>
}
