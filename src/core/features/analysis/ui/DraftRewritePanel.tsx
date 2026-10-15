import { useState } from 'react'
import type { Rewrite } from '../rewrites'
async function request<T>(path:string,body:unknown):Promise<T> {
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const value=(response.status===204?undefined:await response.json()) as (T & {message?:string}) | undefined
  if(!response.ok) throw new Error(value?.message??'The rewrite request failed.')
  return value as T
}
export function DraftRewritePanel({flowId,stepId,version,source,disabled,onAccepted}:{flowId:string;stepId:string;version:number;source:string;disabled:boolean;onAccepted:()=>Promise<void>}) {
  const [style,setStyle]=useState<'sharper'|'broader'|'contextual'>('sharper'),[context,setContext]=useState(''),[proposal,setProposal]=useState<Rewrite>(),[error,setError]=useState<string>(),[busy,setBusy]=useState(false)
  const run=async()=>{setBusy(true);setError(undefined);setProposal(undefined);try {setProposal(await request<Rewrite>(`/api/app/flows/${encodeURIComponent(flowId)}/rewrites`,{stepId,expectedVersion:version,source,style,context}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const decide=async(accept:boolean)=>{if(!proposal)return;setBusy(true);setError(undefined);try{await request(`/api/app/rewrites/${encodeURIComponent(proposal.id)}/decision`,{accept});setProposal(undefined);if(accept)await onAccepted()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <details className="quiet-panel"><summary className="focus-ring">Rewrite this question</summary>
    <p className="muted">The saved question and context go to your configured AI provider. Save current edits first. Accepting saves only this question’s proposed wording to the draft; publishing remains separate.</p>
    <label className="inspector-field">Rewrite style<select className="text-input" value={style} disabled={busy} onChange={e=>setStyle(e.target.value as typeof style)}><option value="sharper">Sharper</option><option value="broader">Broader</option><option value="contextual">Contextual</option></select></label>
    <label className="inspector-field">Context<textarea className="text-area" maxLength={2000} value={context} disabled={busy} onChange={e=>setContext(e.target.value)}/></label>
    <button className="quiet-button focus-ring" type="button" disabled={disabled||busy} onClick={()=>void run()}>{busy?'Working…':proposal?.state==='failed'?'Retry rewrite':'Request rewrite'}</button>
    {error&&<p role="alert">{error}</p>}
    {proposal&&<div aria-live="polite"><p><strong>Source</strong></p><p>{proposal.source}</p>{proposal.state==='failed'?<p role="alert">{proposal.error}</p>:<><p><strong>Proposal</strong></p><p>{proposal.proposal}</p><div className="builder-actions"><button type="button" className="primary-button focus-ring" disabled={disabled||busy||proposal.draftVersion!==version||proposal.source!==source} onClick={()=>void decide(true)}>Accept and save wording</button><button type="button" className="quiet-button focus-ring" disabled={busy} onClick={()=>void decide(false)}>Reject</button></div></>}</div>}
  </details>
}
