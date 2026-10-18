import type { BuilderDraft } from '../../../app/api'
import { calculationLimits, type Calculation, type CalculationExpression } from '../../../shared/calculations'
import { hiddenOperands } from '../../../shared/hiddenFields'
import { ConditionEditor, firstCondition } from './ConditionEditor'

type Props = {
  expression: CalculationExpression
  draft: BuilderDraft
  calculations: Calculation[]
  calculationId: string
  label: string
  valueType?: 'number' | 'text' | 'date'
  depth?: number
  onChange: (expression: CalculationExpression) => void
}
const kinds: Array<[CalculationExpression['kind'], string]> = [
  ['literal', 'Literal value'], ['answer', 'Question answer'], ['hidden', 'Hidden field'], ['variable', 'Calculated variable'],
  ['add', 'Add'], ['subtract', 'Subtract'], ['multiply', 'Multiply'], ['divide', 'Divide'],
  ['conditional', 'Conditional'], ['round', 'Round'], ['date_difference', 'Date difference'],
]

export function CalculationExpressionEditor({ expression, draft, calculations, calculationId, label, valueType = 'number', depth = 0, onChange }: Props) {
  const questions = draft.steps.filter(step => step.kind === 'question')
  const fields = draft.formSettings?.hiddenFields ?? []
  const variables = calculations.filter(value => value.id !== calculationId)
  const conditionOperands = [...questions, ...hiddenOperands(fields)]
  const literal = (type = valueType): CalculationExpression => ({ kind: 'literal', value: type === 'number' ? 0 : '' })
  const changeKind = (kind: CalculationExpression['kind']) => {
    switch (kind) {
      case 'literal': onChange(literal()); break
      case 'answer': onChange({ kind, stepId: questions[0]?.id ?? '' }); break
      case 'hidden': onChange({ kind, fieldId: fields[0]?.id ?? '' }); break
      case 'variable': onChange({ kind, variableId: variables[0]?.id ?? '' }); break
      case 'conditional': {
        const first = conditionOperands[0]
        if (first) onChange({ kind, condition: { kind: 'group', join: 'and', conditions: [firstCondition(first, draft)] }, then: literal(), else: literal() })
        break
      }
      case 'round': onChange({ kind, value: literal('number'), decimalPlaces: 2 }); break
      case 'date_difference': onChange({ kind, start: literal('date'), end: literal('date'), unit: 'days' }); break
      default: onChange({ kind, left: literal('number'), right: { kind: 'literal', value: kind === 'divide' || kind === 'multiply' ? 1 : 0 } })
    }
  }
  const child = (name: string, value: CalculationExpression, type: Props['valueType'], change: Props['onChange']) => <CalculationExpressionEditor
    expression={value} draft={draft} calculations={calculations} calculationId={calculationId}
    label={`${label} ${name}`} valueType={type} depth={depth + 1} onChange={change} />
  const reference = (prefix: string, selected: string, options: Array<{ id: string; name: string }>, change: (id: string) => void) => <label className="inspector-field">{prefix}
    <select className="text-input" aria-label={`${prefix} ${label}`} value={selected} onChange={event => change(event.target.value)}>
      <option value="">Choose {prefix.toLowerCase()}</option>
      {selected && !options.some(option => option.id === selected) ? <option value={selected}>Missing or deleted reference</option> : null}
      {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
  </label>

  return <fieldset className="calculation-expression">
    <legend>{depth === 0 ? 'Expression' : label.split(' ').at(-1)}</legend>
    <label className="inspector-field">Expression type
      <select className="text-input" aria-label={label} value={expression.kind} onChange={event => changeKind(event.target.value as CalculationExpression['kind'])}>
        {kinds.map(([kind, name]) => <option key={kind} value={kind} disabled={
          (depth >= calculationLimits.expressionDepth && !['literal', 'answer', 'hidden', 'variable'].includes(kind))
          || (kind === 'conditional' && conditionOperands.length === 0)
          || (kind === 'answer' && questions.length === 0) || (kind === 'hidden' && fields.length === 0) || (kind === 'variable' && variables.length === 0)
        }>{name}</option>)}
      </select>
    </label>
    {expression.kind === 'literal' ? <div className="calculation-literal">
      <label className="inspector-field">Literal type
        <select className="text-input" aria-label={`Literal type ${label}`} value={typeof expression.value === 'number' ? 'number' : 'text'} onChange={event => onChange(literal(event.target.value as 'number' | 'text'))}>
          <option value="number">Number</option><option value="text">Text</option>
        </select>
      </label>
      <label className="inspector-field">{valueType === 'date' ? 'Calendar date' : 'Literal value'}
        <input className="text-input" aria-label={`Literal value ${label}`} type={typeof expression.value === 'number' ? 'number' : valueType === 'date' ? 'date' : 'text'} step="any" maxLength={calculationLimits.textCharacters} value={Number.isNaN(expression.value) ? '' : expression.value} onChange={event => onChange({ kind: 'literal', value: typeof expression.value === 'number' ? event.target.valueAsNumber : event.target.value })} />
      </label>
    </div> : null}
    {expression.kind === 'answer' ? reference('Question reference', expression.stepId, questions.map(question => ({ id: question.id, name: question.prompt })), stepId => onChange({ ...expression, stepId })) : null}
    {expression.kind === 'hidden' ? reference('Hidden field reference', expression.fieldId, fields, fieldId => onChange({ ...expression, fieldId })) : null}
    {expression.kind === 'variable' ? reference('Variable reference', expression.variableId, variables, variableId => onChange({ ...expression, variableId })) : null}
    {expression.kind === 'add' || expression.kind === 'subtract' || expression.kind === 'multiply' || expression.kind === 'divide' ? <div className="calculation-operands">
      {child('left', expression.left, 'number', left => onChange({ ...expression, left }))}
      {child('right', expression.right, 'number', right => onChange({ ...expression, right }))}
    </div> : null}
    {expression.kind === 'conditional' ? <>
      <fieldset className="calculation-condition"><legend>If</legend>
        <ConditionEditor condition={expression.condition} draft={draft} operands={questions} onChange={condition => onChange({ ...expression, condition })} />
        {expression.condition.kind === 'test' ? <button className="secondary-button focus-ring" type="button" aria-label={`Group condition ${label}`} onClick={() => onChange({ ...expression, condition: { kind: 'group', join: 'and', conditions: [expression.condition] } })}>Add condition group</button> : null}
      </fieldset>
      <div className="calculation-operands">
        {child('then', expression.then, valueType, then => onChange({ ...expression, then }))}
        {child('else', expression.else, valueType, otherwise => onChange({ ...expression, else: otherwise }))}
      </div>
    </> : null}
    {expression.kind === 'round' ? <>
      <label className="inspector-field">Decimal places<input className="text-input" aria-label={`Decimal places ${label}`} type="number" min={0} max={calculationLimits.decimalPlaces} step={1} value={Number.isNaN(expression.decimalPlaces) ? '' : expression.decimalPlaces} onChange={event => onChange({ ...expression, decimalPlaces: event.target.valueAsNumber })} /></label>
      {child('value', expression.value, 'number', value => onChange({ ...expression, value }))}
    </> : null}
    {expression.kind === 'date_difference' ? <>
      <label className="inspector-field">Date difference unit<select className="text-input" aria-label={`Date difference unit ${label}`} value={expression.unit} onChange={event => onChange({ ...expression, unit: event.target.value as 'days' | 'months' | 'years' })}>
        <option value="days">Calendar days</option><option value="months">Complete months</option><option value="years">Complete years</option>
      </select></label>
      <div className="calculation-operands">
        {child('start', expression.start, 'date', start => onChange({ ...expression, start }))}
        {child('end', expression.end, 'date', end => onChange({ ...expression, end }))}
      </div>
    </> : null}
  </fieldset>
}
