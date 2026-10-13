import { fixtureExport } from '../helpers/report-download'
import { contract } from '../../src/test/contract'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, test } from 'vitest'
import { foundationFixture } from './foundation-fixture'
import { MailDeliveries } from '../../src/core/features/distribution/deliveries'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
async function launched(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Thank you' })
  await f.publish()
  const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${slug}@example.test` }) as { id: string }
  const input = { ...f.flow, operatorId: f.operatorId, contactIds: [contact.id], commandKey: `command-${slug}` }
  const launch = await f.services.distribution.launches.launch(input)
  const p = (await env.DB.prepare('SELECT * FROM invitation_participants WHERE launch_id = ?').bind(launch.id).first())! as { id: string; token: string; opt_out_token: string; revision_id: string }
  const delivery = (await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))[0] as { deliveryId: string }
  return { ...f, contact, input, launch, p, delivery }
}
contract(['AUD-003', 'AUD-006', 'DIST-003', 'DIST-005', 'FLOW-008'], 'launch snapshots eligible recipient once, consent blocks sending and renewal records actor and source', async () => {
  const f = await launched('distribution-consent')
  expect(await f.services.distribution.launches.launch(f.input)).toEqual(f.launch)
  expect((await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))).toHaveLength(1)
  await f.services.distribution.contacts.edit(f.scope.workspaceId, f.contact.id, { name: 'Changed name', email: 'changed-email@example.test' })
  const prepared = await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  expect(prepared).toMatchObject({ ordinal: 1, to: 'distribution-consent@example.test', idempotencyKey: `invitation:${f.p.id}`, headers: { 'Auto-Submitted': 'auto-generated' } })
  expect(prepared!.text).toContain(`/i/${f.p.token}`)
  expect(prepared!.text).toContain(`/optout/${f.p.opt_out_token}`)
  expect((await env.DB.prepare('SELECT event FROM mail_delivery_attempts WHERE delivery_id = ?').bind(f.delivery.deliveryId).all()).results).toEqual([{ event: 'started' }])
  await f.services.distribution.deliveries.record(f.delivery.deliveryId, 1, { kind: 'transient', reason: 'Synthetic transport unavailable' })
  await f.services.distribution.contacts.optOut(f.p.opt_out_token)
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', new Date(Date.now() + 120000).toISOString())).toBeNull()
  await f.services.distribution.contacts.consent({ ...f.scope, contactId: f.contact.id, actor: f.operatorId, source: 'Explicit synthetic consent', renewed: true })
  expect((await env.DB.prepare('SELECT consent, actor, source FROM contact_consent_events WHERE contact_id = ? ORDER BY created_at').bind(f.contact.id).all()).results).toEqual([{ consent: 'opted-out', actor: 'recipient', source: 'invitation-opt-out' }, { consent: 'renewed', actor: f.operatorId, source: 'Explicit synthetic consent' }])
}, 60_000)
contract(['FLOW-008', 'FLOW-009', 'FLOW-017', 'RESP-008', 'DIST-004', 'RESP-007'], 'invitation stays pinned after publication and allows one atomic completion, cancelling its reminder', async () => {
  const f = await launched('distribution-admission')
  await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  await f.services.distribution.deliveries.record(f.delivery.deliveryId, 1, { kind: 'sent', providerId: 'synthetic-provider-id' })
  const before = await f.services.responses.invitationFlow(f.p.token)
  await f.publish()
  const start = () => f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'desktop', source: 'direct', invitationToken: f.p.token })
  const [a, b] = await Promise.all([start(), start()])
  expect(a.revisionId).toBe(f.p.revision_id)
  expect(a.flow.steps).toEqual(before.publicFlow.steps)
  await f.mature(a.sessionId); await f.mature(b.sessionId)
  const answers = [{ stepId: a.flow.steps.find(s => s.kind === 'question')!.id, value: 'Synthetic response' }]
  const outcomes = await Promise.allSettled([f.final(a, answers, '', f.p.token), f.final(b, answers, '', f.p.token)])
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
  expect((await env.DB.prepare('SELECT source, participant_id FROM responses WHERE participant_id = ?').bind(f.p.id).all()).results).toEqual([{ source: 'invitation', participant_id: f.p.id }])
  expect((await env.DB.prepare("SELECT status FROM mail_deliveries WHERE participant_id = ? AND kind = 'reminder'").bind(f.p.id).first())).toEqual({ status: 'cancelled' })
  expect((await f.services.responses.invitationFlow(f.p.token)).publicFlow.completedStepId).toBe(a.flow.steps.find(s => s.kind === 'completion')!.id)
  await expect(start()).rejects.toThrow('already completed')
  await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId)
  await expect(f.services.responses.invitationFlow(f.p.token)).rejects.toThrow('no longer accepting')
}, 60_000)
contract(['DIST-006', 'DIST-008', 'DIST-010', 'BASE-OPS-004'], 'ambiguous delivery never automatically retries and permanent failure requires an operator retry', async () => {
  const f = await launched('distribution-unknown')
  const d = new MailDeliveries(env.DB)
  const first = await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  await d.record(f.delivery.deliveryId, 1, { kind: 'unknown', reason: 'Synthetic timeout without provider lookup' })
  expect(await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()
  await expect(d.retry(f.scope.workspaceId, f.delivery.deliveryId, f.operatorId, false)).rejects.toThrow('duplicate')
  await d.retry(f.scope.workspaceId, f.delivery.deliveryId, f.operatorId, true)
  const second = await d.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  expect(second!.idempotencyKey).toBe(first!.idempotencyKey)
  expect(second!.ordinal).toBe(2)
  await d.record(f.delivery.deliveryId, 2, { kind: 'permanent', reason: 'Synthetic invalid recipient' })
  expect((await f.services.distribution.launches.list(f.scope.workspaceId, f.flow.flowId))[0]).toMatchObject({ status: 'failed', reason: 'Synthetic invalid recipient', attempts: 2 })
  await expect(d.record(f.delivery.deliveryId, 2, { kind: 'sent', providerId: 'incorrect-late-receipt' })).rejects.toThrow('already has an outcome')
}, 60_000)
contract(['LEDG-001', 'LEDG-003', 'DATA-002', 'BASE-DATA-003', 'DIST-005'], 'identified response filters and exports keep stable participant identity until erasure revokes all invitations', async () => {
  const f = await launched('distribution-erasure')
  const s = await f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'mobile', source: 'direct', invitationToken: f.p.token })
  await f.mature(s.sessionId)
  const done = await f.final(s, [{ stepId: s.flow.steps[0].id, value: 'Retained until erased' }], '', f.p.token)
  const report = await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, { source: 'invitation', participantStatus: 'eligible' })
  expect(report.responses).toHaveLength(1)
  expect(report.responses[0]).toMatchObject({ id: done.responseId, revisionId: f.p.revision_id, participant: { id: f.p.id, name: 'Synthetic recipient', email: 'distribution-erasure@example.test' } })
  await f.services.distribution.contacts.optOut(f.p.opt_out_token)
  expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, { participantStatus: 'eligible' })).responses).toEqual([])
  expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, { participantStatus: 'opted-out' })).responses.map(r => r.id)).toEqual([done.responseId])
  const consentAuditId = (await env.DB.prepare("SELECT id FROM audit_entries WHERE kind = 'contact.consent-changed' AND subject_id = ?").bind(f.contact.id).first<{ id: string }>())!.id
  await f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)
  expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, {})).responses).toEqual([])
  await expect(f.services.responses.invitationFlow(f.p.token)).rejects.toThrow('no longer available')
  expect(await env.DB.prepare('SELECT contact_id, email_snapshot, name_snapshot, token, opt_out_token FROM invitation_participants WHERE id = ?').bind(f.p.id).first()).toEqual({ contact_id: null, email_snapshot: null, name_snapshot: null, token: null, opt_out_token: null })
  expect(await env.DB.prepare('SELECT id FROM response_answers WHERE response_id = ?').bind(done.responseId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM response_outbox WHERE response_id = ?').bind(done.responseId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM distribution_contacts WHERE id = ?').bind(f.contact.id).first()).toBeNull()
  const consentAudit = await env.DB.prepare("SELECT subject_id, details_json FROM audit_entries WHERE id = ?").bind(consentAuditId).all()
  expect(consentAudit.results).toEqual([{ subject_id: null, details_json: '{}' }])
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  expect((await f.services.flows.getFlowResults(f.scope.workspaceId, f.flow.flowId)).completedResponses).toBe(0)
}, 60_000)
contract(['WS-002', 'DIST-004', 'DIST-006', 'DIST-008'], 'transient attempts keep one key, stop after five retries, and reminders wait for workspace hours', async () => {
  const f = await launched('distribution-retries')
  const firstAt = '2026-10-06T00:00:00.000Z'
  await env.DB.prepare('UPDATE mail_deliveries SET available_at = ? WHERE id = ?').bind(firstAt, f.delivery.deliveryId).run()
  let time = firstAt
  for (let ordinal = 1; ordinal <= 6; ordinal++) {
    const call = await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', time)
    expect(call).toMatchObject({ ordinal, idempotencyKey: `invitation:${f.p.id}` })
    await f.services.distribution.deliveries.record(f.delivery.deliveryId, ordinal, { kind: 'transient', reason: 'Synthetic transient' }, time)
    const row = await env.DB.prepare('SELECT available_at, status FROM mail_deliveries WHERE id = ?').bind(f.delivery.deliveryId).first<{ available_at: string; status: string }>()
    if (ordinal === 6) expect(row!.status).toBe('failed')
    else { expect(row!.status).toBe('pending'); time = row!.available_at }
  }
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test', '2026-10-06T02:00:00.000Z')).toBeNull()
  const g = await launched('distribution-window')
  await g.services.distribution.deliveries.prepare(g.delivery.deliveryId, 'https://synthetic.example.test')
  const sent = '2026-10-06T18:00:00.000Z'
  await g.services.distribution.deliveries.record(g.delivery.deliveryId, 1, { kind: 'sent', providerId: 'synthetic' }, sent)
  const reminder = await env.DB.prepare("SELECT id, available_at FROM mail_deliveries WHERE participant_id = ? AND kind = 'reminder'").bind(g.p.id).first<{ id: string; available_at: string }>()
  expect(reminder!.available_at).toBe('2026-10-08T18:00:00.000Z')
  await g.services.workspace.updateSettings({ ...g.scope, timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })
  expect(await g.services.distribution.deliveries.prepare(reminder!.id, 'https://synthetic.example.test', reminder!.available_at)).toBeNull()
  expect((await env.DB.prepare('SELECT available_at FROM mail_deliveries WHERE id = ?').bind(reminder!.id).first())).toEqual({ available_at: '2026-10-09T09:00:00.000Z' })
  expect(await g.services.distribution.deliveries.prepare(reminder!.id, 'https://synthetic.example.test', '2026-10-09T09:00:00.000Z')).toMatchObject({ ordinal: 1, idempotencyKey: `reminder:${g.p.id}` })
}, 60_000)

contract(['RESP-013', 'RESP-006', 'DIST-004'], 'invited sessions retain no participant identity and erased bearer links cannot finalize or send after target closure', async () => {
  const f = await launched('distribution-session-privacy')
  const session = await f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'tablet', source: 'direct', invitationToken: f.p.token })
  const row = await env.DB.prepare('SELECT * FROM respondent_sessions WHERE id = ?').bind(session.sessionId).first()
  expect(row).toMatchObject({ source: 'invitation', revision_id: f.p.revision_id, device_class: 'tablet' })
  for (const key of Object.keys(row!)) expect(key).not.toMatch(/participant|contact|email|name|answer|address|user_agent|host/)
  expect(JSON.stringify(row)).not.toContain(f.p.id)
  expect(JSON.stringify(row)).not.toContain(f.p.token)
  await f.mature(session.sessionId)
  const answers = [{ stepId: session.flow.steps[0].id, value: 'No identity in session state' }]
  await expect(f.final(session, answers)).rejects.toThrow('session')
  await f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)
  await expect(f.final(session, answers, '', f.p.token)).rejects.toThrow('session')
  expect(await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE revision_id = ?').bind(f.p.revision_id).first()).toEqual({ n: 0 })
  expect(await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()

  const g = await launched('distribution-target-send')
  const s = await g.start(); await g.mature(s.sessionId)
  await g.final(s, [{ stepId: s.flow.steps[0].id, value: 'Reached target' }])
  // Quarantine release may meet a target without retriggering its admission flag.
  await env.DB.prepare('UPDATE flow_revisions SET target_completed_responses = 1, admission_closed_at = NULL WHERE id = ?').bind(g.p.revision_id).run()
  expect(await g.services.distribution.deliveries.prepare(g.delivery.deliveryId, 'https://synthetic.example.test')).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) AS n FROM mail_delivery_attempts WHERE delivery_id = ?').bind(g.delivery.deliveryId).first()).toEqual({ n: 0 })
}, 60_000)

contract(['DASH-002', 'LEDG-002'], 'dashboard derives participant denominators from durable consent, bounce and released-response state', async () => {
  const f = await launched('distribution-counts')
  await env.DB.prepare("UPDATE flows SET last_activity_at = '2999-01-01T00:00:00.000Z' WHERE id = ?").bind(f.flow.flowId).run()
  expect((await f.services.flows.listDashboard(f.scope.workspaceId))[0].id).toBe(f.flow.flowId)
  const row = async () => (await f.services.flows.listDashboard(f.scope.workspaceId)).find(flow => flow.id === f.flow.flowId)!
  expect((await row()).audience).toEqual({ launchedParticipants: 1, eligibleParticipants: 1, completedParticipants: 0 })
  const session = await f.services.responses.startPublicSession({ slug: f.slug, deviceClass: 'desktop', source: 'direct', invitationToken: f.p.token })
  await f.mature(session.sessionId)
  const receipt = await f.final(session, [{ stepId: session.flow.steps[0].id, value: 'Count once' }], '', f.p.token)
  expect((await row()).audience).toEqual({ launchedParticipants: 1, eligibleParticipants: 1, completedParticipants: 1 })
  expect((await row()).completedResponses).toBe(1)
  await f.services.distribution.contacts.optOut(f.p.opt_out_token)
  expect((await row()).audience).toEqual({ launchedParticipants: 1, eligibleParticipants: 0, completedParticipants: 0 })
  expect((await row()).completedResponses).toBe(1)
  await f.services.distribution.contacts.consent({ ...f.scope, contactId: f.contact.id, actor: f.operatorId, source: 'Explicit synthetic renewed consent', renewed: true })
  await env.DB.prepare("UPDATE invitation_participants SET delivery_status = 'bounced' WHERE id = ?").bind(f.p.id).run()
  expect((await row()).audience.eligibleParticipants).toBe(0)
  expect((await fixtureExport(env.DB, f.scope.workspaceId, f.flow.flowId, { participantStatus: 'bounced' })).responses.map(r => r.id)).toEqual([receipt.responseId])
  await f.services.flows.closeFlow(f.scope.workspaceId, f.flow.flowId)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId, 'closed')).map(r => r.id)).toContain(f.flow.flowId)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId, 'open')).map(r => r.id)).not.toContain(f.flow.flowId)
  await f.services.flows.archiveFlow(f.scope.workspaceId, f.flow.flowId)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId)).map(r => r.id)).not.toContain(f.flow.flowId)
  expect((await f.services.flows.listDashboard(f.scope.workspaceId, 'archived')).map(r => r.id)).toContain(f.flow.flowId)
}, 60_000)

contract('BASE-DATA-003', 'operator removal anonymizes launch, consent and retry actors and a delayed consent writer cannot restore them', async () => {
  const f = await launched('distribution-operator-custody')
  await f.services.distribution.contacts.consent({ ...f.scope, contactId: f.contact.id, actor: f.operatorId, source: 'Explicit synthetic permission', renewed: true })
  await f.services.distribution.deliveries.prepare(f.delivery.deliveryId, 'https://synthetic.example.test')
  await f.services.distribution.deliveries.record(f.delivery.deliveryId, 1, { kind: 'permanent', reason: 'Synthetic refusal' })
  await f.services.distribution.deliveries.retry(f.scope.workspaceId, f.delivery.deliveryId, f.operatorId, false)
  expect(await env.DB.prepare("SELECT actor_operator_id FROM mail_delivery_attempts WHERE delivery_id = ? AND event = 'operator-retry'").bind(f.delivery.deliveryId).first()).toEqual({ actor_operator_id: f.operatorId })
  // D1 trigger also protects deletion through the shared auth integration.
  await env.DB.prepare('DELETE FROM operators WHERE id = ?').bind(f.operatorId).run()
  expect(await env.DB.prepare('SELECT actor_operator_id FROM invitation_launches WHERE id = ?').bind(f.launch.id).first()).toEqual({ actor_operator_id: null })
  expect(await env.DB.prepare("SELECT actor_operator_id FROM mail_delivery_attempts WHERE delivery_id = ? AND event = 'operator-retry'").bind(f.delivery.deliveryId).first()).toEqual({ actor_operator_id: null })
  await f.services.distribution.contacts.consent({ ...f.scope, contactId: f.contact.id, actor: f.operatorId, source: 'Delayed synthetic consent event', renewed: true })
  const retained = (await env.DB.prepare('SELECT * FROM contact_consent_events WHERE contact_id = ?').bind(f.contact.id).all()).results
  expect(retained).toHaveLength(2)
  expect(JSON.stringify(retained)).not.toContain(f.operatorId)
  expect(retained.map(row => row.actor)).toEqual(['erased-operator', 'erased-operator'])
}, 60_000)

contract('DIST-004', 'a launch snapshots the evaluated buyer reminder schedule before later configuration changes', async () => {
  const f = await launched('reminder-policy-setup')
  const { InvitationLaunches } = await import('../../src/core/features/distribution/launches')
  const policies = { 'flow.reminder-schedule.v1': { delayHours: 12 }, 'flow.audience-eligibility.v1': { excludePreviouslyInvitedToFlow:false } }
  const launcher = new InvitationLaunches(env.DB, policies)
  const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Policy recipient', email: 'policy@example.test' }) as { id: string }
  const launch = await launcher.launch({ ...f.input, commandKey: 'policy-snapshot-command', contactIds: [contact.id] })
  policies['flow.reminder-schedule.v1'].delayHours = 24
  const p = await env.DB.prepare('SELECT id FROM invitation_participants WHERE launch_id = ?').bind(launch.id).first<{ id: string }>()
  const delivery = await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id = ? AND kind = 'invitation'").bind(p!.id).first<{ id: string }>()
  await f.services.distribution.deliveries.prepare(delivery!.id, 'https://synthetic.example.test')
  const sent = '2026-10-06T00:00:00.000Z'
  await f.services.distribution.deliveries.record(delivery!.id, 1, { kind: 'sent', providerId: 'synthetic-policy-receipt' }, sent)
  expect(await env.DB.prepare("SELECT available_at FROM mail_deliveries WHERE participant_id = ? AND kind = 'reminder'").bind(p!.id).first()).toEqual({ available_at: '2026-10-06T12:00:00.000Z' })
}, 60_000)
