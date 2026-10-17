import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { createWorkerApp } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { ai, aiBindings, answer, theme } from './analysis-fixture'

/** Real analysis routes with only the paid provider replaced at its HTTP edge. */
export async function otherEvidenceScenario(input: { cookie: string; flowId: string; revisionId: string; questionId: string; responseId: string; text: string; choiceId: string }) {
  await ai.reset()
  const app = createWorkerApp(undefined, createPencilPlatform('http://localhost', { ...env, ...aiBindings }))
  const call = (path: string, body: unknown, method = 'POST') => app.request('http://localhost' + path, { method, headers: { Host: 'localhost', Origin: 'http://localhost', Cookie: input.cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  expect((await call('/api/app/analysis/policies', { autorunEnabled: false, autorunMinimum: 5, disclosureThreshold: 1, selection: 'highest-impact' }, 'PUT')).status).toBe(200)
  const quote = { responseId: input.responseId, questionId: input.questionId, start: 0, end: input.text.length, text: input.text }
  await ai.script(answer({ outcome: 'findings', reason: '', themes: [theme('Accessibility', [input.responseId], [quote])], recommendations: [] }))
  const response = await call('/api/app/analysis', { flowId: input.flowId, revisionId: input.revisionId, questionIds: [input.questionId] })
  expect(response.status).toBe(201)
  const run = await response.json() as { state: string; themes: Array<{ quotes: Array<{ excerpt: string }> }> }
  expect(run.state).toBe('completed'); expect(run.themes[0].quotes[0].excerpt).toBe(input.text)
  const requests = await ai.requests()
  expect(requests).toHaveLength(1)
  const body = JSON.parse(requests[0].body)
  const data = JSON.parse(body.input[1].content[0].text)
  expect(data.responses).toEqual([{ id: input.responseId, answers: { [input.questionId]: input.text } }])
  expect(requests[0].body).not.toContain(input.choiceId)
}
