import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type BranchRule, type BuilderDraft, type FlowStep } from '../../../app/api'

type Rule = Omit<BranchRule, 'id'> & { id?: string }
const comparisons = [ ['equals', 'is'], ['greater_than', 'is greater than'], ['greater_than_or_equal', 'is at least'], ['less_than', 'is less than'], ['less_than_or_equal', 'is at most'] ] as const

export function BranchEditor({ draft, step, onSaved, onError, onDirty, disabled = false, onSavingChange }: { disabled?: boolean; onSavingChange: (saving: boolean) => void; draft: BuilderDraft; step: FlowStep; onSaved: () => Promise<void>; onDirty: (dirty: boolean) => void; onError: (message: string) => void }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { onSavingChange(saving); return () => { onSavingChange(false) } }, [saving, onSavingChange])
  const choices = draft.choices.filter((choice) => choice.stepId === step.id)
  const destinations = draft.steps.filter((candidate) => candidate.id !== step.id && candidate.kind !== 'welcome')
  useEffect(() => { setRules(draft.branchRules.filter((rule) => rule.sourceStepId === step.id).sort((a, b) => a.position - b.position)) }, [draft, step.id])
  useEffect(() => {
    const persisted = draft.branchRules.filter((rule) => rule.sourceStepId === step.id).sort((a, b) => a.position - b.position)
    const normalize = (items: Rule[]) => items.map((rule, position) => ({ ...rule, position }))
    onDirty(saving || JSON.stringify(normalize(rules)) !== JSON.stringify(normalize(persisted)))
  }, [rules, draft, step.id, onDirty, saving])
  if (!['single_choice', 'multiple_choice', 'rating', 'priority'].includes(step.questionType ?? '')) return null
  const update = (index: number, change: Partial<Rule>) => setRules((current) => current.map((rule, position) => position === index ? { ...rule, ...change } : rule))
  const move = (index: number, delta: number) => setRules((current) => {
    const result = [...current]; [result[index], result[index + delta]] = [result[index + delta], result[index]]; return result
  })
  const add = () => setRules((current) => [...current, { sourceStepId: step.id, destinationStepId: destinations[0]?.id ?? '', position: current.length, predicateKind: step.questionType === 'multiple_choice' ? 'any_of' : 'equals', expectedValue: step.questionType === 'rating' ? 1 : step.questionType === 'priority' ? choices.map((choice) => choice.id) : step.questionType === 'multiple_choice' ? [] : choices[0]?.id ?? '' }])
  const save = async () => {
    setSaving(true)
    try {
      const result = await api.saveBranchRules(draft.flow.id, { expectedVersion: draft.flow.draftVersion, rules: [...draft.branchRules.filter((rule) => rule.sourceStepId !== step.id), ...rules.map((rule, position) => ({ ...rule, position }))] })
      if (result.kind === 'conflict') onError(`Another operator saved first (draft v${result.latestVersion}). Reload before saving your rules.`)
      else await onSaved()
    } catch (error) { onError(error instanceof Error ? error.message : 'Branches could not be saved.') } finally { setSaving(false) }
  }
  return <section className="branch-editor" aria-label="Branch rules"><fieldset disabled={saving || disabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <h2>Answer paths</h2><p className="muted">First matching rule wins, in this order. Otherwise use the default next screen.</p>
    {rules.map((rule, index) => <fieldset className="quiet-panel" key={rule.id ?? index} style={{ padding: '.75rem', margin: '.75rem 0' }}><legend>Rule {index + 1}</legend>
      <label className="inspector-field">Match<select className="text-input" value={rule.predicateKind} onChange={(event) => {
        const predicateKind = event.target.value as BranchRule['predicateKind']
        update(index, { predicateKind, ...(step.questionType === 'priority' ? { expectedValue: predicateKind === 'equals' ? choices.map((choice) => choice.id) : { choiceId: choices[0]?.id ?? '', rank: 1 } } : {}) })
      }}>{(step.questionType === 'single_choice' ? comparisons.slice(0, 1) : step.questionType === 'multiple_choice' ? [['any_of', 'contains any of'], ['all_of', 'contains all of']] : comparisons).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {step.questionType === 'single_choice' ? <label className="inspector-field">Answer<select aria-label="Answer" className="text-input" value={String(rule.expectedValue)} onChange={(event) => update(index, { expectedValue: event.target.value })}><option value="">Choose an answer</option>{choices.map((choice) => <option value={choice.id} key={choice.id}>{choice.label}</option>)}</select></label> : null}
      {step.questionType === 'multiple_choice' ? <div className="answer-stack">{choices.map((choice) => { const selected = Array.isArray(rule.expectedValue) ? rule.expectedValue : []; return <label key={choice.id}><input type="checkbox" checked={selected.includes(choice.id)} onChange={(event) => update(index, { expectedValue: event.target.checked ? [...selected, choice.id] : selected.filter((id) => id !== choice.id) })} /> {choice.label}</label> })}</div> : null}
      {step.questionType === 'rating' ? <label className="inspector-field">Rating<input className="text-input" type="number" value={typeof rule.expectedValue === 'number' ? rule.expectedValue : ''} onChange={(event) => update(index, { expectedValue: event.target.value === '' ? null : Number(event.target.value) })} /></label> : null}
      {step.questionType === 'priority' && rule.predicateKind === 'equals' ? <div className="inspector-field"><label>Priority order<select className="text-input" multiple value={Array.isArray(rule.expectedValue) ? rule.expectedValue : []} onChange={(event) => update(index, { expectedValue: Array.from(event.target.selectedOptions).map((option) => option.value) })}>{choices.map((choice) => <option value={choice.id} key={choice.id}>{choice.label}</option>)}</select></label><span className="muted">Use the order controls below to set the exact order.</span>{(Array.isArray(rule.expectedValue) ? rule.expectedValue : []).map((id: string, rank: number, ordered: string[]) => <span className="toggle-row" key={id}>{rank + 1}. {choices.find((choice) => choice.id === id)?.label}<button className="quiet-button" type="button" disabled={rank === 0} aria-label={`Move ${choices.find((choice) => choice.id === id)?.label} earlier in priority`} onClick={() => { const next = [...ordered]; [next[rank], next[rank - 1]] = [next[rank - 1], next[rank]]; update(index, { expectedValue: next }) }}><ArrowUp size={14} aria-hidden="true" /></button></span>)}</div> : null}
      {step.questionType === 'priority' && rule.predicateKind !== 'equals' ? <><label className="inspector-field">Option<select className="text-input" value={(rule.expectedValue as { choiceId?: string })?.choiceId ?? ''} onChange={(event) => update(index, { expectedValue: { ...(rule.expectedValue as object), choiceId: event.target.value } })}>{choices.map((choice) => <option value={choice.id} key={choice.id}>{choice.label}</option>)}</select></label><label className="inspector-field">Rank<input className="text-input" type="number" min={1} max={choices.length} value={(rule.expectedValue as { rank?: number })?.rank ?? 1} onChange={(event) => update(index, { expectedValue: { ...(rule.expectedValue as object), rank: Number(event.target.value) } })} /></label></> : null}
      <label className="inspector-field">Then go to<select className="text-input" value={rule.destinationStepId} onChange={(event) => update(index, { destinationStepId: event.target.value })}><option value="">Choose a screen</option>{destinations.map((destination) => <option value={destination.id} key={destination.id}>{destination.prompt}</option>)}</select></label>
      <div className="builder-actions"><button className="quiet-button" type="button" aria-label={`Move rule ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" size={15} /></button><button className="quiet-button" type="button" aria-label={`Move rule ${index + 1} later`} disabled={index === rules.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" size={15} /></button><button className="quiet-button" type="button" onClick={() => setRules((current) => current.filter((_, position) => position !== index))}><Trash2 aria-hidden="true" size={15} /> Remove rule</button></div>
    </fieldset>)}
    <div className="builder-actions"><button className="quiet-button" disabled={saving} onClick={add} type="button"><Plus aria-hidden="true" size={15} /> Add rule</button><button className="secondary-button" disabled={saving} onClick={save} type="button">{saving ? 'Saving…' : 'Save answer paths'}</button></div>
  </fieldset></section>
}
