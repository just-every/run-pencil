import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect } from './fixtures'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
export function audienceOutboxHeaders() {
  const checkout = process.env.PENCIL_AUDIENCE_CHECKOUT
  if (!checkout) return devKeyHeaders
  const key = /^RER_DEV_KEY=(\S+)$/m.exec(readFileSync(join(checkout, '.rer/local/dev-key.env'), 'utf8'))?.[1]
  if (!key) throw new Error('The external scratch checkout has no dev key.')
  return { 'x-rer-dev-key': key }
}
/** External rer runs invite distinct real operators through the public management route.
 * This keeps each journey inside the unmodified per-email sign-in limit. */
export async function inviteAudienceOperator(page: Page, info: TestInfo) {
  const path = process.env.PENCIL_AUDIENCE_INVITER_CONTEXT
  if (!path) return undefined
  const context = JSON.parse(readFileSync(path, 'utf8')) as { origin: string; cookie: string }
  if (context.origin !== new URL(info.project.use.baseURL!).origin || !context.cookie) throw new Error('The scratch inviter context does not match this app.')
  const email = `audience-${info.project.name}-${crypto.randomUUID()}@example.test`
  const response = await page.request.post('/api/app/operators', { headers: { Origin: context.origin, Cookie: context.cookie }, data: { email, displayName: 'Native Audience operator' } })
  expect(response.status()).toBe(201)
  return email
}
/** Reads actual captured mail through the key-gated viewer; capabilities stay in process memory. */
export async function invitationMail(page: Page, email: string) {
  const headers = audienceOutboxHeaders()
  const listing = await page.request.get('/__dev/outbox', { headers })
  expect(listing.status()).toBe(200)
  for (const match of (await listing.text()).matchAll(/<article>([\s\S]*?)<\/article>/g)) {
    if (!match[1].includes(`<p>To: ${email}</p>`)) continue
    const path = match[1].match(/href="([^\"]+\?message=[^\"]+)"/)?.[1]
    if (!path) continue
    const response = await page.request.get(decode(path), { headers })
    expect(response.status()).toBe(200)
    const body = decode(await response.text())
    const invitation = body.match(/https?:\/\/[^\s<>"']+\/i\/[a-f0-9]{64}/)?.[0]
    const optout = body.match(/https?:\/\/[^\s<>"']+\/optout\/[a-f0-9]{64}/)?.[0]
    if (invitation && optout) return { invitation, optout }
  }
  throw new Error('No actual captured invitation is available for the journey recipient.')
}
export async function audienceScreen(page: Page, info: TestInfo, step: string) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.PENCIL_CAPTURE_DIR) await page.screenshot({ path: `${process.env.PENCIL_CAPTURE_DIR}/${info.project.name}-${step}.png`, fullPage: true })
}
