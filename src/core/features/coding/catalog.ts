import { ulid } from 'ulid'
import { NotFoundError } from '../../shared/errors'
export async function workspaceCode(db: D1Database, workspaceId: string, codeId: string) {
  const row=await db.prepare('SELECT id,label,created_by_operator_id AS createdByOperatorId,created_at AS createdAt FROM workspace_codes WHERE workspace_id=? AND id=?').bind(workspaceId,codeId).first()
  if (!row) throw new NotFoundError('This code is not in your workspace.')
  return row
}
export async function listCodes(db: D1Database, workspaceId: string, after?: string) {
  const rows=(await db.prepare(`SELECT id,label,created_by_operator_id AS createdByOperatorId,created_at AS createdAt FROM workspace_codes
    WHERE workspace_id=? ${after ? 'AND id>?' : ''} ORDER BY id LIMIT 101`).bind(workspaceId,...(after ? [after] : [])).all<{id:string;label:string;createdByOperatorId:string;createdAt:string}>()).results
  return {codes:rows.slice(0,100),nextAfter:rows.length>100 ? rows[99].id : null}
}
export async function createCode(db: D1Database, workspaceId: string, operatorId: string, label: string) {
  const normalized=label.normalize('NFKC').toLocaleLowerCase('en-US')
  await db.prepare(`INSERT INTO workspace_codes(id,workspace_id,label,normalized_label,created_by_operator_id,created_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,normalized_label) DO NOTHING`).bind(ulid(),workspaceId,label,normalized,operatorId,new Date().toISOString()).run()
  return db.prepare('SELECT id,label,created_by_operator_id AS createdByOperatorId,created_at AS createdAt FROM workspace_codes WHERE workspace_id=? AND normalized_label=?').bind(workspaceId,normalized).first()
}
