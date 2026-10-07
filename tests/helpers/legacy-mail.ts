import type { LocalDevelopmentInbox, MagicLinkMessage, MailSender } from './legacy-mail-types'

function tokenFromMagicLink(url: string) {
  const token = new URL(url).pathname.split('/').at(-1)
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error('A local magic link must contain an opaque 32-byte hexadecimal token.')
  }
  return token
}

/**
 * A test-only delivery target. This is constructed only after the runtime has
 * established a loopback request and PENCIL_LOCAL_DEVELOPMENT=true.
 */
export class LocalDevelopmentMailSender implements MailSender {
  readonly delivery = 'local' as const

  constructor(private readonly inbox: LocalDevelopmentInbox) {}

  async sendMagicLink(message: MagicLinkMessage) {
    const now = new Date().toISOString()
    await this.inbox.addLocalInboxMessage({
      id: message.deliveryIdempotencyKey,
      toEmail: message.to,
      magicLinkToken: tokenFromMagicLink(message.magicLinkUrl),
      expiresAt: message.expiresAt,
      createdAt: now,
    })
    return { kind: 'confirmed' as const }
  }
}
