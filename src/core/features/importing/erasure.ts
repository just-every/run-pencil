import { eraseD1ImportTarget, type D1Sql } from '../../../base/import-kit/src/d1/index'
import { ValidationError } from '../../shared/errors'
import { importContext } from './service'
import { ordinaryErasureGuards } from './erasure-decision'

export async function eraseResponseAndImportCustody(database: D1Database, input: { workspaceId: string; responseId: string; operatorId: string; sessionId?: string }, statements: D1Sql[]): Promise<D1Result<unknown>[]> {
  const response = await database.prepare('SELECT source,state FROM responses WHERE id = ? AND workspace_id = ?').bind(input.responseId, input.workspaceId).first<{ source: string; state: string }>()
  if (response && response.state !== 'released') return []
  if (response?.source !== 'imported') {
    const guards = ordinaryErasureGuards(database, input, response?.source)
    const guarded = [guards.before, ...statements, guards.after, { sql: 'DELETE FROM ik_d1_assertions' }, guards.final]
    const results = await database.batch(guarded.map(statement => database.prepare(statement.sql).bind(...statement.params ?? [])))
    return results.slice(1, 1 + statements.length)
  }
  if (!input.sessionId) throw new ValidationError('A current operator session is required to erase imported response custody.')
  const context = importContext(database, { id: input.sessionId, workspaceId: input.workspaceId, operatorId: input.operatorId }, 'response-erasure')
  const result = await eraseD1ImportTarget('response', input.responseId, statements, context)
  return result.nativeResults as D1Result<unknown>[]
}
