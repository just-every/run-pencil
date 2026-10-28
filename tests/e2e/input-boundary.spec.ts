import { appHeaders } from './api-headers'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { expect, test } from './fixtures'

// Request-only: no page, browser or browser-context fixture is constructed.
test('native public input failures use safe 400 JSON and retain read-only invalid-link rejection', async ({ request }) => {
  for (const [path, data] of [
    ['/auth/magic-link', { email: 'private-secret' }],
    ['/api/public/flows/aurora-coffee-post-visit/sessions', { deviceClass: 'private-secret' }],
    ['/api/public/flows/aurora-coffee-post-visit/sessions/advance', { sessionId: 'session', sessionToken: 'private-secret', stepId: 'step' }],
    ['/api/public/flows/aurora-coffee-post-visit/responses', { sessionId: 'session', sessionToken: 'x'.repeat(64), idempotencyKey: 'synthetic-native-input-key', answers: [{ stepId: 'step', value: { unexpected: { nested: 'private-secret' } } }] }],
  ] as const) {
    const response = await request.post(path, { headers: appHeaders, data })
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: expect.any(String) })
    expect(await response.text()).not.toContain('private-secret')
  }
  const malformed = await request.post('/auth/magic-link', { headers: { ...appHeaders, 'Content-Type': 'application/json' }, data: '{"private-secret":' })
  expect(malformed.status()).toBe(400)
  expect(await malformed.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Invalid request body.' })
  for (const path of ['/api/public/flows/not%20a%20slug']) {
    const response = await request.get(path)
    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
  }
  expect((await request.get('/auth/local-inbox?email=private-secret')).status()).toBe(404)
  const invalid = await request.get('/auth/confirm?token=invalid-token', { maxRedirects: 0 })
  expect(invalid.status()).toBe(400)
  expect(invalid.headers()['set-cookie']).toBeUndefined()
  expect(await invalid.text()).toContain('invalid or expired')
})
