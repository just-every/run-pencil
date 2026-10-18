import { calculationOperands } from '../../../shared/calculationInputs'
import { hiddenOperands } from '../../../shared/hiddenFields'
import type { BuilderDraft, FlowStep } from '../../../app/api'
import { operatorsFor } from '../../../shared/conditionValidation'
import { conditionTests, type Condition, type ConditionOperator } from '../../../shared/conditions'
import manifest from '../../../../../seed.json'

export const operatorLabels: Record<ConditionOperator, string> = {
  equals: 'is', not_equals: 'is not', greater_than: 'is greater than', greater_than_or_equal: 'is at least',
  less_than: 'is less than', less_than_or_equal: 'is at most', any_of: 'is any of', all_of: 'includes all of',
  none_of: 'is none of', exactly: 'is exactly', is_blank: 'is blank', is_answered: 'is answered',
}
export function firstCondition(step: FlowStep, draft: BuilderDraft): Condition {
  const operator = operatorsFor(step.questionType)[0]
  const choices = draft.choices.filter(choice => choice.stepId === step.id)
  const value = ['is_blank','is_answered'].includes(operator) ? undefined
    : ['yes_no','consent','thumbs_rating'].includes(step.questionType ?? '') ? true
    : step.questionType === 'date' ? '2026-01-01'
    : ['short_text','long_text','email'].includes(step.questionType ?? '') ? ''
    : step.questionType === 'priority' || step.questionType === 'multiple_choice' ? choices.map(choice => choice.id)
    : ['single_choice','dropdown'].includes(step.questionType ?? '') ? choices[0]?.id ?? '' : 1
  return { kind: 'test', stepId: step.id, operator, ...(value !== undefined ? { value } : {}) }
}
export function conditionSummary(condition: Condition, draft: BuilderDraft): string {
  if (condition.kind === 'group') return `(${condition.conditions.map(child => conditionSummary(child, draft)).join(condition.join === 'and' ? ' and ' : ' or ')})`
  const step = [...draft.steps,...hiddenOperands(draft.formSettings?.hiddenFields ?? []),...calculationOperands(draft.formSettings?.calculations ?? [])].find(step => step.id === condition.stepId)
  const display = (value: unknown): string => Array.isArray(value) ? value.map(display).join(', ') : typeof value === 'string' ? draft.choices.find(choice => choice.id === value)?.label ?? value : value && typeof value === 'object' && 'choiceId' in value ? `${display(value.choiceId)} at rank ${'rank' in value ? value.rank : ''}` : String(value)
  return `${step?.prompt ?? 'Missing question'} ${operatorLabels[condition.operator]}${['is_blank','is_answered'].includes(condition.operator) ? '' : ` ${display(condition.value)}`}`
}

export function ConditionEditor({ condition, draft, operands, onChange }: { condition: Condition; draft: BuilderDraft; operands: FlowStep[]; onChange: (condition: Condition) => void }) {
  operands = [...operands,...hiddenOperands(draft.formSettings?.hiddenFields ?? []),...calculationOperands(draft.formSettings?.calculations ?? [])]
  const total = conditionTests(condition).length
  const node = (current: Condition, change: (next: Condition) => void, depth = 0): React.ReactNode => {
    if (current.kind === 'group') return <fieldset className="quiet-panel condition-group"><legend>Condition group</legend>
      <label className="inspector-field">Match<select aria-label="Match" className="text-input" value={current.join} onChange={event => change({ ...current, join: event.target.value as 'and' | 'or' })}><option value="and">All conditions (AND)</option><option value="or">Any condition (OR)</option></select></label>
      {current.conditions.map((child, index) => <div className="condition-item" key={index}>
        {node(child, next => change({ ...current, conditions: current.conditions.map((entry, i) => i === index ? next : entry) }), depth + 1)}
        <button className="quiet-button" type="button" disabled={current.conditions.length === 1} onClick={() => change({ ...current, conditions: current.conditions.filter((_, i) => i !== index) })}>Remove condition {index + 1}</button>
      </div>)}
      <div className="builder-actions"><button className="secondary-button" type="button" disabled={total >= manifest.limits.logic.conditionsPerRule} onClick={() => change({ ...current, conditions: [...current.conditions, firstCondition(operands[operands.length - 1], draft)] })}>Add condition</button>
      <button className="secondary-button" type="button" disabled={total >= manifest.limits.logic.conditionsPerRule || depth >= manifest.limits.logic.groupDepth - 1} onClick={() => change({ ...current, conditions: [...current.conditions, { kind: 'group', join: 'or', conditions: [firstCondition(operands[operands.length - 1], draft)] }] })}>Add group</button></div>
    </fieldset>
    const step = operands.find(step => step.id === current.stepId)
    const choices = draft.choices.filter(choice => choice.stepId === current.stepId)
    const many = ['any_of','all_of','none_of','exactly'].includes(current.operator) || step?.questionType === 'priority' && ['equals','not_equals'].includes(current.operator)
    const noValue = ['is_blank','is_answered'].includes(current.operator)
    const setOperator = (operator: ConditionOperator) => {
      const base = step ? firstCondition(step, draft) as Extract<Condition, { kind: 'test' }> : current
      change({ ...base, operator, ...(['is_blank','is_answered'].includes(operator) ? { value: undefined } : ['any_of','all_of','none_of','exactly'].includes(operator) ? { value: choices.slice(0,1).map(choice => choice.id) } : step?.questionType === 'priority' && !['equals','not_equals'].includes(operator) ? { value: { choiceId: choices[0]?.id ?? '', rank: 1 } } : {}) })
    }
    return <div className="answer-stack">
      <label className="inspector-field">Question<select aria-label="Question" className="text-input" value={current.stepId} onChange={event => change(firstCondition(operands.find(step => step.id === event.target.value)!, draft))}>{operands.map(step => <option key={step.id} value={step.id}>{step.prompt}</option>)}</select></label>
      <label className="inspector-field">Condition<select aria-label="Condition" className="text-input" value={current.operator} onChange={event => setOperator(event.target.value as ConditionOperator)}>{operatorsFor(step?.questionType ?? null).map(operator => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select></label>
      {!noValue ? many ? <label className="inspector-field">Answers<select aria-label="Answers" multiple className="text-input" value={Array.isArray(current.value) ? current.value : []} onChange={event => change({ ...current, value: Array.from(event.target.selectedOptions).map(option => option.value) })}>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
        : ['single_choice','dropdown'].includes(step?.questionType ?? '') ? <label className="inspector-field">Answer<select aria-label="Answer" className="text-input" value={String(current.value ?? '')} onChange={event => change({ ...current, value: event.target.value })}><option value="">Choose an answer</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label>
        : ['yes_no','consent','thumbs_rating'].includes(step?.questionType ?? '') ? <label className="inspector-field">Answer<select aria-label="Answer" className="text-input" value={String(current.value)} onChange={event => change({ ...current, value: event.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></label>
        : step?.questionType === 'priority' ? <><label className="inspector-field">Ranked choice<select aria-label="Ranked choice" className="text-input" value={String((current.value as { choiceId?: string })?.choiceId ?? '')} onChange={event => change({ ...current, value: { ...(current.value as { choiceId: string; rank: number }), choiceId: event.target.value } })}>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></label><label className="inspector-field">Rank<input aria-label="Rank" className="text-input" type="number" value={Number((current.value as { rank?: number })?.rank ?? 1)} onChange={event => change({ ...current, value: { ...(current.value as { choiceId: string; rank: number }), rank: event.target.valueAsNumber } })}/></label></>
        : <label className="inspector-field">Value<input aria-label="Value" className="text-input" type={step?.questionType === 'date' ? 'date' : ['short_text','long_text','email','url','phone'].includes(step?.questionType ?? '') ? 'text' : 'number'} step="any" value={typeof current.value === 'number' || typeof current.value === 'string' ? current.value : ''} onChange={event => change({ ...current, value: ['date','short_text','long_text','email','url','phone'].includes(step?.questionType ?? '') ? event.target.value : event.target.value === '' ? null : event.target.valueAsNumber })}/></label> : null}
    </div>
  }
  return <div>{node(condition, onChange)}<p className="muted">{conditionSummary(condition, draft)}</p></div>
}
