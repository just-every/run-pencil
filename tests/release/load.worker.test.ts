import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPencilServices } from '../../src/core/app/services'
import { seedSampleData } from '../../src/core/app/seed'
import { createPencilPlatform } from '../../src/core/platform/runtime'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_RUN_LOAD__: boolean

const slug = 'aurora-coffee-post-visit'
const enabled = __PENCIL_RUN_LOAD__

type Session = { sessionId: string; sessionToken: string }
type PublicFlow = {
  steps: Array<{ id: string; position: number; kind: string; questionType: string | null }>
  choices: Array<{ id: string; stepId: string }>
}

function percentile(samples: number, values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(samples * sorted.length) - 1)]
}

async function request(path: string, index: number, init?: RequestInit) {
  return SELF.fetch(`http://localhost${path}`, {
    ...init,
    headers: {
      'cf-connecting-ip': `198.51.100.${(index % 240) + 1}`,
      ...(init?.headers ?? {}),
    },
  })
}

async function measure(cardinality: number, concurrency: number, operation: (index: number) => Promise<void>) {
  const durations = new Array<number>(cardinality)
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < cardinality) {
      const index = next++
      const started = performance.now()
      await operation(index)
      durations[index] = performance.now() - started
    }
  }))
  return { cardinality, concurrency, p95Milliseconds: Number(percentile(0.95, durations).toFixed(2)), maxMilliseconds: Number(Math.max(...durations).toFixed(2)) }
}

async function startSession(index: number, source: 'direct' | 'embed' = 'direct') {
  const response = await request(`/api/public/flows/${slug}/sessions`, index, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceClass: 'desktop', source }),
  })
  expect(response.status).toBe(201)
  return response.json<Session>()
}

describe.skipIf(!enabled)('measured public runtime capacity in Workers D1', () => {
  let flow: PublicFlow

  beforeAll(async () => {
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
    await seedSampleData(createPencilServices(createPencilPlatform('http://localhost', env)))
    expect((await request('/health', 250)).status).toBe(200)
    const response = await request(`/api/public/flows/${slug}`, 251)
    expect(response.status).toBe(200)
    flow = await response.json<PublicFlow>()
  })

  it('measures public-screen, answer-transition, and final-submission p95 at declared test cardinalities', async () => {
    const publicScreen = await measure(240, 24, async (index) => {
      const response = await request(`/api/public/flows/${slug}`, index)
      expect(response.status).toBe(200)
      await response.arrayBuffer()
    })

    const rating = flow.steps.find((step) => step.questionType === 'rating')
    expect(rating?.id).toEqual(expect.any(String))
    const firstQuestion = flow.steps.filter((step) => step.kind === 'question').sort((left, right) => left.position - right.position)[0]
    expect(firstQuestion?.id).toEqual(expect.any(String))
    const transitionSessions = await Promise.all(Array.from({ length: 60 }, (_, index) => startSession(index, index % 2 === 0 ? 'direct' : 'embed')))
    const answerTransition = await measure(60, 12, async (index) => {
      const session = transitionSessions[index]
      const response = await request(`/api/public/flows/${slug}/sessions/advance`, index, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...session, stepId: firstQuestion!.id }),
      })
      expect(response.status).toBe(204)
    })

    const choiceQuestion = flow.steps.find((step) => step.questionType === 'single_choice')
    const choice = flow.choices.find((candidate) => candidate.stepId === choiceQuestion?.id)
    expect(choiceQuestion?.id).toEqual(expect.any(String))
    expect(choice?.id).toEqual(expect.any(String))
    const submissionSessions = await Promise.all(Array.from({ length: 30 }, (_, index) => startSession(500 + index, index % 2 === 0 ? 'direct' : 'embed')))
    await new Promise((resolve) => setTimeout(resolve, 3_100))
    const finalSubmission = await measure(30, 10, async (index) => {
      const session = submissionSessions[index]
      const response = await request(`/api/public/flows/${slug}/responses`, 500 + index, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...session,
          idempotencyKey: `load-submission-${index}`,
          answers: [
            { stepId: rating!.id, value: 5 },
            { stepId: choiceQuestion!.id, value: choice!.id },
          ],
        }),
      })
      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toMatchObject({ disposition: 'released', idempotent: false })
    })

    const evidence = {
      environment: 'Workers runtime with Miniflare D1',
      flows: 1,
      sourceMix: 'direct/embed alternating',
      publicScreen,
      answerTransition,
      finalSubmission,
    }
    console.info(`PENCIL_LOAD_RESULT ${JSON.stringify(evidence)}`)
    expect(publicScreen.p95Milliseconds).toBeLessThanOrEqual(500)
    expect(answerTransition.p95Milliseconds).toBeLessThanOrEqual(500)
    expect(finalSubmission.p95Milliseconds).toBeLessThanOrEqual(1_000)
  }, 30_000)
})
