import { responseScope, type ResponseSelection } from './scope'
import type { LedgerFilter, LedgerResponse } from './repository'

/** Row columns come from published definitions, including rows no response answered. */
export async function matrixColumns(db: D1Database, workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: ResponseSelection, signal?: AbortSignal) {
  const scope = responseScope(workspaceId, flowId, filter, cutoff, state)
  const columns: string[] = []
  let after = ''
  for (;;) {
    signal?.throwIfAborted()
    const page = (await db.prepare(`SELECT DISTINCT s.stable_id||'.'||json_extract(row.value,'$.id') AS name
      FROM flow_steps s, json_each(s.question_settings_json,'$.matrixRows') row
      WHERE s.question_type='matrix' AND s.stable_id||'.'||json_extract(row.value,'$.id')>?
      AND s.revision_id IN (SELECT r.revision_id FROM responses r WHERE ${scope.where})
      ORDER BY name LIMIT 100`).bind(after, ...scope.bindings).all<{ name: string }>()).results
    columns.push(...page.map(row => row.name))
    if (page.length < 100) return columns
    after = page[page.length - 1].name
  }
}

export function matrixRecord(row: LedgerResponse): Array<[string, string]> {
  return row.answers.filter(answer => answer.questionType === 'matrix').flatMap(answer =>
    Object.entries(answer.value as Record<string, string | string[]>).map(([id, value]) => [`${answer.stepId}.${id}`, Array.isArray(value) ? JSON.stringify(value) : value] as [string, string]))
}
