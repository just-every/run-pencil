import { workspaceToday } from '../actions/service'
import { reminderDates } from '../actions/reminder-schedule'

export const activeReminderOwner = `o.id=a.owner_operator_id AND o.workspace_id=a.workspace_id
  AND trim(o.email)<>'' AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators auth ON auth.id=l.auth_id WHERE l.operator_id=o.id AND auth.status='inactive')`
export const actionReminderEligible = `a.reminders_enabled=1 AND a.verdict IS NULL AND a.state IN ('planned','in_progress','ready_for_review')
  AND d.review_date=a.review_date AND d.operator_id=a.owner_operator_id AND ${activeReminderOwner}`

/** Materialize before checking hours: closed windows never discard due work. */
export async function materializeActionReminders(db: D1Database, now: string) {
  let cursor = ''
  while (true) {
    const actions = await db.prepare(`SELECT a.id,a.owner_operator_id AS ownerId,a.review_date AS reviewDate,a.created_at AS createdAt,w.time_zone AS timeZone,
      (SELECT MAX(d.due_date) FROM action_reminders d WHERE d.action_id=a.id AND d.kind='overdue' AND d.review_date=a.review_date) AS lastOverdue
      FROM actions a JOIN workspaces w ON w.id=a.workspace_id
      WHERE a.id>? AND a.reminders_enabled=1 AND a.verdict IS NULL AND a.state IN ('planned','in_progress','ready_for_review') ORDER BY a.id LIMIT 100`)
      .bind(cursor).all<{id:string;ownerId:string|null;reviewDate:string;createdAt:string;timeZone:string;lastOverdue:string|null}>()
    if (!actions.results.length) break
    const payload = actions.results.flatMap(action => reminderDates(action.reviewDate, workspaceToday(action.timeZone, new Date(now)), workspaceToday(action.timeZone, new Date(action.createdAt)), action.lastOverdue)
      .map(date => ({ ...date, id: crypto.randomUUID(), actionId: action.id, operatorId: action.ownerId, reviewDate: action.reviewDate, key: crypto.randomUUID() })))
    if (payload.length) await db.prepare(`INSERT OR IGNORE INTO action_reminders(id,action_id,operator_id,kind,due_date,review_date,status,idempotency_key,available_at,created_at,updated_at)
      SELECT json_extract(j.value,'$.id'),a.id,a.owner_operator_id,json_extract(j.value,'$.kind'),json_extract(j.value,'$.dueDate'),a.review_date,'pending',json_extract(j.value,'$.key'),?,?,?
      FROM json_each(?) j JOIN actions a ON a.id=json_extract(j.value,'$.actionId')
      WHERE a.reminders_enabled=1 AND a.verdict IS NULL AND a.state IN ('planned','in_progress','ready_for_review') AND a.review_date=json_extract(j.value,'$.reviewDate')`)
      .bind(now,now,now,JSON.stringify(payload)).run()
    cursor = actions.results.at(-1)!.id
  }
}

/** Ambiguous transport is terminal. Neither a repeated tick nor recovery resends it. */
export async function interruptActionReminders(db: D1Database, now: string) {
  const cutoff = new Date(Date.parse(now) - 300_000).toISOString()
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO action_reminder_attempts(id,reminder_id,ordinal,event,created_at)
      SELECT 'interrupted:'||d.id||':'||d.attempts,d.id,d.attempts,'unknown',? FROM action_reminders d JOIN actions a ON a.id=d.action_id
      WHERE d.status='sending' AND a.reminders_enabled=1 AND d.last_attempt_at<?`).bind(now,cutoff),
    db.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
      SELECT lower(hex(randomblob(16))),a.workspace_id,'action.reminder',NULL,'action-reminder',NULL,'{"status":"unknown"}',?
      FROM action_reminders d JOIN actions a ON a.id=d.action_id WHERE d.status='sending' AND a.reminders_enabled=1 AND d.last_attempt_at<?`).bind(now,cutoff),
    db.prepare(`UPDATE action_reminders SET status='unknown',reason='Sender interrupted. Automatic resend is disabled because delivery may have succeeded.',updated_at=?
      WHERE status='sending' AND last_attempt_at<? AND EXISTS(SELECT 1 FROM actions a WHERE a.id=action_reminders.action_id AND a.reminders_enabled=1)`).bind(now,cutoff),
  ])
}
