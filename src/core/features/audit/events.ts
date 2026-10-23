import type { Context } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'

/** The operator-initiated event families beyond the existing change events (GOV-005): publish, connection changes and exports.
 * Details are counts and enumerated kinds only (see `auditDetails`); never a key, secret, answer or address. */
export async function recordOperatorAudit(context: Context<WorkerEnvironment>, kind: string, subject: { type: string; id?: string | null }, details: Record<string, string | number> = {}) {
  const session = context.get('operatorSession')
  await context.get('services').audit.record({ workspaceId: session.workspaceId, kind, actorOperatorId: session.operatorId, subjectType: subject.type, subjectId: subject.id ?? null, details })
}
