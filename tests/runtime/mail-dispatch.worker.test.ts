import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
import { DistributionDispatcher } from '../../src/core/features/distribution/dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
async function fixture(slug: string) {
  const f = await foundationFixture(slug)
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Recorded' })
  await f.publish()
  const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, { name: 'Synthetic recipient', email: `${slug}@example.test` }) as { id: string }
  const launch = await f.services.distribution.launches.launch({ ...f.flow, operatorId: f.operatorId, contactIds: [contact.id], commandKey: `launch-${slug}` })
  const participant = await env.DB.prepare('SELECT id,token,opt_out_token FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{ id: string; token: string; opt_out_token: string }>()
  const delivery = await env.DB.prepare('SELECT id FROM mail_deliveries WHERE participant_id=?').bind(participant!.id).first<{ id: string }>()
  const sender = baseMailSender({ kind: 'sendgrid', apiKey: 'synthetic-mail-secret', from: 'no-reply@example.test' }, env.DB)
  const dispatcher = new DistributionDispatcher(env.DB, f.services.distribution.deliveries, sender, 'https://pencil.example.test', 'no-reply@example.test')
  return { ...f, contact, participant: participant!, delivery: delivery!, dispatcher }
}
contract(['DIST-003','DIST-004','DIST-005','DIST-008','BASE-OPS-003','BASE-OPS-005'], 'the actual Base sender sees a durable attempt before one invitation send; duplicate dispatch, opt-out, closure and erasure suppress effects', async () => {
  const f = await fixture('base-mail-delivery')
  const send = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
    expect(await env.DB.prepare('SELECT event,ordinal FROM mail_delivery_attempts WHERE delivery_id=?').bind(f.delivery.id).all()).toMatchObject({ results: [{ event: 'started', ordinal: 1 }] })
    const payload = JSON.parse(String(options!.body))
    expect(payload.from.email).toBe('no-reply@example.test')
    expect(payload.headers['Auto-Submitted']).toBe('auto-generated')
    const text = payload.content[0].value
    expect(text).toContain(`/i/${f.participant.token}`)
    expect(text).toContain(`/optout/${f.participant.opt_out_token}`)
    expect(text).toContain('Synthetic base-mail-delivery')
    expect(JSON.stringify(payload)).not.toContain('synthetic-mail-secret')
    return new Response(null, { status: 202 }) // SendGrid may accept without a receipt ID.
  })
  try {
    await Promise.all([f.dispatcher.run(), f.dispatcher.run()])
    expect(send).toHaveBeenCalledTimes(1)
    expect(await env.DB.prepare('SELECT status,provider_id,attempts FROM mail_deliveries WHERE id=?').bind(f.delivery.id).first()).toEqual({ status: 'sent', provider_id: null, attempts: 1 })
    const reminder = await env.DB.prepare("SELECT id,status FROM mail_deliveries WHERE participant_id=? AND kind='reminder'").bind(f.participant.id).first<{ id: string; status: string }>()
    expect(reminder!.status).toBe('pending')
    await f.services.distribution.contacts.optOut(f.participant.opt_out_token)
    await f.dispatcher.run(new Date(Date.now()+3*86400_000).toISOString())
    expect(send).toHaveBeenCalledTimes(1)
    expect(await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(reminder!.id).first()).toEqual({ status: 'cancelled' })
    for (const reason of ['closed','erased']) {
      const blocked = await fixture(`base-mail-${reason}`)
      if (reason === 'closed') await blocked.services.flows.closeFlow(blocked.scope.workspaceId,blocked.flow.flowId)
      else await blocked.services.distribution.contacts.erase(blocked.scope.workspaceId,blocked.contact.id,blocked.operatorId)
      await blocked.dispatcher.run()
      expect(send).toHaveBeenCalledTimes(1)
    }
  } finally { send.mockRestore() }
})
contract(['DIST-006','DIST-008','DIST-010','BASE-OPS-004'], 'rate-limit retries keep the original key and stop after five retries within one hour; ambiguous and interrupted claims never automatically resend', async () => {
  const f = await fixture('base-mail-bounded')
  const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 429 }))
  try {
    const started = Date.now()
    for (const minutes of [0,1,5,15,30,60]) await f.dispatcher.run(new Date(started+minutes*60_000).toISOString())
    expect(send).toHaveBeenCalledTimes(6)
    expect(await env.DB.prepare('SELECT status,attempts FROM mail_deliveries WHERE id=?').bind(f.delivery.id).first()).toEqual({ status:'failed', attempts:6 })
    expect(new Set(send.mock.calls.map(([,options]) => JSON.parse(String(options!.body)).custom_args.rer_delivery_id)).size).toBe(1)
    const listed = await f.services.distribution.launches.list(f.scope.workspaceId,f.flow.flowId)
    expect(listed[0]).toMatchObject({ status:'failed', attempts:6, reason:expect.any(String) })
    await f.dispatcher.run(new Date(started+120*60_000).toISOString()); expect(send).toHaveBeenCalledTimes(6)
    const ambiguous = await fixture('base-mail-uncertain')
    send.mockRejectedValue(new Error('synthetic-secret-must-be-redacted'))
    await ambiguous.dispatcher.run()
    expect(send).toHaveBeenCalledTimes(7)
    await ambiguous.dispatcher.run(new Date(Date.now()+86400_000).toISOString())
    expect(send).toHaveBeenCalledTimes(7)
    const result = await ambiguous.services.distribution.launches.list(ambiguous.scope.workspaceId,ambiguous.flow.flowId)
    expect(result[0]).toMatchObject({status:'unknown'}); expect(JSON.stringify(result)).not.toContain('synthetic-secret-must-be-redacted')
    const interrupted = await fixture('base-mail-interrupted')
    await interrupted.services.distribution.deliveries.prepare(interrupted.delivery.id,'https://pencil.example.test')
    await interrupted.dispatcher.run(new Date(Date.now()+6*60_000).toISOString())
    expect(send).toHaveBeenCalledTimes(7)
    expect(await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(interrupted.delivery.id).first()).toEqual({status:'unknown'})
  } finally { send.mockRestore() }
})
contract(['WS-001','WS-002','DIST-004'], 'scheduled reminders wait for the stored IANA sending window while operator-triggered invitations send immediately', async () => {
  const f = await fixture('base-mail-window')
  await env.DB.prepare("UPDATE workspaces SET time_zone='Australia/Brisbane',sending_window_start='09:00',sending_window_end='17:00' WHERE id=?").bind(f.scope.workspaceId).run()
  const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null,{status:202,headers:{'X-Message-Id':'synthetic-window'}}))
  try {
    await f.dispatcher.run(); expect(send).toHaveBeenCalledTimes(1)
    const reminder = await env.DB.prepare("SELECT id FROM mail_deliveries WHERE participant_id=? AND kind='reminder'").bind(f.participant.id).first<{id:string}>()
    const due = '2027-01-02T10:00:00.000Z' // 20:00 civil time, outside the daily window.
    await env.DB.prepare('UPDATE mail_deliveries SET available_at=? WHERE id=?').bind(due,reminder!.id).run()
    await f.dispatcher.run(due); expect(send).toHaveBeenCalledTimes(1)
    expect(await env.DB.prepare('SELECT available_at,status FROM mail_deliveries WHERE id=?').bind(reminder!.id).first()).toEqual({available_at:'2027-01-02T23:00:00.000Z',status:'pending'})
    await f.dispatcher.run('2027-01-02T23:00:00.000Z'); expect(send).toHaveBeenCalledTimes(2)
    expect(await env.DB.prepare('SELECT status FROM mail_deliveries WHERE id=?').bind(reminder!.id).first()).toEqual({status:'sent'})
  } finally { send.mockRestore() }
})
