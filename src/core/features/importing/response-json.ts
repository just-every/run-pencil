import manifest from '../../../../seed.json'
import { calendarDate } from '../../shared/questionTypes'
import { ValidationError } from '../../shared/errors'
import { object } from './fields'
import { mappedAnswerIssue } from './response-mapping'
import { typeformJsonAnswers } from './typeform-json'
import { googleJsonAnswers } from './google-json'
import type { ImportForm, ParsedResponse, RowError } from './model'

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value) || !calendarDate(value.slice(0, 10))) throw new Error('Response JSON requires an original ISO submission timestamp with its time zone.')
  if (value.slice(11, 19).split(':').some((part, index) => Number(part) > (index === 0 ? 23 : 59))) throw new Error('Response JSON has an invalid clock time.')
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error('Response JSON has an invalid timestamp.')
  return new Date(time).toISOString()
}

/** Only normalized native answers cross into custody. Provider IDs, metadata,
 * tokens, hidden values, respondent email and quiz grades never enter records. */
export function* mapJsonResponses(input: string, google: boolean, definition: Record<string, any>, form: ImportForm, forbidden: Set<string>, errors: Pick<RowError[], 'push' | 'length'>): Generator<ParsedResponse> {
  let decoded: Record<string, any>
  try {
    const value: unknown = JSON.parse(input)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an API response object.')
    decoded = value as Record<string, any>
  } catch { throw new ValidationError('Response JSON must be a valid API response object.') }
  const items = google ? decoded.responses : decoded.items
  // Google omits an empty repeated field in an empty list response.
  if (google && decoded.responses === undefined && Object.keys(decoded).length === 0) return
  if (!Array.isArray(items)) throw new ValidationError(google ? 'Use a Google forms.responses.list JSON object with a responses array.' : 'Use a Typeform Responses API JSON object with an items array.')
  if (!google && decoded.total_items !== undefined && (!Number.isSafeInteger(decoded.total_items) || decoded.total_items < items.length)) throw new ValidationError('Typeform response JSON has an invalid total_items count.')
  if (!google && decoded.total_items > items.length) throw new ValidationError('Typeform response JSON is only one page. Supply a complete combined items list; nothing was imported.')
  if (google && decoded.nextPageToken) throw new ValidationError('Google response JSON has another page. Supply a complete combined responses list; nothing was imported.')
  if (items.length > manifest.limits.responses.perRevision) throw new ValidationError('Response JSON exceeds the configured responses-per-revision limit. Nothing was written.')
  const typeformAnswer = google ? undefined : typeformJsonAnswers(definition, form, forbidden)
  const googleAnswer = google ? googleJsonAnswers(definition, form) : undefined
  for (const [index, raw] of items.entries()) {
    const row = index + 1, before = errors.length, source = object(raw), answers: Record<string, unknown> = {}
    let submittedAt: string | undefined, startedAt: string | null = null
    try {
      if (!google && source.response_type !== undefined && source.response_type !== 'completed') throw new Error('Only completed Typeform responses can be imported.')
      submittedAt = timestamp(google ? source.lastSubmittedTime : source.submitted_at)
      if (!google && source.landed_at !== undefined) startedAt = timestamp(source.landed_at)
      if (startedAt && submittedAt < startedAt) throw new Error('Response start time is after submission.')
    } catch (error) { errors.push({ row, column: 'Submission time', message: (error as Error).message }) }
    const accept = (read: () => { step: ImportForm['steps'][number]; value: unknown } | undefined) => {
      let column = 'Response answer'
      try {
        const mapped = read()
        if (!mapped) return
        const { step, value } = mapped
        column = step.prompt
        if (Object.hasOwn(answers, step.id)) throw new Error('Response JSON repeats an answer to the same question.')
        const issue = mappedAnswerIssue(step, value)
        if (issue) throw new Error(issue)
        answers[step.id] = value
      } catch (error) { errors.push({ row, column, message: (error as Error).message }) }
    }
    if (google) {
      if (source.answers !== undefined && (!source.answers || typeof source.answers !== 'object' || Array.isArray(source.answers))) errors.push({ row, column: 'Response answers', message: 'Google response answers must be an object keyed by question ID.' })
      else for (const [key, value] of Object.entries(source.answers ?? {})) accept(() => googleAnswer!(key, value))
    } else {
      if (!Array.isArray(source.answers)) errors.push({ row, column: 'Response answers', message: 'Typeform response answers must be an array.' })
      else for (const value of source.answers) accept(() => typeformAnswer!(value))
    }
    if (submittedAt && before === errors.length) yield { row, submittedAt, startedAt, answers }
  }
}
