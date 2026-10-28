import { useEffect, useState, type FormEvent } from 'react'
import type { SavedDashboard, SavedView, SavedViewDetail } from '../../reporting/savedModel'
import { savedReportApi } from './savedReportApi'
import { ReportFigures } from './ReportFigures'

export function ReportDashboards({ flowId, views }: { flowId: string; views: SavedView[] }) {
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]), [selected, setSelected] = useState<SavedDashboard>()
  const [name, setName] = useState(''), [scope, setScope] = useState<'form' | 'program'>('form'), [viewIds, setViewIds] = useState<string[]>([])
  const [reports, setReports] = useState<SavedViewDetail[]>([]), [error, setError] = useState('')
  useEffect(() => { void savedReportApi.dashboards().then(setDashboards).catch(reason => setError(reason.message)) }, [])
  const open = async (id: string) => {
    setError('')
    try { const result = await savedReportApi.dashboard(id); setSelected(result.dashboard); setName(result.dashboard.name); setScope(result.dashboard.scope); setViewIds(result.dashboard.viewIds); setReports(result.views) } catch (reason) { setError((reason as Error).message) }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try { const dashboard = await savedReportApi.arrange(selected?.id ?? '', { name, scope, ...(scope === 'form' ? { flowId } : {}), viewIds }); setDashboards(await savedReportApi.dashboards()); await open(dashboard.id) } catch (reason) { setError((reason as Error).message) }
  }
  const move = (index: number, change: number) => setViewIds(current => { const next = [...current]; [next[index], next[index + change]] = [next[index + change], next[index]]; return next })
  return <details><summary>Arrange a dashboard</summary>
    <ul className="report-list">{dashboards.filter(item => item.scope === 'program' || item.flowId === flowId).map(item => <li key={item.id}><button className="quiet-button focus-ring" type="button" onClick={() => void open(item.id)}>{item.name}</button><span>{item.scope === 'program' ? 'Program' : 'Form'} dashboard · {item.viewIds.length} views</span></li>)}</ul>
    <form className="report-form" onSubmit={save}>
      <label className="inspector-field">Dashboard name<input className="text-input" required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="inspector-field">Dashboard scope<select className="text-input" value={scope} onChange={event => setScope(event.target.value as 'form' | 'program')}><option value="form">This form</option><option value="program">Program</option></select></label>
      <fieldset><legend>Views in this dashboard</legend>{views.map(view => <label key={view.id}><input type="checkbox" checked={viewIds.includes(view.id)} onChange={event => setViewIds(current => event.target.checked ? [...current, view.id] : current.filter(id => id !== view.id))} />{view.name}</label>)}</fieldset>
      <button className="secondary-button focus-ring" type="submit">Save dashboard</button>
      {selected ? <button className="quiet-button focus-ring" type="button" onClick={() => { setSelected(undefined); setName(''); setViewIds([]); setReports([]) }}>New dashboard</button> : null}
    </form>
    <ol className="report-list">{viewIds.map((id, index) => <li key={id}><span>{views.find(view => view.id === id)?.name ?? reports.find(item => item.view.id === id)?.view.name ?? 'Saved view'}</span><button className="quiet-button focus-ring" type="button" aria-label={`Move view ${index + 1} earlier`} disabled={!index} onClick={() => move(index, -1)}>Move earlier</button><button className="quiet-button focus-ring" type="button" aria-label={`Move view ${index + 1} later`} disabled={index === viewIds.length - 1} onClick={() => move(index, 1)}>Move later</button></li>)}</ol>
    {error ? <p role="alert">{error}</p> : null}
    {reports.map(item => <ReportFigures key={item.view.id} report={item.report} />)}
  </details>
}
