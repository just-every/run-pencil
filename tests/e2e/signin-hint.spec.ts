import { openStateDatabase, stateDatabaseFile } from './state-database'
import { expect, test } from './fixtures'
import { signInEmptyWorkspace } from './authoring-helpers'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// A visitor without a cookie learns no operator's address from /signin; only a link's login_hint fills the field.
test('sign-in reveals no operator email and prefills only from login_hint', async ({ page, request }) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const db = openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  let emails: string[]
  try {
    emails = (db.prepare("SELECT email FROM oa_operators WHERE status = 'active'").all() as { email: string }[]).map(row => row.email)
  } finally { db.close() }
  expect(emails.length).toBeGreaterThan(0)
  const anonymous = await request.get('/signin')
  expect(anonymous.status()).toBe(200)
  const html = (await anonymous.text()).toLowerCase()
  for (const email of emails) expect(html).not.toContain(email.toLowerCase())
  await page.goto('/signin')
  await expect(page.getByLabel('Operator email')).toHaveValue('')
  // Follow the app's generated sign-in declaration as RER's Open app does.
  const { surfaces: { app: { signIn } } } = JSON.parse(await readFile('management/integration/deployment-spec.json', 'utf8'))
  const openApp = new URL(signIn.path, 'https://pencil.example.test')
  if (signIn.loginHint) openApp.searchParams.set('login_hint', 'Linked.Owner@example.test')
  await page.goto(openApp.pathname + openApp.search)
  await expect(page.getByLabel('Operator email')).toHaveValue('linked.owner@example.test')
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeEnabled()
  if (process.env.PENCIL_SCREENSHOTS_DIR) {
    await mkdir(process.env.PENCIL_SCREENSHOTS_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_SCREENSHOTS_DIR, `login-hint-${page.viewportSize()!.width}.png`), fullPage: true, scale: 'css' })
  }
  await page.goto('/signin?login_hint=invalid')
  await expect(page.getByLabel('Operator email')).toHaveValue('')
  await signInEmptyWorkspace(page)
  await page.goto('/signin?login_hint=another@example.test')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  const session = await (await page.request.get('/api/app/workspace')).json()
  const setupDb = openStateDatabase(stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!))
  try {
    setupDb.prepare('UPDATE workspaces SET first_run_completed_at = NULL WHERE id = ?').run(session.id)
  } finally { setupDb.close() }
  await page.goto('/signin?login_hint=another@example.test')
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('button', { name: 'Finish setup', exact: true })).toBeVisible()
})
