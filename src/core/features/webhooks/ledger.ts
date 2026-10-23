import type { WebhookAlert } from './endpoints'

export type LedgerAttempt = { ordinal: number; outcome: string | null; httpStatus: number | null; reason: string | null; at: string }
export type LedgerDelivery = {
  kind: 'webhook' | 'task'; id: string; subject: string; state: 'pending' | 'confirmed' | 'unknown' | 'failed'; idempotencyKey: string
  responseId: string | null; endpointId: string | null; actionId: string | null; updatedAt: string; attempts: LedgerAttempt[]
}
const states = { pending: 'pending', sending: 'pending', confirmed: 'confirmed', failed: 'failed', cancelled: 'failed' } as const

/**
 * INTEG-015: one read-only view over the deliveries that exist, response events and confirmed-action tasks. Identifiers, states,
 * idempotency keys and attempt reasons only: never answers, secrets or message bodies. Mail deliveries (DIST-006) keep their own
 * per-invitation screen and are not joined here; Sheets, rows, records, contacts, messages and files destinations are not built.
 */
export class IntegrationLedger {
  constructor(private readonly db: D1Database) {}

  async list(workspaceId: string, filter: { state?: LedgerDelivery['state']; limit?: number } = {}): Promise<LedgerDelivery[]> {
    const limit = Math.min(filter.limit ?? 100, 200)
    const hooks = await this.db.prepare(`SELECT d.id, d.event_type AS subject, d.status, d.event_id AS idempotencyKey, d.response_id AS responseId, d.endpoint_id AS endpointId, d.updated_at AS updatedAt
      FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id WHERE e.workspace_id = ? ORDER BY d.updated_at DESC, d.id DESC LIMIT ?`).bind(workspaceId, limit)
      .all<{ id: string; subject: string; status: keyof typeof states; idempotencyKey: string; responseId: string | null; endpointId: string; updatedAt: string }>()
    const hookAttempts = hooks.results.length ? await this.db.prepare(`SELECT delivery_id AS deliveryId, ordinal, event AS outcome, http_status AS httpStatus, reason, created_at AS at FROM response_event_attempts
      WHERE delivery_id IN (${hooks.results.map(() => '?').join(',')}) AND event <> 'started' ORDER BY ordinal, created_at, id`).bind(...hooks.results.map(row => row.id)).all<LedgerAttempt & { deliveryId: string }>() : { results: [] }
    const tasks = await this.db.prepare(`SELECT d.action_id AS id, d.state, d.idempotency_key AS idempotencyKey, d.updated_at AS updatedAt FROM action_task_deliveries d JOIN actions a ON a.id = d.action_id
      WHERE a.workspace_id = ? ORDER BY d.updated_at DESC, d.action_id DESC LIMIT ?`).bind(workspaceId, limit).all<{ id: string; state: LedgerDelivery['state']; idempotencyKey: string; updatedAt: string }>()
    const taskAttempts = tasks.results.length ? await this.db.prepare(`SELECT action_id AS actionId, ordinal, outcome, http_status AS httpStatus, outcome_class AS reason, COALESCE(finished_at, started_at) AS at FROM action_task_attempts
      WHERE action_id IN (${tasks.results.map(() => '?').join(',')}) ORDER BY ordinal`).bind(...tasks.results.map(row => row.id)).all<LedgerAttempt & { actionId: string }>() : { results: [] }
    const rows: LedgerDelivery[] = [
      ...hooks.results.map(row => ({ kind: 'webhook' as const, id: row.id, subject: row.subject, state: states[row.status], idempotencyKey: row.idempotencyKey, responseId: row.responseId, endpointId: row.endpointId, actionId: null, updatedAt: row.updatedAt,
        attempts: hookAttempts.results.filter(attempt => attempt.deliveryId === row.id).map(({ deliveryId: _delivery, ...attempt }) => attempt) })),
      ...tasks.results.map(row => ({ kind: 'task' as const, id: row.id, subject: 'task.create', state: row.state, idempotencyKey: row.idempotencyKey, responseId: null, endpointId: null, actionId: row.id, updatedAt: row.updatedAt,
        attempts: taskAttempts.results.filter(attempt => attempt.actionId === row.id).map(({ actionId: _action, ...attempt }) => attempt) })),
    ]
    return rows.filter(row => !filter.state || row.state === filter.state).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit)
  }

  /** The failed confirmed-action tasks an operator should see next to the webhook alerts. */
  async taskAlerts(workspaceId: string): Promise<WebhookAlert[]> {
    const failed = await this.db.prepare(`SELECT count(*) AS n FROM action_task_deliveries d JOIN actions a ON a.id = d.action_id WHERE a.workspace_id = ? AND d.state IN ('failed','unknown')`).bind(workspaceId).first<{ n: number }>()
    return failed?.n ? [{ endpointId: 'tasks', kind: 'failed', message: `${failed.n} external task ${failed.n === 1 ? 'delivery has' : 'deliveries have'} not been confirmed. Open the action and retry it with the same key.` }] : []
  }
}
