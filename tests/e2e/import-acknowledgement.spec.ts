import { appHeaders } from './api-headers'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { importNativeInventory } from './import-native-inventory'
import type { LedgerResponse } from '../../src/core/app/api'

contract(['IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'BASE-PUBLIC-003'], 'native acknowledgement waits across history reload with zero resume requests until keyboard continuation completes the exact import', async ({ page }, info) => {
  test.setTimeout(180_000)
  await page.setViewportSize(info.project.name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
  await signInEmptyWorkspace(page)
  const baseline = importNativeInventory()
  const definition = JSON.stringify({ title: 'Acknowledged response import', fields: [{ ref: 'answer', title: 'Answer', type: 'short_text' }] })
  const values = Array.from({ length: 201 }, (_, index) => `acknowledged-${index}`)
  const csv = 'Answer,Submit Date\n' + values.map(value => `${value},2026-09-12 10:03:00`).join('\n')
  const resumes: string[] = []
  page.context().on('request', request => {
    if (request.method() === 'POST' && /\/api\/app\/imports\/[^/]+\/resume$/.test(new URL(request.url()).pathname)) resumes.push(new URL(request.url()).pathname)
  })
  const check = async (name: string) => {
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  }
  await page.getByRole('link', { name: 'Import a form' }).click()
  await page.getByLabel('Form definition JSON').setInputFiles({ name: 'form.json', mimeType: 'application/json', buffer: Buffer.from(definition) })
  await page.getByLabel('Response CSV (optional)').setInputFiles({ name: 'responses.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  const reviewed = page.waitForResponse(response => response.url().endsWith('/api/app/imports/review') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Review import', exact: true }).focus()
  await page.keyboard.press('Enter')
  const reviewResponse = await reviewed
  expect(reviewResponse.status()).toBe(200)
  const { review } = JSON.parse((await reviewResponse.text()).split('\n')[0]) as { review: { flowId: string; fingerprint: string } }
  await expect(page.getByText('Acknowledged response import · 1 questions · 201 valid response rows', { exact: true })).toBeVisible()
  expect(importNativeInventory()).toEqual(baseline)
  await page.getByRole('checkbox').focus()
  await page.keyboard.press('Space')
  const committed = page.waitForResponse(response => response.url().endsWith('/api/app/imports/commit') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Import reviewed form', exact: true }).focus()
  await page.keyboard.press('Enter')
  const commitResponse = await committed
  expect(commitResponse.status()).toBe(200)
  const prepared = await commitResponse.json()
  expect(prepared).toMatchObject({ state: 'preparing', checkpoint: 0, total: 202, error: null, expectedFingerprint: review.fingerprint })
  expect(prepared).not.toHaveProperty('fingerprint')
  const ready = async () => {
    await expect(page.getByRole('heading', { name: 'Ready to verify · 0 / 202', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue import', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Pause after this batch' })).toHaveCount(0)
    expect(resumes).toEqual([])
    const history = await page.request.get('/api/app/imports')
    expect(history.status()).toBe(200)
    expect(await history.json()).toEqual([prepared])
    const status = await page.request.get(`/api/app/imports/${prepared.id}`)
    expect(status.status()).toBe(200)
    expect(await status.json()).toEqual(prepared)
    expect(importNativeInventory()).toEqual(baseline)
  }
  await ready()
  await check('acknowledged-ready')
  await ready()
  await page.getByRole('button', { name: 'Refresh history', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Refresh history', exact: true })).toBeEnabled()
  await ready()
  await page.reload()
  await ready()
  await check('reloaded-ready')
  await ready()
  await page.getByRole('button', { name: 'Continue import', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'completed · 202 / 202', exact: true })).toBeVisible({ timeout: 90_000 })
  expect(resumes.length).toBeGreaterThan(1)
  expect(resumes.every(path => path === `/api/app/imports/${prepared.id}/resume`)).toBe(true)
  const completed = await (await page.request.get(`/api/app/imports/${prepared.id}`)).json()
  expect(completed).toMatchObject({ id: prepared.id, state: 'completed', checkpoint: 202, total: 202, error: null })
  const native = importNativeInventory()
  expect(native.counts.flows).toBe(baseline.counts.flows + 1)
  expect(native.counts.responses).toBe(baseline.counts.responses + 201)
  expect(native.counts.response_answers).toBe(baseline.counts.response_answers + 201)
  expect(native.counts.form_import_targets).toBe(baseline.counts.form_import_targets + 202)
  for (const table of ['respondent_sessions', 'response_outbox', 'notification_deliveries', 'notification_attempts']) expect(native.counts[table]).toBe(baseline.counts[table])
  const started = await page.request.post(`/api/app/flows/${review.flowId}/responses/export/start`, { headers: appHeaders, data: { source: 'imported', format: 'json' } })
  expect(started.status()).toBe(200)
  let token: string | undefined = (await started.json()).token
  let content = ''
  while (token) {
    const exported = await page.request.post(`/api/app/flows/${review.flowId}/responses/export`, { headers: appHeaders, data: { token } })
    expect(exported.status()).toBe(200)
    content += await exported.text()
    token = exported.headers()['x-export-next']
  }
  const responses = (JSON.parse(content) as { responses: LedgerResponse[] }).responses
  expect(responses).toHaveLength(201)
  expect(new Set(responses.map(response => response.id)).size).toBe(201)
  expect(new Set(responses.map(response => response.revisionId)).size).toBe(1)
  expect(responses.map(response => response.answers[0].value).sort()).toEqual([...values].sort())
  for (const response of responses) {
    expect(response.source).toBe('imported')
    expect(response.completedAt).toBe('2026-09-12T10:03:00.000Z')
    expect(response.participant).toBeUndefined()
    expect(response.answers).toHaveLength(1)
    expect(response.answers[0]).toMatchObject({ label: 'Answer', questionType: 'short_text' })
  }
  await check('acknowledged-completed')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'completed · 202 / 202', exact: true })).toBeVisible()
  expect(importNativeInventory()).toEqual(native)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Undo import', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible({ timeout: 90_000 })
  const undone = importNativeInventory()
  for (const table of ['flows', 'flow_revisions', 'flow_steps', 'choice_options', 'flow_branch_rules', 'responses', 'response_answers', 'form_import_targets', 'form_import_revisions']) expect(undone.counts[table]).toBe(baseline.counts[table])
  await page.reload()
  await expect(page.getByRole('heading', { name: /undone/ })).toBeVisible()
  expect((await (await page.request.get(`/api/app/imports/${prepared.id}`)).json()).state).toBe('undone')
  await check('acknowledged-undone')
})
