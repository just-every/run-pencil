import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { contract } from './contract'
import type { Page } from '@playwright/test'
import { expect, openMailLink, test } from './fixtures'
import { operatorEmail } from './auth-identity'
import { appHeaders } from './api-headers'
import { testDevKey } from '../helpers/dev-key.mjs'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

async function inspectState(page: Page, name: string, project: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => {
    const title = document.querySelector('h1')!.getBoundingClientRect()
    return document.documentElement.scrollWidth <= innerWidth && title.left >= 0 && title.right <= innerWidth
  }), `The ${name} state fits the viewport.`).toBe(true)
  if (process.env.PENCIL_CAPTURE_DIR) {
    await mkdir(process.env.PENCIL_CAPTURE_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.PENCIL_CAPTURE_DIR, `${name}-${project}.png`), fullPage: true })
  }
}

contract(['PART-002','RSLT-013'], 'a respondent saves two answers, resumes privately on another device and sees completion on reuse', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  const email = operatorEmail()
  await page.goto('/signin'); await page.getByLabel('Operator email').fill(email)
  await page.getByRole('button', { name: /Send.*link/i }).click()
  await openMailLink(page, email); await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your flows' })).toBeVisible()
  const call = async <T,>(path: string, data?: unknown): Promise<T> => {
    const response = data === undefined ? await page.request.get(path) : await page.request.post(path, { headers: appHeaders, data })
    expect(response.ok(), path).toBe(true)
    return response.status() === 204 ? undefined as T : await response.json() as T
  }
  const slug = `client-intake-${info.project.name}-${Date.now()}`
  const flow = await call<{id:string}>('/api/app/flows', { title: 'Harbour Studio client intake', slug })
  const path = `/api/app/flows/${flow.id}`
  const draft = () => call<BuilderDraft>(`${path}/draft`)
  for (const step of [
    { kind: 'question', questionType: 'short_text', prompt: 'What is your name?', required: true },
    { kind: 'question', questionType: 'email', prompt: 'What is your work email?', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'Tell us about your project.', required: true },
    { kind: 'completion', questionType: null, prompt: 'Your project brief is with us.' },
  ]) await call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
  await call(`${path}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
  const original=await call<{revision:{id:string}}>(`/api/public/flows/${slug}`)
  const origin = new URL(page.url()).origin
  const firstContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport, extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.182.10' } })
  const otherContext = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport, extraHTTPHeaders: { 'CF-Connecting-IP': '198.18.182.11' } })
  try {
    const first = await firstContext.newPage()
    await first.goto(`/f/${slug}`)
    await first.getByRole('textbox', { name: 'What is your name?' }).fill('Jo Taylor')
    await first.getByRole('button', { name: 'Continue', exact: true }).click()
    await first.getByRole('textbox', { name: 'What is your work email?' }).fill('jo@harbour.example')
    await first.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(first.getByRole('heading', { name: 'Tell us about your project.' })).toBeVisible()
    await first.getByRole('button', { name: 'Save and finish later' }).click()
    const resumeEmail = `resume-${info.project.name}@example.test`
    await first.getByLabel('Email for your resume link').fill(resumeEmail)
    await inspectState(first, 'save-panel', info.project.name)
    await first.getByRole('button', { name: 'Email resume link' }).click()
    await expect(first.getByRole('status')).toContainText('Your answers are saved.')
    await inspectState(first, 'save', info.project.name)
    const captured = await page.request.get('/__test/mail', { headers: { 'x-rer-dev-key': testDevKey } }).then(response => response.json())
    const message = captured.messages.find((message: {to:string|Array<string|{email:string}>}) => (Array.isArray(message.to) ? message.to : [message.to]).some(to => (typeof to === 'string' ? to : to.email) === resumeEmail))
    const link = /https?:\/\/[^\s]+[?&]resume=[a-f0-9]{64}/.exec(message?.text ?? '')?.[0]
    expect(Boolean(link), 'The paid-mail receiver captured one private resume link.').toBe(true)
    expect(new URL(link!).origin === origin, 'The emailed link uses this installation origin.').toBe(true)
    const target = link!
    expect((await call<Ledger>(`${path}/ledger`)).total).toBe(0)
    // A later publication must not reinterpret the saved answers.
    await call(`${path}/publish`, { expectedVersion: (await draft()).flow.draftVersion })
    const resumed = await otherContext.newPage()
    await resumed.goto(target).catch(() => { throw new Error('The private emailed resume link could not load.') })
    await expect(resumed.getByRole('heading', { name: 'Tell us about your project.' })).toBeVisible()
    await resumed.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(resumed.getByRole('textbox', { name: 'What is your work email?' })).toHaveValue('jo@harbour.example')
    await resumed.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(resumed.getByRole('textbox', { name: 'What is your name?' })).toHaveValue('Jo Taylor')
    await resumed.getByRole('button', { name: 'Continue', exact: true }).click()
    await resumed.getByRole('button', { name: 'Continue', exact: true }).click()
    await resumed.getByRole('textbox', { name: 'Tell us about your project.' }).fill('We need a booking site for our new studio.')
    await inspectState(resumed, 'resume', info.project.name)
    // The minimum now measures this device's signed document load, not the old session.
    await resumed.waitForTimeout(3100)
    await resumed.getByRole('button', { name: 'Submit response' }).click()
    await expect(resumed.getByRole('heading', { name: 'Your project brief is with us.' })).toBeVisible()
    await resumed.goto(target).catch(() => { throw new Error('The private emailed resume link could not load.') })
    await expect(resumed.getByRole('heading', { name: 'Your project brief is with us.' })).toBeVisible()
    await expect(resumed.getByRole('button', { name: 'Save and finish later' })).toHaveCount(0)
    const ledger = await call<Ledger>(`${path}/ledger`)
    expect(ledger.total).toBe(1)
    const traffic=await call<{totals:{views:number;starts:number;submissions:number}}>(`${path}/traffic?revisionId=${original.revision.id}`)
    expect(traffic.totals).toEqual({views:2,starts:1,submissions:1})
    expect(ledger.responses[0].participant).toBeUndefined()
    expect(JSON.stringify(ledger.responses)).not.toContain(resumeEmail)
    expect(ledger.responses[0].answers.map(answer => answer.value)).toEqual(['Jo Taylor', 'jo@harbour.example', 'We need a booking site for our new studio.'])
    await inspectState(resumed, 'completed', info.project.name)
    await resumed.goto(`/f/${slug}?resume=${'0'.repeat(64)}`)
    await expect(resumed.getByRole('heading', { name: 'This resume link is no longer available.' })).toBeVisible()
    await expect(resumed.getByRole('link', { name: 'Start again' })).toHaveAttribute('href', `/f/${slug}`)
    await inspectState(resumed, 'unavailable', info.project.name)
    expect((await call<{totals:unknown}>(`${path}/traffic?revisionId=${original.revision.id}`)).totals).toEqual(traffic.totals)
    const draftSlug = `private-${slug}`
    await call('/api/app/flows', { title: 'Unpublished catering draft', slug: draftSlug })
    const privateDraft = await otherContext.request.get(`/f/${draftSlug}?resume=${'0'.repeat(64)}`)
    expect(privateDraft.status()).toBe(404)
  } finally { await firstContext.close(); await otherContext.close() }
})
