import { useEffect,useState } from 'react'
type Status={saved:boolean;a2pState:string|null;fromNumber:string|null;webhookUrl:string}
export function SmsConnection(){
 const [status,setStatus]=useState<Status>(),[accountId,setAccount]=useState(''),[token,setToken]=useState(''),[from,setFrom]=useState(''),[a2p,setA2p]=useState('unregistered'),[busy,setBusy]=useState(false),[error,setError]=useState<string>()
 const load=async()=>{const r=await fetch('/api/app/connections/sms');if(!r.ok)throw new Error('SMS settings could not load.');setStatus(await r.json() as Status)}
 useEffect(()=>{void load().catch(e=>setError((e as Error).message))},[])
 return <section className="panel" aria-label="SMS invitations" style={{padding:'1.25rem'}}><h2>SMS invitations</h2><p>Twilio sends consented contacts an invitation link and a STOP instruction. Only the installation owner can change this connection.</p>
 {status?.saved?<p>Connected · {status.fromNumber} · Owner-reported A2P registration: {status.a2pState}</p>:<p>No Twilio connection saved.</p>}
 <form onSubmit={event=>{event.preventDefault();setBusy(true);setError(undefined);void(async()=>{const r=await fetch('/api/app/connections/sms',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId,authToken:token,fromNumber:from,a2pState:a2p})});if(!r.ok)throw new Error((await r.json() as {message:string}).message);setToken('');setAccount('');setFrom('');await load()})().catch(e=>setError((e as Error).message)).finally(()=>setBusy(false))}}>
 <label className="inspector-field">Twilio account ID<input className="text-input" autoComplete="off" value={accountId} disabled={busy} onChange={e=>setAccount(e.target.value)} required/></label>
 <label className="inspector-field">Twilio auth token<input className="text-input" type="password" autoComplete="new-password" value={token} disabled={busy} onChange={e=>setToken(e.target.value)} required/></label>
 <label className="inspector-field">Sending mobile number<input className="text-input" type="tel" placeholder="+15555550100" value={from} disabled={busy} onChange={e=>setFrom(e.target.value)} required/></label>
 <label className="inspector-field">A2P registration<select aria-label="A2P registration" className="text-input" value={a2p} disabled={busy} onChange={e=>setA2p(e.target.value)}>{['unregistered','pending','approved','rejected'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
 <button className="secondary-button focus-ring" disabled={busy} type="submit">Save Twilio connection</button></form>
 {status?.saved?<><p>Configure Twilio’s incoming message webhook to this address:</p><p style={{overflowWrap:'anywhere'}}>{status.webhookUrl}</p><button className="quiet-button focus-ring" disabled={busy} type="button" onClick={()=>{setBusy(true);void fetch('/api/app/connections/sms',{method:'DELETE'}).then(async r=>{if(!r.ok)throw new Error('Only the owner can remove this connection.');await load()}).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false))}}>Remove Twilio connection</button></>:null}
 {error?<p role="alert">{error}</p>:null}</section>
}
