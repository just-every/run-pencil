import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import worker, { initializePencil } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { foundationFixture } from './foundation-fixture'
import { archiveFixture, restoreFixture, snapshotFixture } from './archive-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let baseline: Awaited<ReturnType<typeof snapshotFixture>>
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await initializePencil(createPencilPlatform('http://localhost', env))
  baseline = await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
})
afterEach(() => restoreFixture(env.DB, baseline))

async function invitationFixture(slug: string, states: Array<{ kind: string; status: string }>) {
  const f = await foundationFixture(slug), now = new Date().toISOString(), prior = new Date(Date.now() - 600_000).toISOString()
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Recorded' })
  await f.publish()
  await f.services.workspace.updateSettings({ ...f.scope, timeZone: 'UTC', sendingWindowStart: '00:00', sendingWindowEnd: '23:59' })
  const revision = await env.DB.prepare('SELECT id FROM flow_revisions WHERE flow_id=? AND is_current=1').bind(f.flow.flowId).first<{ id: string }>()
  const launchId = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO invitation_launches(id,workspace_id,revision_id,command_key,policy_json,created_at) VALUES(?,?,?,?,?,?)').bind(launchId, f.scope.workspaceId, revision!.id, launchId, '{"reminderDelayHours":48}', prior).run()
  const rows: Array<{ id: string; participantId: string; contactId: string; kind: string; status: string }> = []
  for (const { kind, status } of states) {
    const id = crypto.randomUUID(), participantId = crypto.randomUUID()
    const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${id}@example.test` }) as { id: string }
    const participantStatus = kind === 'reminder' ? 'sent' : ['sent','failed','unknown'].includes(status) ? status : 'queued'
    await env.DB.prepare('INSERT INTO invitation_participants(id,launch_id,workspace_id,revision_id,contact_id,email_snapshot,name_snapshot,token,opt_out_token,delivery_status,response_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(participantId, launchId, f.scope.workspaceId, revision!.id, contact.id, `${id}@example.test`, 'Synthetic recipient', `planted-invitation-${id}`, `planted-optout-${id}`, participantStatus, 'not-started', prior).run()
    await env.DB.prepare('INSERT INTO mail_deliveries(id,participant_id,kind,status,idempotency_key,attempts,first_attempt_at,last_attempt_at,available_at,reason,provider_id,created_at,updated_at) VALUES(?,?,?,?,?,2,?,?,?,?,?,?,?)')
      .bind(id, participantId, kind, status, `${kind}:${participantId}`, prior, prior, prior, 'Retained provider reason', `receipt:${id}`, prior, prior).run()
    await env.DB.prepare('INSERT INTO mail_delivery_attempts(id,delivery_id,ordinal,event,reason,provider_id,created_at) VALUES(?,?,2,?,?,?,?)').bind(crypto.randomUUID(), id, status === 'sending' ? 'started' : status, 'Retained attempt reason', `receipt:${id}`, prior).run()
    rows.push({ id, participantId, contactId: contact.id, kind, status })
  }
  return { ...f, rows, now }
}
async function deliveryFacts() {
  return {
    deliveries: (await env.DB.prepare('SELECT * FROM mail_deliveries ORDER BY id').all()).results,
    attempts: (await env.DB.prepare('SELECT * FROM mail_delivery_attempts ORDER BY id').all()).results,
    participants: (await env.DB.prepare('SELECT * FROM invitation_participants ORDER BY id').all()).results,
  }
}

contract(['DATA-001','BASE-DATA-001','DIST-006','DIST-010'], 'restored invitation and reminder states survive direct preparation and repeated Cron without capabilities, cancellation, new attempts or replay', async () => {
  const states = ['pending','sending','sent','failed','unknown','cancelled']
  const f = await invitationFixture('restored-invitation-states', ['invitation','reminder'].flatMap(kind => states.map(status => ({ kind, status }))))
  const original = await deliveryFacts()
  expect(await env.DB.prepare('SELECT status FROM flows WHERE id=?').bind(f.flow.flowId).first()).toEqual({ status: 'open' })
  expect(await env.DB.prepare('SELECT count(*) n FROM distribution_contacts WHERE opted_out_at IS NOT NULL').first()).toEqual({ n: 0 })
  const archive = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
  expect(JSON.stringify(archive)).not.toContain('planted-invitation-')
  expect(JSON.stringify(archive)).not.toContain('planted-optout-')
  await restoreFixture(env.DB, archive)
  const before = await deliveryFacts()
  expect(before.deliveries).toEqual(original.deliveries)
  expect(before.attempts).toEqual(original.attempts)
  expect(before.participants).toEqual(original.participants.map(row => ({ ...row, token: null, opt_out_token: null })))
  expect(before.deliveries).toHaveLength(12)
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external delivery'))
  try {
    for (const row of f.rows) expect(await f.services.distribution.deliveries.prepare(row.id, 'http://localhost', f.now)).toBeNull()
    expect(await deliveryFacts()).toEqual(before)
    for (const offset of [0, 86400_000]) await worker.scheduled({ scheduledTime: Date.parse(f.now) + offset } as ScheduledController, env)
    expect(await deliveryFacts()).toEqual(before)
    expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).toEqual({ n: 0 })
    expect(fetch).not.toHaveBeenCalled()
    const after = await archiveFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)
    const mailTables = ['mail_deliveries','mail_delivery_attempts','invitation_participants']
    expect(after.payload.tables.filter(table => mailTables.includes(table.name))).toEqual(archive.payload.tables.filter(table => mailTables.includes(table.name)))
  } finally { fetch.mockRestore() }
})

contract(['DIST-003','DIST-005','DIST-010'], 'live invitation capabilities still permit sending, cancel ineligible consent and classify interrupted claims as unknown', async () => {
  const f = await invitationFixture('live-invitation-states', ['pending','sending','pending'].map(status => ({ kind: 'invitation', status })))
  const [pending, sending, ineligible] = f.rows
  await env.DB.prepare('UPDATE distribution_contacts SET opted_out_at=? WHERE id=?').bind(f.now, ineligible.contactId).run()
  expect(await f.services.distribution.deliveries.prepare(ineligible.id, 'http://localhost', f.now)).toBeNull()
  expect(await env.DB.prepare('SELECT status,attempts FROM mail_deliveries WHERE id=?').bind(ineligible.id).first()).toEqual({ status: 'cancelled', attempts: 2 })
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external delivery'))
  try {
    expect(await f.services.distribution.dispatcher.run(f.now)).toEqual({ attempted: 1 })
    expect(await env.DB.prepare('SELECT status,attempts FROM mail_deliveries WHERE id=?').bind(pending.id).first()).toEqual({ status: 'sent', attempts: 3 })
    expect(await env.DB.prepare('SELECT status,attempts FROM mail_deliveries WHERE id=?').bind(sending.id).first()).toEqual({ status: 'unknown', attempts: 2 })
    expect(await env.DB.prepare("SELECT count(*) n FROM mail_delivery_attempts WHERE delivery_id=? AND event='unknown'").bind(sending.id).first()).toEqual({ n: 1 })
    expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).toEqual({ n: 1 })
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
