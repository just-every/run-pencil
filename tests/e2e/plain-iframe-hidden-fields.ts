import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { DatabaseSync } from 'node:sqlite'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'
import { parseCsv } from '../../src/core/features/importing/csv'
import { nativeHost } from './brand-helpers'
import { expect } from './fixtures'
import { stateDatabaseFile } from './state-database'

/** A separate anonymous form proves query admission without a script or host handshake. */
export async function provePlainIframeHiddenFields(page: Page, info: TestInfo) {
  const call = async <T,>(path: string, method = 'GET', data?: unknown) => {
    const response = await page.request.fetch(path, { method, ...(data === undefined ? {} : { data }) })
    expect(response.status(), await response.text()).toBeLessThan(300)
    return response.json() as Promise<T>
  }
  const slug = `iframe-campaign-${crypto.randomUUID()}`
  const flow = await call<{ id: string }>('/api/app/flows', 'POST', { title: 'Iframe campaign feedback', slug })
  const base = `/api/app/flows/${flow.id}`
  const read = () => call<BuilderDraft>(`${base}/draft`)
  const prompt = 'What would help your next visit?'
  const privateAnswer = 'synthetic-pencil-private-iframe-answer'
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt, required: true },
    { kind: 'completion', questionType: null, prompt: 'Thank you for the campaign feedback.' },
  ]) await call(`${base}/draft/steps`, 'POST', { expectedVersion: (await read()).flow.draftVersion, step })
  const campaign = { id: 'synthetic-pencil-campaign', name: 'utm_campaign', type: 'text', category: 'campaign' }
  await call(`${base}/draft/settings`, 'PUT', {
    expectedVersion: (await read()).flow.draftVersion,
    settings: { identityMode: 'anonymous', hiddenFields: [campaign] },
  })
  await call(`${base}/publish`, 'POST', { expectedVersion: (await read()).flow.draftVersion })
  const origin = process.env.PENCIL_E2E_BASE_URL!
  const src = `${origin}/embed/${slug}?utm_campaign=spring&secret=x`
  const workspace = await call<Record<string, unknown>>('/api/app/workspace')
  const host = await nativeHost(`<iframe src="${src.replaceAll('&', '&amp;')}" title="Campaign feedback" width="100%" height="700" sandbox="allow-scripts allow-forms" referrerpolicy="origin" style="border:0"></iframe>`)
  let context: BrowserContext | undefined
  try {
    await call('/api/app/workspace', 'PUT', { ...workspace, embedAllowedOrigins: [host.origin] })
    context = await page.context().browser()!.newContext({ extraHTTPHeaders: {}, viewport: page.viewportSize()! })
    const visitor = await context.newPage()
    await visitor.goto(host.origin)
    const iframe = visitor.locator('iframe')
    await expect(iframe).toHaveAttribute('src', src)
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms')
    const frame = visitor.frameLocator('iframe')
    await expect(frame.getByRole('textbox', { name: prompt, exact: true })).toBeVisible()
    expect(await visitor.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull()
    expect(await visitor.evaluate(() => {
      try { void document.querySelector('iframe')!.contentWindow!.document.body; return false } catch { return true }
    })).toBe(true)
    const child = visitor.frames().find(candidate => candidate.url() === src)!
    expect(await child.evaluate(() => {
      try { localStorage.setItem('synthetic-pencil-1', '1'); return false } catch { return true }
    }), 'the sandbox keeps an opaque origin').toBe(true)
    await frame.getByRole('textbox', { name: prompt, exact: true }).fill(privateAnswer)
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await visitor.screenshot({ path: info.outputPath('plain-iframe-campaign-answer.png'), fullPage: true })
    await visitor.waitForTimeout(3200)
    const submitted = visitor.waitForResponse(response => response.url().endsWith(`/api/public/flows/${slug}/responses`) && response.request().method() === 'POST')
    await frame.getByRole('button', { name: 'Submit response', exact: true }).click()
    const response = await submitted
    expect(response.status()).toBe(201)
    const receipt = await response.json() as { responseId: string }
    await expect(frame.getByRole('heading', { name: 'Thank you for the campaign feedback.', exact: true })).toBeVisible()
    await visitor.screenshot({ path: info.outputPath('plain-iframe-campaign-completed.png'), fullPage: true })

    const ledger = await call<Ledger>(`${base}/ledger`)
    expect(ledger.total).toBe(1)
    expect(ledger.responses).toHaveLength(1)
    const stored = ledger.responses[0]
    expect(stored).toMatchObject({ id: receipt.responseId, identityMode: 'anonymous', source: 'embed', state: 'released', discardedParameters: 1 })
    const expectedHidden = [{ id: campaign.id, name: 'utm_campaign', type: 'text', value: 'spring' }]
    expect(stored.hiddenFields).toEqual(expectedHidden)
    expect(stored.answers.map(answer => answer.value)).toEqual([privateAnswer])
    expect(stored.participant).toBeUndefined()
    expect(JSON.stringify(stored)).not.toContain('secret')
    // Read actual persisted context too: ledger projection could hide an
    // accidentally retained undeclared key even when its CSV looks correct.
    const database = new DatabaseSync(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!), { readOnly: true })
    try {
      const row = database.prepare('SELECT response_context_json FROM responses WHERE id = ?').get(receipt.responseId) as { response_context_json: string }
      const context = JSON.parse(row.response_context_json)
      expect(context.hidden).toEqual({ [campaign.id]: 'spring' })
      expect(context).toMatchObject({ identityMode: 'anonymous', discarded: 1 })
      expect(row.response_context_json).not.toContain('secret')
    } finally { database.close() }

    const start = await call<{ token: string }>(`${base}/responses/export/start?format=csv`)
    const exported = await page.request.get(`${base}/responses/export?token=${encodeURIComponent(start.token)}`)
    expect(exported.status()).toBe(200)
    expect(exported.headers()['x-export-written']).toBe('1')
    const csv = await exported.text()
    const parsed = parseCsv(csv)
    expect(parsed.errors).toEqual([])
    const [header, ...rows] = parsed.rows
    expect(rows).toHaveLength(1)
    const record = Object.fromEntries(header.map((name, index) => [name, rows[0][index]]))
    expect(record.response_id).toBe(receipt.responseId)
    expect(record.identity_mode).toBe('anonymous')
    expect(record.discarded_parameters).toBe('1')
    expect(JSON.parse(record.hidden_fields_json)).toEqual(expectedHidden)
    expect((JSON.parse(record.answers_json) as Array<{ value: string }>).map(answer => answer.value)).toEqual([privateAnswer])
    expect(csv).not.toContain('secret')

    // The operator wrote the query into src, so the host already knows it.
    // A plain iframe sends no protocol messages and reveals no response data.
    expect(await visitor.evaluate(() => (window as unknown as { messages: unknown[] }).messages)).toEqual([])
    expect(await visitor.evaluate(() => (window as unknown as { events: unknown[] }).events)).toEqual([])
    const hostText = await visitor.locator('body').innerText()
    for (const privateValue of [privateAnswer, receipt.responseId, 'secret']) expect(hostText).not.toContain(privateValue)
    expect(visitor.url()).toBe(`${host.origin}/`)
  } finally {
    try { await context?.close() } finally {
      try { await host.close() } finally { await call('/api/app/workspace', 'PUT', workspace) }
    }
  }
}
