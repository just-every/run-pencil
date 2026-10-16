import { developmentInbox } from '../helpers/mail-capture.mjs'
import { test as base, expect, type Page } from '@playwright/test'
import { testDevKey } from '../helpers/dev-key.mjs'
export { expect }
// The test-only mail transport captures native links; the application has no inbox UI.
export async function openMailLink(page: Page, email: string) {
  let inbox: Awaited<ReturnType<typeof developmentInbox>>
  await expect.poll(async () => { inbox = await developmentInbox(path => page.request.get(path, { headers: { 'x-rer-dev-key': testDevKey } }), email); return inbox.messages.length }).toBeGreaterThan(0)
  await page.goto('/auth/confirm?token=' + inbox!.messages[0].magicLinkToken)
}
// Each independent run (including a retry) starts with its own address, then keeps it
// for the entire journey. The product's real per-address limits remain enforced.
const syntheticAddress = (testId: string) => {
  const number = [...testId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return `198.18.${(number >>> 8) % 255}.${number % 255}`
}
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders, baseURL }, use, info) => {
    // The option fixture reaches the browser context, page.request and the
    // request-only fixture. A page override left API reads sharing loopback's
    // public allowance with every preceding journey in the shard.
    // Follow the test's base URL: site journeys use a different origin from the app.
    await use({ Origin: new URL(baseURL!).origin, ...extraHTTPHeaders, 'CF-Connecting-IP': syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`) })
  },
})
