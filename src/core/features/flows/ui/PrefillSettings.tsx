import { useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import type { PrefillMapping } from '../../../shared/knownDataPrefill'

export function PrefillSettings({draft,stepId,disabled,onSave}:{draft:BuilderDraft;stepId:string;disabled:boolean;onSave:(mappings:PrefillMapping[])=>Promise<void>}) {
  const mapping=draft.formSettings?.prefill?.find(value=>value.stepId===stepId)
  const [field,setField]=useState(mapping?.field ?? '')
  const [locked,setLocked]=useState(mapping?.locked ?? false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState<string>()
  return <details className="known-data-settings"><summary className="focus-ring" aria-label="Known-data prefill">Prefill</summary><p className="muted">Invitation links only. A submitted prefill becomes answer text. Publish to apply.</p><label className="inspector-field">Contact field key<input className="text-input" value={field} disabled={disabled||saving} onChange={event=>setField(event.target.value)} /></label><label className="toggle-row"><input type="checkbox" checked={locked} disabled={disabled||saving} onChange={event=>setLocked(event.target.checked)}/><span>Lock prefilled answer</span></label><button className="secondary-button focus-ring" type="button" disabled={disabled||saving} onClick={async()=>{setSaving(true);setError(undefined);try{await onSave([...(draft.formSettings?.prefill ?? []).filter(value=>value.stepId!==stepId),...(field.trim()?[{stepId,field:field.trim(),locked}]:[])])}catch(reason){setError(reason instanceof Error?reason.message:'Prefill could not be saved.')}finally{setSaving(false)}}}>Save prefill mapping</button>{error?<p role="alert">{error}</p>:null}</details>
}
