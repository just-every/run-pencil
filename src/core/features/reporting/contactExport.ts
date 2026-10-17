import { isChoiceQuestion, selectedChoiceIds, otherChoiceText } from '../../shared/choiceAnswers'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { contactExportFields } from '../../shared/contactAnswers'
import { ValidationError } from '../../shared/errors'
import { isContactType } from './contactReports'
import { responseScope } from './scope'
import type { LedgerFilter, LedgerResponse } from './repository'

/** The selected revision inventory is frozen even when an optional answer is blank. */
export async function contactColumnInventory(db: D1Database, workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, signal?: AbortSignal) {
  const { where, bindings } = responseScope(workspaceId, flowId, filter, cutoff)
  const columns = new Map<string, Set<string>>()
  let after = ''
  for (;;) {
    signal?.throwIfAborted()
    const rows = (await db.prepare(`SELECT DISTINCT s.stable_id AS id, s.question_type AS type
      FROM flow_steps s WHERE (s.question_type IN ('phone','postal_address','full_name','url','currency') OR (s.question_type IN ('single_choice','dropdown','multiple_choice') AND json_extract(s.question_settings_json,'$.otherChoiceId') IS NOT NULL))
      AND s.stable_id||char(0)||s.question_type>?
      AND s.revision_id IN(SELECT r.revision_id FROM responses r WHERE ${where})
      ORDER BY s.stable_id,s.question_type LIMIT 100`).bind(after, ...bindings).all<{ id: string; type: string }>()).results
    for (const row of rows) {
      const fields = columns.get(row.id) ?? new Set<string>()
      if (isChoiceQuestion(row.type)) { fields.add('choices'); fields.add('other_text') }
      else for (const field of Object.keys(contactExportFields(row.type, undefined))) fields.add(field)
      columns.set(row.id, fields)
    }
    if (rows.length < 100) break
    const last = rows[rows.length - 1]
    after = `${last.id}\0${last.type}`
  }
  signal?.throwIfAborted()
  if (!columns.size) return undefined
  const ordered = [...columns].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).flatMap(([id, fields]) => {
    const paired = fields.has('choices') ? ['choices', 'other_text'] : []
    return [...paired, ...[...fields].filter(field => !paired.includes(field)).sort()].map(field => `${id}.${field}`)
  })
  const bytes = Buffer.from(JSON.stringify(ordered))
  // The cursor transport has an explicit 64 KiB limit. Never return a partial inventory.
  if (bytes.length > 4 * 1024 * 1024) throw new ValidationError('This CSV has too many answer columns. Select fewer published revisions and export again.')
  const inventory = Buffer.from(deflateRawSync(bytes)).toString('base64')
  if (inventory.length > 40000) throw new ValidationError('This CSV has too many answer columns for one export. Select fewer published revisions and export again.')
  return inventory
}

export function contactColumns(inventory?: string): string[] {
  return inventory ? JSON.parse(Buffer.from(inflateRawSync(Buffer.from(inventory, 'base64'), { maxOutputLength: 4 * 1024 * 1024 })).toString('utf8')) : []
}

export function contactRecord(row: LedgerResponse, columns: string[]): Array<string | number> {
  const values = new Map<string, string | number>()
  for (const answer of row.answers) {
    if (isContactType(answer.questionType)) for (const [key, value] of Object.entries(contactExportFields(answer.questionType, answer.value))) values.set(`${answer.stepId}.${key}`, value)
    if (isChoiceQuestion(answer.questionType)) {
      values.set(`${answer.stepId}.choices`, JSON.stringify(selectedChoiceIds(answer.value)))
      values.set(`${answer.stepId}.other_text`, otherChoiceText(answer.value) ?? '')
    }
  }
  return columns.map(column => values.get(column) ?? '')
}
