import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error Maintained Base JavaScript module.
import { createMailSender } from '../../../base/mail/index.mjs'

const message = {
  from: 'Pencil <no-reply@example.com>',
  to: ['operator@example.com'],
  subject: 'Sign in',
  text: 'Use the confirmation link.',
  deliveryId: 'auth_magic_link/01K4Y1NH8N5DGBZX7HBDV00PEN',
}

describe('Resend mail sender', () => {
  it('uses Resend’s documented endpoint and idempotency header', async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ id: 'provider-message-id' }, { status: 200 }))
    const sender = createMailSender({ provider: 'resend', mode: 'test', apiKey: 'secret-not-in-message' }, { fetch: send })

    await expect(sender.send(message)).resolves.toEqual({ status: 'accepted', provider: 'resend', providerMessageId: 'provider-message-id' })
    expect(send).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer secret-not-in-message',
        'Idempotency-Key': message.deliveryId,
      }),
    }))
  })

  it('separates terminal provider rejection from an uncertain server failure that cannot be resent automatically', async () => {
    const terminal = createMailSender({ provider: 'resend', mode: 'test', apiKey: 'configured' }, { fetch: vi.fn().mockResolvedValue(new Response('', { status: 422 })) })
    const retryable = createMailSender({ provider: 'resend', mode: 'test', apiKey: 'configured' }, { fetch: vi.fn().mockResolvedValue(new Response('', { status: 503 })) })

    await expect(terminal.send(message)).resolves.toMatchObject({ status: 'rejected' })
    await expect(retryable.send(message)).resolves.toMatchObject({ status: 'uncertain' })
  })
})
