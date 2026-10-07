import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type BuilderDraft } from '../../../app/api'
import { answerIssue, isUnanswered } from '../../../shared/answers'
import { visiblePath } from '../../../shared/flowPath'
import { QuestionInput } from '../../../shared/ui/QuestionInput'

type Trace = Awaited<ReturnType<typeof api.previewDraft>>
export function DraftPreview({ draft, onClose, onReload, reloadDisabled = false }: { draft: BuilderDraft; onClose: () => void; onReload: () => void; reloadDisabled?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [trace, setTrace] = useState<Trace>()
  const [error, setError] = useState<string>()
  const [checking, setChecking] = useState(false)
  const [stale, setStale] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const path = useMemo(() => visiblePath(draft, answers), [draft, answers])
  const step = path[Math.min(index, path.length - 1)]
  const choices = draft.choices.filter((choice) => choice.stepId === step?.id)
  const inspect = async () => {
    if (pending.current || stale) return false
    pending.current = true; setChecking(true); setError(undefined); setTrace(undefined)
    try {
      const result = await api.previewDraft(draft.flow.id, answers)
      if (!mounted.current) return false
      if (result.draftVersion !== draft.flow.draftVersion) {
        setStale(true); setError('Another operator changed this draft. Reload it before continuing the preview.')
        return false
      }
      setTrace(result)
      return true
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Preview evaluation failed.')
      return false
    } finally { pending.current = false; if (mounted.current) setChecking(false) }
  }
  const next = async () => {
    setError(undefined)
    if (!step) return
    if (step.kind === 'question') {
      const issue = answerIssue(step, choices.map((choice) => choice.id), answers[step.id])
      if (issue) { setError(issue); return }
    }
    if (!path[index + 1]) { setError('Connect a default path or matching rule before continuing.'); await inspect(); return }
    if (await inspect()) setIndex((current) => current + 1)
  }
  return <section className="panel" aria-label="Draft preview" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
    <header className="toggle-row"><div><p className="eyebrow">Preview · draft v{draft.flow.draftVersion}</p><p className="muted">Test answers stay in this preview. No responses, counters or external effects.</p></div><button className="quiet-button" type="button" onClick={onClose}>Close preview</button></header>
    {step ? <div className="preview-surface"><p className="eyebrow">{step.kind}</p><h2 className="display">{step.prompt}</h2>{step.helperText ? <p>{step.helperText}</p> : null}{step.kind === 'question' ? <fieldset disabled={checking || stale} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><QuestionInput step={step} choices={choices} value={answers[step.id]} onChange={(value) => {
      if (pending.current || stale) return
      setTrace(undefined); setError(undefined)
      const next = { ...answers, [step.id]: value }
      const reachable = new Set(visiblePath(draft, next).map((entry) => entry.id))
      setAnswers(Object.fromEntries(Object.entries(next).filter(([id, answer]) => reachable.has(id) && !isUnanswered(answer))))
    }} /></fieldset> : null}<div className="builder-actions" style={{ marginTop: '1rem' }}><button className="quiet-button" type="button" disabled={index === 0 || checking || stale} onClick={() => { setIndex((current) => current - 1); setError(undefined) }}>Back in preview</button>{step.kind !== 'completion' ? <button className="primary-button" type="button" disabled={checking || stale} onClick={next}>Continue preview</button> : <strong>Preview complete</strong>}<button className="quiet-button" disabled={checking || stale} onClick={() => void inspect()} type="button">{checking ? 'Checking path…' : 'Inspect answer path'}</button></div></div> : <p>Add a first screen to preview this draft.</p>}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {stale ? <button className="secondary-button focus-ring" disabled={reloadDisabled} type="button" onClick={onReload}>Reload draft</button> : null}
    {trace ? <section aria-label="Preview rule evaluations"><h3>Evaluated path</h3><ol>{trace.screens.map((screen) => <li key={screen.stepId}><strong>{draft.steps.find((entry) => entry.id === screen.stepId)?.prompt}</strong><ul>{screen.evaluations.map((rule, order) => <li key={rule.ruleId}>Rule {order + 1}: {rule.matched ? 'matches' : 'does not match'} → {draft.steps.find((entry) => entry.id === rule.destinationStepId)?.prompt}{rule.ruleId === screen.selectedRuleId ? ' · chosen' : ''}</li>)}</ul><p className="muted">{screen.selectedRuleId ? 'First matching rule' : screen.nextStepId ? 'Default path' : 'Completion'}{screen.nextStepId ? ` → ${draft.steps.find((entry) => entry.id === screen.nextStepId)?.prompt}` : ''}</p></li>)}</ol>{!trace.complete ? <p role="alert">{trace.reason}</p> : null}</section> : null}
  </section>
}
