import './calculations.css'
import { useEffect, useState } from 'react'
import type { BuilderDraft } from '../../../app/api'
import { calculationLimits, type Calculation, type CalculationType } from '../../../shared/calculations'
import { validateCalculations } from '../../../shared/calculationValidation'
import { useProtectUnsavedChanges } from '../../../shared/ui/UnsavedChanges'
import { CalculationExpressionEditor } from './CalculationExpressionEditor'

type Props = {
  draft: BuilderDraft
  calculations: Calculation[]
  disabled: boolean
  onSave: (calculations: Calculation[]) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

export function CalculationSettings(props: Props) {
  return <CalculationSettingsEditor key={JSON.stringify(props.calculations)} {...props} />
}

function CalculationSettingsEditor({ draft, calculations, disabled, onSave, onDirtyChange }: Props) {
  const [values, setValues] = useState(calculations)
  const [saved, setSaved] = useState(JSON.stringify(calculations))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(values) !== saved
  const markSaved = useProtectUnsavedChanges(dirty)
  const issues = validateCalculations(values, draft.steps.filter(step => step.kind === 'question'), draft.formSettings?.hiddenFields ?? [], draft.choices)
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  function update(id: string, change: Partial<Calculation>) {
    setError('')
    setValues(current => current.map(value => value.id === id ? { ...value, ...change } : value))
  }
  function add(type: CalculationType) {
    let index = values.length + 1
    while (values.some(value => value.name === `Calculation ${index}`)) index++
    setError('')
    setValues(current => [...current, { id: crypto.randomUUID(), name: `Calculation ${index}`, type, expression: { kind: 'literal', value: type === 'number' ? 0 : '' } }])
  }
  async function save() {
    if (disabled || saving || issues.length || !dirty) return
    setError(''); setSaving(true)
    try {
      await onSave(values)
      setSaved(JSON.stringify(values))
      markSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Calculations could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <details className="quiet-panel calculation-settings">
    <summary className="focus-ring">Calculations</summary>
    <fieldset className="calculation-settings-fields" disabled={disabled || saving}>
      <legend>Calculated values</legend>
      <p className="muted">Build numeric totals or text values from answers, hidden fields and other calculations. Missing inputs produce a blank value. Expressions that could divide by zero must be corrected before publishing.</p>
      {values.length === 0 ? <p className="muted">No calculations yet. Add a numeric or text calculation to begin.</p> : null}
      {values.map((calculation, index) => <fieldset className="quiet-panel calculation-card" key={calculation.id}>
        <legend>Calculation {index + 1}</legend>
        <div className="calculation-header">
          <label className="inspector-field">Name
            <input className="text-input" aria-label={`Calculation name ${index + 1}`} maxLength={100} value={calculation.name} onChange={event => update(calculation.id, { name: event.target.value })} />
          </label>
          <label className="inspector-field">Value type
            <select className="text-input" aria-label={`Calculation type ${index + 1}`} value={calculation.type} onChange={event => {
              const type = event.target.value as CalculationType
              update(calculation.id, { type, ...(calculation.expression.kind === 'literal' ? { expression: { kind: 'literal', value: type === 'number' ? 0 : '' } } : {}) })
            }}><option value="number">Number</option><option value="text">Text</option></select>
          </label>
          <button className="secondary-button focus-ring" type="button" aria-label={`Remove calculation ${index + 1}`} onClick={() => {
            setError('')
            setValues(current => current.filter(value => value.id !== calculation.id))
          }}>Remove calculation</button>
        </div>
        <CalculationExpressionEditor expression={calculation.expression} draft={draft} calculations={values} calculationId={calculation.id} label={`Calculation expression ${index + 1}`} valueType={calculation.type} onChange={expression => update(calculation.id, { expression })} />
      </fieldset>)}
      <div className="builder-actions calculation-actions">
        <button className="secondary-button focus-ring" type="button" disabled={values.length >= calculationLimits.perRevision} onClick={() => add('number')}>Add numeric calculation</button>
        <button className="secondary-button focus-ring" type="button" disabled={values.length >= calculationLimits.perRevision} onClick={() => add('text')}>Add text calculation</button>
      </div>
      {dirty && issues.length ? <div role="alert"><p>Fix these calculations before saving:</p><ul>{issues.slice(0, 6).map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>{issues.length > 6 ? <p>{issues.length - 6} more issues remain.</p> : null}</div> : null}
      {error ? <p role="alert">{error}</p> : null}
      <button className="secondary-button focus-ring" type="button" disabled={!dirty || issues.length > 0} onClick={() => { void save() }}>{saving ? 'Saving calculations…' : 'Save calculations'}</button>
    </fieldset>
  </details>
}
