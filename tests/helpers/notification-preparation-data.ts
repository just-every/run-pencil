/** Independent operator and participant rows make collateral-change assertions nonempty. */
export async function notificationMetadataGuards(f: { db: D1Database; workspaceId: string; flowId: string; responseId: string; now: string }) {
  const operator = crypto.randomUUID(), launch = crypto.randomUUID(), participant = crypto.randomUUID()
  await f.db.batch([
    f.db.prepare('INSERT INTO operators(id,workspace_id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .bind(operator, f.workspaceId, `${operator}@example.test`, 'Unrelated operator', f.now, f.now),
    f.db.prepare("INSERT INTO notification_preferences(flow_id,operator_id,mode,failure_reason,updated_at) VALUES(?,?,'off','Unrelated mail preference',?)")
      .bind(f.flowId, operator, f.now),
    f.db.prepare("INSERT INTO invitation_launches(id,workspace_id,revision_id,command_key,policy_json,created_at) SELECT ?,workspace_id,revision_id,?,'{}',? FROM responses WHERE id=?")
      .bind(launch, launch, f.now, f.responseId),
    f.db.prepare("INSERT INTO invitation_participants(id,launch_id,workspace_id,revision_id,email_snapshot,name_snapshot,delivery_status,response_status,created_at) SELECT ?,?,workspace_id,revision_id,'respondent@example.test','Private respondent','sent','completed',? FROM responses WHERE id=?")
      .bind(participant, launch, f.now, f.responseId),
  ])
}
