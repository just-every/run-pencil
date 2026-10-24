import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { StudioDraft,Study } from '../model'
import { studioApi } from './api'
export function StudioReview({initial,onClose}:{initial:StudioDraft;onClose:()=>void}){
  const [draft,setDraft]=useState(initial),[study,setStudy]=useState(initial.study),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const markSaved=useProtectUnsavedChanges(dirty)
  const edit=(key:keyof Study,value:string)=>{if(study){setStudy({...study,[key]:key==='hypotheses'?value.split('\n'):value});setDirty(true)}}
  const save=async()=>{if(!study)return;setBusy(true);setError('');try{setDraft(await studioApi.save(draft,study));setDirty(false);markSaved()}catch(error){setError((error as Error).message)}finally{setBusy(false)}}
  return <section className="panel studio-panel" aria-label="Generated draft review">
    <p className="eyebrow">Generated draft</p><h2 className="display">{draft.title}</h2><p>Review and edit before publishing. Nothing has been published or sent to an audience.</p>
    {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}
    {study?<div className="studio-fields" aria-label="Study plan">
      <label className="inspector-field">Decision<textarea className="text-area" value={study.decision} onChange={event=>edit('decision',event.target.value)} /></label>
      <label className="inspector-field">Hypotheses, one per line<textarea className="text-area" value={study.hypotheses.join('\n')} onChange={event=>edit('hypotheses',event.target.value)} /></label>
      <label className="inspector-field">Audience<textarea className="text-area" value={study.audience} onChange={event=>edit('audience',event.target.value)} /></label>
      <label className="inspector-field">Channel<input className="text-input" value={study.channel} onChange={event=>edit('channel',event.target.value)} /></label>
      <label className="inspector-field">Analysis plan<textarea className="text-area" value={study.analysisPlan} onChange={event=>edit('analysisPlan',event.target.value)} /></label>
      {draft.sample?<p>Plan for {draft.sample.size} completed responses from a population of {draft.sample.population}, at 95% confidence and a {Math.round(draft.sample.margin*100)}% margin of error. This uses the conservative finite-population formula; it does not guarantee a representative sample.</p>:null}
      <button className="secondary-button focus-ring" type="button" disabled={busy||!dirty} onClick={()=>{void save()}}>{busy?'Saving…':'Save study plan'}</button>
      {!dirty?<p role="status">Study plan saved with this draft.</p>:null}
    </div>:null}
    <h3>Questions to review</h3><ol className="studio-questions">{draft.steps.filter(step=>step.questionType).map(step=><li key={step.id}><span className="badge">{step.generated?'Generated question':'Question'}</span><p>{step.prompt}</p>{draft.flags.filter(flag=>flag.stepId===step.id).map((flag,index)=><p className="studio-flag" key={index}><strong>{flag.kind.replaceAll('_',' ')} · {flag.source==='provider'?'Provider suggestion':'Wording check'}</strong> {flag.reason}</p>)}</li>)}</ol>
    <p>Wording checks are advisory. They never block publication or rewrite your questions.</p>
    <div className="builder-actions"><Link className="primary-button focus-ring" disabled={busy||dirty} to="/app/flows/$flowId/builder" params={{flowId:draft.flowId}}>Edit and publish draft</Link><button className="quiet-button focus-ring" type="button" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard unsaved study plan changes?'))onClose()}}>Back to flows</button></div>
  </section>
}
