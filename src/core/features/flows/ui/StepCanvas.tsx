import type { FlowStep } from '../../../app/api'
import { QuestionInput } from '../../../shared/ui/QuestionInput'
import type { EditableChoice } from '../authoring'

export function StepCanvas({ step, choices, value, onChange }: { step: FlowStep; choices: EditableChoice[]; value: unknown; onChange: (value: unknown) => void }) {
  const min = step.questionSettings?.min ?? 1
  const max = step.questionSettings?.max ?? 5
  if (step.questionType === 'rating' && (typeof min !== 'number' || typeof max !== 'number' || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 10 || min >= max)) return <p role="status">Choose a rating scale from 0 to 10, with the highest rating greater than the lowest.</p>
  return <QuestionInput key={`${step.id}-${step.questionType}`} step={step} choices={choices.map((choice, position) => ({ ...choice, id: choice.id ?? choice.newId!, stepId: step.id, position }))} value={value} onChange={onChange} />
}
