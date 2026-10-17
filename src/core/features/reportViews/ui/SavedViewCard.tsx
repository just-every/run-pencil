import { useId } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReportView } from '..'
import { CrosstabTable } from './CrosstabTable'
import { reportTime } from './useFlowReports'
export function SavedViewCard({flowId,view,index,total,timeZone,busy,blocked,confirming,onMove,onAskDelete,onKeep,onDelete}:{flowId:string;view:ReportView;index:number;total:number;timeZone:string;busy:boolean;blocked:boolean;confirming:boolean;onMove:(direction:-1|1)=>void;onAskDelete:()=>void;onKeep:()=>void;onDelete:()=>void}){
  const confirmation=useId(),author=view.createdBy?.name,initials=author?author.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase():undefined
  const filter=view.definition.filter??{},filtered=Object.entries(filter).some(([key,value])=>key!=='revisionId'&&value!==undefined)
  return <article className="rv-saved-card" aria-label={view.name}>
    <div className="rv-card-description"><h2 className="display">{view.name}</h2><p>Saved crosstab · Revision {view.snapshot.revision.number}</p><div className="rv-person">{initials&&<span className="rv-avatar" aria-hidden="true">{initials}</span>}<div><p className="rv-person-name">{author??'Creator no longer available'}</p><p className="rv-card-date">Created {reportTime(view.createdAt,timeZone)}</p><p className="rv-card-date">Cutoff {reportTime(view.cutoff,timeZone)}</p></div></div></div>
    <div className="rv-card-dimensions"><h3>Dimensions</h3><p><strong>Rows:</strong> {view.snapshot.row.label}</p><p><strong>Columns:</strong> {view.snapshot.column.label}</p><p>{filtered?'Saved response filters applied.':'All released responses in this revision.'}</p><p className="rv-card-date">Times use {timeZone}.</p></div>
    <div className="rv-card-results"><h3>Results</h3><CrosstabTable report={view.snapshot} compact/><p className="rv-card-note">{view.snapshot.disclosure.suppressed?'Small cells and related totals are withheld.':'No cells suppressed.'} Disclosure threshold: {view.snapshot.disclosure.threshold}.</p></div>
    <div className="rv-card-actions"><Link className="rv-primary focus-ring" to="/app/flows/$flowId/reports" params={{flowId}} search={{viewId:view.id}}>Open view</Link><button className="rv-action focus-ring" type="button" disabled={busy||blocked||index===0} onClick={()=>onMove(-1)}><ArrowUp size={18} aria-hidden="true"/>Move up</button><button className="rv-action focus-ring" type="button" disabled={busy||blocked||index===total-1} onClick={()=>onMove(1)}><ArrowDown size={18} aria-hidden="true"/>Move down</button><button className="rv-action focus-ring" type="button" disabled={busy||blocked} aria-expanded={confirming} aria-controls={confirmation} onClick={onAskDelete}><Trash2 size={18} aria-hidden="true"/>Delete view</button></div>
    {confirming&&<div id={confirmation} className="rv-delete-confirm" role="alert"><p>Delete “{view.name}” from this form dashboard? The saved snapshot will be removed.</p><div><button type="button" className="rv-outline focus-ring" disabled={busy} onClick={onKeep}>Keep view</button><button type="button" className="rv-outline rv-danger focus-ring" disabled={busy||blocked} onClick={onDelete}>{busy?'Deleting…':'Confirm delete'}</button></div></div>}
  </article>
}
