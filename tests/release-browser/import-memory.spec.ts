import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '../e2e/fixtures'
import { signInEmptyWorkspace } from '../e2e/authoring-helpers'

test( 'the complete admitted invalid report remains bounded and navigable in the browser', async ({ page }, info) => {
  info.setTimeout(300000)
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  await page.getByRole('link', { name: 'Import a form' }).click()
  const width = 49, rows = 85000
  const definition = JSON.stringify({ title: 'Complete invalid response report', fields: Array.from({ length: width }, (_, index) => ({ ref: `q${index}`, title: `q${index}`, type: 'yes_no' })) })
  const csv = Array.from({ length: width }, (_, index) => `q${index}`).join(',') + '\n' + Array.from({ length: rows }, () => Array(width).fill('x').join(',')).join('\n')
  expect(Buffer.byteLength(definition) + Buffer.byteLength(csv)).toBeLessThanOrEqual(8 * 1024 * 1024)
  const client = await page.context().newCDPSession(page)
  const samples: { usedSize: number; totalSize: number; embedderHeapUsedSize?: number; backingStorageSize?: number }[] = []
  let sampling: Promise<void> | undefined
  const sample = async () => { samples.push(await client.send('Runtime.getHeapUsage')) }
  await sample()
  const timer = setInterval(() => { if (!sampling) sampling = sample().finally(() => { sampling = undefined }) }, 100)
  try {
    await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(definition) })
    await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.getByRole('button', { name: 'Review import', exact: true }).click()
    const errors = page.getByRole('region', { name: 'Every row error (4250000)' })
    await expect(errors).toBeVisible({ timeout: 240000 })
    await expect(errors.getByRole('listitem')).toHaveCount(100)
    await expect(errors.getByText('Row 2, q0: Use 1/0 or true/false.', { exact: true })).toBeVisible()
    await errors.getByRole('button', { name: 'Last errors' }).click()
    await expect(errors.getByText('Row 85001, Submission time: Map a nonempty original submission timestamp; times are never invented.', { exact: true })).toBeVisible()
    await expect(errors.getByRole('listitem')).toHaveCount(100)
    await errors.getByRole('button', { name: 'First errors' }).click()
    await errors.getByRole('button', { name: 'Next errors' }).click()
    await expect(errors.getByText('Row 4, q0: Use 1/0 or true/false.', { exact: true })).toBeVisible()
    await errors.getByLabel('Find row').fill('40000')
    await errors.getByRole('button', { name: 'Find errors', exact: true }).click()
    await expect(errors.getByText('Row 40000, q0: Use 1/0 or true/false.', { exact: true })).toBeVisible()
    await expect(errors.getByRole('listitem')).toHaveCount(100)
    await client.send('HeapProfiler.collectGarbage')
    await sample()
    const retained = samples.at(-1)!
    expect(retained.usedSize + (retained.backingStorageSize ?? 0) + (retained.embedderHeapUsedSize ?? 0)).toBeLessThan(128 * 1024 * 1024)
    expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([])
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath('complete-wide-row-errors.png'), fullPage: true })
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await (await page.request.get('/api/app/imports')).json()).toEqual([])
  } finally {
    clearInterval(timer); await sampling
    await info.attach('browser-heap-numeric-samples', { body: JSON.stringify(samples), contentType: 'application/json' })
    await client.detach()
  }
})

