#!/usr/bin/env node
// PAY-005 (with PAY-001/PAY-002's provider leg) local proof against Stripe test mode. Never registered in CI: it needs a
// running `rer dev` (not `rer demo`, whose fetch guard answers api.stripe.com itself) and a test key injected as
// STRIPE_API_KEY. The respondent pays with test card 4242 on the real checkout.stripe.com page in headless Chromium, and
// the owner refunds through Pencil's ledger in the browser. Webhooks: the Stripe CLI cannot run on this host, so the real
// event payloads are read from GET /v1/events and delivered to Pencil's webhook signed with the secret saved in the app
// ("real Stripe event payloads, locally re-signed"); no webhook endpoint object is created. The receipt keeps the last
// four characters of provider ids and no key, secret, header or provider body.
import { createHmac, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'

const { values: args } = parseArgs({ options: { origin: { type: 'string' }, 'dev-log': { type: 'string' }, out: { type: 'string' }, screens: { type: 'string' } } })
const fail = message => { console.error(`payments-stripe-test: ${message}`); process.exit(1) }
const key = process.env.STRIPE_API_KEY ?? ''
if (!/^(?:sk|rk)_test_[A-Za-z0-9]{8,240}$/.test(key)) fail('refusing to run: inject a Stripe test key (sk_test_ or rk_test_) as STRIPE_API_KEY')
console.log('test mode confirmed')
if (!args.origin || !args['dev-log'] || !args.out || !args.screens) fail('use --origin URL --dev-log FILE --out FILE --screens DIR')
const origin = new URL(args.origin).origin, runStart = Math.floor(Date.now() / 1000) - 5
mkdirSync(args.screens, { recursive: true })
const last4 = value => typeof value === 'string' && value ? value.slice(0, value.indexOf('_') + 1) + '…' + value.slice(-4) : null
const webhookSecret = 'whsec_' + randomBytes(32).toString('base64url')
const redact = text => String(text).split(key).join('[key]').split(webhookSecret).join('[secret]')
const receipt = { origin, mode: 'test', webhooks: 'real Stripe event payloads from GET /v1/events, locally re-signed with the secret saved in the app', steps: [], stripeCalls: [], objects: [] }
const step = (name, detail = {}) => { receipt.steps.push({ name, ...detail }); console.log(`${name}: ${redact(JSON.stringify(detail))}`) }

// Stripe, read and cleaned up by the harness itself (counted; Pencil's own calls happen inside its doors).
async function stripe(method, path, form) {
  const response = await fetch('https://api.stripe.com' + path, { method, headers: { authorization: `Bearer ${key}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined })
  const body = await response.json().catch(() => ({}))
  receipt.stripeCalls.push({ method, path: path.replace(/(cs|pi|re|ch|evt|txr)_(test_)?[A-Za-z0-9]+/g, m => last4(m)).split('?')[0], status: response.status })
  if (receipt.stripeCalls.length > 24) fail('Stripe call budget for the harness exceeded')
  return { status: response.status, body }
}

// Pencil's own doors, signed in through the dev log's one-click key (read here, never printed).
const jar = new Map()
const absorb = response => { for (const line of response.headers.getSetCookie()) { const pair = line.split(';')[0], at = pair.indexOf('='); const name = pair.slice(0, at).trim(), value = pair.slice(at + 1); if (!value || /max-age=0/i.test(line)) jar.delete(name); else jar.set(name, value) } }
async function call(path, { method = 'GET', body, expect, raw = false } = {}) {
  const response = await fetch(origin + path, { method, redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
  absorb(response)
  const text = await response.text()
  if (expect !== undefined && response.status !== expect) fail(`${method} ${path} answered ${response.status}: ${redact(text).slice(0, 300)}`)
  if (raw) return { status: response.status, text }
  let json = null; try { json = text ? JSON.parse(text) : null } catch {}
  return { status: response.status, json, text }
}
const open = [...readFileSync(args['dev-log'], 'utf8').matchAll(/RER_OPEN (\S+)/g)].pop()?.[1]
const devKey = open ? new URLSearchParams(new URL(open).hash.slice(1)).get('rer-dev') : null
if (!devKey) fail('the dev log has no RER_OPEN line with a key yet')
const enter = await fetch(origin + '/auth/dev/enter?as=owner&returnTo=%2Fapp', { redirect: 'manual', headers: { 'x-rer-dev-key': devKey } })
absorb(enter)
if (enter.status !== 303) fail(`dev sign-in answered ${enter.status}`)
await fetch(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'synthetic-pencil-c46 business', timeZone: 'America/New_York' }) })

// Signed delivery of one real event payload to Pencil's public webhook door.
async function deliver(event) {
  const payload = JSON.stringify(event), t = Math.floor(Date.now() / 1000)
  const signature = `t=${t},v1=${createHmac('sha256', webhookSecret).update(`${t}.${payload}`).digest('hex')}`
  const response = await fetch(origin + '/api/public/payments/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload })
  const result = await response.json().catch(() => ({}))
  return { type: event.type, event: last4(event.id), http: response.status, outcome: result.outcome ?? null }
}
// Real events about our own objects only; other systems share this test account.
async function events(types, belongs, want) {
  for (let poll = 0; poll < 5; poll++) {
    await sleep(poll ? 6000 : 4000)
    const query = types.map(type => `types[]=${encodeURIComponent(type)}`).join('&')
    const { body } = await stripe('GET', `/v1/events?${query}&created[gte]=${runStart}&limit=100`)
    const found = (body.data ?? []).filter(event => belongs(event.data?.object ?? {})).reverse()
    if (want(found)) return found
  }
  fail(`Stripe events ${types.join(', ')} for this run did not appear`)
}

// 1. Owner connects Stripe: key and a webhook secret that exists only in this process and the sealed connection.
const saved = await call('/api/app/connections/payment', { method: 'PUT', body: { secretKey: key, webhookSecret }, expect: 200 })
const status = await call('/api/app/connections/payment', { expect: 200 })
const tested = await call('/api/app/connections/payment/test', { method: 'POST', expect: 200 })
const echoes = [saved.text, status.text, tested.text].some(text => text.includes(key) || text.includes(webhookSecret))
step('connection', { status: { saved: status.json.saved, mode: status.json.mode, restricted: status.json.restricted }, test: tested.json.message, echoesKeyOrSecret: echoes })
if (echoes || status.json.mode !== 'test') fail('the payment connection echoed a credential or is not in test mode')
const tax = await stripe('GET', '/v1/tax/settings')
step('stripe-tax-settings', { http: tax.status, status: tax.body.status ?? null })

// 2. Two published forms whose payment step totals $40; the second carries a $5 Stripe coupon created for this run.
const coupon = await stripe('POST', '/v1/coupons', { amount_off: '500', currency: 'usd', duration: 'once', name: 'synthetic-pencil-c46' })
if (coupon.status !== 200) fail(`coupon creation answered ${coupon.status}`)
receipt.objects.push({ kind: 'coupon', id: last4(coupon.body.id), created: true })
async function paymentForm(label, extra = {}) {
  const slug = `synthetic-pencil-c46-${label}-${Date.now().toString(36)}`
  const { id } = (await call('/api/app/flows', { method: 'POST', body: { title: `synthetic-pencil-c46 ${label}`, slug }, expect: 201 })).json
  const base = `/api/app/flows/${id}`, read = async () => (await call(`${base}/draft`, { expect: 200 })).json
  for (const body of [{ kind: 'question', questionType: 'yes_no', prompt: 'Attending synthetic-pencil-c46?', required: true }, { kind: 'completion', questionType: null, prompt: 'Thank you' }])
    await call(`${base}/draft/steps`, { method: 'POST', body: { expectedVersion: (await read()).flow.draftVersion, step: body }, expect: 201 })
  const [question, completion] = (await read()).steps
  const payment = { products: [{ id: 'synthetic-pencil-c46-ticket', name: 'synthetic-pencil-c46 ticket', unitAmount: 4000 }], options: [], minimum: 50, maximum: 10000, ...extra }
  await call(`${base}/draft/steps`, { method: 'POST', body: { expectedVersion: (await read()).flow.draftVersion, step: { kind: 'payment', questionType: null, prompt: 'Pay for the ticket', nextStepId: completion.id, questionSettings: { payment } } }, expect: 201 })
  const pay = (await read()).steps.find(entry => entry.kind === 'payment')
  await call(`${base}/draft`, { method: 'PUT', body: { expectedVersion: (await read()).flow.draftVersion, stepId: question.id, prompt: question.prompt, required: true, nextStepId: pay.id }, expect: 200 })
  await call(`${base}/publish`, { method: 'POST', body: { expectedVersion: (await read()).flow.draftVersion }, expect: 201 })
  return { id, slug, base }
}
const forms = { order: await paymentForm('pay'), coupon: await paymentForm('coupon', { couponId: coupon.body.id }) }
step('forms-published', { order: forms.order.id, coupon: forms.coupon.id })

const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
step('browser', { version: browser.version() })
const ledger = async query => (await call(`/api/app/payments${query ? '?' + query : ''}`, { expect: 200 })).json.payments
const rowFor = async responseId => (await ledger()).find(row => row.responseId === responseId)

// 3. A respondent pays on Stripe's hosted Checkout with test card 4242 and returns to the form's completion screen.
async function respond(form, total) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const known = new Set((await ledger()).map(row => row.responseId))
  await page.goto(`${origin}/f/${form.slug}`)
  await page.getByRole('radio', { name: 'Yes', exact: true }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: `Pay ${total} with Stripe`, exact: true }).click()
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 60_000 })
  await page.locator('#email').fill('synthetic-pencil-c46-pay@example.test')
  await page.locator('#cardNumber').fill('4242 4242 4242 4242')
  await page.locator('#cardExpiry').fill('12 / 34')
  await page.locator('#cardCvc').fill('123')
  await page.locator('#billingName').fill('synthetic-pencil-c46 respondent')
  if (await page.locator('#billingPostalCode').isVisible().catch(() => false)) await page.locator('#billingPostalCode').fill('10001')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(url => url.origin === origin, { timeout: 90_000 })
  await page.getByRole('heading', { name: 'Thank you', exact: true }).waitFor({ timeout: 30_000 })
  await page.screenshot({ path: join(args.screens, `pay005-${form === forms.order ? 'order' : 'coupon'}-returned-1440.png`) })
  const text = await page.locator('main').innerText()
  await context.close()
  const row = (await ledger()).find(entry => !known.has(entry.responseId))
  if (!row) fail('no new payment appeared in the ledger after Checkout')
  return { row, completion: text.replace(/\s+/g, ' ').slice(0, 200) }
}
async function settle(row, label) {
  const sessionId = row.id
  if (!/^cs_test_/.test(sessionId ?? '')) fail('the pending ledger row does not name its test Checkout Session')
  const completed = list => list.find(event => event.type === 'checkout.session.completed')
  const chargeOf = (list, intent) => list.find(event => event.type === 'charge.succeeded' && event.data.object.payment_intent === intent)
  const found = await events(['checkout.session.completed', 'charge.succeeded'], object => object.id === sessionId || object.object === 'charge',
    list => Boolean(completed(list) && chargeOf(list, completed(list).data.object.payment_intent)))
  const session = completed(found), charge = chargeOf(found, session.data.object.payment_intent)
  const delivered = [await deliver(session), await deliver(charge), await deliver(session)]
  const after = await rowFor(row.responseId)
  const read = await stripe('GET', `/v1/checkout/sessions/${sessionId}`)
  step(`settled-${label}`, { beforeWebhook: row.state, delivered, after: { state: after.state, total: after.total, methodType: after.methodType, methodLast4: after.methodLast4, id: last4(after.id) },
    stripeSession: { id: last4(read.body.id), status: read.body.status, payment_status: read.body.payment_status, amount_subtotal: read.body.amount_subtotal, amount_discount: read.body.total_details?.amount_discount, amount_tax: read.body.total_details?.amount_tax, amount_total: read.body.amount_total, livemode: read.body.livemode } })
  receipt.objects.push({ kind: 'checkout_session', id: last4(sessionId), status: read.body.status }, { kind: 'payment_intent', id: last4(read.body.payment_intent), cleanup: 'refunded in full below (a test-mode payment cannot be deleted)' })
  return { sessionId, intent: read.body.payment_intent, session: read.body }
}
async function refunded(intent, responseId, cumulative) {
  const found = await events(['charge.refunded'], object => object.payment_intent === intent, list => list.some(event => event.data.object.amount_refunded === cumulative))
  const event = found.find(entry => entry.data.object.amount_refunded === cumulative)
  const delivered = await deliver(event)
  return { delivered, row: await rowFor(responseId) }
}

const paid = await respond(forms.order, '$40.00')
step('respondent-returned', { responseId: paid.row.responseId, state: paid.row.state, ledgerId: last4(paid.row.id), completion: paid.completion })
const order = await settle(paid.row, 'order')

// 4. The owner refunds $10 of $40 from the ledger in the browser at 1440, confirming the amount.
const owner = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await owner.newPage()
await page.goto(open)
await page.waitForURL(url => url.pathname.startsWith('/app'), { timeout: 30_000 })
await page.goto(`${origin}/app/payments`)
const mask = () => page.evaluate(() => { for (const code of document.querySelectorAll('code')) if (/^(pi|cs)_/.test(code.textContent ?? '')) code.textContent = code.textContent.slice(0, 3) + '…' + code.textContent.slice(-4) })
const row = page.locator('article.payments-row').filter({ hasText: order.intent })
await row.getByRole('button', { name: 'Refund payment', exact: true }).click()
const form = page.getByRole('form', { name: 'Confirm refund' })
await form.getByLabel('Refund amount (USD)').fill('10.00')
await form.getByRole('checkbox', { name: 'I confirm a refund of $10.00' }).check()
await mask(); await page.screenshot({ path: join(args.screens, 'pay005-refund-confirm-1440.png') })
await form.getByRole('button', { name: 'Issue refund', exact: true }).click()
await page.getByRole('status').filter({ hasText: 'Refund requested.' }).waitFor({ timeout: 30_000 })
const awaiting = await rowFor(paid.row.responseId)
const tenth = await refunded(order.intent, paid.row.responseId, 1000)
const stripeRefunds = await stripe('GET', `/v1/refunds?payment_intent=${order.intent}&limit=10`)
step('refund-10-of-40', { stateBeforeWebhook: awaiting.state, refundedBeforeWebhook: awaiting.refundedAmount, delivered: tenth.delivered, after: { state: tenth.row.state, total: tenth.row.total, refundedAmount: tenth.row.refundedAmount, methodType: tenth.row.methodType, methodLast4: tenth.row.methodLast4 },
  stripeRefunds: (stripeRefunds.body.data ?? []).map(refund => ({ id: last4(refund.id), amount: refund.amount, status: refund.status })) })
receipt.objects.push(...(stripeRefunds.body.data ?? []).map(refund => ({ kind: 'refund', id: last4(refund.id), amount: refund.amount, status: refund.status })))

// 5. Ledger row, status filter, method type and last 4, and the export with both amounts, at 1440 and 390.
await page.goto(`${origin}/app/payments`)
await page.getByLabel('Status').selectOption('partially_refunded')
await page.locator('article.payments-row').filter({ hasText: 'Partially refunded' }).first().waitFor()
for (const [width, height] of [[1440, 900], [390, 844]]) { await page.setViewportSize({ width, height }); await mask(); await page.screenshot({ path: join(args.screens, `pay005-ledger-partially-refunded-${width}.png`), fullPage: true }) }
const filtered = await ledger('state=partially_refunded'), paidOnly = await ledger('state=paid')
const csv = await call('/api/app/payments?state=partially_refunded&format=csv', { raw: true, expect: 200 })
const csvRow = csv.text.split('\r\n').find(line => line.includes(paid.row.responseId)) ?? ''
step('ledger-filter-export', { filterPartiallyRefunded: filtered.filter(r => r.responseId === paid.row.responseId).length, filterPaid: paidOnly.filter(r => r.responseId === paid.row.responseId).length,
  csvHeader: csv.text.split('\r\n')[0], csvRow: csvRow.replace(/"(pi|cs)_[^"]+"/g, m => `"${last4(m.slice(1, -1))}"`), csvHasBothAmounts: csvRow.includes('"4000","4000","1000","card","4242"') })
await page.goto(`${origin}/api/app/payments?state=partially_refunded&format=csv`).catch(() => null)
await page.goto(`${origin}/app/payments`)

// 6. Reconciliation for today's UTC period against Stripe.
const period = new Date().toISOString().slice(0, 10)
const reconciled = (await call('/api/app/payments/reconcile', { method: 'POST', body: { period }, expect: 200 })).json
step('reconcile', { period, pencil: reconciled.pencil, providerPaid: reconciled.providerPaid, providerRefunded: reconciled.providerRefunded, providerNet: reconciled.providerNet, mismatch: reconciled.mismatch })

// 7. PAY-002 on the same run: the coupon form's stored subtotal, discount, tax and total against Stripe's session.
const discounted = await respond(forms.coupon, '$40.00')
const couponOrder = await settle(discounted.row, 'coupon')
const responses = (await call(`${forms.coupon.base}/ledger`, { expect: 200 })).json.responses
const stored = responses.find(response => response.id === discounted.row.responseId)?.payment
step('coupon-totals', { pencil: { amount: stored?.amount, providerAmount: stored?.providerAmount, discount: stored?.discount, tax: stored?.tax, total: stored?.total, state: stored?.state },
  stripe: { amount_subtotal: couponOrder.session.amount_subtotal, amount_discount: couponOrder.session.total_details?.amount_discount, amount_tax: couponOrder.session.total_details?.amount_tax, amount_total: couponOrder.session.amount_total } })

// 8. Cleanup through Pencil's refund door: the remaining $30 and the coupon order's $35, each confirmed by its event.
const rest = await call(`/api/app/payments/${paid.row.responseId}/refund`, { method: 'POST', body: { amount: 3000, confirm: true }, expect: 200 })
const full = await refunded(order.intent, paid.row.responseId, 4000)
const couponRefund = await call(`/api/app/payments/${discounted.row.responseId}/refund`, { method: 'POST', body: { amount: 3500, confirm: true }, expect: 200 })
const couponFull = await refunded(couponOrder.intent, discounted.row.responseId, 3500)
const finalReconcile = (await call('/api/app/payments/reconcile', { method: 'POST', body: { period }, expect: 200 })).json
step('cleanup-refunds', { order: { requested: rest.json.status, delivered: full.delivered, state: full.row.state, refundedAmount: full.row.refundedAmount }, coupon: { requested: couponRefund.json.status, delivered: couponFull.delivered, state: couponFull.row.state, refundedAmount: couponFull.row.refundedAmount },
  reconcile: { pencil: finalReconcile.pencil, providerNet: finalReconcile.providerNet, mismatch: finalReconcile.mismatch } })
const allRefunds = await stripe('GET', `/v1/refunds?created[gte]=${runStart}&limit=20`)
for (const refund of (allRefunds.body.data ?? []).filter(entry => [order.intent, couponOrder.intent].includes(entry.payment_intent) && !receipt.objects.some(o => o.id === last4(entry.id)))) receipt.objects.push({ kind: 'refund', id: last4(refund.id), amount: refund.amount, status: refund.status })
const deleted = await stripe('DELETE', `/v1/coupons/${coupon.body.id}`), gone = await stripe('GET', `/v1/coupons/${coupon.body.id}`)
receipt.objects.find(o => o.kind === 'coupon').cleanup = { deleted: deleted.body.deleted === true, readBack: gone.status }
const openSessions = await stripe('GET', `/v1/checkout/sessions?status=open&created[gte]=${runStart}&limit=100`)
const ours = (openSessions.body.data ?? []).filter(session => session.metadata?.pencil_response && [paid.row.responseId, discounted.row.responseId].includes(session.metadata.pencil_response))
for (const session of ours) { const expired = await stripe('POST', `/v1/checkout/sessions/${session.id}/expire`); receipt.objects.push({ kind: 'checkout_session', id: last4(session.id), cleanup: expired.body.status }) }
step('cleanup', { couponDeleted: deleted.body.deleted === true, couponReadBack: gone.status, openSessionsOfThisRun: ours.length })

await owner.close()
await browser.close()
await call('/api/app/connections/payment', { method: 'DELETE', expect: 200 })
step('connection-removed', { saved: (await call('/api/app/connections/payment', { expect: 200 })).json.saved })
writeFileSync(args.out, redact(JSON.stringify(receipt, null, 2)) + '\n')
console.log(`receipt written; harness Stripe calls ${receipt.stripeCalls.length}`)
