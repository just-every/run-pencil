import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { restoreStatements } from '../../scripts/deployment-data-sql.mjs'
import { archiveFixture } from './archive-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

async function checkMigrationLedgerColumnDrift(description: string, sql: string) {
    const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
    // Preflight completed against the expected ledger; drift then wins the race.
    const statements = restoreStatements(archive, JSON.parse(archive.payload.schema), (value: string) => [...atob(value)].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    await env.DB.prepare(sql).run()
    try {
      if (description === 'stored column') await env.DB.prepare("UPDATE d1_migrations SET owner_metadata='retained ledger annotation'").run()
      const before = await env.DB.prepare('SELECT * FROM d1_migrations ORDER BY id').all()
      const schema = await env.DB.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all()
      await expect(env.DB.batch(statements.map(({ sql, params = [] }: { sql: string; params?: unknown[] }) => env.DB.prepare(sql).bind(...params)))).rejects.toThrow()
      expect((await env.DB.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results).toEqual(before.results)
      expect((await env.DB.prepare('SELECT name,sql FROM sqlite_schema ORDER BY name').all()).results).toEqual(schema.results)
      expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
    } finally {
      await env.DB.prepare('ALTER TABLE d1_migrations DROP COLUMN owner_metadata').run()
    }
    expect(await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)).toEqual(archive)
  }

contract(['DATA-001','BASE-DATA-001'], 'native D1 rejects migration ledger stored column drift in the atomic restore guard', () => checkMigrationLedgerColumnDrift('stored column', 'ALTER TABLE d1_migrations ADD COLUMN owner_metadata TEXT'))
contract(['DATA-001','BASE-DATA-001'], 'native D1 rejects migration ledger generated column drift in the atomic restore guard', () => checkMigrationLedgerColumnDrift('generated column', "ALTER TABLE d1_migrations ADD COLUMN owner_metadata TEXT GENERATED ALWAYS AS ('retained ledger annotation') VIRTUAL"))
