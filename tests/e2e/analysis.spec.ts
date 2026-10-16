import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, openMailLink, test } from './fixtures'
import { answer, startAiReceiver } from './ai-receiver'
import type { BuilderDraft } from '../../src/core/app/api'

async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations.map(violation => violation.id)).toEqual([])
}

contract(['ANLY-001', 'ANLY-003', 'ANLY-004', 'ANLY-005', 'ANLY-006', 'ANLY-008', 'ANLY-011'], 'an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run', async ({ page }, info) => {
  test.setTimeout(180_000)
  const viewport = info.project.name === 'mobile' ? 'mobile' : 'desktop'
  const capture = async (step: string) => {
    if (!process.env.PENCIL_CAPTURE_DIR) return
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${viewport}-${step}.png`), fullPage: true })
  }
  const provider = await startAiReceiver()
  try {
    const email = operatorEmail()
    await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
    await page.getByRole('button', { name: /Send.*link/i }).click()
    await openMailLink(page, email)
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()

    // A newcomer connects from the page; the same saved provider powers the
    // structured test and the complete analysis journey below.
    await page.goto('/app/analysis')
    await page.getByLabel('Analysis provider').selectOption('compatible')
    await page.getByLabel('API base address').fill(`http://127.0.0.1:${process.env.PENCIL_E2E_AI_PORT ?? Number(process.env.PENCIL_E2E_PORT ?? '4173') + 3}/v1`)
    await page.getByLabel('Model identifier').fill('synthetic-page-model')
    await page.getByLabel('Provider API key').fill('synthetic-browser-ai-key')
    await page.getByRole('button', { name: 'Save provider', exact: true }).click()
    await expect(page.getByText('Provider saved. Test the connection before requesting analysis.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Model identifier')).toHaveValue('synthetic-page-model')
    provider.script.push({ status: 401, body: { error: { message: 'synthetic-private-provider-error' } } })
    await page.getByRole('button', { name: 'Test saved provider', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('The provider refused the key.')
    await expect(page.locator('body')).not.toContainText('synthetic-private-provider-error')
    provider.script.push(answer({ ready: true }))
    await page.getByRole('button', { name: 'Test saved provider', exact: true }).click()
    await expect(page.getByText(/Connection passed: the model returned/)).toBeVisible()
    await expect(page.getByLabel('Provider API key')).toHaveValue('')
    expect(JSON.parse(provider.requests[1]).input).toEqual([{ role: 'user', content: 'Connection test. Return ready as true.' }])
    expect(JSON.parse(provider.requests[1]).model).toBe('synthetic-page-model')
    await capture('analysis-connection-tested')

    // Native responses collected through the public endpoints.
    const call = async <T,>(path: string, data?: unknown): Promise<T> => {
      const response = await page.request.fetch(path, { method: data === undefined ? 'GET' : 'POST', ...(data === undefined ? {} : { data }) })
      expect(response.status(), path).toBeLessThan(300)
      return response.status() === 204 ? undefined as T : await response.json() as T
    }
    const slug = `analysis-${viewport}-${Date.now()}`, title = `Lunch visit ${viewport}`
    const flow = await call<{ id: string }>('/api/app/flows', { title, slug })
    const draft = () => call<BuilderDraft>(`/api/app/flows/${flow.id}/draft`)
    await call(`/api/app/flows/${flow.id}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt: 'What could we improve?', required: true } })
    await call(`/api/app/flows/${flow.id}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Thanks' } })
    await call(`/api/app/flows/${flow.id}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
    const published = await draft(), question = published.steps.find(step => step.prompt === 'What could we improve?')!
    const texts = ['The queue at lunch was far too long.', 'Waited twenty minutes in the lunch queue.', 'The queue barely moved at noon.', 'Long queue, only one till open.', 'Lunch queue took forever.', 'Coffee prices went up.', 'Prices rose without notice.']
    const ids: string[] = []
    for (const [index, text] of texts.entries()) {
      const session = await call<{ sessionId: string; sessionToken: string }>(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })
      const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: `${slug}-${index}`, answers: [{ stepId: question.id, value: text }] })
      if (receipt.disposition === 'quarantined') await call(`/api/app/responses/${receipt.responseId}/release`, {})
      ids.push(receipt.responseId)
    }
    const questionId = (await call<{ revisions: Array<{ isCurrent: boolean; questions: Array<{ id: string }> }> }>(`/api/app/analysis/options?flowId=${flow.id}`)).revisions.find(revision => revision.isCurrent)!.questions[0].id
    provider.script.push(answer({ outcome: 'findings', reason: '', themes: [
      { title: 'Long waits at the lunch counter', summary: 'Most visitors describe a slow lunch queue with one till open.', responseIds: ids.slice(0, 5), count: 5, quotes: [{ responseId: ids[1], questionId, start: 0, end: 21, text: 'Waited twenty minutes' }, { responseId: ids[3], questionId, start: 0, end: 31, text: 'Long queue, only one till open.' }] },
      { title: 'Prices', summary: 'Two visitors mention prices.', responseIds: ids.slice(5), count: 2, quotes: [] },
    ], recommendations: [{ title: 'Open a second till from 11:30 to 14:00', rationale: 'The slow queue is the most common subject.', themeIndexes: [0], confidence: 'medium', expectedImpact: 'high', effort: 'low' }] }))

    // Request: the screen says what leaves and to which origin.
    await page.goto('/app/analysis')
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible()
    await capture('analysis-list')
    await axe(page)
    await page.getByRole('link', { name: 'Request analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Request analysis' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Flow' }).selectOption({ label: title })
    await expect(page.getByLabel('What could we improve? (long text)')).toBeChecked()
    await expect(page.getByText(/Answers you select are sent to http:\/\/127\.0\.0\.1:\d+/)).toBeVisible()
    await capture('request')
    await axe(page)
    await page.getByRole('button', { name: 'Request analysis' }).click()

    // Findings: a primary theme with exact quotes linked to their responses; the two-response theme is withheld.
    await expect(page.getByRole('heading', { name: 'What 7 responses say' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Long waits at the lunch counter' })).toBeVisible()
    await expect(page.getByText('5 of 7 responses · 71.4%')).toBeVisible()
    await expect(page.getByText('“Long queue, only one till open.”')).toBeVisible()
    await expect(page.getByText('Theme 2 withheld: fewer than 5 responses (disclosure threshold 5)')).toBeVisible()
    await expect(page.getByText('Prices', { exact: true })).toHaveCount(0)
    await capture('findings')
    await axe(page)
    await page.getByRole('button', { name: /^Response / }).last().click()
    const evidence = page.getByRole('region', { name: 'Responses behind theme 1' })
    await expect(evidence).toContainText('Long queue, only one till open.')
    await capture('findings-evidence')

    // The recommendation becomes an owned action; nobody is contacted.
    await page.getByRole('link', { name: 'Turn this into an action' }).click()
    await expect(page.getByRole('heading', { name: 'New action' })).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue('Open a second till from 11:30 to 14:00')
    await page.getByLabel('Metric', { exact: true }).fill('Visitors mentioning the queue')
    await page.getByLabel('Unit').fill('responses')
    await page.getByLabel('Baseline value').fill('5')
    await capture('action-from-analysis')
    await page.getByRole('button', { name: 'Save action' }).click()
    await expect(page.getByRole('heading', { name: 'Open a second till from 11:30 to 14:00' })).toBeVisible()

    // A provider answer that fails validation fails the run with nothing shown, and Retry runs it again.
    provider.script.push(answer({ outcome: 'findings', reason: '', themes: [{ title: 'Unknown', summary: '', responseIds: ['not-in-this-run'], count: 1, quotes: [] }], recommendations: [] }))
    await page.goto(`/app/analysis/new?flowId=${flow.id}`)
    await expect(page.getByLabel('What could we improve? (long text)')).toBeChecked()
    await page.getByRole('button', { name: 'Request analysis' }).click()
    await expect(page.getByRole('heading', { name: 'This analysis failed' })).toBeVisible()
    await expect(page.getByText('unknown_response')).toBeVisible()
    await capture('failed')
    await axe(page)
    provider.script.push(answer({ outcome: 'findings', reason: '', themes: [{ title: 'Long waits at the lunch counter', summary: 'A slow queue.', responseIds: ids.slice(0, 5), count: 5, quotes: [] }], recommendations: [] }))
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('heading', { name: 'What 7 responses say' })).toBeVisible()
    expect(provider.requests.length).toBe(5)
  } finally { await page.request.delete('/api/app/connections/analysis', { data: {} }); await provider.close() }
})
