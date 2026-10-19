import { mkdir } from 'node:fs/promises'
import type { BuilderDraft } from '../../src/core/app/api'
import { contract } from './contract'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { downloadedText } from './export-helpers'

contract('FIELD-013', 'an operator saves text limits and a phone mask, and a respondent corrects errors before their answers reach results', async ({ page }, info) => {
  test.setTimeout(120_000)
  await signInEmptyWorkspace(page)
  const origin = new URL(info.project.use.baseURL!).origin
  const call = async <T,>(path: string, data?: unknown) => {
    const response = await page.request.fetch(path, {
      method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin },
      ...(data === undefined ? {} : { data }),
    })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return await response.json() as T
  }
  const slug = `callback-request-${info.project.name}-${Date.now()}`
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Callback request', slug })
  const path = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${path}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'short_text', prompt: 'Local phone number', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'How can we help?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Your callback is requested' },
  ]) {
    await call(`${path}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step })
  }

  const phoneMessage = 'Enter a local number in 555-0100 format.'
  const detailsMessage = 'Describe your request in 5 to 40 characters.'
  const settings = [
    { prompt: 'Local phone number', min: 3, max: 10, message: phoneMessage, mask: '###-####' },
    { prompt: 'How can we help?', min: 5, max: 40, message: detailsMessage },
  ]
  await page.goto(`/app/flows/${flow.id}/builder`)
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  const rail = page.getByRole('complementary', { name: 'Flow steps' })
  const inspector = page.getByRole('complementary', { name: 'Step settings' })
  for (const setting of settings) {
    await rail.getByRole('button', { name: new RegExp(setting.prompt.replace('?', '\\?')) }).click()
    await inspector.getByLabel('Minimum characters', { exact: true }).fill(String(setting.min))
    await inspector.getByLabel('Maximum characters', { exact: true }).fill(String(setting.max))
    await inspector.getByLabel('Custom validation message', { exact: true }).fill(setting.message)
    if (setting.mask) await inspector.getByLabel('Input mask', { exact: true }).fill(setting.mask)
    await inspector.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  }
  // Read back through the editor so the published journey uses saved settings.
  await page.reload()
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  for (const setting of settings) {
    await rail.getByRole('button', { name: new RegExp(setting.prompt.replace('?', '\\?')) }).click()
    await expect(inspector.getByLabel('Minimum characters', { exact: true })).toHaveValue(String(setting.min))
    await expect(inspector.getByLabel('Maximum characters', { exact: true })).toHaveValue(String(setting.max))
    await expect(inspector.getByLabel('Custom validation message', { exact: true })).toHaveValue(setting.message)
    if (setting.mask) await expect(inspector.getByLabel('Input mask', { exact: true })).toHaveValue(setting.mask)
  }
  const shots = process.env.PENCIL_PROOF_DIR
  const capture = async (screen: string) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (shots) {
      await mkdir(shots, { recursive: true })
      const path = `${shots}/text-validation-${screen}-${info.project.name}.png`
      if (screen === 'results') await page.getByRole('region', { name: 'Response ledger', exact: true }).screenshot({ path })
      else await page.screenshot({ path, fullPage: true })
    }
  }
  await capture('builder')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Share this flow' })).toBeVisible()
  await page.goto(`/f/${slug}`)

  const phone = page.getByRole('textbox', { name: 'Local phone number', exact: true })
  const counter = page.getByRole('status').filter({ hasText: /characters$/ })
  await expect(counter).toHaveText('0 / 10 characters')
  for (const invalid of ['12', '12345678901', 'abc-defg']) {
    await phone.fill(invalid)
    await expect(phone).toHaveValue(invalid)
    await expect(counter).toHaveText(`${invalid.length} / 10 characters`)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(phoneMessage)
    await expect(phone).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('heading', { name: 'Local phone number', exact: true })).toBeVisible()
  }
  await capture('mask-error')
  const validPhone = '555-0100'
  await phone.fill(validPhone)
  await expect(counter).toHaveText(`${validPhone.length} / 10 characters`)
  await expect(phone).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  const details = page.getByRole('textbox', { name: 'How can we help?', exact: true })
  await expect(details).toHaveJSProperty('tagName', 'TEXTAREA')
  await expect(counter).toHaveText('0 / 40 characters')
  for (const invalid of ['Hi', 'x'.repeat(41)]) {
    await details.fill(invalid)
    await expect(details).toHaveValue(invalid)
    await expect(counter).toHaveText(`${invalid.length} / 40 characters`)
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(detailsMessage)
    await expect(details).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('heading', { name: 'How can we help?', exact: true })).toBeVisible()
  }
  await capture('long-text-error')
  expect((await call<{ total: number }>(`${path}/ledger`)).total).toBe(0)
  const validDetails = 'Please call\nin the afternoon.'
  await details.fill(validDetails)
  await expect(counter).toHaveText(`${validDetails.length} / 40 characters`)
  await expect(details).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(phone).toHaveValue(validPhone)
  await expect(counter).toHaveText(`${validPhone.length} / 10 characters`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(details).toHaveValue(validDetails)
  await expect(counter).toHaveText(`${validDetails.length} / 40 characters`)
  await capture('valid-answers')
  // Preserve the real admission policy's reading time, as in other-choices.
  await page.waitForTimeout(3200)
  const submitted = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/public/flows/${slug}/responses`)
  await page.getByRole('button', { name: 'Submit response', exact: true }).click()
  const receipt = await submitted
  expect(receipt.status()).toBe(201)
  expect(await receipt.json()).toMatchObject({ disposition: 'released' })
  await expect(page.getByRole('heading', { name: 'Your callback is requested', exact: true })).toBeVisible()
  await capture('completed')

  await page.goto(`/app/flows/${flow.id}/results`)
  const ledger = page.getByRole('region', { name: 'Response ledger' })
  await expect(ledger).toContainText(validPhone)
  await expect(ledger).toContainText('in the afternoon.')
  await capture('results')
  const download = page.waitForEvent('download')
  await ledger.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const exported = JSON.parse(await downloadedText(await download))
  expect(exported.responses).toHaveLength(1)
  expect(exported.responses[0].answers.map((answer: { value: unknown }) => answer.value)).toEqual([validPhone, validDetails])
})
