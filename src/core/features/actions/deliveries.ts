import { ulid } from 'ulid'
import { ConflictError, NotFoundError } from '../../shared/errors'
import type { TaskDestination, TaskDestinationConfiguration, TaskOutcome, TaskPayload } from './task-destination'
import { webhookTaskDestination } from './webhook'

export type DeliveryState = 'pending' | 'confirmed' | 'unknown' | 'failed'
export type TaskAttempt = { id: string; ordinal: number; startedAt: string; finishedAt: string | null; outcome: Exclude<DeliveryState, 'pending'> | null; outcomeClass: string | null; httpStatus: number | null; remoteTaskId: string | null; operator: string | null }
export type TaskDelivery = { state: DeliveryState; idempotencyKey: string; remoteTaskId: string | null; confirmedAt: string; inFlight: boolean; stale: boolean; attempts: TaskAttempt[] }
export type TaskStatus = { available: boolean; message?: string; delivery: TaskDelivery | null }

// An attempt older than this never finished (its Worker stopped); its outcome is unknown. Far longer than the call timeout.
const abandonedAfterMilliseconds = 120_000

async function sha256(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export class TaskDeliveries {
  private readonly destination: TaskDestination | null
  constructor(private readonly db: D1Database, private readonly configuration: TaskDestinationConfiguration, private readonly appOrigin: string) {
    this.destination = configuration.kind === 'webhook' ? webhookTaskDestination(configuration) : null
  }

  /** Exactly what would leave: the action's fields and the sign-in-required link to it. Never answers or excerpts (ACT-006). */
  async preview(workspaceId: string, actionId: string) {
    const action = await this.db.prepare(`SELECT a.id, a.title, a.rationale, a.review_date AS reviewDate, a.metric_name AS metricName, a.metric_unit AS metricUnit, a.metric_direction AS metricDirection,
      a.baseline_value AS baselineValue, a.baseline_source AS baselineSource, a.baseline_observed_at AS baselineObservedAt, a.version, o.display_name AS ownerName, o.email AS ownerEmail,
      d.idempotency_key AS idempotencyKey FROM actions a LEFT JOIN operators o ON o.id = a.owner_operator_id AND o.workspace_id = a.workspace_id
      LEFT JOIN action_task_deliveries d ON d.action_id = a.id WHERE a.id = ? AND a.workspace_id = ?`).bind(actionId, workspaceId)
      .first<{ id: string; title: string; rationale: string; reviewDate: string; metricName: string; metricUnit: string; metricDirection: 'increase' | 'decrease'; baselineValue: number; baselineSource: string; baselineObservedAt: string; version: number; ownerName: string | null; ownerEmail: string | null; idempotencyKey: string | null }>()
    if (!action) throw new NotFoundError('This action is not in your workspace.')
    if (!action.ownerName || !action.ownerEmail) throw new ConflictError('Choose an owner for this action before creating an external task.')
    const idempotencyKey = action.idempotencyKey ?? `pencil-action-${action.id}`
    const payload: TaskPayload = {
      idempotencyKey,
      action: {
        title: action.title, rationale: action.rationale, owner: { name: action.ownerName, email: action.ownerEmail },
        metric: { name: action.metricName, unit: action.metricUnit, direction: action.metricDirection, baseline: { value: action.baselineValue, source: action.baselineSource, observedAt: action.baselineObservedAt } },
        reviewDate: action.reviewDate, reportLink: `${this.appOrigin}/app/actions/${encodeURIComponent(action.id)}`,
      },
    }
    const json = JSON.stringify(payload)
    return { payload, payloadSha256: await sha256(json), actionVersion: action.version }
  }

  private requireDestination() {
    if (!this.destination) throw new ConflictError(this.configuration.kind === 'unavailable' ? this.configuration.message : 'External tasks are not set up.')
    return this.destination
  }

  async status(workspaceId: string, actionId: string): Promise<TaskStatus> {
    const delivery = await this.delivery(workspaceId, actionId)
    return this.configuration.kind === 'webhook' ? { available: true, delivery } : { available: false, message: this.configuration.message, delivery }
  }

  private async delivery(workspaceId: string, actionId: string): Promise<TaskDelivery | null> {
    // An attempt that never finished (its Worker stopped, or it was restored from an export) reads as unknown.
    const row = await this.db.prepare(`SELECT d.state, d.idempotency_key AS idempotencyKey, d.remote_task_id AS remoteTaskId, d.confirmed_at AS confirmedAt, d.payload_sha256 AS payloadSha256,
      EXISTS (SELECT 1 FROM action_task_attempts t WHERE t.id = d.in_flight_attempt_id AND t.outcome IS NULL AND t.started_at >= ?) AS inFlight,
      EXISTS (SELECT 1 FROM action_task_attempts t WHERE t.id = d.in_flight_attempt_id AND t.outcome IS NULL AND t.started_at < ?) AS abandoned
      FROM action_task_deliveries d JOIN actions a ON a.id = d.action_id WHERE d.action_id = ? AND a.workspace_id = ?`).bind(...Array(2).fill(new Date(Date.now() - abandonedAfterMilliseconds).toISOString()), actionId, workspaceId)
      .first<{ state: DeliveryState; idempotencyKey: string; remoteTaskId: string | null; confirmedAt: string; inFlight: number; abandoned: number; payloadSha256: string }>()
    if (!row) return null
    const attempts = (await this.db.prepare(`SELECT t.id, t.ordinal, t.started_at AS startedAt, t.finished_at AS finishedAt, t.outcome, t.outcome_class AS outcomeClass, t.http_status AS httpStatus,
      t.remote_task_id AS remoteTaskId, o.display_name AS operator FROM action_task_attempts t LEFT JOIN operators o ON o.id = t.operator_id WHERE t.action_id = ? ORDER BY t.ordinal`).bind(actionId).all<TaskAttempt>()).results
    const stale = row.state !== 'confirmed' && (await this.preview(workspaceId, actionId).catch(() => null))?.payloadSha256 !== row.payloadSha256
    return { state: row.abandoned ? 'unknown' : row.state, idempotencyKey: row.idempotencyKey, remoteTaskId: row.remoteTaskId, confirmedAt: row.confirmedAt, inFlight: Boolean(row.inFlight), stale, attempts }
  }

  /**
   * Records the operator's confirmation of the exact payload they read, then delivers it. One key per action
   * for its whole life; a delivered task is never sent again.
   */
  async confirm(workspaceId: string, operatorId: string, actionId: string, confirmedSha256: string) {
    this.requireDestination()
    const current = await this.preview(workspaceId, actionId)
    if (current.payloadSha256 !== confirmedSha256) throw new ConflictError('The action changed after you read the task. Review what will be sent and confirm again.')
    const now = new Date().toISOString(), json = JSON.stringify(current.payload)
    await this.db.batch([
      this.db.prepare(`INSERT INTO action_task_deliveries (action_id, idempotency_key, state, payload_json, payload_sha256, action_version, confirmed_by_operator_id, confirmed_at, in_flight_attempt_id, remote_task_id, updated_at)
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, NULL, NULL, ?)
        ON CONFLICT(action_id) DO UPDATE SET payload_json = excluded.payload_json, payload_sha256 = excluded.payload_sha256, action_version = excluded.action_version,
          confirmed_by_operator_id = excluded.confirmed_by_operator_id, confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at
        WHERE action_task_deliveries.state <> 'confirmed' AND action_task_deliveries.payload_sha256 <> excluded.payload_sha256 AND action_task_deliveries.in_flight_attempt_id IS NULL`)
        .bind(actionId, current.payload.idempotencyKey, json, confirmedSha256, current.actionVersion, operatorId, now, now),
      this.db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        VALUES (?, ?, 'action.task_confirmed', ?, 'action', ?, '{"actions":1}', ?)`).bind(ulid(), workspaceId, operatorId, actionId, now),
    ])
    return this.deliver(workspaceId, operatorId, actionId)
  }

  /** Retry reuses the same key and the same confirmed payload; a payload the action no longer matches must be confirmed again. */
  async deliver(workspaceId: string, operatorId: string, actionId: string): Promise<TaskStatus> {
    const destination = this.requireDestination()
    const delivery = await this.db.prepare('SELECT d.state, d.payload_json AS payloadJson, d.payload_sha256 AS payloadSha256 FROM action_task_deliveries d JOIN actions a ON a.id = d.action_id WHERE d.action_id = ? AND a.workspace_id = ?')
      .bind(actionId, workspaceId).first<{ state: DeliveryState; payloadJson: string; payloadSha256: string }>()
    if (!delivery) throw new NotFoundError('Confirm the task before sending it.')
    if (delivery.state === 'confirmed') return this.status(workspaceId, actionId)
    if ((await this.preview(workspaceId, actionId)).payloadSha256 !== delivery.payloadSha256) {
      throw new ConflictError('The action changed after the task was confirmed. Review what will be sent and confirm again.')
    }
    const attemptId = ulid(), now = new Date().toISOString(), abandonedBefore = new Date(Date.now() - abandonedAfterMilliseconds).toISOString()
    // Claim the single in-flight slot and write the attempt before any request is made (two tabs, two clicks: one attempt).
    const claim = await this.db.batch([
      this.db.prepare(`UPDATE action_task_attempts SET outcome = 'unknown', outcome_class = 'abandoned', finished_at = ? WHERE action_id = ? AND outcome IS NULL AND started_at < ?`).bind(now, actionId, abandonedBefore),
      this.db.prepare(`UPDATE action_task_deliveries SET in_flight_attempt_id = ?, state = 'pending', updated_at = ? WHERE action_id = ? AND state IN ('pending','unknown','failed') AND payload_sha256 = ?
        AND (in_flight_attempt_id IS NULL OR in_flight_attempt_id IN (SELECT id FROM action_task_attempts WHERE action_id = ? AND outcome IS NOT NULL))`)
        .bind(attemptId, now, actionId, delivery.payloadSha256, actionId),
      this.db.prepare(`INSERT INTO action_task_attempts (id, action_id, ordinal, idempotency_key, payload_sha256, operator_id, started_at)
        SELECT ?, action_id, (SELECT COALESCE(MAX(ordinal), 0) + 1 FROM action_task_attempts WHERE action_id = ?), idempotency_key, payload_sha256, ?, ? FROM action_task_deliveries WHERE action_id = ? AND in_flight_attempt_id = ?`)
        .bind(attemptId, actionId, operatorId, now, actionId, attemptId),
      this.db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, ?, 'action.task_attempted', ?, 'action', action_id, '{"attempts":1}', ? FROM action_task_deliveries WHERE action_id = ? AND in_flight_attempt_id = ?`).bind(ulid(), workspaceId, operatorId, now, actionId, attemptId),
    ])
    if (!claim[2].meta.changes) return this.status(workspaceId, actionId)
    const payload = JSON.parse(delivery.payloadJson) as TaskPayload
    const result: TaskOutcome = await destination.createOrGet(payload.idempotencyKey, payload)
    const finished = new Date().toISOString(), state: DeliveryState = result.outcome
    const outcomeClass = result.outcome === 'confirmed' ? '2xx' : result.outcomeClass
    await this.db.batch([
      this.db.prepare('UPDATE action_task_attempts SET outcome = ?, outcome_class = ?, http_status = ?, remote_task_id = ?, finished_at = ? WHERE id = ? AND outcome IS NULL')
        .bind(result.outcome, outcomeClass, 'httpStatus' in result ? result.httpStatus ?? null : null, result.outcome === 'confirmed' ? result.remoteTaskId : null, finished, attemptId),
      this.db.prepare('UPDATE action_task_deliveries SET state = ?, remote_task_id = COALESCE(?, remote_task_id), in_flight_attempt_id = NULL, updated_at = ? WHERE action_id = ? AND in_flight_attempt_id = ?')
        .bind(state, result.outcome === 'confirmed' ? result.remoteTaskId : null, finished, actionId, attemptId),
    ])
    return this.status(workspaceId, actionId)
  }
}
