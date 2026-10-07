import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { contract } from './contract'
import { expect, test } from './fixtures'
import type { BuilderDraft } from '../../src/core/app/api'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.13' } })
contract(['RESP-003', 'BASE-PUBLIC-003'], 'all seven question types reject an empty required answer and complete through keyboard controls at both widths', async ({ page, request }, info) => {
  test.setTimeout(120_000)
  const origin = new URL(info.project.use.baseURL!).origin
  const slug = `question-matrix-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, data?: unknown) => {
    const response = await request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return await response.json() as T
  }
  await call('/auth/magic-link', { email: operatorEmail() })
  const inbox = await call<{ messages: Array<{ magicLinkToken: string }> }>(`/auth/local-inbox?email=${encodeURIComponent(operatorEmail())}`)
  await request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
  const created = await call<{ id: string }>('/api/app/flows', { title: 'Synthetic question matrix', slug })
  const path = `/api/app/flows/${created.id}`
  const types = ['short_text','long_text','email','single_choice','multiple_choice','rating','priority'] as const
  for (const questionType of types) {
    const draft = await call<BuilderDraft>(`${path}/draft`)
    await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType, prompt: `Answer ${questionType}`, required: true, ...(['single_choice','multiple_choice','priority'].includes(questionType) ? { choices: ['A','B','C'].map(label => ({ label, value: label })) } : {}) } })
  }
  let draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'All seven answered' } })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const tabTo = async (locator: import('@playwright/test').Locator) => {
    for (let i = 0; i < 100; i++) { await page.keyboard.press('Tab'); if (await locator.evaluate(element => element === document.activeElement)) return }
    throw new Error('Question control was not reachable by keyboard.')
  }
  const check = async () => {
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto(`/f/${slug}`)
  for (const [index, type] of types.entries()) {
    await expect(page.getByRole('heading', { name: `Answer ${type}`, exact: true })).toBeVisible()
    expect(await page.locator('[data-selected=true]').count()).toBe(0)
    const next = page.getByRole('button', { name: index === types.length - 1 ? 'Submit response' : 'Continue', exact: true })
    await tabTo(next); await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText(`Answer ${type}`)
    await check()
    if (['short_text','long_text','email'].includes(type)) {
      await tabTo(page.getByRole('textbox', { name: `Answer ${type}` })); await page.keyboard.type(type === 'email' ? 'synthetic@example.test' : 'Synthetic keyboard feedback')
    } else if (type === 'rating') {
      await tabTo(page.getByRole('button', { name: '3 out of 5' })); await page.keyboard.press('Space')
    } else if (type === 'priority') {
      for (const name of ['A','B','C']) { await tabTo(page.getByRole('button', { name, exact: true })); await page.keyboard.press('Space') }
    } else {
      await tabTo(page.getByRole(type === 'single_choice' ? 'radio' : 'checkbox', { name: 'A', exact: true })); await page.keyboard.press('Space')
    }
    await tabTo(next); await page.keyboard.press('Enter')
  }
  await expect(page.getByRole('heading', { name: 'All seven answered' })).toBeVisible()
  await check()
})
