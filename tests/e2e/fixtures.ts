import { developmentInbox, mailDiagnostics, databaseDiagnostics } from '../helpers/mail-capture.mjs'
import { test as base, expect, type Page } from '@playwright/test'
import { testDevKey } from '../helpers/dev-key.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
export { expect }
type Diagnostic = { title: string; address: string; started: number; click?: number; responses: { time: number; status: number; body?: unknown }[] }
const previous: { title: string; address: string }[] = []
let current: Diagnostic
let mailCalls = 0
export function recordSignInClick() { current.click = Date.now() }

// The test-only mail transport captures native links; the application has no inbox UI.
export async function openMailLink(page: Page, email: string) {
  let inbox: Awaited<ReturnType<typeof developmentInbox>>
  const info = base.info()
  const pollStart = Date.now()
  try {
    await expect.poll(async () => { inbox = await developmentInbox(path => page.request.get(path, { headers: { 'x-rer-dev-key': testDevKey } }), email); return inbox.messages.length }).toBeGreaterThan(0)
  } finally {
    const pollEnd = Date.now()
    // Diagnostics must never replace the poll's original exception.
    try {
      const directory = process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'contract-evidence') : join(process.cwd(), '.c36-diagnostics')
      const get = (path: string) => page.request.get(path, { headers: { 'x-rer-dev-key': testDevKey } })
      const record = { ...current, email, pollStart, pollEnd, window: Math.floor(pollEnd / 900_000),
        pid: process.pid, workerIndex: info.workerIndex, retry: info.retry, previous: [...previous],
        inbox: await mailDiagnostics(get, email), database: await databaseDiagnostics(email) }
      mkdirSync(directory, { recursive: true })
      const filename = info.title.startsWith('[FLOW-002,') ? `mobile-4-diag-attempt${info.retry + 1}.json` : `mail-diag-${info.project.name}-${info.workerIndex}-${++mailCalls}.json`
      writeFileSync(join(directory, filename), JSON.stringify(record, null, 2))
    } catch { console.error('Read-only mail diagnostic unavailable') }
  }
  await page.goto('/auth/confirm?token=' + inbox!.messages[0].magicLinkToken)
}
// Each independent run (including a retry) starts with its own address, then keeps it
// for the entire journey. The product's real per-address limits remain enforced.
const syntheticAddress = (testId: string) => {
  const number = [...testId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return `198.18.${(number >>> 8) % 255}.${number % 255}`
}
export const test = base.extend({
  page: async ({ page }, use, info) => {
    current = { title: info.title, address: syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`), started: Date.now(), responses: [] }
    page.on('response', async response => {
      if (response.request().method() !== 'POST' || new URL(response.url()).pathname !== '/auth/magic-link') return
      const record: Diagnostic['responses'][number] = { time: Date.now(), status: response.status() }
      current.responses.push(record)
      try {
        const body = await response.json()
        // Only known response fields; never arbitrary server data.
        record.body = Object.fromEntries(['status', 'delivery', 'error'].filter(key => typeof body[key] === 'string').map(key => [key, body[key]]))
      } catch { record.body = { unavailable: true } }
    })
    await use(page)
  },
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use, info) => {
    // The option fixture reaches the browser context, page.request and the
    // request-only fixture. A page override left API reads sharing loopback's
    // public allowance with every preceding journey in the shard.
    // Let Chromium supply Origin for each document, including sandboxed embeds.
    if (!current || current.title !== info.title) current = { title: info.title, address: syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`), started: Date.now(), responses: [] }
    await use({ ...extraHTTPHeaders, 'CF-Connecting-IP': syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`) })
    previous.push({ title: info.title, address: syntheticAddress(`${info.project.name}:${info.testId}:${info.retry}`) })
  },
})
