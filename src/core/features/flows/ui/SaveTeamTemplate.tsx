import { useState } from 'react'
import { api } from '../../../app/api'

export function SaveTeamTemplate({flowId,version,title,published,disabled}:{flowId:string;version:number;title:string;published:boolean;disabled:boolean}) {
  const [open,setOpen]=useState(false), [name,setName]=useState(title), [source,setSource]=useState<'draft'|'published'>('draft')
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [failed,setFailed]=useState(false)
  return <div>
    <button className="secondary-button focus-ring" type="button" disabled={disabled||busy} aria-expanded={open} onClick={()=>setOpen(!open)}>Save as team template</button>
    {open ? <form className="quiet-panel team-template-save" aria-label="Save team template" onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage('');setFailed(false)
      try {await api.saveTeamTemplate(flowId,{name,source,expectedVersion:version});setMessage('Team template saved. Find it under New flow.');setOpen(false)}
      catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'The template could not be saved.')}
      finally{setBusy(false)}
    }}>
      <label className="inspector-field">Template name<input className="text-input" required maxLength={100} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
      <label className="inspector-field">Version to save<select className="text-input" value={source} disabled={busy} onChange={e=>setSource(e.target.value as 'draft'|'published')}><option value="draft">Saved draft</option>{published?<option value="published">Current published version</option>:null}</select></label>
      <p className="muted">Keep questions, answer paths and question settings. New flows use the workspace branding. Responses and audience stay with this flow.</p>
      <button className="primary-button focus-ring" type="submit" disabled={busy||!name.trim()}>{busy?'Saving…':'Save template'}</button>
    </form>:null}
    {message?<p className="status-note" role={failed?'alert':'status'}>{message}</p>:null}
  </div>
}
