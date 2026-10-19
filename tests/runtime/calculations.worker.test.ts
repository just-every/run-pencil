import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import { httpExport } from '../helpers/report-download'
import { issueLoadTime } from '../../src/core/features/traffic/loadTime'
import { resumeBearer } from '../../src/core/features/resuming/credentials'
import { interpolateAnswerRecall } from '../../src/core/shared/answerRecall'
import type { BuilderDraft, Ledger, PublicFlow } from '../../src/core/app/api'
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

contract('LOGIC-003', 'refuses cyclic, deleted, mistyped and zero-denominator calculations without publishing the draft', async () => {
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
}, 60_000)

contract('LOGIC-003', 'excludes off-path and forged operands and completes a private saved quote using its accepted answers', async () => {
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
}, 60_000)

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
