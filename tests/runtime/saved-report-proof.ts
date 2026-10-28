import { SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { collectSharedReportScenario } from '../shared-report-scenario'
import type { ScenarioCall } from '../results-scenario'
import type { SavedViewDetail, SavedReportShare, SharedReport, SavedDashboard } from '../../src/core/features/reporting/savedModel'

type ShareResult = { share: SavedReportShare; token: string; url: string }
type Request = (path: string, data?: unknown, method?: string) => Promise<Response>
let serial = 0
const anonymous = (token: string, password?: string) => SELF.fetch(`http://localhost/api/public/reports/${token}`, {
  method: password === undefined ? 'GET' : 'POST',
  headers: { Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json', 'CF-Connecting-IP': `198.19.201.${++serial % 250}` },
  ...(password === undefined ? {} : { body: JSON.stringify({ password }) }),
})

export async function proveSavedReports(call: ScenarioCall, request: Request, db: D1Database) {
  const exposure = await collectSharedReportScenario(call, 'synthetic-pencil-12')
  const definition = {
    name: 'synthetic-pencil-2', revisionId: exposure.revisionId, filter: {},
    cohorts: [{ id: 'synthetic-pencil-3', name: 'synthetic-pencil-3', filter: { collectorId: exposure.subsetCollectorId } }],
    crosstabs: [
      { id: 'synthetic-pencil-4', rows: `question:${exposure.planId}`, columns: `question:${exposure.renewalId}` },
      { id: 'synthetic-pencil-21', rows: `question:${exposure.multiId}`, columns: `question:${exposure.renewalId}` },
      { id: 'synthetic-pencil-22', rows: `hidden:${exposure.identityFieldId}`, columns: `question:${exposure.renewalId}` },
      { id: 'synthetic-pencil-23', rows: `hidden:${exposure.observedFieldId}`, columns: `question:${exposure.renewalId}` },
    ], charts: [exposure.planId, exposure.renewalId, exposure.multiId],
  }
  const created = await call<SavedViewDetail>(exposure.path + '/saved-views', definition)
  expect(created.view.savedBy.id).toBeTruthy(); expect(created.view.savedBy.name).toBeTruthy()
  const reopened = await call<SavedViewDetail>('/api/app/saved-views/' + created.view.id)
  expect(reopened).toEqual(created)
  expect(reopened.report.cohorts[0].responseCount).toBe(43)
  expect(reopened.report.cohorts[0].questions.find(question => question.id === exposure.planId)?.distribution.find(bucket => bucket.label === 'Scale')).toEqual({ label: 'Scale', count: 8 })
  expect(reopened.report.cohorts[0].crosstabs[0]).toMatchObject({ withheld: true, reason: expect.stringContaining('recoverable') })
  expect(reopened.report.cohorts[1]).toMatchObject({ responseCount: 40, breakdownWithheld: true, questions: [], crosstabs: [], reason: expect.stringContaining('subset') })
  const multiple = reopened.report.cohorts[0].crosstabs.find(table => table.id === 'synthetic-pencil-21')!
  expect(multiple.withheld).toBe(false)
  if (multiple.withheld) throw new Error('Multiple select crossing was withheld unexpectedly')
  expect(multiple.table.rowDimension.multipleSelect).toBe(true)
  expect(multiple.table.chiSquare.offered).toBe(false)
  expect(multiple.table.rowTotals).toEqual([{ withheld: false, count: 43 }, { withheld: false, count: 43 }])
  expect(multiple.table.cells.map(row => row.map(cell => cell.suppressed ? null : cell.count))).toEqual([[23, 20], [23, 20]])
  expect(reopened.report.cohorts[0].crosstabs.some(table => table.id === 'synthetic-pencil-22')).toBe(false)
  const filtered = await call<SavedViewDetail>(exposure.path + '/saved-views', { ...definition, name: 'synthetic-pencil-5', filter: { answerStepId: exposure.planId, answerValue: exposure.scaleId }, cohorts: [] })
  expect(filtered.report.cohorts[0].responseCount).toBe(8)
  const formDashboard = await call<SavedDashboard>('/api/app/report-dashboards', { name: 'synthetic-pencil-6', scope: 'form', flowId: exposure.flow.id, viewIds: [created.view.id, filtered.view.id] })
  const programDashboard = await call<SavedDashboard>('/api/app/report-dashboards', { name: 'synthetic-pencil-7', scope: 'program', viewIds: [filtered.view.id, created.view.id] })
  expect(programDashboard.flowId).toBeNull()
  const rearranged = await call<SavedDashboard>('/api/app/report-dashboards/' + formDashboard.id, { name: formDashboard.name, scope: formDashboard.scope, flowId: exposure.flow.id, viewIds: [filtered.view.id, created.view.id] }, 'PUT')
  expect(rearranged.viewIds).toEqual([filtered.view.id, created.view.id])
  const dashboard = await call<{ dashboard: SavedDashboard; views: SavedViewDetail[] }>('/api/app/report-dashboards/' + formDashboard.id)
  expect(dashboard.views.map(detail => detail.view.id)).toEqual(rearranged.viewIds)
  expect(dashboard.views[1].report).toEqual(created.report)

  const shared = await call<ShareResult>(`/api/app/saved-views/${created.view.id}/shares`, {})
  const response = await anonymous(shared.token)
  expect(response.status).toBe(200); expect(response.headers.get('set-cookie')).toBeNull(); expect(response.headers.get('cache-control')).toBe('no-store')
  const report = await response.json<SharedReport>()
  expect(report).toEqual(created.report)
  const serialized = JSON.stringify(report)
  for (const id of exposure.receipts) expect(serialized).not.toContain(id)
  expect(serialized).not.toContain('savedBy'); expect(serialized).not.toContain('participant'); expect(serialized).not.toContain('answers')
  for (const value of [exposure.identityFieldId, exposure.identityValue, exposure.rareValue, exposure.excerpt]) expect(serialized).not.toContain(value)
  expect(serialized).toContain('separate links')
  const list = await call<SavedReportShare[]>(`/api/app/saved-views/${created.view.id}/shares`)
  expect(list.map(item => item.id)).toContain(shared.share.id)
  const protectedShare = await call<ShareResult>(`/api/app/saved-views/${created.view.id}/shares`, { password: 'synthetic-pencil-8', expiresAt: new Date(Date.now() + 86400000).toISOString() })
  expect((await anonymous(protectedShare.token)).status).toBe(401)
  expect((await anonymous(protectedShare.token, 'synthetic-pencil-9')).status).toBe(401)
  const unlocked = await anonymous(protectedShare.token, 'synthetic-pencil-8')
  expect(unlocked.status).toBe(200); expect(unlocked.headers.get('set-cookie')).toBeNull(); expect(await unlocked.json()).toEqual(report)
  const stored = await db.prepare('SELECT token_hash AS tokenHash,password_verifier AS verifier FROM saved_report_shares WHERE id=?').bind(protectedShare.share.id).first<{ tokenHash: string; verifier: string }>()
  expect(stored!.tokenHash).not.toBe(protectedShare.token); expect(stored!.verifier).not.toContain('synthetic-pencil-8')
  await call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, selection: 'highest-impact', disclosureThreshold: 1 }, 'PUT')
  expect(await (await anonymous(shared.token)).json()).toEqual(report)
  expect((await call<SavedViewDetail>('/api/app/saved-views/' + created.view.id)).report).toEqual(report)
  const current = await call<{ cells: Array<Array<{ suppressed: boolean; count?: number }>> }>(exposure.path + '/crosstab?' + new URLSearchParams({ revisionId: exposure.revisionId, rows: `question:${exposure.planId}`, columns: `question:${exposure.renewalId}` }))
  expect(current.cells[2][0]).toMatchObject({ suppressed: false, count: 3 })

  const signedOutSave = await SELF.fetch('http://localhost' + exposure.path + '/saved-views', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(definition) })
  expect(signedOutSave.status).toBe(401)
  expect((await request(exposure.path + '/saved-views', { ...definition, revisionId: created.view.id })).status).toBe(400)
  expect((await request('/api/app/report-dashboards', { name: 'synthetic-pencil-10', scope: 'form', flowId: 'synthetic-pencil-10', viewIds: [created.view.id] })).status).toBe(404)
  await call(`/api/app/report-shares/${protectedShare.share.id}`, undefined, 'DELETE')
  expect((await anonymous(protectedShare.token, 'synthetic-pencil-8')).status).toBe(404)
  const expiring = await call<ShareResult>(`/api/app/saved-views/${created.view.id}/shares`, { expiresAt: new Date(Date.now() + 10000).toISOString() })
  await db.prepare('UPDATE saved_report_shares SET expires_at=? WHERE id=?').bind(new Date(Date.now() - 1000).toISOString(), expiring.share.id).run()
  expect((await anonymous(expiring.token)).status).toBe(404)

  // A later response is absent from the saved cutoff, while erasure still removes old evidence.
  const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${exposure.flow.slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
  const submitted = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${exposure.flow.slug}/responses`, { ...session, idempotencyKey: 'synthetic-pencil-11', answers: [{ stepId: exposure.planId, value: exposure.scaleId }, { stepId: exposure.renewalId, value: exposure.renewId }, { stepId: exposure.multiId, value: exposure.multiChoiceIds }, { stepId: exposure.textId, value: exposure.excerpt }] })
  if (submitted.disposition === 'quarantined') await call(`/api/app/responses/${submitted.responseId}/release`, {})
  expect((await call<SavedViewDetail>('/api/app/saved-views/' + created.view.id)).report).toEqual(report)
  await call(`/api/app/responses/${exposure.exposedIds[0]}`, undefined, 'DELETE')
  const afterErasure = await (await anonymous(shared.token)).json<SharedReport>()
  expect(afterErasure.cutoff).toBe(report.cutoff); expect(afterErasure.cohorts[0].responseCount).toBe(42)
  expect(afterErasure.cohorts[0].questions.find(question => question.id === exposure.planId)?.distribution.find(bucket => bucket.label === 'Scale')).toEqual({ label: 'Scale', count: 7 })
  await call(`/api/app/report-shares/${shared.share.id}`, undefined, 'DELETE')
  expect((await anonymous(shared.token)).status).toBe(404)
  await call('/api/app/analysis/policies', { autorunEnabled: true, autorunMinimum: 5, selection: 'highest-impact', disclosureThreshold: 5 }, 'PUT')
}
