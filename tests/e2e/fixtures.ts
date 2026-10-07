import { test as base, expect } from '@playwright/test'
export { expect }
// Each browser journey gets a synthetic address; the product's real per-address limits remain enforced.
export const test = base.extend({
  page: async ({ page }, use, info) => {
    const number = [...info.testId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
    await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `198.18.${(number >>> 8) % 255}.${number % 255}` })
    await use(page)
  },
})
