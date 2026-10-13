// The transport implementation is unchanged maintained Base source.
// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'
import { guardedDevelopmentOutbox, type DevelopmentCaptureClaim } from './development.server'

export function baseMailSender(configuration: MailConfiguration, db: D1Database, additionalClaim?: DevelopmentCaptureClaim): MailSender {
  if (configuration.kind !== 'local-development') return createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey })
  return createMailSender({ provider: 'development', mode: 'development' }, { outbox: guardedDevelopmentOutbox(db, additionalClaim) })
}
