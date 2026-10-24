import { useEffect, useId, useState } from 'react'
import type { RetentionState } from './model'

async function request(flowId:string,body?:unknown):Promise<RetentionState> {
  const response=await fetch(`/api/app/flows/${encodeURIComponent(flowId)}/retention`,{method:body?'PUT':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
  const value=await response.json() as RetentionState & {message?:string}
  if(response.status===403)throw new Error('The installation owner manages retention schedules and legal hold for this form.')
  if(!response.ok)throw new Error(value.message ?? 'Retention settings could not load.')
  return value
}

export function RetentionPanel({flowId}:{flowId:string}) {
  const id=useId(),[state,setState]=useState<RetentionState>(),[days,setDays]=useState(''),[hold,setHold]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[message,setMessage]=useState<string>()
  const receive=(value:RetentionState)=>{setState(value);setDays(value.days===null?'':String(value.days));setHold(value.legalHold);setConfirmed(false)}
  useEffect(()=>{let active=true;setState(undefined);setError(undefined);request(flowId).then(value=>{if(active)receive(value)}).catch(reason=>{if(active)setError(reason.message)});return()=>{active=false}},[flowId])
  const save=async()=>{setBusy(true);setError(undefined);setMessage(undefined);try{receive(await request(flowId,{days:days===''?null:Number(days),legalHold:hold,version:state!.version,confirmAutomaticDeletion:confirmed}));setMessage('Retention settings saved.')}catch(reason){setError(reason instanceof Error?reason.message:'Retention settings could not save.')}finally{setBusy(false)}}
  return <section className="panel" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Retention and legal hold</h2>
    <p className="muted">Automatic response deletion is off until the owner chooses a period and confirms it. Retention covers completed and quarantined responses and private saved answers. Deletion removes answers, updates results and redacts affected analyses.</p>
    {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}
    {!state?<p aria-busy={!error}>{error?'Retention settings unavailable.':'Loading retention settings…'}</p>:<>
      <div className="inspector-field"><label htmlFor={`${id}-days`}>Retention period in days</label><input className="text-input" id={`${id}-days`} type="number" min="1" max="36500" value={days} onChange={event=>{setDays(event.target.value);setConfirmed(false)}}/><p className="muted">Leave blank to keep responses. Saved resume links still have their original expiry. Data receives at least seven days of in-app notice before scheduled deletion, including data already older than a newly enabled period.</p></div>
      <label className="check-row"><input type="checkbox" checked={hold} onChange={event=>setHold(event.target.checked)}/>Legal hold: pause all automatic deletion</label>
      <p className="muted">A hold also preserves private saved answers past their original expiry; expired links stay unavailable. Releasing a hold starts a fresh seven-day notice window.</p>
      {state.legalHold?<p role="status">Legal hold is active. Automatic deletion is paused.</p>:state.notices.earliestDeletion?<p role="status">Advance deletion notice: {state.notices.responses} responses and {state.notices.saves} private saves are scheduled for deletion, beginning {new Date(state.notices.earliestDeletion).toLocaleString('en-US',{timeZone:state.timeZone,dateStyle:'medium',timeStyle:'short'})} ({state.timeZone}). Enable legal hold to pause deletion.</p>:<p className="muted">No data is currently in its advance deletion notice window.</p>}
      {days!=='' && !hold?<label className="check-row"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I confirm automatic deletion for this form after the retention period and notice window.</label>:null}
      <button type="button" className="primary-button focus-ring" disabled={busy || (days!=='' && ((!hold && !confirmed) || !Number.isInteger(Number(days)) || Number(days)<1 || Number(days)>36500))} onClick={()=>void save()}>{busy?'Saving retention…':'Save retention settings'}</button>
      {message?<p role="status" className="status-note" data-tone="success">{message}</p>:null}
    </>}
  </section>
}
