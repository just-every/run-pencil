import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { BuilderDraft } from '../../src/core/app/api'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, test, openLocalOutbox } from './fixtures'

contract(['RSLT-001', 'RSLT-002', 'BASE-PUBLIC-003'], 'selects answer grammar from matching text results through search', async ({ page }, info) => {
  test.setTimeout(180000)
  const capture = async (state: string) => {
    if (!process.env.PENCIL_CAPTURE_DIR) return
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${info.project.name}-text-answer-${state}.png`), fullPage: true })
  }
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  const email = operatorEmail()
  await page.goto('/signin')
  await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openLocalOutbox(page)
  await page.locator('article').filter({ hasText: email }).getByRole('link', { name: 'Read message' }).first().click()
  await page.getByRole('link', { name: 'Open this link' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()

  let serial = 0
  const call = async <T,>(path: string, data?: unknown): Promise<T> => {
    const response = await page.request.fetch(path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'CF-Connecting-IP': `198.18.179.${++serial % 250}` },
      ...(data === undefined ? {} : { data }),
    })
    expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const slug = `text-answer-plurals-${info.project.name}-${Date.now()}`
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Text answer plural check', slug })
  const path = `/api/app/flows/${flow.id}`
  let draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, {
    expectedVersion: draft.flow.draftVersion,
    step: { kind: 'question', questionType: 'long_text', prompt: 'Two response comments', required: false },
  })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, {
    expectedVersion: draft.flow.draftVersion,
    step: { kind: 'completion', questionType: null, prompt: 'Done' },
  })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })

  for (const [index, value] of ['seaglass firstlight', 'seaglass moonrise'].entries()) {
    const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, {
      ...session,
      idempotencyKey: `text-plural-${session.sessionId}-${index}`,
      answers: [{ stepId: draft.steps[0].id, value }],
    })
    if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
  }

  await page.goto(`/app/flows/${flow.id}/results`)
  const answers = page.getByRole('region', { name: 'Answers', exact: true })
  await expect(answers.getByRole('heading', { name: 'Two response comments', exact: true })).toBeVisible()
  const search = answers.getByRole('searchbox', { name: 'Search answers' })
  const checkState = async (count: string, screenshot: string) => {
    await expect(answers.getByText(count, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const violations = (await new AxeBuilder({ page }).include('.operator-content').analyze()).violations
      .filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))
    expect(violations.map(violation => `${violation.id}: ${violation.help}`)).toEqual([])
    await capture(screenshot)
  }

  await search.fill('seaglass')
  await expect(answers.getByText('2 matching answers · latest first · 2 on this page', { exact: true })).toBeVisible()
  await expect(answers.getByText('seaglass firstlight', { exact: true })).toBeVisible()
  await expect(answers.getByText('seaglass moonrise', { exact: true })).toBeVisible()
  await checkState('2 matching answers · latest first · 2 on this page', 'two-matches')

  await search.fill('firstlight')
  await expect(answers.getByText('1 matching answer · latest first · 1 on this page', { exact: true })).toBeVisible()
  await expect(answers.getByText('seaglass firstlight', { exact: true })).toBeVisible()
  await expect(answers.getByText('seaglass moonrise', { exact: true })).toHaveCount(0)
  await checkState('1 matching answer · latest first · 1 on this page', 'one-match')

  await search.fill('moonstone')
  await expect(answers.getByText('0 matching answers · latest first · 0 on this page', { exact: true })).toBeVisible()
  await expect(answers.getByText('seaglass firstlight', { exact: true })).toHaveCount(0)
  await expect(answers.getByText('seaglass moonrise', { exact: true })).toHaveCount(0)
  await checkState('0 matching answers · latest first · 0 on this page', 'zero-matches')
})
