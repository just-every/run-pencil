import { admittedResponseSql } from '../payments/admission'
import { createFlowStructure, type FlowStructure } from './structure'
import { readCurrentPublicSnapshot } from './publicSnapshot'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { PencilDatabase } from '../../platform/db/repository'
import { choiceOptions, flowBranchRules, flowRevisions, flowSteps, flows, workspaces } from '../../platform/db/schema'

type DraftVersion = { operatorId?: string; flowId: string; revisionId: string; expectedVersion: number; now: string }

export type StoredStep = typeof flowSteps.$inferSelect
export type StoredChoice = typeof choiceOptions.$inferSelect
export type StoredBranchRule = Omit<typeof flowBranchRules.$inferSelect, 'conditionJson'> & { conditionJson?: string | null }

function changedRows(result: D1Result<unknown>) {
  return result.results.length
}

export class FlowRepository {
  constructor(
    private readonly database: PencilDatabase,
    private readonly binding: D1Database,
    private readonly attribution?: Record<string, unknown>,
  ) {}

  attributed(attribution: Record<string, unknown>) { return new FlowRepository(this.database, this.binding, attribution) }

  private async auditedDraft(input: DraftVersion, statements: D1PreparedStatement[]) {
    const result = await this.binding.batch([
      this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, 'flow.draft-mutated', (SELECT id FROM operators WHERE id = ? AND workspace_id = flows.workspace_id), 'flow', id, ?, ?
        FROM flows WHERE id = ? AND draft_version = ?`).bind(crypto.randomUUID(), input.operatorId ?? null, JSON.stringify({ feature: 'flow-builder', ...this.attribution }), input.now, input.flowId, input.expectedVersion),
      ...statements,
    ])
    return result.slice(1)
  }
  private lifecycleAudit(flowId: string, now: string, operatorId: string | undefined, kind: string) {
    return this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
      SELECT ?, workspace_id, ?, (SELECT id FROM operators WHERE id = ? AND workspace_id = flows.workspace_id), 'flow', id, '{"feature":"flow-lifecycle"}', ? FROM flows WHERE id = ?`)
      .bind(crypto.randomUUID(), kind, operatorId ?? null, now, flowId)
  }

  async validAlertRecipients(workspaceId:string,ids:string[]) {
    if(!ids.length)return true
    const rows=await this.binding.prepare(`SELECT id FROM operators WHERE workspace_id=? AND id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM operator_auth_links l JOIN oa_operators a ON a.id=l.auth_id WHERE l.operator_id=operators.id AND a.status='inactive')`).bind(workspaceId,JSON.stringify(ids)).all<{id:string}>()
    return ids.every(id=>rows.results.some(row=>row.id===id))
  }
  async validAlertChatTargets(workspaceId:string,flowId:string,platforms:string[]) {
    if(!platforms.length)return true
    const rows=await this.binding.prepare(`SELECT l.platform FROM chat_form_links l WHERE l.workspace_id=? AND l.flow_id=? AND l.armed=1
      AND l.platform IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM integration_connections c WHERE c.kind=l.platform)`)
      .bind(workspaceId,flowId,JSON.stringify(platforms)).all<{platform:string}>()
    return platforms.every(platform=>rows.results.some(row=>row.platform===platform))
  }
  async createStructure(input: FlowStructure) { return createFlowStructure(this.binding, { ...input, ...(input.audit ? { audit: { ...input.audit, details: this.attribution } } : {}) }) }

  async updateScreen(input: DraftVersion & {changes:Array<{id:string;settings:Record<string,unknown>|null;nextStepId:string|null}>}) {
    const result = await this.auditedDraft(input,[
      ...input.changes.map(change => this.binding.prepare(`UPDATE flow_steps SET question_settings_json=?,next_step_stable_id=?,updated_at=? WHERE revision_id=? AND stable_id=? AND EXISTS(SELECT 1 FROM flows WHERE id=? AND draft_version=?)`).bind(change.settings?JSON.stringify(change.settings):null,change.nextStepId,input.now,input.revisionId,change.id,input.flowId,input.expectedVersion)),
      this.binding.prepare('UPDATE flows SET draft_version=draft_version+1,updated_at=?,last_activity_at=? WHERE id=? AND draft_version=? RETURNING id').bind(input.now,input.now,input.flowId,input.expectedVersion),
    ])
    return result.at(-1)!.results.length > 0
  }

  async updateFormSettings(input: DraftVersion & { json: string }) {
    const result = await this.auditedDraft(input, [
      this.binding.prepare('UPDATE flow_revisions SET form_settings_json=?,updated_at=? WHERE id=? AND state=\'draft\' AND EXISTS(SELECT 1 FROM flows WHERE id=? AND draft_version=?) RETURNING id').bind(input.json,input.now,input.revisionId,input.flowId,input.expectedVersion),
      this.binding.prepare('UPDATE flows SET draft_version=draft_version+1,updated_at=?,last_activity_at=? WHERE id=? AND draft_version=? RETURNING id').bind(input.now,input.now,input.flowId,input.expectedVersion),
    ])
    return result[0].results.length === 1 && result[1].results.length === 1
  }

  async ensureFlow(flow: typeof flows.$inferInsert) {
    await this.database.insert(flows).values(flow).onConflictDoNothing()
  }

  async ensureRevision(revision: typeof flowRevisions.$inferInsert) {
    await this.database.insert(flowRevisions).values(revision).onConflictDoNothing()
  }

  async ensureStep(step: typeof flowSteps.$inferInsert) {
    await this.database.insert(flowSteps).values(step).onConflictDoNothing()
  }

  async ensureChoice(choice: typeof choiceOptions.$inferInsert) {
    await this.database.insert(choiceOptions).values(choice).onConflictDoNothing()
  }

  async ensureBranchRule(rule: typeof flowBranchRules.$inferInsert) {
    await this.database.insert(flowBranchRules).values(rule).onConflictDoNothing()
  }

  async listDashboardFlows(workspaceId: string, status?: typeof flows.$inferSelect.status) {
    const where = status
      ? and(eq(flows.workspaceId, workspaceId), eq(flows.status, status))
      : and(eq(flows.workspaceId, workspaceId), ne(flows.status, 'archived'))
    return this.database.select().from(flows).where(where).orderBy(desc(flows.lastActivityAt))
  }

  async latestAnalysis(workspaceId: string, flowId: string) {
    return this.binding.prepare(`SELECT a.id, a.state, a.revision_id AS revisionId, r.number AS revisionNumber, a.evidence_cutoff AS evidenceCutoff,
      a.redacted_at IS NOT NULL AS redacted, (a.redacted_at IS NOT NULL OR EXISTS(SELECT 1 FROM responses x WHERE x.revision_id=a.revision_id AND x.state='released' AND x.completed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM analysis_evidence e WHERE e.run_id=a.id AND e.response_id=x.id))) AS stale
      FROM analysis_runs a JOIN flow_revisions r ON r.id=a.revision_id WHERE a.workspace_id=? AND a.flow_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 1`).bind(workspaceId,flowId).first<{id:string;state:import('../analysis/model').RunState;revisionId:string;revisionNumber:number;evidenceCutoff:string;redacted:number;stale:number}>()
  }

  async findFlow(id: string) {
    const [flow] = await this.database.select().from(flows).where(eq(flows.id, id)).limit(1)
    return flow
  }

  async findWorkspaceFlow(id: string, workspaceId: string) {
    const [flow] = await this.database
      .select()
      .from(flows)
      .where(and(eq(flows.id, id), eq(flows.workspaceId, workspaceId)))
      .limit(1)
    return flow
  }

  async findFlowBySlug(slug: string) {
    const [flow] = await this.database.select().from(flows).where(eq(flows.slug, slug)).limit(1)
    return flow
  }

  async findFlowWithCurrentPublishedRevision(slug: string) {
    const [result] = await this.database
      .select({ flow: flows, revision: flowRevisions })
      .from(flows)
      .leftJoin(flowRevisions, and(eq(flowRevisions.flowId, flows.id), eq(flowRevisions.state, 'published'), eq(flowRevisions.isCurrent, true)))
      .where(eq(flows.slug, slug))
      .limit(1)
    return result
  }

  async getCurrentPublicSnapshot(slug: string) {
    return readCurrentPublicSnapshot(this.database, slug)
  }

  async getWorkspaceTimeZone(workspaceId: string) {
    const [workspace] = await this.database.select({ timeZone: workspaces.timeZone }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    return workspace?.timeZone
  }

  async findRevision(flowId: string, state: 'draft' | 'published') {
    const [revision] = await this.database
      .select()
      .from(flowRevisions)
      .where(and(eq(flowRevisions.flowId, flowId), eq(flowRevisions.state, state)))
      .orderBy(desc(flowRevisions.number))
      .limit(1)
    return revision
  }

  async findCurrentPublishedRevision(flowId: string) {
    const [revision] = await this.database
      .select()
      .from(flowRevisions)
      .where(and(eq(flowRevisions.flowId, flowId), eq(flowRevisions.state, 'published'), eq(flowRevisions.isCurrent, true)))
      .limit(1)
    return revision
  }

  async findRevisionById(id: string) {
    const [revision] = await this.database.select().from(flowRevisions).where(eq(flowRevisions.id, id)).limit(1)
    return revision
  }

  async getSteps(revisionId: string) {
    return this.database.select().from(flowSteps).where(eq(flowSteps.revisionId, revisionId)).orderBy(flowSteps.position)
  }

  async getChoices(stepIds: string[]) {
    if (stepIds.length === 0) return []
    return this.database.select().from(choiceOptions).where(sql`${choiceOptions.stepId} IN (SELECT value FROM json_each(${JSON.stringify(stepIds)}))`).orderBy(choiceOptions.position)
  }

  async getBranchRules(revisionId: string) {
    return this.database.select().from(flowBranchRules).where(eq(flowBranchRules.revisionId, revisionId)).orderBy(flowBranchRules.sourceStepStableId, flowBranchRules.position)
  }

  async getRevisionGraph(revisionId: string): Promise<{ steps: StoredStep[]; choices: StoredChoice[]; rules: StoredBranchRule[] }> {
    // A revision identifies the complete immutable graph. Resolve choices through
    // their steps so all three reads can share one D1 batch without a prior read.
    const [steps, choiceRows, rules] = await this.database.batch([
      this.database.select().from(flowSteps).where(eq(flowSteps.revisionId, revisionId)).orderBy(flowSteps.position),
      this.database.select({ choice: choiceOptions }).from(choiceOptions)
        .innerJoin(flowSteps, eq(flowSteps.id, choiceOptions.stepId))
        .where(eq(flowSteps.revisionId, revisionId)).orderBy(choiceOptions.position),
      this.database.select().from(flowBranchRules).where(eq(flowBranchRules.revisionId, revisionId))
        .orderBy(flowBranchRules.sourceStepStableId, flowBranchRules.position),
    ])
    return { steps, choices: choiceRows.map((row) => row.choice), rules }
  }

  async getWorkspaceDraftSnapshot(workspaceId: string, flowId: string) {
    const ownedDrafts = this.database.select({ id: flowRevisions.id }).from(flowRevisions)
      .innerJoin(flows, eq(flows.id, flowRevisions.flowId))
      .where(and(eq(flows.id, flowId), eq(flows.workspaceId, workspaceId), eq(flowRevisions.state, 'draft')))
      .orderBy(desc(flowRevisions.number)).limit(1)
    // Drafts are mutable: their version, steps, choices and rules must share the
    // same D1 transaction rather than combining independently timed reads.
    const [flowRows, revisionRows, steps, choiceRows, rules] = await this.database.batch([
      this.database.select().from(flows).where(and(eq(flows.id, flowId), eq(flows.workspaceId, workspaceId))),
      this.database.select().from(flowRevisions).where(inArray(flowRevisions.id, ownedDrafts)).orderBy(desc(flowRevisions.number)),
      this.database.select().from(flowSteps).where(inArray(flowSteps.revisionId, ownedDrafts)).orderBy(flowSteps.position),
      this.database.select({ choice: choiceOptions }).from(choiceOptions)
        .innerJoin(flowSteps, eq(flowSteps.id, choiceOptions.stepId))
        .where(inArray(flowSteps.revisionId, ownedDrafts)).orderBy(choiceOptions.position),
      this.database.select().from(flowBranchRules).where(inArray(flowBranchRules.revisionId, ownedDrafts))
        .orderBy(flowBranchRules.sourceStepStableId, flowBranchRules.position),
    ])
    return { flow: flowRows[0], revision: revisionRows[0], steps, choices: choiceRows.map(row => row.choice), rules }
  }

  async updateDraftStep(input: DraftVersion & {
    stepStableId: string
    questionType: StoredStep['questionType']
    prompt: string
    helperText: string | null
    required: boolean
    nextStepStableId: string | null
    questionSettingsJson: string | null
    choices: Array<{ id: string; stableId: string; value: string; label: string; position: number; createdAt: string; updatedAt: string }>
    rules?: Array<typeof flowBranchRules.$inferInsert>
  }) {
    const preservedChoices = input.choices.map((choice) => choice.stableId)
    const choiceGuard = 'EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)'
    const deleteMissingChoices = preservedChoices.length === 0
      ? this.binding.prepare(`DELETE FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ? AND stable_id = ?) AND ${choiceGuard}`)
        .bind(input.revisionId, input.stepStableId, input.flowId, input.expectedVersion)
      : this.binding.prepare(`DELETE FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ? AND stable_id = ?) AND stable_id NOT IN (SELECT value FROM json_each(?)) AND ${choiceGuard}`)
        .bind(input.revisionId, input.stepStableId, JSON.stringify(preservedChoices), input.flowId, input.expectedVersion)
    const results = await this.auditedDraft(input, [
      this.binding.prepare(`
        UPDATE flow_steps
        SET question_type = ?, prompt = ?, helper_text = ?, required = ?, next_step_stable_id = ?, question_settings_json = ?, updated_at = ?
        WHERE revision_id = ? AND stable_id = ?
          AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?) RETURNING id
      `).bind(input.questionType, input.prompt, input.helperText, input.required ? 1 : 0, input.nextStepStableId, input.questionSettingsJson, input.now, input.revisionId, input.stepStableId, input.flowId, input.expectedVersion),
      deleteMissingChoices,
      this.binding.prepare(`UPDATE choice_options SET position = -position - 1, value = ? || id WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ? AND stable_id = ?) AND ${choiceGuard}`).bind(`editing-${crypto.randomUUID()}-`, input.revisionId, input.stepStableId, input.flowId, input.expectedVersion),
      ...input.choices.map((choice) => this.binding.prepare(`
        INSERT INTO choice_options (id, step_id, stable_id, value, label, position, created_at, updated_at)
        SELECT ?, id, ?, ?, ?, ?, ?, ?
        FROM flow_steps
        WHERE revision_id = ? AND stable_id = ? AND ${choiceGuard}
        ON CONFLICT(step_id, stable_id) DO UPDATE SET value = excluded.value, label = excluded.label, position = excluded.position, updated_at = excluded.updated_at
      `).bind(choice.id, choice.stableId, choice.value, choice.label, choice.position, choice.createdAt, choice.updatedAt, input.revisionId, input.stepStableId, input.flowId, input.expectedVersion)),
      ...(input.rules ? [
        this.binding.prepare(`DELETE FROM flow_branch_rules WHERE revision_id = ? AND ${choiceGuard}`).bind(input.revisionId, input.flowId, input.expectedVersion),
        ...input.rules.map(rule => this.binding.prepare(`INSERT INTO flow_branch_rules (id, revision_id, source_step_stable_id, predicate_kind, expected_value_json, condition_json, destination_step_stable_id, position, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${choiceGuard}`).bind(rule.id, rule.revisionId, rule.sourceStepStableId, rule.predicateKind, rule.expectedValueJson, rule.conditionJson ?? null, rule.destinationStepStableId, rule.position, rule.createdAt, rule.updatedAt, input.flowId, input.expectedVersion)),
      ] : []),
      this.binding.prepare(`
        UPDATE flows SET draft_version = ?, last_activity_at = ?, updated_at = ?
        WHERE id = ? AND draft_version = ? RETURNING id
      `).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ])
    if (changedRows(results[0]) !== 1 || changedRows(results[results.length - 1]) !== 1) return undefined
    return this.findDraftStep(input.revisionId, input.stepStableId)
  }

  async createDraftStep(input: DraftVersion & { step: typeof flowSteps.$inferInsert; choices: Array<typeof choiceOptions.$inferInsert>; connectPrevious?: string }) {
    const statements: D1PreparedStatement[] = [
      this.binding.prepare('UPDATE flow_steps SET position = -position - 1 WHERE revision_id = ? AND position >= ? AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)').bind(input.revisionId, input.step.position, input.flowId, input.expectedVersion),
      this.binding.prepare('UPDATE flow_steps SET position = -position WHERE revision_id = ? AND position < 0 AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)').bind(input.revisionId, input.flowId, input.expectedVersion),
      this.binding.prepare('UPDATE flow_steps SET next_step_stable_id = ?, updated_at = ? WHERE revision_id = ? AND stable_id = ? AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)').bind(input.step.stableId, input.now, input.revisionId, input.connectPrevious ?? null, input.flowId, input.expectedVersion),
      this.binding.prepare(`
        INSERT INTO flow_steps (
          id, revision_id, position, stable_id, kind, question_type, prompt, helper_text, required,
          next_step_stable_id, question_settings_json, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?) RETURNING id
      `).bind(
        input.step.id, input.step.revisionId, input.step.position, input.step.stableId, input.step.kind, input.step.questionType,
        input.step.prompt, input.step.helperText, input.step.required ? 1 : 0, input.step.nextStepStableId,
        input.step.questionSettingsJson, input.step.createdAt, input.step.updatedAt, input.flowId, input.expectedVersion,
      ),
      ...input.choices.map((choice) => this.binding.prepare(`
        INSERT INTO choice_options (id, step_id, stable_id, value, label, position, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flow_steps WHERE id = ?)
          AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)
      `).bind(choice.id, choice.stepId, choice.stableId, choice.value, choice.label, choice.position, choice.createdAt, choice.updatedAt, input.step.id, input.flowId, input.expectedVersion)),
      this.binding.prepare(`
        UPDATE flows SET draft_version = ?, last_activity_at = ?, updated_at = ?
        WHERE id = ? AND draft_version = ? RETURNING id
      `).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ]
    const results = await this.auditedDraft(input, statements)
    if (changedRows(results[3]) !== 1 || changedRows(results[results.length - 1]) !== 1) return undefined
    return this.findDraftStep(input.revisionId, input.step.stableId)
  }

  async deleteDraftStep(input: DraftVersion & { stepStableId: string }) {
    const guard = 'EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)'
    const results = await this.auditedDraft(input, [
      this.binding.prepare(`DELETE FROM choice_options WHERE step_id IN (SELECT id FROM flow_steps WHERE revision_id = ? AND stable_id = ?) AND ${guard}`).bind(input.revisionId, input.stepStableId, input.flowId, input.expectedVersion),
      this.binding.prepare(`DELETE FROM flow_branch_rules WHERE revision_id = ? AND (source_step_stable_id = ? OR destination_step_stable_id = ?) AND ${guard}`).bind(input.revisionId, input.stepStableId, input.stepStableId, input.flowId, input.expectedVersion),
      this.binding.prepare(`DELETE FROM flow_steps WHERE revision_id = ? AND stable_id = ? AND ${guard} RETURNING id`).bind(input.revisionId, input.stepStableId, input.flowId, input.expectedVersion),
      this.binding.prepare(`UPDATE flows SET draft_version = ?, last_activity_at = ?, updated_at = ? WHERE id = ? AND draft_version = ? RETURNING id`).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ])
    return changedRows(results[2]) === 1 && changedRows(results[3]) === 1
  }

  async reorderDraftSteps(input: DraftVersion & { orderedStableIds: string[] }) {
    const statements: D1PreparedStatement[] = [
      this.binding.prepare(`UPDATE flow_steps SET position = -position - 1, updated_at = ? WHERE revision_id = ? AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?) RETURNING id`)
        .bind(input.now, input.revisionId, input.flowId, input.expectedVersion),
      ...input.orderedStableIds.map((stableId, position) => this.binding.prepare(`
        UPDATE flow_steps SET position = ?, updated_at = ?
        WHERE revision_id = ? AND stable_id = ? AND position < 0
          AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?) RETURNING id
      `).bind(position, input.now, input.revisionId, stableId, input.flowId, input.expectedVersion)),
      this.binding.prepare(`UPDATE flows SET draft_version = ?, last_activity_at = ?, updated_at = ? WHERE id = ? AND draft_version = ? RETURNING id`).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ]
    const results = await this.auditedDraft(input, statements)
    return changedRows(results[0]) === input.orderedStableIds.length
      && input.orderedStableIds.every((_, index) => changedRows(results[index + 1]) === 1)
      && changedRows(results[results.length - 1]) === 1
  }

  async replaceDraftBranchRules(input: DraftVersion & { rules: Array<typeof flowBranchRules.$inferInsert> }) {
    const statements: D1PreparedStatement[] = [
      this.binding.prepare(`DELETE FROM flow_branch_rules WHERE revision_id = ? AND EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)`)
        .bind(input.revisionId, input.flowId, input.expectedVersion),
      ...input.rules.map((rule) => this.binding.prepare(`
        INSERT INTO flow_branch_rules (id, revision_id, source_step_stable_id, predicate_kind, expected_value_json, condition_json, destination_step_stable_id, position, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)
      `).bind(rule.id, rule.revisionId, rule.sourceStepStableId, rule.predicateKind, rule.expectedValueJson, rule.conditionJson ?? null, rule.destinationStepStableId, rule.position, rule.createdAt, rule.updatedAt, input.flowId, input.expectedVersion)),
      this.binding.prepare(`UPDATE flows SET draft_version = ?, last_activity_at = ?, updated_at = ? WHERE id = ? AND draft_version = ? RETURNING id`).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ]
    const results = await this.auditedDraft(input, statements)
    return changedRows(results[results.length - 1]) === 1
  }

  async publishDraft(input: DraftVersion & {
    currentRevisionId: string
    newDraft: typeof flowRevisions.$inferInsert
    newSteps: Array<typeof flowSteps.$inferInsert>
    newChoices: Array<typeof choiceOptions.$inferInsert>
    newRules: Array<typeof flowBranchRules.$inferInsert>
    policySnapshotJson: string
    deadlineAt: string | null
    deadlineTimeZone: string | null
    targetCompletedResponses: number | null
  }) {
    const guarded = 'EXISTS (SELECT 1 FROM flows WHERE id = ? AND draft_version = ?)'
    const statements: D1PreparedStatement[] = [
      this.binding.prepare(`
        INSERT INTO flow_revisions (id, flow_id, number, state, title, published_at, is_current, admission_closed_at, admission_close_reason, deadline_at, deadline_time_zone, target_completed_responses, policy_snapshot_json, form_settings_json, created_at, updated_at)
        SELECT ?, ?, ?, 'draft', ?, NULL, 0, NULL, NULL, NULL, NULL, NULL, (SELECT json_object('studio',json_extract(policy_snapshot_json,'$.studio')) FROM flow_revisions WHERE id=? AND json_type(policy_snapshot_json,'$.studio')='object'), ?, ?, ? WHERE ${guarded} RETURNING id
      `).bind(input.newDraft.id, input.newDraft.flowId, input.newDraft.number, input.newDraft.title, input.currentRevisionId, input.newDraft.formSettingsJson ?? '{}', input.newDraft.createdAt, input.newDraft.updatedAt, input.flowId, input.expectedVersion),
      ...input.newSteps.map((step) => this.binding.prepare(`
        INSERT INTO flow_steps (id, revision_id, position, stable_id, kind, question_type, prompt, helper_text, required, next_step_stable_id, question_settings_json, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flow_revisions WHERE id = ?) AND ${guarded}
      `).bind(step.id, step.revisionId, step.position, step.stableId, step.kind, step.questionType, step.prompt, step.helperText, step.required ? 1 : 0, step.nextStepStableId, step.questionSettingsJson, step.createdAt, step.updatedAt, input.newDraft.id, input.flowId, input.expectedVersion)),
      ...input.newChoices.map((choice) => this.binding.prepare(`
        INSERT INTO choice_options (id, step_id, stable_id, value, label, position, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flow_steps WHERE id = ?) AND ${guarded}
      `).bind(choice.id, choice.stepId, choice.stableId, choice.value, choice.label, choice.position, choice.createdAt, choice.updatedAt, choice.stepId, input.flowId, input.expectedVersion)),
      ...input.newRules.map((rule) => this.binding.prepare(`
        INSERT INTO flow_branch_rules (id, revision_id, source_step_stable_id, predicate_kind, expected_value_json, condition_json, destination_step_stable_id, position, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM flow_revisions WHERE id = ?) AND ${guarded}
      `).bind(rule.id, rule.revisionId, rule.sourceStepStableId, rule.predicateKind, rule.expectedValueJson, rule.conditionJson ?? null, rule.destinationStepStableId, rule.position, rule.createdAt, rule.updatedAt, input.newDraft.id, input.flowId, input.expectedVersion)),
      this.binding.prepare(`UPDATE flow_revisions SET is_current = 0, updated_at = ? WHERE flow_id = ? AND state = 'published' AND is_current = 1 AND ${guarded}`).bind(input.now, input.flowId, input.flowId, input.expectedVersion),
      this.binding.prepare(`
        UPDATE flow_revisions
        SET state = 'published', published_at = ?, is_current = 1, admission_closed_at = NULL, admission_close_reason = NULL,
            deadline_at = ?, deadline_time_zone = ?, target_completed_responses = ?, policy_snapshot_json = CASE WHEN json_type(policy_snapshot_json,'$.studio')='object' THEN json_set(?,'$.studio',json_extract(policy_snapshot_json,'$.studio')) ELSE ? END, updated_at = ?
        WHERE id = ? AND state = 'draft' AND ${guarded}
      `).bind(input.now, input.deadlineAt, input.deadlineTimeZone, input.targetCompletedResponses, input.policySnapshotJson, input.policySnapshotJson, input.now, input.currentRevisionId, input.flowId, input.expectedVersion),
      this.binding.prepare(`INSERT OR IGNORE INTO notification_preferences(flow_id,operator_id,mode,updated_at) SELECT f.id,o.id,'immediately',? FROM flows f JOIN operators o ON o.workspace_id=f.workspace_id WHERE f.id=? AND f.draft_version=? AND o.id=?`).bind(input.now,input.flowId,input.expectedVersion,input.operatorId ?? null),
      this.binding.prepare(`UPDATE flows SET status = 'open', draft_version = ?, last_activity_at = ?, updated_at = ? WHERE id = ? AND draft_version = ? RETURNING id`).bind(input.expectedVersion + 1, input.now, input.now, input.flowId, input.expectedVersion),
    ]
    const results = await this.auditedDraft(input, statements)
    // Imported forms also update custody stamps through triggers. Count the
    // directly returned rows rather than including those trigger mutations.
    return results[0].results.length === 1 && results[results.length - 1].results.length === 1
  }

  async closeFlow(flowId: string, now: string, operatorId?: string) {
    await this.binding.batch([this.lifecycleAudit(flowId, now, operatorId, 'flow.closed'),
      this.binding.prepare(`UPDATE flow_revisions SET admission_closed_at = ?, admission_close_reason = 'manual', updated_at = ? WHERE flow_id = ? AND state = 'published' AND admission_closed_at IS NULL`).bind(now, now, flowId),
      this.binding.prepare(`UPDATE flows SET status = 'closed', last_activity_at = ?, updated_at = ? WHERE id = ? AND status = 'open'`).bind(now, now, flowId),
    ])
  }

  async reopenFlow(flowId: string, now: string, operatorId: string) {
    const auditId = crypto.randomUUID()
    const results = await this.binding.batch([
      this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, workspace_id, 'flow.reopened', (SELECT id FROM operators WHERE id = ? AND workspace_id = flows.workspace_id), 'flow', id, '{}', ? FROM flows
        WHERE id = ? AND status = 'closed' AND EXISTS (SELECT 1 FROM flow_revisions r WHERE r.flow_id = flows.id AND r.state = 'published' AND r.is_current = 1
          AND (r.deadline_at IS NULL OR r.deadline_at > ?) AND (r.target_completed_responses IS NULL OR
            (SELECT COUNT(*) FROM responses admitted WHERE admitted.revision_id = r.id AND ${admittedResponseSql('admitted')}) < r.target_completed_responses))`).bind(auditId, operatorId, now, flowId, now),
      this.binding.prepare(`UPDATE flow_revisions SET admission_closed_at = NULL, admission_close_reason = NULL, updated_at = ? WHERE flow_id = ? AND state = 'published' AND is_current = 1 AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(now, flowId, auditId),
      this.binding.prepare(`UPDATE flows SET status = 'open', last_activity_at = ?, updated_at = ? WHERE id = ? AND status = 'closed' AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?) RETURNING id`).bind(now, now, flowId, auditId),
    ])
    return changedRows(results[2]) === 1
  }

  async closeExpiredRevision(revisionId: string, now: string) {
    const auditId = crypto.randomUUID()
    await this.binding.batch([
      this.binding.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
        SELECT ?, f.workspace_id, 'flow.deadline-closed', NULL, 'flow-revision', r.id, '{"feature":"flow.deadline"}', ?
        FROM flow_revisions r JOIN flows f ON f.id = r.flow_id WHERE r.id = ? AND r.state = 'published' AND r.admission_closed_at IS NULL AND r.deadline_at <= ?`).bind(auditId, now, revisionId, now),
      this.binding.prepare(`UPDATE flow_revisions SET admission_closed_at = deadline_at, admission_close_reason = 'deadline', updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM audit_entries WHERE id = ?)`).bind(now, revisionId, auditId),
      this.binding.prepare(`UPDATE flows SET status = 'closed', last_activity_at = ?, updated_at = ? WHERE status = 'open' AND EXISTS (SELECT 1 FROM flow_revisions WHERE id = ? AND flow_id = flows.id AND is_current = 1 AND admission_close_reason = 'deadline')`).bind(now, now, revisionId),
    ])
  }

  async archiveFlow(flowId: string, now: string, operatorId?: string) {
    await this.binding.batch([this.lifecycleAudit(flowId, now, operatorId, 'flow.archived'),
      this.binding.prepare(`UPDATE flow_revisions SET admission_closed_at = COALESCE(admission_closed_at, ?), admission_close_reason = 'archive', updated_at = ? WHERE flow_id = ? AND state = 'published'`).bind(now, now, flowId),
      this.binding.prepare(`UPDATE flows SET status = 'archived', last_activity_at = ?, updated_at = ? WHERE id = ? AND status != 'archived'`).bind(now, now, flowId),
    ])
  }

  private async findDraftStep(revisionId: string, stableId: string) {
    const [step] = await this.database.select().from(flowSteps).where(and(eq(flowSteps.revisionId, revisionId), eq(flowSteps.stableId, stableId))).limit(1)
    return step
  }
}
