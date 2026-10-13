import { httpExport } from '../helpers/report-download'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { expect, test } from './fixtures'
import type { BuilderDraft } from '../../src/core/app/api'

// APIRequestContext only. Actual expiry/race is separately verified in Workers D1.
test('native unavailable credentials offer a definitive refusal and fresh original-key admission with one receipt', async ({ request }, info) => {
  const slug = `native-session-recovery-${info.project.name}-${Date.now()}`
  const headers = { Origin: new URL(info.project.use.baseURL!).origin, 'CF-Connecting-IP': `198.18.157.${info.project.name === 'mobile' ? 46 : 45}` }
  const ok = async <T,>(path: string, data?: unknown): Promise<T> => {
    if (path.includes('/responses/export')) return httpExport<T>(target => request.get(target),path)
    const response = await request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200); expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : response.json() as Promise<T>
  }
  await ok('/auth/magic-link', { email: operatorEmail() })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  expect((await request.post('/auth/confirm', { data: { token: inbox.messages[0].magicLinkToken }, headers, maxRedirects: 0 })).status()).toBe(303)
  const flow = await ok<{ id: string }>('/api/app/flows', { title: `Synthetic session recovery ${info.project.name}`, slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => ok<BuilderDraft>(`${path}/draft`)
  for (const step of [{ kind: 'question', questionType: 'long_text', prompt: 'Your unsent answer', required: true }, { kind: 'completion', questionType: null, prompt: 'Recorded.' }]) {
    const current = await draft()
    await ok(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step })
  }
  const current = await draft(); const question = current.steps[0]; const completion = current.steps[1]
  await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const start = () => ok<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'tablet', source: 'embed' })
  const old = await start()
  type Export = { cutoff: string; filter: unknown; excludedQuarantined: number; responses: unknown[] }
  const { cutoff: beforeCutoff, ...before } = await ok<Export>(`${path}/responses/export`)
  expect(Number.isFinite(Date.parse(beforeCutoff))).toBe(true)
  const refusedCredentials = { sessionId: old.sessionId, sessionToken: '0'.repeat(64) }
  for (const [suffix, data] of [['sessions/advance', { ...refusedCredentials, stepId: question.id }], ['responses', { ...refusedCredentials, idempotencyKey: `${slug}-original-key`, answers: [{ stepId: question.id, value: 'Retained native synthetic answer' }] }], ['responses', { sessionId: old.sessionId, idempotencyKey: `${slug}-original-key`, answers: [{ stepId: question.id, value: 'Retained native synthetic answer' }] }]] as const) {
    const denied = await request.post(`/api/public/flows/${slug}/${suffix}`, { headers, data })
    expect(denied.status()).toBe(400)
    expect(await denied.json()).toEqual({ error: 'SESSION_UNAVAILABLE', message: 'This response session has expired or is no longer available. Start again to answer the current form.' })
  }
  const { cutoff: afterCutoff, ...after } = await ok<Export>(`${path}/responses/export`)
  expect(Number.isFinite(Date.parse(afterCutoff))).toBe(true)
  expect(Date.parse(afterCutoff)).toBeGreaterThanOrEqual(Date.parse(beforeCutoff))
  expect(after).toEqual(before)
  expect(await ok(`${path}/results`)).toMatchObject({ starts: 1, completedResponses: 0 })
  const fresh = await start()
  expect(fresh.sessionId).not.toBe(old.sessionId); expect(fresh.sessionToken).not.toBe(old.sessionToken)
  expect(fresh.revisionId).toBe(old.revisionId)
  const input = { ...fresh, idempotencyKey: `${slug}-original-key`, answers: [{ stepId: question.id, value: 'Retained native synthetic answer' }] }
  const receipt = await ok<{ responseId: string; disposition: string; idempotent: boolean; completionStepId: string }>(`/api/public/flows/${slug}/responses`, input)
  expect(receipt).toMatchObject({ idempotent: false, completionStepId: completion.id })
  expect(await ok(`/api/public/flows/${slug}/responses`, input)).toEqual({ ...receipt, idempotent: true })
  if (receipt.disposition === 'quarantined') await ok(`/api/app/responses/${receipt.responseId}/release`, {})
  expect(await ok(`${path}/results`)).toMatchObject({ starts: 2, completedResponses: 1 })
  const exported = await ok<{ responses: Array<{ id: string; answers: Array<{ stepId: string; value: unknown }> }> }>(`${path}/responses/export`)
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0]).toMatchObject({ id: receipt.responseId, answers: [{ stepId: question.id, value: 'Retained native synthetic answer' }] })
  await ok(`${path}/archive`, {})
})
