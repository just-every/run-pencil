// The transport implementation is unchanged maintained Base source.
// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'
import { demoEffect } from '../../../base/demo/index.mjs'
// A provider/binding send completes without reaching people under RER_DEMO.

export function baseMailSender(configuration: MailConfiguration, db: D1Database): MailSender {
  const sender = configuration.kind === 'local-development'
    ? createMailSender({ provider: 'development', mode: 'development' })
    : createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey })
  return { send: message => demoEffect(() => sender.send(message), () => ({ provider: configuration.kind === 'local-development' ? 'development' : configuration.kind, status: 'accepted', providerMessageId: null })) }
}
