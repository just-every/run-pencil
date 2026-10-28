import { NotFoundError } from '../../shared/errors'
import { activeAssignment } from '../coding'
import { resolveDimension, type Dimension } from './crosstabDimensions'

export const sharedDimensionPattern = /^(?:(?:question|hidden|variable|code):[^\u0000-\u001f\u007f]{1,200}|matrix:[^:\u0000-\u001f\u007f]{1,200}:[^:\u0000-\u001f\u007f]{1,200}|collector)$/
export type SharedDimension = Omit<Dimension, 'kind'> & { kind: Dimension['kind'] | 'code' }

export async function resolveSharedDimension(db: D1Database, workspaceId: string, flowId: string, revisionId: string, key: string, cutoff: string): Promise<SharedDimension> {
  if (!key.startsWith('code:')) return resolveDimension(db, flowId, revisionId, key)
  const id = key.slice(5)
  const code = await db.prepare('SELECT label FROM workspace_codes WHERE id=? AND workspace_id=?').bind(id, workspaceId).first<{ label: string }>()
  if (!code) throw new NotFoundError('This code is not in your workspace.')
  return { key, kind: 'code', label: code.label, questionType: 'code', multipleSelect: false,
    categories: [{ key: 'true', label: code.label }, { key: 'false', label: `Without ${code.label}` }],
    note: 'Each response either has this code or does not; overlapping codes are separate binary dimensions.',
    valueSql: `SELECT s.rid,CASE WHEN EXISTS (SELECT 1 FROM answer_code_assignments ca JOIN response_answers caa ON caa.id=ca.answer_id
      WHERE ca.workspace_id=r.workspace_id AND caa.response_id=r.id AND ca.code_id=? AND ca.created_at<=? AND ${activeAssignment}) THEN 'true' ELSE 'false' END AS v
      FROM scoped s JOIN responses r ON r.id=s.rid`, bindings: [id, cutoff] }
}
