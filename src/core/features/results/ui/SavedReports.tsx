import { useEffect, useState, type FormEvent } from 'react'
import type { LedgerFilter, QuestionReport } from '../../../app/api'
import type { SavedView, SavedViewDefinition, SavedViewDetail } from '../../reporting'
import { savedReportApi } from './savedReportApi'
import { ReportFigures } from './ReportFigures'
import { ReportSharing } from './ReportSharing'
import { ReportCodeCrossing } from './ReportCodeCrossing'
import { ReportDashboards } from './ReportDashboards'
import './saved-reports.css'
export type ReportCrossSelection = { rows: string; columns: string; collectorId?: string }

export function SavedReports({ flowId, revisionId, filter, questions, crossing }: { flowId: string; revisionId: string; filter: LedgerFilter; questions: QuestionReport[]; crossing?: ReportCrossSelection }) {
  const [views, setViews] = useState<SavedView[]>([]), [opened, setOpened] = useState<SavedViewDetail>()
  const [name, setName] = useState(''), [charts, setCharts] = useState<string[]>([]), [cohorts, setCohorts] = useState<SavedViewDefinition['cohorts']>([])
  const [crosses, setCrosses] = useState<SavedViewDefinition['crosstabs']>([])
  useEffect(() => { if (crossing) setCrosses(current => current.some(item => item.rows === crossing.rows && item.columns === crossing.columns) ? current : [...current, { id: crypto.randomUUID(), rows: crossing.rows, columns: crossing.columns }]) }, [crossing])
  const [cohortName, setCohortName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { void savedReportApi.list(flowId).then(setViews).catch(reason => setError(reason.message)) }, [flowId])
  const selected = { ...filter, ...(crossing?.collectorId ? { collectorId: crossing.collectorId } : {}), revisionId, offset: undefined }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const detail = await savedReportApi.save(flowId, { name, revisionId, filter: selected, cohorts, charts, crosstabs: crosses })
      setOpened(detail); setViews(await savedReportApi.list(flowId)); setName('')
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const open = async (id: string) => { setError(''); try { setOpened(await savedReportApi.open(id)) } catch (reason) { setError((reason as Error).message) } }
  const addCohort = () => { if (!cohortName.trim()) return; setCohorts(current => [...current, { id: crypto.randomUUID(), name: cohortName.trim(), filter: selected }]); setCohortName('') }
  return <details className="panel results-card saved-reports"><summary>Saved views and dashboards</summary>
    <p>Save the current response filters and the last crossed dimensions at one evidence cutoff. Add the current selection as a comparison before changing filters.</p>
    <form className="report-form" onSubmit={save}>
      <label className="inspector-field">View name<input className="text-input" required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></label>
      <fieldset><legend>Chosen charts</legend>{questions.filter(question => question.questionType && question.distribution.length).map(question => <label key={question.id}><input type="checkbox" checked={charts.includes(question.id)} onChange={event => setCharts(current => event.target.checked ? [...current, question.id] : current.filter(id => id !== question.id))} />{question.prompt}</label>)}<p>Leave all unchecked to show every available chart.</p></fieldset>
      <button className="secondary-button focus-ring" type="submit" disabled={busy}>Save current view</button>
    </form>
    <details><summary>Compared cohorts</summary><div className="report-form"><label className="inspector-field">Comparison name<input className="text-input" maxLength={160} value={cohortName} onChange={event => setCohortName(event.target.value)} /></label><button className="quiet-button focus-ring" type="button" onClick={addCohort} disabled={!cohortName.trim()}>Add current cohort</button></div><ul className="report-list">{cohorts.map(cohort => <li key={cohort.id}><span>{cohort.name}</span><button className="quiet-button focus-ring" type="button" onClick={() => setCohorts(current => current.filter(item => item.id !== cohort.id))}>Remove cohort</button></li>)}</ul></details>
    <ReportCodeCrossing onAdd={cross => setCrosses(current => current.some(item => item.rows === cross.rows && item.columns === cross.columns) ? current : [...current, cross])} />
    <p>{crosses.length} crosstabs included</p>
    {error ? <p role="alert">{error}</p> : null}
    <ul className="report-list" aria-label="Saved views">{views.map(view => <li key={view.id}><button className="quiet-button focus-ring" type="button" onClick={() => void open(view.id)}>{view.name}</button><span className="report-provenance">Saved by {view.savedBy.name} · {view.cutoff}</span></li>)}</ul>
    {opened ? <section aria-label="Opened saved view"><p className="report-provenance">Saved by {opened.view.savedBy.name} · Threshold recorded at save: {opened.view.threshold}</p><ReportFigures report={opened.report} /><ReportSharing key={opened.view.id} viewId={opened.view.id} /></section> : null}
    <ReportDashboards flowId={flowId} views={views} />
  </details>
}
