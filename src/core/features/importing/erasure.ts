import { retireD1ImportCustody, type D1ImportContext, type D1Sql } from '../../../base/import-kit/src/d1/index'
import { ValidationError } from '../../shared/errors'
import { restoreCheckpoint } from '../../platform/restore/checkpoint'
import { importContext } from './service'
import { ordinaryErasureGuards } from './erasure-decision'

/** The exact identifiers an imported response holds: its answers to email questions. A name is not an identifier. */
async function responseIdentifiers(database: D1Database, responseId: string) {
  const { results } = await database.prepare(`SELECT DISTINCT json_extract(a.value_json,'$') AS value FROM response_answers a JOIN flow_steps s ON s.id=a.step_id
    WHERE a.response_id=? AND s.question_type='email' AND json_type(a.value_json)='text'`).bind(responseId).all<{ value: string }>()
  return results.map(row => row.value).filter(value => value.length > 0)
}

export async function eraseResponseAndImportCustody(database: D1Database, input: { workspaceId: string; responseId: string; operatorId: string; sessionId?: string; retentionAuthority?: D1ImportContext }, statements: D1Sql[]): Promise<D1Result<unknown>[]> {
  const response = await database.prepare('SELECT source,state FROM responses WHERE id = ? AND workspace_id = ?').bind(input.responseId, input.workspaceId).first<{ source: string; state: string }>()
  if (response && response.state !== 'released' && !input.retentionAuthority) return []
  if (response?.source !== 'imported') {
    const guards = ordinaryErasureGuards(database, input, response?.source)
    const guarded = [guards.before, ...statements, restoreCheckpoint, guards.after, { sql: 'DELETE FROM ik_d1_assertions' }, guards.final]
    const results = await database.batch(guarded.map(statement => database.prepare(statement.sql).bind(...statement.params ?? [])))
    return results.slice(1, 1 + statements.length)
  }
  if (!input.sessionId && !input.retentionAuthority) throw new ValidationError('A current operator session is required to erase imported response custody.')
  // Native rows, the response's records in every import (tombstones, so other respondents keep undo and resume),
  // any import labelled with exactly one of its identifiers, the erasure journal and the restore checkpoint commit in one batch.
  const { maxBatchBytes: _bounded, ...context } = input.retentionAuthority ?? importContext(database, { id: input.sessionId!, workspaceId: input.workspaceId, operatorId: input.operatorId }, 'response-erasure')
  const values = await responseIdentifiers(database, input.responseId)
  const result = await retireD1ImportCustody({ target: { kind: 'response', id: input.responseId }, values }, statements, context, [restoreCheckpoint])
  return result.nativeResults as D1Result<unknown>[]
}
