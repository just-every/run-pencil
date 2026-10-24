import { useEffect,useState } from 'react'
export function GoogleConnection(){
 const [callbackUrl,setCallback]=useState('')
 const [connected,setConnected]=useState(false),[clientId,setId]=useState(''),[clientSecret,setSecret]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string>()
 useEffect(()=>{void fetch('/api/app/connections/google').then(async r=>{if(!r.ok)throw new Error('Google connection status could not load.');const result=await r.json() as {connected:boolean;callbackUrl:string};setConnected(result.connected);setCallback(result.callbackUrl)}).catch(e=>setError((e as Error).message))},[])
 return <section className="panel" aria-label="Google Sheets connection" style={{padding:'1.25rem'}}><h2>Google Sheets</h2><p>{connected?'Google is connected. Choose a worksheet in each form’s builder settings.':'Connect Google to send disclosed responses to your worksheet.'}</p><p>Only the installation owner connects Google. Access credentials stay private and are excluded from backups.</p>
 {callbackUrl?<><p>Add this callback address to your Google OAuth application:</p><p style={{overflowWrap:'anywhere'}}>{callbackUrl}</p></>:null}
 <form onSubmit={event=>{event.preventDefault();setBusy(true);setError(undefined);void fetch('/api/app/connections/google/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,clientSecret})}).then(async r=>{const result=await r.json() as {authorizationUrl?:string;message?:string};if(!r.ok||!result.authorizationUrl)throw new Error(result.message??'Google sign-in could not start.');setSecret('');window.location.assign(result.authorizationUrl)}).catch(e=>{setError((e as Error).message);setBusy(false)})}}>
 <label className="inspector-field">Google OAuth client ID<input className="text-input" autoComplete="off" value={clientId} disabled={busy} required onChange={e=>setId(e.target.value)}/></label>
 <label className="inspector-field">Google OAuth client secret<input className="text-input" type="password" autoComplete="new-password" value={clientSecret} disabled={busy} required onChange={e=>setSecret(e.target.value)}/></label>
 <button className="secondary-button focus-ring" disabled={busy} type="submit">Connect Google</button></form>
 {connected?<button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>{setBusy(true);void fetch('/api/app/connections/google',{method:'DELETE'}).then(r=>{if(!r.ok)throw new Error('Only the owner can disconnect Google.');setConnected(false)}).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false))}}>Disconnect Google</button>:null}
 {error?<p role="alert">{error}</p>:null}</section>
}
