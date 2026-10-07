import { ulid } from 'ulid'
import type { AuditRepository } from './repository'

export type AuditRecord = {
  workspaceId: string
  kind: string
  actorOperatorId?: string | null
  subjectType: string
  subjectId?: string | null
  details: Record<string, unknown>
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(record: AuditRecord) {
    await this.repository.create({
      id: ulid(),
      workspaceId: record.workspaceId,
      kind: record.kind,
      actorOperatorId: record.actorOperatorId ?? null,
      subjectType: record.subjectType,
      subjectId: record.subjectId ?? null,
      detailsJson: JSON.stringify(record.details),
      createdAt: new Date().toISOString(),
    })
  }
}
