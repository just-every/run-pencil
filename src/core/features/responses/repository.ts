import { responseErasureStatements } from './erasure'
import { ungovernedSaveSql } from '../retention'
import { ValidationError } from '../../shared/errors'
import { trafficDay } from '../../shared/trafficDay'
import { bindSessionCollectorSql, collectorAdmissionSql, sessionCollectorAdmissionSql, throwCollectorAdmissionFailure } from '../collectors'
import { and, count, eq, sql } from 'drizzle-orm'
import { completionMetricStatements } from './completionMetrics'
import { eraseResponseLocalMail } from '../../platform/mail/erasure'
import type { D1Sql } from '../../../base/import-kit/src/d1/types'
import type { PencilDatabase } from '../../platform/db/repository'
import { flowRevisions, flows, respondentSessions, responseAnswers, responses, revisionMetricCounters } from '../../platform/db/schema'

type SessionInsert = typeof respondentSessions.$inferInsert
export type ResponseErasureInput = { workspaceId: string; responseId: string; operatorId: string; sessionId?: string }
export type ResponseErasure = (database: D1Database, input: ResponseErasureInput, statements: D1Sql[]) => Promise<D1Result<unknown>[]>

function changes(result: D1Result<unknown> | undefined) {
  return result?.meta.changes ?? 0
}

export class ResponseRepository {
  constructor(
    private readonly database: PencilDatabase,
    private readonly binding: D1Database,
    private readonly eraseResponse: ResponseErasure,
  ) {}

  async findInvitation(token: string) {
    return this.binding.prepare(`SELECT p.id, p.revision_id AS revisionId, p.response_status AS responseStatus,
      p.completion_step_id AS completionStepId, f.slug FROM invitation_participants p
      JOIN flow_revisions r ON r.id = p.revision_id JOIN flows f ON f.id = r.flow_id
      WHERE p.token = ? AND p.contact_id IS NOT NULL`).bind(token).first<{ id: string; revisionId: string; responseStatus: string; completionStepId: string | null; slug: string }>()
  }

  async ensureSession(session: SessionInsert) {
    await this.database.insert(respondentSessions).values(session).onConflictDoNothing()
  }

  async ensureResponse(response: typeof responses.$inferInsert) {
    await this.database.insert(responses).values(response).onConflictDoNothing()
  }

  async ensureAnswer(answer: typeof responseAnswers.$inferInsert) {
    await this.database.insert(responseAnswers).values(answer).onConflictDoNothing()
  }

  async ensureMetricCounter(counter: typeof revisionMetricCounters.$inferInsert) {
    await this.database.insert(revisionMetricCounters).values(counter).onConflictDoNothing()
  }

  async findSession(id: string, revisionId: string, sessionTokenHash: string) {
    const [session] = await this.database
      .select()
      .from(respondentSessions)
      .where(and(eq(respondentSessions.id, id), eq(respondentSessions.revisionId, revisionId), eq(respondentSessions.sessionTokenHash, sessionTokenHash)))
      .limit(1)
    return session
  }

  async findSessionById(id: string) {
    const [session] = await this.database.select().from(respondentSessions).where(eq(respondentSessions.id, id)).limit(1)
    return session
  }

  async createSession(input: SessionInsert & { collectorId: string; participantId?: string | null; workspaceId: string; flowId: string; deadlineAt: string | null; targetCompletedResponses: number | null }) {
    const workspace=await this.binding.prepare('SELECT time_zone AS zone FROM workspaces WHERE id=?').bind(input.workspaceId).first<{zone:string}>()
    const day=trafficDay(input.createdAt,workspace!.zone)
    const collectorOpen = collectorAdmissionSql('?', 'f.id', input.createdAt, '?')
    const statements: D1PreparedStatement[] = [
      this.binding.prepare(`
        UPDATE flow_revisions
        SET admission_closed_at = COALESCE(admission_closed_at, ?), admission_close_reason = COALESCE(admission_close_reason, 'deadline'), updated_at = ?
        WHERE id = ? AND deadline_at IS NOT NULL AND deadline_at <= ?
      `).bind(input.createdAt, input.createdAt, input.revisionId, input.createdAt),
      this.binding.prepare(`
        UPDATE flows
        SET status = 'closed', last_activity_at = ?, updated_at = ?
        WHERE id = ? AND status = 'open' AND EXISTS (
          SELECT 1 FROM flow_revisions
          WHERE id = ? AND flow_id = flows.id AND state = 'published' AND is_current = 1 AND admission_closed_at IS NOT NULL
        )
      `).bind(input.createdAt, input.createdAt, input.flowId, input.revisionId),
      this.binding.prepare(`
        INSERT OR IGNORE INTO revision_metric_counters (
          id, revision_id, starts, completions, total_completion_milliseconds, mobile_starts, tablet_starts, desktop_starts, created_at, updated_at
        ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
      `).bind(`metric-${input.revisionId}`, input.revisionId, input.createdAt, input.updatedAt),
      this.binding.prepare(`
        INSERT INTO respondent_sessions (
          id, revision_id, source, device_class, furthest_step_id, session_token_hash, completed_at, metric_folded_at,
          completion_outcome, expires_at, created_at, updated_at, presentation_json
        )
        SELECT ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM flows f
          JOIN flow_revisions r ON r.id = ?
          WHERE f.id = ? AND f.status IN ('open', 'closed') AND r.flow_id = f.id AND r.state = 'published' AND ((? IS NULL AND r.is_current = 1) OR EXISTS (SELECT 1 FROM invitation_participants p WHERE p.id = ? AND p.revision_id = r.id AND p.token IS NOT NULL AND p.response_status != 'completed'
              AND EXISTS (SELECT 1 FROM invitation_launch_collector lc WHERE lc.launch_id=p.launch_id AND lc.collector_id=?)))
            AND r.admission_closed_at IS NULL
            AND (r.deadline_at IS NULL OR r.deadline_at > ?)
            AND (r.target_completed_responses IS NULL OR (
              SELECT COUNT(*) FROM responses response
              WHERE response.revision_id = r.id AND response.state = 'released'
            ) < r.target_completed_responses)
            AND ${collectorOpen.sql}
        ) RETURNING id
      `).bind(
        input.id, input.revisionId, input.source, input.deviceClass, input.furthestStepId, input.sessionTokenHash,
        input.expiresAt, input.createdAt, input.updatedAt, input.presentationJson ?? '{}', input.revisionId, input.flowId, input.participantId ?? null, input.participantId ?? null, input.collectorId, input.createdAt, input.collectorId, input.source, ...collectorOpen.params,
      ),
      ...bindSessionCollectorSql({ sessionId: input.id, collectorId: input.collectorId, flowId: input.flowId, source: input.source, now: input.createdAt })
        .map(statement => this.binding.prepare(statement.sql).bind(...statement.params)),
      this.binding.prepare(`
        INSERT OR IGNORE INTO respondent_session_step_events (id, session_id, revision_id, step_stable_id, counted_at, created_at)
        SELECT ?, ?, ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM respondent_sessions WHERE id = ?)
      `).bind(`event-${input.id}-${input.furthestStepId}`, input.id, input.revisionId, input.furthestStepId, input.createdAt, input.id),
      this.binding.prepare(`
        UPDATE revision_metric_counters
        SET starts = starts + 1,
            mobile_starts = mobile_starts + CASE WHEN ? = 'mobile' THEN 1 ELSE 0 END,
            tablet_starts = tablet_starts + CASE WHEN ? = 'tablet' THEN 1 ELSE 0 END,
            desktop_starts = desktop_starts + CASE WHEN ? = 'desktop' THEN 1 ELSE 0 END,
            updated_at = ?
        WHERE revision_id = ? AND EXISTS (SELECT 1 FROM respondent_sessions WHERE id = ?)
      `).bind(input.deviceClass, input.deviceClass, input.deviceClass, input.updatedAt, input.revisionId, input.id),
      this.binding.prepare(`
        INSERT INTO revision_step_metric_counters (id, revision_id, step_stable_id, reached, dropped, created_at, updated_at)
        SELECT ?, ?, ?, 1, 0, ?, ?
        WHERE EXISTS (SELECT 1 FROM respondent_session_step_events WHERE session_id = ? AND step_stable_id = ? AND counted_at IS NULL)
        ON CONFLICT(revision_id, step_stable_id) DO UPDATE SET reached = reached + 1, updated_at = excluded.updated_at
      `).bind(`step-metric-${input.revisionId}-${input.furthestStepId}`, input.revisionId, input.furthestStepId, input.createdAt, input.updatedAt, input.id, input.furthestStepId),
      this.binding.prepare(`UPDATE respondent_session_step_events SET counted_at = ? WHERE session_id = ? AND step_stable_id = ? AND counted_at IS NULL`).bind(input.updatedAt, input.id, input.furthestStepId),
    ]
    statements.push(this.binding.prepare(`UPDATE invitation_participants SET response_status = 'started' WHERE id = ? AND response_status = 'not-started'
      AND EXISTS (SELECT 1 FROM respondent_sessions WHERE id = ?)`).bind(input.participantId ?? null, input.id))
    statements.push(
      this.binding.prepare('INSERT OR IGNORE INTO traffic_tracking(id,started_at) SELECT 1,? WHERE EXISTS(SELECT 1 FROM respondent_sessions WHERE id=?)').bind(input.createdAt,input.id),
      this.binding.prepare(`INSERT INTO session_traffic(session_id,source,day)
        SELECT s.id,CASE WHEN c.system_source IS NULL THEN 'collector:'||c.id ELSE s.source END,?
        FROM respondent_sessions s JOIN session_collector sc ON sc.session_id=s.id JOIN collectors c ON c.id=sc.collector_id WHERE s.id=?`).bind(day,input.id),
      this.binding.prepare(`INSERT INTO revision_start_counters(revision_id,source,day,count)
        SELECT s.revision_id,t.source,t.day,1 FROM session_traffic t JOIN respondent_sessions s ON s.id=t.session_id WHERE s.id=?
        ON CONFLICT(revision_id,source,day) DO UPDATE SET count=count+1`).bind(input.id),
    )
    try {
      const results = await this.binding.batch<{ id: string }>(statements)
      return results[3].results.some(row => row.id === input.id)
    } catch (error) { throwCollectorAdmissionFailure(error) }
  }

  async advanceSession(input: { sessionId: string; slug: string; sessionTokenHash: string; stepStableId: string; now: string }) {
    // The progress trigger records a distinct visit atomically with this update.
    // Repeated visits still authenticate and persist ordered backtracking, but
    // need no additional binding statements or metric/event writes.
    const result = await this.binding.prepare(`UPDATE respondent_session_progress SET furthest_step_id = ?, updated_at = ?
        WHERE id = ? AND session_token_hash = ? AND completed_at IS NULL AND expires_at > ?
          AND EXISTS (
            SELECT 1 FROM flow_steps q
            WHERE q.revision_id = respondent_session_progress.revision_id AND q.stable_id = ?
          ) AND flow_slug = ? RETURNING id`).bind(input.stepStableId, input.now, input.sessionId, input.sessionTokenHash, input.now, input.stepStableId, input.slug).all<{ id: string }>()
    // meta.changes includes trigger writes; RETURNING identifies the admitted
    // session regardless of whether this visit inserted telemetry.
    return result.results.length === 1
  }

  async findSubmissionContext(sessionId: string, sessionTokenHash: string) {
    const [context] = await this.database.select({ session: respondentSessions, revision: flowRevisions, flow: flows })
      .from(respondentSessions)
      .innerJoin(flowRevisions, eq(flowRevisions.id, respondentSessions.revisionId))
      .innerJoin(flows, eq(flows.id, flowRevisions.flowId))
      .where(and(eq(respondentSessions.id, sessionId), eq(respondentSessions.sessionTokenHash, sessionTokenHash))).limit(1)
    return context
  }

  async getRetainedResponseAnswers(responseId: string) {
    const [retained, answers] = await this.database.batch([
      this.database.select({ id: responses.id }).from(responses).where(eq(responses.id, responseId)).limit(1),
      this.database.select().from(responseAnswers).where(eq(responseAnswers.responseId, responseId)),
    ])
    return retained.length ? answers : undefined
  }

  async findResponseBySession(sessionId: string) {
    const [response] = await this.database.select().from(responses).where(eq(responses.sessionId, sessionId)).limit(1)
    return response
  }

  async findResponseBySessionToken(sessionId: string, sessionTokenHash: string) {
    const [response] = await this.database
      .select()
      .from(responses)
      .where(and(eq(responses.sessionId, sessionId), eq(responses.sessionTokenHash, sessionTokenHash)))
      .limit(1)
    return response
  }

  async createCompletedResponse(input: {
    response: typeof responses.$inferInsert
    answers: Array<typeof responseAnswers.$inferInsert>
    sessionTokenHash: string
    completedAt: string
    completionMilliseconds: number
    reachedStepIds: string[]
    completionStepId?: string
  }) {
    const response = input.response
    const released = response.state === 'released'
    const collectorOpen = sessionCollectorAdmissionSql('s.id', 'f.id', input.completedAt, 's.source')
    const statements: D1PreparedStatement[] = [
      this.binding.prepare(`
        INSERT INTO responses (
          id, workspace_id, flow_id, revision_id, session_id, session_token_hash, idempotency_key, state, quarantine_reason,
          released_at, released_by_operator_id, completion_milliseconds, completed_at, created_at, updated_at, source, started_at, participant_id, notification_eligible, response_context_json
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, s.source, s.created_at, ?, 1, ?
        FROM respondent_sessions s
        JOIN flow_revisions r ON r.id = s.revision_id
        JOIN flows f ON f.id = r.flow_id
        WHERE s.id = ? AND s.revision_id = ? AND s.session_token_hash = ?
          AND s.completed_at IS NULL AND s.expires_at > ?
          AND ((s.source != 'invitation' AND ? IS NULL) OR (s.source = 'invitation' AND EXISTS (SELECT 1 FROM invitation_participants p WHERE p.id = ? AND p.revision_id = r.id AND p.token IS NOT NULL AND p.response_status != 'completed' AND NOT EXISTS (SELECT 1 FROM responses WHERE participant_id = p.id)
            AND EXISTS (SELECT 1 FROM session_collector sc JOIN invitation_launch_collector lc ON lc.collector_id=sc.collector_id WHERE sc.session_id=s.id AND lc.launch_id=p.launch_id))))
          AND f.id = ? AND f.status IN ('open', 'closed') AND r.admission_closed_at IS NULL
          AND (r.deadline_at IS NULL OR r.deadline_at > ?)
          AND (? = 'quarantined' OR r.target_completed_responses IS NULL OR (
            SELECT COUNT(*) FROM responses completed
            WHERE completed.revision_id = r.id AND completed.state = 'released'
          ) < r.target_completed_responses)
          AND ${collectorOpen.sql}
      `).bind(
        response.id, response.workspaceId, response.flowId, response.revisionId, response.sessionId, input.sessionTokenHash, response.idempotencyKey,
        response.state, response.quarantineReason, released ? input.completedAt : null, response.completionMilliseconds, response.completedAt, response.createdAt, response.updatedAt, response.participantId ?? null, response.contextJson ?? '{}',
        response.sessionId, response.revisionId, input.sessionTokenHash, input.completedAt, response.participantId ?? null, response.participantId ?? null, response.flowId, input.completedAt, response.state, ...collectorOpen.params,
      ),
      ...input.answers.map((answer) => this.binding.prepare(`
        INSERT INTO response_answers (id, response_id, step_id, value_json, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM responses WHERE id = ?)
      `).bind(answer.id, answer.responseId, answer.stepId, answer.valueJson, answer.createdAt, answer.updatedAt, response.id)),
      this.binding.prepare(`
        INSERT INTO response_outbox (id, workspace_id, response_id, kind, idempotency_key, payload_json, status, available_at, dispatched_at, failure_reason, created_at, updated_at, notification_eligible)
        SELECT ?, r.workspace_id, r.id, 'response.completed', ?,
          json_object('responseId', r.id, 'revisionId', r.revision_id, 'notificationOperatorIds', (
            SELECT json_group_array(p.operator_id) FROM notification_preferences p JOIN operators o ON o.id = p.operator_id
            WHERE p.flow_id = r.flow_id AND p.mode = 'immediately' AND o.workspace_id = r.workspace_id
          ), 'digestOperatorIds', (SELECT json_group_array(json_object('operatorId',p.operator_id,'epoch',p.epoch)) FROM digest_preferences p JOIN operators o ON o.id=p.operator_id WHERE p.flow_id=r.flow_id AND p.enabled=1 AND o.workspace_id=r.workspace_id)), 'pending', ?, NULL, NULL, ?, ?, r.notification_eligible
        FROM responses r WHERE r.id = ? AND r.state = 'released'
      `).bind(`outbox-${response.id}`, `response.completed:${response.id}`, input.completedAt, input.completedAt, input.completedAt, response.id),
      this.binding.prepare(`
        UPDATE respondent_sessions SET completed_at = ?, completion_outcome = ?, updated_at = ?
        WHERE id = ? AND session_token_hash = ? AND completed_at IS NULL AND EXISTS (SELECT 1 FROM responses WHERE id = ?)
      `).bind(input.completedAt, response.state, input.completedAt, response.sessionId, input.sessionTokenHash, response.id),
      this.binding.prepare(`
        UPDATE revision_metric_counters
        SET completions = completions + CASE WHEN ? = 'released' THEN 1 ELSE 0 END,
            total_completion_milliseconds = total_completion_milliseconds + CASE WHEN ? = 'released' THEN ? ELSE 0 END,
            updated_at = ?
        WHERE revision_id = ? AND EXISTS (SELECT 1 FROM responses WHERE id = ?)
      `).bind(response.state, response.state, input.completionMilliseconds, input.completedAt, response.revisionId, response.id),
      this.binding.prepare(`
        UPDATE flow_revisions
        SET admission_closed_at = COALESCE(admission_closed_at, ?), admission_close_reason = COALESCE(admission_close_reason, 'target'), updated_at = ?
        WHERE id = ? AND target_completed_responses IS NOT NULL
          AND (SELECT COUNT(*) FROM responses completed WHERE completed.revision_id = flow_revisions.id AND completed.state = 'released') >= target_completed_responses
          AND EXISTS (SELECT 1 FROM responses WHERE id = ? AND state = 'released')
      `).bind(input.completedAt, input.completedAt, response.revisionId, response.id),
      this.binding.prepare(`
        UPDATE flows
        SET status = 'closed', last_activity_at = ?, updated_at = ?
        WHERE id = ? AND status = 'open' AND EXISTS (
          SELECT 1 FROM flow_revisions
          WHERE id = ? AND flow_id = flows.id AND state = 'published' AND is_current = 1
            AND admission_closed_at IS NOT NULL AND admission_close_reason = 'target'
        )
      `).bind(input.completedAt, input.completedAt, response.flowId, response.revisionId),
    ]
    statements.push(
      this.binding.prepare(`INSERT INTO audit_entries (id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at)
        SELECT ?,workspace_id,'response.quarantined',NULL,'flow-revision',revision_id,json_object('defence',quarantine_reason),?
        FROM responses WHERE id=? AND state='quarantined'`).bind(`quarantine-${response.id}`,input.completedAt,response.id),
      this.binding.prepare(`UPDATE respondent_saves SET completion_step_id=? WHERE response_id=?`).bind(input.completionStepId ?? null,response.id),
      this.binding.prepare(`UPDATE invitation_participants SET response_status = 'completed', completed_at = ?, completion_step_id = ?
        WHERE id = (SELECT participant_id FROM responses WHERE id = ?)`).bind(input.completedAt, input.completionStepId ?? null, response.id),
      this.binding.prepare(`UPDATE mail_deliveries SET status = 'cancelled', reason = 'Response completed.', updated_at = ?
        WHERE kind = 'reminder' AND status = 'pending' AND participant_id = (SELECT participant_id FROM responses WHERE id = ?)`).bind(input.completedAt, response.id),
      ...completionMetricStatements(this.binding, { revisionId: response.revisionId, responseId: response.id, sessionId: response.sessionId, reachedStepIds: input.reachedStepIds, completedAt: input.completedAt }),
      this.binding.prepare('DELETE FROM respondent_session_step_events WHERE session_id = ? AND EXISTS (SELECT 1 FROM responses WHERE id = ?)').bind(response.sessionId, response.id),
      this.binding.prepare('DELETE FROM respondent_sessions WHERE id = ? AND EXISTS (SELECT 1 FROM responses WHERE id = ?)').bind(response.sessionId, response.id),
    )
    try {
      const results = await this.binding.batch(statements)
      // Trigger writes also contribute to changes; the guarded response insert still creates one row or none.
      return changes(results[0]) > 0
    } catch (error) {
      if(String(error).includes('ACCESS_ALREADY_COMPLETED') || String((error as Error)?.cause).includes('ACCESS_ALREADY_COMPLETED'))throw new ValidationError('This email address has already completed this form.')
      throwCollectorAdmissionFailure(error)
    }
  }

  async releaseQuarantinedResponse(input: { workspaceId: string; responseId: string; operatorId: string; now: string }) {
    const auditId = crypto.randomUUID()
    const results = await this.binding.batch<{ id: string }>([
      this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, 'response.quarantine-released', (SELECT id FROM operators WHERE id = ? AND workspace_id = responses.workspace_id), 'response', id, '{}', ? FROM responses
        WHERE id = ? AND workspace_id = ? AND state = 'quarantined'`).bind(auditId, input.operatorId, input.now, input.responseId, input.workspaceId),
      this.binding.prepare(`UPDATE responses SET state = 'released', quarantine_reason = NULL, released_at = ?, released_by_operator_id = (SELECT id FROM operators WHERE id = ? AND workspace_id = responses.workspace_id), updated_at = ?
        WHERE id = ? AND workspace_id = ? AND state = 'quarantined' AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?) RETURNING id`).bind(input.now, input.operatorId, input.now, input.responseId, input.workspaceId, auditId),
      this.binding.prepare(`UPDATE revision_metric_counters SET completions = completions + 1,
        total_completion_milliseconds = total_completion_milliseconds + COALESCE((SELECT completion_milliseconds FROM responses WHERE id = ?), 0), updated_at = ?
        WHERE revision_id = (SELECT revision_id FROM responses WHERE id = ?) AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(input.responseId, input.now, input.responseId, auditId),
      this.binding.prepare(`INSERT INTO response_outbox (id, workspace_id, response_id, kind, idempotency_key, payload_json, status, available_at, dispatched_at, failure_reason, created_at, updated_at, notification_eligible)
        SELECT ?, r.workspace_id, r.id, 'response.completed', ?,
          json_object('responseId', r.id, 'revisionId', r.revision_id, 'notificationOperatorIds', (
            SELECT json_group_array(p.operator_id) FROM notification_preferences p JOIN operators o ON o.id = p.operator_id
            WHERE p.flow_id = r.flow_id AND p.mode = 'immediately' AND o.workspace_id = r.workspace_id
          ), 'digestOperatorIds', (SELECT json_group_array(json_object('operatorId',p.operator_id,'epoch',p.epoch)) FROM digest_preferences p JOIN operators o ON o.id=p.operator_id WHERE p.flow_id=r.flow_id AND p.enabled=1 AND o.workspace_id=r.workspace_id)), 'pending', ?, NULL, NULL, ?, ?, r.notification_eligible FROM responses r
        WHERE r.id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(`outbox-release-${input.responseId}`, `response.completed:${input.responseId}`, input.now, input.now, input.now, input.responseId, auditId),
    ])
    // Reporting triggers also write rows; identify the response transition itself.
    return results[1].results.length === 1 && results[1].results[0].id === input.responseId
  }

  async deleteQuarantinedResponse(input: { workspaceId: string; responseId: string; operatorId: string; now: string }) {
    const auditId = crypto.randomUUID()
    const results = await this.binding.batch([
      this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, 'response.quarantine-deleted', (SELECT id FROM operators WHERE id = ? AND workspace_id = responses.workspace_id), 'response', NULL, '{}', ? FROM responses
        WHERE id = ? AND workspace_id = ? AND state = 'quarantined'`).bind(auditId, input.operatorId, input.now, input.responseId, input.workspaceId),
      this.binding.prepare(`UPDATE audit_entries SET subject_id = NULL, details_json = '{}' WHERE subject_type = 'response' AND subject_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(input.responseId, auditId),
      eraseResponseLocalMail(this.binding, input.responseId, input.workspaceId, auditId),
      this.binding.prepare('DELETE FROM response_outbox WHERE response_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)').bind(input.responseId, auditId),
      this.binding.prepare('DELETE FROM response_answers WHERE response_id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)').bind(input.responseId, auditId),
      this.binding.prepare(`DELETE FROM responses WHERE id = ? AND workspace_id = ? AND state = 'quarantined' AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(input.responseId, input.workspaceId, auditId),
    ])
    // D1 includes the invitation-erasure trigger's writes in meta.changes.
    return changes(results.at(-1)) > 0
  }

  async eraseReleasedResponse(input: ResponseErasureInput & { now: string }) {
    const auditId = crypto.randomUUID()
    const statements = responseErasureStatements({...input,state:'released'},auditId)
    const results = await this.eraseResponse(this.binding, input, statements)
    // D1 includes the invitation-erasure trigger's writes in meta.changes.
    return changes(results.at(-1)) > 0
  }

  async incrementPublicRateLimit(input: { scope: 'request' | 'session' | 'submission'; addressHash: string; windowStartedAt: string; expiresAt: string; limit: number; now: string }) {
    const results = await this.binding.batch([
      this.binding.prepare(`DELETE FROM public_rate_limit_windows WHERE expires_at <= ?`).bind(input.now),
      this.binding.prepare(`
        INSERT INTO public_rate_limit_windows (id, scope, address_hash, window_started_at, count, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(scope, address_hash, window_started_at) DO UPDATE
          SET count = count + 1, updated_at = excluded.updated_at
          WHERE public_rate_limit_windows.count < ?
      `).bind(`rate-${input.scope}-${input.addressHash}-${input.windowStartedAt}`, input.scope, input.addressHash, input.windowStartedAt, input.expiresAt, input.now, input.now, input.limit),
    ])
    return changes(results[1]) === 1
  }

  async foldExpiredSessions(now: string, limit = 1000) {
    const selected = `SELECT id FROM respondent_sessions WHERE expires_at <= ? AND ${ungovernedSaveSql('respondent_sessions.id')} ORDER BY expires_at, id LIMIT ?`
    const results = await this.binding.batch([
      this.binding.prepare(`INSERT INTO revision_step_metric_counters (id, revision_id, step_stable_id, reached, dropped, created_at, updated_at)
        SELECT 'step-metric-' || revision_id || '-' || furthest_step_id, revision_id, furthest_step_id, 0, COUNT(*), ?, ?
        FROM respondent_sessions WHERE id IN (${selected}) AND metric_folded_at IS NULL AND completed_at IS NULL AND furthest_step_id IS NOT NULL
        GROUP BY revision_id, furthest_step_id
        ON CONFLICT(revision_id, step_stable_id) DO UPDATE SET dropped = dropped + excluded.dropped, updated_at = excluded.updated_at`).bind(now, now, now, limit),
      this.binding.prepare(`DELETE FROM respondent_session_step_events WHERE session_id IN (${selected})`).bind(now, limit),
      this.binding.prepare(`DELETE FROM respondent_sessions WHERE id IN (${selected})`).bind(now, limit),
      this.binding.prepare(`DELETE FROM respondent_saves WHERE session_id IN (SELECT session_id FROM respondent_saves WHERE expires_at<=? AND ${ungovernedSaveSql('respondent_saves.session_id')} ORDER BY expires_at,session_id LIMIT ?)` ).bind(now,limit),
    ])
    return Math.max(changes(results[2]),changes(results[3]))
  }

  async purgeExpiredRateWindows(now: string, limit = 1000) {
    const result = await this.binding.prepare(`DELETE FROM public_rate_limit_windows WHERE id IN (
      SELECT id FROM public_rate_limit_windows WHERE expires_at <= ? ORDER BY expires_at, id LIMIT ?
    )`).bind(now, limit).run()
    return changes(result)
  }

  async countReleasedResponses(revisionId: string) {
    const row = await this.binding.prepare("SELECT COUNT(*) AS total FROM responses WHERE revision_id = ? AND state = 'released'").bind(revisionId).first<{ total: number }>()
    return row?.total ?? 0
  }

  async audience(revisionId: string) {
    const counts = await this.binding.prepare(`SELECT COUNT(*) AS launchedParticipants,
      COALESCE(SUM(CASE WHEN c.id IS NOT NULL AND c.opted_out_at IS NULL AND p.delivery_status != 'bounced' THEN 1 ELSE 0 END),0) AS eligibleParticipants,
      COALESCE(SUM(CASE WHEN c.id IS NOT NULL AND c.opted_out_at IS NULL AND p.delivery_status != 'bounced' AND EXISTS (SELECT 1 FROM responses r WHERE r.participant_id = p.id AND r.state = 'released') THEN 1 ELSE 0 END),0) AS completedParticipants
      FROM invitation_participants p LEFT JOIN distribution_contacts c ON c.id = p.contact_id WHERE p.revision_id = ?`).bind(revisionId).first<{ launchedParticipants: number; eligibleParticipants: number; completedParticipants: number }>()
    return counts!
  }

  async getResults(revisionId: string) {
    const [[counter], [completed]] = await this.database.batch([
      this.database.select().from(revisionMetricCounters).where(eq(revisionMetricCounters.revisionId, revisionId)).limit(1),
      this.database.select({ total: count(), imported: sql<number>`count(case when ${responses.source} = 'imported' then 1 end)`.mapWith(Number), live: sql<number>`count(case when ${responses.source} != 'imported' then 1 end)`.mapWith(Number) }).from(responses).where(and(eq(responses.revisionId, revisionId), eq(responses.state, 'released'))),
    ])
    if (!completed) throw new Error('Response result counts could not be read')
    return { counter, completedResponses: completed.total, importedResponses: completed.imported, liveCompletedResponses: completed.live }
  }

  async listQuarantined(workspaceId: string, revisionId: string) {
    const quarantined = await this.database.select().from(responses).where(and(eq(responses.workspaceId, workspaceId), eq(responses.revisionId, revisionId), eq(responses.state, 'quarantined')))
    return Promise.all(quarantined.map(async (response) => {
      const answers = await this.database.select().from(responseAnswers).where(eq(responseAnswers.responseId, response.id))
      return {
        id: response.id,
        quarantineReason: response.quarantineReason,
        completedAt: response.completedAt,
        answers: answers.map((answer) => ({ stepId: answer.stepId, value: JSON.parse(answer.valueJson) as unknown })),
      }
    }))
  }
}
