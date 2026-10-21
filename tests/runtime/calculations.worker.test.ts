import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { createScheduledController } from 'cloudflare:test'
import worker from '../../src/core/app/worker'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import { httpExport } from '../helpers/report-download'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { interpolateAnswerRecall } from '../../src/core/shared/answerRecall'
import type { BuilderDraft, Ledger, PaymentReturnView, PublicFlow } from '../../src/core/app/api'
import { materializeNotifications } from '../../src/core/features/notifications/outbox'
import { deliver, stripe, stripeEvent, stripeKey, webhookSecret } from './payment-fixture'
import type { Calculation, CalculationExpression } from '../../src/core/shared/calculations'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
type Session = { sessionId: string; sessionToken: string; revisionId: string }
type Receipt = { responseId: string; completionStepId: string; idempotent: boolean }
type Answer = { stepId: string; value: number | boolean }
const literal = (value: number): CalculationExpression => ({ kind: 'literal', value })
async function accepted<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status)
  return response.json() as Promise<T>
}

async function fixture(withGate = false) {
  const f = await googleHttp(), slug = `calculation-${crypto.randomUUID()}`
  const { id } = await accepted<{ id: string }>(await f.call('/api/app/flows', { title: 'Order quote', slug }), 201)
  const base = `/api/app/flows/${id}`
  const read = async () => accepted<BuilderDraft>(await f.call(`${base}/draft`))
  const steps = [
    ...(withGate ? [{ kind: 'question', questionType: 'yes_no', prompt: 'Include products?', required: true }] : []),
    { kind: 'question', questionType: 'number', prompt: 'Quantity', required: true, questionSettings: { min: 1, max: 100, decimalPlaces: 0 } },
    { kind: 'question', questionType: 'yes_no', prompt: 'Discount eligible?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Standard total {{variable:total}}' },
    { kind: 'completion', questionType: null, prompt: 'Bulk total {{variable:total}}' },
  ]
  for (const step of steps) await accepted(await f.call(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step }), 201)
  const draft = await read(), [quantity, discount, ordinary, high] = draft.steps.slice(withGate ? 1 : 0), gate = withGate ? draft.steps[0] : undefined
  const calculation: Calculation = { id: 'total', name: 'Order total', type: 'number', expression: {
    kind: 'multiply', left: { kind: 'answer', stepId: quantity.id }, right: {
      kind: 'conditional', condition: { kind: 'test', stepId: discount.id, operator: 'equals', value: true }, then: literal(16), else: literal(20),
    },
  } }
  const save = async (calculations: Calculation[]) => accepted(await f.call(`${base}/draft/settings`, {
    expectedVersion: (await read()).flow.draftVersion, settings: { hiddenFields: [], identityMode: 'anonymous', calculations },
  }, { method: 'PUT' }))
  await save([calculation])
  await accepted(await f.call(`${base}/draft/branches`, { expectedVersion: (await read()).flow.draftVersion, rules: [
    ...(gate ? [{ sourceStepId: gate.id, predicateKind: 'equals', expectedValue: false, destinationStepId: discount.id, position: 0 }] : []),
    { sourceStepId: discount.id, predicateKind: 'equals', expectedValue: null, destinationStepId: high.id, position: 0, condition: { kind: 'test', stepId: 'variable:total', operator: 'greater_than_or_equal', value: 100 } },
  ] }, { method: 'PUT' }))
  const publish = async () => f.call(`${base}/publish`, { expectedVersion: (await read()).flow.draftVersion })
  const start = async () => accepted<Session>(await f.call(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' }, { auth: false }), 201)
  const submit = async (answers: Answer[], session?: Session, extra: Record<string, unknown> = {}) => {
    const current = session ?? await start()
    const input = { sessionId: current.sessionId, sessionToken: current.sessionToken, loadTime: await issueLoadTime(env.SESSION_SECRET, current.revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(), answers, ...extra }
    const receipt = await accepted<Receipt>(await f.call(`/api/public/flows/${slug}/responses`, input, { auth: false }), 201)
    return { receipt, input }
  }
  const ledger = async (query = '') => accepted<Ledger>(await f.call(`${base}/ledger${query ? `?${query}` : ''}`))
  return { ...f, slug, base, read, save, publish, start, submit, ledger, quantity, discount, ordinary, high, gate, calculation }
}

async function csvRows(call: Awaited<ReturnType<typeof googleHttp>>['call'], base: string) {
  const started = await accepted<{ token: string }>(await call(`${base}/responses/export/start`, { format: 'csv' }))
  let token: string | undefined = started.token, text = ''
  while (token) {
    const part = await call(`${base}/responses/export`, { token })
    expect(part.status, await part.clone().text()).toBe(200)
    text += await part.text(); token = part.headers.get('X-Export-Next') ?? undefined
  }
  const cells = (line: string) => [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map(match => match[1].startsWith('"') ? match[1].slice(1, -1).replaceAll('""', '"') : match[1])
  const [heading, ...lines] = text.trimEnd().split('\r\n'), names = cells(heading)
  return lines.map(line => Object.fromEntries(cells(line).map((value, index) => [names[index], value])))
}

contract('LOGIC-003', 'agrees across preview, collection, recall and exports for ten quotes and preserves committed values on replay', async () => {
  const f = await fixture()
  const cases = [[1, false], [4, false], [5, false], [6, false], [100, false], [1, true], [5, true], [6, true], [7, true], [100, true]] as const
  for (const [quantity, discount] of cases) {
    const preview = await accepted<{ complete: boolean; screens: Array<{ stepId: string; evaluations: Array<{ trace?: { value: unknown } }> }> }>(await f.call(`${f.base}/draft/preview`, { answers: { [f.quantity.id]: quantity, [f.discount.id]: discount } }))
    const total = quantity * (discount ? 16 : 20)
    expect(preview.complete).toBe(true)
    expect(preview.screens.at(-1)?.stepId).toBe(total >= 100 ? f.high.id : f.ordinary.id)
    expect(preview.screens.find(screen => screen.stepId === f.discount.id)?.evaluations[0].trace?.value).toBe(total)
  }
  await accepted(await f.publish(), 201)
  const published = await accepted<PublicFlow>(await f.call(`/api/public/flows/${f.slug}`, undefined, { auth: false }))
  const submissions: Array<{ receipt: Receipt; input: Awaited<ReturnType<typeof f.submit>>['input']; total: number }> = []
  for (const [quantity, discount] of cases) {
    const total = quantity * (discount ? 16 : 20), completion = total >= 100 ? f.high : f.ordinary
    const submitted = await f.submit([{ stepId: f.quantity.id, value: quantity }, { stepId: f.discount.id, value: discount }], undefined, { calculations: { total: -999 } })
    expect(submitted.receipt.completionStepId).toBe(completion.id)
    const answers = { [f.quantity.id]: quantity, [f.discount.id]: discount }
    expect(interpolateAnswerRecall(completion.prompt, published, answers, completion.id)).toBe(`${total >= 100 ? 'Bulk' : 'Standard'} total ${total}`)
    submissions.push({ ...submitted, total })
  }
  const expected = new Map(submissions.map(({ receipt, total }) => [receipt.responseId, total]))
  const assertValues = (responses: Ledger['responses']) => {
    expect(responses).toHaveLength(cases.length)
    for (const response of responses) expect(response.calculations).toEqual([{ id: 'total', name: 'Order total', type: 'number', value: expected.get(response.id) }])
  }
  assertValues((await f.ledger()).responses)
  assertValues((await httpExport<{ responses: Ledger['responses'] }>(path => f.call(path), `${f.base}/responses/export`)).responses)
  const csv = await csvRows(f.call, f.base)
  expect(csv).toHaveLength(cases.length)
  for (const row of csv) expect(JSON.parse(row.calculations_json)).toEqual([{ id: 'total', name: 'Order total', type: 'number', value: expected.get(row.response_id) }])
  const filter = new URLSearchParams({ answerStepId: 'variable:total', answerValue: JSON.stringify(100) })
  expect((await f.ledger(filter.toString())).responses.map(response => response.id)).toEqual([submissions[2].receipt.responseId])
  filter.set('answerValue', JSON.stringify('100')); expect((await f.ledger(filter.toString())).total).toBe(0)
  await f.save([{ ...f.calculation, expression: { kind: 'multiply', left: { kind: 'answer', stepId: f.quantity.id }, right: literal(99) } }])
  await accepted(await f.publish(), 201)
  const original = submissions[0]
  const replay = await accepted<Receipt>(await f.call(`/api/public/flows/${f.slug}/responses`, { ...original.input, answers: [{ stepId: f.quantity.id, value: 100 }, { stepId: f.discount.id, value: true }] }, { auth: false }), 201)
  expect(replay).toMatchObject({ ...original.receipt, idempotent: true })
  assertValues((await f.ledger()).responses)
}, 60_000)

contract(['LOGIC-003', 'PAY-001', 'FLOW-006'], 'refuses cyclic, deleted, mistyped and zero-denominator calculations, and misplaced or out-of-range payment steps, without publishing the draft', async () => {
  const f = await fixture(), draftId = (await f.read()).revision.id
  const invalid: Array<{ calculations: Calculation[]; reason: RegExp }> = [
    { calculations: [{ ...f.calculation, expression: { kind: 'variable', variableId: 'other' } }, { id: 'other', name: 'Other total', type: 'number', expression: { kind: 'variable', variableId: 'total' } }], reason: /cycle/i },
    { calculations: [{ ...f.calculation, expression: { kind: 'answer', stepId: 'deleted-question' } }], reason: /missing|deleted/i },
    { calculations: [{ ...f.calculation, expression: { kind: 'answer', stepId: f.discount.id } }], reason: /type|number|boolean/i },
    { calculations: [{ ...f.calculation, expression: { kind: 'divide', left: { kind: 'answer', stepId: f.quantity.id }, right: { kind: 'subtract', left: literal(1), right: literal(1) } } }], reason: /zero/i },
    { calculations: [{ ...f.calculation, expression: { kind: 'divide', left: literal(100), right: { kind: 'subtract', left: {kind:'answer',stepId:f.quantity.id}, right: literal(50) } } }], reason: /zero/i },
  ]
  for (const entry of invalid) {
    await f.save(entry.calculations)
    const refused = await f.publish()
    expect(refused.status, await refused.clone().text()).toBe(400)
    expect(await refused.text()).toMatch(entry.reason)
    expect((await f.read()).revision.id).toBe(draftId)
    expect((await f.call(`/api/public/flows/${f.slug}`, undefined, { auth: false })).status).toBe(404)
  }
  await f.save([f.calculation]); await accepted(await f.publish(), 201)

  // PAY-001(a): a real reachable branch skips an amount operand. No revision is created.
  const skippedAmount = await fixture(true)
  const skipPay = (await accepted<{ step: { id: string } }>(await skippedAmount.call(`${skippedAmount.base}/draft/steps`, {
    expectedVersion: (await skippedAmount.read()).flow.draftVersion,
    step: { kind: 'payment', questionType: null, prompt: 'Pay skipped quantity', nextStepId: skippedAmount.ordinary.id,
      questionSettings: { payment: { products: [], options: [], calculationId: 'total', minimum: 1600, maximum: 200_000 } } },
  }), 201)).step.id
  const route = async (skip: boolean) => accepted(await skippedAmount.call(`${skippedAmount.base}/draft/branches`, {
    expectedVersion: (await skippedAmount.read()).flow.draftVersion,
    rules: [...(skip ? [{ sourceStepId: skippedAmount.gate!.id, predicateKind: 'equals', expectedValue: false, destinationStepId: skipPay, position: 0 }] : []), { sourceStepId: skippedAmount.discount.id, predicateKind: 'equals', expectedValue: true, destinationStepId: skippedAmount.high.id, position: 0 }],
  }, { method: 'PUT' }))
  await accepted(await skippedAmount.call(`${skippedAmount.base}/draft`, { expectedVersion: (await skippedAmount.read()).flow.draftVersion, stepId: skippedAmount.discount.id, prompt: skippedAmount.discount.prompt, required: true, nextStepId: skipPay }, { method: 'PUT' }))
  await route(true)
  const beforeSkip = await skippedAmount.read()
  const revisions = async () => (await env.DB.prepare('SELECT id FROM flow_revisions WHERE flow_id=? ORDER BY id').bind(beforeSkip.flow.id).all()).results
  const beforeRevisions = await revisions()
  const skipRefusal = await skippedAmount.publish()
  expect(skipRefusal.status, await skipRefusal.clone().text()).toBe(400)
  expect((await skipRefusal.json() as { details: Array<{ stepId: string; reason: string }> }).details).toContainEqual({ stepId: skipPay, reason: expect.stringMatching(/without answering “Quantity”/) })
  expect(await revisions()).toEqual(beforeRevisions)
  expect((await skippedAmount.read()).revision.id).toBe(beforeSkip.revision.id)
  await route(false)
  await accepted(await skippedAmount.publish(), 201)

  // PAY-001 under FLOW-006: each refusal names the payment step and leaves the published revision in place.
  const live = async () => (await accepted<PublicFlow>(await f.call(`/api/public/flows/${f.slug}`, undefined, { auth: false }))).revision.id
  const pricing = { products: [], options: [], calculationId: 'total', minimum: 1600, maximum: 200_000 }
  const step = async (body: Record<string, unknown>) => (await accepted<{ step: { id: string } }>(await f.call(`${f.base}/draft/steps`, { expectedVersion: (await f.read()).flow.draftVersion, step: body }), 201)).step.id
  const edit = async (stepId: string, change: Record<string, unknown>) => { const current = (await f.read()).steps.find(entry => entry.id === stepId)!; await accepted(await f.call(`${f.base}/draft`, { expectedVersion: (await f.read()).flow.draftVersion, stepId, prompt: current.prompt, required: current.required, ...change }, { method: 'PUT' })) }
  const pay = await step({ kind: 'payment', questionType: null, prompt: 'Pay for the order', nextStepId: f.ordinary.id, questionSettings: { payment: pricing } })
  await edit(f.discount.id, { nextStepId: pay })
  await accepted(await f.publish(), 201)
  let current = await live()
  const unchanged = async (reason: RegExp) => {
    const draftBefore = await f.read()
    const revisionRows = async () => (await env.DB.prepare('SELECT id FROM flow_revisions WHERE flow_id=? ORDER BY id').bind(draftBefore.flow.id).all()).results
    const before = await revisionRows()
    const refused = await f.publish()
    expect(refused.status, await refused.clone().text()).toBe(400)
    expect((await refused.json() as { details: Array<{ stepId: string; reason: string }> }).details).toContainEqual({ stepId: pay, reason: expect.stringMatching(reason) })
    expect(await live()).toBe(current)
    expect(await revisionRows()).toEqual(before)
    expect((await f.read()).revision.id).toBe(draftBefore.revision.id)
  }
  // A calculated amount that can exceed the maximum: quantity 100 at $20 is $2,000.
  await edit(pay, { questionSettings: { payment: { ...pricing, maximum: 100_000 } } })
  await unchanged(/\$2,000\.00.*maximum \$1,000\.00/)
  // PAY-001(b): the reachable discounted $16 total falls below a $20 minimum.
  await edit(pay, { questionSettings: { payment: { ...pricing, minimum: 2000 } } })
  await unchanged(/\$16\.00.*minimum \$20\.00/)
  await edit(pay, { questionSettings: { payment: pricing } })
  await accepted(await f.publish(), 201)
  current = await live()
  // An amount read from a link value the respondent controls.
  await accepted(await f.call(`${f.base}/draft/settings`, { expectedVersion: (await f.read()).flow.draftVersion, settings: { hiddenFields: [{ id: 'coupon', name: 'coupon', type: 'number', category: 'plain' }], identityMode: 'anonymous', calculations: [f.calculation, { id: 'linked', name: 'Linked price', type: 'number', expression: { kind: 'hidden', fieldId: 'coupon' } }] } }, { method: 'PUT' }))
  await edit(pay, { questionSettings: { payment: { ...pricing, calculationId: 'linked' } } })
  await unchanged(/hidden field/)
  // A quantity answered only after the payment step: a later answer could change the amount.
  const copies = await step({ kind: 'question', questionType: 'number', prompt: 'Extra copies', required: true, nextStepId: f.ordinary.id, questionSettings: { min: 0, max: 5, decimalPlaces: 0 } })
  await edit(pay, { nextStepId: f.ordinary.id, questionSettings: { payment: { products: [{ id: 'copy', name: 'Copy', unitAmount: 500, quantityStepId: copies }], options: [], minimum: 50, maximum: 10_000 } } })
  await unchanged(/comes before “Extra copies”/)
  // A payment step that leads to a question, then one placed after a completion screen.
  await edit(pay, { nextStepId: copies, questionSettings: { payment: pricing } })
  await unchanged(/lead straight to a completion screen/)
  const order = (await f.read()).steps.map(entry => entry.id).filter(id => id !== pay)
  await accepted(await f.call(`${f.base}/draft/order`, { expectedVersion: (await f.read()).flow.draftVersion, orderedStepIds: [...order.slice(0, order.indexOf(f.ordinary.id) + 1), pay, ...order.slice(order.indexOf(f.ordinary.id) + 1)] }, { method: 'PUT' }))
  await edit(pay, { nextStepId: f.high.id })
  await unchanged(/after a completion screen/)
}, 60_000)

contract(['LOGIC-003', 'PAY-001', 'NOTIFY-003', 'DIST-017', 'GOV-003'], 'excludes off-path and forged operands, completes a private saved quote, and charges only the server-computed total through Stripe Checkout', async () => {
  const f = await fixture(true), gate = f.gate!
  await accepted(await f.publish(), 201)
  const skipped = await f.submit([{ stepId: gate.id, value: false }, { stepId: f.quantity.id, value: 100 }, { stepId: f.discount.id, value: false }], undefined, { calculations: { total: 2000 } })
  expect(skipped.receipt.completionStepId).toBe(f.ordinary.id)
  const first = (await f.ledger()).responses[0]
  expect(first.answers.map(answer => answer.stepId)).not.toContain(f.quantity.id)
  expect(first.calculations).toEqual([{ id: 'total', name: 'Order total', type: 'number', value: null }])
  const forged = await f.start()
  const refused = await f.call(`/api/public/flows/${f.slug}/responses`, { ...forged, loadTime: await issueLoadTime(env.SESSION_SECRET, forged.revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(), answers: [{ stepId: gate.id, value: false }, { stepId: f.discount.id, value: false }, { stepId: 'variable:total', value: 2000 }] }, { auth: false })
  expect(refused.status).toBe(400)
  const session = await f.start(), commandKey = crypto.randomUUID()
  await accepted(await f.call(`/api/public/flows/${f.slug}/sessions/save`, { ...session, commandKey, email: 'quote@example.test', currentStepId: f.discount.id, answers: [{ stepId: gate.id, value: true }, { stepId: f.quantity.id, value: 5 }] }, { auth: false }))
  expect((await f.ledger()).total).toBe(1)
  const resumed = await accepted<Session & { state: string; answers: Answer[] }>(await f.call(`/api/public/flows/${f.slug}/resume`, { token: await resumeBearer(env.SESSION_SECRET, session.sessionId, commandKey) }, { auth: false }))
  expect(resumed.state).toBe('open')
  expect(resumed.answers).toEqual([{ stepId: gate.id, value: true }, { stepId: f.quantity.id, value: 5 }])
  const finished = await f.submit([...resumed.answers, { stepId: f.discount.id, value: true }], resumed)
  const completed = (await f.ledger()).responses.find(response => response.id === finished.receipt.responseId)!
  expect(completed.calculations).toEqual([{ id: 'total', name: 'Order total', type: 'number', value: 80 }])
  expect((await f.ledger()).total).toBe(2)

  // PAY-001 inherits LOGIC-003: each branch charges the server-computed total on Stripe Checkout.
  const p = await fixture(), flowId = p.base.split('/').at(-1)!
  const role = async (value: 'owner' | 'member') => {
    await env.DB.prepare('UPDATE oa_operators SET role=? WHERE id=?').bind(value, p.operatorId).run()
    await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id) WHERE operator_id=?').bind(p.operatorId).run()
  }
  const connection = { secretKey: stripeKey, webhookSecret }
  await role('member')
  expect((await p.call('/api/app/connections/payment', connection, { method: 'PUT' })).status).toBe(403)
  await role('owner')
  expect(await accepted(await p.call('/api/app/connections/payment', connection, { method: 'PUT' }))).toMatchObject({ saved: true, mode: 'test', restricted: true })
  expect(JSON.stringify(await accepted(await p.call('/api/app/connections/payment')))).not.toMatch(/rk_test|whsec_/)
  expect((await env.DB.prepare("SELECT sealed FROM integration_connections WHERE kind='payment'").first<{ sealed: string }>())!.sealed).not.toContain('rk_test')
  const pricing = { products: [], options: [], calculationId: 'total', minimum: 1600, maximum: 200_000 }
  const addStep = async (step: Record<string, unknown>) => (await accepted<{ step: { id: string } }>(await p.call(`${p.base}/draft/steps`, { expectedVersion: (await p.read()).flow.draftVersion, step }), 201)).step
  const standardPay = await addStep({ kind: 'payment', questionType: null, prompt: 'Pay the standard total', nextStepId: p.ordinary.id, questionSettings: { payment: pricing } })
  const bulkPay = await addStep({ kind: 'payment', questionType: null, prompt: 'Pay the bulk total', nextStepId: p.high.id, questionSettings: { payment: pricing } })
  await accepted(await p.call(`${p.base}/draft`, { expectedVersion: (await p.read()).flow.draftVersion, stepId: p.discount.id, prompt: p.discount.prompt, required: true, nextStepId: standardPay.id }, { method: 'PUT' }))
  await accepted(await p.call(`${p.base}/draft/branches`, { expectedVersion: (await p.read()).flow.draftVersion, rules: [{ sourceStepId: p.discount.id, predicateKind: 'equals', expectedValue: null, destinationStepId: bulkPay.id, position: 0, condition: { kind: 'test', stepId: 'variable:total', operator: 'greater_than_or_equal', value: 100 } }] }, { method: 'PUT' }))
  // RESP-009 on a payment form: a target of three counts only paid responses.
  await accepted(await p.call(`${p.base}/publish`, { expectedVersion: (await p.read()).flow.draftVersion, targetCompletedResponses: 3 }), 201)
  await env.DB.prepare("INSERT INTO notification_preferences(flow_id,operator_id,mode,updated_at) VALUES(?,?,'immediately',?) ON CONFLICT(flow_id,operator_id) DO UPDATE SET mode='immediately'").bind(flowId, p.operatorId, new Date().toISOString()).run()
  type Paying = Receipt & { completionStepId: string | null; payment?: { state: string; checkoutUrl?: string } }
  const orderInput = async (quantity: number, discount: boolean, session?: Session, extra: Record<string, unknown> = {}) => {
    const { sessionId, sessionToken, revisionId } = session ?? await p.start()
    return { sessionId, sessionToken, loadTime: await issueLoadTime(env.SESSION_SECRET, revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(), answers: [{ stepId: p.quantity.id, value: quantity }, { stepId: p.discount.id, value: discount }], ...extra }
  }
  const order = async (quantity: number, discount: boolean, session?: Session, extra: Record<string, unknown> = {}) => {
    const input = await orderInput(quantity, discount, session, extra)
    return { input, receipt: await accepted<Paying>(await p.call(`/api/public/flows/${p.slug}/responses`, input, { auth: false }), 201) }
  }
  const checkoutId = (receipt: Paying) => receipt.payment!.checkoutUrl!.split('/').at(-1)!
  const sessionCreations = async () => (await stripe.state()).requests.filter(request => request.method === 'POST' && request.path === '/v1/checkout/sessions')
  const payment = (responseId: string) => env.DB.prepare('SELECT state, attempt, amount, checkout_session_id AS session, payment_intent_id AS intent, provider_amount AS charged FROM response_payments WHERE response_id=?').bind(responseId).first<{ state: string; attempt: number; amount: number; session: string; intent: string | null; charged: number | null }>()
  const notified = async (responseId: string) => { await materializeNotifications(env.DB, new Date().toISOString()); return (await env.DB.prepare('SELECT count(*) AS n FROM notification_deliveries WHERE response_id=?').bind(responseId).first<{ n: number }>())!.n }

  const bulk = await order(8, true)
  expect(bulk.receipt).toMatchObject({ completionStepId: null, payment: { state: 'pending', checkoutUrl: expect.stringMatching(/\/pay\/cs_test_/) } })
  const sent = (await sessionCreations()).at(-1)!
  expect(sent).toMatchObject({ authorization: `Bearer ${stripeKey}`, idempotencyKey: `pencil-checkout:${bulk.receipt.responseId}:1`, version: '2024-06-20' })
  const calculated = (await p.ledger()).responses.find(response => response.id === bulk.receipt.responseId)!.calculations[0].value
  expect(calculated).toBe(128)
  expect(sent.form).toMatchObject({ mode: 'payment', client_reference_id: bulk.receipt.responseId, 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Number(calculated) * 100), 'line_items[0][quantity]': '1', 'line_items[0][price_data][product_data][name]': 'Pay the bulk total' })
  expect((await stripe.state()).sessions[checkoutId(bulk.receipt)].amount_total).toBe(12_800)
  const sentBefore = (await sessionCreations()).length, refusedAmount = await p.call(`/api/public/flows/${p.slug}/responses`, await orderInput(8, true, undefined, { amount: 1 }), { auth: false })
  expect(refusedAmount.status).toBe(400)
  expect(await refusedAmount.text()).toMatch(/submitted amount is refused/)
  expect((await sessionCreations()).length).toBe(sentBefore)
  const abandoned = await order(2, false), cancelled = await order(3, false)
  expect((await p.ledger()).responses.map(response => response.payment?.state)).toEqual(['pending', 'pending', 'pending'])
  expect(await notified(bulk.receipt.responseId)).toBe(0)

  // Only a correctly signed, current webhook for that Checkout Session marks it paid; delivery is idempotent by event ID.
  const paidSession = await stripe.settle('complete', checkoutId(bulk.receipt))
  expect(await deliver(await stripeEvent('checkout.session.completed', paidSession, { secret: 'whsec_example_forged_signing_secret' }))).toMatchObject({ status: 400, outcome: 'invalid-signature' })
  expect(await deliver(await stripeEvent('checkout.session.completed', paidSession, { at: Math.floor(Date.now() / 1000) - 600 }))).toMatchObject({ status: 400, outcome: 'invalid-signature' })
  expect((await payment(bulk.receipt.responseId))!.state).toBe('pending')
  const paid = await stripeEvent('checkout.session.completed', paidSession)
  expect(await deliver(paid)).toMatchObject({ status: 200, outcome: 'applied' })
  expect(await deliver(paid)).toMatchObject({ status: 200, outcome: 'duplicate' })
  expect(await payment(bulk.receipt.responseId)).toMatchObject({ state: 'paid', intent: paidSession.payment_intent, charged: 12_800 })
  expect(await notified(bulk.receipt.responseId)).toBe(1)
  // An abandoned Checkout expires; it never notifies and never holds a place.
  expect(await deliver(await stripeEvent('checkout.session.expired', await stripe.settle('expire', checkoutId(abandoned.receipt))))).toMatchObject({ outcome: 'applied' })
  expect((await payment(abandoned.receipt.responseId))!.state).toBe('expired')
  expect(await notified(abandoned.receipt.responseId)).toBe(0)

  // Cancel returns to the payment step with every answer; the next attempt replaces it under the same RESP-012 key.
  const firstAttempt = checkoutId(cancelled.receipt), cancelLink = new URL((await stripe.state()).sessions[firstAttempt].cancel_url)
  expect(cancelLink.pathname).toBe(`/f/${p.slug}`)
  const back = await accepted<PaymentReturnView>(await p.call(`/api/public/flows/${p.slug}/payments/return`, { token: cancelLink.searchParams.get('payment-key'), outcome: cancelLink.searchParams.get('payment-return') }, { auth: false }))
  expect(back).toMatchObject({ state: 'open', payment: { state: 'cancelled' }, currentStepId: standardPay.id, idempotencyKey: cancelled.input.idempotencyKey, answers: [{ stepId: p.quantity.id, value: 3 }, { stepId: p.discount.id, value: false }] })
  if (back.state !== 'open') throw new Error('The cancel return did not reopen the payment step.')
  expect((await stripe.state()).sessions[firstAttempt].status).toBe('expired')
  const replaced = await order(4, false, back, { idempotencyKey: back.idempotencyKey })
  expect(replaced.receipt.responseId).toBe(cancelled.receipt.responseId)
  expect((await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE session_id=?').bind(cancelled.input.sessionId).first<{ n: number }>())!.n).toBe(1)
  expect(await payment(cancelled.receipt.responseId)).toMatchObject({ state: 'pending', attempt: 2, amount: 8_000 })
  expect((await sessionCreations()).at(-1)!.idempotencyKey).toBe(`pencil-checkout:${cancelled.receipt.responseId}:2`)
  expect(await deliver(await stripeEvent('checkout.session.completed', await stripe.settle('complete', checkoutId(replaced.receipt))))).toMatchObject({ outcome: 'applied' })
  expect(await deliver(await stripeEvent('checkout.session.expired', (await stripe.state()).sessions[firstAttempt]))).toMatchObject({ status: 200, outcome: 'ignored' })
  const successLink = new URL((await stripe.state()).sessions[checkoutId(replaced.receipt)].success_url)
  expect(await accepted(await p.call(`/api/public/flows/${p.slug}/payments/return`, { token: successLink.searchParams.get('payment-key'), outcome: 'success' }, { auth: false }))).toMatchObject({ state: 'completed', completionStepId: p.ordinary.id, payment: { state: 'paid' } })

  // RESP-008: an invitation admits one paid response; its expired attempt is replaced from a new session, not duplicated.
  const contact = await accepted<{ id: string }>(await p.call('/api/app/distribution/contacts', { name: 'Invited buyer', email: `buyer-${crypto.randomUUID()}@example.test` }), 201)
  const launch = await accepted<{ id: string }>(await p.call(`${p.base}/distribution`, { contactIds: [contact.id], commandKey: crypto.randomUUID() }), 201)
  const { token: invitationToken, id: participantId } = (await env.DB.prepare('SELECT token, id FROM invitation_participants WHERE launch_id=?').bind(launch.id).first<{ token: string; id: string }>())!
  const invitedSession = async () => accepted<Session>(await p.call(`/api/public/flows/${p.slug}/sessions`, { deviceClass: 'desktop', source: 'direct', invitationToken }, { auth: false }), 201)
  const invited = await order(2, false, await invitedSession(), { invitationToken })
  expect((await env.DB.prepare('SELECT response_status FROM invitation_participants WHERE id=?').bind(participantId).first<{ response_status: string }>())!.response_status).toBe('started')
  expect(await deliver(await stripeEvent('checkout.session.expired', await stripe.settle('expire', checkoutId(invited.receipt))))).toMatchObject({ outcome: 'applied' })
  const again = await order(5, false, await invitedSession(), { invitationToken })
  expect(again.receipt.responseId).toBe(invited.receipt.responseId)
  expect(await deliver(await stripeEvent('checkout.session.completed', await stripe.settle('complete', checkoutId(again.receipt))))).toMatchObject({ outcome: 'applied' })
  expect((await env.DB.prepare('SELECT response_status FROM invitation_participants WHERE id=?').bind(participantId).first<{ response_status: string }>())!.response_status).toBe('completed')
  expect((await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE participant_id=?').bind(participantId).first<{ n: number }>())!.n).toBe(1)
  // Three paid responses reach the target of three: admission closes although five responses were committed.
  const closed = await p.call(`/api/public/flows/${p.slug}/sessions`, { deviceClass: 'desktop', source: 'direct' }, { auth: false })
  expect(closed.status).toBe(409)
  expect((await p.ledger()).responses.map(response => response.payment?.state).sort()).toEqual(['expired', 'paid', 'paid', 'paid'])

  // DATA-002: erasure removes the payment reference with its response; other payments and their Stripe IDs remain.
  const erased = await p.call(`/api/app/responses/${abandoned.receipt.responseId}`, {}, { method: 'DELETE' })
  expect(erased.status, await erased.clone().text()).toBe(204)
  expect(await payment(abandoned.receipt.responseId)).toBeNull()
  expect((await env.DB.prepare('SELECT count(*) AS n FROM payment_events WHERE response_id=?').bind(abandoned.receipt.responseId).first<{ n: number }>())!.n).toBe(0)
  expect(await payment(bulk.receipt.responseId)).toMatchObject({ state: 'paid', session: paidSession.id, intent: paidSession.payment_intent })


  // PAY-001(c-f,h): the real app, webhook and scheduler doors share persisted payment state.
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    vi.setSystemTime(new Date('2026-10-01T08:00:00.000Z'))
    const q = await fixture(), qid = (await q.read()).flow.id
    await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(q.operatorId).run()
    await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id),expires_at=? WHERE operator_id=?').bind(Date.parse('2099-01-01'), q.operatorId).run()
    await accepted(await q.call('/api/app/connections/payment', connection, { method: 'PUT' }))
    const qpay = (await accepted<{ step: { id: string } }>(await q.call(`${q.base}/draft/steps`, {
      expectedVersion: (await q.read()).flow.draftVersion,
      step: { kind: 'payment', questionType: null, prompt: 'Pay order', nextStepId: q.ordinary.id, questionSettings: { payment: pricing } },
    }), 201)).step
    await accepted(await q.call(`${q.base}/draft`, { expectedVersion: (await q.read()).flow.draftVersion, stepId: q.discount.id, prompt: q.discount.prompt, required: true, nextStepId: qpay.id }, { method: 'PUT' }))
    await accepted(await q.publish(), 201)
    await accepted(await q.call(`${q.base}/notifications`, { mode: 'daily' }, { method: 'PUT' }))
    const collector = await accepted<{ id: string; publicKey: string }>(await q.call(`${q.base}/collectors`, { name: 'Paid seats', channel: 'web', responseLimit: 2 }), 201)
    const admission = () => q.call(`/api/public/flows/${q.slug}/sessions`, { deviceClass: 'desktop', source: 'direct', collectorKey: collector.publicKey }, { auth: false })
    const place = async (collected = true) => {
      const session = collected ? await accepted<Session>(await admission(), 201) : await q.start()
      return q.submit([{ stepId: q.quantity.id, value: 2 }, { stepId: q.discount.id, value: false }], session, collected ? { collectorKey: collector.publicKey } : {})
    }
    const orders = await Promise.all([place(), place(), place(), place()])
    const publicPayment = async (id: string) => (await q.ledger()).responses.find(row => row.id === id)!.payment!
    const sessionFor = async (id: string) => (await stripe.state()).sessions[(await payment(id))!.session]
    const fail = await stripeEvent('checkout.session.async_payment_failed', await sessionFor(orders[0].receipt.responseId))
    expect(await deliver(fail)).toMatchObject({ status: 200, outcome: 'applied' })
    expect(await deliver(fail)).toMatchObject({ status: 200, outcome: 'duplicate' })
    expect(await publicPayment(orders[0].receipt.responseId)).toMatchObject({ state: 'failed' })
    expect((await q.ledger()).total).toBe(4)
    expect(await notified(orders[0].receipt.responseId)).toBe(0)
    expect((await admission()).status).toBe(201)
    const collectorView = async () => (await accepted<Array<{ id: string; state: string; released: number }>>(await q.call(`${q.base}/collectors`))).find(row => row.id === collector.id)!
    expect(await collectorView()).toMatchObject({ state: 'open', released: 0 })

    const mail: Array<Record<string, any>> = []
    const network = globalThis.fetch
    const capture = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url) !== 'https://api.sendgrid.com/v3/mail/send') return network(url, options)
      mail.push(JSON.parse(String(options!.body)))
      return new Response(null, { status: 202 })
    })
    const tick = async (at: string) => {
      vi.setSystemTime(new Date(at))
      await worker.scheduled(createScheduledController({ scheduledTime: Date.now(), cron: '15 * * * *' }), {
        ...env, PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false', APP_ORIGIN: 'https://forms.example.test',
        SEED_ADMIN_EMAIL: 'owner@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'synthetic-mail-edge-key', MAIL_FROM: 'no-reply@example.test', AI_ENABLED: 'false',
      })
    }
    const ownMail = () => mail.filter(message => JSON.stringify(message.personalizations).includes(`${q.operatorId}@example.test`))
    const cohorts = async () => (await env.DB.prepare('SELECT m.response_id FROM digest_members m JOIN digest_deliveries d ON d.id=m.delivery_id WHERE d.flow_id=? AND d.operator_id=? ORDER BY m.response_id').bind(qid, q.operatorId).all<{ response_id: string }>()).results.map(row => row.response_id)
    try {
      await tick('2026-10-01T09:00:00.000Z')
      expect(ownMail()).toEqual([])
      expect(await cohorts()).toEqual([])
      expect(await env.DB.prepare('SELECT cutoff FROM digest_preferences WHERE flow_id=? AND operator_id=?').bind(qid, q.operatorId).first()).toEqual({ cutoff: '2026-10-01T09:00:00.000Z' })
      // This pending response predates the consumed opening; payment must not lose it behind the cursor.
      vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'))
      const paidOne = await stripe.settle('complete', (await sessionFor(orders[1].receipt.responseId)).id)
      const settled = await stripeEvent('checkout.session.completed', paidOne)
      expect(await deliver(settled)).toMatchObject({ outcome: 'applied' })
      expect(await deliver(settled)).toMatchObject({ outcome: 'duplicate' })
      expect(await publicPayment(orders[1].receipt.responseId)).toMatchObject({ state: 'paid' })
      expect(await collectorView()).toMatchObject({ state: 'open', released: 1 })
      expect((await admission()).status).toBe(201)
      await tick('2026-10-02T09:00:00.000Z')
      await tick('2026-10-02T09:00:00.000Z')
      expect(await cohorts()).toEqual([orders[1].receipt.responseId])
      expect(ownMail()).toHaveLength(1)
      expect(ownMail()[0].headers['X-Pencil-Digest-Count']).toBe('1')
      expect(JSON.stringify(ownMail())).not.toContain(orders[0].receipt.responseId)
      const paidTwo = await stripe.settle('complete', (await sessionFor(orders[2].receipt.responseId)).id)
      expect(await deliver(await stripeEvent('checkout.session.completed', paidTwo))).toMatchObject({ outcome: 'applied' })
      expect(await collectorView()).toMatchObject({ state: 'full', released: 2 })
      expect((await admission()).status).toBe(409)
      // PAY-001(d) only: webhook refund state, not the unbuilt refund UI/API.
      const refund = await stripeEvent('charge.refunded', { id: 'ch_test_refund_example', object: 'charge', refunded: true, payment_intent: paidOne.payment_intent })
      expect(await deliver(refund)).toMatchObject({ outcome: 'applied' })
      expect(await deliver(refund)).toMatchObject({ outcome: 'duplicate' })
      expect(await publicPayment(orders[1].receipt.responseId)).toMatchObject({ state: 'refunded' })
      expect((await q.ledger()).total).toBe(4)
      expect(ownMail()).toHaveLength(1)
      expect(await notified(orders[1].receipt.responseId)).toBe(0)
    } finally { capture.mockRestore() }

    // Retention is configured through its settings door after old data has aged.
    vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'))
    const control = await place(false)
    const controlSession = await stripe.settle('complete', (await sessionFor(control.receipt.responseId)).id)
    expect(await deliver(await stripeEvent('checkout.session.completed', controlSession))).toMatchObject({ outcome: 'applied' })
    const expiredId = orders[2].receipt.responseId, expired = (await payment(expiredId))!
    expect(expired).toMatchObject({ state: 'paid', session: expect.stringMatching(/^cs_test_/), intent: expect.stringMatching(/^pi_test_/) })
    const policy = await accepted<{ version: number }>(await q.call(`${q.base}/retention`))
    const enabled = await accepted<{ notices: { responses: number } }>(await q.call(`${q.base}/retention`, { days: 30, legalHold: false, version: policy.version, confirmAutomaticDeletion: true }, { method: 'PUT' }))
    expect(enabled.notices.responses).toBe(4)
    const archive = async () => accepted<{ payload: unknown }>(await q.call('/api/app/backup/export', {}))
    const beforeArchive = JSON.stringify(await archive())
    for (const value of [expiredId, expired.session, expired.intent!, control.receipt.responseId, controlSession.id, controlSession.payment_intent!]) expect(beforeArchive).toContain(value)
    const exported = async () => httpExport<{ responses: Ledger['responses'] }>(path => q.call(path), `${q.base}/responses/export`)
    expect((await exported()).responses.map(row => row.id)).toContain(expiredId)
    await worker.scheduled(createScheduledController({ scheduledTime: Date.parse('2026-11-10T10:00:00.000Z'), cron: '15 * * * *' }), env)
    const afterArchive = JSON.stringify(await archive()), afterExport = JSON.stringify(await exported())
    for (const value of [expiredId, expired.session, expired.intent!]) {
      expect(afterArchive).not.toContain(value)
      expect(afterExport).not.toContain(value)
      expect(JSON.stringify(await q.ledger())).not.toContain(value)
    }
    expect((await q.ledger()).responses.map(row => row.id)).toEqual([control.receipt.responseId])
    expect(await payment(expiredId)).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM responses WHERE id=?').bind(expiredId).first()).toBeNull()
    expect((await env.DB.prepare('SELECT id FROM payment_events WHERE response_id=?').bind(expiredId).all()).results).toEqual([])
    expect(await payment(control.receipt.responseId)).toMatchObject({ state: 'paid', session: controlSession.id, intent: controlSession.payment_intent })
    expect(afterArchive).toContain(controlSession.payment_intent!)
  } finally { vi.useRealTimers() }
}, 90_000)

contract('LOGIC-003', 'calculates typed hidden inputs, arithmetic, calendar differences and dependent blanks after duplication', async () => {
  const f = await fixture()
  const hidden = (fieldId: string): CalculationExpression => ({ kind: 'hidden', fieldId })
  const variable = (variableId: string): CalculationExpression => ({ kind: 'variable', variableId })
  const calculations: Calculation[] = [f.calculation,
    { id: 'net', name: 'Net unit price', type: 'number', expression: { kind: 'add', left: { kind: 'subtract', left: hidden('base'), right: literal(2) }, right: { kind: 'divide', left: literal(3), right: literal(2) } } },
    { id: 'rounded', name: 'Rounded unit price', type: 'number', expression: { kind: 'round', value: variable('net'), decimalPlaces: 2 } },
    { id: 'extended', name: 'Quantity price', type: 'number', expression: { kind: 'multiply', left: variable('rounded'), right: { kind: 'answer', stepId: f.quantity.id } } },
    { id: 'product', name: 'Product name', type: 'text', expression: hidden('product') },
    ...(['days', 'months', 'years'] as const).map(unit => ({ id: unit, name: `Calendar ${unit}`, type: 'number' as const, expression: { kind: 'date_difference' as const, start: hidden('start'), end: hidden('end'), unit } })),
    { id: 'missing', name: 'Missing adjustment', type: 'number', expression: { kind: 'add', left: hidden('adjustment'), right: literal(1) } },
    { id: 'dependent', name: 'Dependent blank', type: 'number', expression: { kind: 'divide', left: variable('missing'), right: literal(2) } },
  ]
  const settings = { identityMode: 'anonymous', hiddenFields: [
    { id: 'base', name: 'base_price', type: 'number', category: 'plain' },
    { id: 'product', name: 'product', type: 'text', category: 'plain' },
    { id: 'start', name: 'period_start', type: 'date', category: 'plain' },
    { id: 'end', name: 'period_end', type: 'date', category: 'plain' },
    { id: 'adjustment', name: 'adjustment', type: 'number', category: 'plain' },
  ], calculations }
  await accepted(await f.call(`${f.base}/draft/settings`, { settings, expectedVersion: (await f.read()).flow.draftVersion }, { method: 'PUT' }))
  await accepted(await f.publish(), 201)
  const inputs = { base_price: '12.375', product: 'Widget', period_start: '2024-02-29', period_end: '2025-03-01' }
  const expected = { 'Order total': 40, 'Net unit price': 11.875, 'Rounded unit price': 11.88, 'Quantity price': 23.76, 'Product name': 'Widget', 'Calendar days': 366, 'Calendar months': 12, 'Calendar years': 1, 'Missing adjustment': null, 'Dependent blank': null }
  const submitted = await f.submit([{ stepId: f.quantity.id, value: 2 }, { stepId: f.discount.id, value: false }], undefined, { hidden: inputs })
  const original = (await f.ledger()).responses.find(response => response.id === submitted.receipt.responseId)!
  expect(Object.fromEntries(original.calculations.map(value => [value.name, value.value]))).toEqual(expected)
  expect((await f.ledger(new URLSearchParams({ search: 'Widget' }).toString())).responses.map(response => response.id)).toEqual([original.id])
  const duplicate = await accepted<{ id: string }>(await f.call(`${f.base}/duplicate`, { title: 'Copied pricing calculator', slug: `copy-${f.slug}` }), 201)
  const copyBase = `/api/app/flows/${duplicate.id}`, copy = await accepted<BuilderDraft>(await f.call(`${copyBase}/draft`))
  await accepted(await f.call(`${copyBase}/publish`, { expectedVersion: copy.flow.draftVersion }), 201)
  const copySlug = copy.flow.slug, copySession = await accepted<Session>(await f.call(`/api/public/flows/${copySlug}/sessions`, { deviceClass: 'mobile', source: 'direct' }, { auth: false }), 201)
  const completed = await accepted<Receipt>(await f.call(`/api/public/flows/${copySlug}/responses`, {
    ...copySession, hidden: inputs, loadTime: await issueLoadTime(env.SESSION_SECRET, copySession.revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(),
    answers: [{ stepId: copy.steps[0].id, value: 2 }, { stepId: copy.steps[1].id, value: false }],
  }, { auth: false }), 201)
  const copied = (await accepted<Ledger>(await f.call(`${copyBase}/ledger`))).responses.find(response => response.id === completed.responseId)!
  expect(Object.fromEntries(copied.calculations.map(value => [value.name, value.value]))).toEqual(expected)
  expect(copied.calculations.every(value => !original.calculations.some(source => source.id === value.id))).toBe(true)
}, 60_000)

contract('LOGIC-003', 'a BMI from two decimal answers gates a branch and publishes', async () => {
  const f = await googleHttp(), slug = `bmi-${crypto.randomUUID()}`
  const { id } = await accepted<{ id: string }>(await f.call('/api/app/flows', { title: 'Health check', slug }), 201)
  const base = `/api/app/flows/${id}`, read = async () => accepted<BuilderDraft>(await f.call(`${base}/draft`))
  for (const step of [
    { kind: 'question', questionType: 'number', prompt: 'Weight in kilograms', required: true, questionSettings: { min: 1, decimalPlaces: 1 } },
    { kind: 'question', questionType: 'number', prompt: 'Height in metres', required: true, questionSettings: { min: 0.5, max: 2.5, decimalPlaces: 2 } },
    { kind: 'question', questionType: 'yes_no', prompt: 'Do you smoke?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Healthy range · BMI {{variable:bmi}}' },
    { kind: 'completion', questionType: null, prompt: 'Follow-up · BMI {{variable:bmi}}' },
    { kind: 'completion', questionType: null, prompt: 'Smoker follow-up' },
  ]) await accepted(await f.call(`${base}/draft/steps`, { expectedVersion: (await read()).flow.draftVersion, step }), 201)
  const [weight, height, smoker, healthy, followUp, smokers] = (await read()).steps
  const answer = (stepId: string): CalculationExpression => ({ kind: 'answer', stepId })
  const bmi: Calculation = { id: 'bmi', name: 'BMI', type: 'number', expression: { kind: 'round', decimalPlaces: 1, value: { kind: 'divide', left: answer(weight.id), right: { kind: 'multiply', left: answer(height.id), right: answer(height.id) } } } }
  const risk: Calculation = { id: 'risk', name: 'Risk points', type: 'number', expression: { kind: 'conditional', condition: { kind: 'test', stepId: smoker.id, operator: 'equals', value: true }, then: literal(1), else: literal(0) } }
  await accepted(await f.call(`${base}/draft/settings`, { expectedVersion: (await read()).flow.draftVersion, settings: { hiddenFields: [], identityMode: 'anonymous', calculations: [bmi, risk] } }, { method: 'PUT' }))
  const bmiRule = { sourceStepId: smoker.id, predicateKind: 'equals', expectedValue: null, destinationStepId: followUp.id, position: 0, condition: { kind: 'test', stepId: 'variable:bmi', operator: 'greater_than_or_equal', value: 25 } }
  const rules = async (extra: unknown[]) => accepted(await f.call(`${base}/draft/branches`, { expectedVersion: (await read()).flow.draftVersion, rules: [bmiRule, ...extra] }, { method: 'PUT' }))
  const publish = async () => f.call(`${base}/publish`, { expectedVersion: (await read()).flow.draftVersion })

  // Finite calculated tests are still proved exactly: risk is 0 or 1, never above 1.
  const riskRule = (operator: string) => ({ ...bmiRule, destinationStepId: smokers.id, position: 1, condition: { kind: 'test', stepId: 'variable:risk', operator, value: 1 } })
  await rules([riskRule('greater_than')])
  const refused = await publish()
  expect(refused.status, await refused.clone().text()).toBe(400)
  expect(await refused.text()).toMatch(/reachable/i)
  await rules([riskRule('greater_than_or_equal')])

  const cases = [[70.5, 1.75, 23], [95.2, 1.75, 31.1]] as const
  for (const [kilograms, metres, value] of cases) {
    const preview = await accepted<{ complete: boolean; screens: Array<{ stepId: string; evaluations: Array<{ matched: boolean; trace?: { value: unknown } }> }> }>(await f.call(`${base}/draft/preview`, { answers: { [weight.id]: kilograms, [height.id]: metres, [smoker.id]: false } }))
    const gate = preview.screens.find(screen => screen.stepId === smoker.id)!.evaluations[0]
    expect(gate.trace?.value).toBe(value)
    expect(gate.matched).toBe(value >= 25)
    expect(preview.screens.at(-1)?.stepId).toBe(value >= 25 ? followUp.id : healthy.id)
  }
  await accepted(await publish(), 201)
  for (const [kilograms, metres, value] of cases) {
    const session = await accepted<Session>(await f.call(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' }, { auth: false }), 201)
    const receipt = await accepted<Receipt>(await f.call(`/api/public/flows/${slug}/responses`, { ...session, loadTime: await issueLoadTime(env.SESSION_SECRET, session.revisionId, Date.now() - 5000), idempotencyKey: crypto.randomUUID(), answers: [{ stepId: weight.id, value: kilograms }, { stepId: height.id, value: metres }, { stepId: smoker.id, value: false }] }, { auth: false }), 201)
    expect(receipt.completionStepId).toBe(value >= 25 ? followUp.id : healthy.id)
    const stored = (await accepted<Ledger>(await f.call(`${base}/ledger`))).responses.find(response => response.id === receipt.responseId)!
    expect(stored.calculations.find(item => item.id === 'bmi')?.value).toBe(value)
  }
}, 60_000)
