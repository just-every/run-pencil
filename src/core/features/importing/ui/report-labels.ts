import type { ImportReview } from '../model'

const labels: Record<string, string> = {
  short_text: 'Short text', long_text: 'Long text', single_choice: 'Single choice', multiple_choice: 'Multiple choice',
  picture_choice: 'Picture choice', yes_no: 'Yes / No', opinion_scale: 'Opinion scale', nps: 'NPS',
  phone_number: 'Phone number', submittedAt: 'Submission time', startedAt: 'Start time',
  welcome: 'Welcome screen', completion: 'Completion screen', legal: 'Legal consent', priority: 'Ranking',
  native: 'Pencil', artifact: 'Source file', group: 'Question group', inline_group: 'Question group',
}
export function typeLabel(value: string) {
  const readable = labels[value] ?? value.replaceAll('_', ' ')
  return readable ? readable[0].toUpperCase() + readable.slice(1) : 'Unknown type'
}

/** Translate display text only; reviewed IDs and report data remain intact. */
export function reportText(value: string, review: ImportReview) {
  const names = new Map(review.questions.flatMap(question => [
    [question.id, `“${question.prompt}”`],
    ...question.choices.map(choice => [choice.id, `“${choice.label}”`]),
  ] as [string, string][]))
  return value.replace(/\bi_[a-f0-9]+\b/g, id => names.get(id) ?? 'another form step')
    .replace(/\b(?:short_text|long_text|single_choice|multiple_choice|picture_choice|yes_no|opinion_scale|nps|phone_number|submittedAt|startedAt|welcome|completion|priority)\b/g, typeLabel)
}
