import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { contract } from './contract'
import { signInEmptyWorkspace } from './authoring-helpers'
import { openStateDatabase, stateDatabaseFile } from './state-database'

contract(['INTEG-010', 'INTEG-015'], 'an owner adds a response webhook, sees its secret once, tests it, and an operator sees the disabled alert at both widths', async ({ page }, info) => {
  test.setTimeout(120_000)
  const origin = new URL(info.project.use.baseURL!).origin
  await signInEmptyWorkspace(page)
  const call = async <T,>(path: string, data?: unknown) => { const response = await page.request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) }); expect(response.status(), await response.text()).toBeLessThan(300); return await response.json() as T }
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Webhook feedback', slug: `webhooks-${info.project.name}-${Date.now()}` })
  const receiver = createServer((request, response) => { request.resume(); request.on('end', () => { response.writeHead(request.url === '/down' ? 500 : 204).end() }) })
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve))
  const db = openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  try {
    const address = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/down`
    await page.goto('/app/settings'); await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    const hooks = page.getByRole('region', { name: 'Response webhooks' })
    await hooks.getByLabel('Endpoint address').fill(address); await hooks.getByLabel('Forms').selectOption({ label: 'Webhook feedback' })
    await hooks.getByRole('button', { name: 'Add endpoint' }).click()
    const secret = hooks.getByTestId('webhook-secret'); await expect(secret).toContainText('pwh_')
    const shown = (await secret.textContent())!.match(/pwh_[\w-]+/)![0]
    await hooks.getByRole('button', { name: 'Send test event' }).click()
    await expect(hooks.getByText(/Test event was not delivered: The receiver answered 500/)).toBeVisible()
    await expect(hooks.getByText(/webhook\.test/).first()).toBeVisible()
    await page.reload(); await expect(hooks.getByText(address)).toBeVisible(); await expect(hooks.getByTestId('webhook-secret')).toHaveCount(0)
    expect(await page.content()).not.toContain(shown)
    db.prepare("UPDATE response_webhook_endpoints SET state='disabled',disabled_at=?,disabled_reason='No delivery was confirmed for 24 hours (11 failed attempts in a row). Fix the receiver, then resume the endpoint.',failure_streak=11").run(new Date().toISOString())
    await page.reload(); await expect(page.getByRole('alert', { name: 'Response webhook alerts' })).toContainText('is disabled')
    await expect(hooks.getByText(/Disabled: No delivery was confirmed for 24 hours/)).toBeVisible()
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations).toEqual([])
      await page.screenshot({ path: info.outputPath(`webhooks-${viewport.width}.png`), fullPage: true })
    }
    await hooks.getByRole('button', { name: 'Resume' }).click(); await expect(page.getByRole('alert', { name: 'Response webhook alerts' })).toHaveCount(0)
    expect(flow.id).toBeTruthy()
  } finally { db.close(); await new Promise<void>(resolve => { receiver.closeAllConnections(); receiver.close(() => resolve()) }) }
})
