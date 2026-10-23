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
  let down = true
  const receiver = createServer((request, response) => { request.resume(); request.on('end', () => { response.writeHead(down ? 500 : 204).end() }) })
  await new Promise<void>(resolve => receiver.listen(0, '127.0.0.1', resolve))
  const db = openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  try {
    const address = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/pencil`
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
    // INTEG-015: five responses collected while the receiver is down are five failed deliveries with an alert; repairing the receiver and replaying confirms each once.
    const revision = db.prepare('SELECT id, flow_id AS flowId FROM flow_revisions WHERE flow_id = ? LIMIT 1').get(flow.id) as { id: string; flowId: string }
    const workspace = db.prepare('SELECT workspace_id AS id FROM flows WHERE id = ?').get(flow.id) as { id: string }
    const stamp = new Date().toISOString(), responses = Array.from({ length: 5 }, (_, index) => `synthetic-pencil-response-${info.project.name}-${index}`)
    for (const id of responses) db.prepare("INSERT INTO responses(id,workspace_id,flow_id,revision_id,session_id,session_token_hash,idempotency_key,state,completed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'released',?,?,?)").run(id, workspace.id, flow.id, revision.id, `${id}-session`, `${id}-hash`, `${id}-key`, stamp, stamp, stamp)
    const mine = `event_type = 'response.created' AND endpoint_id IN (SELECT id FROM response_webhook_endpoints WHERE workspace_id = '${workspace.id}')`
    expect(db.prepare(`SELECT count(*) AS n FROM response_event_deliveries WHERE ${mine}`).get()).toEqual({ n: 5 })
    for (const delivery of db.prepare(`SELECT id FROM response_event_deliveries WHERE ${mine}`).all() as Array<{ id: string }>) {
      db.prepare("UPDATE response_event_deliveries SET status='failed', attempts=1, reason='The receiver answered 500. No more retries: the 24-hour window is over. Replay it after fixing the receiver.' WHERE id = ?").run(delivery.id)
      db.prepare("INSERT INTO response_event_attempts(id,delivery_id,ordinal,event,http_status,outcome_class,reason,created_at) VALUES(?,?,1,'failed',500,'5xx','The receiver answered 500.',?)").run(`${delivery.id}-attempt`, delivery.id, stamp)
    }
    await page.reload()
    await expect(page.getByRole('alert', { name: 'Response webhook alerts' })).toContainText('5 events that could not be delivered')
    await expect(hooks.getByTestId('webhook-undelivered')).toContainText('Not delivered yet (5)')
    const ledger = page.getByRole('region', { name: 'Delivery ledger' })
    await ledger.getByLabel('Show').selectOption('failed'); await expect(ledger.locator('ul.webhook-deliveries > li')).toHaveCount(5)
    for (const id of responses) await expect(ledger.getByText(id)).toBeVisible()
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations).toEqual([])
      await page.screenshot({ path: info.outputPath(`webhook-ledger-failed-${viewport.width}.png`), fullPage: true })
    }
    down = false
    for (let remaining = 4; remaining >= 0; remaining--) { await hooks.locator('li[data-status="failed"]').first().getByRole('button', { name: 'Replay this event' }).click(); await expect(hooks.locator('li[data-status="failed"]')).toHaveCount(remaining) }
    await expect(hooks.getByTestId('webhook-undelivered')).toHaveCount(0); await expect(page.getByRole('alert', { name: 'Response webhook alerts' })).toHaveCount(0)
    await page.reload(); await ledger.getByLabel('Show').selectOption('confirmed'); await expect(ledger.locator('ul.webhook-deliveries > li')).toHaveCount(5)
    expect(db.prepare(`SELECT count(*) AS n FROM response_event_deliveries WHERE ${mine} AND status = 'confirmed'`).get()).toEqual({ n: 5 })
    await page.screenshot({ path: info.outputPath(`webhook-ledger-repaired-${info.project.name}.png`), fullPage: true })
    // GOV-005: the connection events are in the audit log, without the secret, at both widths.
    await page.goto('/app/audit'); await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
    const recorded = page.getByRole('region', { name: 'Recorded activity' })
    await expect(recorded.getByText('connection · saved').first()).toBeVisible(); await expect(recorded.getByText('connection · tested').first()).toBeVisible()
    expect(await page.content()).not.toContain(shown)
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations).toEqual([])
      await page.screenshot({ path: info.outputPath(`audit-events-${viewport.width}.png`), fullPage: true })
    }
    expect(flow.id).toBeTruthy()
  } finally { db.close(); await new Promise<void>(resolve => { receiver.closeAllConnections(); receiver.close(() => resolve()) }) }
})
