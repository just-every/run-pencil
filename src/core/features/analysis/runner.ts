import { ulid } from 'ulid'
import { canonicalJson, sha256 } from '../../../base/import-kit/src/d1/index'
import type { AiProvider } from '../../platform/ai/provider'
import { analysableQuestions, evidenceResponses, providerRequest } from './evidence'
import { AnalysisFailure, type PolicySnapshot } from './model'
import { callProvider, type CallUsage } from './provider-call'
import { validateOutput, type ValidatedResult } from './validate'

type RunRow = { id: string; workspace_id: string; revision_id: string; attempts: number; first_attempt_at: string; question_ids_json: string; policy_json: string; request_sha256: string | null }

/** ANLY-016: at most 3 retries of a transient transport failure, all within 10 minutes of the first attempt. */
export const retryDelaysSeconds = [60, 120, 240]
const retryWindowMilliseconds = 10 * 60_000
const leaseMilliseconds = 5 * 60_000
const maximumRequestBytes = 600_000

export class AnalysisRunner {
  constructor(private readonly db: D1Database, private readonly provider: AiProvider) {}

  /** Runs one due attempt of a queued run. A run another invocation already holds, or one not due yet, is left alone. */
  async execute(runId: string, now: Date) {
    const at = now.toISOString()
    const run = await this.db.prepare(`UPDATE analysis_runs SET state = 'running', attempts = attempts + 1, first_attempt_at = COALESCE(first_attempt_at, ?), started_at = COALESCE(started_at, ?),
      lease_until = ?, next_attempt_at = NULL, updated_at = ? WHERE id = ? AND state = 'queued' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ? AND attempts < 4
      RETURNING id, workspace_id, revision_id, attempts, first_attempt_at, question_ids_json, policy_json, request_sha256`)
      .bind(at, at, new Date(now.getTime() + leaseMilliseconds).toISOString(), at, runId, at).first<RunRow>()
    if (!run) return
    try { await this.attempt(run, now) }
    catch (error) {
      const failure = error instanceof AnalysisFailure ? error : new AnalysisFailure('analysis_failed', 'The analysis could not be completed.')
      if (!(error instanceof AnalysisFailure)) console.error('Analysis run failed unexpectedly.')
      await this.failOrRetry(run, failure, now)
    }
  }

  private async attempt(run: RunRow, now: Date) {
    const policy = JSON.parse(run.policy_json) as PolicySnapshot, threshold = policy.disclosure.threshold
    const questionIds = JSON.parse(run.question_ids_json) as string[]
    // WS-003 / ANLY-008: without a configured provider nothing is sent and nothing is invented.
    if (this.provider.state !== 'on') throw new AnalysisFailure(this.provider.state === 'off' ? 'ai_disabled' : this.provider.code, this.provider.setup)
    const provider = this.provider
    const evidence = await evidenceResponses(this.db, run.id, questionIds)
    const answered = evidence.filter(response => Object.keys(response.answers).length).length
    // ANLY-013: a cohort below the disclosure threshold cannot support a finding; no data leaves for it.
    if (evidence.length < threshold || answered < threshold) return this.finish(run, now, { outcome: 'insufficient_evidence', reason: `Only ${answered} of ${evidence.length} responses answered the selected questions; a finding needs at least ${threshold}, the disclosure threshold.` }, null, null)
    const questions = (await analysableQuestions(this.db, run.revision_id)).filter(question => questionIds.includes(question.id))
    const request = providerRequest(provider.model, questions, evidence, threshold)
    const body = canonicalJson(request), digest = sha256(body)
    if (new TextEncoder().encode(body).byteLength > maximumRequestBytes) throw new AnalysisFailure('evidence_too_large', 'The selected answers are too large for one analysis. Select fewer questions.')
    // A retry sends exactly the request the first attempt sent; changed evidence (an erasure) is a new analysis.
    if (run.request_sha256 && run.request_sha256 !== digest) throw new AnalysisFailure('evidence_changed', 'The evidence changed since the first attempt. Request a new analysis.')
    await this.db.prepare('UPDATE analysis_runs SET request_sha256 = ?, provider_origin = ?, model = ? WHERE id = ?').bind(digest, provider.origin, provider.model, run.id).run()
    let output: unknown, usage: CallUsage
    try { ({ output, usage } = await callProvider(provider, request)) }
    catch (error) {
      await this.recordCall(run, now, 'failed', error instanceof AnalysisFailure ? error.code : 'upstream_uncertain', (error as { usage?: CallUsage }).usage ?? null)
      throw error
    }
    await this.recordCall(run, now, 'answered', null, usage)
    const result = validateOutput(output, evidence, questionIds, threshold)
    await this.finish(run, now, result, provider.origin, provider.model)
  }

  private async recordCall(run: RunRow, now: Date, outcome: 'answered' | 'failed', errorCode: string | null, usage: CallUsage | null) {
    const provider = this.provider as Extract<AiProvider, { state: 'on' }>
    await this.db.prepare(`INSERT INTO analysis_calls (id, workspace_id, run_id, feature, provider, provider_origin, model, attempt, outcome, error_code, input_tokens, output_tokens, cost_microusd, cost_source, receipt_id, day, created_at)
      VALUES (?, ?, ?, 'analysis', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(ulid(), run.workspace_id, run.id, provider.transport, provider.origin, provider.model, run.attempts, outcome, errorCode,
      usage?.inputTokens ?? null, usage?.outputTokens ?? null, usage?.costMicrousd ?? null, usage?.costSource ?? 'not-reported', usage?.receiptId ?? null, now.toISOString().slice(0, 10), now.toISOString()).run()
  }

  private async failOrRetry(run: RunRow, failure: AnalysisFailure, now: Date) {
    const delay = retryDelaysSeconds[run.attempts - 1], at = now.toISOString()
    const next = delay === undefined ? undefined : new Date(now.getTime() + delay * 1000)
    if (failure.transient && next && next.getTime() - Date.parse(run.first_attempt_at) <= retryWindowMilliseconds) {
      await this.db.prepare(`UPDATE analysis_runs SET state = 'queued', next_attempt_at = ?, lease_until = NULL, error_code = ?, error_message = ?, updated_at = ? WHERE id = ? AND state = 'running'`)
        .bind(next.toISOString(), failure.code, failure.message, at, run.id).run()
      return
    }
    await this.db.prepare(`UPDATE analysis_runs SET state = 'failed', lease_until = NULL, error_code = ?, error_message = ?, finished_at = ?, updated_at = ? WHERE id = ? AND state = 'running'`)
      .bind(failure.code, failure.message, at, at, run.id).run()
  }

  /** The validated result and the run's final state commit together, or not at all. */
  private async finish(run: RunRow, now: Date, result: ValidatedResult, origin: string | null, model: string | null) {
    const at = now.toISOString(), statements: D1PreparedStatement[] = []
    if (result.outcome === 'insufficient_evidence') {
      statements.push(this.db.prepare(`UPDATE analysis_runs SET state = 'insufficient_evidence', insufficient_reason = ?, error_code = NULL, error_message = NULL, lease_until = NULL, finished_at = ?, updated_at = ? WHERE id = ? AND state = 'running'`).bind(result.reason, at, at, run.id))
      await this.db.batch(statements)
      return
    }
    statements.push(this.db.prepare(`UPDATE analysis_runs SET state = 'completed', error_code = NULL, error_message = NULL, lease_until = NULL, finished_at = ?, updated_at = ? WHERE id = ? AND state = 'running'`).bind(at, at, run.id))
    const owned = `EXISTS (SELECT 1 FROM analysis_runs WHERE id = ? AND state = 'completed' AND finished_at = ?)`
    const themeIds = result.themes.map(() => ulid())
    result.themes.forEach((theme, i) => {
      statements.push(this.db.prepare(`INSERT INTO analysis_themes (id, run_id, rank, title, summary, is_primary) SELECT ?, ?, ?, ?, ?, ? WHERE ${owned}`).bind(themeIds[i], run.id, theme.rank, theme.title, theme.summary || null, theme.primary ? 1 : 0, run.id, at))
      statements.push(this.db.prepare(`INSERT INTO analysis_theme_members (theme_id, run_id, response_id) SELECT ?, ?, value FROM json_each(?) WHERE ${owned}`).bind(themeIds[i], run.id, JSON.stringify(theme.members), run.id, at))
      if (theme.quotes.length) statements.push(this.db.prepare(`INSERT INTO analysis_quotes (id, theme_id, run_id, response_id, question_id, start_offset, end_offset, excerpt)
        SELECT json_extract(value, '$.id'), ?, ?, json_extract(value, '$.responseId'), json_extract(value, '$.questionId'), json_extract(value, '$.start'), json_extract(value, '$.end'), json_extract(value, '$.text') FROM json_each(?) WHERE ${owned}`)
        .bind(themeIds[i], run.id, JSON.stringify(theme.quotes.map(quote => ({ ...quote, id: ulid() }))), run.id, at))
    })
    result.contradictions?.forEach((contradiction, position) => statements.push(this.db.prepare(`INSERT INTO analysis_contradictions(id,run_id,position,payload_json) SELECT ?,?,?,? WHERE ${owned}`)
      .bind(ulid(),run.id,position,contradiction ? JSON.stringify(contradiction) : null,run.id,at)))
    if (result.recommendation) {
      const recommendation = result.recommendation, linked = recommendation.themeRanks.map(rank => themeIds[rank - 1])
      statements.push(this.db.prepare(`INSERT INTO analysis_recommendations (run_id, title, rationale, theme_ids_json, confidence, expected_impact, effort) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${owned}`)
        .bind(run.id, recommendation.title, recommendation.rationale || null, JSON.stringify(linked), recommendation.confidence, recommendation.expectedImpact, recommendation.effort, run.id, at))
    }
    if (origin && model) statements.push(this.db.prepare('UPDATE analysis_runs SET provider_origin = ?, model = ? WHERE id = ?').bind(origin, model, run.id))
    await this.db.batch(statements)
  }
}
