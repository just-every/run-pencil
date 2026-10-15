// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'

export function productionMailSender(configuration: Exclude<MailConfiguration, { kind: 'local-development' }>): MailSender {
  const sender = createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey,
    ...(configuration.kind === 'rer' ? { relayUrl: configuration.relayUrl } : {}) })
  if (configuration.kind !== 'rer') return sender
  // Pencil's delivery/claim headers stay in its durable queue. The Managed
  // relay accepts message content only; Base owns serialization and transport.
  return { send(message) {
    const { headers: _headers, ...content } = message
    return sender.send(content)
  } }
}
