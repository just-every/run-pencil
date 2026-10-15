import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { AiError, type AiTransport } from '../../src/base/ai/index.mjs'
import { createAiOutbox, createDevAiClient } from '../../src/base/ai/dev/index.mjs'
import { contract } from '../../src/test/contract'
import { analysisHttp } from './analysis-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const key = 'synthetic-development-capture-key'.padEnd(48, '0'), origin = 'http://localhost'
const outbox = () => createAiOutbox({ db: env.DB })
async function fixture(canary: string, script?: AiTransport['request']) {
  const f = await analysisHttp({ AI_ENABLED: 'true', AI_MODEL: 'synthetic-model', PENCIL_DEV_AI: () => ({
    transport: 'dev', origin, client: createDevAiClient({ enabled: true }, {
      request: new Request(origin, { headers: { 'x-rer-dev-key': key } }), key, origin, local: true, outbox: outbox(), script,
    }),
  }) })
  const ids = []
  for (let i = 0; i < 5; i++) ids.push(await f.respond(i === 0 ? canary : `Ordinary answer ${i}`))
  return { ...f, ids }
}
async function attachContact(f: Awaited<ReturnType<typeof fixture>>) {
  const contact = await f.services.distribution.contacts.save(f.workspaceId, { name: 'Synthetic contact', email: `${f.operatorId}@example.test` }) as { id: string }
  const launch = await f.services.distribution.launches.launch({ workspaceId: f.workspaceId, flowId: f.flowId, operatorId: f.operatorId, contactIds: [contact.id], commandKey: crypto.randomUUID() })
  const participant = await env.DB.prepare('SELECT id FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{ id: string }>()
  await env.DB.prepare('UPDATE responses SET participant_id=? WHERE id=?').bind(participant!.id, f.ids[0]).run()
  return () => f.call(`/api/app/distribution/contacts/${contact.id}/erase`, { confirm: true })
}

contract(['DATA-002', 'BASE-DATA-003'], 'response and contact erasure remove failed and queued local AI captures atomically, refuse late captures, and preserve other workspace and feature captures', async () => {
  const other = await fixture('unrelated-workspace-capture')
  const otherRun = await other.request()
  expect(otherRun).toMatchObject({ state: 'failed', errorCode: 'dev_fake_cannot_answer' })
  // A real live dev transport retains receipts only, even when its body contains prose.
  const live = createDevAiClient({ enabled: true }, {
    request: new Request(origin, { headers: { 'x-rer-dev-key': key } }), key, origin, local: true, outbox: outbox(),
    live: { baseUrl: 'https://models.example.test', apiKey: 'synthetic-live-key' },
    fetch: async () => Response.json({ private: 'never-capture-live-answer' }, { headers: { 'x-models-request': 'synthetic-live-receipt' } }),
  })
  await live.responses({ model: 'synthetic-model', input: 'Synthetic live request' }, { feature: 'analysis' })
  const draft = createDevAiClient({ enabled: true }, { request: new Request(origin, { headers: { 'x-rer-dev-key': key } }), key, origin, local: true, outbox: outbox() })
  await draft.responses({ model: 'synthetic-model', input: 'Unrelated draft source' }, { feature: 'draft-rewrite' })
  const preserved = await outbox().list()
  expect(JSON.stringify(preserved)).not.toContain('never-capture-live-answer')

  for (const kind of ['response', 'contact'] as const) {
    const canary = `erased-${kind}-development-answer`, f = await fixture(canary, kind === 'contact' ? async () => { throw new AiError('upstream_unavailable', 503) } : undefined)
    const erase = kind === 'contact' ? await attachContact(f) : () => f.call(`/api/app/responses/${f.ids[0]}`, undefined, 'DELETE')
    const run = await f.request()
    expect(run.state).toBe(kind === 'contact' ? 'queued' : 'failed')
    expect(JSON.stringify(await outbox().list())).toContain(canary)
    expect((await other.call(`/api/app/responses/${f.ids[0]}`, undefined, 'DELETE')).status).toBe(404)
    // Force a later write in the erasure transaction to fail: captures and evidence roll back together.
    await env.DB.exec(`CREATE TRIGGER refuse_capture_erasure BEFORE DELETE ON responses WHEN OLD.id='${f.ids[0]}' BEGIN SELECT RAISE(ABORT,'synthetic erasure failure'); END`)
    try { expect((await erase()).status).toBe(500) }
    finally { await env.DB.exec('DROP TRIGGER refuse_capture_erasure') }
    expect(JSON.stringify(await outbox().list())).toContain(canary)
    expect(await f.detail(run.id)).toMatchObject({ redacted: false, evidenceCount: 5 })
    expect((await erase()).status).toBe(kind === 'contact' ? 200 : 204)
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(f.ids[0]).first()).toBeNull()
    expect(await f.detail(run.id)).toMatchObject({ redacted: true, stale: true, evidenceCount: 4 })
    expect(await outbox().list()).toEqual(preserved)
  }

  for (const kind of ['response', 'contact'] as const) {
    let release!: () => void, arrived!: () => void
    const held = new Promise<void>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { arrived = resolve })
    const canary = `in-flight-${kind}-capture`, f = await fixture(canary, async () => {
      arrived(); await held
      return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ outcome: 'insufficient_evidence', reason: canary, themes: [], recommendations: [] }) }] }] })
    })
    const erase = kind === 'contact' ? await attachContact(f) : () => f.call(`/api/app/responses/${f.ids[0]}`, undefined, 'DELETE')
    const pending = f.request()
    try { await entered; expect((await erase()).status).toBe(kind === 'contact' ? 200 : 204) }
    finally { release() }
    expect(await pending).toMatchObject({ state: 'failed', redacted: true, stale: true, errorCode: 'evidence_erased' })
    expect(await outbox().list()).toEqual(preserved)
  }
  expect(await other.detail(otherRun.id)).toMatchObject({ redacted: false, evidenceCount: 5 })
})
