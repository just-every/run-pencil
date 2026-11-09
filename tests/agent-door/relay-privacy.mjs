import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { accessToken, autonomousPolicy, heldPolicy, policyEnvelope, seconds } from '@runeditrun/rer/internal/modules/agent-door/conformance/crypto.mjs'

// These requests use the production relay, signed detachment and person approval
// route against the disposable hosted installation, with no database test door.
export async function proveRelayPrivacy({ hosted, post, sign, cookie, context, mcp, draft }) {
  const get = path => hosted.fetch(path.replace(/^\//, ''), { headers: { Cookie: cookie } })
  async function pull(business = context.business) {
    const iat = seconds()
    return post('/api/rer/agent-decisions', { pull: await sign('rer-agent-decisions+jwt', {
      v: 1, iss: context.signer.issuer, aud: context.origin, sub: context.signer.installationId,
      business, after: 0, limit: 200, iat, exp: iat + 60, jti: randomUUID(),
    }) })
  }
  const live = await pull()
  assert.equal(live.status, 200, 'A positively running Business can pull its decisions')
  assert.ok((await live.json()).decisions.length > 0)
  console.log('PROBE pencil-0.2.104: POST /api/rer/agent-decisions + signed running Business pull -> 200 with decisions')

  const held = await policyEnvelope(context, heldPolicy(), { seq: 2, revision: 2 })
  const adopted = await post('/api/rer/agent-policy', { policy: held.policy })
  assert.equal(adopted.status, 200)
  await adopted.body?.cancel()
  const pending = []
  for (const action of ['approve', 'reject']) {
    const response = await mcp('tools/call', { name: 'pencil.flows.publish', arguments: {
      flowId: draft.flow.id, expectedVersion: draft.flow.draftVersion, expected_revision: draft.flow.draftVersion, idempotency_key: randomUUID(),
    } })
    assert.equal(response.response.status, 200)
    const handle = response.body.result?._meta?.['com.runeditrun/approval']
    assert.ok(handle?.id, 'Publishing under held policy must create an approval')
    const view = await get(`/agents/api/approvals/${handle.id}`)
    assert.equal(view.status, 200)
    const { approval } = await view.json()
    assert.equal(approval.state, 'pending')
    pending.push({ action, approval })
  }
  const oldIds = pending.map(({ approval }) => approval.decision_id)
  // Signed policy adoption is the public agent-door pairing switch.
  const nextBusiness = `${context.business}-new`
  const next = { ...context, business: nextBusiness }
  const policy = await policyEnvelope(next, autonomousPolicy(), { seq: 3, revision: 3 })
  const switched = await post('/api/rer/agent-policy', { policy: policy.policy })
  assert.equal(switched.status, 200)
  await switched.body?.cancel()
  const newToken = await accessToken(next)
  const listed = await mcp('tools/list', {}, newToken)
  assert.equal(listed.response.status, 200, 'The newly paired running Business must be admitted')
  const freshCall = await mcp('tools/call', { name: 'pencil.flows.create', arguments: {
    title: 'Synthetic newly paired Business decision', slug: `synthetic-pencil-new-${randomUUID()}`,
    template: 'feedback', idempotency_key: randomUUID(),
  } }, newToken)
  assert.equal(freshCall.response.status, 200)
  assert.ok(!freshCall.body.result?.isError)
  const newDecision = freshCall.body.result?._meta?.['com.runeditrun/decision']?.id
  assert.ok(newDecision)
  for (const { action, approval } of pending) {
    const decided = await post(`/agents/api/approvals/${approval.id}/${action}`, {
      revision: approval.revision, summary_sha256: approval.summary_sha256,
    }, cookie)
    assert.equal(decided.status, 200, 'The native sponsor can decide the historical approval')
    const body = await decided.json()
    assert.equal(body.approval.state, action === 'approve' ? 'refused' : 'rejected')
    const fresh = await pull(nextBusiness)
    assert.equal(fresh.status, 200)
    const feed = await fresh.json()
    assert.ok(feed.decisions.some(row => row.id === newDecision), 'The new feed must contain its own new decision')
    assert.ok(feed.decisions.every(row => !oldIds.includes(row.id) && !oldIds.includes(row.execution_of)),
      'Neither old pending decision nor its execution may enter the new Business feed')
    console.log(`PROBE pencil-0.2.104: POST old Business approval/${action} after pairing new Business -> ${body.approval.state}; new signed relay has no old decision or execution`)
  }
  const native = await get(`/api/app/flows/${draft.flow.id}/draft`)
  assert.equal(native.status, 200)
  const after = await native.json()
  assert.equal(after.flow.status, 'draft', 'An old Business approval must not publish the native form')
  assert.equal(after.flow.draftVersion, draft.flow.draftVersion)
  const stopIat = seconds()
  const detached = await sign('rer-business-settings+jwt', {
    v: 1, iss: context.signer.issuer, aud: context.origin, sub: context.signer.installationId,
    business: context.business, email: context.person.email, owner_id: context.person.sub,
    jti: randomUUID(), iat: stopIat, exp: stopIat + 300, rev: 2,
    values: {}, logo: null, team: null, detached: true,
  })
  const stopped = await post('/api/rer/business-settings', { settings: detached })
  assert.equal(stopped.status, 200, 'Signed Business detachment must durably stop Business settings')
  assert.equal((await stopped.json()).rev, 2)
  const refused = await pull(nextBusiness)
  assert.equal(refused.status, 404, 'A stopped Business must not read any relay decision')
  assert.equal(await refused.text(), '')
  const tokenRefusal = await mcp('tools/list', {}, newToken)
  assert.equal(tokenRefusal.response.status, 401, 'Stopping Business also ends token admission')
  console.log('PROBE pencil-0.2.104: POST /api/rer/business-settings + signed detached:true then relay pull / MCP tools/list -> empty 404 / 401')
  const oldPull = await pull()
  assert.equal(oldPull.status, 404)
  assert.equal(await oldPull.text(), '')
}
