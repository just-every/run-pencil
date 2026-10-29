import { AnalysisAttentionPanel } from './AnalysisAttentionPanel'
import { ProviderConnection } from './ProviderConnection'
import './analysis.css'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { analysisApi, stateLabels, transportLabel, when, type Policies, type ProviderStatus, type RunSummary, type UsageRow } from './analysisApi'
import { shortDay } from '../../../shared/ui/shortDate'

export function ProviderNote({ provider }: { provider: ProviderStatus }) {
  if (provider.state === 'on' && provider.transport === 'demo') return <p className="muted" style={{ margin: 0 }}>Analysis is ready to try with this workspace’s feedback. Nothing is sent to an AI provider.</p>
  if (provider.state === 'on') return <p className="muted" style={{ margin: 0 }}>Answers you select are sent to <strong>{provider.origin}</strong> ({transportLabel(provider.transport)}, model {provider.model}). {provider.costReported ? 'Each call reports its cost.' : 'This key reports usage, not cost.'}</p>
  return <div className="analysis-setup"><p style={{ margin: 0 }}><strong>{provider.state === 'off' ? 'AI is off.' : 'AI is not configured correctly.'}</strong> Connect a provider on the Analysis page before requesting analysis. Nothing is sent until configured.</p></div>
}

function PolicyForm({ policies, onSaved }: { policies: Policies; onSaved: (policies: Policies) => void }) {
  const [draft, setDraft] = useState(policies), [state, setState] = useState<{ tone: 'error' | 'success'; text: string }>()
  return <form onSubmit={event => { event.preventDefault(); analysisApi.setPolicies(draft).then(saved => { onSaved(saved); setState({ tone: 'success', text: 'Saved. New analyses use these settings; earlier ones keep theirs.' }) }).catch(reason => setState({ tone: 'error', text: reason instanceof Error ? reason.message : 'The settings could not be saved.' })) }}>
    <label className="inspector-field">Disclosure threshold (responses a theme needs before it is shown)<input className="text-input" type="number" min={1} max={1000} value={draft.disclosureThreshold} onChange={event => setDraft({ ...draft, disclosureThreshold: Number(event.target.value) })} /></label>
    <label className="analysis-questions" style={{ display: 'flex' }}><input type="checkbox" checked={draft.autorunEnabled} onChange={event => setDraft({ ...draft, autorunEnabled: event.target.checked })} /> Analyse a revision when its flow closes</label>
    <label className="inspector-field">…once it has at least this many completed responses<input className="text-input" type="number" min={1} max={100000} value={draft.autorunMinimum} onChange={event => setDraft({ ...draft, autorunMinimum: Number(event.target.value) })} /></label>
    <button className="quiet-button focus-ring" type="submit" style={{ marginTop: '1rem' }}>Save analysis settings</button>
    {state ? <p className="status-note" data-tone={state.tone} role="status" style={{ marginTop: '.8rem' }}>{state.text}</p> : null}
  </form>
}

export function AnalysisPage() {
  const [data, setData] = useState<{ timeZone: string; provider: ProviderStatus; policies: Policies; runs: RunSummary[]; usage: UsageRow[] }>(), [error, setError] = useState<string>()
  useEffect(() => { analysisApi.overview().then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'Analysis could not load.')) }, [])
  return <section aria-labelledby="analysis-title">
    <header className="dashboard-heading">
      <div><p className="eyebrow">Grounded in your responses</p><h1 className="display" id="analysis-title">Analysis</h1></div>
      <div className="builder-actions"><Link className="primary-button focus-ring" to="/app/analysis/new"><Plus aria-hidden="true" size={16} /> Request analysis</Link></div>
    </header>
    <p className="muted">An analysis reads the completed responses of one published revision and groups them into themes. Every count is recomputed by Pencil, every quote is an exact excerpt of a stored answer, and a theme with too few responses is never shown.</p>
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {!data && !error ? <p className="status-note" role="status">Loading analysis…</p> : null}
    {data ? <div className="analysis-grid">
      <section className="panel analysis-card" aria-labelledby="runs-title">
        <p className="eyebrow" id="runs-title">Analyses</p>
        {data.runs.length ? <ul className="analysis-run-list">{data.runs.map(run => <li key={run.id} className="quiet-panel">
          <Link className="focus-ring" to="/app/analysis/$runId" params={{ runId: run.id }}>{run.flowTitle} · Revision {run.revisionNumber}</Link>
          <span className="badge" data-status={run.state}>{stateLabels[run.state]}</span>
          {run.stale ? <span className="badge" data-status="queued">Stale</span> : null}
          {run.redacted ? <span className="badge">Redacted</span> : null}<p className="analysis-figure">{run.evidenceCount} responses · cutoff {when(run.evidenceCutoff, data.timeZone)}{run.trigger === 'autorun' ? ' · started when the flow closed' : ''}{run.state === 'failed' && run.errorMessage ? ` · ${run.errorMessage}` : ''}</p>
        </li>)}</ul> : <p className="muted">No analysis yet. Request one for a revision with completed responses.</p>}
      </section>
      <div style={{ display: 'grid', gap: '1.25rem', minWidth: 0 }}>
        <section className="panel analysis-card" aria-labelledby="provider-title"><p className="eyebrow" id="provider-title">Provider</p><ProviderNote provider={data.provider} /><ProviderConnection onChanged={() => { void analysisApi.overview().then(setData).catch(reason => setError(reason.message)) }} /></section><AnalysisAttentionPanel timeZone={data.timeZone}/>
        <section className="panel analysis-card" aria-labelledby="usage-title">
          <p className="eyebrow" id="usage-title">Usage by day and feature ({data.timeZone})</p>
          {data.usage.length ? <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Usage table" className="focus-ring"><table className="analysis-table"><thead><tr><th>Day</th><th>Feature</th><th>Calls</th><th>Tokens in / out</th><th>Cost</th></tr></thead>
            <tbody>{data.usage.map(row => <tr key={`${row.day}:${row.feature}`}><td>{shortDay(row.day)}</td><td>{row.feature}</td><td>{row.calls}</td><td>{row.inputTokens?.toLocaleString() ?? 'Unknown'} / {row.outputTokens?.toLocaleString() ?? 'Unknown'}{row.unknownInputCalls || row.unknownOutputCalls ? ' + unreported usage' : ''}</td><td>{row.costMicrousd === null ? 'Not reported' : `US$${(row.costMicrousd / 1_000_000).toFixed(4)}${row.unreportedCalls ? ` + ${row.unreportedCalls} unreported` : ''}`}</td></tr>)}</tbody></table></div>
            : <p className="muted">No provider call yet.</p>}
        </section>
        <section className="panel analysis-card" aria-labelledby="policy-title"><p className="eyebrow" id="policy-title">Settings</p><PolicyForm policies={data.policies} onSaved={policies => setData({ ...data, policies })} /></section>
      </div>
    </div> : null}
  </section>
}
