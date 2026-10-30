import './analysis.css'
import { Fragment, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, RotateCcw, TriangleAlert } from 'lucide-react'
import { analysisApi, costLabel, providerParts, stateLabels, transportLabel, when, type RunDetail, type ThemeResponses, type ThemeView } from './analysisApi'
import { LoadProblem, loadFailure, type LoadFailure } from '../../../app/ui/LoadProblem'

type Shown = Extract<ThemeView, { withheld: false }>

function FindingDecision({decision,busy,onDecide}:{decision?:'accepted'|'dismissed';busy:boolean;onDecide:(decision:'accepted'|'dismissed')=>void}) {
  return <div className="builder-actions" aria-label="Finding decision"><span>{decision ? `Decision: ${decision}` : 'Awaiting your review'}</span><button type="button" className="secondary-button focus-ring" disabled={busy} onClick={()=>onDecide('accepted')}>Accept finding</button><button type="button" className="quiet-button focus-ring" disabled={busy} onClick={()=>onDecide('dismissed')}>Dismiss finding</button></div>
}

/** ANLY-011: the retained responses behind a finding, with the answers the run read. */
function Responses({ runId, theme, focus }: { runId: string; theme: Shown; focus?: string }) {
  const [responses, setResponses] = useState<ThemeResponses>(), [error, setError] = useState<string>()
  useEffect(() => { analysisApi.themeResponses(runId, theme.id).then(setResponses).catch(reason => setError(reason instanceof Error ? reason.message : 'Responses could not load.')) }, [runId, theme.id])
  useEffect(() => { if (focus && responses) document.getElementById(`response-${focus}`)?.scrollIntoView({ block: 'nearest' }) }, [focus, responses])
  return <section className="analysis-responses" aria-label={`Responses behind theme ${theme.rank}`}>
    <h3>The {theme.count} responses behind theme {theme.rank}</h3>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {!responses && !error ? <p className="status-note" role="status">Loading responses…</p> : null}
    {responses ? <ol>{responses.responses.map(response => <li key={response.id} id={`response-${response.id}`} data-focused={response.id === focus}>
      <p className="analysis-figure" style={{ marginTop: 0 }}>{response.source === 'imported' ? 'Imported' : 'Completed'} {when(response.completedAt, responses.timeZone)}</p>
      {response.answers.map(answer => <p key={answer.questionId} style={{ margin: '.4rem 0 0' }}><span className="muted">{answer.prompt}: </span>{answer.text}</p>)}
    </li>)}</ol> : null}
    <p style={{ marginTop: '.8rem' }}><Link className="analysis-link" to="/app/flows/$flowId/results" params={{ flowId: responses?.flowId ?? '' }} disabled={!responses}>Open the flow's results and ledger</Link></p>
  </section>
}

function ThemeBody({ runId, theme, open, focus, onOpen }: { runId: string; theme: Shown; open: boolean; focus?: string; onOpen: (focus?: string) => void }) {
  return <>
    {theme.summary ? <><p className="analysis-label">Analysis</p><p className="muted" style={{ margin: 0 }}>{theme.summary}</p></> : null}
    {theme.quotes.length ? <ul className="analysis-quotes" aria-label="Exact excerpts">{theme.quotes.map(quote => <li key={quote.id}>
      <blockquote>“{quote.excerpt}”</blockquote>
      <button className="analysis-link focus-ring" type="button" onClick={() => onOpen(quote.responseId)}>See this response</button>
    </li>)}</ul> : null}
    <hr className="analysis-divider" />
    <button className="analysis-link focus-ring" type="button" aria-expanded={open} onClick={() => onOpen()}>See the {theme.count} responses <ArrowRight aria-hidden="true" size={14} style={{ verticalAlign: 'middle' }} /></button>
    {open ? <Responses runId={runId} theme={theme} focus={focus} /> : null}
  </>
}

export function FindingsPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunDetail>(), [error, setError] = useState<string>(), [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<{ theme: string; focus?: string }>(), [missing, setMissing] = useState<LoadFailure>()
  useEffect(() => { analysisApi.get(runId).then(setRun).catch(reason => { const failure = loadFailure(reason, 'This analysis could not load.'); if (failure.notFound) setMissing(failure); else setError(failure.message) }) }, [runId])
  useEffect(() => {
    if (!run || !['queued', 'running'].includes(run.state)) return
    const timer = setTimeout(() => analysisApi.get(runId).then(setRun).catch(() => {}), 5000)
    return () => clearTimeout(timer)
  }, [run, runId])
  const retry = () => { setBusy(true); setError(undefined); analysisApi.retry(runId).then(setRun).catch(reason => setError(reason instanceof Error ? reason.message : 'The retry failed.')).finally(() => setBusy(false)) }
  const decide = async (id:string,decision:'accepted'|'dismissed') => { setBusy(true); setError(undefined); try {setRun(await analysisApi.decide(runId,id,decision))} catch(error) {setError(error instanceof Error ? error.message : 'Decision could not save.')} finally {setBusy(false)} }
  if (!run) return <section>{missing ? <LoadProblem message={missing.message} notFound /> : error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : <p className="status-note" role="status">Loading analysis…</p>}</section>
  const shown = run.themes.filter((theme): theme is Shown => !theme.withheld)
  const primary = shown.find(theme => theme.primary), others = run.themes.filter(theme => theme !== primary)
  const title = run.state === 'completed' ? `What ${run.evidenceCount} responses say` : run.state === 'insufficient_evidence' ? 'Not enough evidence for a finding' : run.state === 'failed' ? 'This analysis failed' : 'Analysis in progress'
  const toggle = (theme: Shown) => (focus?: string) => setOpen(current => current?.theme === theme.id && !focus ? undefined : { theme: theme.id, focus })
  return <section aria-labelledby="findings-title">
    <header className="page-heading">
      <div className="builder-actions"><Link className="quiet-button focus-ring" to="/app/analysis"><ArrowLeft aria-hidden="true" size={15} /> All analyses</Link></div>
      <p className="eyebrow">Analysis · {run.flowTitle} · Revision {run.revisionNumber}</p>
      <h1 className="display" id="findings-title">{title}</h1>
      <p className="analysis-status">
        <span className="badge" data-status={run.state}>{stateLabels[run.state]}</span>
        <span>Evidence cutoff {when(run.evidenceCutoff, run.timeZone)}</span><span aria-hidden="true">·</span><span>{run.evidenceCount} responses read</span>
        {run.providerOrigin ? providerParts(run).map(part => <Fragment key={part}><span aria-hidden="true">·</span><span>{part}</span></Fragment>) : null}
      </p>
      {run.stale ? <p className="analysis-stale"><TriangleAlert aria-hidden="true" size={15} /> Stale{run.redacted ? ' after erasure' : ''}: {run.staleResponses} {run.staleResponses === 1 ? 'response arrived' : 'responses arrived'} after the cutoff. <Link to="/app/analysis/new" search={{ flowId: run.flowId, revisionId: run.revisionId }}>Run a new analysis</Link></p> : null}
      {run.redacted ? <p className="status-note" style={{ marginTop: '.8rem' }}>A response this analysis read was erased afterwards. It is no longer counted or quoted, and text that may have described it is withheld.</p> : null}
    </header>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {run.state === 'failed' || (run.state === 'queued' && !run.nextAttemptAt) ? <section className="panel analysis-card" aria-labelledby="failure-title" style={{ marginTop: '1.4rem' }}>
      <p className="eyebrow">{run.state === 'failed' ? 'Failed' : 'Not started'}</p>
      <h2 id="failure-title">{run.errorMessage ?? 'This analysis was restored before it ran.'}</h2>
      <p className="muted">No finding, quote or recommendation was made{run.errorCode ? <> · <code>{run.errorCode}</code></> : null}. Publishing, collecting, results and exports keep working.</p>
      <button className="primary-button focus-ring" type="button" style={{ marginTop: '.9rem' }} disabled={busy} onClick={retry}><RotateCcw aria-hidden="true" size={15} /> {busy ? 'Retrying…' : 'Retry'}</button>
    </section> : null}
    {run.state === 'queued' && run.nextAttemptAt ? <p className="status-note" role="status" style={{ marginTop: '1.4rem' }}>The provider did not answer ({run.errorMessage}). Pencil retries the same request at {when(run.nextAttemptAt, run.timeZone)}; attempt {run.attempts} of 4.</p> : null}
    {run.state === 'running' ? <p className="status-note" role="status" style={{ marginTop: '1.4rem' }}>Pencil is waiting for the provider’s answer.</p> : null}
    {run.state === 'insufficient_evidence' ? <section className="panel analysis-card" style={{ marginTop: '1.4rem' }} aria-labelledby="insufficient-title">
      <p className="eyebrow">Insufficient evidence</p><h2 id="insufficient-title">No theme, quote or recommendation</h2>
      <p className="muted">{run.insufficientReason}</p>
    </section> : null}
    {run.state === 'completed' ? <div className="analysis-grid">
      {primary ? <section className="panel analysis-card" data-primary="true" aria-labelledby="primary-title">
        <p className="eyebrow">Primary finding</p>
        <div className="analysis-theme-heading"><span className="analysis-rank">{primary.rank}</span><div><h2 id="primary-title" style={{ marginTop: 0 }}>{primary.title}</h2><p className="analysis-figure">{primary.count} of {run.evidenceCount} responses · {primary.percentage}%</p></div></div>
        <FindingDecision decision={run.decisions?.[primary.id]} busy={busy} onDecide={decision=>{void decide(primary.id,decision)}} />
        <ThemeBody runId={run.id} theme={primary} open={open?.theme === primary.id} focus={open?.focus} onOpen={toggle(primary)} />
      </section> : null}
      {run.recommendation ? <section className="panel analysis-card" aria-labelledby="recommendation-title">
        <p className="eyebrow">Recommendation</p>
        <h2 id="recommendation-title">{run.recommendation.title}</h2>
        {run.recommendation.rationale ? <><p className="analysis-label">Analysis</p><p className="muted" style={{ margin: 0 }}>{run.recommendation.rationale}</p></> : null}
        <div className="analysis-chips"><span className="analysis-chip">Confidence: {run.recommendation.confidence}</span><span className="analysis-chip">Expected impact: {run.recommendation.expectedImpact}</span><span className="analysis-chip">Effort: {run.recommendation.effort}</span></div>
        <p className="analysis-label">Linked findings</p>
        <div className="analysis-chips" style={{ marginTop: 0 }}>{run.recommendation.themes.map(rank => <span key={rank} className="analysis-chip">Theme {rank}</span>)}</div>
        <p className="analysis-figure">Based on {run.recommendation.responseIds.length} responses.</p>
        {run.recommendation.actionIds.length ? <p style={{ marginTop: '1rem' }}>Action created: {run.recommendation.actionIds.map(id => <Link key={id} className="analysis-link" to="/app/actions/$actionId" params={{ actionId: id }}>open the action</Link>)}</p> : null}
        <Link className="primary-button focus-ring" style={{ marginTop: '1.1rem', width: 'fit-content' }} to="/app/actions/new" search={{ flowId: run.flowId, revisionId: run.revisionId, analysisId: run.id }}><ArrowRight aria-hidden="true" size={15} /> Turn this into an action</Link>
        <p className="analysis-figure">Creates a planned action you own. Nobody is contacted.</p>
      </section> : <section className="panel analysis-card"><p className="eyebrow">Recommendation</p><p className="muted">This analysis proposes no action.</p></section>}
      <section className="panel analysis-card" aria-labelledby="themes-title">
        <p className="eyebrow" id="themes-title">Other themes</p>
        {others.length ? <ul className="analysis-themes">{others.map(theme => <li key={theme.id}>
          {theme.withheld ? <p className="analysis-withheld" style={{ margin: 0 }}><span className="analysis-rank">{theme.rank}</span>Theme {theme.rank} withheld: fewer than {run.policy.disclosure.threshold} responses (disclosure threshold {run.policy.disclosure.threshold})</p>
            : <><button className="analysis-theme-row focus-ring" type="button" aria-expanded={open?.theme === theme.id} onClick={() => toggle(theme)()}><span className="analysis-rank">{theme.rank}</span><span>{theme.title}</span><span className="analysis-figure">{theme.count} of {run.evidenceCount} · {theme.percentage}%</span></button>
              <FindingDecision decision={run.decisions?.[theme.id]} busy={busy} onDecide={decision=>{void decide(theme.id,decision)}} />
              {open?.theme === theme.id ? <ThemeBody runId={run.id} theme={theme} open focus={open.focus} onOpen={toggle(theme)} /> : null}</>}
        </li>)}</ul> : <p className="muted">No other theme.</p>}
      </section>
      {run.contradictions ? <section className="panel analysis-card" aria-label="Contradictions"><h2>Contradictions</h2><p>Analysis to review against the cited evidence.</p>{run.contradictions.map(item=><article key={item.id} aria-label={item.summary}><h3>{item.summary}</h3>{item.sides.map((side,index)=><section key={index}><h4>{side.cohort} · {side.responseIds.length} responses</h4>{side.quotes.map((quote,index)=><blockquote key={index}>{quote.text}<p className="analysis-figure">Response {quote.responseId}</p></blockquote>)}</section>)}<FindingDecision decision={item.decision} busy={busy} onDecide={decision=>{void decide(item.id,decision)}} /></article>)}{run.suppressedContradictions ? <p>{run.suppressedContradictions} contradictions withheld below the disclosure threshold.</p> : null}</section> : null}
      <RunFacts run={run} />
    </div> : <div style={{ marginTop: '1.25rem' }}><RunFacts run={run} /></div>}
  </section>
}

function RunFacts({ run }: { run: RunDetail }) {
  return <section className="panel analysis-card" aria-labelledby="run-title">
    <p className="eyebrow" id="run-title">This run</p>
    <dl className="analysis-facts">
      <dt>Questions read</dt><dd>{run.questions.map(question => question.prompt).join('; ') || '—'}</dd>
      <dt>Sent to</dt><dd>{run.calls.some(call => call.provider === 'demo') ? 'Demo analysis; nothing was sent to a provider' : run.providerOrigin ? <>{new URL(run.providerOrigin.split(' ')[0]).host}: only these answers and response IDs</> : 'Nothing was sent'}</dd>
      <dt>Cost</dt><dd>{run.calls.length ? costLabel(run.calls) : 'No provider call'}</dd>
      <dt>Finished</dt><dd>{run.finishedAt ? when(run.finishedAt,run.timeZone) : 'Not finished'}</dd>
      <dt>Provider calls</dt><dd>{run.calls.length ? <ul>{run.calls.map((call,index)=><li key={index}>{when(call.createdAt,run.timeZone)} · {call.outcome} · {costLabel([call])}</li>)}</ul> : 'No provider calls'}</dd>
      <dt>Policies</dt><dd>Disclosure threshold {run.policy.disclosure.threshold} · highest-impact recommendation</dd>
      <dt>Requested</dt><dd>{run.trigger === 'autorun' ? 'Automatically when the flow closed' : 'By a team member'} · {when(run.createdAt, run.timeZone)}</dd>
    </dl>
  </section>
}
