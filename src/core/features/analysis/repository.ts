import { NotFoundError } from '../../shared/errors'
import { defaultPolicies, type Level, type Policies, type PolicySnapshot, type RunState } from './model'

export type RunSummary = {
  id: string; flowId: string; flowTitle: string; revisionId: string; revisionNumber: number; state: RunState; trigger: 'operator' | 'autorun'
  evidenceCount: number; evidenceCutoff: string; staleResponses: number; createdAt: string; finishedAt: string | null; errorCode: string | null; errorMessage: string | null
  nextAttemptAt: string | null; attempts: number
}
export type ThemeView =
  | { id: string; rank: number; withheld: false; title: string; summary: string | null; primary: boolean; count: number; percentage: number; responseIds: string[]; quotes: Array<{ id: string; responseId: string; questionId: string; questionPrompt: string; excerpt: string }> }
  | { id: string; rank: number; withheld: true; primary: false }
export type RunDetail = RunSummary & {
  questions: Array<{ id: string; prompt: string }>; policy: PolicySnapshot; providerOrigin: string | null; model: string | null
  insufficientReason: string | null; redacted: boolean; themes: ThemeView[]
  recommendation: { title: string; rationale: string | null; themes: number[]; confidence: Level; expectedImpact: Level; effort: Level; responseIds: string[]; actionIds: string[] } | null
  calls: Array<{ attempt: number; outcome: string; errorCode: string | null; provider: string; model: string; inputTokens: number | null; outputTokens: number | null; costMicrousd: number | null; costSource: string; createdAt: string }>
}

type RunRow = {
  id: string; flowId: string; flowTitle: string; revisionId: string; revisionNumber: number; state: RunState; trigger: 'operator' | 'autorun'; evidenceCount: number; evidenceCutoff: string
  createdAt: string; finishedAt: string | null; errorCode: string | null; errorMessage: string | null; nextAttemptAt: string | null; attempts: number; staleResponses: number
  questionIds: string; policy: string; providerOrigin: string | null; model: string | null; insufficientReason: string | null; redactedAt: string | null
}
// A run is stale when a released, completed response of its revision is not in its fixed evidence set (ANLY-002, ANLY-007).
const runColumns = `a.id, a.flow_id AS flowId, f.title AS flowTitle, a.revision_id AS revisionId, r.number AS revisionNumber, a.state, a.trigger,
  (SELECT COUNT(*) FROM analysis_evidence e WHERE e.run_id = a.id) AS evidenceCount, a.evidence_cutoff AS evidenceCutoff, a.created_at AS createdAt, a.finished_at AS finishedAt,
  a.error_code AS errorCode, a.error_message AS errorMessage, a.next_attempt_at AS nextAttemptAt, a.attempts,
  (SELECT COUNT(*) FROM responses x WHERE x.revision_id = a.revision_id AND x.workspace_id = a.workspace_id AND x.state = 'released' AND x.completed_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM analysis_evidence e WHERE e.run_id = a.id AND e.response_id = x.id)) AS staleResponses,
  a.question_ids_json AS questionIds, a.policy_json AS policy, a.provider_origin AS providerOrigin, a.model, a.insufficient_reason AS insufficientReason, a.redacted_at AS redactedAt`
const fromRuns = 'FROM analysis_runs a JOIN flows f ON f.id = a.flow_id JOIN flow_revisions r ON r.id = a.revision_id'

const summary = (row: RunRow): RunSummary => ({
  id: row.id, flowId: row.flowId, flowTitle: row.flowTitle, revisionId: row.revisionId, revisionNumber: row.revisionNumber, state: row.state, trigger: row.trigger,
  evidenceCount: row.evidenceCount, evidenceCutoff: row.evidenceCutoff, staleResponses: row.state === 'completed' || row.state === 'insufficient_evidence' ? row.staleResponses : 0,
  createdAt: row.createdAt, finishedAt: row.finishedAt, errorCode: row.errorCode, errorMessage: row.errorMessage, nextAttemptAt: row.nextAttemptAt, attempts: row.attempts,
})

export class AnalysisRepository {
  constructor(private readonly db: D1Database) {}

  async policies(workspaceId: string): Promise<Policies> {
    const row = await this.db.prepare('SELECT autorun_enabled AS autorunEnabled, autorun_minimum AS autorunMinimum, disclosure_threshold AS disclosureThreshold, selection FROM analysis_policies WHERE workspace_id = ?').bind(workspaceId).first<{ autorunEnabled: number; autorunMinimum: number; disclosureThreshold: number; selection: 'highest-impact' }>()
    return row ? { autorunEnabled: row.autorunEnabled === 1, autorunMinimum: row.autorunMinimum, disclosureThreshold: row.disclosureThreshold, selection: row.selection } : defaultPolicies
  }

  async list(workspaceId: string) {
    const { results } = await this.db.prepare(`SELECT ${runColumns} ${fromRuns} WHERE a.workspace_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 200`).bind(workspaceId).all<RunRow>()
    return results.map(summary)
  }

  private async row(workspaceId: string, runId: string) {
    const row = await this.db.prepare(`SELECT ${runColumns} ${fromRuns} WHERE a.id = ? AND a.workspace_id = ?`).bind(runId, workspaceId).first<RunRow>()
    if (!row) throw new NotFoundError('This analysis is not in your workspace.')
    return row
  }

  /** ANLY-005: below the run's own snapshot threshold a theme shows no excerpt, identity or breakdown; exactly the threshold shows. */
  async detail(workspaceId: string, runId: string): Promise<RunDetail> {
    const row = await this.row(workspaceId, runId), policy = JSON.parse(row.policy) as PolicySnapshot, threshold = policy.disclosure.threshold
    const questionIds = JSON.parse(row.questionIds) as string[]
    const [questions, themes, members, quotes, recommendation, calls, actions] = await this.db.batch([
      this.db.prepare('SELECT stable_id AS id, prompt FROM flow_steps WHERE revision_id = ? AND stable_id IN (SELECT value FROM json_each(?)) ORDER BY position').bind(row.revisionId, JSON.stringify(questionIds)),
      this.db.prepare('SELECT id, rank, title, summary, is_primary AS isPrimary FROM analysis_themes WHERE run_id = ? ORDER BY rank').bind(runId),
      this.db.prepare('SELECT theme_id AS themeId, response_id AS responseId FROM analysis_theme_members WHERE run_id = ? ORDER BY response_id').bind(runId),
      this.db.prepare('SELECT id, theme_id AS themeId, response_id AS responseId, question_id AS questionId, excerpt FROM analysis_quotes WHERE run_id = ? ORDER BY id').bind(runId),
      this.db.prepare('SELECT title, rationale, theme_ids_json AS themeIds, confidence, expected_impact AS expectedImpact, effort FROM analysis_recommendations WHERE run_id = ?').bind(runId),
      this.db.prepare(`SELECT attempt, outcome, error_code AS errorCode, provider, model, input_tokens AS inputTokens, output_tokens AS outputTokens, cost_microusd AS costMicrousd, cost_source AS costSource, created_at AS createdAt FROM analysis_calls WHERE run_id = ? ORDER BY created_at, attempt`).bind(runId),
      this.db.prepare("SELECT id FROM actions WHERE workspace_id = ? AND source = 'analysis' AND analysis_id = ? ORDER BY created_at").bind(workspaceId, runId),
    ])
    const prompts = new Map((questions.results as Array<{ id: string; prompt: string }>).map(question => [question.id, question.prompt]))
    const evidence = row.evidenceCount
    const byTheme = new Map<string, string[]>()
    for (const member of members.results as Array<{ themeId: string; responseId: string }>) byTheme.set(member.themeId, [...byTheme.get(member.themeId) ?? [], member.responseId])
    const themeViews: ThemeView[] = (themes.results as Array<{ id: string; rank: number; title: string; summary: string | null; isPrimary: number }>).map(theme => {
      const responseIds = byTheme.get(theme.id) ?? []
      if (responseIds.length < threshold) return { id: theme.id, rank: theme.rank, withheld: true, primary: false }
      return { id: theme.id, rank: theme.rank, withheld: false, title: theme.title, summary: theme.summary, primary: theme.isPrimary === 1, count: responseIds.length,
        percentage: evidence ? Math.round(responseIds.length / evidence * 1000) / 10 : 0, responseIds,
        quotes: (quotes.results as Array<{ id: string; themeId: string; responseId: string; questionId: string; excerpt: string }>).filter(quote => quote.themeId === theme.id)
          .map(quote => ({ id: quote.id, responseId: quote.responseId, questionId: quote.questionId, questionPrompt: prompts.get(quote.questionId) ?? '', excerpt: quote.excerpt })) }
    })
    const rec = (recommendation.results as Array<{ title: string; rationale: string | null; themeIds: string; confidence: Level; expectedImpact: Level; effort: Level }>)[0]
    const linked = rec ? (JSON.parse(rec.themeIds) as string[]).map(id => themeViews.find(theme => theme.id === id)).filter((theme): theme is Extract<ThemeView, { withheld: false }> => !!theme && !theme.withheld) : []
    return {
      ...summary(row), questions: questionIds.filter(id => prompts.has(id)).map(id => ({ id, prompt: prompts.get(id)! })), policy, providerOrigin: row.providerOrigin, model: row.model,
      insufficientReason: row.insufficientReason, redacted: row.redactedAt !== null, themes: themeViews,
      // A recommendation stands only on findings an operator may see.
      recommendation: rec && linked.length ? { title: rec.title, rationale: rec.rationale, themes: linked.map(theme => theme.rank), confidence: rec.confidence, expectedImpact: rec.expectedImpact, effort: rec.effort,
        responseIds: [...new Set(linked.flatMap(theme => theme.responseIds))], actionIds: (actions.results as Array<{ id: string }>).map(action => action.id) } : null,
      calls: calls.results as RunDetail['calls'],
    }
  }

  /** ANLY-011: the retained responses behind a visible theme, with the run's selected answers. */
  async themeResponses(workspaceId: string, runId: string, themeId: string) {
    const detail = await this.detail(workspaceId, runId)
    const theme = detail.themes.find(item => item.id === themeId)
    if (!theme || theme.withheld) throw new NotFoundError('This theme is not shown for this analysis.')
    const { results } = await this.db.prepare(`SELECT r.id, r.completed_at AS completedAt, r.source, a.step_id AS questionId, a.value_json AS value FROM responses r
      LEFT JOIN response_answers a ON a.response_id = r.id AND a.step_id IN (SELECT value FROM json_each(?))
      WHERE r.workspace_id = ? AND r.id IN (SELECT value FROM json_each(?)) ORDER BY r.completed_at, r.id, a.step_id`)
      .bind(JSON.stringify(detail.questions.map(question => question.id)), workspaceId, JSON.stringify(theme.responseIds)).all<{ id: string; completedAt: string; source: string; questionId: string | null; value: string | null }>()
    const responses = new Map<string, { id: string; completedAt: string; source: string; answers: Array<{ questionId: string; prompt: string; text: string }> }>()
    for (const row of results) {
      const response = responses.get(row.id) ?? { id: row.id, completedAt: row.completedAt, source: row.source, answers: [] }
      responses.set(row.id, response)
      const value = row.value === null ? null : JSON.parse(row.value)
      if (row.questionId && typeof value === 'string') response.answers.push({ questionId: row.questionId, prompt: detail.questions.find(question => question.id === row.questionId)?.prompt ?? '', text: value })
    }
    return { flowId: detail.flowId, theme: { id: theme.id, rank: theme.rank, title: theme.title }, responses: [...responses.values()] }
  }

  /** ANLY-010: totals by day (UTC) and feature. */
  async usage(workspaceId: string) {
    const { results } = await this.db.prepare(`SELECT day, feature, COUNT(*) AS calls, SUM(COALESCE(input_tokens, 0)) AS inputTokens, SUM(COALESCE(output_tokens, 0)) AS outputTokens,
      SUM(cost_microusd) AS costMicrousd, SUM(CASE WHEN cost_microusd IS NULL THEN 1 ELSE 0 END) AS unreportedCalls
      FROM analysis_calls WHERE workspace_id = ? GROUP BY day, feature ORDER BY day DESC, feature LIMIT 90`).bind(workspaceId).all<{ day: string; feature: string; calls: number; inputTokens: number; outputTokens: number; costMicrousd: number | null; unreportedCalls: number }>()
    return results
  }
}
