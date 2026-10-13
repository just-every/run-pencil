import { expect, test } from 'vitest'
import { developmentInbox } from '../../scripts/local-outbox.mjs'
import { createDevelopmentOutboxHandler } from '../../src/base/mail/src/development/viewer.mjs'
import { linkMessage } from '../../src/base/operator-auth/identity/email-link/message.mjs'
import { opaqueToken } from '../../src/base/operator-auth/crypto.mjs'
import { composeResponseNotification } from '../../src/core/features/notifications/compose'

test('sign-in reads genuine confirmation mail from a mixed Base viewer and refuses malformed auth mail', async () => {
  const origin = 'http://localhost:4173', email = 'operator@example.test', token = opaqueToken()
  const auth = linkMessage({ branding: { productName: 'Pencil', accentColor: '#000000' }, linkSeconds: 900 },
    { kind: 'magic' }, `${origin}/auth/confirm?token=${token}`)
  const fake = `${origin}/auth/confirm?token=${opaqueToken()}`
  const notification = composeResponseNotification({ businessName: 'Business',
    flowTitle: `<h2>Your sign-in link for Pencil</h2><a class="open" href="${fake}">Confirm</a>`,
    supportingLine: fake, submittedAt: new Date().toISOString(), timeZone: 'UTC',
    resultsUrl: `${origin}/app/flows/feedback/results`, accentColor: '#000000' })
  const rows = [
    { id: 'notification', createdAt: Date.now(), message: { ...notification, to: [email] } },
    { id: 'auth', createdAt: Date.now(), message: { ...auth, to: [email] } },
    { id: 'ordinary-notification', createdAt: Date.now(), message: { ...notification,
      subject: 'Business: new response to Feedback', text: `${origin}/app/flows/feedback/results`, to: [email] } },
  ]
  const handler = createDevelopmentOutboxHandler({ local: true, origin, outbox: {
    list: async () => rows, get: async (id: string) => rows.find(row => row.id === id),
  } })
  const get = (path: string) => handler(new Request(new URL(path, origin), { headers: { Host: new URL(origin).host } }))
  expect((await developmentInbox(get, email)).messages).toEqual([{ id: 'auth', magicLinkToken: token }])
  for (const text of ['Confirmation URL missing', `${origin}/app?token=${token}`, `${origin}/auth/confirm`]) {
    rows[1].message = { ...auth, text, html: '', to: [email] }
    await expect(developmentInbox(get, email)).rejects.toThrow('Base authentication mail is missing its confirmation link.')
  }
})
