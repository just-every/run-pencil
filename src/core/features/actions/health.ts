import type { TaskDeliveries, TaskStatus } from './deliveries'
import type { ActionReminders, ReminderDelivery } from './reminders'
import type { ActionService } from './service'

const taskReasons: Record<string, string> = {
  '3xx': 'The task receiver returned a redirect. Pencil did not follow it.',
  '4xx': 'The task receiver rejected the request with a client error.',
  '5xx': 'The task receiver returned a server error.',
  refused: 'Pencil refused the task destination before sending.',
  network: 'The connection ended without a confirmed task receipt. A task may already exist.',
  timeout: 'The task request timed out without a confirmed receipt. A task may already exist.',
  'invalid-response': 'The task receiver did not return a valid task receipt. A task may already exist.',
  abandoned: 'The task attempt did not finish. A task may already exist.',
}
const scheduleRepairs: Partial<Record<ActionReminders['state'], string[]>> = {
  no_owner: ['An operator must choose a current workspace owner for this action.'],
  owner_left: ['An operator must choose a current workspace owner for this action.'],
  no_email: ['An operator must correct the owner’s address or choose another current owner.'],
  unavailable: ['The installation owner must inspect and repair the mail configuration.'],
  paused: ['Reminders are paused after restoration. Retained occurrences will not be replayed.'],
  suppressed: ['Mail is suppressed here. Review the installation mode before expecting delivery.'],
}

function taskHealth(actionId: string, status: TaskStatus) {
  const delivery = status.delivery
  const repairPlan: string[] = []
  if (!status.available) repairPlan.push('The installation owner must configure the task connection before any operator send.')
  if (delivery && delivery.state !== 'confirmed') {
    if (delivery.state === 'unknown') repairPlan.push('Check the destination for the original task key before deciding whether to retry; a task may already exist.')
    if (delivery.stale) repairPlan.push('An operator must review the current task preview and explicitly confirm it again. Retry cannot send a changed payload.')
    else if (delivery.inFlight) repairPlan.push('Wait for the current task attempt to finish before deciding whether to retry.')
    else repairPlan.push('After checking or repairing the connection, an operator may explicitly retry the unchanged confirmed payload with its original key.')
  }
  return {
    available: status.available,
    explanation: status.available ? 'The task connection is configured. This read does not test the receiver.' : 'The task connection is unavailable. This read does not test the receiver.',
    delivery: delivery ? {
      // The native task delivery has one row per action; action_id is its primary key.
      id: actionId, state: delivery.state, idempotencyKey: delivery.idempotencyKey, stale: delivery.stale, inFlight: delivery.inFlight,
      explanation: delivery.state === 'failed' ? 'The task delivery failed. Inspect the recorded attempts before repair.'
        : delivery.state === 'unknown' ? 'The task delivery has no confirmed outcome. A task may already exist.'
        : delivery.state === 'confirmed' ? 'The task receiver confirmed delivery. Pencil will not send it again.'
        : 'The task delivery is pending. No confirmed outcome is recorded.',
      attempts: delivery.attempts.filter(attempt => attempt.outcome === 'failed' || attempt.outcome === 'unknown' || (attempt.outcome === null && !delivery.inFlight)).map(attempt => ({
        id: attempt.id, ordinal: attempt.ordinal, outcome: attempt.outcome ?? 'unknown', httpStatus: attempt.httpStatus,
        explanation: taskReasons[attempt.outcomeClass ?? (attempt.outcome === null ? 'abandoned' : '')] ?? 'The task attempt did not confirm delivery. Inspect the destination before deciding on repair.',
      })),
    } : null,
    repairPlan,
  }
}

/** A native read only: no probe, scheduling, reconnection, recipient change or delivery. */
export async function readActionHealth(db: D1Database, actions: { records: ActionService; tasks: TaskDeliveries }, workspaceId: string, actionId: string) {
  // Resolve ownership first, including for an action with no task delivery.
  const action = await actions.records.get(workspaceId, actionId)
  const task = await actions.tasks.status(workspaceId, actionId)
  // Detail shows only recent reminders. Health must retain older failures as well.
  const occurrences = (await db.prepare(`SELECT d.id,d.kind,d.due_date AS dueDate,d.status,d.attempts FROM action_reminders d
    JOIN actions a ON a.id=d.action_id WHERE a.id=? AND a.workspace_id=? AND d.status IN ('failed','unknown')
    ORDER BY d.due_date,d.created_at,d.id`).bind(actionId, workspaceId).all<Pick<ReminderDelivery, 'id' | 'kind' | 'dueDate' | 'status' | 'attempts'>>()).results
  return {
    actionId,
    task: taskHealth(actionId, task),
    reminders: {
      schedule: { actionId, state: action.reminders.state, explanation: action.reminders.explanation, repairPlan: scheduleRepairs[action.reminders.state] ?? [] },
      occurrences: occurrences.map(occurrence => ({
        ...occurrence,
        explanation: occurrence.status === 'unknown' ? 'This reminder has an unknown delivery outcome. It may have arrived. Automatic resend is disabled.'
          : 'This reminder failed because sending was unavailable, the provider rejected it, or its bounded retries ended.',
        repairPlan: occurrence.status === 'unknown' ? ['An operator must check the provider outcome. This report cannot resend reminders.']
          : ['The installation owner must inspect the mail configuration and delivery history. This report cannot replay failed reminders.'],
      })),
    },
  }
}

export type ActionHealthReport = Awaited<ReturnType<typeof readActionHealth>>
