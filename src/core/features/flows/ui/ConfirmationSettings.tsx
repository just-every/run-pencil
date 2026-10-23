import { useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import type { ConfirmationSettings as Settings } from '../../../shared/confirmationSettings'
import { RecallHelp } from './RecallHelp'

const defaults:Settings={enabled:false,includeAnswers:false,answerTypes:[],subject:'Your response was received',body:'Thank you for your response.'}
export function ConfirmationSettings({draft,stepId,disabled,onSave}:{draft:BuilderDraft;stepId:string;disabled:boolean;onSave:(settings:Settings)=>Promise<void>}) {
  const [value,setValue]=useState(draft.formSettings?.confirmation??defaults)
  const [saving,setSaving]=useState(false),[error,setError]=useState<string>()
  const update=(patch:Partial<Settings>)=>setValue(current=>({...current,...patch}))
  const questionTypes=draft.steps.flatMap(step=>step.kind==='question'&&step.questionType?[step.questionType]:[])
  const types=[...new Set([...questionTypes,...(draft.formSettings?.hiddenFields??[]).map(field=>field.type==='text'?'short_text':field.type==='boolean'?'yes_no':field.type),...(draft.formSettings?.calculations??[]).map(value=>value.type==='text'?'short_text':value.type)])]
  const busy=disabled||saving
  return <details><summary className="focus-ring">Respondent confirmation email</summary><p className="muted">Off by default. Publish to apply. A receipt has no response access link. Identified participants who opted out receive none.</p>
    <label className="toggle-row"><input type="checkbox" checked={value.enabled} disabled={busy} onChange={event=>update({enabled:event.target.checked})}/><span>Send a confirmation after completion</span></label>
    <label className="inspector-field">Confirmation recipient<select aria-label="Confirmation recipient" className="text-input" value={value.emailStepId??''} disabled={busy} onChange={event=>update({emailStepId:event.target.value||undefined})}><option value="">Identified invitation participant only</option>{draft.steps.filter(step=>step.kind==='question'&&step.questionType==='email').map(step=><option key={step.id} value={step.id}>{step.prompt}</option>)}</select></label>
    <p className="muted">The selected email question is marked “Send my confirmation here”. No other typed address receives mail.</p>
    <label className="toggle-row"><input type="checkbox" checked={value.includeAnswers} disabled={busy} onChange={event=>update({includeAnswers:event.target.checked})}/><span>Include an answer copy</span></label>
    {value.includeAnswers?<fieldset><legend>Answer types allowed in the copy and recall</legend><p className="muted">None are included until selected. Choose only answer types you intend to send by email.</p>{types.map(type=><label className="toggle-row" key={type}><input type="checkbox" disabled={busy} checked={value.answerTypes.includes(type)} onChange={event=>update({answerTypes:event.target.checked?[...value.answerTypes,type]:value.answerTypes.filter(candidate=>candidate!==type)})}/><span>{type.replaceAll('_',' ')}</span></label>)}</fieldset>:null}
    <label className="inspector-field">Confirmation subject<input className="text-input" disabled={busy} value={value.subject} maxLength={200} onChange={event=>update({subject:event.target.value})}/></label>
    <label className="inspector-field">Confirmation message<textarea className="textarea-input" disabled={busy} value={value.body} maxLength={4000} onChange={event=>update({body:event.target.value})}/></label>
    <RecallHelp flow={draft} currentStepId={stepId} disabled={busy} onInsert={reference=>update({body:value.body+reference})}/>
    <button className="secondary-button focus-ring" type="button" disabled={busy} onClick={async()=>{setSaving(true);setError(undefined);try{await onSave(value)}catch(reason){setError(reason instanceof Error?reason.message:'Confirmation settings could not be saved.')}finally{setSaving(false)}}}>Save confirmation settings</button>{error?<p role="alert">{error}</p>:null}
  </details>
}
