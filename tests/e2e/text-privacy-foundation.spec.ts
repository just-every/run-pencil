import { httpExport } from '../helpers/report-download'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { operatorEmail } from './auth-identity'
import { contract } from './contract'
import { expect, test } from './fixtures'
import type { BuilderDraft } from '../../src/core/app/api'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.14' } })
contract(['BASE-INPUT-002', 'BASE-PUBLIC-001', 'BASE-DATA-004', 'BASE-DATA-005'], 'native public and operator text never executes HTML or contacts a third party, and loading creates no respondent data', async ({ page, browser }, info) => {
  const origin = new URL(info.project.use.baseURL!).origin
  const slug = `text-safety-${info.project.name}-${Date.now()}`
  const call = async <T,>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST') => {
    if (path.includes('/responses/export')) return httpExport<T>(target => page.request.get(target),path)
    const response = await page.request.fetch(path, { method, headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  await call('/auth/magic-link', { email: operatorEmail() })
  const inbox = await developmentInbox(path => page.request.get(path, { headers: devKeyHeaders }), operatorEmail())
  await page.request.post('/auth/confirm', { headers: { Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin }, data: { token: inbox.messages[0].magicLinkToken }, maxRedirects: 0 })
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Synthetic text safety', slug })
  const path = `/api/app/flows/${flow.id}`
  const prompt = 'Literal <img src="https://tracker.invalid/pixel" onerror="window.pencilInjected=true">'
  const answer = '<script>window.pencilInjected=true</script><form action="https://tracker.invalid/send">Private literal response</form>'
  let draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType: 'long_text', prompt, required: true } })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Text safely recorded' } })
  draft = await call<BuilderDraft>(`${path}/draft`)
  await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion })
  const context = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport })
  const publicPage = await context.newPage()
  const requested: string[] = []
  publicPage.on('request', request => requested.push(new URL(request.url()).origin))
  page.on('request', request => requested.push(new URL(request.url()).origin))
  try {
    await publicPage.goto(`/f/${slug}`)
    await expect(publicPage.locator('[data-hydrated=true]')).toBeVisible()
    await expect(publicPage.getByRole('heading', { name: prompt, exact: true })).toBeVisible()
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await call(`${path}/results`)).toMatchObject({ starts: 0, completedResponses: 0 })
    expect(await context.cookies()).toEqual([])
    await publicPage.getByRole('textbox', { name: prompt }).fill(answer)
    await publicPage.waitForTimeout(3100)
    await publicPage.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(publicPage.getByRole('heading', { name: 'Text safely recorded' })).toBeVisible()
    await page.goto(`/app/flows/${flow.id}/results`)
    await page.getByRole('button', { name: /View answers/ }).click()
    await expect(page.getByText(answer, { exact: true })).toHaveCount(2)
    await expect(page.getByText(answer, { exact: true }).last()).toBeVisible()
    for (const surface of [page, publicPage]) {
      expect(await surface.evaluate(() => (window as unknown as { pencilInjected?: boolean }).pencilInjected)).toBeUndefined()
      expect(await surface.locator('img[src*="tracker.invalid"], form[action*="tracker.invalid"]').count()).toBe(0)
    }
    expect([...new Set(requested)]).toEqual([origin])
    expect(await context.cookies()).toEqual([])
    const exported = await call<{ responses: Array<{ answers: Array<{ value: unknown }> }> }>(`${path}/responses/export`)
    expect(exported.responses[0].answers[0].value).toBe(answer)
  } finally { await context.close() }
})
