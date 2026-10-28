import { matrixRows, matrixMultiple } from '../matrix'
import { useAnswerAccessibility } from './AnswerFieldset'
import type { FlowStep, ChoiceOption } from '../../app/api'
import './matrix.css'

export function MatrixQuestionInput({ step, choices, value, onChange }: { step: FlowStep; choices: ChoiceOption[]; value: unknown; onChange: (value: unknown) => void }) {
  const accessibility = useAnswerAccessibility()
  const answer = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const multiple = matrixMultiple(step.questionSettings)
  return <div className="matrix-input" {...accessibility()} role="group" aria-label={step.prompt}>
    {matrixRows(step.questionSettings).map(row => <fieldset className="matrix-input__row" key={row.id}>
      <legend>{row.label}</legend>
      <div className="matrix-input__scale" role={multiple ? 'group' : 'radiogroup'} aria-label={row.label}>
        {choices.map(choice => {
          const selected = multiple ? Array.isArray(answer[row.id]) && (answer[row.id] as string[]).includes(choice.id) : answer[row.id] === choice.id
          return <label className="matrix-input__option" data-selected={selected} key={choice.id}>
            <input type={multiple ? 'checkbox' : 'radio'} name={`${step.id}-${row.id}`} checked={selected} aria-required={step.required} onChange={() => {
              const current = Array.isArray(answer[row.id]) ? answer[row.id] as string[] : []
              const next = { ...answer, [row.id]: multiple ? selected ? current.filter(id => id !== choice.id) : [...current, choice.id] : choice.id }
              if (Array.isArray(next[row.id]) && !(next[row.id] as string[]).length) delete next[row.id]
              onChange(next)
            }} />
            <span>{choice.label}</span>
          </label>
        })}
      </div>
    </fieldset>)}
  </div>
}
