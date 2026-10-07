import { expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
// @ts-expect-error Maintained Base JavaScript module.
import { createMailSender } from '../../../base/mail/index.mjs'
contract(['BASE-INPUT-002','BASE-SECRET-001'], 'mail text stays literal and text-only output cannot create HTML elements without including the credential', async () => {
  const send = vi.fn().mockResolvedValue(Response.json({ id: 'synthetic' }))
  const sender = createMailSender({ provider: 'resend', mode: 'test', apiKey: 'synthetic-only-secret' }, { fetch: send })
  const url = 'https://pencil.example.test/auth/magic-links/"<script>alert(1)</script><img src=x>'
  await sender.send({ from: 'no-reply@example.test', to: ['synthetic@example.test'], subject: 'Sign in', text: url, deliveryId: 'synthetic-key' })
  const body = JSON.parse(send.mock.calls[0][1].body)
  expect(body.text).toContain(url)
  expect(body.html).toBeUndefined()
  expect(Object.keys(body).sort()).toEqual(['from', 'headers', 'subject', 'text', 'to'])
  expect(JSON.stringify(body)).not.toContain('synthetic-only-secret')
})
