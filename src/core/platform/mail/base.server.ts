// The transport implementation is unchanged maintained Base source.
// @ts-expect-error Base IF-056 publishes JavaScript without TypeScript declarations.
import { createMailSender } from '../../../base/mail/index.mjs'
import type { MailMessage, MailSender } from '../../../base/operator-auth/index.mjs'
import type { MailConfiguration } from './index'

export function baseMailSender(configuration: MailConfiguration, db: D1Database): MailSender {
  if (configuration.kind !== 'local-development') return createMailSender({ provider: configuration.kind, mode: 'production', apiKey: configuration.apiKey })
  return createMailSender({ provider: 'development', mode: 'development' }, { outbox: {
    async put(message: MailMessage) {
      const now = new Date().toISOString()
      // Authentication messages are stored only while their credential is live.
      // A delayed provider completion cannot restore an erased operator's data.
      const url = message.text.match(/http[^\s]+\/auth\/confirm\?token=[^\s]+/)?.[0]
      if (url) {
        const token = new URL(url).searchParams.get('token')!
        const result = await db.prepare(`INSERT INTO local_dev_inbox(id,to_email,magic_link_token,expires_at,created_at)
          SELECT t.id,o.email,?,strftime('%Y-%m-%dT%H:%M:%fZ',t.expires_at/1000.0,'unixepoch'),?
          FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id
          WHERE t.id=? AND t.revoked_at IS NULL AND t.consumed_at IS NULL AND t.expires_at>?
          ON CONFLICT(id) DO NOTHING`).bind(token,now,message.deliveryId,Date.now()).run()
        if (!result.meta.changes && !await db.prepare('SELECT id FROM local_dev_inbox WHERE id=? AND magic_link_token=?').bind(message.deliveryId,token).first()) throw new Error('The local sign-in credential is no longer deliverable.')
      } else {
        const result = await db.prepare(`INSERT INTO local_mail_outbox(delivery_id,message_json,created_at)
          SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM mail_deliveries WHERE idempotency_key=? AND status='sending')
          ON CONFLICT(delivery_id) DO NOTHING`).bind(message.deliveryId,JSON.stringify(message),now,message.deliveryId).run()
        if (!result.meta.changes && !await db.prepare('SELECT delivery_id FROM local_mail_outbox WHERE delivery_id=?').bind(message.deliveryId).first()) throw new Error('The local delivery is no longer claimed.')
      }
    },
  } })
}
