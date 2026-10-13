/**
 * `task.destination.v1` (ACT-003): create a task, or return the one already created, for Pencil's
 * idempotency key. A repeated key must return the same remote task ID, so repeated activation or
 * delivery of one action cannot create a second task.
 */
export type TaskPayload = {
  idempotencyKey: string
  action: {
    title: string
    rationale: string
    owner: { name: string; email: string }
    metric: { name: string; unit: string; direction: 'increase' | 'decrease'; baseline: { value: number; source: string; observedAt: string } }
    reviewDate: string
    reportLink: string
  }
}

/** Unknown means the request may have reached the destination: retry with the same key, never a new one (ACT-007). */
export type TaskOutcome =
  | { outcome: 'confirmed'; remoteTaskId: string; httpStatus: number }
  | { outcome: 'failed'; outcomeClass: '3xx' | '4xx' | '5xx' | 'refused'; httpStatus?: number }
  | { outcome: 'unknown'; outcomeClass: 'timeout' | 'network' | 'invalid-response'; httpStatus?: number }

export interface TaskDestination {
  createOrGet(idempotencyKey: string, payload: TaskPayload): Promise<TaskOutcome>
}

export type { TaskDestinationConfiguration } from '../../platform/config/task-destination'
