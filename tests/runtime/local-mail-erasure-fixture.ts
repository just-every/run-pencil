import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { DistributionDispatcher } from '../../src/core/features/distribution/dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { foundationFixture } from './foundation-fixture'

export type MailParticipant = { id: string; token: string; opt_out_token: string; email_snapshot: string }

export async function localMailErasureFixture(slug: string) {
  const f = await foundationFixture(slug)
  await f.services.workspace.updateSettings({ ...f.scope, timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })
  await f.add({ kind: 'question', questionType: 'short_text', prompt: 'Feedback', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Recorded' })
  await f.publish()
  const contact = await f.services.distribution.contacts.save(f.scope.workspaceId, {
    name: 'Synthetic mail recipient', email: `${slug}@example.test`,
  }) as { id: string }
  const sender = baseMailSender({ kind: 'local-development' }, env.DB)
  const dispatcher = new DistributionDispatcher(env.DB, f.services.distribution.deliveries, sender,
    'http://localhost', 'no-reply@pencil.test')
  const launch = async (contactId = contact.id) => {
    const launched = await f.services.distribution.launches.launch({ ...f.flow, operatorId: f.operatorId,
      contactIds: [contactId], commandKey: crypto.randomUUID() })
    return (await env.DB.prepare('SELECT id, token, opt_out_token, email_snapshot FROM invitation_participants WHERE launch_id = ?')
      .bind(launched.id).first<MailParticipant>())!
  }
  const mail = async (participant: MailParticipant) => (await env.DB.prepare(`SELECT o.delivery_id, o.message_json FROM local_mail_outbox o
    JOIN mail_deliveries d ON d.idempotency_key = o.delivery_id WHERE d.participant_id = ? ORDER BY o.delivery_id`)
    .bind(participant.id).all<{ delivery_id: string; message_json: string }>()).results
  const send = async (participant: MailParticipant, reminder = false) => {
    await dispatcher.run()
    if (reminder) {
      // Release the real scheduled reminder inside the workspace's UTC sending window.
      const due = new Date(Date.now() + 3 * 86400_000); due.setUTCHours(12, 0, 0, 0)
      await dispatcher.run(due.toISOString())
    }
    const messages = await mail(participant)
    expect(messages).toHaveLength(reminder ? 2 : 1)
    for (const message of messages) {
      const body = JSON.parse(message.message_json)
      expect(body.to).toEqual([participant.email_snapshot])
      expect(body.text).toContain(`/i/${participant.token}`)
      expect(body.text).toContain(`/optout/${participant.opt_out_token}`)
    }
    return messages
  }
  const complete = async (participant?: MailParticipant, quarantine = false) => {
    const session = await f.services.responses.startPublicSession({ slug, deviceClass: 'mobile', source: 'direct',
      invitationToken: participant?.token })
    if (quarantine) await env.DB.prepare('UPDATE respondent_sessions SET created_at = ? WHERE id = ?')
      .bind(new Date(Date.now() + 5000).toISOString(), session.sessionId).run()
    else await f.mature(session.sessionId)
    const receipt = await f.final(session, [{ stepId: session.flow.steps[0].id, value: 'Synthetic private feedback' }], '', participant?.token)
    expect(receipt.disposition).toBe(quarantine ? 'quarantined' : 'released')
    expect(await env.DB.prepare('SELECT state, participant_id FROM responses WHERE id = ?').bind(receipt.responseId).first())
      .toEqual({ state: receipt.disposition, participant_id: participant?.id ?? null })
    return { ...f.scope, operatorId: f.operatorId, responseId: receipt.responseId }
  }
  const erasedParticipant = async (participant: MailParticipant) => {
    expect(await mail(participant)).toEqual([])
    expect((await env.DB.prepare(`SELECT delivery_id FROM local_mail_outbox
      WHERE instr(message_json, ?) > 0 OR instr(message_json, ?) > 0`)
      .bind(participant.token, participant.opt_out_token).all()).results).toEqual([])
    expect(await env.DB.prepare(`SELECT contact_id, email_snapshot, name_snapshot, token, opt_out_token
      FROM invitation_participants WHERE id = ?`).bind(participant.id).first()).toEqual({
      contact_id: null, email_snapshot: null, name_snapshot: null, token: null, opt_out_token: null,
    })
    expect((await env.DB.prepare(`SELECT reason, provider_id FROM mail_deliveries WHERE participant_id = ?`)
      .bind(participant.id).all()).results.every(row => row.reason === null && row.provider_id === null)).toBe(true)
    await expect(f.services.responses.invitationFlow(participant.token)).rejects.toThrow('no longer available')
    await expect(f.services.distribution.contacts.optOut(participant.opt_out_token)).rejects.toThrow('no longer available')
  }
  return { ...f, contact, launch, mail, send, complete, erasedParticipant, sender }
}
