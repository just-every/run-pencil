import { openStateDatabase, stateDatabaseFile } from './state-database'
import { expect, test } from './fixtures'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// A visitor without a cookie learns no operator's address from /signin; only a link's login_hint fills the field.
test('sign-in reveals no operator email and prefills only from login_hint', async ({ page, request }) => {
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
  await page.goto('/signin?login_hint=Linked.Owner%40example.test')
  await expect(page.getByLabel('Operator email')).toHaveValue('linked.owner@example.test')
  await expect(page.getByRole('button', { name: 'Send magic link' })).toBeEnabled()
  if (process.env.PENCIL_SCREENSHOTS_DIR) {
    await mkdir(process.env.PENCIL_SCREENSHOTS_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_SCREENSHOTS_DIR, `login-hint-${page.viewportSize()!.width}.png`), fullPage: true, scale: 'css' })
  }
  await page.goto('/signin?login_hint=invalid')
  await expect(page.getByLabel('Operator email')).toHaveValue('')
})
