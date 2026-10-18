import { useEffect, useState } from 'react'
import { api, type TeamTemplate } from '../../../app/api'

export function TeamTemplatePicker({selected,onSelect,disabled}:{selected?:string;onSelect:(template?:TeamTemplate)=>void;disabled:boolean}) {
  const [templates,setTemplates]=useState<TeamTemplate[]>(), [error,setError]=useState(''), [busy,setBusy]=useState(false), [refresh,setRefresh]=useState(0)
  useEffect(()=>{let active=true;setError('');api.teamTemplates().then(rows=>{if(active)setTemplates(rows)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[refresh])
  return <fieldset className="quiet-panel team-template-picker" disabled={disabled||busy}><legend>Team templates</legend>
    {error?<p role="alert">{error} <button type="button" onClick={()=>setRefresh(refresh+1)}>Retry templates</button></p>:null}
    {!templates&&!error?<p role="status">Loading team templates…</p>:null}
    {templates?.length===0?<p className="muted">Save a form as a team template from its builder.</p>:null}
    {templates?.length?<><label className="inspector-field">Workspace template<select className="text-input" value={selected??''} onChange={e=>onSelect(templates.find(t=>t.id===e.target.value))}><option value="">Choose a team template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {selected?<><p className="muted">Saved by {templates.find(t=>t.id===selected)?.createdBy??'a former operator'}. Creating a flow makes a separate editable copy.</p><button className="quiet-button focus-ring" type="button" onClick={async()=>{if(!window.confirm('Retire this template? Existing flows keep their questions.'))return;setBusy(true);setError('');try{await api.retireTeamTemplate(selected);onSelect(undefined);setRefresh(refresh+1)}catch(e){setError(e instanceof Error?e.message:'The template could not be retired.')}finally{setBusy(false)}}}>Retire template</button></>:null}</>:null}
  </fieldset>
}
