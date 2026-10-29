import { openStateDatabase, stateDatabaseFile } from './state-database'
import { createHash } from 'node:crypto'
import { ulid } from 'ulid'
import type { Locator, Page } from '@playwright/test'
import { expect, openMailLink } from './fixtures'

export async function signInEmptyWorkspace(page: Page) {
  const workspace = ulid()
  const address = createHash('sha256').update(workspace).digest()
  // API reads belong to this synthetic client too, rather than consuming the
  // shared loopback allowance used by other journeys. Real limits still apply.
  await page.context().setExtraHTTPHeaders({
    Origin: new URL(process.env.PENCIL_E2E_BASE_URL!).origin,
    'CF-Connecting-IP': `198.19.${address[0]}.${address[1]}`,
  })
  await page.goto('/signin')
  const directory = process.env.PENCIL_MIGRATION_STATE!
  const db = openStateDatabase(stateDatabaseFile(directory))
  const email = `author-${workspace.toLowerCase()}@example.test`
  const now = new Date().toISOString()
  try {
    db.prepare(`INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES (?,'Synthetic business','UTC','09:00','17:00',?,?)`).run(workspace, now, now)
    db.prepare(`INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES (?,?,?,'Synthetic operator',0,?,?)`).run(ulid(), workspace, email, now, now)
  } finally { db.close() }
  await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByLabel('Business name', { exact: true }).fill('Synthetic business')
  const timeZone = page.getByLabel('Time zone', { exact: true })
  await expect(timeZone).toHaveValue(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone))
  await timeZone.fill('UTC')
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
  await expect(page.getByText('Updating flows…')).toHaveCount(0)
  await expect(page.locator('.flow-card')).toHaveCount(0)
  expect(await (await page.request.get('/api/app/workspace')).json()).toMatchObject({ name: 'Synthetic business', timeZone: 'UTC' })
}

export async function checkAuthoringLayout(page: Page) {
  const copy = await page.locator('.operator-content').innerText()
  expect(copy).not.toMatch(/immutable|persisted|stable ID|draft v\d+/i)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (page.viewportSize()!.width === 390) expect(await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight)).toBeLessThanOrEqual(3)
}

/** Adds a step through the builder's one Add step menu. */
export async function addStep(scope: Locator | Page, name: 'Add question' | 'Add completion screen' | 'Add payment step' | 'Add welcome screen') {
  await scope.getByRole('button', { name: 'Add step', exact: true }).click()
  await scope.getByRole('menuitem', { name, exact: true }).click()
}

/** Adds a rule that matches on several conditions: the one Add rule button, then the rule's own switch when it starts as a simple answer rule. */
export async function addConditionRule(scope: Locator) {
  await scope.getByRole('button', { name: 'Add rule', exact: true }).click()
  const several = scope.getByRole('button', { name: 'Match several conditions', exact: true })
  if (await several.count()) await several.click()
}
