// The transport implementation is unchanged maintained Base source.
// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'

export function baseMailSender(configuration: MailConfiguration, db: D1Database): MailSender {
  return configuration.kind === 'local-development'
    ? createMailSender({ provider: 'development', mode: 'development' })
    : createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey })
}
