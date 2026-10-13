import { NotFoundError, ValidationError } from '../../shared/errors'
import { checkGeneration, generation, openCursor, sealCursor, type EvidenceScope } from './cursor'
import { ReportingRepository, type LedgerFilter, type LedgerResponse } from './repository'
import { responseScope } from './scope'
export type ExportCursor = EvidenceScope & { kind: 'export'; filter: LedgerFilter; format: 'json' | 'csv'; total: number; excludedQuarantined: number; written: number; after?: {time:string;id:string} }
export type ExportIdentity = { workspaceId: string; sessionId: string; flowId: string }
export async function startExport(db: D1Database, secret: string, identity: ExportIdentity, filter: LedgerFilter, format: 'json' | 'csv') {
  const repository = new ReportingRepository(db)
  if (!await repository.flow(identity.workspaceId,identity.flowId)) throw new NotFoundError('This flow is not available in your workspace.')
  const scope = { ...identity, generation: await generation(db,identity.workspaceId), cutoff: new Date().toISOString() }
  const counts = await db.batch(['released','quarantined'].map(state => {
    const {where,bindings} = responseScope(identity.workspaceId,identity.flowId,filter,scope.cutoff,state as 'released'|'quarantined')
    return db.prepare(`SELECT COUNT(*) AS count FROM responses r WHERE ${where}`).bind(...bindings)
  }))
  await checkGeneration(db,scope)
  const cursor: ExportCursor = { kind: 'export', ...scope, filter: { ...filter, offset: undefined }, format, total: (counts[0].results[0] as {count:number}).count, excludedQuarantined: (counts[1].results[0] as {count:number}).count, written: 0 }
  return { token: await sealCursor(cursor,secret), cutoff: scope.cutoff, total: cursor.total, excludedQuarantined: cursor.excludedQuarantined, filename: `pencil-responses-${scope.cutoff.replaceAll(':','-')}.${format}`, format }
}
const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`
export const csvHeader = 'response_id,revision_id,revision_number,source,started_at,completed_at,released_at,participant_json,answers_json,cutoff,excluded_quarantined,omitted_questions_json'
export function csvRecord(row: LedgerResponse, cursor: Pick<ExportCursor,'cutoff'|'excludedQuarantined'>) {
  return '\r\n'+[row.id,row.revisionId,row.revisionNumber,row.source,row.startedAt,row.completedAt,row.releasedAt,row.participant ? JSON.stringify(row.participant) : '',JSON.stringify(row.answers),cursor.cutoff,cursor.excludedQuarantined,JSON.stringify(row.omittedQuestions)].map(csv).join(',')
}
export async function exportPart(db: D1Database, secret: string, identity: ExportIdentity, token: string, signal: AbortSignal) {
  const cursor = await openCursor<ExportCursor>(token,secret)
  if (!cursor || cursor.kind !== 'export') throw new ValidationError('Invalid export cursor. Start again.')
  if (Object.entries(identity).some(([key,value]) => cursor[key as keyof ExportCursor] !== value)) throw new ValidationError('This export belongs to a different session or flow.')
  signal.throwIfAborted()
  await checkGeneration(db,cursor)
  const page = await new ReportingRepository(db).ledger(identity.workspaceId,identity.flowId,cursor.filter,cursor.cutoff,'released',32,{ total: cursor.total, after: cursor.after },signal)
  signal.throwIfAborted()
  await checkGeneration(db,cursor)
  const last = page.responses.at(-1)
  const next: ExportCursor = { ...cursor, written: cursor.written + page.responses.length, ...(last ? { after: { time: last.completedAt, id: last.id } } : {}) }
  if (next.written > cursor.total || (!last && next.written !== cursor.total)) throw new ValidationError('The complete export could not be read. Start again.')
  const complete = next.written === cursor.total
  const nextToken = complete ? undefined : await sealCursor(next,secret)
  let position = 0
  const encoder = new TextEncoder()
  let started = false
  let ended = false
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        signal.throwIfAborted()
        if (!started) {
          started = true
          if (cursor.written === 0) {
            controller.enqueue(encoder.encode(cursor.format === 'csv' ? csvHeader : JSON.stringify({ cutoff: cursor.cutoff, filter: cursor.filter, excludedQuarantined: cursor.excludedQuarantined }).slice(0,-1)+',"responses":['))
            return
          }
        }
        const row = page.responses[position++]
        if (row) { controller.enqueue(encoder.encode(cursor.format === 'csv' ? csvRecord(row,cursor) : (cursor.written+position > 1 ? ',' : '')+JSON.stringify(row))); return }
        if (!ended) {
          ended = true
          // This is the commit point: a changed evidence set aborts the download,
          // including changes after its final data query. Never append an error record.
          await checkGeneration(db,cursor)
          signal.throwIfAborted()
          if (complete && cursor.format === 'json') controller.enqueue(encoder.encode(']}'))
        }
        controller.close()
      } catch (error) { controller.error(error) }
    },
    cancel() { ended = true; page.responses.length = 0 },
  }, { highWaterMark: 0 })
  return { stream, nextToken, complete, written: next.written }
}
