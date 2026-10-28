import { collectResponseSearchScenario } from '../response-search-scenario'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { httpExport, allTexts } from '../helpers/report-download'
import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/development-outbox'
import { collectLedgerFilterScenario, consentStatement } from '../ledger-filter-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { BuilderDraft, Ledger, LedgerResponse, FlowResults } from '../../src/core/app/api'
import { ReportingRepository } from '../../src/core/features/reporting/repository'
import { matureLoad } from './load-time-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = '', serial = 0
const call: ScenarioCall = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
  if (path.includes('/responses/export') && !path.includes('/start') && !path.includes('token=')) return httpExport<T>(target => SELF.fetch(`http://localhost${target}`, { headers: { Host: 'localhost', cookie } }),path)
  const response = await SELF.fetch(`http://localhost${path}`, { method, headers: { Host: 'localhost', cookie, Origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.170.${++serial % 250}` }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  expect(response.status, path).toBeGreaterThanOrEqual(200)
  expect(response.status, path).toBeLessThan(300)
  return response.status === 204 ? undefined as T : await response.json<T>()
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await call('/health')
  const operator = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at, id LIMIT 1').first<{ email: string }>()
  expect(operator).not.toBeNull()
  await call('/auth/magic-link', { email: operator!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), operator!.email)
  const login = await SELF.fetch('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ token: inbox.messages[0].magicLinkToken }), redirect: 'manual' })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})

contract(["LEDG-006","LEDG-008","LEDG-001","LEDG-003","LEDG-004","LEDG-005","LEDG-007","FLOW-019","IMPORT-003","RSLT-001","RSLT-003"], 'typed filters return exact native and imported IDs with retained consent and revision/source scopes in snapshot CSV, JSON and LEDG-005 XLSX and SAV exports read back by independent readers', async () => {
  const scenario = await collectLedgerFilterScenario(call, 'Typed response filter study')
  const positive = [scenario.nativePositive.responseId, scenario.importedPositive.id].sort()
  const negative = [scenario.nativeNegative.responseId, scenario.importedNegative.id].sort()
  const importedSearch = await call<Ledger>(`${scenario.path}/ledger?${new URLSearchParams({ search: 'MIXED.CASE@EXAMPLE.TEST', source: 'imported' })}`)
  expect(importedSearch.responses.map(response => response.id)).toEqual([scenario.importedPositive.id])
  const ids = (responses: LedgerResponse[]) => responses.map(response => response.id).sort()
  const numericAndDates = [['number', '11.0'], ['nps', '10.0'], ['rating', '5.0'], ['date', '2024-02-29'], ['email', 'mixed.case@example.TEST']]
  for (const [type, value] of [...['yes_no', 'consent'].flatMap(type => [[type, 'true'], [type, 'false']]), ...numericAndDates]) {
    const params = new URLSearchParams({ answerStepId: scenario.stepId(type), answerValue: value })
    const expected = value === 'false' ? negative : positive
    expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual(expected)
    const snapshot = await call<{ responses: LedgerResponse[]; cutoff: string; excludedQuarantined: number }>(`${scenario.path}/responses/export?${params}`)
    expect(ids(snapshot.responses)).toEqual(expected)
    expect(snapshot.excludedQuarantined).toBe(0)
    for (const response of snapshot.responses) {
      expect(response.answers.find(answer => answer.questionType === 'consent')?.value).toEqual({ accepted: value !== 'false', statement: consentStatement })
      expect(response.completedAt <= snapshot.cutoff && response.releasedAt !== null && response.releasedAt <= snapshot.cutoff).toBe(true)
    }
    for (const [source, revisionId, expectedId] of [['direct', scenario.nativeRevisionId, expected.find(id => id === scenario.nativePositive.responseId || id === scenario.nativeNegative.responseId)!], ['imported', scenario.importedRevisionId, expected.find(id => id === scenario.importedPositive.id || id === scenario.importedNegative.id)!]]) {
      params.set('source', source); params.set('revisionId', revisionId)
      expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual([expectedId])
      expect(ids((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses)).toEqual([expectedId])
    }
  }
  for (const type of ['dropdown', 'multiple_choice', 'priority']) {
    const stepId = scenario.stepId(type)
    const choice = scenario.current.choices.find(choice => choice.stepId === stepId)!
    const params = new URLSearchParams({ answerStepId: stepId, answerValue: choice.id })
    expect(ids((await call<Ledger>(`${scenario.path}/ledger?${params}`)).responses)).toEqual(type === 'priority' ? [...positive, ...negative].sort() : positive)
    expect(ids((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses)).toEqual(type === 'priority' ? [...positive, ...negative].sort() : positive)
  }
  for (const [type, values] of [['yes_no', ['1', 'TRUE', "true' OR 1=1--"]], ['consent', ['0', '{}']], ['number', ['', ' ', '11bad', '11\n', 'Infinity', '0x0']], ['date', ['2023-02-29', '2024-02-29T00:00:00Z']]] as const) for (const value of values) {
    const params = new URLSearchParams({ answerStepId: scenario.stepId(type), answerValue: value })
    expect((await call<Ledger>(`${scenario.path}/ledger?${params}`)).total).toBe(0)
    expect((await call<{ responses: LedgerResponse[] }>(`${scenario.path}/responses/export?${params}`)).responses).toEqual([])
  }
  expect(await call<FlowResults>(`${scenario.path}/results?revisionId=${scenario.importedRevisionId}`)).toMatchObject({ completedResponses: 2, importedResponses: 2, starts: 0, liveCompletedResponses: 0, completionRate: 0 })
  await call(`/api/public/flows/${scenario.current.flow.slug}/views`,{revisionId:scenario.nativeRevisionId,source:'direct'})
  await call(`/api/public/flows/${scenario.current.flow.slug}/views`,{revisionId:scenario.nativeRevisionId,source:'direct'})
  expect(await call<FlowResults>(`${scenario.path}/results?revisionId=${scenario.nativeRevisionId}`)).toMatchObject({ completedResponses: 2, importedResponses: 0, starts: 2, liveCompletedResponses: 2, completionRate: 1 })

  const workspace = await call<{ id: string }>('/api/app/workspace')
  const repository = new ReportingRepository(env.DB), cutoff = new Date().toISOString()
  const filter = { answerStepId: scenario.stepId('consent'), answerValue: 'false' }
  const before = await repository.ledger(workspace.id, scenario.flowId, filter, cutoff)
  const pending = await scenario.submit(false, false)
  expect(pending.disposition).toBe('quarantined')
  const exported = await call<{ responses: LedgerResponse[]; excludedQuarantined: number }>(`${scenario.path}/responses/export?${new URLSearchParams(filter)}`)
  expect(ids(exported.responses)).toEqual(negative)
  expect(exported.excludedQuarantined).toBe(1)
  // LEDG-005: the same selection as XLSX and SAV, read back by read-excel-file and sav-reader in Node (export-reader.global.ts).
  const reader = (env as unknown as { EXPORT_READER_ORIGIN: string }).EXPORT_READER_ORIGIN
  const download = async (format: string, extra: Record<string, string> = {}) => {
    const start = await call<{ token: string; filename: string }>(`${scenario.path}/responses/export/start?${new URLSearchParams({ format, ...extra })}`)
    expect(start.filename).toMatch(new RegExp(`^pencil-responses-[\\w.-]+\\.${format}$`))
    const parts: Uint8Array[] = []
    for (let token: string | null = start.token; token;) {
      const response = await SELF.fetch(`http://localhost${scenario.path}/responses/export?token=${encodeURIComponent(token)}`, { headers: { Host: 'localhost', cookie } })
      expect(response.status).toBe(200); parts.push(new Uint8Array(await response.arrayBuffer())); token = response.headers.get('x-export-next')
    }
    const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0
    for (const part of parts) { bytes.set(part, offset); offset += part.length }
    return bytes
  }
  const read = async <T,>(kind: 'xlsx' | 'sav', bytes: Uint8Array) => { const response = await fetch(`${reader}/${kind}`, { method: 'POST', body: bytes }); expect(response.status, await response.clone().text()).toBe(200); return response.json<T>() }
  const csvRows = (text: string) => { const rows: string[][] = [[]]; let field = '', quoted = false; for (let i = 0; i < text.length; i++) { const char = text[i]; if (quoted) { if (char === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (char === '"') quoted = false; else field += char } else if (char === '"') quoted = true; else if (char === ',') { rows.at(-1)!.push(field); field = '' } else if (char === '\r' && text[i + 1] === '\n') { rows.at(-1)!.push(field); field = ''; rows.push([]); i++ } else field += char } rows.at(-1)!.push(field); return rows }
  type Workbook = { sheets: Array<{ name: string; rows: Array<Array<string | number | null | object>> }> }
  type Sav = { header: { n_cases: number; encoding: string }; variables: Array<{ name: string; label: string; type: number }>; valueLabels: Array<{ appliesTo: string[]; entries: Array<{ val: number; label: string }> }>; rows: Array<Record<string, string | number | null>> }
  // A collector name that a spreadsheet would evaluate if it were written as a formula.
  const formulaCollector = await call<{ id: string; publicKey: string }>(`${scenario.path}/collectors`, { name: '=1+2', channel: 'web' })
  const replayed = (await env.DB.prepare('SELECT step_id AS stepId, value_json AS value FROM response_answers WHERE response_id = ?').bind(scenario.nativePositive.responseId).all<{ stepId: string; value: string }>()).results.map(answer => { const value = JSON.parse(answer.value); return { stepId: answer.stepId, value: value && typeof value === 'object' && 'accepted' in value ? value.accepted : value } })
  const formulaSession = await call<{ sessionId: string; sessionToken: string; loadTime?: string }>(`/api/public/flows/${scenario.current.flow.slug}/sessions`, { deviceClass: 'desktop', source: 'direct', collectorKey: formulaCollector.publicKey })
  await matureLoad(formulaSession)
  const formulaResponse = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${scenario.current.flow.slug}/responses`, { ...formulaSession, idempotencyKey: `formula-${formulaSession.sessionId}`, answers: replayed })
  expect(formulaResponse.disposition).toBe('released')
  const compare = async (extra: Record<string, string>, expected: string[]) => {
    const csvText = new TextDecoder().decode(await download('csv', extra)), table = csvRows(csvText), header = table[0], records = table.slice(1)
    expect(records.map(row => row[0]).sort()).toEqual([...expected].sort())
    const workbook = await read<Workbook>('xlsx', await download('xlsx', extra))
    expect(workbook.sheets.map(sheet => sheet.name)).toEqual(['Responses', 'Questions'])
    const [responses, questions] = workbook.sheets
    // Each export fixes its own cutoff; every other cell is the CSV's, and text never arrives as a formula object.
    // Only the CSV marks the formula-like collector name as text, with a leading apostrophe.
    const unmarked = (cell: string) => cell === "'=1+2" ? '=1+2' : cell
    const cutoff = header.indexOf('cutoff'), withoutCutoff = (rows: string[][]) => rows.map((row, i) => row.map((cell, j) => i && j === cutoff ? 'cutoff' : cell))
    expect(withoutCutoff(responses.rows.map(row => row.map(cell => cell === null ? '' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell))))).toEqual(withoutCutoff(table.map(row => row.map(unmarked))))
    const metadata = questions.rows.slice(1).map(row => Object.fromEntries(questions.rows[0].map((key, index) => [String(key), row[index]])) as Record<string, string | number | null>)
    const sav = await read<Sav>('sav', await download('sav', extra))
    expect(sav.header).toMatchObject({ n_cases: records.length, encoding: 'UTF-8' })
    expect(sav.rows.map(row => row.response_id)).toEqual(records.map(row => row[0]))
    for (const [index, record] of records.entries()) {
      const row = sav.rows[index], column = (name: string) => unmarked(record[header.indexOf(name)])
      for (const name of ['revision_id', 'source', 'completed_at', 'response_state', 'exclusion_reason', 'collector_name']) expect(row[name] ?? '').toBe(column(name))
      expect(row.revision_number).toBe(Number(column('revision_number')))
      for (const answer of JSON.parse(column('answers_json')) as Array<{ stepId: string; questionType: string; value: unknown }>) {
        const meta = metadata.filter(item => item.revision_id === column('revision_id') && item.step_id === answer.stepId), variable = String(meta[0].sav_variable)
        const code = (value: unknown) => meta.find(item => item.choice_value === value)!.sav_code
        if (answer.questionType === 'dropdown') {
          expect(row[variable]).toBe(code(answer.value))
          expect(sav.valueLabels.find(set => set.appliesTo.includes(variable))!.entries.find(entry => entry.val === row[variable])!.label).toBe(meta.find(item => item.choice_value === answer.value)!.choice_label)
        } else if (answer.questionType === 'multiple_choice') for (const item of meta) expect(row[`${variable}_${item.sav_code}`]).toBe((answer.value as string[]).includes(String(item.choice_value)) ? 1 : 0)
        else if (answer.questionType === 'priority') for (const item of meta) expect(row[`${variable}_${item.sav_code}`]).toBe((answer.value as string[]).indexOf(String(item.choice_value)) + 1)
        else if (answer.questionType === 'yes_no') expect(row[variable]).toBe(answer.value ? 1 : 0)
        else if (answer.questionType === 'consent') expect(row[variable]).toBe((answer.value as { accepted: boolean }).accepted ? 1 : 0)
        else expect(row[variable]).toBe(answer.value)
      }
    }
    expect(sav.variables.find(variable => variable.name === metadata.find(item => item.question_type === 'dropdown')!.sav_variable)!.label).toBe('Drink')
    return { table, header, sav }
  }
  const everything = await compare({}, [...positive, ...negative, formulaResponse.responseId])
  const formula = everything.table.findIndex(row => row[0] === formulaResponse.responseId)
  expect(everything.table[formula][everything.header.indexOf('collector_name')]).toBe("'=1+2")
  expect(everything.sav.rows.some(row => row.response_id === pending.responseId)).toBe(false)
  const included = await compare({ includeAutomatedExclusions: 'true' }, [...positive, ...negative, formulaResponse.responseId, pending.responseId])
  expect(included.table.find(row => row[0] === pending.responseId)![included.header.indexOf('response_state')]).toBe('quarantined')
  expect(included.sav.rows.find(row => row.response_id === pending.responseId)).toMatchObject({ response_state: 'quarantined', exclusion_reason: included.table.find(row => row[0] === pending.responseId)![included.header.indexOf('exclusion_reason')] })
  await compare(filter, negative)
  await call(`/api/app/responses/${pending.responseId}/release`, {})
  expect(ids((await repository.ledger(workspace.id, scenario.flowId, filter, cutoff)).responses)).toEqual(ids(before.responses))
  expect((await call<Ledger>(`${scenario.path}/ledger?${new URLSearchParams(filter)}`)).total).toBe(3)
  expect((await repository.ledger('unrelated-workspace', scenario.flowId, filter, new Date().toISOString())).total).toBe(0)
  expect((await repository.ledger(workspace.id, 'unrelated-flow', filter, new Date().toISOString())).total).toBe(0)
}, 60_000)

contract(["LEDG-006","LEDG-008"], 'response search composes with revision and source filters, exports the same released IDs and excludes erasure', async () => {
  const scenario = await collectResponseSearchScenario(call, 'ledger-search-worker')
  const ids = (rows: LedgerResponse[]) => rows.map(row => row.id).sort()
  const ledger = (search: string, extra: Record<string,string> = {}) => call<Ledger>(`${scenario.path}/ledger?${new URLSearchParams({ search, ...extra })}`)
  expect(ids((await ledger('QUEUE')).responses)).toEqual([scenario.slow, scenario.faster].sort())
  expect(ids((await ledger('queue', { revisionId: scenario.firstRevision, source: 'direct' })).responses)).toEqual([scenario.slow])
  expect(ids((await ledger('Cold brew')).responses)).toEqual([scenario.slow])
  expect(ids((await ledger('jo.cafe@example.test')).responses)).toEqual([scenario.slow])
  for (const literal of ['%_', "' OR 1=1--", 'unrecorded text']) expect((await ledger(literal)).total).toBe(0)
  const snapshot = await call<{ filter: { search: string }; responses: LedgerResponse[]; excludedQuarantined: number }>(`${scenario.path}/responses/export?search=queue`)
  expect(snapshot.filter.search).toBe('queue')
  expect(ids(snapshot.responses)).toEqual([scenario.slow, scenario.faster].sort())
  expect(snapshot.excludedQuarantined).toBe(1)
  await call(`/api/app/responses/${scenario.slow}`, undefined, 'DELETE')
  expect(ids((await ledger('queue')).responses)).toEqual([scenario.faster])
  expect((await ledger('Cold brew')).total).toBe(0)
}, 60_000)

contract(["LEDG-006","LEDG-008"], 'an accented and a non-ASCII phrase match case-insensitively while wildcards stay literal', async () => {
  const slug = 'ledger-search-unicode'
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Café feedback', slug })
  const path = `/api/app/flows/${flow.id}`
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt: 'Tell us more', required: true },
    { kind: 'question', questionType: 'single_choice', prompt: 'Dessert', required: true, choices: [{ label: 'Crème brûlée', value: 'creme' }, { label: 'Tea cake', value: 'cake' }] },
    { kind: 'completion', questionType: null, prompt: 'Thank you.' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await call<BuilderDraft>(`${path}/draft`)).flow.draftVersion, step })
  const draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const [text, choice] = draft.steps, options = draft.choices.filter(option => option.stepId === choice.id)
  const submit = async (message: string, option: number) => {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `unicode-${session.sessionId}`, answers: [{ stepId: text.id, value: message }, { stepId: choice.id, value: options[option].id }] })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
    return receipt.responseId
  }
  const french = await submit('Le CAFÉ était FROID', 1)
  const russian = await submit('Очень ВКУСНО', 1)
  const greek = await submit('ΚΑΦΕΣ ΚΑΛΟΣ', 1)
  const dessert = await submit('Rated 5* overall', 0)
  const found = async (search: string) => (await call<Ledger>(`${path}/ledger?${new URLSearchParams({ search })}`)).responses.map(response => response.id).sort()
  expect(await found('café était froid')).toEqual([french])
  expect(await found('очень вкусно')).toEqual([russian])
  expect(await found('καφες καλος')).toEqual([greek])
  expect(await found('CRÈME BRÛLÉE')).toEqual([dessert])
  for (const literal of ['5*', '*']) expect(await found(literal), literal).toEqual([dessert])
  const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΤΥΦΧΨΩÉÀÖÜÑÇ'
  const widest = alphabet.repeat(4).slice(0, 200)
  const wide = await submit(widest, 1)
  expect(await found(widest.toLowerCase())).toEqual([wide])
  expect((await call<{ responses: LedgerResponse[] }>(`${path}/responses/export?${new URLSearchParams({ search: widest.toLowerCase() })}`)).responses.map(response => response.id)).toEqual([wide])
  const decomposed = await submit('Le CAFE\u0301 et la Straße', 1)
  expect(await found('café et la STRASSE')).toEqual([decomposed])
  // The database write path also maintains the value on edits; stale text stops matching.
  await env.DB.prepare('UPDATE response_answers SET value_json=? WHERE response_id=? AND step_id=?').bind(JSON.stringify('Après la RÉVISION'), decomposed, text.id).run()
  expect(await found('café et la STRASSE')).toEqual([])
  expect(await found('après la révision')).toEqual([decomposed])
  expect((await call<{ responses: LedgerResponse[] }>(`${path}/responses/export?${new URLSearchParams({ search: 'ΚΑΦΕΣ' })}`)).responses.map(response => response.id)).toEqual([greek])
  for (const literal of ['cafe etait', '?', '[', '%_']) expect(await found(literal), literal).toEqual([])

}, 60_000)
