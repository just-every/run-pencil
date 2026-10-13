import { test as base, expect, type Page } from '@playwright/test'
import { testDevKey } from '../helpers/dev-key.mjs'
export { expect }
// The local outbox opens only for the checkout's key. A person trades it once for the gate cookie (RER_OPEN); a test does the same
// just before it opens the outbox, so no other page carries a cookie and no request carries a header.
export async function grantOutboxKey(page: Page) {
  expect((await page.request.post('/__dev/key', { data: { key: testDevKey } })).status()).toBe(204)
}
export async function openLocalOutbox(page: Page) {
  await grantOutboxKey(page)
  await page.getByRole('link', { name: 'Open the local outbox' }).click()
}
// Each independent run (including a retry) starts with its own address, then keeps it
// for the entire journey. The product's real per-address limits remain enforced.
const syntheticAddress = (testId: string) => {
  const number = [...testId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return `198.18.${(number >>> 8) % 255}.${number % 255}`
}
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, info) => {
    // The option fixture reaches the browser context, page.request and the
    // request-only fixture. A page override left API reads sharing loopback's
    // public allowance with every preceding journey in the shard.
    await use({ ...extraHTTPHeaders, 'CF-Connecting-IP': syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`) })
  },
})
