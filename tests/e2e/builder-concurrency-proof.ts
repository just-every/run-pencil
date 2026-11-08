import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import type { BuilderDraft } from '../../src/core/app/api'
import { expect, openMailLink } from './fixtures'

/** Two invited operators exercise the builder's real stale step-save door. */
export async function proveBuilderConcurrency(browser: Browser, inviter: Page, info: TestInfo, output: string) {
  const origin = new URL(inviter.url()).origin
  const key = `synthetic-pencil-${randomUUID()}`
  const created = await inviter.request.post('/api/app/flows', {
    headers: { Origin: origin },
    data: { title: 'Concurrent step edits', slug: key, template: 'feedback' },
  })
  expect(created.status()).toBe(201)
  const { id: flowId } = await created.json()
  const draftPath = `/api/app/flows/${flowId}/draft`
  const builderPath = `/app/flows/${flowId}/builder`
  const contexts: BrowserContext[] = []
  try {
    const pages: Page[] = []
    const operatorIds: string[] = []
    const nativeIds: string[] = []
    for (const number of [1, 2]) {
      const email = [`${key}-${number}`, 'example.test'].join('@')
      const invitation = await inviter.request.post('/api/app/operators', {
        headers: { Origin: origin },
        data: { email, displayName: `Concurrent operator ${number}` },
      })
      expect(invitation.status()).toBe(201)
      const { id } = await invitation.json()
      operatorIds.push(id)
      const context = await browser.newContext({
        baseURL: origin,
        viewport: inviter.viewportSize(),
        extraHTTPHeaders: { Origin: origin, 'CF-Connecting-IP': `198.19.${number}.44` },
      })
      contexts.push(context)
      const page = await context.newPage()
      // Fresh contexts start sessionless; credentials come only from native mail.
      expect((await page.request.get('/auth/session')).status()).toBe(401)
      await page.goto('/signin')
      await page.getByLabel('Operator email').fill(email)
      await page.getByRole('button', { name: /Send.*link/i }).click()
      await openMailLink(page, email)
      await page.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect(page.locator('.operator-shell[data-hydrated=true]')).toBeVisible()
      const session = await page.request.get('/auth/session')
      expect(session.status()).toBe(200)
      const authenticated = await session.json()
      expect(authenticated).toMatchObject({ operator: { id: expect.any(String), email } })
      nativeIds.push(authenticated.operator.id)
      const operators = await page.request.get('/api/app/operators')
      expect(operators.status()).toBe(200)
      expect(await operators.json()).toContainEqual(expect.objectContaining({ id, email }))
      const workspace = await page.request.get('/api/app/workspace')
      expect(workspace.status()).toBe(200)
      expect(await workspace.json()).toEqual(await (await inviter.request.get('/api/app/workspace')).json())
      pages.push(page)
    }
    expect(new Set(operatorIds).size).toBe(2)
    expect(new Set(nativeIds).size).toBe(2)
    const [first, second] = pages
    const editor = (page: Page) => page.getByRole('complementary', { name: 'Step settings' })
    const prompt = (page: Page) => editor(page).getByLabel('Prompt', { exact: true })
    const save = (page: Page) => editor(page).getByRole('button', { name: 'Save', exact: true })
    const isDraftRead = (response: import('@playwright/test').Response) =>
      new URL(response.url()).pathname === draftPath && response.request().method() === 'GET' && response.status() === 200
    const load = async (page: Page) => {
      const read = page.waitForResponse(isDraftRead)
      await page.goto(builderPath)
      const draft = await (await read).json() as BuilderDraft
      await expect(prompt(page)).toHaveValue(draft.steps.find(step => step.kind === 'question')!.prompt)
      await expect(page.getByRole('button', { name: 'Preview draft', exact: true })).toBeEnabled()
      return draft
    }
    const initial = await load(first)
    const otherInitial = await load(second)
    expect(otherInitial).toEqual(initial)
    const step = initial.steps.find(step => step.kind === 'question')!
    const winning = 'First operator saved this step'
    const losing = 'Second operator stale step must never be stored'
    await prompt(first).fill(winning)
    await prompt(second).fill(losing)
    const submit = async (page: Page, content: string) => {
      const pending = page.waitForResponse(response => new URL(response.url()).pathname === draftPath && response.request().method() === 'PUT')
      await save(page).click()
      const response = await pending
      expect(response.request().postDataJSON()).toMatchObject({ stepId: step.id, prompt: content, expectedVersion: initial.flow.draftVersion })
      expect(response.status()).toBe(200)
      return response.json()
    }
    expect(await submit(first, winning)).toMatchObject({ kind: 'updated', draftVersion: initial.flow.draftVersion + 1, step: { id: step.id, prompt: winning } })
    await expect(first.getByText('Saved.', { exact: true })).toBeVisible()
    await expect(first.getByRole('button', { name: 'Preview draft', exact: true })).toBeEnabled()
    const savedResponse = await first.request.get(draftPath)
    expect(savedResponse.status()).toBe(200)
    const saved = await savedResponse.json() as BuilderDraft
    expect(saved.flow.draftVersion).toBe(initial.flow.draftVersion + 1)
    expect(saved.steps.find(item => item.id === step.id)?.prompt).toBe(winning)
    // The second editor still holds the old version and its own unsaved text.
    await expect(prompt(second)).toHaveValue(losing)
    expect(await submit(second, losing)).toEqual({ kind: 'conflict', latestVersion: saved.flow.draftVersion })
    const conflict = second.getByRole('alert')
    await expect(conflict).toHaveText('Another operator saved first. The latest draft has been reloaded.')
    await expect(prompt(second)).toHaveValue(winning)
    const canvas = second.getByLabel('Draft question canvas')
    await expect(canvas.getByText(winning, { exact: true })).toBeVisible()
    await expect(second.getByText(losing, { exact: true })).toHaveCount(0)
    await conflict.scrollIntoViewIfNeeded()
    await second.screenshot({ path: `${output}/${info.project.name}-builder-conflict.png`, fullPage: true })
    const afterConflict = await second.request.get(draftPath)
    expect(afterConflict.status()).toBe(200)
    expect(await afterConflict.json()).toEqual(saved)
    await second.reload()
    await expect(prompt(second)).toHaveValue(winning)
    await expect(canvas.getByText(winning, { exact: true })).toBeVisible()
    await expect(second.getByText(losing, { exact: true })).toHaveCount(0)
    for (const page of pages) {
      const persisted = await page.request.get(draftPath)
      expect(persisted.status()).toBe(200)
      expect(await persisted.json()).toEqual(saved)
    }
    await prompt(second).scrollIntoViewIfNeeded()
    await second.screenshot({ path: `${output}/${info.project.name}-builder-reloaded.png`, fullPage: true })
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
}
