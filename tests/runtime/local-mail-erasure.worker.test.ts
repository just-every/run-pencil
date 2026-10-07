import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { localMailErasureFixture } from './local-mail-erasure-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['DATA-002', 'BASE-DATA-003'], 'contact erasure removes delivered invitations and reminders across revisions before response triggers unlink participants', async () => {
  const f = await localMailErasureFixture('mail-contact-erasure')
  const first = await f.launch()
  await f.send(first, true)
  const response = await f.complete(first)
  // The current address no longer matches either historical delivered snapshot.
  await env.DB.prepare('UPDATE distribution_contacts SET email = ? WHERE id = ?')
    .bind('updated-recipient@example.test', f.contact.id).run()
  await f.publish()
  const second = await f.launch()
  await f.send(second)
  const other = await f.services.distribution.contacts.save(f.scope.workspaceId,
    { name: 'Another recipient', email: first.email_snapshot }) as { id: string }
  const unrelated = await f.launch(other.id)
  const retained = await f.send(unrelated)

  await f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)

  await f.erasedParticipant(first)
  await f.erasedParticipant(second)
  expect(await f.mail(unrelated)).toEqual(retained)
  expect(await env.DB.prepare('SELECT id FROM distribution_contacts WHERE id = ?').bind(f.contact.id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM responses WHERE id = ?').bind(response.responseId).first()).toBeNull()
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}, 60_000)

contract(['DATA-002', 'BASE-DATA-003'], 'individual response erasure removes only that participant local mail and preserves another invitation to the same contact', async () => {
  const f = await localMailErasureFixture('mail-response-erasure')
  const first = await f.launch()
  await f.send(first, true)
  const response = await f.complete(first)
  await f.publish()
  const second = await f.launch()
  const retained = await f.send(second)

  await f.services.responses.eraseReleasedResponse(response)

  await f.erasedParticipant(first)
  expect(await f.mail(second)).toEqual(retained)
  expect(await env.DB.prepare('SELECT contact_id, token FROM invitation_participants WHERE id = ?').bind(second.id).first())
    .toEqual({ contact_id: f.contact.id, token: second.token })
  expect(await env.DB.prepare('SELECT id FROM distribution_contacts WHERE id = ?').bind(f.contact.id).first()).not.toBeNull()
  await expect(f.services.responses.eraseReleasedResponse(response)).rejects.toThrow('does not exist')
  expect(await f.mail(second)).toEqual(retained)
}, 60_000)

contract(['DATA-002', 'BASE-DATA-003', 'RESP-018'], 'quarantined response deletion removes its delivered invitation copy with the revoked identity', async () => {
  const f = await localMailErasureFixture('mail-quarantine-erasure')
  const participant = await f.launch()
  const retained = await f.send(participant)
  const response = await f.complete(participant, true)
  await expect(f.services.responses.eraseReleasedResponse(response)).rejects.toThrow('does not exist')
  await expect(f.services.responses.deleteQuarantinedResponse({ ...response, workspaceId: 'foreign-workspace' })).rejects.toThrow('does not exist')
  expect(await f.mail(participant)).toEqual(retained)
  await f.services.responses.deleteQuarantinedResponse(response)
  await f.erasedParticipant(participant)
}, 60_000)

contract('BASE-DATA-003', 'wrong-workspace and wrong-state response erasures leave delivered local mail intact', async () => {
  const f = await localMailErasureFixture('mail-erasure-authorization')
  const participant = await f.launch()
  const retained = await f.send(participant)
  const response = await f.complete(participant)
  await expect(f.services.distribution.contacts.erase('foreign-workspace', f.contact.id, f.operatorId)).rejects.toThrow('not in your workspace')
  await expect(f.services.responses.eraseReleasedResponse({ ...response, workspaceId: 'foreign-workspace' })).rejects.toThrow('does not exist')
  await expect(f.services.responses.deleteQuarantinedResponse(response)).rejects.toThrow('does not exist')
  expect(await f.mail(participant)).toEqual(retained)
  expect(await env.DB.prepare('SELECT token FROM invitation_participants WHERE id = ?').bind(participant.id).first())
    .toEqual({ token: participant.token })
}, 60_000)

contract(['DATA-002', 'BASE-DATA-003'], 'anonymous response erasure cannot remove unrelated local delivery copies', async () => {
  const f = await localMailErasureFixture('mail-anonymous-erasure')
  const participant = await f.launch()
  const retained = await f.send(participant)
  await f.services.responses.eraseReleasedResponse(await f.complete())
  expect(await f.mail(participant)).toEqual(retained)
}, 60_000)

async function assertErasureRollback(kind: 'contact' | 'response') {
  const f = await localMailErasureFixture(`mail-erasure-rollback-${kind}`)
  const participant = await f.launch()
  const retained = await f.send(participant)
  const response = await f.complete(participant)
  const beforeAudit = (await env.DB.prepare('SELECT * FROM audit_entries ORDER BY id').all()).results
  // Real D1 abort after cleanup proves that erasure does not partially commit.
  await env.DB.exec("CREATE TRIGGER reject_test_response_erasure BEFORE DELETE ON responses BEGIN SELECT RAISE(ABORT, 'synthetic erasure failure'); END")
  try {
    await expect(kind === 'contact'
      ? f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)
      : f.services.responses.eraseReleasedResponse(response)).rejects.toThrow('synthetic erasure failure')
    expect(await f.mail(participant)).toEqual(retained)
    expect(await env.DB.prepare('SELECT contact_id, token FROM invitation_participants WHERE id = ?').bind(participant.id).first())
      .toEqual({ contact_id: f.contact.id, token: participant.token })
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id = ?').bind(response.responseId).first()).not.toBeNull()
    expect((await env.DB.prepare('SELECT * FROM audit_entries ORDER BY id').all()).results).toEqual(beforeAudit)
  } finally { await env.DB.exec('DROP TRIGGER reject_test_response_erasure') }
}

contract(['DATA-002', 'BASE-DATA-003'], 'contact erasure rolls local mail cleanup back if response deletion fails', () => assertErasureRollback('contact'), 60_000)

contract(['DATA-002', 'BASE-DATA-003'], 'response erasure rolls local mail cleanup back if response deletion fails', () => assertErasureRollback('response'), 60_000)

async function assertDelayedSendAfterErasure(kind: 'contact' | 'response') {
  const f = await localMailErasureFixture(`mail-erasure-delayed-${kind}`)
  const participant = await f.launch()
  const delivery = (await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id = ? AND kind = 'invitation'")
    .bind(participant.id).first<{ id: string }>())!
  const prepared = (await f.services.distribution.deliveries.prepare(delivery.id, 'http://localhost'))!
  expect(prepared).not.toBeNull()
  if (kind === 'contact') await f.services.distribution.contacts.erase(f.scope.workspaceId, f.contact.id, f.operatorId)
  else await f.services.responses.eraseReleasedResponse(await f.complete(participant))
  await expect(f.sender.send({ deliveryId: prepared.idempotencyKey, from: 'no-reply@pencil.test', to: [prepared.to],
    subject: prepared.subject, text: prepared.text, headers: prepared.headers })).rejects.toMatchObject({ code: 'development_outbox_failed' })
  expect(await f.mail(participant)).toEqual([])
}

contract(['BASE-DATA-003', 'DIST-003'], 'a delayed local send cannot restore mail after contact erasure cancels its claim', () => assertDelayedSendAfterErasure('contact'), 60_000)

contract(['BASE-DATA-003', 'DIST-003'], 'a delayed local send cannot restore mail after response erasure cancels its claim', () => assertDelayedSendAfterErasure('response'), 60_000)
