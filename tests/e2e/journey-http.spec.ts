import { httpExport } from '../helpers/report-download'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { expect, test } from './fixtures'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'

// Request-only emitted journey: genuine magic links and durable product HTTP.
// No browser, context or page fixture; client interaction has separate unit tests.
test('native creation, branch publication, final retry, quarantine and reports retain acknowledged data', async ({ request }, info) => {
  const slug = `native-journey-${info.project.name}-${Date.now()}`
  const title = `Synthetic native journey ${info.project.name}`
  const headers = { Origin: new URL(info.project.use.baseURL!).origin, 'CF-Connecting-IP': `198.18.155.${info.project.name === 'mobile' ? 32 : 31}` }
  const ok = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> => {
    if (path.includes('/responses/export')) return httpExport<T>(target => request.get(target),path)
    const response = await request.fetch(path, { method, headers, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeGreaterThanOrEqual(200)
    expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  await ok('/auth/magic-link', { email: operatorEmail() })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  const login = await request.post('/auth/confirm', { data: { token: inbox.messages[0].magicLinkToken }, headers, maxRedirects: 0 })
  expect(login.status()).toBe(303)
  expect(await (await request.get('/app', { headers })).text()).toContain('Your flows')
  const flow = await ok<{ id: string }>('/api/app/flows', { title, slug })
  const path = `/api/app/flows/${flow.id}`
  const readDraft = () => ok<BuilderDraft>(`${path}/draft`)
  const add = async (step: unknown) => { const current = await readDraft(); await ok(`${path}/draft/steps`, { expectedVersion: current.flow.draftVersion, step }) }
  await add({ kind: 'question', questionType: 'single_choice', prompt: 'Which path?', required: true, choices: [{ value: 'detail', label: 'Tell us more' }, { value: 'skip', label: 'Finish now' }] })
  await add({ kind: 'question', questionType: 'long_text', prompt: 'Details', required: true })
  await add({ kind: 'completion', questionType: null, prompt: 'Recorded. Thank you.' })
  await add({ kind: 'completion', questionType: null, prompt: 'Alternate completion B' })
  let current = await readDraft()
  const [route, detail, end, alternate] = current.steps
  for (const [step, next] of [[route, detail], [detail, end]] as const) {
    await ok(`${path}/draft`, { stepId: step.id, prompt: step.prompt, required: true, nextStepId: next.id, expectedVersion: current.flow.draftVersion }, 'PUT')
    current = await readDraft()
  }
  const skip = current.choices.find((choice) => choice.value === 'skip')!
  const more = current.choices.find((choice) => choice.value === 'detail')!
  await ok(`${path}/draft/branches`, { expectedVersion: current.flow.draftVersion, rules: [{ sourceStepId: route.id, predicateKind: 'equals', expectedValue: skip.id, destinationStepId: alternate.id, position: 0 }] }, 'PUT')
  current = await readDraft()
  const preview = await ok<{ preview: boolean; draftVersion: number; complete: boolean }>(`${path}/draft/preview`, { answers: { [route.id]: skip.id } })
  expect(preview).toMatchObject({ preview: true, draftVersion: current.flow.draftVersion, complete: true })
  await ok(`${path}/publish`, { expectedVersion: current.flow.draftVersion })
  const publicFlow = await ok<PublicFlow>(`/api/public/flows/${slug}`)
  expect(publicFlow.steps.find((step) => step.id === route.id)?.prompt).toBe('Which path?')
  expect(await ok(`${path}/results`)).toMatchObject({ starts: 0, completedResponses: 0 })
  const publicHTML = await (await request.get(`/f/${slug}`, { headers })).text()
  expect(publicHTML).toContain('Which path?')
  expect(publicHTML.match(/Before you share/g)).toHaveLength(1)
  const session = await ok<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
  const payload = { sessionId: session.sessionId, sessionToken: session.sessionToken, idempotencyKey: `${slug}-receipt`, answers: [{ stepId: route.id, value: more.id }, { stepId: detail.id, value: 'Original native path A' }] }
  const final = await ok<{ responseId: string; disposition: string; idempotent: boolean }>(`/api/public/flows/${slug}/responses`, payload)
  expect(final).toMatchObject({ disposition: 'quarantined', idempotent: false, completionStepId: end.id })
  const replay = await ok(`/api/public/flows/${slug}/responses`, { ...payload, answers: [{ stepId: route.id, value: skip.id }] })
  expect(replay).toMatchObject({ responseId: final.responseId, idempotent: true, disposition: 'quarantined', completionStepId: end.id })
  expect(await ok(`${path}/results`)).toMatchObject({ starts: 1, completedResponses: 0 })
  expect(await ok(`/api/app/revisions/${session.revisionId}/quarantine`)).toMatchObject([{ id: final.responseId, answers: [{ stepId: route.id, value: more.id }, { stepId: detail.id, value: 'Original native path A' }] }])
  await ok(`/api/app/responses/${final.responseId}/release`, {})
  // A released response is no longer in the quarantine command's domain.
  expect((await request.post(`/api/app/responses/${final.responseId}/release`, { headers, data: {} })).status()).toBe(404)
  expect(await ok(`${path}/results`)).toMatchObject({ starts: 1, completedResponses: 1, completionRate: 1 })
  const exported = await ok<{ cutoff: string; responses: Array<{ answers: Array<{ stepId: string; displayValue: string }> }> }>(`${path}/responses/export`)
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0].answers).toEqual([expect.objectContaining({ stepId: route.id, displayValue: 'Tell us more' }), expect.objectContaining({ stepId: detail.id, displayValue: 'Original native path A' })])
  expect(JSON.stringify(exported)).not.toMatch(/sessionToken|deviceClass/)
  expect((await readDraft()).branchRules).toHaveLength(1)
  await ok(`${path}/archive`, {})
  expect((await request.get(`/f/${slug}`, { headers })).status()).toBe(404)
  const archived = await ok<typeof exported>(`${path}/responses/export`)
  const { cutoff: beforeCutoff, ...beforeData } = exported
  const { cutoff: afterCutoff, ...afterData } = archived
  expect(afterData).toEqual(beforeData)
  expect(new Date(afterCutoff).valueOf()).toBeGreaterThanOrEqual(new Date(beforeCutoff).valueOf())
})
