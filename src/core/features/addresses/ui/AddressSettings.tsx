import { useState } from 'react'

export function AddressSettings({flowId,slug,onRenamed}:{flowId:string;slug:string;onRenamed:()=>Promise<void>}) {
  const [value,setValue]=useState(slug),[busy,setBusy]=useState(false),[error,setError]=useState<string>()
  return <details><summary className="focus-ring">Form address</summary>
    <label className="inspector-field">Public address<input className="text-input" value={value} maxLength={120} disabled={busy} onChange={event=>setValue(event.target.value)} /></label>
    <p>Earlier links redirect to this address. Retired addresses stay reserved.</p>
    <button className="secondary-button focus-ring" type="button" disabled={busy||value===slug} onClick={async()=>{setBusy(true);setError(undefined);try {const response=await fetch(`/api/app/flows/${encodeURIComponent(flowId)}/address`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:value,expectedSlug:slug})});if(!response.ok){const result=await response.json() as {message?:string};throw new Error(result.message??'The address could not be changed.')}await onRenamed()}catch(reason){setError(reason instanceof Error?reason.message:'The address could not be changed.')}finally{setBusy(false)}}}>Rename address</button>
    {error?<p role="alert">{error}</p>:null}
  </details>
}
