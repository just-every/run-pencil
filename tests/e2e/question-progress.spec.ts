import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import type { BuilderDraft } from '../../src/core/app/api'
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.24' } })
contract(["RESP-002","RESP-003","RESP-025","RESP-004"], 'recomputes reachable progress after branching, optional skips, Back and a valid zero', async ({ page, request }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const origin = new URL(info.project.use.baseURL!).origin, slug = `progress-path-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, data?: unknown) => {
    const response = await request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return await response.json() as T
  }
  const email = operatorEmail()
  await call('/auth/magic-link', { email })
  const inbox = await developmentInbox(path => request.get(path, { headers: devKeyHeaders }), email)
  await request.post('/auth/confirm', { headers: { Origin: origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
  const created = await call<{ id: string }>('/api/app/flows', { title: 'Reachable progress', slug }), path = `/api/app/flows/${created.id}`
  for (const step of [
    { kind: 'question', questionType: 'yes_no', prompt: 'Include optional detail?', required: true },
    { kind: 'question', questionType: 'short_text', prompt: 'Optional detail', required: false },
    { kind: 'question', questionType: 'number', prompt: 'Zero is valid', required: true, questionSettings: { min: 0, max: 1 } },
    { kind: 'completion', questionType: null, prompt: 'Progress complete' },
  ]) {
    const draft = await call<BuilderDraft>(`${path}/draft`)
    await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step })
  }
  let draft = await call<BuilderDraft>(`${path}/draft`)
  const branches = await request.put(`${path}/draft/branches`, { headers: { Origin: origin }, data: { expectedVersion: draft.flow.draftVersion, rules: [{ sourceStepId: draft.steps[0].id, predicateKind: 'equals', expectedValue: false, destinationStepId: draft.steps[2].id, position: 0 }] } })
  expect(branches.status()).toBe(200)
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const tabTo = async (locator: import('@playwright/test').Locator) => {
    for (let i = 0; i < 100; i++) { await page.keyboard.press('Tab'); if (await locator.evaluate(element => element === document.activeElement)) return }
    throw new Error('Progress control was not reachable by keyboard.')
  }
  const activate = async (name: string) => { await tabTo(page.getByRole('button', { name, exact: true })); await page.keyboard.press('Enter') }
  const progress = async (value: number, remaining: number) => {
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(value))
    await expect(page.getByText(`${remaining} remaining`, { exact: true })).toBeVisible()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto(`/f/${slug}`)
  await progress(0, 3)
  await activate('Continue'); await expect(page.getByRole('alert')).toBeVisible(); await progress(0, 3)
  await tabTo(page.getByRole('radio', { name: 'Yes', exact: true })); await page.keyboard.press('ArrowDown')
  await progress(50, 1)
  await activate('Continue'); await expect(page.getByRole('heading', { name: 'Zero is valid' })).toBeVisible(); await progress(50, 1)
  await activate('Back')
  await tabTo(page.getByRole('radio', { name: 'No', exact: true })); await page.keyboard.press('ArrowUp')
  await progress(33, 2)
  await activate('Continue'); await expect(page.getByRole('heading', { name: 'Optional detail', exact: true })).toBeVisible(); await progress(33, 2)
  await activate('Continue'); await progress(67, 1)
  await activate('Back'); await progress(33, 2)
  await activate('Continue'); await progress(67, 1)
  await activate('Back'); await activate('Back')
  await tabTo(page.getByRole('radio', { name: 'Yes', exact: true })); await page.keyboard.press('ArrowDown')
  await progress(50, 1)
  await activate('Continue')
  await tabTo(page.getByRole('spinbutton', { name: 'Zero is valid' })); await page.keyboard.type('2'); await progress(50, 1)
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('0'); await progress(100, 0)
  await activate('Submit response'); await expect(page.getByRole('heading', { name: 'Progress complete' })).toBeVisible()
})
