import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { Buffer } from 'node:buffer'
import { NotFoundError, ValidationError } from '../../shared/errors'
import { csvCell } from '../../shared/csvCell'
import { checkGeneration, generation, openCursor, sealCursor, type EvidenceScope } from './cursor'
import { ReportingRepository, type LedgerFilter, type LedgerResponse } from './repository'
import { responseScope, type ResponseSelection } from './scope'
import { contactColumnInventory, contactColumns, contactRecord } from './contactExport'
import { exportInventory, questionMetadata } from './exportInventory'
import { savVariables, savWidths } from './savDictionary'
import { savCases, savHeader, savLayout, type SavPending } from './savWriter'
import { xlsxContinue, xlsxFinish, xlsxRow, xlsxStart, type XlsxState } from './xlsxExport'
export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'sav'
export const exportFormats = ['json', 'csv', 'xlsx', 'sav'] as const
export type ExportCursor = EvidenceScope & { kind: 'export'; filter: LedgerFilter; format: ExportFormat; includeAutomatedExclusions: boolean; includedQuarantined: number; contactInventory?: string; savWidths?: string; sav?: SavPending; xlsx?: XlsxState; total: number; excludedQuarantined: number; written: number; after?: {time:string;id:string} }
export type ExportIdentity = { workspaceId: string; sessionId: string; flowId: string }
const selection = (cursor: Pick<ExportCursor, 'includeAutomatedExclusions'>): ResponseSelection => cursor.includeAutomatedExclusions ? 'with-automated-exclusions' : 'released'
export async function startExport(db: D1Database, secret: string, identity: ExportIdentity, filter: LedgerFilter, format: ExportFormat, signal?: AbortSignal, includeAutomatedExclusions = false) {
  signal?.throwIfAborted()
  const repository = new ReportingRepository(db)
  if (!await repository.flow(identity.workspaceId,identity.flowId)) throw new NotFoundError('This flow is not available in your workspace.')
  const scope = { ...identity, generation: await generation(db,identity.workspaceId), cutoff: new Date().toISOString() }
  const counts = await db.batch((['released','quarantined','automated-exclusions'] as ResponseSelection[]).map(state => {
    const {where,bindings} = responseScope(identity.workspaceId,identity.flowId,filter,scope.cutoff,state)
    return db.prepare(`SELECT COUNT(*) AS count FROM responses r WHERE ${where}`).bind(...bindings)
  }))
  const state = selection({ includeAutomatedExclusions })
  const contactInventory = format === 'csv' || format === 'xlsx' ? await contactColumnInventory(db, identity.workspaceId, identity.flowId, filter, scope.cutoff, signal, state) : undefined
  let widths: string | undefined
  if (format === 'sav') {
    const inventory = await exportInventory(db, identity.workspaceId, identity.flowId, filter, scope.cutoff, state)
    const encoded = Buffer.from(deflateRawSync(Buffer.from(JSON.stringify(await savWidths(db, inventory, savVariables(inventory), identity.workspaceId, identity.flowId, filter, scope.cutoff, state))))).toString('base64')
    widths = encoded
    if (encoded.length > 40000) throw new ValidationError('This SPSS export has too many variables for one export. Select fewer published revisions and export again.')
  }
  signal?.throwIfAborted()
  await checkGeneration(db,scope)
  const includedQuarantined = includeAutomatedExclusions ? (counts[2].results[0] as {count:number}).count : 0
  const cursor: ExportCursor = { kind: 'export', ...scope, filter: { ...filter, offset: undefined }, format, contactInventory, ...(widths ? { savWidths: widths, sav: { commands: [], data: [] } } : {}), ...(format === 'xlsx' ? { xlsx: { crc: 0, size: 0 } } : {}), includeAutomatedExclusions, includedQuarantined, total: (counts[0].results[0] as {count:number}).count + includedQuarantined, excludedQuarantined: (counts[1].results[0] as {count:number}).count - includedQuarantined, written: 0 }
  const token = await sealCursor(cursor,secret)
  if (token.length > 62000) throw new ValidationError('This export exceeds the report cursor size limit. Narrow the selected responses and export again.')
  return { token, cutoff: scope.cutoff, total: cursor.total, includedQuarantined, includeAutomatedExclusions, excludedQuarantined: cursor.excludedQuarantined, filename: `pencil-responses-${scope.cutoff.replaceAll(':','-')}.${format}`, format }
}
export const csvHeader = 'response_id,revision_id,revision_number,source,started_at,completed_at,released_at,participant_json,answers_json,cutoff,excluded_quarantined,omitted_questions_json,collector_id,collector_name,collector_channel,response_state,exclusion_reason,hidden_fields_json,identity_mode,discarded_parameters,calculations_json,verified_email,verified_subject,presented_order_json,payment_subtotal,payment_discount,payment_tax,payment_total'
/** The CSV's values in column order; XLSX sheet one holds the same values. */
export function exportValues(row: LedgerResponse, cursor: Pick<ExportCursor,'cutoff'|'excludedQuarantined'|'contactInventory'>, columns = contactColumns(cursor.contactInventory)): Array<string | number | null | undefined> {
  return [row.id,row.revisionId,row.revisionNumber,row.source,row.startedAt,row.completedAt,row.releasedAt,row.participant ? JSON.stringify(row.participant) : '',JSON.stringify(row.answers),cursor.cutoff,cursor.excludedQuarantined,JSON.stringify(row.omittedQuestions),row.collector.id,row.collector.name,row.collector.channel,row.state,row.quarantineReason,JSON.stringify(row.hiddenFields),row.identityMode,row.discardedParameters,JSON.stringify(row.calculations),row.verifiedEmail,row.verifiedSubject,JSON.stringify(row.presentedOrder),row.payment?.providerAmount,row.payment?.discount,row.payment?.tax,row.payment?.total,...contactRecord(row, columns)]
}
export function csvRecord(row: LedgerResponse, cursor: Pick<ExportCursor,'cutoff'|'excludedQuarantined'|'contactInventory'>, columns = contactColumns(cursor.contactInventory)) {
  return '\r\n'+exportValues(row,cursor,columns).map(csvCell).join(',')
}
export async function exportPart(db: D1Database, secret: string, identity: ExportIdentity, token: string, signal: AbortSignal) {
  const cursor = await openCursor<ExportCursor>(token,secret)
  if (!cursor || cursor.kind !== 'export') throw new ValidationError('Invalid export cursor. Start again.')
  if (Object.entries(identity).some(([key,value]) => cursor[key as keyof ExportCursor] !== value)) throw new ValidationError('This export belongs to a different session or flow.')
  signal.throwIfAborted()
  await checkGeneration(db,cursor)
  // SPSS codes choices by stable choice ID; every other format carries the CSV's published choice values.
  const page = await new ReportingRepository(db).ledger(identity.workspaceId,identity.flowId,cursor.filter,cursor.cutoff,selection(cursor),32,{ total: cursor.total, after: cursor.after },signal,cursor.format === 'sav' ? 'stored' : 'export')
  signal.throwIfAborted()
  await checkGeneration(db,cursor)
  const last = page.responses.at(-1)
  const next: ExportCursor = { ...cursor, written: cursor.written + page.responses.length, ...(last ? { after: { time: last.completedAt, id: last.id } } : {}) }
  if (next.written > cursor.total || (!last && next.written !== cursor.total)) throw new ValidationError('The complete export could not be read. Start again.')
  const complete = next.written === cursor.total
  const columns = cursor.format === 'csv' || cursor.format === 'xlsx' ? contactColumns(cursor.contactInventory) : []
  const encoder = new TextEncoder()
  // Binary formats encode the bounded page before the next cursor is sealed: XLSX carries its
  // running CRC forward, and a value that does not fit is refused before any byte of this part.
  let encoded: Uint8Array[] | undefined, tail: (() => AsyncIterable<Uint8Array>) | undefined
  if (cursor.format === 'xlsx') {
    const header = [...csvHeader.split(','), ...columns]
    const start = cursor.written === 0 ? xlsxStart(header) : undefined
    const rows = page.responses.map((row, index) => encoder.encode(xlsxRow(exportValues(row, cursor, columns), cursor.written + index + 2)))
    let state = cursor.xlsx!
    for (const bytes of [...(start ? [start.data] : []), ...rows]) state = xlsxContinue(state, bytes)
    next.xlsx = state
    encoded = [...(start ? [...start.prefix, start.data] : []), ...rows]
    tail = async function* () { yield* xlsxFinish(state, questionMetadata(await exportInventory(db, identity.workspaceId, identity.flowId, cursor.filter, cursor.cutoff, selection(cursor)))) }
  } else if (cursor.format === 'sav') {
    const inventory = await exportInventory(db, identity.workspaceId, identity.flowId, cursor.filter, cursor.cutoff, selection(cursor))
    const variables = savVariables(inventory), widths = JSON.parse(Buffer.from(inflateRawSync(Buffer.from(cursor.savWidths!, 'base64'))).toString('utf8')) as number[]
    if (widths.length !== variables.length) throw new ValidationError('Responses changed during this report. Refresh and try again.')
    const layout = savLayout(variables, widths)
    const cases = savCases(layout, page.responses.map(row => layout.map(column => column.read(row, cursor.cutoff, cursor.excludedQuarantined))), cursor.sav!, complete)
    next.sav = cases.pending
    encoded = [...(cursor.written === 0 ? [savHeader(layout, cursor.total, new Date(cursor.cutoff))] : []), cases.bytes]
  }
  const nextToken = complete ? undefined : await sealCursor(next,secret)
  async function* body(): AsyncGenerator<Uint8Array> {
    if (encoded) { yield* encoded; return }
    if (cursor.written === 0) yield encoder.encode(cursor.format === 'csv' ? csvHeader + columns.map(column => ',' + csvCell(column)).join('') : JSON.stringify({ cutoff: cursor.cutoff, filter: { ...cursor.filter, deviceClass: undefined }, excludedQuarantined: cursor.excludedQuarantined, includedQuarantined: cursor.includedQuarantined, includeAutomatedExclusions: cursor.includeAutomatedExclusions }).slice(0,-1)+',"responses":[')
    for (const [position, row] of page.responses.entries()) yield encoder.encode(cursor.format === 'csv' ? csvRecord(row,cursor,columns) : (cursor.written+position > 0 ? ',' : '')+JSON.stringify(row))
  }
  async function* closing(): AsyncGenerator<Uint8Array> {
    // This is the commit point: a changed evidence set aborts the download,
    // including changes after its final data query. Never append an error record.
    await checkGeneration(db,cursor)
    signal.throwIfAborted()
    if (!complete) return
    if (cursor.format === 'json') yield encoder.encode(']}')
    if (tail) yield* tail()
  }
  const chunks = (async function* () { yield* body(); yield* closing() })()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        signal.throwIfAborted()
        const chunk = await chunks.next()
        if (chunk.done) controller.close(); else controller.enqueue(chunk.value)
      } catch (error) { controller.error(error) }
    },
    async cancel() { page.responses.length = 0; await chunks.return(undefined) },
  }, { highWaterMark: 0 })
  return { stream, nextToken, complete, written: next.written }
}
