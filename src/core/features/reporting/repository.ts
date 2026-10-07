import { composeQuestionReports, type ReportStep, type ReportAnswer, type ReportChoice } from './questionReport'
export type LedgerFilter = { revisionId?: string; source?: 'direct' | 'embed' | 'invitation' | 'unknown'; participantStatus?: 'eligible' | 'opted-out' | 'bounced'; from?: string; to?: string; answerStepId?: string; answerValue?: string; offset?: number }
export type LedgerResponse = { participant?: { id: string; name: string | null; email: string | null }; id: string; revisionId: string; revisionNumber: number; source: string; startedAt: string | null; completedAt: string; releasedAt: string; answers: Array<{ stepId: string; label: string; questionType: string; value: unknown; displayValue: string }> }

export class ReportingRepository {
  constructor(private readonly binding: D1Database) {}
  async flow(workspaceId: string, flowId: string) {
    return this.binding.prepare('SELECT id, title, slug FROM flows WHERE id = ? AND workspace_id = ?').bind(flowId, workspaceId).first<{ id: string; title: string; slug: string }>()
  }
  async revisions(flowId: string) {
    return (await this.binding.prepare("SELECT id, number, is_current AS isCurrent FROM flow_revisions WHERE flow_id = ? AND state = 'published' ORDER BY number DESC").bind(flowId).all<{ id: string; number: number; isCurrent: number }>()).results
  }
  async ledger(workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: 'released' | 'quarantined' = 'released', limit = 50) {
    const parts = ['r.workspace_id = ?', 'r.flow_id = ?', 'r.state = ?', 'r.completed_at <= ?']
    const bindings: unknown[] = [workspaceId, flowId, state, cutoff]
    if (state === 'released') { parts.push('r.released_at <= ?'); bindings.push(cutoff) }
    for (const [value, sql] of [[filter.revisionId, 'r.revision_id = ?'], [filter.source, 'r.source = ?'], [filter.from, 'r.completed_at >= ?'], [filter.to, 'r.completed_at <= ?']] as const) if (value) { parts.push(sql); bindings.push(value) }
    if (filter.answerStepId && filter.answerValue !== undefined) {
      parts.push(`EXISTS (SELECT 1 FROM response_answers a JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id
        WHERE a.response_id = r.id AND a.step_id = ? AND (
          (s.question_type = 'email' AND lower(json_extract(a.value_json, '$')) = lower(?))
          OR (s.question_type IN ('multiple_choice', 'priority') AND EXISTS (SELECT 1 FROM json_each(a.value_json) WHERE CAST(value AS TEXT) = ?))
          OR (s.question_type NOT IN ('email', 'multiple_choice', 'priority') AND CAST(json_extract(a.value_json, '$') AS TEXT) = ?)))`)
      bindings.push(filter.answerStepId, filter.answerValue, filter.answerValue, filter.answerValue)
    }
    if (filter.participantStatus) {
      parts.push(`EXISTS (SELECT 1 FROM invitation_participants p LEFT JOIN distribution_contacts c ON c.id = p.contact_id WHERE p.id = r.participant_id AND ${filter.participantStatus === 'bounced' ? "p.delivery_status = 'bounced'" : filter.participantStatus === 'opted-out' ? 'c.opted_out_at IS NOT NULL' : "c.id IS NOT NULL AND c.opted_out_at IS NULL AND p.delivery_status != 'bounced'"})`)
    }
    const where = parts.join(' AND ')
    const total = await this.binding.prepare(`SELECT count(*) AS count FROM responses r WHERE ${where}`).bind(...bindings).first<{ count: number }>()
    const rows = (await this.binding.prepare(`SELECT r.id, r.revision_id AS revisionId, revision.number AS revisionNumber, r.source, r.started_at AS startedAt,
      r.completed_at AS completedAt, r.released_at AS releasedAt FROM responses r JOIN flow_revisions revision ON revision.id = r.revision_id
      WHERE ${where} ORDER BY r.completed_at DESC, r.id DESC LIMIT ? OFFSET ?`).bind(...bindings, limit, filter.offset ?? 0).all<Omit<LedgerResponse, 'answers'>>()).results
    const participants = rows.length ? (await this.binding.prepare(`SELECT r.id AS responseId, p.id, p.name_snapshot AS name, p.email_snapshot AS email FROM responses r JOIN invitation_participants p ON p.id = r.participant_id WHERE r.id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(row => row.id)).all<{ responseId: string; id: string; name: string | null; email: string | null }>()).results : []
    const answers = rows.length ? (await this.binding.prepare(`SELECT a.response_id AS responseId, a.step_id AS stepId, s.prompt AS label, s.question_type AS questionType, a.value_json AS valueJson
      FROM response_answers a JOIN responses r ON r.id = a.response_id JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id
      WHERE a.response_id IN (${rows.map(() => '?').join(',')}) ORDER BY s.position`).bind(...rows.map((row) => row.id)).all<{ responseId: string; stepId: string; label: string; questionType: string; valueJson: string }>()).results : []
    const optionRows = rows.length ? (await this.binding.prepare(`SELECT c.stable_id AS id, c.label, s.stable_id AS stepId, s.revision_id AS revisionId FROM choice_options c JOIN flow_steps s ON s.id = c.step_id WHERE s.revision_id IN (${[...new Set(rows.map((row) => row.revisionId))].map(() => '?').join(',')})`).bind(...new Set(rows.map((row) => row.revisionId))).all<{ id: string; label: string; stepId: string; revisionId: string }>()).results : []
    const display = (value: unknown, stepId: string, revisionId: string, questionType: string) => {
      const label = (id: unknown) => optionRows.find((option) => option.id === id && option.stepId === stepId && option.revisionId === revisionId)?.label ?? String(id)
      if (['single_choice', 'multiple_choice', 'priority'].includes(questionType)) return Array.isArray(value) ? value.map((id, index) => `${questionType === 'priority' ? `${index + 1}. ` : ''}${label(id)}`).join('\n') : label(value)
      return typeof value === 'string' ? value : JSON.stringify(value)
    }
    return { total: total?.count ?? 0, responses: rows.map((row) => ({ ...row, ...(participants.some(p => p.responseId === row.id) ? { participant: (() => { const { responseId: _responseId, ...p } = participants.find(p => p.responseId === row.id)!; return p })() } : {}), answers: answers.filter((answer) => answer.responseId === row.id).map(({ stepId, label, questionType, valueJson }) => ({ stepId, label, questionType, value: JSON.parse(valueJson) as unknown, displayValue: display(JSON.parse(valueJson), stepId, row.revisionId, questionType) })) })) }
  }
  async questionReport(revisionId: string) {
    const [steps, answers, choices] = await this.binding.batch([
      this.binding.prepare(`SELECT s.revision_id AS revisionId, s.stable_id AS id, s.prompt, s.question_type AS questionType, s.position,
        COALESCE(m.reached, 0) AS reached, COALESCE(m.dropped, 0) AS dropped FROM flow_steps s
        LEFT JOIN revision_step_metric_counters m ON m.revision_id = s.revision_id AND m.step_stable_id = s.stable_id
        WHERE s.revision_id = ? ORDER BY s.position`).bind(revisionId),
      this.binding.prepare(`SELECT r.revision_id AS revisionId, a.step_id AS stepId, a.value_json AS valueJson FROM response_answers a JOIN responses r ON r.id = a.response_id
        WHERE r.revision_id = ? AND r.state = 'released'`).bind(revisionId),
      this.binding.prepare(`SELECT s.revision_id AS revisionId, c.stable_id AS id, c.label, s.stable_id AS stepId FROM choice_options c JOIN flow_steps s ON s.id = c.step_id
        WHERE s.revision_id = ? ORDER BY c.position`).bind(revisionId),
    ])
    return composeQuestionReports(steps.results as ReportStep[], answers.results as ReportAnswer[], choices.results as ReportChoice[])
      .map(({ revisionId: _revisionId, ...question }) => question)
  }

  async revisionComparison(workspaceId: string, flowId: string) {
    const scope = "f.id = ? AND f.workspace_id = ? AND v.state = 'published'"
    const [revisions, steps, answers, choices] = await this.binding.batch([
      this.binding.prepare(`SELECT v.id, v.number, v.is_current AS isCurrent, COUNT(r.id) AS releasedResponses FROM flow_revisions v
        JOIN flows f ON f.id = v.flow_id LEFT JOIN responses r ON r.revision_id = v.id AND r.state = 'released' AND r.workspace_id = f.workspace_id AND r.flow_id = f.id
        WHERE ${scope} GROUP BY v.id, v.number, v.is_current ORDER BY v.number DESC`).bind(flowId, workspaceId),
      this.binding.prepare(`SELECT s.revision_id AS revisionId, s.stable_id AS id, s.prompt, s.question_type AS questionType, s.position,
        COALESCE(m.reached, 0) AS reached, COALESCE(m.dropped, 0) AS dropped FROM flow_steps s
        JOIN flow_revisions v ON v.id = s.revision_id JOIN flows f ON f.id = v.flow_id
        LEFT JOIN revision_step_metric_counters m ON m.revision_id = s.revision_id AND m.step_stable_id = s.stable_id
        WHERE ${scope} AND s.kind = 'question' ORDER BY v.number DESC, s.position`).bind(flowId, workspaceId),
      this.binding.prepare(`SELECT r.revision_id AS revisionId, a.step_id AS stepId, a.value_json AS valueJson FROM response_answers a
        JOIN responses r ON r.id = a.response_id JOIN flow_revisions v ON v.id = r.revision_id JOIN flows f ON f.id = v.flow_id
        WHERE ${scope} AND r.state = 'released' AND r.workspace_id = f.workspace_id AND r.flow_id = f.id`).bind(flowId, workspaceId),
      this.binding.prepare(`SELECT s.revision_id AS revisionId, c.stable_id AS id, c.label, s.stable_id AS stepId FROM choice_options c
        JOIN flow_steps s ON s.id = c.step_id JOIN flow_revisions v ON v.id = s.revision_id JOIN flows f ON f.id = v.flow_id
        WHERE ${scope} ORDER BY v.number DESC, s.position, c.position`).bind(flowId, workspaceId),
    ])
    const revisionRows = revisions.results as Array<{ id: string; number: number; isCurrent: number; releasedResponses: number }>
    const revisionCounts = new Map(revisionRows.map(row => [row.id, row.releasedResponses]))
    const groups = new Map<string, { id: string; versions: Array<ReturnType<typeof composeQuestionReports>[number] & { eligibleResponses: number }> }>()
    for (const question of composeQuestionReports(steps.results as ReportStep[], answers.results as ReportAnswer[], choices.results as ReportChoice[])) {
      const group = groups.get(question.id) ?? { id: question.id, versions: [] }
      group.versions.push({ ...question, eligibleResponses: revisionCounts.get(question.revisionId) ?? 0 }); groups.set(question.id, group)
    }
    return { revisions: revisionRows, questions: [...groups.values()].map(group => ({ ...group, answered: group.versions.reduce((total, version) => total + version.answered, 0), eligibleResponses: group.versions.reduce((total, version) => total + version.eligibleResponses, 0) })) }
  }
}
