import { ratingScale } from '../../shared/ratingScale'
import { scoreOptions } from '../../shared/scoreQuestions'
import { contactExportFields } from '../../shared/contactAnswers'
import { isOtherAnswer } from '../../shared/otherChoices'
import { ValidationError } from '../../shared/errors'
import { isContactType } from './contactReports'
import { responseScope, type ResponseSelection } from './scope'
import type { ExportInventory, InventoryQuestion } from './exportInventory'
import type { LedgerFilter, LedgerResponse } from './repository'

/** SPSS variables of a LEDG-005 export: the CSV's response columns, then hidden fields, calculations and questions. */
export type SavValue = number | string | null
export type SavVariable = { name: string; label: string; string: boolean; valueLabels?: Array<[number, string]>; read: (row: LedgerResponse, cutoff: string, excluded: number) => SavValue; bound?: string }
export const savStringLimit = 32767
const fixed: Array<[string, boolean, (row: LedgerResponse, cutoff: string, excluded: number) => SavValue, string]> = [
  ['response_id', true, row => row.id, 'id'], ['revision_id', true, row => row.revisionId, 'revision'], ['revision_number', false, row => row.revisionNumber, ''],
  ['source', true, row => row.source, 'source'], ['started_at', true, row => row.startedAt ?? '', 'started'], ['completed_at', true, row => row.completedAt, 'completed'], ['released_at', true, row => row.releasedAt ?? '', 'released'],
  ['cutoff', true, (_row, cutoff) => cutoff, 'cutoff'], ['excluded_quarantined', false, (_row, _cutoff, excluded) => excluded, ''],
  ['collector_id', true, row => row.collector.id, 'collectorId'], ['collector_name', true, row => row.collector.name, 'collectorName'], ['collector_channel', true, row => row.collector.channel, 'collectorChannel'],
  ['response_state', true, row => row.state, 'state'], ['exclusion_reason', true, row => row.quarantineReason ?? '', 'reason'], ['identity_mode', true, row => row.identityMode, 'identity'],
  ['discarded_parameters', false, row => row.discardedParameters, ''], ['verified_email', true, row => row.verifiedEmail ?? '', 'verifiedEmail'], ['verified_subject', true, row => row.verifiedSubject ?? '', 'verifiedSubject'],
  ['participant_id', true, row => row.participant?.id ?? '', 'participantId'], ['participant_name', true, row => row.participant?.name ?? '', 'participantName'], ['participant_email', true, row => row.participant?.email ?? '', 'participantEmail'],
  ['omitted_questions_json', true, row => JSON.stringify(row.omittedQuestions), 'omitted'], ['presented_order_json', true, row => JSON.stringify(row.presentedOrder), 'presented'],
]
const boolLabels: Record<string, [string, string]> = { yes_no: ['Yes', 'No'], thumbs_rating: ['Thumbs up', 'Thumbs down'], consent: ['Accepted', 'Declined'] }
const answerOf = (row: LedgerResponse, question: InventoryQuestion) => row.answers.find(answer => answer.stepId === question.id && answer.questionType === question.type)

function questionVariables(question: InventoryQuestion): SavVariable[] {
  const { name, prompt, type } = question
  const choiceIds = (value: unknown) => isOtherAnswer(value) ? value.choiceIds : Array.isArray(value) ? value as string[] : typeof value === 'string' ? [value] : []
  const other = question.choices.length && question.settings.otherChoiceId !== undefined ? [{ name: `${name}_other`, label: `${prompt}: Other text`, string: true, bound: `other:${question.key}`, read: (row: LedgerResponse) => { const value = answerOf(row, question)?.value; return isOtherAnswer(value) ? value.otherText : '' } }] : []
  if (type === 'single_choice' || type === 'dropdown') return [{ name, label: prompt, string: false, valueLabels: question.choices.map(choice => [choice.code, choice.label]), read: row => {
    const answer = answerOf(row, question); if (!answer) return null
    const code = question.choices.find(choice => choice.id === choiceIds(answer.value)[0])?.code
    if (code === undefined) throw new Error('A retained answer is missing its published choice.')
    return code
  } }, ...other]
  if (type === 'multiple_choice' || type === 'priority') return [...question.choices.map(choice => ({ name: `${name}_${choice.code}`, label: `${prompt}: ${choice.label}`, string: false,
    valueLabels: type === 'multiple_choice' ? [[1, 'Selected'], [0, 'Not selected']] as Array<[number, string]> : undefined,
    read: (row: LedgerResponse) => {
      const answer = answerOf(row, question)
      if (!answer || !choice.revisions.has(row.revisionId)) return null
      const index = choiceIds(answer.value).indexOf(choice.id)
      return type === 'multiple_choice' ? index >= 0 ? 1 : 0 : index >= 0 ? index + 1 : null
    } })), ...other]
  if (boolLabels[type]) return [{ name, label: prompt, string: false, valueLabels: [[1, boolLabels[type][0]], [0, boolLabels[type][1]]], read: row => {
    const value = answerOf(row, question)?.value
    if (value === undefined) return null
    const accepted = type === 'consent' ? (value as { accepted?: unknown }).accepted : value
    return accepted === true ? 1 : accepted === false ? 0 : null
  } }]
  if (['rating', 'nps', 'number', 'csat', 'ces', 'emoji_rating'].includes(type)) {
    let valueLabels: Array<[number, string]> | undefined
    if (type === 'rating') { const scale = ratingScale(question.settings); valueLabels = ([[scale.min, scale.lowLabel], [(scale.min + scale.max) / 2, scale.middleLabel], [scale.max, scale.highLabel]] as Array<[number, string]>).filter(([value, label]) => label && Number.isInteger(value)) }
    if (['csat', 'ces', 'emoji_rating'].includes(type)) valueLabels = scoreOptions(type).map(option => [Number(option.value), option.label])
    return [{ name, label: prompt, string: false, valueLabels, read: row => { const value = answerOf(row, question)?.value; return typeof value === 'number' ? value : null } }]
  }
  if (isContactType(type)) return Object.keys(contactExportFields(type, undefined)).map(field => ({ name: `${name}_${field.replace(/[^A-Za-z0-9_]/g, '_')}`, label: `${prompt}: ${field}`, string: true, bound: `contact:${question.key}`,
    read: (row: LedgerResponse) => { const answer = answerOf(row, question); return answer ? String(contactExportFields(type, answer.value)[field] ?? '') : '' } }))
  return [{ name, label: prompt, string: true, bound: `text:${question.key}`, read: row => { const value = answerOf(row, question)?.value; return value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value) } }]
}

export function savVariables(inventory: ExportInventory): SavVariable[] {
  const variables: SavVariable[] = fixed.map(([name, string, read, bound]) => ({ name, label: name.replaceAll('_', ' '), string, read, bound: bound || undefined }))
  for (const field of inventory.hiddenFields) variables.push({ name: `hidden_${field.name}`, label: `Hidden field ${field.name}`, string: !['number', 'boolean'].includes(field.type), bound: `hidden:${field.id}`,
    valueLabels: field.type === 'boolean' ? [[1, 'true'], [0, 'false']] : undefined,
    read: row => { const value = row.hiddenFields.find(item => item.id === field.id)?.value; return value === undefined ? field.type === 'number' || field.type === 'boolean' ? null : '' : typeof value === 'boolean' ? Number(value) : field.type === 'number' ? Number(value) : String(value) } })
  for (const calculation of inventory.calculations) variables.push({ name: `calc_${calculation.name}`, label: `Calculated ${calculation.name}`, string: calculation.type !== 'number', bound: `calc:${calculation.id}`,
    read: row => { const value = row.calculations.find(item => item.id === calculation.id)?.value; return value === undefined || value === null ? calculation.type === 'number' ? null : '' : value } })
  for (const question of inventory.questions) variables.push(...questionVariables(question))
  const used = new Set<string>()
  for (const variable of variables) {
    let base = variable.name.replace(/[^A-Za-z0-9_.]/g, '_').replace(/^[^A-Za-z]/, 'v$&').slice(0, 60), name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}_${n}`
    used.add(name.toLowerCase()); variable.name = name
  }
  if (variables.some(variable => variable.read === undefined)) throw new Error('An SPSS variable has no reader.')
  return variables
}

/** Upper bounds, in UTF-8 bytes, of every string variable over the selection, read once at export start. */
export async function savWidths(db: D1Database, inventory: ExportInventory, variables: SavVariable[], workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: ResponseSelection) {
  const { where, bindings } = responseScope(workspaceId, flowId, filter, cutoff, state)
  const bytes = (sql: string) => `MAX(length(CAST(${sql} AS BLOB)))`
  const ctx = (path: string) => bytes(`COALESCE(json_extract(r.response_context_json, '$.${path}'), '')`)
  const marks = inventory.revisionIds.map(() => '?').join(',') || "''"
  const [base, collector, participant, omitted, answers, hidden, calculations] = await db.batch([
    db.prepare(`SELECT ${bytes('r.id')} AS id, ${bytes('r.revision_id')} AS revision, ${bytes('r.source')} AS source, ${bytes("COALESCE(r.started_at,'')")} AS started, ${bytes('r.completed_at')} AS completed, ${bytes("COALESCE(r.released_at,'')")} AS released, ${bytes('r.state')} AS state, ${bytes("COALESCE(r.quarantine_reason,'')")} AS reason, ${ctx('verifiedEmail')} AS verifiedEmail, ${ctx('verifiedSubject')} AS verifiedSubject, ${ctx('presentedOrder')} AS presented FROM responses r WHERE ${where}`).bind(...bindings),
    db.prepare(`SELECT ${bytes('c.id')} AS collectorId, ${bytes('c.name')} AS collectorName, ${bytes('c.channel')} AS collectorChannel FROM responses r JOIN response_collector rc ON rc.response_id = r.id JOIN collectors c ON c.id = rc.collector_id WHERE ${where}`).bind(...bindings),
    db.prepare(`SELECT ${bytes('p.id')} AS participantId, ${bytes("COALESCE(p.name_snapshot,'')")} AS participantName, ${bytes("COALESCE(p.email_snapshot,'')")} AS participantEmail FROM responses r JOIN invitation_participants p ON p.id = r.participant_id WHERE ${where}`).bind(...bindings),
    db.prepare(`SELECT MAX(total) AS omitted FROM (SELECT 2 + SUM(length(CAST(json_object('stepId', s.stable_id, 'label', s.prompt, 'position', s.position, 'questionType', s.question_type) AS BLOB)) + 1) AS total FROM flow_steps s WHERE s.kind = 'question' AND s.revision_id IN (${marks}) GROUP BY s.revision_id)`).bind(...inventory.revisionIds),
    db.prepare(`SELECT a.step_id AS stepId, s.question_type AS type, ${bytes("COALESCE(json_extract(a.value_json, '$'), '')")} AS text, ${bytes("COALESCE(json_extract(a.value_json, '$.otherText'), '')")} AS other, ${bytes('a.value_json')} AS raw FROM response_answers a JOIN responses r ON r.id = a.response_id JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id WHERE ${where} GROUP BY a.step_id, s.question_type`).bind(...bindings),
    db.prepare(`SELECT h.key AS id, ${bytes('h.value')} AS width FROM responses r, json_each(r.response_context_json, '$.hidden') h WHERE ${where} GROUP BY h.key`).bind(...bindings),
    db.prepare(`SELECT c.key AS id, ${bytes('c.value')} AS width FROM responses r, json_each(r.response_context_json, '$.calculations') c WHERE ${where} GROUP BY c.key`).bind(...bindings),
  ])
  const first = (result: D1Result) => (result.results[0] ?? {}) as Record<string, number | null>
  const named: Record<string, number | null> = { ...first(base), ...first(collector), ...first(participant), ...first(omitted), cutoff: 24, identity: 10 }
  const answerRows = answers.results as Array<{ stepId: string; type: string; text: number; other: number; raw: number }>
  const keyed = (rows: D1Result) => new Map((rows.results as Array<{ id: string; width: number }>).map(row => [row.id, row.width]))
  const hiddenWidths = keyed(hidden), calculationWidths = keyed(calculations)
  return variables.map(variable => {
    if (!variable.string) return 0
    const [kind, key] = [variable.bound!.slice(0, variable.bound!.indexOf(':')), variable.bound!.slice(variable.bound!.indexOf(':') + 1)]
    const answer = (questionKey: string) => answerRows.find(row => `${row.stepId}\0${row.type}` === questionKey)
    // Contact fields are derived from the stored answer; a formatted field may add separators.
    const width = !variable.bound!.includes(':') ? named[variable.bound!] : kind === 'hidden' ? hiddenWidths.get(key) : kind === 'calc' ? calculationWidths.get(key)
      : kind === 'other' ? answer(key)?.other : kind === 'text' ? answer(key)?.text : kind === 'contact' ? (answer(key)?.raw ?? 0) * 2 + 64 : undefined
    const bounded = Math.max(8, width ?? 0)
    if (bounded > savStringLimit) throw new ValidationError(`${variable.name} holds text longer than the SPSS string limit of ${savStringLimit} bytes. Export CSV, JSON or XLSX for this selection.`)
    return bounded
  })
}
