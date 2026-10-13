import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { notificationFixture } from './notifications-fixture'
import { snapshotFixture } from './archive-fixture'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))

// Schedule a real competing write at the commit boundary; every read and batch
// still executes against native D1 and no storage result is substituted.
async function refusesConcurrentChange(input: { workspaceId: string; responseId: string },
  erase: () => Promise<void>, mutate: () => Promise<unknown>) {
  const batch = env.DB.batch.bind(env.DB)
  let expected = '', reached = false
  const boundary = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async statements => {
    reached = true
    await mutate()
    expected = JSON.stringify(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__))
    return batch(statements)
  })
  try {
    await expect(erase()).rejects.toThrow()
    expect(reached).toBe(true)
    expect(JSON.stringify(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)) === expected).toBe(true)
    expect(await env.DB.prepare('SELECT count(*) n FROM responses WHERE id=? AND workspace_id=?').bind(input.responseId, input.workspaceId).first()).toEqual({ n: 1 })
  } finally { boundary.mockRestore() }
}

contract(['DATA-002','IMPORT-003','IMPORT-004','BASE-ACCESS-004'], 'native erasure refuses a response that acquires imported source or custody after its initial read', async () => {
  for (const change of ['source', 'marker'] as const) {
    const f = await notificationFixture(`custody-erasure-${change}-race`), submitted = await f.submit()
    const input = { ...f.scope, operatorId: f.operatorId, responseId: submitted.response.id }
    await refusesConcurrentChange(input, () => f.services.responses.eraseReleasedResponse(input), () => change === 'source'
      ? env.DB.prepare("UPDATE responses SET source='imported' WHERE id=?").bind(input.responseId).run()
      : env.DB.prepare("INSERT INTO form_import_targets(target_id,workspace_id,kind,revision,flow_id) VALUES(?,?,'response','synthetic-revision',?)").bind(input.responseId, input.workspaceId, f.flow.flowId).run())
  }
})

contract(['DATA-002','BASE-ACCESS-004'], 'supplied native session revocation expiry and operator version changes are checked inside the response deletion transaction', async () => {
  for (const change of ['revoked', 'expired', 'version'] as const) {
    const f = await notificationFixture(`custody-erasure-${change}-authority`), submitted = await f.submit()
    const sessionId = crypto.randomUUID(), now = Date.now()
    const auth = await env.DB.prepare('SELECT auth_id FROM operator_auth_links WHERE operator_id=?').bind(f.operatorId).first<{ auth_id: string }>()
    expect(auth).not.toBeNull()
    await env.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) SELECT ?,?,id,version,'native',?,? FROM oa_operators WHERE id=?")
      .bind(sessionId, crypto.randomUUID(), now, now + 3600000, auth!.auth_id).run()
    const input = { ...f.scope, operatorId: f.operatorId, responseId: submitted.response.id, sessionId }
    await refusesConcurrentChange(input, () => f.services.responses.eraseReleasedResponse(input), () => change === 'version'
      ? env.DB.prepare('UPDATE oa_operators SET version=version+1 WHERE id=?').bind(auth!.auth_id).run()
      : env.DB.prepare(`UPDATE oa_sessions SET ${change === 'revoked' ? 'revoked_at' : 'expires_at'}=? WHERE id=?`).bind(now - 1, sessionId).run())
  }
})

contract(['DATA-002','IMPORT-003','IMPORT-004'], 'imported responses without a current session cannot fall back to ordinary erasure', async () => {
  const f = await notificationFixture('custody-erasure-missing-history'), submitted = await f.submit()
  await env.DB.prepare("UPDATE responses SET source='imported',notification_eligible=0 WHERE id=?").bind(submitted.response.id).run()
  const input = { ...f.scope, operatorId: f.operatorId, responseId: submitted.response.id }
  const before = JSON.stringify(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__))
  await expect(f.services.responses.eraseReleasedResponse(input)).rejects.toThrow()
  expect(JSON.stringify(await snapshotFixture(env.DB, __PENCIL_CORE_MIGRATIONS__)) === before).toBe(true)
})
