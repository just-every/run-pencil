import { answerIssue, type AnswerQuestion } from '../../shared/answers'
export function retainedAnswer(type: string, value: unknown, choices: string[], settings: Record<string,unknown>, required: boolean) {
  const fail = () => { throw new Error('Invalid retained answer. It cannot be exported faithfully.') }
  if (['short_text','long_text'].includes(type)) {
    if (typeof value !== 'string' || value.length > (type === 'long_text' ? 5000 : 200)) fail()
    return
  }
  if (type === 'consent') {
    if (!value || typeof value !== 'object' || !('accepted' in value) || typeof value.accepted !== 'boolean' || !('statement' in value) || value.statement !== settings.statement || (required && !value.accepted)) fail()
    return
  }
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) fail()
  const question: AnswerQuestion = {prompt:'Retained question',questionType:type as AnswerQuestion['questionType'],required,questionSettings:settings}
  if (answerIssue(question,choices,value)) fail()
}
