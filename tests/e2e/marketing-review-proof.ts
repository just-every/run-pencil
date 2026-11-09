import type { Page, TestInfo } from '@playwright/test'
import type { BuilderDraft, Ledger, PublicFlow } from '../../src/core/app/api'
import { expect } from './fixtures'

/** Review must show the revision's opt-in at the control that actually commits consent. */
export async function proveMarketingReview(page: Page, info: TestInfo) {
  const slug = `marketing-review-${info.project.name}-${Date.now()}`
  const headers = { Origin: new URL(info.project.use.baseURL!).origin }
  const wording = 'By submitting, receive our synthetic product newsletter. Unsubscribe at any time.'
  const draftWording = 'Unpublished synthetic wording, never shown to this respondent.'
  const created = await page.request.post('/api/app/flows', { headers, data: { title: 'Synthetic newsletter review', slug } })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  const base = `/api/app/flows/${id}`
  const draft = async () => {
    const response = await page.request.get(`${base}/draft`)
    expect(response.status()).toBe(200)
    return await response.json() as BuilderDraft
  }
  for (const step of [
    { kind: 'question', questionType: 'short_text', prompt: 'Which product interests you?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Newsletter request recorded.' },
  ]) {
    expect((await page.request.post(`${base}/draft/steps`, { headers, data: { expectedVersion: (await draft()).flow.draftVersion, step } })).status()).toBe(201)
  }
  const initial = await draft()
  expect((await page.request.put(`${base}/draft`, { headers, data: { expectedVersion: initial.flow.draftVersion, stepId: initial.steps[0].id, prompt: initial.steps[0].prompt, required: true, nextStepId: initial.steps[1].id } })).status()).toBe(200)
  const settings = await draft()
  expect((await page.request.put(`${base}/draft/settings`, { headers, data: { expectedVersion: settings.flow.draftVersion, settings: { ...settings.formSettings, reviewBeforeSubmit: true, marketing: { purpose: 'email_marketing', wording } } } })).status()).toBe(200)
  expect((await page.request.post(`${base}/publish`, { headers, data: { expectedVersion: (await draft()).flow.draftVersion } })).status()).toBe(201)
  const published = await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
  expect(published.reviewBeforeSubmit).toBe(true)
  expect(published.formSettings?.marketing).toEqual({ purpose: 'email_marketing', wording })
  const ledger = async () => {
    const response = await page.request.get(`${base}/ledger`)
    expect(response.status()).toBe(200)
    return await response.json() as Ledger
  }
  const submissions: unknown[] = []
  const recordSubmission = (request: import('@playwright/test').Request) => {
    if (new URL(request.url()).pathname === `/api/public/flows/${slug}/responses` && request.method() === 'POST') submissions.push(request.postDataJSON())
  }
  page.on('request', recordSubmission)
  try {
    await page.goto(`/f/${slug}`)
    await expect(page.locator('[data-hydrated=true]')).toBeVisible()
    await page.getByRole('textbox', { name: 'Which product interests you?', exact: true }).fill('Original synthetic interest')
    await page.getByRole('button', { name: 'Review answers', exact: true }).click()
    const review = page.getByRole('region', { name: 'Your answers', exact: true })
    const submit = page.getByRole('button', { name: 'Submit response', exact: true })
    const optIn = page.getByTestId('marketing-opt-in')
    const checkReview = async () => {
      await expect(page.getByRole('heading', { name: 'Review your answers', exact: true })).toBeVisible()
      await expect(optIn).toHaveCount(1)
      await expect(optIn).toHaveText(wording)
      await expect(submit).toBeVisible()
      const wordingBox = (await optIn.boundingBox())!, submitBox = (await submit.boundingBox())!
      expect(wordingBox.y + wordingBox.height).toBeLessThanOrEqual(submitBox.y)
      expect(await optIn.evaluate(element => element.nextElementSibling?.matches('footer.respondent-actions') && element.nextElementSibling.querySelector('button.primary-button')?.textContent?.includes('Submit response'))).toBe(true)
      expect(await optIn.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(submissions).toHaveLength(0)
      expect((await ledger()).total).toBe(0)
    }
    await checkReview()
    await expect(review.getByRole('definition')).toHaveText('Original synthetic interest')
    await page.screenshot({ path: info.outputPath(`marketing-review-${info.project.name}.png`), fullPage: true })

    // A newer draft is deliberately left unpublished while this revision stays live.
    const nextDraft = await draft()
    expect((await page.request.put(`${base}/draft/settings`, { headers, data: { expectedVersion: nextDraft.flow.draftVersion, settings: { ...nextDraft.formSettings, marketing: { purpose: 'email_marketing', wording: draftWording } } } })).status()).toBe(200)
    expect((await draft()).formSettings?.marketing?.wording).toBe(draftWording)
    const stillPublished = await (await page.request.get(`/api/public/flows/${slug}`)).json() as PublicFlow
    expect(stillPublished.revision.id).toBe(published.revision.id)
    expect(stillPublished.formSettings?.marketing?.wording).toBe(wording)
    await review.getByRole('link', { name: 'Edit Which product interests you?', exact: true }).click()
    await page.getByRole('textbox', { name: 'Which product interests you?', exact: true }).fill('Edited synthetic interest')
    await page.getByRole('button', { name: 'Review answers', exact: true }).click()
    await checkReview()
    await expect(review.getByRole('definition')).toHaveText('Edited synthetic interest')
    await expect(page.getByText(draftWording, { exact: true })).toHaveCount(0)
    await page.waitForTimeout(3100)
    const accepted = page.waitForResponse(response => new URL(response.url()).pathname === `/api/public/flows/${slug}/responses` && response.request().method() === 'POST')
    await submit.click()
    expect((await accepted).status()).toBe(201)
    await expect(page.getByRole('heading', { name: 'Newsletter request recorded.', exact: true })).toBeVisible()
    expect(submissions).toHaveLength(1)
    const stored = await ledger()
    expect(stored.total).toBe(1)
    expect(stored.responses).toHaveLength(1)
    const response = stored.responses[0]
    expect(response.revisionId).toBe(published.revision.id)
    expect(response.answers).toEqual([expect.objectContaining({ stepId: published.steps[0].id, value: 'Edited synthetic interest' })])
    expect(Number.isFinite(Date.parse(response.completedAt))).toBe(true)
    expect(response.consents).toEqual([{ purpose: 'email_marketing', given: true, wording, source: 'form', at: response.completedAt }])
    await page.goto(`/app/flows/${id}/results`)
    await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    await page.getByRole('button', { name: 'View answers', exact: true }).click()
    const consent = page.getByRole('region', { name: 'Consent records', exact: true })
    await expect(consent.getByRole('term')).toHaveText('Email marketing')
    await expect(consent.getByRole('definition')).toHaveCount(1)
    await expect(consent.getByRole('definition')).toContainText(wording)
    await expect(consent.getByRole('definition')).toContainText('(form opt-in)')
    await expect(consent).not.toContainText(draftWording)
    await page.screenshot({ path: info.outputPath(`marketing-ledger-${info.project.name}.png`), fullPage: true })
  } finally {
    page.off('request', recordSubmission)
  }
}
