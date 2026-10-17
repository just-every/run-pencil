import { choiceAnswerIssue, isChoiceQuestion, otherChoiceText } from '../../shared/choiceAnswers'

/** Only the write-in text leaves a selected choice question. IDs/labels stay local. */
export function analysisAnswerText(type: string | null, settingsJson: string | null, choicesJson: string | null, value: unknown): string | undefined {
  if (type === 'short_text' || type === 'long_text') {
    if (typeof value !== 'string') throw new Error('Invalid retained text evidence.')
    return value.length ? value : undefined
  }
  const settings = JSON.parse(settingsJson ?? '{}') as Record<string, unknown>
  if (!isChoiceQuestion(type) || typeof settings.otherChoiceId !== 'string') throw new Error('This answer is not selected text evidence.')
  const choices = JSON.parse(choicesJson ?? '[]') as string[]
  if (choiceAnswerIssue(type, settings, choices, value)) throw new Error('Invalid retained Other text evidence.')
  return otherChoiceText(value)
}

export const textEvidenceColumns = `s.question_type AS questionType,s.question_settings_json AS settingsJson,
  (SELECT json_group_array(c.stable_id) FROM choice_options c WHERE c.step_id=s.id) AS choicesJson`
