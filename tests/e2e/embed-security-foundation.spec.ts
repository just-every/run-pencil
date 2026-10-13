import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, test } from './fixtures'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.12' } })
contract(['DIST-009', 'BASE-PUBLIC-002', 'BASE-PUBLIC-001'], 'even an allowed same-origin host cannot read embedded answers, credentials or completion receipts', async ({ page, request }, info) => {
  const origin = new URL(info.project.use.baseURL!).origin
  await request.post('/auth/magic-link', { headers: { Origin: origin }, data: { email: operatorEmail() } })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), operatorEmail())
  await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
  const workspace = await request.get('/api/app/workspace').then(r => r.json())
  expect((await request.put('/api/app/workspace', { headers: { Origin: origin }, data: { timeZone: workspace.timeZone, sendingWindowStart: workspace.sendingWindowStart, sendingWindowEnd: workspace.sendingWindowEnd, embedAllowedOrigins: [origin] } })).status()).toBe(200)
  await page.route('**/foundation-embed-host', route => route.fulfill({ contentType: 'text/html', body: `<h1>Authorized synthetic host</h1><script>window.messages=[];addEventListener('message', e=>window.messages.push(e.data))</script><iframe title="Feedback" src="${origin}/embed/aurora-coffee-post-visit"></iframe>` }))
  const outgoing: string[] = []
  page.on('request', r => outgoing.push(new URL(r.url()).origin))
  await page.goto('/foundation-embed-host')
  const frame = page.frameLocator('iframe')
  await expect(frame.getByRole('button', { name: 'Begin', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull()
  expect(await page.evaluate(() => { try { void document.querySelector('iframe')!.contentWindow!.document.body; return false } catch { return true } })).toBe(true)
  await frame.getByRole('button', { name: 'Begin', exact: true }).click()
  await frame.getByRole('radio', { name: '5 out of 5' }).click()
  await frame.getByRole('button', { name: 'Continue', exact: true }).click()
  await frame.getByRole('radio', { name: 'The coffee', exact: true }).click()
  await frame.getByRole('button', { name: 'Submit response', exact: true }).click()
  await expect(frame.getByRole('heading', { name: 'Thank you for your feedback.' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { messages: unknown[] }).messages)).toEqual([])
  expect(page.url()).toBe(`${origin}/foundation-embed-host`)
  expect(await page.locator('iframe').getAttribute('src')).toBe(`${origin}/embed/aurora-coffee-post-visit`)
  expect([...new Set(outgoing)]).toEqual([origin])
  expect(await page.context().cookies()).toEqual([])
  for (const path of ['/api/app/dashboard', '/_serverFn/nonexistent']) {
    const privateResponse = await request.get(path, { headers: { Origin: 'null' } })
    expect(privateResponse.headers()['access-control-allow-origin']).toBeUndefined()
  }
  for (const referer of ['https://hostile.invalid/page', `${origin}.hostile.invalid/page`, '']) {
    const response = await request.get('/embed/aurora-coffee-post-visit', { headers: { Referer: referer, 'Sec-Fetch-Dest': 'iframe' } })
    expect(response.status()).toBe(403)
    expect(await response.text()).not.toContain('Aurora')
  }
})
