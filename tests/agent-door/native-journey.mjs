import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

const ensure = (condition, message) => {
  if (!condition) {
    // These diagnostics are fixed literals below; no records, credentials,
    // arguments or captured mail are included in verifier output.
    console.error(`Pencil native journey: ${message}`)
    throw new Error(message)
  }
}
const code = answer => answer.result?._meta?.['com.runeditrun/error']?.code ?? answer.body?.error?.data?.code
const output = answer => {
  ensure(answer.status === 200 && !answer.result?.isError && answer.result?.structuredContent !== undefined, 'The native tool did not complete.')
  return answer.result.structuredContent
}
function personRequest({ request, origin, cookie }, path, init = {}) {
  return request(new URL(path, origin).href, { ...init, redirect: 'manual', headers: { Cookie: cookie, Origin: origin, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
}
async function personJson(context, path) {
  const response = await personRequest(context, path)
  ensure(response.ok, 'A native person read failed.')
  return response.json()
}
const nativeDraft = (context, flowId) => personJson(context, `/api/app/flows/${encodeURIComponent(flowId)}/draft`)

// Read only fresh audit pages. The native actor label must agree with the door's
// original agent/sponsor decision; caller-supplied text is never attribution.
let auditCursor = null
async function decisionFor(context, key) {
  let found
  for (let page = 0; page < 100; page++) {
    const result = await personJson(context, `/agents/api/audit${auditCursor ? `?after=${encodeURIComponent(auditCursor)}` : ''}`)
    ensure(Array.isArray(result.rows) && result.differs_from_policy === 0, 'The door audit differs from policy.')
    for (const row of result.rows) if (row.idempotency_key === key && row.outcome === 'done') found = row
    if (result.cursor === null || result.cursor === auditCursor) break
    auditCursor = result.cursor
    if (!result.rows.length) break
  }
  ensure(found, 'A completed native write has no completed door audit.')
  return found
}
async function nativeAttribution(context, flowId, key, held) {
  const decision = await decisionFor(context, key)
  const native = await personJson(context, `/api/app/audit?flowId=${encodeURIComponent(flowId)}&limit=100`)
  const row = native.rows.find(item => item.actor?.id === decision.sponsor.id && item.actor.name === decision.label)
  ensure(row && decision.label === `${decision.agent.name} for ${decision.sponsor.name}`, 'Native and door attribution disagree.')
  if (held) ensure(typeof row.details.approvedBy === 'string' && row.details.approvedBy.length > 0, 'Native approval must name the real human approver separately from its agent preparer.')
}

let previewBefore
export async function beforeStep(context) {
  if (context.phase === 'autonomous' && context.step.id === 'list') auditCursor = null
  if (context.step.id === 'preview') previewBefore = await personJson(context, '/api/app/dashboard')
}
export async function afterStep(context) {
  const { step, args, result, phase } = context
  if (step.id === 'list') return
  if (step.id === 'preview') {
    ensure(result.preview === true && result.complete === true, 'The native preview must reach completion.')
    ensure(isDeepStrictEqual(previewBefore, await personJson(context, '/api/app/dashboard')), 'Preview changed native form or response counts.')
    return
  }
  const verb = step.tool.split('.').at(-1)
  const flowId = ['create', 'duplicate'].includes(verb) ? result.id : args.flowId
  const draft = await nativeDraft(context, flowId)
  if (verb === 'read') {
    ensure(isDeepStrictEqual(result.flow, draft.flow) && isDeepStrictEqual(result.steps, draft.steps), 'The tool read differs from the native builder.')
    return
  }
  if (verb === 'create') ensure(draft.flow.status === 'draft' && draft.flow.title === args.title, 'Creation must leave an ordinary unpublished draft.')
  if (verb === 'duplicate') {
    ensure(draft.flow.status === 'draft' && draft.flow.id !== args.flowId && draft.flow.title === args.title, 'Duplication must create an independent unpublished form.')
    const source = await nativeDraft(context, args.flowId)
    ensure(draft.steps.length === source.steps.length && draft.steps.every(item => !source.steps.some(prior => prior.id === item.id)), 'Duplicated native steps must retain content under independent identities.')
  }
  if (verb === 'update_step') {
    const selected = draft.steps.find(item => item.id === args.stepId)
    ensure(selected?.prompt === args.prompt && selected.required === args.required, 'The native draft did not retain the proposed question.')
  }
  if (['add_step', 'duplicate_step'].includes(verb)) ensure(draft.steps.some(item => item.id === result.step.id && item.prompt === result.step.prompt), 'The new native draft step is absent.')
  if (verb === 'delete_step') ensure(!draft.steps.some(item => item.id === args.stepId), 'The deleted native draft step is still present.')
  if (verb === 'reorder_steps') ensure(isDeepStrictEqual(draft.steps.map(item => item.id), args.orderedStepIds), 'The native order differs from the proposed order.')
  if (verb === 'replace_rules') ensure(draft.branchRules.length === args.rules.length, 'The native rule replacement did not persist.')
  if (['publish', 'close', 'reopen', 'archive'].includes(verb)) {
    const expected = { publish: 'open', close: 'closed', reopen: 'open', archive: 'archived' }[verb]
    ensure(draft.flow.status === expected, 'The native form lifecycle did not change as proposed.')
    const publicResponse = await personRequest(context, `/api/public/flows/${encodeURIComponent(draft.flow.slug)}`)
    ensure(publicResponse.status === (expected === 'open' ? 200 : expected === 'closed' ? 409 : 404), 'The respondent door disagrees with native form status.')
    await publicResponse.body?.cancel()
  }
  const held = phase === 'held' && step.expect.some(item => item.class !== 'standard')
  await nativeAttribution(context, flowId, args.idempotency_key, held)
}

// Additional ordinary public-door proof: a changed request cannot reuse a
// successful key, stale native versions refuse, and local Pause prevents the
// next effect. All application and authorization code runs unchanged.
export default async function nativeJourney(context) {
  const { tool } = context
  const created = output(await tool('pencil.flows.create', { title: 'Native revision and Pause proof', slug: `door-native-${randomUUID()}`, template: 'feedback', idempotency_key: randomUUID() }))
  const initial = output(await tool('pencil.flows.read', { flowId: created.id }))
  const key = randomUUID()
  const args = { flowId: created.id, stepId: initial.steps[0].id, prompt: 'A version-guarded native question', required: true, expectedVersion: initial.flow.draftVersion, expected_revision: initial.flow.draftVersion, idempotency_key: key }
  output(await tool('pencil.flows.update_step', args))
  const current = await nativeDraft(context, created.id)
  const conflict = await tool('pencil.flows.update_step', { ...args, prompt: 'Changed arguments must not replace the saved effect' })
  ensure(code(conflict) === 'idempotency_conflict', 'Changed arguments reused an idempotent effect.')
  ensure(isDeepStrictEqual(current, await nativeDraft(context, created.id)), 'The conflicting key changed the native draft.')
  const stale = await tool('pencil.flows.update_step', { ...args, idempotency_key: randomUUID() })
  ensure(code(stale) === 'revision_conflict', 'A stale native revision was accepted.')
  ensure(isDeepStrictEqual(current, await nativeDraft(context, created.id)), 'The stale revision changed the native draft.')
  await nativeAttribution(context, created.id, key, false)
  const beforePause = await personJson(context, '/api/app/dashboard')
  const paused = await personRequest(context, '/agents/api/pause', { method: 'POST', body: JSON.stringify({ paused: true }) })
  ensure(paused.ok, 'The native person could not pause agents.')
  await paused.body?.cancel()
  try {
    const refusal = await tool('pencil.flows.create', { title: 'Paused creation has no effect', slug: `door-paused-${randomUUID()}`, idempotency_key: randomUUID() })
    ensure(code(refusal) === 'agents_paused', 'Local Pause did not refuse the next effect.')
    ensure(isDeepStrictEqual(beforePause, await personJson(context, '/api/app/dashboard')), 'Local Pause allowed a native effect.')
  } finally {
    const resumed = await personRequest(context, '/agents/api/pause', { method: 'POST', body: JSON.stringify({ paused: false }) })
    ensure(resumed.ok, 'The native person could not resume agents.')
    await resumed.body?.cancel()
  }
}
