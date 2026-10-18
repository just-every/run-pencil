import { interpolateAnswerRecall } from '../../../shared/answerRecall'
import { BrandIdentity } from '../../brand'
import { brandApi } from '../../brand'
import { publicBrandConfig, brandStyle } from '../../brand'
import type { PublicSeedConfig } from '../../../shared/config'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type BuilderDraft } from '../../../app/api'
import { answerIssue, isUnanswered } from '../../../shared/answers'
import { visiblePath } from '../../../shared/flowPath'
import { QuestionInput } from '../../../shared/ui/QuestionInput'

type Trace = Awaited<ReturnType<typeof api.previewDraft>>
export function DraftPreview({ draft, onClose, onReload, reloadDisabled = false }: { draft: BuilderDraft; onClose: () => void; onReload: () => void; reloadDisabled?: boolean }) {
  const [brand, setBrand] = useState<PublicSeedConfig>()
  const [brandError, setBrandError] = useState<string>()
  useEffect(() => { void brandApi.get().then(value => setBrand(publicBrandConfig(value, { productName: 'Pencil', organizationName: '', showPoweredByCredit: false }))).catch(e => setBrandError((e as Error).message)) }, [])
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
  const recall = (text: string) => step ? interpolateAnswerRecall(text, draft, answers, step.id) : text
  const displayedStep = step ? { ...step, prompt: recall(step.prompt) } : undefined
  const choices = draft.choices.filter((choice) => choice.stepId === step?.id).map(choice => ({ ...choice, label: recall(choice.label) }))
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
      const issue = answerIssue(displayedStep!, choices.map((choice) => choice.id), answers[step.id])
      if (issue) { setError(issue); return }
    }
    if (!path[index + 1]) { setError('Connect a default path or matching rule before continuing.'); await inspect(); return }
    if (await inspect()) setIndex((current) => current + 1)
  }
  return <section className="panel draft-preview" aria-label="Draft preview">
    <header className="toggle-row"><div><p className="eyebrow">Preview</p><p className="muted">Try your questions here. Preview answers are not collected.</p></div><button className="quiet-button" type="button" onClick={onClose}>Close preview</button></header>
    {brandError ? <p role="alert">{brandError}</p> : null}
    {step ? <div className="preview-surface brand-surface" style={brand ? brandStyle(brand) : undefined}>{brand ? <BrandIdentity config={brand} /> : null}<p className="eyebrow">{step.kind}</p><h2 className="display">{recall(step.prompt)}</h2>{step.helperText ? <p>{recall(step.helperText)}</p> : null}{step.kind === 'question' && step.required ? <p>Required</p> : null}{step.kind === 'question' ? <fieldset className="plain-fieldset" disabled={checking || stale}><QuestionInput key={step.id} step={displayedStep!} choices={choices} value={answers[step.id]} onChange={(value) => {
      if (pending.current || stale) return
      setTrace(undefined); setError(undefined)
      const next = { ...answers, [step.id]: value }
      const reachable = new Set(visiblePath(draft, next).map((entry) => entry.id))
      setAnswers(Object.fromEntries(Object.entries(next).filter(([id, answer]) => reachable.has(id) && !isUnanswered(answer))))
    }} /></fieldset> : null}<div className="builder-actions draft-preview-actions"><button className="quiet-button" type="button" disabled={index === 0 || checking || stale} onClick={() => { setIndex((current) => current - 1); setError(undefined) }}>Back in preview</button>{step.kind !== 'completion' ? <button className="primary-button" type="button" disabled={checking || stale} onClick={next}>Continue preview</button> : <strong>Preview complete</strong>}<button className="quiet-button" disabled={checking || stale} onClick={() => void inspect()} type="button">{checking ? 'Checking path…' : 'Inspect answer path'}</button></div></div> : <p>Add a first screen to preview this draft.</p>}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
    {stale ? <button className="secondary-button focus-ring" disabled={reloadDisabled} type="button" onClick={onReload}>Reload draft</button> : null}
    {trace ? <section className="quiet-panel draft-trace" aria-label="Preview rule evaluations"><h3>Evaluated path</h3><ol>{trace.screens.map((screen) => <li key={screen.stepId}><strong>{draft.steps.find((entry) => entry.id === screen.stepId)?.prompt}</strong><ul>{screen.evaluations.map((rule, order) => <li key={rule.ruleId}>Rule {order + 1}: {rule.matched ? 'matches' : 'does not match'} → {draft.steps.find((entry) => entry.id === rule.destinationStepId)?.prompt}{rule.ruleId === screen.selectedRuleId ? ' · chosen' : ''}</li>)}</ul><p className="muted">{screen.selectedRuleId ? 'First matching rule' : screen.nextStepId ? 'Default path' : 'Completion'}{screen.nextStepId ? ` → ${draft.steps.find((entry) => entry.id === screen.nextStepId)?.prompt}` : ''}</p></li>)}</ol>{!trace.complete ? <p role="alert">{trace.reason}</p> : null}</section> : null}
  </section>
}
