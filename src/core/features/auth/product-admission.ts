import { ulid } from 'ulid'

// Native admission and the product mapping share these statements. Reads never
// create mappings: a lost mapping must continue to deny access.
export function productAdmission(database: D1Database, authId: string, setup: boolean) {
  const operatorId = ulid(), now = new Date().toISOString()
  return { operatorId, statements: [
    database.prepare(`INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at)
      SELECT ?,w.id,o.email,o.display_name,CASE WHEN ? AND w.setup_operator_initialized_at IS NULL THEN 1 ELSE 0 END,?,?
      FROM oa_operators o JOIN workspaces w ON w.id=COALESCE(
        (SELECT p.workspace_id FROM oa_tokens t JOIN operator_auth_links l ON l.auth_id=t.issuer_id JOIN operators p ON p.id=l.operator_id WHERE t.operator_id=o.id LIMIT 1),
        (SELECT id FROM workspaces ORDER BY created_at,id LIMIT 1))
      WHERE o.id=? AND NOT EXISTS(SELECT 1 FROM operator_auth_links WHERE auth_id=o.id)`)
      .bind(operatorId, setup ? 1 : 0, now, now, authId),
    database.prepare(`UPDATE workspaces SET setup_operator_initialized_at=COALESCE(setup_operator_initialized_at,?)
      WHERE id IN (SELECT workspace_id FROM operators WHERE id=? AND is_setup_operator=1)`).bind(now, operatorId),
    database.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
      SELECT ?,workspace_id,'operator.setup_bootstrapped',id,'operator',id,'{"feature":"operator-auth"}',?
      FROM operators WHERE id=? AND is_setup_operator=1`).bind(ulid(), now, operatorId),
  ] }
}
