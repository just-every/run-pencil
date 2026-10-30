import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../app/api'
import { dayBoundary } from '../../../shared/timeZone'
import type { AuditFilters, AuditOptions, AuditPage as Page } from '../model'
import { activity, auditApi } from './client'
import { AuditTable } from './AuditTable'
import { FilterBar, type FilterChip } from '../../../shared/ui/FilterBar'
import { shortDateTime } from '../../../shared/ui/shortDate'
import { keepIfSame, useQuietRefresh } from '../../../shared/ui/useQuietRefresh'
export function AuditPage() {
 const [options,setOptions]=useState<AuditOptions>(),[page,setPage]=useState<Page>(),[zone,setZone]=useState<string>(),[error,setError]=useState<string>(),[optionError,setOptionError]=useState<string>(),[loading,setLoading]=useState(true),[draft,setDraft]=useState<AuditFilters>({}),[cursor,setCursor]=useState<string>(),[previous,setPrevious]=useState<Array<string|undefined>>([]),[actorSearch,setActorSearch]=useState(''),[formSearch,setFormSearch]=useState(''),[fromDay,setFromDay]=useState(''),[toDay,setToDay]=useState('')
 const filters=useMemo<AuditFilters>(()=>({...draft,from:fromDay&&zone?dayBoundary(fromDay,zone):undefined,to:toDay&&zone?dayBoundary(toDay,zone,true):undefined}),[draft,fromDay,toDay,zone])
 useEffect(()=>{let active=true;Promise.all([auditApi.options(),api.workspace()]).then(([o,w])=>{if(active){setOptions(o);setZone(w.timeZone)}}).catch(e=>{if(active)setOptionError(e.message)});return()=>{active=false}},[])
 useEffect(()=>{let active=true;setLoading(true);setError(undefined);setPage(undefined);auditApi.page({...filters,cursor}).then(p=>{if(active)setPage(p)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[filters,cursor])
 useQuietRefresh(()=>{if(loading||cursor)return;return auditApi.page({...filters,cursor}).then(next=>setPage(current=>current?keepIfSame(current,next,['cutoff','snapshotCursor']):current))})
 const firstPage=()=>{setCursor(undefined);setPrevious([])}
 const change=(next:AuditFilters)=>{setDraft(next);firstPage()}
 const changeDay=(set:(day:string)=>void)=>(day:string)=>{set(day);firstPage()}
 const chips:FilterChip[]=[
  ...(draft.actorId?[{key:'Actor',label:`Actor: ${options?.actors.find(o=>o.id===draft.actorId)?.name??'Former team member'}`,onRemove:()=>change({...draft,actorId:undefined})}]:[]),
  ...(draft.flowId?[{key:'Form',label:`Form: ${options?.forms.find(o=>o.id===draft.flowId)?.name??'Unavailable form'}`,onRemove:()=>change({...draft,flowId:undefined})}]:[]),
  ...(draft.kind?[{key:'Activity',label:`Activity: ${activity(draft.kind)}`,onRemove:()=>change({...draft,kind:undefined})}]:[]),
  ...(fromDay?[{key:'From',label:`From: ${fromDay}`,onRemove:()=>changeDay(setFromDay)('')}]:[]),
  ...(toDay?[{key:'Until',label:`Until: ${toDay}`,onRemove:()=>changeDay(setToDay)('')}]:[]),
 ]
 async function findChoices(){setOptionError(undefined);try{setOptions(await auditApi.options(actorSearch,formSearch))}catch(e){setOptionError((e as Error).message)}}
 const time=(value:string)=>shortDateTime(value,zone)
 return <section className="audit-viewer" aria-labelledby="audit-title"><h1 className="display" id="audit-title">Audit log</h1>
 <FilterBar chips={chips} onClear={()=>{setDraft({});setFromDay('');setToDay('');firstPage()}}><div className="filters">
 <label className="inspector-field">Actor<select aria-label="Actor" className="text-input" value={draft.actorId??''} onChange={e=>change({...draft,actorId:e.target.value||undefined})}><option value="">All actors</option>{options?.actors.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="inspector-field">Form<select aria-label="Form" className="text-input" value={draft.flowId??''} onChange={e=>change({...draft,flowId:e.target.value||undefined})}><option value="">All forms</option>{options?.forms.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="inspector-field">Activity<select aria-label="Activity" className="text-input" value={draft.kind??''} onChange={e=>change({...draft,kind:e.target.value||undefined})}><option value="">All activities</option>{options?.kinds.map(k=><option key={k} value={k}>{activity(k)}</option>)}</select></label>
 <label className="inspector-field">From<input className="text-input" type="date" value={fromDay} onChange={e=>changeDay(setFromDay)(e.target.value)}/></label><label className="inspector-field">Until<input className="text-input" type="date" value={toDay} onChange={e=>changeDay(setToDay)(e.target.value)}/></label></div>
 <details className="choice-search"><summary>Find an actor or form</summary><form className="builder-actions" onSubmit={e=>{e.preventDefault();void findChoices()}}><label className="inspector-field">Actor name<input className="text-input" value={actorSearch} maxLength={200} onChange={e=>setActorSearch(e.target.value)}/></label><label className="inspector-field">Form name<input className="text-input" value={formSearch} maxLength={200} onChange={e=>setFormSearch(e.target.value)}/></label><button className="secondary-button focus-ring" type="submit">Find choices</button></form>{options&&Object.values(options.truncated).some(Boolean)?<p className="muted">Showing the first 100 choices in each filter. Narrow the actor or form name to find another.</p>:null}</details></FilterBar>
 <div className="actions export-actions">{page?<a className="secondary-button focus-ring" href={auditApi.exportUrl(filters,page.snapshotCursor)} download>Export CSV</a>:null}</div>
 {error||optionError?<p className="status-note" data-tone="error" role="alert">{error??optionError}</p>:null}{loading?<p role="status">Loading audit history…</p>:null}
 {page?<><p className="muted">As of {time(page.cutoff)} · Times in {zone??'the workspace time zone'}</p><section className="panel" aria-label="Recorded activity">{page.rows.length?<AuditTable rows={page.rows} time={time}/>:<p className="empty">No recorded activity matches these filters.</p>}<div className="footer"><span>{page.rows.length} {page.rows.length===1?'event':'events'} on this page</span><div className="pagination"><button className="secondary-button focus-ring" type="button" disabled={!previous.length} onClick={()=>{setCursor(previous.at(-1));setPrevious(p=>p.slice(0,-1))}}>Previous events</button><span>Page {previous.length+1}</span><button className="secondary-button focus-ring" type="button" disabled={!page.nextCursor} onClick={()=>{setPrevious(p=>[...p,cursor]);setCursor(page.nextCursor??undefined)}}>Next events</button></div></div></section></>:null}
 </section>
}
