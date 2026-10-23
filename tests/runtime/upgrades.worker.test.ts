import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, describe, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { NotificationDispatcher } from '../../src/core/features/notifications/dispatcher'
import { NotificationRepository } from '../../src/core/features/notifications/repository'
import { boundedCompoundSelect } from '../helpers/compound-select'
import { dispatchQueuedLegacyRetry } from './upgrades/queued-retry-dispatch'

type UpgradeCheck = { kind: 'sample-row' | 'graph-link' | 'idempotency'; query: string; expectedRows: Array<Record<string, unknown>> }

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_PREVIOUS_CORE_MIGRATIONS__: D1Migration[]
declare const __PENCIL_UPGRADE_FIXTURE_QUERIES__: string[]
declare const __PENCIL_UPGRADE_CHECKS__: UpgradeCheck[]

let priorAudience:unknown,priorLaunches:unknown,priorConsent:unknown
let priorResponses: Array<{ id: string; source: string; started_at: string | null; session_id: string; completed_at: string }>
const hasUpgradeInput = __PENCIL_PREVIOUS_CORE_MIGRATIONS__.length > 0 && __PENCIL_UPGRADE_FIXTURE_QUERIES__.length > 0

async function verifyRetainedRows() {
  for (const check of __PENCIL_UPGRADE_CHECKS__.filter(check => check.kind !== 'idempotency')) {
    const result = await env.DB.prepare(boundedCompoundSelect(check.query)).all<Record<string, unknown>>()
    expect(result.results, check.kind).toEqual(check.expectedRows)
  }
}

describe.skipIf(!hasUpgradeInput)('declared release migration in a Workers D1 runtime', () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, __PENCIL_PREVIOUS_CORE_MIGRATIONS__)
    await env.DB.batch(__PENCIL_UPGRADE_FIXTURE_QUERIES__.map(query => env.DB.prepare(query)))
    await env.DB.prepare("INSERT INTO distribution_contacts(id,workspace_id,email,name,created_at,updated_at) VALUES('erased-before-upgrade','upgrade-workspace','erased@example.test','Erased before upgrade','2026-10-01','2026-10-01')").run()
    await env.DB.prepare("DELETE FROM distribution_contacts WHERE id='erased-before-upgrade'").run()
    await env.DB.prepare("INSERT INTO contact_consent_events(id,contact_id,workspace_id,consent,actor,source,created_at) VALUES('prior-consent','upgrade-contact-2','upgrade-workspace','renewed','upgrade-operator-1','Historical consent','2026-10-01')").run()
    priorAudience=(await env.DB.prepare('SELECT id,name,email,opted_out_at FROM distribution_contacts ORDER BY id').all()).results
    priorLaunches=(await env.DB.prepare('SELECT id,revision_id,command_key,policy_json FROM invitation_launches ORDER BY id').all()).results
    priorConsent=(await env.DB.prepare('SELECT * FROM contact_consent_events ORDER BY id').all()).results
    priorResponses=(await env.DB.prepare('SELECT id,source,started_at,session_id,completed_at FROM responses ORDER BY id').all<typeof priorResponses[number]>()).results
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  })

  contract(['BASE-OPS-002', 'BASE-OPS-003', 'AUD-001'], 'retains the representative legacy rows, graph relationships, and idempotency behavior declared by the predecessor fixture', async () => {
    const contacts=(await env.DB.prepare('SELECT id,name,email,opted_out_at FROM distribution_contacts ORDER BY id').all()).results
    const launches=(await env.DB.prepare('SELECT id,revision_id,command_key,policy_json FROM invitation_launches ORDER BY id').all()).results
    const consent=(await env.DB.prepare('SELECT * FROM contact_consent_events ORDER BY id').all()).results
    expect(contacts).toEqual(priorAudience);expect(launches).toEqual(priorLaunches);expect(consent).toEqual(priorConsent)
    expect(priorResponses.length).toBeGreaterThan(0)
    expect((await env.DB.prepare('SELECT id,source,started_at,session_id,completed_at,device_class FROM responses ORDER BY id').all()).results).toEqual(priorResponses.map(response => ({ ...response, device_class: null })))
    expect(await env.DB.prepare("SELECT id FROM distribution_contacts WHERE id='erased-before-upgrade'").first()).toBeNull()
    expect((await env.DB.prepare('SELECT fields_json FROM distribution_contacts').all()).results.every(c=>JSON.stringify(JSON.parse(c.fields_json as string))==='{}')).toBe(true)
    console.log('Audience predecessor preservation:',JSON.stringify({contactsBefore:(priorAudience as unknown[]).length,contactsAfter:contacts.length,launchesBefore:(priorLaunches as unknown[]).length,launchesAfter:launches.length,consentBefore:(priorConsent as unknown[]).length,consentAfter:consent.length,erasedBefore:0,erasedAfter:0}))

    expect(__PENCIL_UPGRADE_CHECKS__.map((check) => check.kind).sort()).toEqual(['graph-link', 'idempotency', 'sample-row'])
    for (const check of __PENCIL_UPGRADE_CHECKS__) {
      const result = await env.DB.prepare(boundedCompoundSelect(check.query)).all<Record<string, unknown>>()
      expect(result.results, check.kind).toEqual(check.expectedRows)
    }
    // Replay actual predecessor command identities, retaining every original row.
    for (const table of ['responses', 'invitation_launches', 'mail_deliveries']) {
      const columns = (await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results.map(column => column.name)
      const selected = columns.map(column => column === 'id' ? "'duplicate-' || id" : column)
      const duplicate = await env.DB.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) SELECT ${selected.join(',')} FROM ${table}`).run()
      expect(duplicate.meta.changes, table).toBe(0)
    }
    await verifyRetainedRows()

    // Recreate the predecessor state after its explicit retry was queued: attempts 4,
    // an old first-attempt timestamp, and a current operator-retry marker at 4.
    // The released retry preserved that old timestamp, so only the normal
    // post-upgrade dispatcher can prove that the queued send still happens.
    const retryProof = await dispatchQueuedLegacyRetry((env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND,
      __PENCIL_PREVIOUS_CORE_MIGRATIONS__, __PENCIL_UPGRADE_FIXTURE_QUERIES__, __PENCIL_CORE_MIGRATIONS__)
    expect(retryProof.concurrentDrains.reduce((sum, result) => sum + result.attempted, 0)).toBe(1)
    expect(retryProof.repeatedDrains).toEqual([{ attempted: 0 }, { attempted: 0 }, { attempted: 0 }])
    expect(retryProof.delivery).toEqual({ status: 'sent', attempts: 5, first_attempt_at: '2026-10-13T00:00:00.000Z',
      last_attempt_at: '2026-10-13T00:00:00.000Z', idempotency_key: 'upgrade-delivery-key-2' })
    expect(retryProof.historyAfter.filter(row => retryProof.historyBefore.some(before => before.id === row.id))).toEqual(retryProof.historyBefore)
    expect(retryProof.historyAfter.filter(row => row.ordinal === 5).map(row => row.event).sort()).toEqual(['sent', 'started'])
    expect(retryProof.captured).toHaveLength(1)
    expect(JSON.parse(retryProof.captured[0].message)).toMatchObject({ deliveryId: 'upgrade-delivery-key-2', to: ['contact2@example.com'] })
  })

  contract('BASE-OPS-002', 'leaves no foreign-key violations and records every current migration', async () => {
    const foreignKeys = await env.DB.prepare('PRAGMA foreign_key_check').all()
    expect(foreignKeys.results).toEqual([])
    const ledger = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{ name: string }>()
    expect(ledger.results.map((entry) => entry.name)).toEqual(__PENCIL_CORE_MIGRATIONS__.map((migration) => migration.name))
    await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
    expect((await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).results).toEqual(ledger.results)
    // A predecessor that applied a since-rewritten migration (migrations/released-rewrites.json) ends with a new database's schema.
    const fresh = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
    await applyD1Migrations(fresh, __PENCIL_CORE_MIGRATIONS__)
    const schema = (db: D1Database) => db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY type, name").all()
    expect((await schema(env.DB)).results).toEqual((await schema(fresh)).results)
    await verifyRetainedRows()
  })

  contract(['BASE-OPS-002', 'NOTIFY-002', 'NOTIFY-004'], 'defaults predecessor preferences off and never sends historical pending responses after opt-in and dispatch', async () => {
    const preferences = new NotificationRepository(env.DB)
    expect((await env.DB.prepare('SELECT * FROM notification_preferences').all()).results).toEqual([])
    for (const operatorId of ['upgrade-operator-1', 'upgrade-operator-2']) {
      expect(await preferences.read('upgrade-workspace', 'upgrade-flow', operatorId)).toEqual({ localMail: false, timerLastStartedAt: null, mode: 'off', failureReason: null, senderError: null, deliveries: [] })
    }
    for (const table of ['responses', 'response_outbox']) {
      const rows = (await env.DB.prepare(`SELECT id,notification_eligible FROM ${table} ORDER BY id`).all()).results
      expect(rows).toHaveLength(2)
      expect(rows.map(row => row.notification_eligible)).toEqual([0, 0])
    }
    expect((await env.DB.prepare("SELECT id FROM response_outbox WHERE status='pending'").all()).results).toHaveLength(2)
    const sent: unknown[] = []
    const dispatcher = new NotificationDispatcher(env.DB, { send: async message => {
      sent.push(message)
      throw new Error('Historical response must not reach mail delivery.')
    } }, 'https://example.com', 'no-reply@example.com')
    expect(await dispatcher.run('2026-10-08T12:00:00.000Z')).toEqual({ attempted: 0, senderError: null })
    for (const operatorId of ['upgrade-operator-1', 'upgrade-operator-2']) {
      await preferences.set('upgrade-workspace', 'upgrade-flow', operatorId, 'immediately', '2026-10-08T12:01:00.000Z')
    }
    expect(await dispatcher.run('2026-10-08T12:02:00.000Z')).toEqual({ attempted: 0, senderError: null })
    expect(await dispatcher.run('2026-10-08T12:03:00.000Z')).toEqual({ attempted: 0, senderError: null })
    expect(sent).toEqual([])
    expect((await env.DB.prepare('SELECT * FROM notification_deliveries').all()).results).toEqual([])
    expect((await env.DB.prepare('SELECT * FROM notification_attempts').all()).results).toEqual([])
    await verifyRetainedRows()
  })
})
