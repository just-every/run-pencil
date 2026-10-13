import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationFixture } from './notifications-fixture'
import { localMailErasureFixture } from './local-mail-erasure-fixture'
import { eraseResponseLocalMailStatement } from '../../src/core/platform/mail/erasure'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

contract(['DATA-002','NOTIFY-002','NOTIFY-004','RESP-007','RESP-018'], 'reporting triggers preserve exact submission and quarantine transitions with one snapshotted notification command', async () => {
  const f = await notificationFixture('custody-notification-transitions')
  const first = await f.submit(), quarantined = await f.submit(true)
  expect(first.response.state).toBe('released')
  expect(quarantined.response.state).toBe('quarantined')
  const outbox = async (responseId: string) => (await env.DB.prepare('SELECT payload_json,notification_eligible FROM response_outbox WHERE response_id=?').bind(responseId).all<{ payload_json: string; notification_eligible: number }>()).results
  expect(await outbox(quarantined.response.id)).toEqual([])
  const assertRecipient = async (responseId: string) => {
    const rows = await outbox(responseId)
    expect(rows).toHaveLength(1)
    expect(rows[0].notification_eligible).toBe(1)
    expect(JSON.parse(rows[0].payload_json).notificationOperatorIds).toEqual([f.operatorId])
  }
  await assertRecipient(first.response.id)
  await first.replay()
  await assertRecipient(first.response.id)
  const input = { ...f.scope, responseId: quarantined.response.id, operatorId: f.operatorId }
  await f.services.responses.releaseQuarantinedResponse(input)
  await assertRecipient(quarantined.response.id)
  await expect(f.services.responses.releaseQuarantinedResponse(input)).rejects.toThrow('does not exist')
  await f.services.notifications.preferences.set(f.scope.workspaceId, f.flow.flowId, f.operatorId, 'off')
  await assertRecipient(first.response.id)
  await assertRecipient(quarantined.response.id)
  await f.services.responses.eraseReleasedResponse({ ...input, responseId: first.response.id })
  expect(await outbox(first.response.id)).toEqual([])
  await assertRecipient(quarantined.response.id)
  expect(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first()).toEqual({ n: 0 })
})

contract(['DATA-002','BASE-DATA-003'], 'plain captured-mail deletion descriptors retain audit guards and erase only the matching response delivery', async () => {
  const f = await localMailErasureFixture('custody-mail-descriptor')
  const participant = await f.launch()
  await f.send(participant)
  const response = await f.complete(participant)
  await f.publish()
  const other = await f.launch()
  const retained = await f.send(other)
  const statement = eraseResponseLocalMailStatement(response.responseId, response.workspaceId, 'absent-audit')
  await env.DB.prepare(statement.sql).bind(...statement.params).run()
  expect((await f.mail(participant)).length).toBe(1)
  expect((await f.mail(other)).length).toBe(1)
  await f.services.responses.eraseReleasedResponse(response)
  expect((await f.mail(participant)).length).toBe(0)
  expect((await f.mail(other)).length).toBe(1)
  expect(await f.mail(other)).toEqual(retained)
  expect(await env.DB.prepare('SELECT contact_id, token FROM invitation_participants WHERE id=?').bind(other.id).first())
    .toEqual({ contact_id: f.contact.id, token: other.token })
  expect(await env.DB.prepare('SELECT count(*) n FROM local_mail_outbox').first()).toEqual({ n: 0 })
})
