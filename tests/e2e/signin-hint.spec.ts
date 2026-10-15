import { openStateDatabase, stateDatabaseFile } from './state-database'
import { expect, test } from './fixtures'

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
})
