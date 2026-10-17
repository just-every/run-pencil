import { ArrowLeft, ArrowRight, Bookmark, LayoutGrid } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { LoadProblem } from '../../../app/ui/LoadProblem'
import { useFlowReports } from './useFlowReports'
import { dimensionValue, useCrosstab } from './useCrosstab'
import { FilterSummary, ReportFilters } from './ReportFilters'
import { CrosstabEvidence, CrosstabTable } from './CrosstabTable'
import './reports.css'

export function ReportsPage({flowId,viewId,onViewChange}:{flowId:string;viewId?:string;onViewChange:(id?:string)=>void}){
  const metadata=useFlowReports(flowId),state=useCrosstab(flowId,metadata.data,viewId,onViewChange)
  const {selection,options,shown}=state,busy=state.running||state.saving||state.loadingView
  return <section className="report-workbench" aria-labelledby="rv-title">
    <Link className="rv-back focus-ring" to="/app/flows/$flowId/results" params={{flowId}}><ArrowLeft size={16} aria-hidden="true"/>Results</Link>
    <header className="rv-heading"><div><h1 id="rv-title" className="display">Crosstabs</h1><p className="rv-eyebrow">Explore how answers cross-reference</p>{metadata.data&&<p className="rv-form-title">{metadata.data.title}</p>}</div><div className="rv-heading-actions">{metadata.data&&metadata.data.revisions.length>0&&<label className="rv-revision">Published revision<select disabled={busy} value={selection.revisionId} onChange={event=>{const {revisionId:_old,...filter}=selection.filter;state.change({revisionId:event.target.value,filter})}}>{metadata.data.revisions.map(revision=><option key={revision.id} value={revision.id}>Revision {revision.number}{revision.isCurrent?' · current':''}</option>)}</select></label>}<button type="button" className="rv-outline focus-ring" disabled={busy||!shown||!state.dashboard||state.dashboard.views.length>=20} onClick={()=>{if(state.name.trim())void state.save();else document.getElementById('rv-view-name')?.focus()}}><Bookmark size={17} aria-hidden="true"/>Save view</button></div></header>
    {metadata.error?<LoadProblem heading="h2" message={metadata.error} retryLabel="Retry reports" onRetry={metadata.reload}/>:!metadata.data?<p role="status">Loading report options…</p>:!metadata.data.revisions.length?<div className="rv-empty"><h2 className="display">Publish a form to compare answers</h2><p>Crosstabs use the questions and categories in one published revision.</p><Link className="rv-primary focus-ring" to="/app/flows/$flowId/builder" params={{flowId}}>Open builder</Link></div>:<>
      <form aria-busy={state.running} onSubmit={event=>{event.preventDefault();void state.run()}}>
        <fieldset disabled={busy} className="rv-config"><legend className="sr-only">Crosstab configuration</legend>
          <div className="rv-filter-strip">
            <label className="rv-dimension">Row question<select aria-label="Row question" value={selection.row?dimensionValue(selection.row):''} disabled={!options} onChange={event=>state.change({...selection,row:options!.dimensions.find(option=>dimensionValue(option.dimension)===event.target.value)!.dimension})}>{!options&&<option value="">Loading dimensions…</option>}{options?.dimensions.map(option=><option key={dimensionValue(option.dimension)} value={dimensionValue(option.dimension)}>{option.label}{option.multiple?' · multiple select':''}</option>)}</select></label>
            <label className="rv-dimension">Column question<select aria-label="Column question" value={selection.column?dimensionValue(selection.column):''} disabled={!options} onChange={event=>state.change({...selection,column:options!.dimensions.find(option=>dimensionValue(option.dimension)===event.target.value)!.dimension})}>{!options&&<option value="">Loading dimensions…</option>}{options?.dimensions.map(option=><option key={dimensionValue(option.dimension)} value={dimensionValue(option.dimension)}>{option.label}{option.multiple?' · multiple select':''}</option>)}</select></label>
            <div className="rv-filter-summary">{options?<><ReportFilters flowId={flowId} value={selection.filter} options={options} timeZone={metadata.data.timeZone} onChange={filter=>state.change({...selection,filter})} onError={state.filterError}/><FilterSummary filter={selection.filter} options={options}/></>:<span>Loading filters…</span>}</div>
            <button type="submit" className="rv-primary focus-ring" disabled={!state.valid||!options}>{state.running?'Calculating…':shown?.saved?'Run live crosstab':'Show crosstab'}</button>
          </div>
        </fieldset>
      </form>
      {state.optionsError?<div className="rv-error" role="alert"><p>{state.optionsError}</p><button type="button" className="rv-outline focus-ring" onClick={state.retryOptions}>Retry dimensions</button></div>:options&&options.dimensions.length<2?<p>Two categorical dimensions are needed. Add a supported question in the builder.</p>:options&&!state.valid?<p className="rv-hint">Choose two different dimensions.</p>:null}
      {state.error&&<div className="rv-error" role="alert"><p>{state.error}</p>{viewId&&!shown&&<button className="rv-outline focus-ring" type="button" onClick={state.retryView}>Retry saved view</button>}</div>}
      {state.note&&<p className="rv-notice" role="status">{state.note}</p>}
      {state.loadingView&&<p role="status">Loading saved snapshot…</p>}{state.running&&<p role="status">Calculating crosstab…</p>}
      {shown?<section aria-labelledby="rv-result-title"><h2 className="rv-results-title display" id="rv-result-title">{shown.saved?shown.saved.name:'Crosstab results'}</h2><CrosstabTable report={shown.report}/><CrosstabEvidence report={shown.report} timeZone={metadata.data.timeZone}/></section>:!state.loadingView&&!state.running&&<p className="rv-hint">Choose a revision, dimensions and filters, then show the crosstab.</p>}
      <section className="rv-bottom" aria-label="Saved views"><div><label>Saved views<select aria-label="Saved views" disabled={busy||!state.dashboard} value={viewId??''} onChange={event=>state.chooseView(event.target.value||undefined)}><option value="">Choose a saved snapshot</option>{state.dashboard?.views.map(view=><option key={view.id} value={view.id}>{view.name}{view.createdBy?` · ${view.createdBy.name}`:''}</option>)}</select></label><p className="rv-hint">{state.dashboard?`${state.dashboard.views.length} of 20 saved views`:'Saved view list unavailable.'}</p>{!state.dashboard&&<button type="button" className="rv-outline focus-ring" disabled={busy} onClick={()=>void state.reloadViews()}>Reload saved views</button>}</div>
        <form className="rv-save-form" onSubmit={event=>{event.preventDefault();void state.save()}}><label>View name<input id="rv-view-name" maxLength={100} placeholder="e.g. High value segments" value={state.name} onChange={event=>state.setName(event.target.value)} disabled={busy}/></label><button className="rv-outline focus-ring" type="submit" disabled={busy||!shown||!state.name.trim()||!state.dashboard||state.dashboard.views.length>=20}><Bookmark size={17} aria-hidden="true"/>{state.saving?'Saving…':'Save view'}</button></form>
        <Link className="rv-dashboard-link focus-ring" to="/app/flows/$flowId/dashboard" params={{flowId}}><LayoutGrid size={17} aria-hidden="true"/>Form dashboard<ArrowRight size={17} aria-hidden="true"/></Link>
      </section>
      <p className="rv-scope">Crosstabs support categorical choices, yes/no, consent, rating and score questions, plus collectors. Hidden fields, language, calculations, general numbers, dates and priority questions are not available here.</p>
    </>}
  </section>
}
