import type { CollectorSource } from './model'
import { CollectorClosedError } from './service'
export type CollectorSql = { sql: string; params: Array<string | number | null> }

/** D1 may wrap the trigger error in one or more cause objects. */
export function throwCollectorAdmissionFailure(error: unknown): never {
  let cause = error
  for (let depth = 0; depth < 5 && cause; depth++) {
    if (String(cause).includes('COLLECTOR_CLOSED')) throw new CollectorClosedError()
    cause = typeof cause === 'object' && 'cause' in cause ? cause.cause : undefined
  }
  throw error
}

/** Expressions are trusted SQL identifiers from the calling repository, never input values. */
export function collectorAdmissionSql(collectorExpression: string, flowExpression: string, now: string, sourceExpression?: string): CollectorSql {
  return { sql: `EXISTS(SELECT 1 FROM collectors admission_collector
    WHERE admission_collector.id=${collectorExpression} AND admission_collector.flow_id=${flowExpression}
    ${sourceExpression ? `AND (admission_collector.system_source IS NULL OR admission_collector.system_source=${sourceExpression})` : ''}
    AND admission_collector.closed_at IS NULL
    AND (admission_collector.deadline_at IS NULL OR admission_collector.deadline_at>?)
    AND (admission_collector.response_limit IS NULL OR
      (SELECT count(*) FROM response_collector WHERE collector_id=admission_collector.id)<admission_collector.response_limit))`, params: [now] }
}
export function sessionCollectorAdmissionSql(sessionExpression: string, flowExpression: string, now: string, sourceExpression?: string): CollectorSql {
  const open = collectorAdmissionSql('session_attribution.collector_id', flowExpression, now, sourceExpression)
  return { sql: `EXISTS(SELECT 1 FROM session_collector session_attribution WHERE session_attribution.session_id=${sessionExpression} AND ${open.sql})`, params: open.params }
}
export function invitationCollectorAdmissionSql(launchExpression: string, flowExpression: string, now: string): CollectorSql {
  const open = collectorAdmissionSql('launch_attribution.collector_id', flowExpression, now, "'invitation'")
  return { sql: `EXISTS(SELECT 1 FROM invitation_launch_collector launch_attribution WHERE launch_attribution.launch_id=${launchExpression} AND ${open.sql})`, params: open.params }
}

/** Append immediately after the guarded session INSERT, in that same D1 batch. */
export function bindSessionCollectorSql(input: { sessionId: string; collectorId: string; flowId: string; source: CollectorSource; now: string }): CollectorSql[] {
  const open = collectorAdmissionSql('?', '?', input.now, '?')
  return [
    { sql: `UPDATE session_collector SET collector_id=? WHERE session_id=? AND ${open.sql}`,
      params: [input.collectorId, input.sessionId, input.collectorId, input.flowId, input.source, ...open.params] },
    { sql: `SELECT json('COLLECTOR_CLOSED') WHERE EXISTS(SELECT 1 FROM respondent_sessions WHERE id=?)
      AND (NOT EXISTS(SELECT 1 FROM session_collector WHERE session_id=? AND collector_id=?) OR NOT (${open.sql}))`,
      params: [input.sessionId, input.sessionId, input.collectorId, input.collectorId, input.flowId, input.source, ...open.params] },
  ]
}

/** Append after the new launch INSERT and before its candidates/participants. */
export function bindInvitationCollectorSql(input: { launchId: string; collectorId: string; flowId: string; now: string }): CollectorSql[] {
  const open = collectorAdmissionSql('?', '?', input.now, "'invitation'")
  return [
    { sql: `UPDATE invitation_launch_collector SET collector_id=? WHERE launch_id=? AND collector_id IS NOT ? AND ${open.sql}`,
      params: [input.collectorId, input.launchId, input.collectorId, input.collectorId, input.flowId, ...open.params] },
    { sql: `SELECT json('COLLECTOR_CLOSED') WHERE EXISTS(SELECT 1 FROM invitation_launches WHERE id=?)
      AND (NOT EXISTS(SELECT 1 FROM invitation_launch_collector WHERE launch_id=? AND collector_id=?) OR NOT (${open.sql}))`,
      params: [input.launchId, input.launchId, input.collectorId, input.collectorId, input.flowId, ...open.params] },
  ]
}
