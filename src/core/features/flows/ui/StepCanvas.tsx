import type { FlowStep } from '../../../app/api'
import { QuestionInput } from '../../../shared/ui/QuestionInput'
import type { EditableChoice } from '../authoring'

export function StepCanvas({ step, choices, value, onChange }: { step: FlowStep; choices: EditableChoice[]; value: unknown; onChange: (value: unknown) => void }) {
  return <QuestionInput key={`${step.id}-${step.questionType}`} step={step} choices={choices.map((choice, position) => ({ ...choice, id: choice.id ?? choice.newId!, stepId: step.id, position }))} value={value} onChange={onChange} />
}
