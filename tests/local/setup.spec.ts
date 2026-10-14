import { expect, test } from '@playwright/test'
// @ts-expect-error Test fixture drives the real public CLI in an isolated copy.
import { installation } from '../helpers/rer-installation.mjs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
// A business website on another loopback origin that pastes the owner's saved script snippet.
async function websiteWith(snippet: string) {
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html', 'Referrer-Policy': 'origin' }); response.end(`<!doctype html><html lang="en"><head><title>Business website</title></head><body><main><h1>Customer feedback</h1>${snippet}</main></body></html>`) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, close: () => new Promise(resolve => server.close(resolve)) }
}
test('fresh rer owner finishes setup before hydration, then collects a response through the saved script embed at both widths', async ({ browser }, info) => {
  test.setTimeout(420_000)
  const app = await installation()
  const viewport = info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport })
  const opened = [context]
  let runtime, host
  try {
    const setup = await app.run(['setup', '--owner-email', 'synthetic-setup@example.test', '--owner-name', 'Synthetic owner', '--port', String(app.port)])
    expect(setup.code).toBe(0)
    // The outbox opens only for a request that holds this checkout's key; a person gets it from the RER_OPEN link, this journey presents it as the CLI does.
    const key = /^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(app.root, '.rer/local/dev-key.env'), 'utf8'))![1]
    await context.route(app.origin + '/__dev/**', route => route.continue({ headers: { ...route.request().headers(), 'x-rer-dev-key': key } }))
    // This copy links the checkout's node_modules from outside its root, so Vite serves those modules through /@fs/,
    // which rer dev answers only with the checkout's key; a real checkout serves them under its own root.
    const linkedModules = (each: typeof context) => each.route(app.origin + '/@fs/**', route => route.continue({ headers: { ...route.request().headers(), 'x-rer-dev-key': key } }))
    // Prove native forms against the emitted Worker, before client hydration or Vite's dependency reloads.
    runtime = app.start(['preview', '--port', String(app.port)]); await app.wait(runtime)
    const page = await context.newPage()
    await page.goto(app.origin + '/setup'); await expect(page).toHaveURL(app.origin + '/signin')
    await page.goto(app.origin + '/__dev/outbox')
    await page.getByRole('link', { name: 'Read message' }).first().click()
    await page.getByRole('link', { name: 'Open this link' }).click()
    const confirmation = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/auth/confirm')
    await page.getByRole('button', { name: 'Confirm' }).click(); expect((await confirmation).status()).toBe(303)
    await expect(page).toHaveURL(app.origin + '/setup')
    await page.goto(app.origin + '/app/settings'); await expect(page).toHaveURL(app.origin + '/setup')
    await expect(page.getByLabel('Business name')).toBeEnabled()
    await page.getByLabel('Business name').fill('Synthetic first-run business')
    await page.getByLabel('Time zone', { exact: true }).fill('Australia/Brisbane')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const completed = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/setup')
    await page.getByRole('button', { name: 'Finish setup' }).click(); expect((await completed).status()).toBe(303)
    await expect(page).toHaveURL(app.origin + '/app')
    await page.goto(app.origin + '/setup'); await expect(page).toHaveURL(app.origin + '/app')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await app.stop(runtime)
    runtime = app.start(['dev', '--port', String(app.port)]); await app.wait(runtime)
    // Under rer dev the product pages hydrate, and so does the sandboxed (Origin: null) embed on an allowed loopback host.
    const headers = { Origin: app.origin }
    const flow = await page.request.post(app.origin + '/api/app/flows', { headers, data: { title: 'Local embed', slug: 'local-embed', template: 'feedback' } }).then(r => r.json())
    const draft = await page.request.get(`${app.origin}/api/app/flows/${flow.id}/draft`).then(r => r.json())
    expect((await page.request.post(`${app.origin}/api/app/flows/${flow.id}/publish`, { headers, data: { expectedVersion: draft.flow.draftVersion } })).status()).toBe(201)
    const ownerContext = await browser.newContext({ storageState: await context.storageState(), viewport }); opened.push(ownerContext); await linkedModules(ownerContext)
    const owner = await ownerContext.newPage()
    await owner.goto(`${app.origin}/app/flows/${flow.id}/builder`)
    // An unhydrated builder renders Share disabled; fail promptly instead of at the test deadline.
    await owner.getByRole('button', { name: 'Share', exact: true }).click({ timeout: 60_000 })
    host = await websiteWith(await owner.getByRole('textbox', { name: 'Script embed', exact: true }).inputValue())
    const workspace = await page.request.get(app.origin + '/api/app/workspace').then(r => r.json())
    expect((await page.request.put(app.origin + '/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: [host.origin] } })).status()).toBe(200)
    const visitorContext = await browser.newContext({ viewport }); opened.push(visitorContext); await linkedModules(visitorContext)
    const visitor = await visitorContext.newPage()
    await visitor.goto(host.origin)
    const frame = visitor.frameLocator('iframe')
    await expect(frame.locator('main[data-hydrated="true"]')).toBeVisible()
    await frame.getByRole('radio', { name: 'Great', exact: true }).click()
    await frame.getByRole('button', { name: 'Continue', exact: true }).click()
    await frame.getByRole('textbox', { name: 'What could we do better?' }).fill('Answered through the local embed.')
    await visitor.waitForTimeout(3100)
    await frame.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(frame.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    await owner.goto(`${app.origin}/app/flows/${flow.id}/results`)
    await expect(owner.getByText('Answered through the local embed.').first()).toBeVisible()
  } finally { for (const each of opened) await each.close(); await host?.close(); if (runtime) await app.stop(runtime); await app.close() }
})
