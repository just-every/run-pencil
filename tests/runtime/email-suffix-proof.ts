import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import type { Condition, ConditionValue } from '../../src/core/shared/conditions'
import { foundationFixture } from './foundation-fixture'

type Test = Extract<Condition, { kind: 'test' }>
const leaf = (stepId: string, operator: Test['operator'], value?: ConditionValue): Condition => ({ kind: 'test', stepId, operator, ...(value === undefined ? {} : { value }) })
const all = (...conditions: Condition[]): Condition => ({ kind: 'group', join: 'and', conditions })
const address = (domain: string, local = 'synthetic-pencil-1') => [local, domain].join('@')

/** Native admission and preview use the same suffix rule and published revision. */
export async function emailSuffixRoutingProof() {
  const f = await foundationFixture('email-suffix-routing')
  for (const step of [
    { kind: 'question' as const, questionType: 'yes_no' as const, prompt: 'Provide an email?', required: true },
    { kind: 'question' as const, questionType: 'email' as const, prompt: 'Contact email', required: false },
    { kind: 'question' as const, questionType: 'short_text' as const, prompt: 'Additional note', required: false },
    { kind: 'completion' as const, questionType: null, prompt: 'Matching email destination' },
    { kind: 'completion' as const, questionType: null, prompt: 'Default email destination' },
  ]) await f.add(step)
  let draft = await f.draft()
  const [gate, email, note, matching, fallback] = draft.steps
  await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: note.id, prompt: note.prompt, required: false, nextStepId: fallback.id })
  const save = async (suffix: string) => {
    draft = await f.draft()
    await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [
      { sourceStepId: gate.id, destinationStepId: note.id, position: 0, predicateKind: 'equals', expectedValue: false },
      ...[email, note].map(source => ({ sourceStepId: source.id, destinationStepId: matching.id, position: 0, predicateKind: 'equals' as const, expectedValue: null, condition: leaf(email.id, 'ends_with', suffix) })),
    ] })
    expect((await f.draft()).branchRules.filter(rule => rule.condition).map(rule => rule.condition)).toEqual([leaf(email.id, 'ends_with', suffix), leaf(email.id, 'ends_with', suffix)])
  }
  await save(' GMAIL.COM ')
  for (const [value, end, matched] of [[address('GMAIL.COM'), matching.id, true], [address('gmail.co'), fallback.id, false], ['  ', fallback.id, false]] as const) {
    const preview = await f.services.flows.previewDraft({ ...f.flow, answers: { [gate.id]: true, [email.id]: value } })
    expect(preview.complete).toBe(true)
    expect(preview.screens.at(-1)?.stepId).toBe(end)
    expect(preview.screens.find(screen => screen.stepId === email.id)?.evaluations[0].trace).toMatchObject({ matched, condition: leaf(email.id, 'ends_with', ' GMAIL.COM ') })
  }
  await f.publish()
  let requestNumber = 0
  const post = async (session: Awaited<ReturnType<typeof f.start>>, values: Array<{ stepId: string; value: unknown }>) => {
    await f.mature(session.sessionId)
    return f.SELF.fetch(`http://localhost/api/public/flows/${f.slug}/responses`, {
      method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.18.223.${++requestNumber}` },
      body: JSON.stringify({ sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: await f.loadTime(session), idempotencyKey: `email-suffix-${session.sessionId}`, answers: values }),
    })
  }
  const submit = async (values: Array<{ stepId: string; value: unknown }>, end: string, session = undefined as Awaited<ReturnType<typeof f.start>> | undefined) => {
    const response = await post(session ?? await f.start(), values)
    expect(response.status, await response.clone().text()).toBe(201)
    const receipt = await response.json() as { responseId: string; completionStepId: string }
    expect(receipt.completionStepId).toBe(end)
    return receipt
  }
  const matchingReceipt = await submit([{ stepId: gate.id, value: true }, { stepId: email.id, value: address('GMAIL.COM') }, { stepId: note.id, value: 'Off-path note must not survive' }], matching.id)
  expect((await env.DB.prepare('SELECT step_id FROM response_answers WHERE response_id=? ORDER BY step_id').bind(matchingReceipt.responseId).all<{ step_id: string }>()).results.map(row => row.step_id)).toEqual([gate.id, email.id].sort())
  await submit([{ stepId: gate.id, value: true }, { stepId: email.id, value: address('gmail.co') }], fallback.id)
  for (const value of [undefined, '', ' \t ']) await submit([{ stepId: gate.id, value: true }, ...(value === undefined ? [] : [{ stepId: email.id, value }])], fallback.id)
  const skipped = await submit([{ stepId: gate.id, value: false }, { stepId: email.id, value: address('GMAIL.COM') }, { stepId: note.id, value: 'Kept on-path note' }], fallback.id)
  expect((await env.DB.prepare('SELECT step_id FROM response_answers WHERE response_id=? ORDER BY step_id').bind(skipped.responseId).all<{ step_id: string }>()).results.map(row => row.step_id)).toEqual([gate.id, note.id].sort())
  const twoHundred = address('gmail.com', 'x'.repeat(190))
  expect(twoHundred).toHaveLength(200)
  await submit([{ stepId: gate.id, value: true }, { stepId: email.id, value: twoHundred }], matching.id)
  for (const value of [`x${twoHundred}`, ` ${address('gmail.com')} `, 'gmail.com', address('gmail.com', 'two@parts')]) {
    const session = await f.start(), before = await env.DB.prepare('SELECT count(*) AS count FROM responses WHERE flow_id=?').bind(f.flow.flowId).first<{ count: number }>()
    const response = await post(session, [{ stepId: gate.id, value: true }, { stepId: email.id, value }])
    expect(response.status, await response.clone().text()).toBe(400)
    expect(await response.text()).toContain('Enter a valid email address.')
    expect(await env.DB.prepare('SELECT count(*) AS count FROM responses WHERE flow_id=?').bind(f.flow.flowId).first()).toEqual(before)
  }
  const pinned = await f.start()
  await save('gmail.co')
  await f.publish()
  const answers = [{ stepId: gate.id, value: true }, { stepId: email.id, value: address('GMAIL.COM') }]
  await submit(answers, matching.id, pinned)
  await submit(answers, fallback.id)
  await save(' E\u0301XAMPLE.COM ')
  const unicode = address('ÉXAMPLE.COM')
  const preview = await f.services.flows.previewDraft({ ...f.flow, answers: { [gate.id]: true, [email.id]: unicode } })
  expect(preview.screens.at(-1)?.stepId).toBe(matching.id)
  expect(preview.screens.find(screen => screen.stepId === email.id)?.evaluations[0].trace).toMatchObject({ value: unicode, matched: true })
  await f.publish()
  await submit([{ stepId: gate.id, value: true }, { stepId: email.id, value: unicode }], matching.id)
  // A raw admitted address may expand when lowercased. Publication must retain
  // the shorter preimage rather than applying the raw limit to normalized text.
  const expanding = address('İ.com', 'x'.repeat(194))
  expect(expanding).toHaveLength(200)
  await save('i\u0307.com')
  await f.publish()
  await submit([{ stepId: gate.id, value: true }, { stepId: email.id, value: expanding }], matching.id)
}

/** Every published destination needs an admissible, path-correlated witness. */
export async function emailSuffixFeasibilityProof() {
  const f = await foundationFixture('email-suffix-feasibility')
  await f.add({ kind: 'question', questionType: 'email', prompt: 'Routing email', required: false })
  await f.add({ kind: 'question', questionType: 'yes_no', prompt: 'Continue with email', required: true })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Default route' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Suffix route' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Precedence route' })
  let draft = await f.draft()
  const [email, followup, fallback, matching, precedence] = draft.steps
  // The third completion is reached by a first-priority rule; its false result
  // remains correlated with the later suffix condition on the same answer.
  const save = async (condition: Condition, first: Condition = leaf(email.id, 'equals', address('precedence.test'))) => {
    draft = await f.draft()
    await f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: [
      { sourceStepId: email.id, destinationStepId: precedence.id, position: 0, predicateKind: 'equals', expectedValue: null, condition: first },
      { sourceStepId: email.id, destinationStepId: followup.id, position: 1, predicateKind: 'equals', expectedValue: null, condition: leaf(email.id, 'is_answered') },
      { sourceStepId: followup.id, destinationStepId: matching.id, position: 0, predicateKind: 'equals', expectedValue: null, condition },
    ] })
    draft = await f.draft()
    await f.services.flows.updateBuilderDraft({ ...f.flow, expectedVersion: draft.flow.draftVersion, stepId: email.id, prompt: email.prompt, required: false, nextStepId: fallback.id })
  }
  const feasible = [
    all(leaf(email.id, 'ends_with', 'gmail.com'), leaf(email.id, 'ends_with', 'mail.com')),
    all(leaf(email.id, 'equals', ` ${address('GMAIL.COM')} `), leaf(email.id, 'ends_with', 'gmail.com')),
    all(leaf(email.id, 'not_equals', address('gmail.com')), leaf(email.id, 'ends_with', 'gmail.com')),
    leaf(email.id, 'ends_with', '@gmail.com'),
    leaf(email.id, 'ends_with', '.com'),
    leaf(email.id, 'ends_with', '.'),
    leaf(email.id, 'ends_with', `${'x'.repeat(196)}.z`),
    all(leaf(email.id, 'equals', address('İ.com', 'x'.repeat(194))), leaf(email.id, 'ends_with', 'i\u0307.com')),
    // The stored suffix itself can need a shorter raw Unicode preimage.
    leaf(email.id, 'ends_with', `${'x'.repeat(193)}i\u0307.com`),
  ]
  for (const condition of feasible) {
    await save(condition)
    await expect(f.publish()).resolves.toMatchObject({ kind: 'published' })
  }
  const impossible = [
    all(leaf(email.id, 'ends_with', 'gmail.com'), leaf(email.id, 'ends_with', 'gmail.co')),
    all(leaf(email.id, 'equals', address('gmail.co')), leaf(email.id, 'ends_with', 'gmail.com')),
    all(leaf(email.id, 'equals', address('gmail.com')), leaf(email.id, 'not_equals', ` ${address('GMAIL.COM')} `), leaf(email.id, 'ends_with', 'gmail.com')),
    leaf(email.id, 'ends_with', 'bad suffix.com'),
    leaf(email.id, 'ends_with', ['x', 'y', 'z.com'].join('@')),
    leaf(email.id, 'ends_with', `${'x'.repeat(197)}.z`),
  ]
  for (const condition of impossible) {
    await save(condition)
    const before = (await f.draft()).revision.id
    await expect(f.publish()).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: matching.id, reason: expect.stringContaining('reachable') })]) })
    expect((await f.draft()).revision.id).toBe(before)
  }
  await save(leaf(email.id, 'ends_with', 'mail.com'), leaf(email.id, 'ends_with', 'gmail.com'))
  await f.publish()
  await save(leaf(email.id, 'ends_with', 'gmail.com'), leaf(email.id, 'ends_with', 'mail.com'))
  await expect(f.publish()).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: matching.id, reason: expect.stringContaining('reachable') })]) })
  // A negated equality shares the same normalized class as a positive one;
  // first-match precedence must not manufacture a second matching destination.
  await save(leaf(email.id, 'ends_with', 'gmail.com'), leaf(email.id, 'not_equals', address('gmail.co')))
  await expect(f.publish()).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ stepId: matching.id, reason: expect.stringContaining('reachable') })]) })
  await emailSuffixProofBudget()
}

/** A branching graph that exceeds exact proof capacity must never publish. */
async function emailSuffixProofBudget() {
  const f = await foundationFixture('email-suffix-proof-budget')
  for (let index = 0; index < 24; index++) await f.add({ kind: 'question', questionType: 'email', prompt: `Optional contact ${index + 1}`, required: false })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Contact details received' })
  const draft = await f.draft()
  await expect(f.services.flows.replaceDraftBranchRules({ ...f.flow, expectedVersion: draft.flow.draftVersion, rules: draft.steps.slice(0, -2).map((step, index) => ({
    sourceStepId: step.id, destinationStepId: draft.steps[index + 2].id, position: 0,
    predicateKind: 'equals' as const, expectedValue: null, condition: leaf(step.id, 'ends_with', 'gmail.com'),
  })) })).rejects.toMatchObject({ details: expect.arrayContaining([expect.objectContaining({ reason: expect.stringContaining('exact reachability proof limit') })]) })
  const unchanged = await f.draft()
  expect(unchanged.branchRules).toEqual([])
  expect(unchanged.flow.draftVersion).toBe(draft.flow.draftVersion)
  expect(unchanged.revision.id).toBe(draft.revision.id)
}
