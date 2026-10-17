import { Buffer } from 'node:buffer'
import { canonicalJson, sha256, type SourceBundle, type TargetEffect, type Json, type SourceRecord } from '../../../base/import-kit/src/d1/index'
import manifest from '../../../../seed.json'
import { typeSettingsValid } from '../../shared/questionTypes'
import { ValidationError } from '../../shared/errors'
import { csvRows } from './csv'
import { responseStore } from './response-store'
import { rowErrorStore } from './row-errors'
import { sourceRecords } from './source-records'
import { mapFields, object, stableId } from './fields'
import { mapLogic } from './logic'
import { reportGraph } from './graph-report'
import { mapResponses, suggestColumns } from './response-mapping'
import { mappingVersion, type ImportInput, type ParsedResponse } from './model'
import { formEffect, responseEffect } from './effects'
import { nativeValueStrings } from './effect-values'
import { forbiddenSource, forbiddenSources } from './source-privacy'
import { googleSource } from './google-source'
import { googleTime } from './google-time'
import { mapJsonResponses } from './response-json'
import { googleIdentity } from './google-fields'
import { canonicalHash } from '../../../base/import-kit/src/provenance/canonical-hash'
export function prepareImport(input: ImportInput, workspaceId: string, hashPayload = canonicalHash) {
  const definitionBytes = Buffer.byteLength(input.definition), csvBytes = Buffer.byteLength(input.csv), responseBytes = Buffer.byteLength(input.responses ?? '')
  const jsonResponses = Boolean(input.responses?.trim())
  if (input.csv.trim() && jsonResponses) throw new ValidationError('Choose either response CSV or response JSON, not both.')
  if (jsonResponses && !input.definition.trim()) throw new ValidationError('Response JSON requires its form definition.')
  if (definitionBytes + csvBytes + responseBytes > 8 * 1024 * 1024) throw new ValidationError('Import files exceed the 8 MiB combined upload limit. Nothing was written.')
  const google = input.source === 'google-forms'
  if (input.source && !['typeform', 'google-forms'].includes(input.source)) throw new ValidationError('Unknown import source.')
  if (!google && input.google) throw new ValidationError('Google settings require the Google Forms source.')
  if (google && !input.definition.trim() && !input.csv.trim() && !jsonResponses) throw new ValidationError('Provide a Google definition or response CSV.')
  if (google && input.columns?.some(column => column.choice)) throw new ValidationError('Google response exports use one column per question. Separate choice columns are not supported.')
  let definition: Record<string, any>
  try { definition = object(JSON.parse(input.definition || (google ? '{}' : ''))) } catch { throw new ValidationError('Form JSON is not valid.') }
  if (!google && (!Array.isArray(definition.fields) || typeof definition.title !== 'string' || !definition.title.trim())) throw new ValidationError('Form JSON needs a title and fields array.')
  if (!google) for (const key of ['welcome_screens', 'thankyou_screens', 'logic']) if (definition[key] !== undefined && !Array.isArray(definition[key])) throw new ValidationError(`${key} must be an array.`)
  if (definition.hidden !== undefined && (!Array.isArray(definition.hidden) || definition.hidden.some((name: unknown) => typeof name !== 'string'))) throw new ValidationError('Hidden source names must be an array of strings.')
  const plannedAt = input.plannedAt ?? new Date().toISOString()
  const formHash = sha256(input.definition), csvHash = sha256(input.csv), responseHash = jsonResponses ? sha256(input.responses!) : csvHash, digest = sha256(`${formHash}:${csvHash}${jsonResponses ? ':' + responseHash : ''}`)
  const namespace = `${google ? 'google-forms' : 'documented-form'}:${digest}`, flowId = stableId(workspaceId, google ? namespace : digest)
  const googleParsed = google ? googleSource(input, definition, namespace) : undefined
  const forbidden = googleParsed?.forbidden ?? forbiddenSources(definition), form = googleParsed?.form ?? mapFields(definition, namespace, forbidden)
  if (!google) mapLogic(form, definition.logic)
  reportGraph(form)
  const limits = manifest.limits
  if ((google ? definition.items?.length ?? 0 : definition.fields.length) + (definition.welcome_screens?.length ?? 0) + (definition.thankyou_screens?.length ?? 0) > limits.steps.perRevision || form.steps.length > limits.steps.perRevision || form.title.length > 200 || limits.flowRevisions.perFlow < 2) throw new ValidationError('Form exceeds the configured flow, revision, step or title limits. Nothing was written.')
  for (const step of form.steps) {
    if (!typeSettingsValid(step.questionType, step.settings)) throw new ValidationError('A question has invalid native type settings. Nothing was written.')
    if (step.prompt.length > 1000 || !step.prompt.trim() || (step.helperText?.length ?? 0) > 1000 || step.choices.length > limits.steps.choiceOptionsPerStep || (step.questionType === 'priority' && step.choices.length > limits.steps.priorityOptionsPerStep) || form.rules.filter(r => r.source === step.id).length > limits.steps.branchRulesPerStep) throw new ValidationError('A question exceeds the configured prompt, choice or branch limits. Nothing was written.')
    if (new Set(step.choices.map(c => c.id)).size !== step.choices.length || new Set(step.choices.map(c => c.label.trim().toLowerCase())).size !== step.choices.length || step.choices.some(c => !c.label.trim() || c.label.length > 300)) throw new ValidationError('Choices need distinct nonempty labels within 300 characters.')
    if (['single_choice', 'multiple_choice', 'dropdown', 'priority'].includes(step.questionType ?? '') && !step.choices.length) throw new ValidationError('A choice question has no choices.')
    if (step.questionType === 'rating' && (!Number.isInteger(step.settings.min) || !Number.isInteger(step.settings.max) || Number(step.settings.max) <= Number(step.settings.min) || Number(step.settings.max) - Number(step.settings.min) > 10)) throw new ValidationError('A scale exceeds native rating limits.')
    if (step.questionType === 'multiple_choice' && (!Number.isInteger(step.settings.minSelections) || !Number.isInteger(step.settings.maxSelections) || Number(step.settings.minSelections) < 0 || Number(step.settings.maxSelections) < Number(step.settings.minSelections) || Number(step.settings.maxSelections) > step.choices.length)) throw new ValidationError('Selection bounds are invalid.')
  }
  if (!google && !form.steps.some(s => s.kind === 'question')) throw new ValidationError('No supported questions remain to import.')
  const csv = csvRows(input.csv), firstRow = csv.next().value, headers: string[] = firstRow?.cells ?? [], errors = rowErrorStore()
  errors.push(...(firstRow?.errors ?? []))
  function* admittedRows() { for (const row of csv) { if (row.row - 1 > limits.responses.perRevision) throw new ValidationError('CSV exceeds the configured responses-per-revision limit. Nothing was written.'); yield row } }
  const forbiddenColumns = headers.flatMap((header, column) => forbiddenSource(header, forbidden) || googleParsed?.hardColumns.has(column) ? [column] : [])
  const columns = input.columns?.map(column => ({ ...column })) ?? googleParsed?.columns ?? suggestColumns(headers, form, forbiddenColumns)
  if (columns.length !== headers.length || new Set(columns.map(c => c.column)).size !== headers.length || columns.some(c => c.column < 0 || c.column >= headers.length)) throw new ValidationError('Review exactly one mapping for each CSV column.')
  if (google) {
    const assigned = new Set<string>()
    for (const c of columns) {
      if (c.target === 'skip' || forbiddenColumns.includes(c.column)) continue
      if (c.target === 'startedAt' || c.target === 'submittedAt' && !/^timestamp$/i.test(headers[c.column].trim())) throw new ValidationError('Google response exports supply only the original Timestamp submission column; choose that column explicitly.')
      if (assigned.has(c.target)) throw new ValidationError('More than one column maps to this answer or timestamp. Review each column explicitly.')
      assigned.add(c.target)
      if (!['startedAt', 'submittedAt'].includes(c.target) && !form.steps.some(s => s.kind === 'question' && s.id === c.target)) throw new ValidationError('Unknown or unsupported mapped question.')
    }
  }
  for (const c of columns) {
    const prohibited = forbiddenColumns.includes(c.column)
    if (prohibited) { c.target = 'skip'; delete c.choice }
    if (google && googleIdentity(headers[c.column]) && c.target !== 'skip' && form.steps.find(s => s.id === c.target)?.questionType !== 'email') throw new ValidationError('Collected identity can only be explicitly mapped to an ordinary email question.')
    form.report.push({ location: `/csv/columns/${c.column}`, label: prohibited && (!google || forbiddenSource(headers[c.column], forbidden)) ? 'Private source column' : headers[c.column], sourceType: 'CSV column', state: c.target === 'skip' ? 'unsupported' : 'imported', change: c.target === 'skip' ? 'Never imported' : c.target, reason: google ? `${googleParsed!.counts[c.column]} nonblank cells ${c.target === 'skip' ? 'skipped' : 'mapped'}. ${prohibited ? googleParsed!.hardReasons.get(c.column) ?? 'Private metadata is never imported.' : googleIdentity(headers[c.column]) && c.target !== 'skip' ? 'Explicitly retained as ordinary email answer data only; never contacts, invitations, sessions or notifications.' : c.target === 'skip' ? googleParsed!.skipReasons.get(c.column) ?? 'Skipped by the reviewed mapping.' : 'Blank cells stay unanswered; native limits apply.'}` : prohibited ? 'Hidden and network/IP source identities are discarded before storage and cannot be mapped.' : c.target === 'skip' ? 'Skipped by the reviewed column mapping.' : 'Column mapping reviewed by the operator; blank cells remain unanswered.' })
  }
  const responses = responseStore()
  const time = googleParsed && !jsonResponses ? googleTime(input.csv, columns, input.google ?? {}, googleParsed.review) : undefined
  if (googleParsed && !jsonResponses) form.report.push({ location: '/google/interpretation', label: 'Google response interpretation', sourceType: 'operator settings', state: 'changed', change: `${googleParsed.review.dateOrder ?? 'Date order required'} · ${googleParsed.review.timeZone ?? 'Sheet time zone required'}`, reason: 'Sheet timestamps use this explicit zone and reviewed date order. Ambiguous and nonexistent local times are refused. Checkbox answers require unambiguous whole option labels.' })
  if (jsonResponses) for (const response of mapJsonResponses(input.responses!, google, definition, form, forbidden, errors)) responses.add(response)
  // Only normalized answers survive parsing; source metadata and credentials
  // are absent from all retained records and native effects.
  definition = {}
  for (const response of mapResponses(admittedRows(), headers, form, columns, errors, forbiddenColumns, time ? { time, dateOrder: googleParsed!.review.dateOrder } : undefined)) responses.add(response)
  if (jsonResponses) form.report.push({ location: '/responses/json', label: 'Response JSON', sourceType: google ? 'Google Forms API' : 'Typeform Responses API', state: 'imported', change: 'Historical answers and Other write-ins', reason: 'Only completed timestamped responses and supported question answers are retained. Provider identities, credentials, hidden values, network metadata and grading are discarded; original JSON is not retained.' })
  form.report.push({ location: '/custody', label: 'Original files', sourceType: 'artifact', state: 'unsupported', change: 'Original bytes not retained', reason: 'Only source hashes, safe mapping records and imported answers are retained. Keep your original files privately; hidden and network/IP values are discarded.' })
  form.report.push({ location: '/responses/identity', label: 'Response identity', sourceType: jsonResponses ? 'JSON rows' : 'CSV rows', state: 'changed', change: 'Anonymous imported responses', reason: 'File digest and row position recognize exact repeat files. Different exports are not deduplicated across files; no contacts, sessions or effects are created.' })
  const source: SourceBundle = { records: [], artifacts: [{ name: 'form.json', sha256: formHash, size: definitionBytes, original: { status: 'unavailable', reason: 'not-supplied' } }, ...((csvBytes || jsonResponses) ? [{ name: jsonResponses ? 'responses.json' : 'responses.csv', sha256: responseHash, size: jsonResponses ? responseBytes : csvBytes, original: { status: 'unavailable' as const, reason: 'not-supplied' as const } }] : [])], diagnostics: [] }
  const encodeValue = nativeValueStrings(), consentSteps = new Set(form.steps.filter(step => step.questionType === 'consent').map(step => step.id))
  const formTarget = formEffect(form, flowId, workspaceId, digest, plannedAt)
  const effectFor = (r: Pick<SourceRecord, 'kind' | 'payload'>): TargetEffect[] => r.kind === 'form' ? [formTarget] : r.kind === 'response' ? [responseEffect(r.payload as unknown as ParsedResponse, flowId, workspaceId, encodeValue, consentSteps)] : []
  // Native response tables are expanded only for the record currently planned.
  const effects = { *values() { for (const record of source.records) yield* effectFor(record) } }
  const payload = form as unknown as Json
  const formRecord: SourceRecord = { namespace, kind: 'form', sourceId: 'form', payload, payloadHash: sha256(canonicalJson(payload)), artifactHash: formHash, location: { artifact: 'form.json', pointer: '/' } }
  // Invalid rows retain locations and diagnostics, never unreviewed or skipped values.
  const { rejected, rowErrors } = errors.finish()
  source.records = sourceRecords(formRecord,responses,rejected,responseHash,hashPayload,jsonResponses ? 'responses.json' : 'responses.csv')
  return { ...(googleParsed ? { sourceName: 'google-forms' as const, google: googleParsed.review } : {}), plannedAt, form, flowId, namespace, digest, source, effects, headers, columns, forbiddenColumns, rowErrors, responseCount: responses.length, mapping: { version: mappingVersion, map: (r: SourceRecord) => ({ effects: effectFor(r), unmapped: r.kind === 'form' ? form.report.filter(i => i.state !== 'imported').map(i => ({ field: i.location, reason: i.reason })) : [], ...(r.kind === 'rejected-row' ? { rejection: 'Response row is invalid; inspect every listed row error.' } : {}) }) } }
}
