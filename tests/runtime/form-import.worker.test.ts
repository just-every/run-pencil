import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { FormImports, importContext, type ImportActor } from '../../src/core/features/importing/service'
import { readD1ImportOriginals, readD1PersistedImport } from '../../src/base/import-kit/src/d1/index'
import { formJson, csv, simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
import { prepareImport } from '../../src/core/features/importing/prepare'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { createPencilServices } from '../../src/core/app/services'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
const second = (env as unknown as { IMPORT_SECOND: D1Database }).IMPORT_SECOND
beforeAll(async () => { await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__); await applyD1Migrations(second, __PENCIL_CORE_MIGRATIONS__) })
async function fixture(database = env.DB) {
  const workspaceId = crypto.randomUUID(), operatorId = crypto.randomUUID(), id = crypto.randomUUID(), now = new Date().toISOString()
  await database.prepare("INSERT INTO workspaces(id,name,time_zone,sending_window_start,sending_window_end,created_at,updated_at) VALUES(?,'Synthetic import','UTC','09:00','17:00',?,?)").bind(workspaceId, now, now).run()
  await database.prepare("INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,'Synthetic importer',0,?,?)").bind(operatorId, workspaceId, `${operatorId}@example.test`, now, now).run()
  await database.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,1,'native',?,?)").bind(id, id, operatorId, Date.now(), Date.now() + 3600000).run()
  const actor: ImportActor = { id, workspaceId, operatorId }
  return { actor, service: new FormImports(database, actor), database }
}
const input = { definition: formJson, csv, plannedAt: '2026-10-08T00:00:00.000Z' }
async function committed(f: Awaited<ReturnType<typeof fixture>>, source = input) {
  const review = await f.service.review(source)
  expect(review.rowErrors).toEqual([])
  let job = await f.service.commit({ ...source, plannedAt: review.plannedAt, columns: review.columns }, review.fingerprint, true)
  while (job.state !== 'completed') job = await new FormImports(f.database, f.actor).resume(job.id)
  return { review, job }
}
async function nativeSnapshot(db: D1Database, flowId: string) {
  return {
    structure: (await db.prepare('SELECT s.position,s.stable_id,s.kind,s.question_type,s.prompt,s.helper_text,s.required,s.next_step_stable_id,s.question_settings_json FROM flow_steps s JOIN flow_revisions r ON r.id=s.revision_id WHERE r.flow_id=? AND r.state=\'published\' ORDER BY s.position').bind(flowId).all()).results,
    answers: (await db.prepare('SELECT a.step_id,a.value_json,r.source,r.started_at,r.completed_at,r.state FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.flow_id=? ORDER BY a.step_id,a.value_json,r.source,r.started_at,r.completed_at').bind(flowId).all()).results,
    count: await db.prepare('SELECT count(*) AS total FROM responses WHERE flow_id=?').bind(flowId).first(),
  }
}
contract(['IMPORT-001', 'IMPORT-002', 'IMPORT-003', 'IMPORT-004', 'LEDG-002'], 'two fresh databases produce equivalent reports, source structures, typed answers and 27 inert completions', async () => {
  const a = await fixture(), b = await fixture(second)
  const first = await committed(a), next = await committed(b)
  expect(first.review.report).toEqual(next.review.report)
  const imported = await nativeSnapshot(a.database,first.review.flowId)
  for (const [prompt,settings] of [['Name',{maxLength:150}],['Experience',{min:0,max:10,lowLabel:'Low',middleLabel:'Neutral',highLabel:'High'}],['Visit date',{displayFormat:'DD/MM/YYYY',separator:'.'}]] as const) expect(JSON.parse(String(imported.structure.find(step=>step.prompt===prompt)?.question_settings_json))).toMatchObject(settings)

  expect(await nativeSnapshot(a.database, first.review.flowId)).toEqual(await nativeSnapshot(b.database, next.review.flowId))
  expect(await a.database.prepare('SELECT count(*) AS total FROM responses WHERE flow_id=?').bind(first.review.flowId).first()).toEqual({ total: 27 })
  for (const table of ['respondent_sessions', 'response_outbox', 'revision_metric_counters', 'mail_deliveries', 'local_mail_outbox']) expect(await a.database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first()).toEqual({ total: 0 })
  const raw = await a.database.prepare('SELECT plan_json FROM ik_jobs WHERE id=?').bind(first.job.id).first<{ plan_json: string }>()
  expect(raw!.plan_json).not.toMatch(/forbidden-network|192\.0\.2\.|never-import-hidden-value|991827/)
  const context = importContext(a.database, a.actor, prepareImport(input, a.actor.workspaceId).namespace)
  expect((await readD1ImportOriginals(first.job.id, context)).every(o => o.original.status === 'unavailable')).toBe(true)
  const persisted = await readD1PersistedImport(context)
  expect(persisted.rows).toHaveLength(28)
  expect(persisted.provenance).toHaveLength(28)
}, 90_000)
contract(['IMPORT-003', 'IMPORT-004', 'BASE-OPS-005'], 'native kit undo removes imported flow and responses, retains safe provenance, and preserves same-revision edits', async () => {
  const f = await fixture(), result = await committed(f)
  let reversed = await f.service.undo(result.job.id)
  while (reversed.state !== 'undone') reversed = await new FormImports(f.database, f.actor).resume(reversed.id)
  expect((await f.service.undo(reversed.id)).state).toBe('undone')
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM flows WHERE id=?').bind(result.review.flowId).first()).toEqual({ total: 0 })
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM responses WHERE flow_id=?').bind(result.review.flowId).first()).toEqual({ total: 0 })
  expect(await f.database.prepare('SELECT COUNT(*) AS total FROM ik_provenance WHERE job_id=? AND reversed=1').bind(result.job.id).first()).toEqual({ total: 28 })
  expect(await f.database.prepare("SELECT count(*) AS total FROM audit_entries WHERE workspace_id=? AND kind='import.reversed' AND actor_operator_id=? AND subject_id IS NULL AND created_at IS NOT NULL").bind(f.actor.workspaceId, f.actor.operatorId).first()).toEqual({ total: 28 })
  const edited = await fixture(), small = { definition: simpleJson, csv: simpleCsv, plannedAt: input.plannedAt }, imported = await committed(edited, small)
  const flows = createPencilServices(createPencilPlatform('http://localhost', env)).flows
  const draft = await flows.getBuilderDraft(edited.actor.workspaceId, imported.review.flowId)
  const question = draft.steps.find(step => step.kind === 'question')!
  expect(await flows.updateBuilderDraft({ workspaceId: edited.actor.workspaceId, operatorId: edited.actor.operatorId, flowId: imported.review.flowId, expectedVersion: draft.flow.draftVersion, stepId: question.id, prompt: 'Later native edit', required: question.required })).toMatchObject({ kind: 'updated' })
  await expect(edited.service.undo(imported.job.id)).rejects.toThrow('NATIVE_EDIT_CONFLICT')
  expect(await edited.database.prepare("SELECT prompt FROM flow_steps WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='draft') AND kind='question'").bind(imported.review.flowId).first()).toEqual({ prompt: 'Later native edit' })
  expect(await edited.database.prepare("SELECT prompt FROM flow_steps WHERE revision_id=(SELECT id FROM flow_revisions WHERE flow_id=? AND state='published') AND kind='question'").bind(imported.review.flowId).first()).toEqual({ prompt: 'Answer' })
}, 90_000)
