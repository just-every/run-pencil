import { z } from 'zod'
import { resourceId } from '../../shared/validation'

export const auditFiltersSchema = z.object({
  actorId: resourceId.optional(),
  flowId: resourceId.optional(),
  kind: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  from: z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()).optional(),
  to: z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()).optional(),
})
export const auditQuerySchema = auditFiltersSchema.extend({
  cursor: z.string().min(1).max(12000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()
export type AuditFilters = z.infer<typeof auditFiltersSchema>
export type AuditQuery = AuditFilters & { cursor?: string; limit?: number }
export type AuditScope = { workspaceId: string; sessionId: string }
export type AuditRow = {
  id: string
  kind: string
  createdAt: string
  actor: { id: string; name: string } | null
  form: { id: string; name: string } | null
  details: Record<string, number | string>
}
export type AuditPage = { rows: AuditRow[]; nextCursor: string | null; snapshotCursor: string; cutoff: string }
export type AuditOptions = {
  actors: Array<{ id: string; name: string }>
  forms: Array<{ id: string; name: string }>
  kinds: string[]
  truncated: { actors: boolean; forms: boolean; kinds: boolean }
}
export type AuditSnapshot = AuditScope & {
  filters: AuditFilters
  cutoff: string
  ceiling: number
  after: { createdAt: string; id: string } | null
}

// Exact event/key allowlists: no arbitrary metadata, provider identifiers, text,
// answer content or historical actor snapshots can cross the reader boundary.
export function auditDetails(kind: string, json: string): AuditRow['details'] {
  const countKeys: Record<string, string[]> = {
    'action.created': ['actions'], 'action.edited': ['fields'],
    'action.state_changed': ['actions'], 'action.verdict_recorded': ['actions'],
    'action.measurement_recorded': ['measurements'], 'segment.deleted': ['segments'], 'flow.published': ['revision'],
    'contact.erased': ['contacts', 'participants', 'responses', 'answers', 'deliveries', 'attempts', 'consentEvents', 'localMessages'],
    'submission.status_changed': ['fields'], 'submission.assignment_changed': ['fields'],
    'submission.tags_changed': ['fields'], 'submission.note_added': ['fields'],
    'submission.status_created': ['fields'],
  }
  const statusKeys: Record<string, Record<string, string[]>> = {
    'notification.delivery': { status: ['sent', 'pending', 'failed', 'unknown'] },
    'digest.delivery': { status: ['sent', 'pending', 'failed', 'unknown'] },
    'contact.consent-changed': { consent: ['renewed', 'opted-out'] },
    ...Object.fromEntries(['saved', 'tested', 'removed', 'rotated', 'paused', 'resumed'].map(change => [`connection.${change}`, { connection: ['analysis', 'task', 'payment', 'webhook', 'sms'] }])),
    'export.created': { export: ['responses', 'backup'] },
  }
  const counts = Object.hasOwn(countKeys, kind) ? countKeys[kind] : []
  const statuses = Object.hasOwn(statusKeys, kind) ? statusKeys[kind] : {}
  if (!counts.length && !Object.keys(statuses).length) return {}
  let value: unknown
  try { value = JSON.parse(json) } catch { return {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>, details: AuditRow['details'] = {}
  for (const key of counts) {
    const count = record[key]
    if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) details[key] = count
  }
  for (const [key, allowed] of Object.entries(statuses)) {
    const status = record[key]
    if (typeof status === 'string' && allowed.includes(status)) details[key] = status
  }
  return details
}
