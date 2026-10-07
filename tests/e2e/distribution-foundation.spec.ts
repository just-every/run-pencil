import { operatorEmail } from './auth-identity'
import AxeBuilder from '@axe-core/playwright'
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'
import { contract } from './contract'
// Isolate this new journey's API traffic; actual per-address rate limits stay enabled.
test.use({ extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.240.11' } })
contract(['RESP-005','RESP-008','DIST-005','LEDG-001','LEDG-003','RSLT-001','RSLT-003','RSLT-004','BASE-PUBLIC-003'], 'native invitation and opt-out are keyboard accessible; response filters remain separate from revision summary', async ({ page }, info) => {
  test.setTimeout(120000)
  for (const path of ['/i/private-invalid-capability', '/optout/private-invalid-capability', '/i/%E0%A4%A', '/optout/' + 'A'.repeat(64)]) {
    const refused = await page.request.get(path)
    expect(refused.status()).toBe(400)
    expect(await refused.json()).toEqual({ error: 'VALIDATION_ERROR', message: 'Invalid request path parameters.' })
    expect(await refused.text()).not.toContain('private-invalid-capability')
  }
  expect((await page.request.get('/i/' + '0'.repeat(64))).status()).toBe(404)
  page.setDefaultTimeout(15000)
  const request = page.request, headers = { Origin: new URL(info.project.use.baseURL!).origin }
  const call = async (path: string, data?: unknown) => {
    const response = await request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return response.status() === 204 ? undefined : await response.json()
  }
  await call('/auth/magic-link', { email: operatorEmail() })
  const inbox = await call(`/auth/local-inbox?email=${encodeURIComponent(operatorEmail())}`)
  await request.post('/auth/confirm', { data: { token: inbox.messages[0].magicLinkToken }, headers , maxRedirects: 0 })
  const slug = `distribution-browser-${info.project.name}-${Date.now()}`
  const flow = await call('/api/app/flows', { title: 'Synthetic invitation review', slug })
  const path = `/api/app/flows/${flow.id}`
  for (const step of [{ kind: 'question', questionType: 'short_text', prompt: 'Your feedback', required: true }, { kind: 'completion', questionType: null, prompt: 'Invitation recorded' }]) {
    const draft = await call(`${path}/draft`)
    await call(`${path}/draft/steps`, { expectedVersion: draft.flow.draftVersion, step })
  }
  await call(`${path}/publish`, { expectedVersion: (await call(`${path}/draft`)).flow.draftVersion })
  await page.goto(`/app/flows/${flow.id}/builder`)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByLabel('Recipient name').fill('Synthetic browser recipient')
  await page.getByLabel('Recipient email').fill(`${slug}@example.test`)
  await page.getByRole('button', { name: 'Save recipient' }).click()
  await expect(page.getByRole('status')).toContainText('No mail was sent')
  await page.getByRole('checkbox', { name: new RegExp(slug) }).check()
  await page.getByRole('button', { name: 'Queue selected invitations' }).click()
  await expect(page.getByRole('status')).toContainText('Review each durable delivery outcome')
  await expect(page.getByText(/Delivery uses the configured mail provider/)).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  const directory = process.env.PENCIL_MIGRATION_STATE!
  const db = new DatabaseSync(join(directory, readdirSync(directory).find(name => name.endsWith('.sqlite'))!))
  try {
    // Read a token from isolated local test custody, not a mail-delivery receipt.
    const participant = db.prepare('SELECT id, token, opt_out_token, revision_id FROM invitation_participants WHERE email_snapshot = ?').get(`${slug}@example.test`) as { id: string; token: string; opt_out_token: string; revision_id: string }
    await page.goto(`/i/${participant.token}`)
    await expect(page.getByText(/identified through your invitation/)).toBeVisible()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    if (process.env.PENCIL_CAPTURE_DIR) await page.screenshot({ path: `${process.env.PENCIL_CAPTURE_DIR}/${info.project.name}-invitation.jpg`, type: 'jpeg', fullPage: true })
    await page.getByRole('textbox').focus()
    await page.keyboard.type('Synthetic identified answer')
    await expect.poll(() => db.prepare('SELECT count(*) AS n FROM respondent_sessions WHERE revision_id = ?').get(participant.revision_id)?.n).toBe(1)
    db.prepare('UPDATE respondent_sessions SET created_at = ? WHERE revision_id = ?').run(new Date(Date.now() - 5000).toISOString(), participant.revision_id)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Submit response', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Invitation recorded' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Invitation recorded' })).toBeVisible()
    expect(db.prepare('SELECT count(*) AS n FROM responses WHERE participant_id = ?').get(participant.id)?.n).toBe(1)
    await page.goto(`/optout/${participant.opt_out_token}`)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Stop future flow mail' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('Your opt-out is saved')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    if (process.env.PENCIL_CAPTURE_DIR) await page.screenshot({ path: `${process.env.PENCIL_CAPTURE_DIR}/${info.project.name}-optout.jpg`, type: 'jpeg', fullPage: true })
    await page.goto(`/app/flows/${flow.id}/results`)
    await expect(page.getByText('1 completed / 1 starts', { exact: true })).toBeVisible()
    await expect(page.getByText(/Summary scope: revision 1/)).toBeVisible()
    await page.getByLabel('Source', { exact: true }).selectOption('direct')
    await expect(page.getByText('No released response matches this filter.')).toBeVisible()
    await expect(page.getByText('1 completed / 1 starts', { exact: true })).toBeVisible()
    await expect(page.getByText('1 recorded starts', { exact: true })).toBeVisible()
    await page.getByLabel('Source', { exact: true }).selectOption('invitation')
    await page.getByLabel('Participant status', { exact: true }).selectOption('opted-out')
    await expect(page.getByText(/1 matching completed responses/)).toBeVisible()
    await page.getByRole('button', { name: /View answers/ }).click()
    await expect(page.getByText(/Invited participant: Synthetic browser recipient/)).toBeVisible()
    await expect(page.getByText('Synthetic identified answer', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { db.close() }
})
