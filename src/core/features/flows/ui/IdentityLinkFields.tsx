import { useState } from 'react'
import { api } from '../../../app/api'
import type { PublicFlow } from '../../../app/api'

/** Uses the published declarations even while the operator is editing the next draft. */
export function IdentityLinkFields({flowId,slug,onIssued}:{flowId:string;slug:string;onIssued:(path:string)=>void}) {
  const [published,setPublished]=useState<PublicFlow>()
  const [values,setValues]=useState<Record<string,string>>({})
  const [error,setError]=useState<string>()
  const [busy,setBusy]=useState(false)
  const load=async()=>{
    setBusy(true);setError(undefined)
    try {setPublished(await api.publicFlow(slug))} catch(reason){setError(reason instanceof Error?reason.message:'The published form could not be read.')} finally{setBusy(false)}
  }
  const issue=async()=>{
    if(!published)return
    setBusy(true);setError(undefined)
    try {onIssued((await api.createIdentityLink(flowId,published.revision.id,values)).path)} catch(reason){setError(reason instanceof Error?reason.message:'The identifying link could not be created.')} finally{setBusy(false)}
  }
  return <div className="flow-share-field">
    <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>void load()}>Prepare identifying link</button>
    {published ? <fieldset disabled={busy} className="inspector-field"><legend>Identifying link · revision {published.revision.number}</legend>
      <p className="muted">Link-supplied identity is unverified. These values stay fixed unless the respondent removes them with This isn’t me. Publishing again retires this link.</p>
      {published.formSettings?.identityMode==='identified' ? <>{published.formSettings.hiddenFields.filter(field=>field.category==='identifying').map(field=><label key={field.id}>{field.name}<input className="text-input" aria-label={`Identifying ${field.name}`} value={values[field.name]??''} onChange={event=>setValues(previous=>({...previous,[field.name]:event.target.value}))}/></label>)}<button className="secondary-button focus-ring" type="button" onClick={()=>void issue()}>Create identifying link</button></> : <p>Publish identified public links in the form settings first.</p>}
    </fieldset> : null}
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
  </div>
}
