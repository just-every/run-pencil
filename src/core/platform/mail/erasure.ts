// Local Base delivery IDs are the delivery's idempotency key, not its row ID.
// Execute these statements inside the erasure batch, before deleting responses:
// the response-erasure trigger clears the participant's contact relationship.
export function eraseContactLocalMail(db: D1Database, contactId: string, workspaceId: string) {
  return db.prepare(`DELETE FROM local_mail_outbox WHERE delivery_id IN (
    SELECT d.idempotency_key FROM mail_deliveries d JOIN invitation_participants p ON p.id = d.participant_id
    WHERE p.contact_id = ? AND p.workspace_id = ?)`)
    .bind(contactId, workspaceId)
}

export function eraseResponseLocalMail(db: D1Database, responseId: string, workspaceId: string, auditId: string) {
  return db.prepare(`DELETE FROM local_mail_outbox WHERE delivery_id IN (
    SELECT d.idempotency_key FROM mail_deliveries d JOIN responses r ON r.participant_id = d.participant_id
    WHERE r.id = ? AND r.workspace_id = ?)
    AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`)
    .bind(responseId, workspaceId, auditId)
}
