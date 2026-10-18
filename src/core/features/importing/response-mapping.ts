import type { CsvRow } from './csv'
import { calendarDate } from '../../shared/questionTypes'
import { answerIssue } from '../../shared/answers'
import { choiceResponse, choiceValue, importedChoiceIds, importedOtherText, otherChoiceId } from './choice-response'
import { forbiddenColumn, type ColumnMapping, type ImportForm, type ImportStep, type ParsedResponse, type RowError, type GoogleSettings } from './model'
function dateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)) return null
  if (!calendarDate(value.slice(0, 10))) return null
  const time = Date.parse(value.replace(' ', 'T') + (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? '' : 'Z'))
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}
export function suggestColumns(headers: string[], form: ImportForm, forbiddenColumns: number[]): ColumnMapping[] {
  return headers.map((header, column) => {
    let target = 'skip'
    if (!forbiddenColumns.includes(column) && !forbiddenColumn(header)) {
      // Typeform's results export names its UTC timestamps "Start Date (UTC)" and "Submit Date (UTC)".
      if (/^(submit date|submitted at|submitted_at)(?: \(utc\))?$/i.test(header)) target = 'submittedAt'
      else if (/^(start date|started at|landed_at)(?: \(utc\))?$/i.test(header)) target = 'startedAt'
      else {
        const matches = form.steps.filter(s => s.kind === 'question' && [s.prompt, s.sourceId].includes(header))
        if (matches.length === 1) target = matches[0].id
        else if (!matches.length) {
          // The export splits a multiple-selection question into one column per option, headed by the option's label.
          // Suggest it only when exactly one option of one such question carries that label; the operator reviews it.
          const options = form.steps.flatMap(s => s.kind === 'question' ? s.choices.filter(c => c.label === header && (s.questionType === 'multiple_choice' || c.id === otherChoiceId(s))).map(c => ({ step: s.id, choice: c.id })) : [])
          if (options.length === 1) return { column, target: options[0].step, choice: options[0].choice }
        }
      }
    }
    return { column, target }
  })
}
function answer(value: string, step: ImportStep, google?: { dateOrder?: GoogleSettings['dateOrder'] }): unknown {
  if (['short_text', 'long_text', 'email'].includes(step.questionType!)) return value
  if (google && step.questionType === 'yes_no') { if (value === step.settings.importYesLabel) return true; if (value === step.settings.importNoLabel) return false; throw new Error('Answer must match an explicitly confirmed Yes or No label.') }
  if (['yes_no', 'consent'].includes(step.questionType!)) {
    if (!['1', '0', 'true', 'false'].includes(value)) throw new Error('Use 1/0 or true/false.')
    const yes = value === '1' || value === 'true'
    return step.questionType === 'consent' ? { accepted: yes, statement: step.settings.statement } : yes
  }
  if (['number', 'rating', 'nps'].includes(step.questionType!)) {
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) throw new Error('Use an unformatted finite number.')
    return Number(value)
  }
  if (step.questionType === 'date') {
    if (!google || calendarDate(value)) return value
    const parts = /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/.exec(value)
    if (!parts || !google.dateOrder) throw new Error('Use a calendar date with the reviewed date order or YYYY-MM-DD.')
    const [a,b,c] = parts.slice(1).map(Number), order = google.dateOrder
    return `${String(order === 'YMD' ? a : c).padStart(4,'0')}-${String(order === 'MDY' ? a : b).padStart(2,'0')}-${String(order === 'DMY' ? a : order === 'YMD' ? c : b).padStart(2,'0')}`
  }
  return choiceResponse(value, step, !!google)
}
export function mappedAnswerIssue(step: ImportStep, value: unknown): string | undefined {
  const question = { prompt: step.prompt, questionType: step.questionType, required: false, questionSettings: step.settings }
  if (step.questionType === 'consent') {
    const consent = value as { accepted?: unknown; statement?: unknown }
    if (!consent || typeof consent.accepted !== 'boolean' || consent.statement !== step.settings.statement) return 'Consent must retain the source statement and Boolean answer.'
    return answerIssue(question, [], consent.accepted)
  }
  return answerIssue(question, step.choices.map(c => c.id), value)
}
export function* mapResponses(rows: Iterable<CsvRow>, headers: string[], form: ImportForm, columns: ColumnMapping[], errors: Pick<RowError[], 'push' | 'length'>, forbiddenColumns: number[], google?: { time: (value: string, submitted?: boolean) => string; dateOrder?: GoogleSettings['dateOrder'] }): Generator<ParsedResponse> {
  const byId = new Map(form.steps.filter(s => s.kind === 'question').map(s => [s.id, s]))
  for (const parsed of rows) {
    errors.push(...parsed.errors)
    const { cells, row } = parsed, answers: Record<string, unknown> = {}, before = errors.length, malformed = parsed.errors.length > 0
    let startedAt: string | null = null, submittedAt: string | null = null
    const assigned = new Set<string>()
    const separate = new Map<string, { ids: string[]; otherText?: string }>()
    for (const mapping of columns) {
      if (mapping.target === 'skip' || forbiddenColumns.includes(mapping.column) || forbiddenColumn(headers[mapping.column] ?? '')) continue
      const value = cells[mapping.column] ?? '', label = headers[mapping.column] ?? String(mapping.column)
      try {
        if (mapping.target === 'startedAt' || mapping.target === 'submittedAt') {
          if (assigned.has(mapping.target)) throw new Error('More than one column maps to this timestamp.')
          assigned.add(mapping.target)
          if (google && mapping.target === 'submittedAt' && !value) throw new Error('Original Timestamp is blank; provide the original Sheet local date and time.')
          const time = value ? (google ? google.time(value, mapping.target === 'submittedAt') : dateTime(value)) : null
          if (value && !time) throw new Error('Expected an ISO timestamp or UTC export date.')
          if (mapping.target === 'startedAt') startedAt = time; else submittedAt = time
          continue
        }
        const step = byId.get(mapping.target)
        if (!step) throw new Error('Unknown or unsupported mapped question.')
        if (mapping.choice) {
          const isOther = mapping.choice === otherChoiceId(step)
          if (!step.choices.some(c => c.id === mapping.choice) || (!isOther && (step.questionType !== 'multiple_choice' || google))) throw new Error('Separate columns require a known multiple-choice option or the question’s Other write-in.')
          const key = `${step.id}:${mapping.choice}`
          if (assigned.has(key)) throw new Error('Duplicate answer mapping.')
          assigned.add(key)
          const part = separate.get(step.id) ?? { ids: [] }
          separate.set(step.id, part)
          if (isOther) {
            // A write-in is text even when it happens to be "0", "false", or an option label.
            if (value !== '') { part.ids.push(mapping.choice); part.otherText = value }
            continue
          }
          if (!value || value === '0' || value === 'false') continue
          if (!['1', 'true', step.choices.find(c => c.id === mapping.choice)!.label].includes(value)) throw new Error('Choice cell must be blank, 0/1, true/false, or the exact selected label.')
          part.ids.push(mapping.choice)
        } else {
          if (assigned.has(step.id)) throw new Error('More than one column maps to this answer.')
          assigned.add(step.id)
          if (value !== '') answers[step.id] = answer(value, step, google)
        }
      } catch (error) { errors.push({ row, column: label, message: (error as Error).message }) }
    }
    for (const [id, part] of separate) {
      const step = byId.get(id)!, other = otherChoiceId(step), whole = answers[id]
      if (assigned.has(id) && [...assigned].some(key => key.startsWith(`${id}:`) && key !== `${id}:${other}`)) {
        errors.push({ row, column: step.prompt, message: 'Whole answers cannot be combined with separate fixed-choice columns.' })
      } else if (whole !== undefined && part.otherText !== undefined) {
        const ids = importedChoiceIds(whole), text = importedOtherText(whole)
        if (!other || step.questionType !== 'multiple_choice' && !ids.includes(other) || text && text !== part.otherText) errors.push({ row, column: step.prompt, message: 'The separate Other text conflicts with this question’s selected answer.' })
        else answers[id] = choiceValue(step, ids.includes(other) ? ids : [...ids, other], part.otherText)
      } else if (whole === undefined && part.ids.length) answers[id] = choiceValue(step, part.ids, part.otherText)
    }
    for (const [id, value] of Object.entries(answers)) { const issue = mappedAnswerIssue(byId.get(id)!, value); if (issue) errors.push({ row, column: byId.get(id)!.prompt, message: issue }) }
    if (!submittedAt) errors.push({ row, column: 'Submission time', message: 'Map a nonempty original submission timestamp; times are never invented.' })
    if (startedAt && submittedAt && startedAt > submittedAt) errors.push({ row, column: 'Start time', message: 'Start is after submission.' })
    if (!malformed && errors.length === before && submittedAt) yield { row, startedAt, submittedAt, answers }
  }
}
