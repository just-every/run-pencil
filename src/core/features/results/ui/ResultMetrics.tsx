import type { FlowResults } from '../../../app/api'
function duration(milliseconds:number) {
  if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`
  const minutes = Math.round(milliseconds / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}
const counted = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`
export function ResultMetrics({results}:{results:FlowResults}) {
  const filtered = results.rateBasis === 'responses'
  return <>
    <p className="eyebrow results-metrics-label">Session metrics</p>
    <div className="results-grid results-summary">
      <article className="panel metric-card"><span className="muted">Responses</span><strong>{results.completedResponses}</strong><span className="muted">{results.liveCompletedResponses} live · {results.importedResponses} imported</span></article>
      <article className="panel metric-card"><span className="muted">Starts</span><strong>{results.starts}</strong><span className="muted">{filtered ? 'filtered starts' : 'recorded starts in this selection'}</span></article>
      <article className="panel metric-card"><span className="muted">Completion rate</span><strong>{results.rateDenominator ? `${Math.round(results.completionRate * 100)}%` : 'No rate'}</strong><span className="muted">{counted(results.rateNumerator, 'completion')} / {counted(results.rateDenominator, filtered ? 'filtered start' : 'view')} in this selection</span></article>
      <article className="panel metric-card"><span className="muted">Average time</span><strong>{duration(results.averageCompletionMilliseconds)}</strong><span className="muted">{results.totalCompletionMilliseconds}ms total / {counted(results.durationSamples, 'completed response')}</span></article>
    </div>
    <p className="muted">{filtered ? `Started-to-completed among filtered responses. View-based rates are unfiltered by response filters; ${results.views} views belong to the selected revision and date range.` : 'Completion uses the completions and views of the same revision and dates.'} Imported responses count as responses and keep their answers, but add no starts, completions in the rate or time samples.</p>
    <details className="results-scope"><summary>How we count</summary><p className="muted">Summary scope: {results.allRevisions ? 'all published revisions' : `revision ${results.revision.number}`}, combined with the response filters below. Every count uses this selection. Response filters can select only retained responses, so started-to-completed includes matching released and quarantined responses; sessions without a response cannot be matched by an answer. With revision or date only, views and starts include sessions without a response. Each question version keeps its own labels and answers.</p></details>
  </>
}
