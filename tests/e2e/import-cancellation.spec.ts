import { appHeaders } from './api-headers'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'

for (const actions of [['cancel', 'review'], ['new-file', 'replacement']] as const) {
contract(['IMPORT-002', 'IMPORT-004', 'BASE-PUBLIC-003'], `publication winning pending cancellation preserves actual progress until explicit undo: ${actions.join(', ')}`, async ({ page }, info) => {
  for (const action of actions) {
    await test.step(action, async () => {
    await page.context().clearCookies();
    await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
    await signInEmptyWorkspace(page)
    const definition = JSON.stringify({ title: 'Cancellation race form', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
    const csv = 'Answer,Submit Date\n' + Array.from({ length: 201 }, (_, i) => `answer-${i},2026-09-12 10:03:00`).join('\n')
    const reviewed = await (await page.request.post('/api/app/imports/review', { headers: appHeaders, data: { definition, csv } })).json()
    const committed = await page.request.post('/api/app/imports/commit', { headers: appHeaders, data: { definition, csv, columns: reviewed.columns, plannedAt: reviewed.plannedAt, fingerprint: reviewed.fingerprint, acknowledged: true } })
    expect(committed.status()).toBe(200)
    const prepared = await committed.json()
    expect(prepared.state).toBe('preparing')
    await page.getByRole('link', { name: 'Import a form' }).click()
    await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(definition) })
    await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    const reviewResponse = page.waitForResponse(response => response.url().endsWith('/api/app/imports/review') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Review import', exact: true }).focus()
    await page.keyboard.press('Enter')
    expect((await reviewResponse).status()).toBe(200)
    await expect(page.getByText('An interrupted commit may have private import data awaiting completion. Retry the reviewed import, or Cancel to remove that private data.')).toBeVisible()
    let publishingId = prepared.id
    if (action === 'replacement') {
      const cancelled = await page.request.post('/api/app/imports/cancel-staging', { headers: appHeaders, data: { fingerprint: reviewed.fingerprint } })
      expect(await cancelled.json()).toEqual({ cancelled: true })
      const replacement = await page.request.post('/api/app/imports/commit', { headers: appHeaders, data: { definition, csv, columns: reviewed.columns, plannedAt: reviewed.plannedAt, fingerprint: reviewed.fingerprint, acknowledged: true } })
      expect(replacement.status()).toBe(200)
      publishingId = (await replacement.json()).id
      expect(publishingId).not.toBe(prepared.id)
    }
    let published = prepared
    do {
      const publication = await page.request.post(`/api/app/imports/${publishingId}/resume`, { headers: appHeaders, data: {} })
      expect(publication.status()).toBe(200)
      published = await publication.json()
    } while (published.state === 'preparing')
    expect(published.state).toBe('applying')
    expect(published.checkpoint).toBeGreaterThan(0)
    expect(published.checkpoint).toBeLessThan(published.total)
    const requests: string[] = []
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/app/imports')) requests.push(new URL(request.url()).pathname) })
    const cancellation = page.waitForResponse(response => response.url().endsWith('/api/app/imports/cancel-staging'))
    if (action === 'new-file') {
      await page.getByLabel('Form definition JSON').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ title: 'Replacement was not processed', fields: [] })) })
    } else {
      await page.getByRole('button', { name: action === 'review' ? 'Refresh mapping report' : 'Cancel', exact: true }).focus()
      await page.keyboard.press('Enter')
    }
    const result = await cancellation
    expect(result.status()).toBe(200)
    expect(await result.json()).toEqual({ cancelled: false, job: published })
    await expect(page.getByRole('alert')).toHaveText('Preparation was verified before cancellation. Inspect its progress and use Undo import to remove imported records.' + (action === 'new-file' ? ' The new file was not accepted; the current report still describes your previous files.' : ''))
    if (action === 'new-file') await expect(page.getByLabel('Form definition JSON')).toHaveValue('')
    await expect(page.getByText('Cancellation race form · 1 questions · 201 valid response rows', { exact: true })).toBeVisible()
    await expect(page.getByText('Replacement was not processed')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: `applying · ${published.checkpoint} / ${published.total}`, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue import', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Undo import', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Refresh mapping report', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Pause after this batch' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /Preparation cancelled|paused/i })).toHaveCount(0)
    if (action === 'replacement') await expect(page.getByText(prepared.id, { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`publication-won-${action}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
    expect(requests).toEqual(['/api/app/imports/cancel-staging'])
    expect(await (await page.request.get(`/api/app/imports/${publishingId}`)).json()).toEqual(published)
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Undo import', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible({ timeout: 90_000 })
    await page.reload()
    await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible()
    })
  }
})
}
