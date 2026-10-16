import { appHeaders } from './api-headers'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { expect, test } from './fixtures'

// Request-only: authenticated normal magic links; no browser/context/page fixture.
test('native removal erases delivered credentials and returns the removed operator to sessionless access', async ({ request }, info) => {
  const email = `custody-native-${info.project.name}-${Date.now()}@example.test`
  const headers = { Origin: new URL(info.project.use.baseURL!).origin }
  expect((await request.post('/auth/magic-link', { headers: appHeaders, data: { email: operatorEmail() } })).status()).toBe(202)
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  const ownerToken = inbox.messages[0].magicLinkToken
  const ownerLogin = await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: ownerToken },  maxRedirects: 0 })
  expect(ownerLogin.status()).toBe(303)
  const ownerCookie = ownerLogin.headers()['set-cookie'].split(';')[0]
  const invitation = await request.post('/api/app/operators', {  headers, data: { email, displayName: 'Synthetic custody review' } })
  expect(invitation.status()).toBe(201)
  const { id } = await invitation.json()
  const delivered = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), email)
  const messages = delivered.messages
  expect(messages).toHaveLength(1)
  expect(messages[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  const targetLogin = await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: messages[0].magicLinkToken },  maxRedirects: 0 })
  expect(targetLogin.status()).toBe(303)
  const targetCookie = targetLogin.headers()['set-cookie'].split(';')[0]
  const removal = await request.delete(`/api/app/operators/${id}`, {  headers })
  expect(removal.status()).toBe(204)
  expect((await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), email)).messages).toEqual([])
  expect((await request.get('/api/app/operators', { headers: { Cookie: targetCookie } })).status()).toBe(401)
  const privateDocument = await request.get('/app/settings', { headers: { Cookie: targetCookie }, maxRedirects: 0 })
  expect(privateDocument.status()).toBe(302)
  expect(privateDocument.headers().location).toContain('/signin')
  const retained = await request.get('/api/app/operators', { headers: { Cookie: ownerCookie } })
  expect(retained.status()).toBe(200)
  expect((await retained.json()).some((operator: { id: string }) => operator.id === id)).toBe(false)
  const oldLink = await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: messages[0].magicLinkToken },  maxRedirects: 0 })
  expect(oldLink.status()).toBe(400)
  expect(oldLink.headers()['set-cookie']).toBeUndefined()
  expect(await oldLink.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Invalid request body.' })
})
