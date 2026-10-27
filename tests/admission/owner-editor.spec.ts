import { test, expect } from '@playwright/test'
import { signInEmptyWorkspace } from '../e2e/authoring-helpers'
const edge = `http://127.0.0.1:${Number(process.env.PENCIL_E2E_PORT ?? '4173') + 1}`

test('native owner editor mounts, survives navigation, obeys framing policy and is removed on logout', async ({ page, request }, info) => {
  expect((await request.get('/api/editor/config')).status()).toBe(403)
  await signInEmptyWorkspace(page)
  const grant = await page.request.get('/api/editor/config')
  expect(grant.status()).toBe(200)
  expect(grant.headers()['cache-control']).toContain('no-store')
  const document = await page.request.get('/app')
  expect(document.headers()['content-security-policy']).toContain(`frame-ancestors 'self' ${edge}`)
  const host = page.locator('[data-rer-editor]')
  const sendEditorMessage = async (type: string, value: unknown) => {
    // Closing or navigating rotates the protocol session. Wait for the current
    // handshake before sending once; messages from the old session are refused.
    await expect(host).toHaveAttribute('data-connection', 'connected')
    await host.locator('iframe').contentFrame().locator('body').evaluate((_body, { type, value }) =>
      (window as unknown as { edgeSend: (type: string, value: unknown) => void }).edgeSend(type, value), { type, value })
  }
  await expect(host).toHaveAttribute('data-connection', 'connected')
  await host.getByRole('button', { name: 'Open Run Edit Run' }).click()
  await expect(host.locator('iframe')).toBeVisible()
  const bounds = await host.locator('iframe').boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: info.outputPath(`editor-${page.viewportSize()!.width}.png`) })
  await host.getByRole('button', { name: 'Close Run Edit Run' }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Workspace settings' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await expect(page.locator('[data-rer-editor]')).toHaveAttribute('data-connection', 'connected')
  await host.getByRole('button', { name: 'Open Run Edit Run' }).click()
  const target = await page.getByRole('heading', { name: 'Workspace settings' }).evaluate(element => {
    const parts: string[] = []
    for (let current: Element | null = element; current && current !== document.body; current = current.parentElement) {
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${Array.from(current.parentElement!.children).indexOf(current) + 1})`)
    }
    return { selector: parts.join(' > '), tag: element.tagName.toLowerCase(), role: element.getAttribute('role') ?? '', beforeText: element.textContent!.replace(/\s+/g, ' ').trim() }
  })
  const snapshot = { revision: 1, edits: [{ id: 'synthetic-pencil-edit', revision: 1, parentOrigin: new URL(page.url()).origin, path: '/app/settings', target, change: { text: 'Synthetic managed edit' } }] }
  await sendEditorMessage('live-edits', { snapshot })
  await expect(page.getByRole('heading', { name: 'Synthetic managed edit' })).toBeVisible()
  await host.getByRole('button', { name: 'Close Run Edit Run' }).click()
  await page.getByRole('link', { name: 'Flows', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/?$/)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic managed edit' })).toBeVisible()
  await host.getByRole('button', { name: 'Open Run Edit Run' }).click()
  await sendEditorMessage('undo-live-edit', { id: 'synthetic-pencil-edit', revision: 1 })
  await expect(page.getByRole('heading', { name: 'Workspace settings' })).toBeVisible()
  await host.getByRole('button', { name: 'Close Run Edit Run' }).click()
  await request.post(edge + '/deny')
  const violations: string[] = []
  page.on('console', message => { if (message.type() === 'error' && /frame-ancestors|framing/i.test(message.text())) violations.push(message.text()) })
  await page.reload()
  await expect.poll(() => violations.length).toBeGreaterThan(0)
  await request.post(edge + '/allow')
  await page.reload()
  await expect(page.locator('[data-rer-editor]')).toHaveAttribute('data-connection', 'connected')
  // Delay actual transport only: preserve the real grant bytes and let the
  // native signout reach the server after checking immediate client revocation.
  await page.evaluate(() => new Promise(requestAnimationFrame))
  let releaseGrant!: () => void, releaseSignout!: () => void, capturedGrant!: () => void
  const heldGrant = new Promise<void>(resolve => { releaseGrant = resolve })
  const heldSignout = new Promise<void>(resolve => { releaseSignout = resolve })
  const captured = new Promise<void>(resolve => { capturedGrant = resolve })
  let interceptedGrant = false
  await page.route('**/api/editor/config', async route => {
    if (interceptedGrant) { await route.continue(); return }
    interceptedGrant = true
    const response = await route.fetch()
    capturedGrant()
    await heldGrant
    await route.fulfill({ response })
  })
  // Keep interception registered while requests are held. Removing the last
  // one-shot route disables Chromium interception and continues pending requests.
  await page.route('**/auth/signout', async route => { await heldSignout; await route.continue() })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await captured
  let signingOut: Promise<void> | undefined
  try {
    signingOut = page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.locator('[data-rer-editor]')).toHaveCount(0)
    releaseGrant()
    // Observe delayed-response handling while the real logout remains in flight.
    await page.waitForTimeout(500)
    await expect(page.locator('[data-rer-editor]')).toHaveCount(0)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForTimeout(500)
    await expect(page.locator('[data-rer-editor]')).toHaveCount(0)
    expect((await page.request.get('/api/editor/config')).status()).toBe(200)
  } finally { releaseGrant(); releaseSignout() }
  await signingOut
  await expect(page).toHaveURL(/\/signin/)
  await expect(page.locator('[data-rer-editor]')).toHaveCount(0)
  expect((await page.request.get('/api/editor/config')).status()).toBe(403)
  await page.unroute('**/api/editor/config')
  await page.unroute('**/auth/signout')
})
