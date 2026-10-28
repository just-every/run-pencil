import { expect } from 'vitest'
import type { ScenarioCall } from '../results-scenario'
import type { collectSharedReportScenario } from '../shared-report-scenario'
import type { SavedViewDetail, SharedReport } from '../../src/core/features/reporting/savedModel'

export async function proveSharedCodes(call: ScenarioCall, anonymous: (token: string, password?: string) => Promise<Response>, exposure: Awaited<ReturnType<typeof collectSharedReportScenario>>) {
  const row = await call<{ id: string }>('/api/app/codes', { label: 'Needs guidance' })
  const column = await call<{ id: string }>('/api/app/codes', { label: 'Ready to renew' })
  for (const id of exposure.receipts.slice(35)) await call(`/api/app/responses/${id}/answers/${exposure.textId}/codes/${row.id}`, undefined, 'PUT')
  const renewals = [...exposure.receipts.slice(0, 10), ...exposure.receipts.slice(15, 25), ...exposure.receipts.slice(35, 38)]
  for (const id of renewals) await call(`/api/app/responses/${id}/answers/${exposure.textId}/codes/${column.id}`, undefined, 'PUT')
  const raw = await call<{ cells: Array<{ rowPresent: boolean; columnPresent: boolean; count: number }> }>(exposure.path + '/coding/crosstab?' + new URLSearchParams({ rowCodeId: row.id, columnCodeId: column.id }))
  expect(raw.cells.find(cell => cell.rowPresent && cell.columnPresent)?.count).toBe(3)
  const created = await call<SavedViewDetail>(exposure.path + '/saved-views', { name: 'Coded renewal study', revisionId: exposure.revisionId, filter: {}, cohorts: [], charts: [], crosstabs: [
    { id: 'synthetic-pencil-24', rows: `code:${row.id}`, columns: `code:${column.id}` },
    { id: 'synthetic-pencil-25', rows: `code:${row.id}`, columns: `question:${exposure.multiId}` },
  ] })
  expect(created.report.cohorts[0].crosstabs[0]).toMatchObject({ withheld: true, reason: expect.stringContaining('recoverable') })
  expect(created.report.cohorts[0].questions.find(question => question.id === `code:${row.id}`)?.distribution).toEqual([{ label: 'Needs guidance', count: 8 }, { label: 'Without Needs guidance', count: 35 }])
  const incidence = created.report.cohorts[0].crosstabs[1]
  expect(incidence.withheld).toBe(false)
  if (incidence.withheld) throw new Error('The safe code incidence was withheld')
  expect(incidence.table.rowDimension.kind).toBe('code')
  expect(incidence.table.columnDimension.multipleSelect).toBe(true)
  expect(incidence.table.cells.map(cells => cells.map(cell => cell.suppressed ? null : cell.count))).toEqual([[8, 8], [35, 35]])
  expect(incidence.table.chiSquare.offered).toBe(false)
  const shared = await call<{ token: string }>(`/api/app/saved-views/${created.view.id}/shares`, {})
  const response = await anonymous(shared.token)
  expect(response.status).toBe(200)
  const report = await response.json<SharedReport>()
  expect(report).toEqual(created.report)
  expect(JSON.stringify(report)).not.toContain(exposure.excerpt)
  for (const id of exposure.receipts) expect(JSON.stringify(report)).not.toContain(id)
  await call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, selection: 'highest-impact', disclosureThreshold: 1 }, 'PUT')
  expect(await (await anonymous(shared.token)).json()).toEqual(report)
  await call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, selection: 'highest-impact', disclosureThreshold: 5 }, 'PUT')
}
