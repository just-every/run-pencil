import { expect, test } from './fixtures'
import { contract } from './contract'
import { browserLogo, checkBrand, logo, missingLandingSelection, signInBrand } from './brand-helpers'

contract(['BRAND-001', 'HOME-001', 'BASE-PUBLIC-003'], 'saved business branding persists across preview, direct, embed, completion, closure and root, with complete logo removal', async ({ page }, info) => {
  test.setTimeout(300_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await signInBrand(page)
  const original = await page.request.get('/api/app/brand').then(r => r.json())
  const originalLogo = original.logoVersion ? await page.request.get(`/api/public/brand/logo?v=${original.logoVersion}`).then(r => r.body()) : null
  const headers = { Origin: process.env.PENCIL_E2E_BASE_URL! }
  let flowId: string | undefined
  try {
    const created = await page.request.post('/api/app/flows', { headers, data: { title: 'Studio feedback', slug: `studio-${crypto.randomUUID().slice(0, 8)}`, template: 'feedback' } }).then(r => r.json())
    flowId = created.id
    const draft = await page.request.get(`/api/app/flows/${flowId}/draft`).then(r => r.json())
    expect((await page.request.post(`/api/app/flows/${flowId}/publish`, { headers, data: { expectedVersion: draft.flow.draftVersion } })).status()).toBe(201)
    await page.goto('/app/settings')
    await page.getByLabel('Business name', { exact: true }).fill('North Studio')
    await page.getByLabel('Supporting line').fill('Tell us what would help.')
    await page.getByLabel('Accent colour').fill('#757575')
    await page.getByLabel('Public landing flow').selectOption(created.slug)
    await page.getByRole('button', { name: 'Save business branding' }).click()
    await expect(page.getByText('Business branding saved.', { exact: true })).toBeVisible()
    await page.getByLabel('Business logo', { exact: true }).setInputFiles({ name: 'brand.png', mimeType: 'image/png', buffer: await browserLogo(page) })
    await expect(page.getByText('Business logo saved.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('North Studio')
    await expect(page.getByText(/Digests are deferred/)).toHaveCount(0)
    await checkBrand(page)
    // Browser-generated rasters prove each accepted type actually decodes.
    for (const mime of ['image/jpeg', 'image/webp']) {
      const bytes = await browserLogo(page, mime)
      await page.getByLabel('Business logo', { exact: true }).setInputFiles({ name: mime === 'image/jpeg' ? 'brand.jpg' : 'brand.webp', mimeType: mime, buffer: bytes })
      await expect(page.getByText('Business logo saved.', { exact: true })).toBeVisible()
      await checkBrand(page)
    }
    for (const invalid of [{ name: 'wrong.jpg', mimeType: 'image/jpeg', buffer: logo }, { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg onload="alert(1)"/>') }, { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(262145) }]) {
      await page.getByLabel('Business logo', { exact: true }).setInputFiles(invalid)
      await expect(page.getByRole('alert')).toBeVisible()
      await checkBrand(page)
    }
    await page.goto(`/app/flows/${flowId}/builder`)
    await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
    await checkBrand(page)
    // These distinct state chains each load the complete real document/assets.
    // Respect the unchanged public rate window rather than resetting its ledger.
    await page.waitForTimeout(60_100)
    for (const path of ['/', `/f/${created.slug}`, `/embed/${created.slug}`]) {
      await page.goto(path)
      await checkBrand(page)
      expect(await page.locator('main').innerText()).not.toMatch(/aurora|cafe/i)
      await page.screenshot({ path: info.outputPath(`${info.project.name}-brand-${path === '/' ? 'root' : path.split('/')[1]}.png`), fullPage: true })
    }
    await page.goto(`/f/${created.slug}`)
    await page.getByRole('radio', { name: 'Great', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What could we do better?' }).fill('A private suggestion.')
    await page.waitForTimeout(3100)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    await checkBrand(page)
    expect((await page.request.post(`/api/app/flows/${flowId}/close`, { headers })).status()).toBe(204)
    await page.waitForTimeout(60_100)
    for (const path of ['/', `/f/${created.slug}`, `/embed/${created.slug}`]) { await page.goto(path); await expect(page.getByRole('heading', { name: 'This feedback flow is closed.' })).toBeVisible(); await checkBrand(page) }
    await page.goto('/app/settings')
    await page.getByRole('button', { name: 'Remove business logo' }).click()
    await expect(page.getByText('Business logo removed.', { exact: true })).toBeVisible()
    await page.waitForTimeout(60_100)
    for (const path of ['/', `/f/${created.slug}`, `/embed/${created.slug}`, `/app/flows/${flowId}/builder`]) {
      await page.goto(path)
      if (path.includes('/builder')) await page.getByRole('button', { name: 'Preview draft', exact: true }).click()
      await expect(page.locator('.brand-identity')).toContainText('North Studio')
      await expect(page.getByRole('img', { name: 'North Studio logo' })).toHaveCount(0)
      await checkBrand(page, 'rgb(117, 117, 117)', false)
    }
    expect((await page.request.post(`/api/app/flows/${flowId}/reopen`, { headers })).status()).toBe(204)
    await page.goto(`/f/${created.slug}`)
    await expect(page.getByRole('img', { name: 'North Studio logo' })).toHaveCount(0)
    await checkBrand(page, 'rgb(117, 117, 117)', false)
    await page.getByRole('radio', { name: 'Great', exact: true }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByRole('textbox', { name: 'What could we do better?' }).fill('Another private suggestion.')
    await page.waitForTimeout(3100)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    await expect(page.locator('.brand-identity')).toContainText('North Studio')
    await expect(page.getByRole('img', { name: 'North Studio logo' })).toHaveCount(0)
    await checkBrand(page, 'rgb(117, 117, 117)', false)
    expect((await page.request.post(`/api/app/flows/${flowId}/close`, { headers })).status()).toBe(204)
    expect((await page.request.post(`/api/app/flows/${flowId}/archive`, { headers })).status()).toBe(204)
    expect((await page.goto('/'))!.status()).toBe(404)
    missingLandingSelection()
    expect((await page.goto('/'))!.status()).toBe(404)
    expect((await page.request.put('/api/app/brand', { headers, data: { name: 'North Studio', supportingLine: '', accent: '#757575', publicFlowSlug: null } })).status()).toBe(200)
    expect((await page.goto('/'))!.status()).toBe(200)
    // With no selected form the root is the shared Lobby, for the claimed installation.
    await expect(page.locator('html')).toHaveAttribute('data-state', 'claimed')
  } finally {
    const { name, supportingLine, accent, publicFlowSlug } = original
    await page.request.put('/api/app/brand', { headers, data: { name, supportingLine, accent, publicFlowSlug } })
    if (originalLogo) await page.request.put('/api/app/brand/logo', { headers: { ...headers, 'Content-Type': 'image/png' }, data: originalLogo })
    else await page.request.delete('/api/app/brand/logo', { headers })
  }
})
