import type { flows, flowRevisions, flowSteps, choiceOptions, flowBranchRules } from '../../platform/db/schema'
export type FlowStructure = { audit?: {id:string;operatorId:string;feature:string}; flow: typeof flows.$inferInsert; revision: typeof flowRevisions.$inferInsert; steps?: Array<typeof flowSteps.$inferInsert>; choices?: Array<typeof choiceOptions.$inferInsert>; rules?: Array<typeof flowBranchRules.$inferInsert> }
export async function createFlowStructure(binding: D1Database, input: FlowStructure) {
  const f = input.flow, r = input.revision
  const statements = [
    binding.prepare(`INSERT INTO flows (id, workspace_id, slug, title, status, draft_version, last_activity_at, created_at, updated_at)
      SELECT ?, ?, ?, ?, 'draft', 0, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM flows WHERE slug = ?) ON CONFLICT(workspace_id, slug) DO NOTHING RETURNING id`).bind(f.id, f.workspaceId, f.slug, f.title, f.lastActivityAt, f.createdAt, f.updatedAt, f.slug),
    binding.prepare(`INSERT INTO flow_revisions (id, flow_id, number, state, title, published_at, is_current, admission_closed_at, admission_close_reason, deadline_at, deadline_time_zone, target_completed_responses, policy_snapshot_json, form_settings_json, created_at, updated_at)
      SELECT ?, ?, 1, 'draft', ?, NULL, 0, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM flows WHERE id = ?)`).bind(r.id, f.id, r.title, r.policySnapshotJson ?? null, r.formSettingsJson ?? '{}', r.createdAt, r.updatedAt, f.id),
    ...(input.steps ?? []).map((s) => binding.prepare(`INSERT INTO flow_steps (id, revision_id, position, stable_id, kind, question_type, prompt, helper_text, required, next_step_stable_id, question_settings_json, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM flow_revisions WHERE id = ?)`).bind(s.id, r.id, s.position, s.stableId, s.kind, s.questionType ?? null, s.prompt, s.helperText ?? null, s.required ? 1 : 0, s.nextStepStableId ?? null, s.questionSettingsJson ?? null, s.createdAt, s.updatedAt, r.id)),
    ...(input.choices ?? []).map((c) => binding.prepare(`INSERT INTO choice_options (id, step_id, stable_id, value, label, position, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM flow_steps WHERE id = ?)`).bind(c.id, c.stepId, c.stableId, c.value, c.label, c.position, c.createdAt, c.updatedAt, c.stepId)),
    ...(input.rules ?? []).map((rule) => binding.prepare(`INSERT INTO flow_branch_rules (id, revision_id, source_step_stable_id, predicate_kind, expected_value_json, condition_json, destination_step_stable_id, position, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM flow_revisions WHERE id = ?)`).bind(rule.id, r.id, rule.sourceStepStableId, rule.predicateKind, rule.expectedValueJson, rule.conditionJson ?? null, rule.destinationStepStableId, rule.position, rule.createdAt, rule.updatedAt, r.id)),
    ...(input.audit ? [binding.prepare(`INSERT INTO audit_entries(id,workspace_id,kind,actor_operator_id,subject_type,subject_id,details_json,created_at) SELECT ?,workspace_id,'flow.draft-created',?,'flow',id,?,? FROM flows WHERE id=?`).bind(input.audit.id,input.audit.operatorId,JSON.stringify({feature:input.audit.feature}),f.createdAt,f.id)] : []),
  ]
  const result = await binding.batch<{id:string}>(statements)
  return result[0].results.some(row => row.id === f.id)
}
