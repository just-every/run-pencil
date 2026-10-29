import type { FlowResults } from '../../../app/api'
function duration(milliseconds:number) {
  if (milliseconds < 60000) return `${Math.round(milliseconds / 1000)}s`
  const minutes = Math.round(milliseconds / 60000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}
export function ResultMetrics({results}:{results:FlowResults}) {
  const filtered = results.rateBasis === 'responses'
  // A rate needs every completion counted among its starts or views, and an average needs recorded durations; otherwise the figure has no samples to show.
  const rate = results.rateDenominator > 0 && results.rateNumerator <= results.rateDenominator
  const timed = results.durationSamples > 0 && results.totalCompletionMilliseconds > 0
  return <>
    <p className="eyebrow results-metrics-label">Session metrics</p>
    <div className="results-grid results-summary">
      <article className="panel metric-card"><span className="muted">Responses</span><strong>{results.completedResponses}</strong><span className="muted">{results.liveCompletedResponses} live · {results.importedResponses} imported</span></article>
      <article className="panel metric-card"><span className="muted">Starts</span><strong>{results.starts}</strong><span className="muted">{filtered ? 'filtered native response starts' : 'recorded starts in this selection'}</span></article>
      <article className="panel metric-card"><span className="muted">Completion rate</span><strong>{rate ? `${Math.round(results.completionRate * 100)}%` : 'No samples'}</strong><span className="muted">{results.rateNumerator} native completions / {results.rateDenominator} {filtered ? 'filtered native response starts' : 'views'} in this selection</span></article>
      <article className="panel metric-card"><span className="muted">Average time</span><strong>{timed ? duration(results.averageCompletionMilliseconds) : 'No samples'}</strong><span className="muted">{results.totalCompletionMilliseconds}ms total / {results.durationSamples} native completed responses</span></article>
    </div>
    <p className="muted">{filtered ? `Started-to-completed among filtered responses. View-based rates are unfiltered by response filters; ${results.views} views belong to the selected revision and date range.` : 'View-based completion uses native completions and views from the same revision and date selection.'} Imported completions remain in completed counts and answers; they do not create native starts, rate numerators or duration samples.</p>
    <details className="results-scope"><summary>How we count</summary><p className="muted">Summary scope: {results.allRevisions ? 'all published revisions' : `revision ${results.revision.number}`}, combined with the response filters below. Every numerator and denominator uses this selection. Response filters can select only retained responses, so started-to-completed includes matching released and quarantined native responses; sessions without a response cannot be matched by an answer. With revision or date only, views and starts include sessions without a response. Each question version keeps its own labels and answers.</p></details>
  </>
}
