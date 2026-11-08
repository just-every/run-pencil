import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { wordpressHost } from '../helpers/wordpress'

type ArchiveTable = { name: string; columns: string[]; rows: { value: string }[][] }
type HostEvidence = { pencilEvents: { type: string; detail: unknown }[]; pencilMessages: unknown[] }

/** Run through WordPress publication, shortcode rendering and native Pencil storage. */
export async function proveWordpressEmbed(operator: Page, browser: Browser, info: TestInfo, flow: { id: string; slug: string }, revisionId: string, workspace: object, otherHost: string) {
  const installation = process.env.PENCIL_E2E_BASE_URL!
  const headers = { Origin: installation }
  const wordpress = await wordpressHost(installation)
  let context: BrowserContext | undefined
  const canary = 'synthetic-pencil-private-wordpress-answer'
  const responseRows = async () => {
    const result = await operator.request.post('/api/app/backup/export', { headers, data: {} })
    expect(result.status()).toBe(200)
    const tables: ArchiveTable[] = (await result.json()).payload.tables
    const responses = tables.find(table => table.name === 'responses')!
    const revision = responses.columns.indexOf('revision_id'), id = responses.columns.indexOf('id')
    return { tables, ids: responses.rows.filter(row => row[revision].value === revisionId).map(row => row[id].value) }
  }
  const allowed = [otherHost, wordpress.origin]
  try {
    context = await browser.newContext({ extraHTTPHeaders: {}, viewport: info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 } })
    const visitor = await context.newPage()
    expect((await operator.request.put('/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: allowed } })).status()).toBe(200)
    const before = await responseRows()
    const validPage = await wordpress.createPage('Customer feedback', `[pencil flow="${flow.slug}"]`)
    const invalidPage = await wordpress.createPage('Invalid shortcode', `[pencil] [pencil flow="Bad-slug"] [pencil flow="${flow.slug}" url="https://hostile.invalid"]`)
    const requested: string[] = []
    visitor.on('request', request => requested.push(request.url()))
    await visitor.goto(validPage)
    const iframe = visitor.locator('iframe')
    await expect(iframe).toHaveCount(1)
    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-top-navigation-by-user-activation')
    const embedded = visitor.frameLocator('iframe')
    await expect(embedded.getByRole('radio', { name: 'Great', exact: true })).toBeVisible()
    await expect.poll(() => visitor.evaluate(() => (window as unknown as HostEvidence).pencilEvents.some(event => event.type === 'pencil:loaded'))).toBe(true)
    expect(await visitor.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull()
    expect(await visitor.evaluate(() => { try { void document.querySelector('iframe')!.contentWindow!.document.body; return false } catch { return true } })).toBe(true)
    const child = visitor.frames().find(frame => frame.url().includes('/embed/'))!
    const assertHeight = async () => {
      const height = await child.locator('main').evaluate(element => Math.ceil(element.getBoundingClientRect().height))
      await expect.poll(() => iframe.evaluate(element => parseInt((element as HTMLIFrameElement).style.height))).toBe(height)
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      return height
    }
    const initialHeight = await assertHeight()
    await visitor.screenshot({ path: info.outputPath('wordpress-shortcode-public.png'), fullPage: true })
    await embedded.getByRole('radio', { name: 'Great', exact: true }).click()
    await embedded.getByRole('button', { name: 'Continue', exact: true }).click()
    await embedded.getByRole('textbox', { name: 'What could we do better?' }).fill(canary)
    await assertHeight()
    await embedded.getByRole('button', { name: 'Submit response', exact: true }).click()
    await expect(embedded.getByRole('heading', { name: 'Thank you. Your response has been received.' })).toBeVisible()
    expect(await assertHeight()).not.toBe(initialHeight)
    await expect.poll(() => visitor.evaluate(() => (window as unknown as HostEvidence).pencilEvents.filter(event => event.type === 'pencil:completed').length)).toBe(1)
    await visitor.screenshot({ path: info.outputPath('wordpress-shortcode-completed.png'), fullPage: true })
    const events = await visitor.evaluate(() => (window as unknown as HostEvidence).pencilEvents)
    expect(events.filter(event => event.type === 'pencil:loaded')).toHaveLength(1)
    expect(events.some(event => event.type === 'pencil:height')).toBe(true)
    for (const event of events) {
      expect(['pencil:loaded', 'pencil:height', 'pencil:completed']).toContain(event.type)
      if (event.type === 'pencil:height') {
        expect(Object.keys(event.detail as object)).toEqual(['height'])
        expect(Number.isInteger((event.detail as { height: number }).height)).toBe(true)
      } else expect(event.detail).toBeNull()
    }
    expect(await visitor.locator('body').innerText()).not.toContain(canary)
    expect(await visitor.content()).not.toContain(canary)
    expect(JSON.stringify(await visitor.evaluate(() => (window as unknown as HostEvidence).pencilMessages))).not.toContain(canary)
    expect(JSON.stringify(events)).not.toMatch(/answer|responseId|token|contact|synthetic-pencil-private/)
    expect(requested.join('\n')).not.toContain(canary)
    expect([...new Set(requested.map(url => new URL(url).origin))].sort()).toEqual([wordpress.origin, installation].sort())
    expect(visitor.url()).toBe(validPage)
    const after = await responseRows()
    expect(after.ids).toHaveLength(before.ids.length + 1)
    const added = after.ids.filter(id => !before.ids.includes(id))
    expect(added).toHaveLength(1)
    const answers = after.tables.find(table => table.name === 'response_answers')!
    const responseId = answers.columns.indexOf('response_id'), value = answers.columns.indexOf('value_json')
    expect(answers.rows.filter(row => row[responseId].value === added[0]).map(row => row[value].value)).toContain(JSON.stringify(canary))
    expect(JSON.stringify(events)).not.toContain(added[0])
    expect(JSON.stringify(await visitor.evaluate(() => (window as unknown as HostEvidence).pencilMessages))).not.toContain(added[0])

    const invalidRequests: string[] = []
    visitor.on('request', request => { if (new URL(request.url()).origin === installation || request.url().includes('hostile.invalid')) invalidRequests.push(request.url()) })
    await visitor.goto(invalidPage)
    await expect(visitor.getByRole('status')).toHaveCount(3)
    await expect(visitor.locator('iframe, script[src*="/embed.js"]')).toHaveCount(0)
    expect(invalidRequests).toEqual([])
    expect((await responseRows()).ids.sort()).toEqual(after.ids.sort())

    expect((await operator.request.put('/api/app/workspace', { headers, data: { ...workspace, embedAllowedOrigins: [otherHost] } })).status()).toBe(200)
    const refusedScript = visitor.waitForResponse(response => response.url().startsWith(`${installation}/embed.js?`))
    await visitor.goto(validPage)
    expect((await refusedScript).status()).toBe(403)
    await expect(visitor.locator('iframe')).toHaveCount(0)
    expect(await visitor.evaluate(() => (window as unknown as HostEvidence).pencilEvents)).toEqual([])
    const refusedFrame = await visitor.request.get(`${installation}/embed/${flow.slug}`, { headers: { Referer: wordpress.origin, 'Sec-Fetch-Dest': 'iframe' } })
    expect(refusedFrame.status()).toBe(403)
    expect(await refusedFrame.text()).not.toContain(canary)
    expect((await responseRows()).ids.sort()).toEqual(after.ids.sort())
    await visitor.screenshot({ path: info.outputPath('wordpress-disallowed-host.png'), fullPage: true })
  } finally {
    try { await context?.close() } finally { await wordpress.close() }
  }
}
