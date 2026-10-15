import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import worker from '../../src/core/app/worker'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import type { WorkerBindings } from '../../src/core/app/environment'
import type { BuilderDraft } from '../../src/core/app/api'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

test('adding questions preserves existing default and conditional answer paths until the operator changes them', async () => {
  const origin = 'http://localhost'
  const bindings = { ...env, SEED_SAMPLE_DATA: 'false', SEED_ADMIN_EMAIL: 'routing-owner@example.test', SETUP_TOKEN: 'synthetic-question-routing-setup-token' } as WorkerBindings
  let cookie = ''
  const call = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const response = await worker.fetch(new Request(origin + path, { method, headers: { Host: 'localhost', ...devKeyHeaders, Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), bindings, {} as ExecutionContext)
    expect(response.status).toBeLessThan(400)
    return response
  }
  const login = await call('/auth/bootstrap', { token: bindings.SETUP_TOKEN, displayName: 'Routing owner' })
  cookie = login.headers.get('set-cookie')!.split(';')[0]
  await call('/setup', { name: 'Routing bakery', timeZone: 'Australia/Brisbane' })
  const flow = await (await call('/api/app/flows', { title: 'Visit feedback', slug: 'question-insertion', template: 'feedback' })).json() as { id: string }
  const path = `/api/app/flows/${flow.id}`
  const draft = async () => await (await call(path + '/draft')).json() as BuilderDraft
  const before = await draft()
  const [first, last, completion] = before.steps
  const great = before.choices.find(choice => choice.stepId === first.id)!
  await call(path + '/draft/branches', { expectedVersion: before.flow.draftVersion, rules: [{ sourceStepId: first.id, predicateKind: 'equals', expectedValue: great.id, destinationStepId: completion.id, position: 0 }] }, 'PUT')
  const routed = await draft()
  for (const prompt of ['What made it great?', 'What would make it great?']) {
    const current = await draft()
    await call(path + '/draft/steps', { expectedVersion: current.flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt } })
  }
  const after = await draft()
  const routes = (value: BuilderDraft) => value.steps.filter(step => routed.steps.some(old => old.id === step.id)).map(step => ({ id: step.id, nextStepId: step.nextStepId }))
  expect(routes(after)).toEqual(routes(routed))
  expect(after.branchRules).toEqual(routed.branchRules)
  expect(after.steps.find(step => step.id === last.id)?.nextStepId).toBe(completion.id)
  for (const [answers, expected] of [[{}, [first.id, last.id, completion.id]], [{ [first.id]: great.id }, [first.id, completion.id]]] as const) {
    const preview = await (await call(path + '/draft/preview', { answers })).json() as { complete: boolean; screens: Array<{ stepId: string }> }
    expect(preview.complete).toBe(true)
    expect(preview.screens.map(screen => screen.stepId)).toEqual(expected)
  }
})
