// The transport implementation is unchanged maintained Base source.
// @ts-expect-error Base publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'
import { productionMailSender } from './production.server'

/** With mail off every send is refused at once, so each flow records why nothing was delivered. */
const mailOff: MailSender = { send: async () => ({ status: 'rejected', provider: 'none', providerMessageId: null, code: 'mail_off' }) }

export function baseMailSender(configuration: MailConfiguration, db: D1Database): MailSender {
  if (configuration.kind === 'none') return mailOff
  return configuration.kind === 'local-development'
    ? createMailSender({ provider: 'development', mode: 'development' })
    : productionMailSender(configuration)
}
