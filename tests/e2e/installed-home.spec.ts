import { expect } from './fixtures'
import { contract } from './contract'
import { signInBrand } from './brand-helpers'
import { openStateDatabase, stateDatabaseFile } from './state-database'

type Row = { id: string; name: string; time_zone: string; brand_configured: number; first_run_completed_at: string | null; public_flow_slug: string | null }

// The installed root without a selected public form: the shared Lobby, which reads the same claim as /setup/state.
// The journey starts from an unclaimed installation (no workspace has confirmed first-run setup) and the owner
// confirms /setup; every workspace row is restored afterwards.
contract('HOME-001', 'with no public form the installed root is the Lobby: Finish setup until the owner confirms /setup, then Sign in, as /setup/state says', async ({ page }) => {
  const file = stateDatabaseFile(process.env.PENCIL_MIGRATION_STATE!)
  const db = openStateDatabase(file)
  let rows: Row[]
  try {
    rows = db.prepare('SELECT id, name, time_zone, brand_configured, first_run_completed_at, public_flow_slug FROM workspaces').all() as Row[]
    db.prepare('UPDATE workspaces SET first_run_completed_at = NULL, public_flow_slug = NULL').run()
  } finally { db.close() }
  try {
    expect(await (await page.request.get('/setup/state')).json()).toEqual({ state: 'unclaimed' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-state', 'unclaimed')
    await expect(page.locator('main a[href="/setup"]')).toBeVisible()
    await expect(page.locator('main a[href="/signin"]')).toHaveCount(0)

    await signInBrand(page)
    const confirm = await page.request.post('/setup', { headers: { Origin: process.env.PENCIL_E2E_BASE_URL! }, data: { name: 'Northwind', timeZone: 'Australia/Brisbane' }, maxRedirects: 0 })
    expect(confirm.status()).toBe(303)

    expect(await (await page.request.get('/setup/state')).json()).toEqual({ state: 'claimed' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-state', 'claimed')
    await expect(page.locator('main a[href="/signin"]')).toBeVisible()
    await expect(page.locator('main a[href="/setup"]')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally {
    const restore = openStateDatabase(file)
    try {
      const update = restore.prepare('UPDATE workspaces SET name = ?, time_zone = ?, brand_configured = ?, first_run_completed_at = ?, public_flow_slug = ? WHERE id = ?')
      for (const row of rows) update.run(row.name, row.time_zone, row.brand_configured, row.first_run_completed_at, row.public_flow_slug, row.id)
    } finally { restore.close() }
  }
})
