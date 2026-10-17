import type { AuditRow, AuditSnapshot } from './model'
import { readAuditRows } from './reader-query'

const bytes = new TextEncoder()
function cell(value: string) {
  // Quoting alone does not stop spreadsheet formulas in operator-written names.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
function line(row: AuditRow) {
  return [row.id, row.createdAt, row.kind, row.actor?.id ?? '', row.actor?.name ?? '', row.form?.id ?? '', row.form?.name ?? '', JSON.stringify(row.details)].map(cell).join(',') + '\r\n'
}

export function auditCsvStream(db: D1Database, initial: AuditSnapshot, signal?: AbortSignal) {
  let snapshot = initial, header = true, cancelled = false
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled || signal?.aborted) { controller.error(new Error('Audit download cancelled.')); return }
      if (header) {
        header = false
        controller.enqueue(bytes.encode('event_id,created_at,event_kind,actor_id,actor_name,form_id,form_name,details\r\n'))
        return
      }
      const rows = await readAuditRows(db, snapshot, 100)
      if (cancelled || signal?.aborted) { controller.error(new Error('Audit download cancelled.')); return }
      if (rows.length) {
        controller.enqueue(bytes.encode(rows.map(line).join('')))
        const last = rows[rows.length - 1]
        snapshot = { ...snapshot, after: { createdAt: last.createdAt, id: last.id } }
      }
      if (rows.length < 100) controller.close()
    },
    cancel() { cancelled = true },
  })
}
