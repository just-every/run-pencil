import { nextReminderDate, type ReminderKind } from './reminder-schedule'
export type ReminderDelivery = { id: string; kind: ReminderKind; dueDate: string; status: 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'cancelled'; attempts: number; reason: string | null; updatedAt: string }
export type ActionReminders = { channel: 'email'; state: 'scheduled' | 'stopped' | 'paused' | 'no_owner' | 'owner_left' | 'no_email' | 'unavailable' | 'suppressed'; explanation: string;
  nextDate: string | null; timeZone: string; sendingWindowStart: string; sendingWindowEnd: string; deliveries: ReminderDelivery[] }
export async function readActionReminders(db: D1Database, workspaceId: string, actionId: string, today: string, senderFailure: string | null, suppressed: boolean): Promise<ActionReminders> {
  const row = await db.prepare(`SELECT a.verdict,a.state,a.reminders_enabled AS enabled,a.review_date AS reviewDate,o.id AS ownerId,o.email,
    EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators auth ON auth.id=l.auth_id WHERE l.operator_id=o.id AND auth.status='inactive') AS inactive,
    w.time_zone AS timeZone,w.sending_window_start AS sendingWindowStart,w.sending_window_end AS sendingWindowEnd
    FROM actions a JOIN workspaces w ON w.id=a.workspace_id LEFT JOIN operators o ON o.id=a.owner_operator_id AND o.workspace_id=a.workspace_id
    WHERE a.id=? AND a.workspace_id=?`).bind(actionId,workspaceId).first<{verdict:string|null;state:string;enabled:number;reviewDate:string;ownerId:string|null;email:string|null;inactive:number;timeZone:string;sendingWindowStart:string;sendingWindowEnd:string}>()
  if (!row) throw new Error('The action reminder record no longer exists.')
  const deliveries = (await db.prepare(`SELECT id,kind,due_date AS dueDate,status,attempts,reason,updated_at AS updatedAt FROM action_reminders WHERE action_id=? ORDER BY due_date DESC,created_at DESC,id DESC LIMIT 30`)
    .bind(actionId).all<ReminderDelivery>()).results
  let state: ActionReminders['state'] = 'scheduled', explanation = 'Email reminders go to the action owner three days before review, on the review date, and every seven days after while unresolved.'
  if (row.verdict || row.state === 'closed') { state = 'stopped'; explanation = 'Reminders stopped because the action has a verdict or is closed.' }
  else if (!row.enabled) { state = 'paused'; explanation = 'Reminders are paused after restoration. Retained delivery history will not replay mail.' }
  else if (!row.ownerId) { state = 'no_owner'; explanation = 'No email will be sent: this action has no current owner. Choose a workspace operator.' }
  else if (row.inactive) { state = 'owner_left'; explanation = 'No email will be sent: the owner has left the workspace. Choose a current operator.' }
  else if (!row.email?.trim()) { state = 'no_email'; explanation = 'No email will be sent: the owner has no email address. Update the owner’s address or choose another operator.' }
  else if (senderFailure) { state = 'unavailable'; explanation = 'No reminder email can be sent until this installation’s mail configuration is fixed.' }
  else if (suppressed) { state = 'suppressed'; explanation = 'Email is suppressed on this development or demo installation. The reminder schedule and delivery history are retained.' }
  return { channel: 'email', state, explanation, nextDate: ['scheduled','suppressed'].includes(state) ? deliveries.filter(d=>d.status==='pending' || d.status==='sending').at(-1)?.dueDate ?? nextReminderDate(row.reviewDate,today,deliveries) : null,
    timeZone: row.timeZone, sendingWindowStart: row.sendingWindowStart, sendingWindowEnd: row.sendingWindowEnd, deliveries }
}
