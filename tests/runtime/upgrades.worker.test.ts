import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

type UpgradeCheck = { kind: 'sample-row' | 'graph-link' | 'idempotency'; query: string; expectedRows: Array<Record<string, unknown>> }

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_PREVIOUS_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_UPGRADE_FIXTURE_SQL__: string
declare const __PENCIL_UPGRADE_CHECKS__: UpgradeCheck[]

const hasUpgradeInput = __PENCIL_PREVIOUS_CORE_MIGRATIONS__.length > 0 && __PENCIL_UPGRADE_FIXTURE_SQL__.trim().length > 0

describe.skipIf(!hasUpgradeInput)('declared release migration in a Workers D1 runtime', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, __PENCIL_PREVIOUS_CORE_MIGRATIONS__)
    await env.DB.exec(__PENCIL_UPGRADE_FIXTURE_SQL__)
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  })

  it('retains the representative legacy rows, graph relationships, and idempotency behavior declared by the predecessor fixture', async () => {
    expect(__PENCIL_UPGRADE_CHECKS__.map((check) => check.kind).sort()).toEqual(['graph-link', 'idempotency', 'sample-row'])
    for (const check of __PENCIL_UPGRADE_CHECKS__) {
      const result = await env.DB.prepare(check.query).all<Record<string, unknown>>()
      expect(result.results, check.kind).toEqual(check.expectedRows)
    }
  })

  it('leaves no foreign-key violations and records every current migration', async () => {
    const foreignKeys = await env.DB.prepare('PRAGMA foreign_key_check').all()
    expect(foreignKeys.results).toEqual([])
    const ledger = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{ name: string }>()
    expect(ledger.results.map((entry) => entry.name)).toEqual(__PENCIL_CORE_MIGRATIONS__.map((migration) => migration.name))
  })
})
