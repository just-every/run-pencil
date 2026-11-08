import type { TaskStatus } from './deliveries'
import type { ActionReminders, ReminderDelivery } from './reminders'

const taskReasons: Record<string, string> = {
  '3xx': 'The task receiver returned a redirect; Pencil did not follow it.',
  '4xx': 'The task receiver refused the request. Check the connection and its access; the status alone does not establish why.',
  '5xx': 'The task receiver reported a server error.',
  network: 'The connection ended without a confirmed task. The receiver may have created it.',
  timeout: 'The task request timed out without confirmation. The receiver may have created it.',
  'invalid-response': 'The task receiver did not return a valid confirmation. A task may already exist.',
  abandoned: 'The task attempt did not finish. A task may already exist.',
  refused: 'Pencil refused the configured task destination.',
}

const reminderPlans: Partial<Record<ActionReminders['state'], string[]>> = {
  no_owner: ['An operator must choose a current workspace owner before future reminders can send.'],
  owner_left: ['An operator must choose a current workspace owner before future reminders can send.'],
  no_email: ['An operator must review and explicitly update the owner address or choose another current owner.'],
  unavailable: ['The installation owner must review and repair mail configuration before future reminders can send.'],
  paused: ['Review the restored schedule and recipients. Retained reminder history must not be replayed.'],
  suppressed: ['Mail is suppressed on this installation. This report does not enable sending.'],
}

/** A projection of native records only: no provider probe, inferred root cause, payload or repair execution. */
function actionHealth(actionId: string, task: TaskStatus, reminders: ActionReminders) {
  const delivery = task.delivery
  const attempts = delivery?.attempts.filter(attempt => attempt.outcome === 'failed' || attempt.outcome === 'unknown'
    || (attempt.outcome === null && delivery.state === 'unknown' && !delivery.inFlight)).map(attempt => ({
    id: attempt.id, ordinal: attempt.ordinal, state: attempt.outcome ?? 'unknown', httpStatus: attempt.httpStatus,
    explanation: taskReasons[attempt.outcomeClass ?? 'abandoned'] ?? 'The task attempt was not confirmed. Review the retained delivery record.',
  })) ?? []
  const repairPlan: string[] = []
  if (delivery && delivery.state !== 'confirmed') {
    if (delivery.inFlight) repairPlan.push('Wait for the current task attempt to finish before considering another send.')
    else {
      if (!task.available) repairPlan.push('The installation owner must explicitly repair the task connection.')
      repairPlan.push(delivery.stale
        ? 'The action no longer matches the confirmed payload. Review the current task preview and explicitly confirm it again.'
        : 'Review the retained attempts and receiver state. Only an explicit operator retry may reuse the confirmed payload and original key.')
    }
  } else if (!task.available) repairPlan.push('The installation owner must explicitly repair the task connection; this read does not connect or send.')
  return {
    actionId,
    scope: 'Native action task and owner email reminders only.',
    operatorApprovalRequired: true,
    task: {
      available: task.available,
      explanation: !task.available ? 'The task connection is unavailable on this installation.'
        : delivery?.state === 'failed' ? 'The task delivery failed. Review its retained attempts.'
          : delivery?.state === 'unknown' ? 'Task delivery is unconfirmed; a task may already exist at the receiver.'
            : delivery?.state === 'confirmed' ? 'The task receiver confirmed delivery. Earlier failed or unknown attempts remain in history.'
              : delivery ? 'The task is pending.' : 'No task delivery has been confirmed by an operator.',
      delivery: delivery ? { actionId, idempotencyKey: delivery.idempotencyKey, state: delivery.state, stale: delivery.stale, inFlight: delivery.inFlight, attempts } : null,
      repairPlan,
    },
    reminders: {
      // A native schedule belongs to the action; occurrences have their own retained IDs.
      actionId, state: reminders.state, explanation: reminders.explanation,
      repairPlan: reminderPlans[reminders.state] ?? [],
      history: 'All retained failed and unknown reminder occurrences.',
      occurrences: reminders.deliveries.filter(item => item.status === 'failed' || item.status === 'unknown').map(item => ({
        id: item.id, kind: item.kind, dueDate: item.dueDate, state: item.status, attempts: item.attempts,
        explanation: item.status === 'unknown'
          ? 'Reminder delivery is unknown. It may have succeeded; automatic resend is disabled.'
          : 'This reminder failed. The retained record does not establish successful delivery.',
        repairPlan: item.status === 'unknown'
          ? ['Review the retained occurrence and provider evidence. Leave this occurrence unresent; this report provides no reminder replay.']
          : ['Review mail configuration and the retained occurrence. Repairing future scheduling does not replay this reminder.'],
      })),
    },
  }
}

export async function readActionHealth(db: D1Database, workspaceId: string, actionId: string, task: TaskStatus, reminders: ActionReminders) {
  // The normal detail reader shows recent history. A health report must also include older unresolved failures.
  const failures = (await db.prepare(`SELECT d.id,d.kind,d.due_date AS dueDate,d.status,d.attempts,d.reason,d.updated_at AS updatedAt
    FROM action_reminders d JOIN actions a ON a.id=d.action_id
    WHERE a.id=? AND a.workspace_id=? AND d.status IN ('failed','unknown') ORDER BY d.due_date DESC,d.created_at DESC,d.id DESC`)
    .bind(actionId, workspaceId).all<ReminderDelivery>()).results
  return actionHealth(actionId, task, { ...reminders, deliveries: failures })
}

export type ActionHealthReport = ReturnType<typeof actionHealth>
