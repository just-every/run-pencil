import './studio.css'
import { useEffect,useState } from 'react'
import { studioApi } from './api'
import { StudioReview } from './StudioReview'
import type { StudioDraft,StudioInput } from '../model'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'

export function StudioPanel({onClose}:{onClose:()=>void}){
  const [options,setOptions]=useState<Awaited<ReturnType<typeof studioApi.options>>>(),[mode,setMode]=useState<StudioInput['mode']>('form'),[goal,setGoal]=useState(''),[source,setSource]=useState(''),[sourceType,setSourceType]=useState<StudioInput['sourceType']>('text'),[priorForms,setPriorForms]=useState<string[]>([]),[population,setPopulation]=useState(1000),[margin,setMargin]=useState(5),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<StudioDraft>(),[opening,setOpening]=useState(false)
  const markSaved=useProtectUnsavedChanges(!draft&&(!!goal||!!source))
  useEffect(()=>{let active=true;void studioApi.options().then(value=>{if(active)setOptions(value)}).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[])
  const generate=async()=>{setOpening(false);setBusy(true);setError('');try{const created=await studioApi.generate({mode,goal,source,sourceType,priorForms,population,margin:margin/100});setSource('');setGoal('');markSaved();setDraft(created)}catch(error){setError((error as Error).message)}finally{setBusy(false)}}
  const open=async(id:string)=>{if(!id)return;if((goal||source)&&!window.confirm('Discard unfinished generation input and open this draft?'))return;setBusy(true);setOpening(true);setError('');try{const saved=await studioApi.get(id);setSource('');setGoal('');markSaved();setDraft(saved)}catch(error){setError((error as Error).message)}finally{setBusy(false);setOpening(false)}}
  const file=async(input:HTMLInputElement)=>{const uploaded=input.files?.[0];if(!uploaded)return;setError('');try{if(!/\.(txt|md|markdown|csv|html|htm)$/i.test(uploaded.name)||/pdf|msword|wordprocessingml/i.test(uploaded.type))throw new Error('That file was not loaded. Choose text, Markdown, CSV or HTML; PDF and Word are not supported yet.');if(uploaded.size>80_000)throw new Error('Choose a text document of at most 80 kB.');const text=await uploaded.text();if(text.length>50_000)throw new Error('Choose at most 50,000 characters of source text.');setSource(text);setSourceType(/\.csv$/i.test(uploaded.name)?'csv':/\.html?$/i.test(uploaded.name)?'html':/\.(?:md|markdown)$/i.test(uploaded.name)?'markdown':'text')}catch(error){setError((error as Error).message)}finally{input.value=''}}
  if(draft)return <StudioReview initial={draft} onClose={onClose}/>
  const provider=options?.provider,origin=provider?.state==='on'?provider.origin:undefined
  return <form className="panel studio-panel" aria-label="Form studio" onSubmit={event=>{event.preventDefault();void generate()}}>
    <p className="eyebrow">New flow</p><h2 className="display">{mode==='study'?'Design a study':'Generate a form'}</h2>
    <p>Draft text, email, number, choice, Yes/No, rating or NPS questions from your goal, up to 30 steps. Review before publishing.</p>
    {error?<p role="alert" className="status-note" data-tone="error">{error}</p>:null}
    <div className="studio-fields">
      {options?.forms.some(form=>form.studio)?<label className="inspector-field">Continue generated draft<select className="text-input" value="" disabled={busy} onChange={event=>{void open(event.target.value)}}><option value="">Choose a saved draft</option>{options.forms.filter(form=>form.studio).map(form=><option key={form.id} value={form.id}>{form.title}</option>)}</select></label>:null}
      <label className="inspector-field">Create<select className="text-input" value={mode} disabled={busy} onChange={event=>setMode(event.target.value as StudioInput['mode'])}><option value="form">A form</option><option value="study">A study</option></select></label>
      <label className="inspector-field">{mode==='study'?'Business question':'Goal'}<textarea className="text-area" maxLength={2000} required disabled={busy} value={goal} onChange={event=>setGoal(event.target.value)} /></label>
      <label className="inspector-field">Source text<textarea className="text-area" maxLength={50000} disabled={busy} value={source} onChange={event=>setSource(event.target.value)} /></label>
      <label className="inspector-field">Source format<select className="text-input" disabled={busy} value={sourceType} onChange={event=>setSourceType(event.target.value as StudioInput['sourceType'])}><option value="text">Plain text</option><option value="markdown">Markdown</option><option value="csv">CSV</option><option value="html">HTML</option></select></label>
      <label className="inspector-field">Upload a text document<input type="file" accept=".txt,.md,.markdown,.csv,.html,.htm,text/plain,text/markdown,text/csv,text/html" disabled={busy} onChange={event=>{void file(event.target)}} /></label>
      <p>Text, Markdown, CSV and HTML are supported. PDF and Word files are not supported by this connection.</p>
      {mode==='study'?<div className="studio-sample"><label className="inspector-field">Population size<input type="number" min={1} max={1000000000} className="text-input" value={population} disabled={busy} onChange={event=>setPopulation(Number(event.target.value))} /></label><label className="inspector-field">Margin of error (%)<input type="number" min={1} max={20} className="text-input" value={margin} disabled={busy} onChange={event=>setMargin(Number(event.target.value))} /></label></div>:null}
      {options?.forms.length?<fieldset className="studio-context"><legend>Prior form prompts to include</legend>{options.forms.map(form=><label key={form.id}><input type="checkbox" disabled={busy||!priorForms.includes(form.id)&&priorForms.length>=10} checked={priorForms.includes(form.id)} onChange={event=>setPriorForms(current=>event.target.checked?[...current,form.id]:current.filter(id=>id!==form.id))}/><span>{form.title}</span></label>)}</fieldset>:null}
      <p>Only prompts from the forms you select are included. Prior responses, findings and audience segments are excluded.</p>
      {origin?<p>This click sends the goal, source text and selected prompts to <strong>{origin}</strong>. They are treated as data, and the original goal and source text are not stored in Pencil.</p>:<p role="status">{provider?.state==='off'?'AI generation is off. No source text is sent.':provider?.state==='misconfigured'?'The AI connection needs attention before a draft can be generated.':'Loading provider…'}</p>}
      <div className="builder-actions"><button type="submit" className="primary-button focus-ring" disabled={busy||!origin||!goal.trim()||mode==='study'&&(population<1||margin<1||margin>20)}>{busy?(opening?'Opening draft…':'Generating…'):origin?`Generate with ${origin}`:'Generation unavailable'}</button><button type="button" className="quiet-button focus-ring" disabled={busy} onClick={onClose}>Cancel</button></div>
    </div>
  </form>
}
