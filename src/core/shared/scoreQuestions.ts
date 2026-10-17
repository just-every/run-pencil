export const scoreQuestionTypes = ['csat', 'ces', 'emoji_rating', 'thumbs_rating'] as const

const satisfaction = ['Very dissatisfied', 'Dissatisfied', 'Neither satisfied nor dissatisfied', 'Satisfied', 'Very satisfied']
const effort = ['Very difficult', 'Difficult', 'Somewhat difficult', 'Neither easy nor difficult', 'Somewhat easy', 'Easy', 'Very easy']

export function scoreOptions(type: string): Array<{ value: number | boolean; label: string }> {
  if (type === 'thumbs_rating') return [{ value: false, label: 'Thumbs down' }, { value: true, label: 'Thumbs up' }]
  const labels = type === 'csat' || type === 'emoji_rating' ? satisfaction : type === 'ces' ? effort : []
  return labels.map((label, index) => ({ value: index + 1, label }))
}

export function scoreAnswerIssue(type: string, value: unknown) {
  if (!scoreOptions(type).some(option => option.value === value)) {
    return type === 'thumbs_rating' ? 'Choose Thumbs down or Thumbs up.' : `Choose a whole-number score from 1 to ${type === 'ces' ? 7 : 5}.`
  }
  return undefined
}

export const scoreDescriptions: Record<string, string> = {
  csat: 'Satisfaction from 1 (very dissatisfied) to 5 (very satisfied). CSAT is the percentage of answered questions scored 4 or 5.',
  ces: 'Ease from 1 (very difficult) to 7 (very easy). CES is the mean of answered questions; a higher score means less effort.',
  emoji_rating: 'Five faces from very dissatisfied to very satisfied. Each answer keeps its number from 1 to 5.',
  thumbs_rating: 'Thumbs down or thumbs up, with neither selected initially.',
}
