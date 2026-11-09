import { randomUUID } from 'node:crypto'
import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import type { BuilderDraft } from '../../src/core/app/api'
import { expect } from './fixtures'
import { audienceScreen, invitationMail } from './distribution-helpers'

/** Genuine email buttons defer the stable choice until the respondent confirms. */
export async function proveInvitationChoice(owner: Page, info: TestInfo) {
  const origin = new URL(info.project.use.baseURL!).origin
  const call = async (path: string, data?: unknown) => {
    const response = await owner.request.fetch(path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin }, ...(data === undefined ? {} : { data }) })
    expect(response.status(), path).toBeLessThan(300)
    return response.json()
  }
  const slug = `synthetic-pencil-choice-${randomUUID()}`
  const flow = await call('/api/app/flows', { title: 'Choose a workshop', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = async () => await call(`${path}/draft`) as BuilderDraft
  for (const step of [
    { kind: 'question', questionType: 'single_choice', prompt: 'Which workshop?', required: true, choices: [
      { value: 'writing', label: 'Writing workshop' }, { value: 'drawing', label: 'Drawing workshop' }, { value: 'music', label: 'Music workshop' },
    ] },
    { kind: 'question', questionType: 'short_text', prompt: 'What would you like to learn?', required: true },
    { kind: 'question', questionType: 'short_text', prompt: 'Any preparation requests?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Workshop choice recorded' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
  const authored = await draft()
  const question = authored.steps.find(step => step.prompt === 'Which workshop?')!
  const selected = authored.choices.find(choice => choice.stepId === question.id && choice.value === 'drawing')!
  expect(selected.label).toBe('Drawing workshop')
  await call(`${path}/publish`, { expectedVersion: authored.flow.draftVersion })
  const recipient = [slug, 'example.test'].join('@')
  const contact = await call('/api/app/distribution/contacts', { name: 'Synthetic workshop recipient', email: recipient })
  await call(`${path}/distribution`, { contactIds: [contact.id], commandKey: slug })
  const mail = await invitationMail(owner, recipient)
  expect(mail.answerLinks.map(link => new URL(link).searchParams.get('__pencil_first'))).toEqual(
    ['writing', 'drawing', 'music'].map(value => authored.choices.find(choice => choice.stepId === question.id && choice.value === value)!.id),
  )
  const distribution = await call(`${path}/distribution`)
  const participant = distribution.participants.find((item: { kind: string; email: string }) => item.kind === 'invitation' && item.email === recipient)
  const traffic = () => call(`${path}/traffic?revisionId=${participant.revisionId}`)
  const ledger = () => call(`${path}/ledger`)
  const inert = async () => {
    expect((await traffic()).totals).toMatchObject({ views: 0, starts: 0, submissions: 0 })
    expect((await ledger()).total).toBe(0)
    expect(await call(`${path}/distribution`)).toEqual(distribution)
  }
  const contexts: BrowserContext[] = []
  try {
    const fresh = async () => {
      const context = await owner.context().browser()!.newContext({ baseURL: origin, viewport: owner.viewportSize(), isMobile: false, deviceScaleFactor: 1, extraHTTPHeaders: { 'CF-Connecting-IP': '198.19.51.14' } })
      contexts.push(context)
      const page = await context.newPage()
      const writes: string[] = []
      page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/public/')) writes.push(new URL(request.url()).pathname) })
      return { page, writes }
    }
    // Invalid hints cannot turn an arbitrary value or numeric position into a choice.
    for (const hint of ['synthetic-pencil-unknown', '-1', '999']) {
      const { page, writes } = await fresh()
      const target = new URL(mail.invitation)
      target.searchParams.set('__pencil_first', hint)
      await page.goto(target.href)
      await expect(page.getByRole('heading', { name: 'Which workshop?', exact: true })).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(3)
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
      await expect(page.getByText(/Selected from email:/)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
      if (hint === '999') await audienceScreen(page, info, 'choice-invalid-hint')
      expect(writes).toEqual([])
      await inert()
      await page.context().close()
    }
    const { page, writes } = await fresh()
    await page.goto('about:blank')
    await page.setContent(mail.html)
    // Mail lacks a viewport tag, so use a fixed CSS viewport instead of mobile UA scaling.
    expect(await page.evaluate(() => innerWidth)).toBe(owner.viewportSize()!.width)
    await audienceScreen(page, info, 'choice-email')
    await Promise.all([page.waitForNavigation(), page.getByRole('link', { name: 'Which workshop?: Drawing workshop', exact: true }).click()])
    await expect(page.getByRole('heading', { name: 'What would you like to learn?', exact: true })).toBeVisible()
    await expect(page.getByText('Selected from email: Drawing workshop · not submitted yet. Continue or submit to confirm.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled()
    await audienceScreen(page, info, 'choice-uncommitted')
    expect(writes).toEqual([])
    await inert()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Drawing workshop', exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'What would you like to learn?', exact: true })).toBeVisible()
    await page.getByRole('textbox').fill('Synthetic pencil shading')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Any preparation requests?', exact: true })).toBeVisible()
    expect((await ledger()).total).toBe(0)
    await page.getByRole('textbox').fill('Synthetic pencil paper')
    await page.waitForTimeout(4500)
    const submission = page.waitForResponse(response => new URL(response.url()).pathname === `/api/public/flows/${slug}/responses` && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Submit response', exact: true }).click()
    const submitted = await submission
    expect(submitted.status()).toBeLessThan(300)
    const receipt = await submitted.json()
    expect(receipt).toMatchObject({ idempotent: false, disposition: 'released' })
    expect(submitted.request().postDataJSON().answers).toContainEqual({ stepId: question.id, value: selected.id })
    await expect(page.getByRole('heading', { name: 'Workshop choice recorded', exact: true })).toBeVisible()
    await audienceScreen(page, info, 'choice-completed')
    const stored = await ledger()
    expect(stored.total).toBe(1)
    expect(stored.responses[0].answers.filter((answer: { stepId: string }) => answer.stepId === question.id)).toEqual([
      expect.objectContaining({ value: selected.id }),
    ])
    // Replay the actual admitted request; one completion and the same choice survive.
    const replay = await page.request.post(submitted.url(), { headers: { Origin: origin }, data: submitted.request().postDataJSON() })
    expect(replay.status()).toBeLessThan(300)
    expect(await replay.json()).toEqual({ ...receipt, idempotent: true })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Workshop choice recorded', exact: true })).toBeVisible()
    // A ledger read assigns a new query cutoff; retained business data stays identical.
    expect(await ledger()).toEqual({ ...stored, cutoff: expect.any(String) })
    expect((await traffic()).totals.submissions).toBe(1)
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
}
