import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { ulid } from 'ulid'

// Exercise each seed business refusal through the person's authenticated route
// and the declared MCP tool against the same unchanged native record.
export async function proveBusinessRefusals(context, flowId, { ensure, code, nativeDraft, personJson, personRequest }) {
  const initial = await nativeDraft(context, flowId)
  ensure(initial.flow.status === 'draft', 'The reopen refusal fixture must be an unpublished draft.')
  let stepId
  do { stepId = ulid() } while (initial.steps.some(step => step.id === stepId))
  const cases = [
    {
      verb: 'delete_step', method: 'DELETE', path: `/api/app/flows/${flowId}/draft/steps/${stepId}`,
      body: { expectedVersion: initial.flow.draftVersion },
      args: { flowId, stepId, expectedVersion: initial.flow.draftVersion, expected_revision: initial.flow.draftVersion },
      status: 404, expectedCode: 'NOT_FOUND',
    },
    {
      verb: 'reopen', method: 'POST', path: `/api/app/flows/${flowId}/reopen`, body: {},
      args: { flowId, expected_revision: `${initial.flow.draftVersion}:draft` },
      status: 400, expectedCode: 'VALIDATION_ERROR',
    },
  ]
  const nativeAudit = async () => {
    const page = await personJson(context, `/api/app/audit?flowId=${flowId}&limit=100`)
    ensure(Array.isArray(page.rows) && page.nextCursor === null, 'The refusal fixture audit must be read completely.')
    return page.rows
  }
  for (const item of cases) {
    const before = await nativeDraft(context, flowId)
    const beforeAudit = await nativeAudit()
    const beforeReviews = await personJson(context, '/agents/api/reviews')
    const unchanged = async () => {
      const after = await nativeDraft(context, flowId)
      ensure(after.flow.draftVersion === before.flow.draftVersion && after.flow.status === 'draft' && isDeepStrictEqual(after, before), 'A business refusal changed native draft content, version or status.')
      ensure(isDeepStrictEqual(await nativeAudit(), beforeAudit), 'A business refusal wrote a native effect audit event.')
      ensure(isDeepStrictEqual(await personJson(context, '/agents/api/reviews'), beforeReviews), 'A business refusal created a review.')
    }
    const native = await personRequest(context, item.path, { method: item.method, body: JSON.stringify(item.body) })
    ensure(native.status === item.status, 'The native business refusal returned the wrong HTTP status.')
    const nativeBody = await native.json()
    ensure(nativeBody.error === item.expectedCode, 'The native route did not retain its seed business code.')
    await unchanged()

    const key = randomUUID()
    const name = `pencil.flows.${item.verb}`
    const refusal = await context.tool(name, { ...item.args, idempotency_key: key })
    ensure(refusal.status === 200 && refusal.result?.isError === true, 'The MCP business refusal must return isError.')
    ensure(code(refusal) === item.expectedCode && code(refusal) === nativeBody.error, 'MCP and the native route must independently return the same seed business code.')
    ensure(refusal.result.structuredContent === undefined && !refusal.result.content?.some(part => part.type === 'resource_link'), 'A refused MCP action exposed a completed result or effect link.')
    ensure(!refusal.result._meta?.['com.runeditrun/review'] && !refusal.result._meta?.['com.runeditrun/receipt'] && !refusal.result._meta?.['com.runeditrun/approval'], 'A refused MCP action returned a review, completion receipt or pending approval.')
    await unchanged()

    const matching = []
    let cursor = null
    for (let page = 0; page < 100; page++) {
      const audit = await personJson(context, `/agents/api/audit${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`)
      ensure(Array.isArray(audit.rows) && audit.differs_from_policy === 0, 'The refusal audit differs from policy.')
      matching.push(...audit.rows.filter(row => row.idempotency_key === key))
      if (audit.cursor === null || audit.cursor === cursor || !audit.rows.length) break
      cursor = audit.cursor
      ensure(page < 99, 'The refusal audit could not be read completely.')
    }
    ensure(matching.length === 1 && matching[0].tool === name && matching[0].door === 'mcp', 'The business refusal must have one matching MCP audit row.')
    ensure(matching[0].outcome === 'refused' && matching[0].code === item.expectedCode && matching[0].review === null && matching[0].approval === null, 'A business refusal audit recorded a completed effect, pending approval, review or wrong code.')
  }
  console.log('Pencil business refusals: native and MCP NOT_FOUND and VALIDATION_ERROR, unchanged draft and audit, no completed effect or review PASS')
}
