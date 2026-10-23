import { ulid } from 'ulid'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import type { AttemptSummary, DeliverySummary, EventType } from './model'

type DeliveryRow = Omit<DeliverySummary, 'attemptLog'>
const columns = `d.id, d.endpoint_id AS endpointId, d.event_id AS eventId, d.event_type AS eventType, d.flow_id AS formId, d.revision_id AS revisionId, d.response_id AS responseId,
  d.occurred_at AS occurredAt, d.status, d.attempts, d.reason, d.available_at AS availableAt, d.updated_at AS updatedAt`

/** The delivery ledger for response events: every event per endpoint, its state and each attempt with its reason (INTEG-010, INTEG-015). */
export class ResponseEventDeliveries {
  constructor(private readonly db: D1Database) {}

  async list(workspaceId: string, filter: { endpointId?: string; status?: string; limit?: number } = {}, deliveryId?: string): Promise<DeliverySummary[]> {
    const rows = await this.db.prepare(`SELECT ${columns} FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id
      WHERE e.workspace_id = ? AND (? IS NULL OR d.endpoint_id = ?) AND (? IS NULL OR d.status = ?) AND (? IS NULL OR d.id = ?) ORDER BY d.created_at DESC, d.id DESC LIMIT ?`)
      .bind(workspaceId, filter.endpointId ?? null, filter.endpointId ?? null, filter.status ?? null, filter.status ?? null, deliveryId ?? null, deliveryId ?? null, Math.min(filter.limit ?? 50, 200)).all<DeliveryRow>()
    if (!rows.results.length) return []
    const attempts = await this.db.prepare(`SELECT delivery_id AS deliveryId, ordinal, event, http_status AS httpStatus, outcome_class AS outcomeClass, reason, created_at AS createdAt FROM response_event_attempts
      WHERE delivery_id IN (${rows.results.map(() => '?').join(',')}) ORDER BY ordinal, CASE event WHEN 'started' THEN 0 WHEN 'replay' THEN 2 ELSE 1 END, created_at, id`).bind(...rows.results.map(row => row.id)).all<AttemptSummary & { deliveryId: string }>()
    return rows.results.map(row => ({ ...row, attemptLog: attempts.results.filter(attempt => attempt.deliveryId === row.id).map(({ deliveryId: _delivery, ...attempt }) => attempt) }))
  }

  /** Queues a signed `webhook.test` event for the endpoint; the caller sends it at once. */
  async queueTest(workspaceId: string, endpointId: string, now = new Date().toISOString()) {
    const id = ulid()
    const result = await this.db.prepare(`INSERT INTO response_event_deliveries (id, endpoint_id, event_id, event_type, workspace_id, flow_id, occurred_at, status, attempts, available_at, created_at, updated_at)
      SELECT ?, e.id, ?, 'webhook.test', e.workspace_id, e.flow_id, ?, 'pending', 0, ?, ?, ? FROM response_webhook_endpoints e WHERE e.id = ? AND e.workspace_id = ? AND e.sealed_secret IS NOT NULL`)
      .bind(id, `evt_${ulid().toLowerCase()}`, now, now, now, now, endpointId, workspaceId).run()
    if (!result.meta.changes) throw new NotFoundError('This webhook endpoint is not in your workspace or has no signing secret.')
    return id
  }

  /** Re-sends the same event ID with a fresh 24-hour retry window and records a replay marker in its attempts. */
  async replay(workspaceId: string, deliveryId: string, now = new Date().toISOString()) {
    const row = await this.db.prepare(`SELECT d.status, d.attempts, d.event_type AS eventType, d.response_id AS responseId, e.state FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id
      WHERE d.id = ? AND e.workspace_id = ?`).bind(deliveryId, workspaceId).first<{ status: string; attempts: number; eventType: EventType; responseId: string | null; state: string }>()
    if (!row) throw new NotFoundError('This delivery is not in your workspace.')
    if (!['confirmed', 'failed'].includes(row.status)) throw new ValidationError('Only a delivered or failed event can be replayed; this one is still being sent.')
    if (row.eventType === 'response.deleted' && !row.responseId) throw new ConflictError('This deletion notice cannot be replayed: its response reference was removed with the response.')
    if (row.state !== 'active') throw new ConflictError('Resume the endpoint before replaying events to it.')
    const marker = ulid()
    const results = await this.db.batch([
      this.db.prepare(`INSERT INTO response_event_attempts (id, delivery_id, ordinal, event, reason, created_at)
        SELECT ?, id, attempts, 'replay', 'An owner replayed this event.', ? FROM response_event_deliveries WHERE id = ? AND attempts = ? AND status IN ('confirmed','failed')`).bind(marker, now, deliveryId, row.attempts),
      this.db.prepare(`UPDATE response_event_deliveries SET status = 'pending', reason = NULL, first_attempt_at = NULL, available_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('confirmed','failed') AND EXISTS (SELECT 1 FROM response_event_attempts WHERE id = ?)`).bind(now, now, deliveryId, marker),
    ])
    if (!results[1].meta.changes) throw new ConflictError('This delivery was already replayed or changed; refresh its status.')
  }

  /** Response IDs whose events an endpoint has not received: queued or failed `response.created` events (INTEG-015). */
  async notDelivered(workspaceId: string, endpointId: string) {
    const rows = await this.db.prepare(`SELECT d.response_id AS responseId, d.status FROM response_event_deliveries d JOIN response_webhook_endpoints e ON e.id = d.endpoint_id
      WHERE e.workspace_id = ? AND d.endpoint_id = ? AND d.event_type = 'response.created' AND d.status IN ('pending','sending','failed') AND d.response_id IS NOT NULL
      ORDER BY d.created_at, d.id`).bind(workspaceId, endpointId).all<{ responseId: string; status: string }>()
    return rows.results
  }
}
