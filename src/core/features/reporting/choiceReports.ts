import manifest from '../../../../seed.json'
import { sqlTextWithin } from './textValidity'
import { choiceSettingsValid, isChoiceQuestion, otherTextSettings } from '../../shared/choiceAnswers'
import { sqlOtherTextConstraints } from './choiceTextValidity'
import type { ReportChoice, ReportStep } from './questionReport'
export { sqlChoiceSelection } from './choiceValidity'
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`

/** Compile the shared FIELD013 grammar once per question, never per answer. */
export function sqlSpecialChoiceText(steps: Array<Pick<ReportStep, 'id' | 'questionType' | 'settingsJson'>>, choices: Array<Pick<ReportChoice, 'id' | 'stepId'>>) {
  const clauses: string[] = []
  for (const step of steps.filter(step => isChoiceQuestion(step.questionType))) {
    const settings = JSON.parse(step.settingsJson ?? '{}') as Record<string, unknown>
    if (!choiceSettingsValid(step.questionType, settings, choices.filter(choice => choice.stepId === step.id).map(choice => choice.id))) throw new Error('Invalid retained question settings.')
    const value = "json_extract(a.value_json,'$.other.text')"
    const text = sqlOtherTextConstraints(otherTextSettings(settings), value)
    if (text !== '1') clauses.push(`WHEN ${literal(step.id)} THEN CASE WHEN json_type(a.value_json)!='object' THEN 1 WHEN NOT (${sqlTextWithin(value, manifest.limits.responses.shortTextCharactersPerAnswer)}) THEN 0 ELSE (${text}) END`)
  }
  return clauses.length ? `(CASE s.stable_id ${clauses.join(' ')} ELSE 1 END)` : '1'
}
