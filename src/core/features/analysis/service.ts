import { ulid } from 'ulid'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import type { AiProvider } from '../../platform/ai/provider'
import { analysableQuestions, releasedResponseIds } from './evidence'
import { policySnapshot, type Policies, type RequestRunInput } from './model'
import { AnalysisRepository } from './repository'
import { AnalysisRunner } from './runner'

/** What an operator is told about the provider before anything leaves (WS-003, ANLY-008). */
export function providerStatus(provider: AiProvider) {
  return provider.state === 'on'
    ? { state: 'on' as const, origin: provider.origin, model: provider.model, transport: provider.transport, costReported: provider.transport === 'models' || !!provider.rates }
    : { state: provider.state, setup: provider.setup }
}

export class AnalysisService {
  readonly records: AnalysisRepository
  private readonly runner: AnalysisRunner
  constructor(private readonly db: D1Database, readonly provider: AiProvider) {
    this.records = new AnalysisRepository(db)
    this.runner = new AnalysisRunner(db, provider)
  }

  /** The revisions an operator may analyse, with their completed responses and analysable questions. */
  async options(workspaceId: string, flowId: string) {
    const flow = await this.db.prepare('SELECT id, title FROM flows WHERE id = ? AND workspace_id = ?').bind(flowId, workspaceId).first<{ id: string; title: string }>()
    if (!flow) throw new NotFoundError('This flow is not in your workspace.')
    const { results } = await this.db.prepare(`SELECT r.id, r.number, r.is_current AS isCurrent, (SELECT COUNT(*) FROM responses x WHERE x.revision_id = r.id AND x.workspace_id = ? AND x.state = 'released' AND x.completed_at IS NOT NULL) AS completed
      FROM flow_revisions r WHERE r.flow_id = ? AND r.published_at IS NOT NULL ORDER BY r.number DESC`).bind(workspaceId, flowId).all<{ id: string; number: number; isCurrent: number; completed: number }>()
    const revisions = await Promise.all(results.map(async revision => ({ id: revision.id, number: revision.number, isCurrent: revision.isCurrent === 1, completed: revision.completed,
      questions: (await analysableQuestions(this.db, revision.id)).map(question => ({ id: question.id, prompt: question.prompt, questionType: question.questionType })) })))
    return { flow, revisions, provider: providerStatus(this.provider), policies: await this.records.policies(workspaceId) }
  }

  /** ANLY-001 / ANLY-002 / ANLY-015: the run, its exact evidence and its policy snapshot are fixed in one batch, then it starts at once. */
  async request(workspaceId: string, operatorId: string | null, input: RequestRunInput, now = new Date(), trigger: 'operator' | 'autorun' = 'operator') {
    const revision = await this.db.prepare(`SELECT r.id FROM flow_revisions r JOIN flows f ON f.id = r.flow_id WHERE r.id = ? AND r.flow_id = ? AND f.workspace_id = ? AND r.published_at IS NOT NULL`)
      .bind(input.revisionId, input.flowId, workspaceId).first()
    if (!revision) throw new NotFoundError('This published revision is not in your workspace.')
    const analysable = await analysableQuestions(this.db, input.revisionId)
    // By default only long text answers leave; a short text answer is often a name, so an operator chooses it explicitly.
    const questionIds = input.questionIds ?? analysable.filter(question => question.questionType === 'long_text').map(question => question.id)
    if (!questionIds.length) throw new ValidationError('Choose the short or long text questions to analyse.')
    if (questionIds.some(id => !analysable.some(question => question.id === id))) throw new ValidationError('Choose short or long text questions of this revision.')
    const evidence = await releasedResponseIds(this.db, workspaceId, input.revisionId)
    if (!evidence.length) throw new ValidationError('This revision has no completed responses to analyse.')
    const id = ulid(), at = now.toISOString(), policies = await this.records.policies(workspaceId)
    const inserted = await this.db.batch([
      this.db.prepare(`INSERT ${trigger === 'autorun' ? 'OR IGNORE ' : ''}INTO analysis_runs (id, workspace_id, flow_id, revision_id, trigger, requested_by_operator_id, state, question_ids_json, policy_json, evidence_count, evidence_cutoff, next_attempt_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, input.flowId, input.revisionId, trigger, operatorId, JSON.stringify(questionIds), JSON.stringify(policySnapshot(policies)), evidence.length, at, at, at, at),
      this.db.prepare(`INSERT INTO analysis_evidence (run_id, response_id, position) SELECT ?, value, key FROM json_each(?) WHERE EXISTS (SELECT 1 FROM analysis_runs WHERE id = ?)`).bind(id, JSON.stringify(evidence), id),
    ])
    if (!inserted[0].meta.changes) return null
    await this.runner.execute(id, now)
    return id
  }

  /** ANLY-008: a failed run (or one a restore left unscheduled) runs again with the same evidence and policy snapshot. */
  async retry(workspaceId: string, runId: string, now = new Date()) {
    const at = now.toISOString()
    const result = await this.db.prepare(`UPDATE analysis_runs SET state = 'queued', attempts = 0, first_attempt_at = NULL, request_sha256 = NULL, next_attempt_at = ?, error_code = NULL, error_message = NULL, finished_at = NULL, updated_at = ?
      WHERE id = ? AND workspace_id = ? AND (state = 'failed' OR (state = 'queued' AND next_attempt_at IS NULL))`).bind(at, at, runId, workspaceId).run()
    if (!result.meta.changes) throw new ConflictError('Only a failed or unscheduled analysis can be retried.')
    await this.runner.execute(runId, now)
  }

  async setPolicies(workspaceId: string, operatorId: string, policies: Policies, now = new Date()) {
    await this.db.prepare(`INSERT INTO analysis_policies (workspace_id, autorun_enabled, autorun_minimum, disclosure_threshold, selection, updated_by_operator_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET autorun_enabled = excluded.autorun_enabled, autorun_minimum = excluded.autorun_minimum, disclosure_threshold = excluded.disclosure_threshold,
      selection = excluded.selection, updated_by_operator_id = excluded.updated_by_operator_id, updated_at = excluded.updated_at`)
      .bind(workspaceId, policies.autorunEnabled ? 1 : 0, policies.autorunMinimum, policies.disclosureThreshold, policies.selection, operatorId, now.toISOString()).run()
  }

  /** The scheduled tick: interrupted runs fail (never resent), analysis.autorun.v1 starts close-time runs, due retries run. */
  async tick(now: Date) {
    const at = now.toISOString()
    await this.db.prepare(`UPDATE analysis_runs SET state = 'failed', error_code = 'run_interrupted', error_message = 'The analysis stopped before it finished. Retry it.', finished_at = ?, updated_at = ?
      WHERE state = 'running' AND (lease_until IS NULL OR lease_until < ?)`).bind(at, at, at).run()
    if (this.provider.state === 'on') await this.autorun(now)
    const { results } = await this.db.prepare(`SELECT id FROM analysis_runs WHERE state = 'queued' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT 5`).bind(at).all<{ id: string }>()
    for (const run of results) await this.runner.execute(run.id, now)
  }

  /** analysis.autorun.v1: once per revision that closed within the last day and has at least the policy's minimum of completed responses. */
  private async autorun(now: Date) {
    const since = new Date(now.getTime() - 86_400_000).toISOString()
    const { results } = await this.db.prepare(`SELECT r.id AS revisionId, r.flow_id AS flowId, f.workspace_id AS workspaceId FROM flow_revisions r JOIN flows f ON f.id = r.flow_id
      WHERE r.published_at IS NOT NULL AND ((r.admission_closed_at IS NOT NULL AND r.admission_closed_at >= ?) OR (f.status = 'closed' AND r.is_current = 1 AND f.updated_at >= ?))
      AND NOT EXISTS (SELECT 1 FROM analysis_runs a WHERE a.revision_id = r.id AND a.trigger = 'autorun') LIMIT 10`).bind(since, since).all<{ revisionId: string; flowId: string; workspaceId: string }>()
    for (const closed of results) {
      const policies = await this.records.policies(closed.workspaceId)
      if (!policies.autorunEnabled || (await releasedResponseIds(this.db, closed.workspaceId, closed.revisionId)).length < policies.autorunMinimum) continue
      if (!(await analysableQuestions(this.db, closed.revisionId)).some(question => question.questionType === 'long_text')) continue
      await this.request(closed.workspaceId, null, { flowId: closed.flowId, revisionId: closed.revisionId }, now, 'autorun')
    }
  }
}
