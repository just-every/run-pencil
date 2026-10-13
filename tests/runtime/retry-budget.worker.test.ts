import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { MailDeliveries } from '../../src/core/features/distribution/deliveries'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://example.test', first = '2026-10-06T00:00:00.000Z'
async function pending(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Thanks' })
  await f.publish()
  const c = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${slug}@example.test` }) as { id: string }
  const launch = await f.services.distribution.launches.launch({ ...f.flow, contactIds: [c.id], commandKey: slug, operatorId: f.operatorId })
  const row = (await env.DB.prepare('SELECT d.id FROM mail_deliveries d JOIN invitation_participants p ON p.id = d.participant_id WHERE p.launch_id = ?').bind(launch.id).first<{ id: string }>())!
  await env.DB.prepare('UPDATE mail_deliveries SET available_at = ? WHERE id = ?').bind(first, row.id).run()
  const d = new MailDeliveries(env.DB)
  expect(await d.prepare(row.id, origin, first)).toMatchObject({ ordinal: 1 })
  await d.record(row.id, 1, { kind: 'transient', reason: 'Synthetic failure' }, first)
  return { ...f, d, id: row.id }
}
contract(['DIST-006', 'DIST-008'], 'late queue processing cannot authorize retry after one hour; equality remains within the budget', async () => {
  for (const [suffix, now, allowed] of [['before', '2026-10-06T00:59:59.999Z', true], ['equal', '2026-10-06T01:00:00.000Z', true], ['after', '2026-10-06T01:00:00.001Z', false], ['delayed', '2026-10-06T02:00:00.000Z', false]] as const) {
    const f = await pending(`retry-budget-${suffix}`)
    const result = await new MailDeliveries(env.DB).prepare(f.id, origin, now)
    if (allowed) expect(result).toMatchObject({ ordinal: 2 })
    else {
      expect(result).toBeNull()
      expect(await env.DB.prepare('SELECT status, attempts, reason FROM mail_deliveries WHERE id = ?').bind(f.id).first()).toEqual({ status: 'failed', attempts: 1, reason: 'Automatic retry budget exhausted.' })
    }
    expect(await env.DB.prepare("SELECT count(*) AS n FROM mail_delivery_attempts WHERE delivery_id = ? AND event = 'started'").bind(f.id).first()).toEqual({ n: allowed ? 2 : 1 })
  }
}, 60_000)
contract(['DIST-006', 'BASE-OPS-003'], 'concurrent consumers authorize once and the atomic guard rejects changed retry timing', async () => {
  const f = await pending('retry-budget-concurrent')
  const calls = await Promise.all(Array.from({ length: 4 }, () => new MailDeliveries(env.DB).prepare(f.id, origin, '2026-10-06T01:00:00.000Z')))
  expect(calls.filter(Boolean)).toHaveLength(1)
  expect(await env.DB.prepare('SELECT attempts FROM mail_deliveries WHERE id = ?').bind(f.id).first()).toEqual({ attempts: 2 })
  for (const change of ['budget', 'due'] as const) {
    const g = await pending(`retry-budget-atomic-${change}`)
    // Interleave a real D1 mutation after the read, before the real send batch.
    const intercepted = new Proxy(env.DB, { get(target, property) {
      if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
        await env.DB.prepare(change === 'budget' ? 'UPDATE mail_deliveries SET first_attempt_at = ? WHERE id = ?' : 'UPDATE mail_deliveries SET available_at = ? WHERE id = ?')
          .bind(change === 'budget' ? '2026-10-05T23:00:00.000Z' : '2026-10-06T03:00:00.000Z', g.id).run()
        return env.DB.batch(statements)
      }
      const value = Reflect.get(target, property)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    expect(await new MailDeliveries(intercepted).prepare(g.id, origin, '2026-10-06T00:30:00.000Z')).toBeNull()
    expect(await env.DB.prepare('SELECT attempts, status FROM mail_deliveries WHERE id = ?').bind(g.id).first()).toEqual({ attempts: 1, status: 'pending' })
  }
}, 60_000)
contract(['DIST-006', 'DIST-010', 'BASE-OPS-004'], 'explicit retry grants one new bounded cycle with cumulative ordinals and one durable operator authorization', async () => {
  const f = await pending('retry-budget-explicit')
  await f.d.prepare(f.id, origin, '2026-10-06T02:00:00.000Z')
  const retries = await Promise.allSettled(Array.from({ length: 3 }, () => new MailDeliveries(env.DB).retry(f.scope.workspaceId, f.id, f.operatorId, false, '2026-10-06T03:00:00.000Z')))
  expect(retries.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(await env.DB.prepare("SELECT count(*) AS n FROM mail_delivery_attempts WHERE delivery_id = ? AND event = 'operator-retry'").bind(f.id).first()).toEqual({ n: 1 })
  let now = '2026-10-06T03:00:00.000Z'
  let key: string | undefined
  for (let ordinal = 2; ordinal <= 7; ordinal++) {
    const prepared = await new MailDeliveries(env.DB).prepare(f.id, origin, now)
    expect(prepared).toMatchObject({ ordinal })
    key ??= prepared!.idempotencyKey
    expect(prepared!.idempotencyKey).toBe(key)
    await new MailDeliveries(env.DB).record(f.id, ordinal, { kind: 'transient', reason: 'Synthetic continuing failure' }, now)
    const row = (await env.DB.prepare('SELECT status, available_at FROM mail_deliveries WHERE id = ?').bind(f.id).first<{ status: string; available_at: string }>())!
    expect(row.status).toBe(ordinal === 7 ? 'failed' : 'pending')
    now = row.available_at
  }
  expect(await f.d.prepare(f.id, origin, '2026-10-06T04:00:00.001Z')).toBeNull()
}, 60_000)
