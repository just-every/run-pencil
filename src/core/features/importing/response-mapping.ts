import type { CsvRow } from './csv'
import { calendarDate } from '../../shared/questionTypes'
import { answerIssue } from '../../shared/answers'
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
          const options = form.steps.flatMap(s => s.kind === 'question' && s.questionType === 'multiple_choice' ? s.choices.filter(c => c.label === header).map(c => ({ step: s.id, choice: c.id })) : [])
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
  const find = (label: string) => { const match = step.choices.filter(c => c.label === label || (!google && c.sourceId === label)); if (match.length !== 1) throw new Error('Choice must match exactly one label or reference.'); return match[0].id }
  if (['single_choice', 'dropdown'].includes(step.questionType!)) return find(value)
  if (google && step.questionType === 'multiple_choice') {
    // CSV-created questions have whole-cell observations, including grid rows
    // explicitly reconstructed beside a definition. Only actual choiceQuestion
    // definitions establish which comma-space tokens are checkbox selections.
    if (step.sourceType !== 'choiceQuestion') return [find(value)]
    if (step.choices.some(c => c.label.includes(', ') && value.includes(c.label))) throw new Error('Checkbox cell contains a separator-bearing option label; the export is ambiguous and cannot be decoded.')
    const labels = value.split(', ')
    if (new Set(labels).size !== labels.length) throw new Error('Checkbox cell repeats an option.')
    return labels.map(label => { const matches = step.choices.filter(c => c.label === label); if (matches.length !== 1) throw new Error('Checkbox cell must match whole known option labels separated by comma-space; ambiguous or unknown labels are refused.'); return matches[0].id })
  }
  if (step.questionType === 'priority' || step.questionType === 'multiple_choice') {
    let values: unknown
    try { values = JSON.parse(value) } catch { throw new Error('Use a JSON array of exact choice labels/references, or map separate choice columns. Commas are not separators.') }
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('Use a JSON array of choice labels/references.')
    return values.map(find)
  }
  throw new Error('Unsupported answer type.')
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
          if (step.questionType !== 'multiple_choice' || !step.choices.some(c => c.id === mapping.choice)) throw new Error('Separate choice columns require a known multiple-choice option.')
          const key = `${step.id}:${mapping.choice}`
          if (assigned.has(key) || assigned.has(step.id)) throw new Error('Duplicate answer mapping.')
          assigned.add(key)
          if (!value || value === '0' || value === 'false') continue
          if (!['1', 'true', step.choices.find(c => c.id === mapping.choice)!.label].includes(value)) throw new Error('Choice cell must be blank, 0/1, true/false, or the exact selected label.')
          answers[step.id] = [...(answers[step.id] as string[] ?? []), mapping.choice]
        } else {
          if (assigned.has(step.id) || [...assigned].some(key => key.startsWith(`${step.id}:`))) throw new Error('More than one column maps to this answer.')
          assigned.add(step.id)
          if (value !== '') answers[step.id] = answer(value, step, google)
        }
      } catch (error) { errors.push({ row, column: label, message: (error as Error).message }) }
    }
    for (const [id, value] of Object.entries(answers)) { const issue = mappedAnswerIssue(byId.get(id)!, value); if (issue) errors.push({ row, column: byId.get(id)!.prompt, message: issue }) }
    if (!submittedAt) errors.push({ row, column: 'Submission time', message: 'Map a nonempty original submission timestamp; times are never invented.' })
    if (startedAt && submittedAt && startedAt > submittedAt) errors.push({ row, column: 'Start time', message: 'Start is after submission.' })
    if (!malformed && errors.length === before && submittedAt) yield { row, startedAt, submittedAt, answers }
  }
}
