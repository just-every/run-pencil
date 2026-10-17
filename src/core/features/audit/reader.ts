import { ValidationError } from '../../shared/errors'
import { openAuditCursor, sealAuditCursor } from './cursor'
import { auditQuerySchema, type AuditFilters, type AuditOptions, type AuditPage, type AuditQuery, type AuditScope, type AuditSnapshot } from './model'
import { readAuditRows } from './reader-query'

const filterKeys = ['actorId', 'flowId', 'kind', 'from', 'to'] as const
function filtersOf(input: AuditQuery): AuditFilters {
  return Object.fromEntries(filterKeys.flatMap(key => input[key] === undefined ? [] : [[key, input[key]]]))
}

export class AuditReader {
  constructor(private readonly db: D1Database, private readonly secret: string, private readonly scope: AuditScope) {}

  async snapshot(input: AuditQuery): Promise<AuditSnapshot> {
    const parsed = auditQuerySchema.safeParse(input)
    if (!parsed.success) throw new ValidationError('Choose valid audit search filters.')
    const filters = filtersOf(parsed.data)
    if (filters.from && filters.to && filters.from > filters.to) throw new ValidationError('The audit start time must be before its end time.')
    let snapshot: AuditSnapshot
    if (input.cursor) {
      snapshot = await openAuditCursor(input.cursor, this.secret, this.scope)
      if (JSON.stringify(snapshot.filters) !== JSON.stringify(filters)) throw new ValidationError('Audit filters changed. Start the search again.')
    } else {
      const cutoff = new Date().toISOString()
      const ceiling = await this.db.prepare('SELECT COALESCE(MAX(rowid), 0) AS ceiling FROM audit_entries WHERE workspace_id = ?').bind(this.scope.workspaceId).first<{ ceiling: number }>()
      snapshot = { ...this.scope, filters, cutoff, ceiling: ceiling!.ceiling, after: null }
    }
    // Identical denial for absent and foreign records: no ownership oracle.
    const checks: Promise<unknown>[] = []
    if (filters.actorId) checks.push(this.db.prepare('SELECT id FROM operators WHERE workspace_id = ? AND id = ?').bind(this.scope.workspaceId, filters.actorId).first())
    if (filters.flowId) checks.push(this.db.prepare('SELECT id FROM flows WHERE workspace_id = ? AND id = ?').bind(this.scope.workspaceId, filters.flowId).first())
    if ((await Promise.all(checks)).some(row => !row)) throw new ValidationError('The selected audit filter is unavailable in this workspace.')
    return snapshot
  }

  async page(input: AuditQuery): Promise<AuditPage> {
    const snapshot = await this.snapshot(input), limit = input.limit ?? 50
    const found = await readAuditRows(this.db, snapshot, limit + 1), rows = found.slice(0, limit)
    const last = rows.at(-1)
    const [snapshotCursor, nextCursor] = await Promise.all([
      sealAuditCursor({ ...snapshot, after: null }, this.secret),
      found.length > limit && last ? sealAuditCursor({ ...snapshot, after: { createdAt: last.createdAt, id: last.id } }, this.secret) : Promise.resolve(null),
    ])
    return { rows, nextCursor, snapshotCursor, cutoff: snapshot.cutoff }
  }

  async options(actorSearch = '', formSearch = ''): Promise<AuditOptions> {
    const [actors, forms, kinds] = await Promise.all([
      this.db.prepare('SELECT id, display_name AS name FROM operators WHERE workspace_id = ? AND instr(lower(display_name), lower(?)) > 0 ORDER BY display_name, id LIMIT 101').bind(this.scope.workspaceId, actorSearch).all<{ id: string; name: string }>(),
      this.db.prepare('SELECT id, title AS name FROM flows WHERE workspace_id = ? AND instr(lower(title), lower(?)) > 0 ORDER BY title, id LIMIT 101').bind(this.scope.workspaceId, formSearch).all<{ id: string; name: string }>(),
      this.db.prepare('SELECT DISTINCT kind FROM audit_entries WHERE workspace_id = ? ORDER BY kind LIMIT 101').bind(this.scope.workspaceId).all<{ kind: string }>(),
    ])
    return {
      actors: actors.results.slice(0, 100), forms: forms.results.slice(0, 100), kinds: kinds.results.slice(0, 100).map(row => row.kind),
      truncated: { actors: actors.results.length > 100, forms: forms.results.length > 100, kinds: kinds.results.length > 100 },
    }
  }

  async csv(input: AuditQuery, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const snapshot = await this.snapshot(input)
    const { auditCsvStream } = await import('./csv')
    return auditCsvStream(this.db, { ...snapshot, after: null }, signal)
  }
}
