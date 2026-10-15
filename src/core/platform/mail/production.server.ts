// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'

export function productionMailSender(configuration: Exclude<MailConfiguration, { kind: 'local-development' }>): MailSender {
  const sender = createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey,
    ...(configuration.kind === 'rer' ? { relayUrl: configuration.relayUrl } : {}) })
  if (configuration.kind !== 'rer') return sender
  // Pencil's private queue claims stay local. Base validates and serializes
  // Auto-Submitted and unsubscribe headers supported by the Managed relay.
  return { send(message) {
    const headers = Object.fromEntries(Object.entries(message.headers ?? {}).filter(([name]) =>
      !/^X-Pencil-(?:Notification-(?:Attempt|Claim)|Digest-(?:Attempt|Claim|Count))$/i.test(name)))
    return sender.send({ ...message, headers })
  } }
}
