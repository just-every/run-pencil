import { useEffect, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReportDashboard } from '..'
import { LoadProblem } from '../../../app/ui/LoadProblem'
import { failureMessage, reportViewsApi } from './client'
import { reportTime, useFlowReports } from './useFlowReports'
import { SavedViewCard } from './SavedViewCard'
import './reports.css'
export function DashboardPage({flowId}:{flowId:string}){
  const metadata=useFlowReports(flowId),[dashboard,setDashboard]=useState<ReportDashboard>(),[busy,setBusy]=useState(false),[error,setError]=useState<string>(),[confirm,setConfirm]=useState<string>()
  useEffect(()=>{setDashboard(metadata.data?.dashboard);setConfirm(undefined)},[metadata.data])
  const reload=()=>{setError(undefined);setDashboard(undefined);metadata.reload()}
  const move=async(id:string,direction:-1|1)=>{
    if(!dashboard||busy)return
    const previous=dashboard,views=[...previous.views],index=views.findIndex(view=>view.id===id),target=index+direction
    if(index<0||target<0||target>=views.length)return
    ;[views[index],views[target]]=[views[target],views[index]]
    setDashboard({...previous,views});setBusy(true);setError(undefined)
    try{setDashboard(await reportViewsApi.arrange(flowId,previous.version,views.map(view=>view.id)))}catch(error){setDashboard(previous);setError(failureMessage(error))}finally{setBusy(false)}
  }
  const erase=async(id:string)=>{
    if(busy)return
    setBusy(true);setError(undefined)
    let deleted=false
    try{await reportViewsApi.erase(flowId,id);deleted=true;setConfirm(undefined);setDashboard(undefined);setDashboard(await reportViewsApi.list(flowId))}
    catch(error){setError(`${deleted?'The view was deleted. ':''}${failureMessage(error)}`)}finally{setBusy(false)}
  }
  const newest=dashboard?.views.reduce<string|undefined>((latest,view)=>!latest||view.cutoff>latest?view.cutoff:latest,undefined)
  return <section className="report-workbench rv-dashboard-page" aria-labelledby="rv-dashboard-title">
    <Link className="rv-back focus-ring" to="/app/flows/$flowId/results" params={{flowId}}><ArrowLeft size={16} aria-hidden="true"/>Results</Link>
    <header className="rv-heading"><div><h1 id="rv-dashboard-title" className="display">{metadata.data?.title??'Form dashboard'}</h1><p className="rv-eyebrow">Form dashboard</p><p className="rv-intro">Explore survey response relationships with saved crosstabs or create a new analysis.</p></div><Link className="rv-primary focus-ring" to="/app/flows/$flowId/reports" params={{flowId}} search={{viewId:undefined}}><Plus size={17} aria-hidden="true"/>Create crosstab</Link></header>
    {metadata.error?<LoadProblem heading="h2" message={metadata.error} retryLabel="Retry dashboard" onRetry={reload}/>:!metadata.data?<p role="status">Loading form dashboard…</p>:<>
      {error&&<div className="rv-error" role="alert"><p>{error}</p><button type="button" className="rv-outline focus-ring" onClick={reload}>Reload dashboard</button></div>}
      {dashboard?<>
        <dl className="rv-dashboard-stats"><div><dt>Saved views</dt><dd>{dashboard.views.length}</dd></div><div><dt>Newest snapshot cutoff</dt><dd>{newest?reportTime(newest,metadata.data.timeZone):'No saved snapshots'}</dd></div><div><dt>Workspace time zone</dt><dd>{metadata.data.timeZone}</dd></div><div><dt>Capacity</dt><dd>20 views per form</dd></div></dl>
        <div className="rv-tabs"><span aria-current="page">Saved crosstabs</span><Link className="focus-ring" to="/app/flows/$flowId/reports" params={{flowId}} search={{viewId:undefined}}>Crosstabs</Link></div>
        <p className="rv-saved-count" role="status">{dashboard.views.length} saved {dashboard.views.length===1?'crosstab':'crosstabs'}{busy?' · Saving changes…':''}</p>
        {!dashboard.views.length?<div className="rv-empty"><h2 className="display">No saved views yet</h2><p>Show a crosstab, give it a name and save the snapshot here. Saved views keep their original revision, filters and cutoff.</p><Link className="rv-primary focus-ring" to="/app/flows/$flowId/reports" params={{flowId}} search={{viewId:undefined}}>Create a crosstab</Link></div>:<div className="rv-saved-cards">{dashboard.views.map((view,index)=><SavedViewCard key={view.id} flowId={flowId} view={view} index={index} total={dashboard.views.length} timeZone={metadata.data!.timeZone} busy={busy} blocked={Boolean(error)} confirming={confirm===view.id} onMove={direction=>void move(view.id,direction)} onAskDelete={()=>setConfirm(view.id)} onKeep={()=>setConfirm(undefined)} onDelete={()=>void erase(view.id)}/>)}</div>}
      </>:!error?<p role="status">{busy?'Updating dashboard…':'Loading saved views…'}</p>:null}
    </>}
  </section>
}
