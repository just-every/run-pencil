import { sql } from 'drizzle-orm'
import type { PencilDatabase } from '../../platform/db/repository'
import { auditEntries } from '../../platform/db/schema'

export class AuditRepository {
  constructor(private readonly database: PencilDatabase) {}

  async create(entry: typeof auditEntries.$inferInsert) {
    // Recheck at insertion: in-flight mail/actions may finish after removal.
    // Preserve the event without restoring personal references or mail IDs.
    const personalSubject = entry.subjectType === 'operator' || entry.subjectType === 'operator_session'
    const subject = entry.subjectType === 'operator'
      ? sql`(SELECT id FROM operators WHERE id = ${entry.subjectId ?? null} AND workspace_id = ${entry.workspaceId})`
      : entry.subjectType === 'operator_session'
        ? sql`(SELECT s.id FROM operator_sessions s JOIN operators o ON o.id = s.operator_id
            WHERE s.id = ${entry.subjectId ?? null} AND o.workspace_id = ${entry.workspaceId})`
        : sql`${entry.subjectId ?? null}`
    await this.database.run(sql`INSERT INTO audit_entries
      (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
      SELECT ${entry.id}, ${entry.workspaceId}, ${entry.kind},
        (SELECT id FROM operators WHERE id = ${entry.actorOperatorId ?? null} AND workspace_id = ${entry.workspaceId}),
        ${entry.subjectType}, ${subject},
        CASE WHEN ${personalSubject ? 1 : 0} = 1 AND ${subject} IS NULL THEN '{}' ELSE ${entry.detailsJson} END,
        ${entry.createdAt}`)
  }
}
