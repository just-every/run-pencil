import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect, vi } from 'vitest'
import { contract } from '../../src/test/contract'
import { foundationFixture } from './foundation-fixture'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
contract('BASE-OPS-001', 'health probes actual storage and durable job tables and returns503 when any dependency table is unavailable', async () => {
  const f = await foundationFixture('health-probes')
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const started = performance.now()
    expect((await SELF.fetch('http://localhost/health')).status).toBe(200)
    expect(performance.now()-started).toBeLessThan(1000)
    for (const table of ['response_answers', 'response_outbox', 'mail_deliveries', 'mail_delivery_attempts']) {
      await env.DB.prepare(`ALTER TABLE ${table} RENAME TO synthetic_unavailable`).run()
      try {
        await expect(f.services.workspace.checkHealth()).rejects.toThrow()
        const response = await SELF.fetch('http://localhost/health')
        expect(response.status).toBe(503)
        expect(await response.text()).not.toContain('synthetic_unavailable')
      } finally { await env.DB.prepare(`ALTER TABLE synthetic_unavailable RENAME TO ${table}`).run() }
      expect((await SELF.fetch('http://localhost/health')).status).toBe(200)
    }
  } finally { errors.mockRestore() }
})
contract('BASE-OPS-005', 'versioned destructive edits and lifecycle transitions retain actor-aware audits and roll back if auditing fails', async () => {
  const f = await foundationFixture('mutation-audit')
  await f.add({ kind: 'question', questionType: 'rating', prompt: 'Rating' })
  await f.add({ kind: 'completion', questionType: null, prompt: 'Done' })
  const draft = await f.draft(), step = draft.steps[0]
  await f.services.flows.updateBuilderDraft({ ...f.flow, operatorId: f.operatorId, expectedVersion: draft.flow.draftVersion, stepId: step.id, prompt: 'Changed', required: false })
  expect(await env.DB.prepare("SELECT actor_operator_id, details_json FROM audit_entries WHERE subject_id = ? AND actor_operator_id = ?").bind(f.flow.flowId, f.operatorId).first()).toEqual({ actor_operator_id: f.operatorId, details_json: '{"feature":"flow-builder"}' })
  await env.DB.prepare("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_entries BEGIN SELECT RAISE(ABORT, 'synthetic audit unavailable'); END").run()
  const accepted = await f.draft()
  try {
    await expect(f.services.flows.deleteDraftStep({ ...f.flow, operatorId: f.operatorId, expectedVersion: accepted.flow.draftVersion, stepId: step.id })).rejects.toThrow()
    expect(await f.draft()).toEqual(accepted)
  } finally { await env.DB.prepare('DROP TRIGGER synthetic_audit_failure').run() }
  await f.services.flows.archiveFlow(f.scope.workspaceId, f.flow.flowId, f.operatorId)
  expect(await env.DB.prepare("SELECT actor_operator_id, subject_id FROM audit_entries WHERE kind = 'flow.archived' AND subject_id = ?").bind(f.flow.flowId).first()).toEqual({ actor_operator_id: f.operatorId, subject_id: f.flow.flowId })
})
