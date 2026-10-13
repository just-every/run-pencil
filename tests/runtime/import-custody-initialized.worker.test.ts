import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { archiveFixture, snapshotFixture, restoreFixture } from './archive-fixture'
import { custodyActor } from '../../scripts/custody-test-targets.mjs'
import { restoreStatements } from '../../scripts/deployment-data-sql.mjs'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await applyD1Migrations(second, __PENCIL_CORE_MIGRATIONS__) })

contract(['DATA-001','BASE-OPS-002','BASE-OPS-003','IMPORT-004'], 'native restore requires exactly initialized system rows and preserves the archived monotonic clock and owner data', async () => {
  const baseline = await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)
  expect(await second.prepare('SELECT id,revision FROM form_import_native_clock').all().then(result => result.results)).toEqual([{ id: 1, revision: 1 }])
  await custodyActor(env.DB)
  await env.DB.prepare('UPDATE form_import_native_clock SET revision=7 WHERE id=1').run()
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  const restore = () => second.batch(restoreStatements(archive, JSON.parse(archive.payload.schema), (base64: string) =>
    [...atob(base64)].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    .map(({ sql, params = [] }: { sql: string; params?: unknown[] }) => second.prepare(sql).bind(...params)))
  for (const mutation of [
    'DELETE FROM form_import_native_clock',
    'UPDATE form_import_native_clock SET revision=2',
    'UPDATE form_import_native_clock SET revision=1.5',
    "INSERT INTO local_fixture_initializations VALUES('owned','2026-10-01T00:00:00Z')",
  ]) {
    await restoreFixture(second, baseline)
    await second.prepare(mutation).run()
    const before = await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)
    await expect(restore()).rejects.toThrow()
    expect(await snapshotFixture(second, __PENCIL_CORE_MIGRATIONS__)).toEqual(before)
  }
  await restoreFixture(second, baseline)
  await restore()
  expect(await archiveFixture(second, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  expect(await second.prepare('SELECT revision FROM form_import_native_clock WHERE id=1').first()).toEqual({ revision: 7 })
  expect((await second.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
