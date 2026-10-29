import { readActionReminders } from './reminders'
import { ulid } from 'ulid'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'
import { legalTransitions, stateLabels, editableStates, awaitingReview, type ActionDetail, type ActionEvent, type ActionState, type ActionSummary, type CreateActionInput, type EditActionInput, type EvidenceFigures, type Measurement, type Verdict } from './model'

type ActionRow = {
  id: string; title: string; rationale: string; ownerId: string | null; ownerName: string | null; state: ActionState; verdict: Verdict | null
  reviewDate: string; source: 'manual' | 'analysis'; analysisId: string | null; metricName: string; metricUnit: string; metricDirection: 'increase' | 'decrease'
  baselineValue: number; baselineSource: string; baselineObservedAt: string; version: number; createdAt: string; updatedAt: string
}
const actionColumns = `a.id, a.title, a.rationale, a.owner_operator_id AS ownerId, o.display_name AS ownerName, a.state, a.verdict, a.review_date AS reviewDate,
  a.source, a.analysis_id AS analysisId, a.metric_name AS metricName, a.metric_unit AS metricUnit, a.metric_direction AS metricDirection,
  a.baseline_value AS baselineValue, a.baseline_source AS baselineSource, a.baseline_observed_at AS baselineObservedAt, a.version, a.created_at AS createdAt, a.updated_at AS updatedAt`
const fromActions = 'FROM actions a LEFT JOIN operators o ON o.id = a.owner_operator_id AND o.workspace_id = a.workspace_id'
const editableColumns = { title: 'title', rationale: 'rationale', ownerOperatorId: 'owner_operator_id', reviewDate: 'review_date' } as const
const sameUnit = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase()

/** The workspace's calendar date, so a review date is due by the WS-001 zone rather than the server's. */
export function workspaceToday(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export class ActionService {
  constructor(private readonly db: D1Database, private readonly reminderSenderFailure: string | null = null, private readonly reminderMailSuppressed = false, private readonly attribution: Record<string, unknown> = {}) {}

  attributed(attribution: Record<string, unknown>) { return new ActionService(this.db, this.reminderSenderFailure, this.reminderMailSuppressed, attribution) }

  private eventDetails(changes: Record<string, unknown> = {}) { return JSON.stringify({ ...changes, ...this.attribution }) }

  private async timeZone(workspaceId: string) {
    const row = await this.db.prepare('SELECT time_zone AS timeZone FROM workspaces WHERE id = ?').bind(workspaceId).first<{ timeZone: string }>()
    return row?.timeZone ?? 'UTC'
  }

  private summary(row: ActionRow, today: string): ActionSummary {
    return {
      id: row.id, title: row.title, state: row.state, verdict: row.verdict,
      owner: row.ownerId && row.ownerName ? { id: row.ownerId, displayName: row.ownerName } : null,
      metric: { name: row.metricName, unit: row.metricUnit, direction: row.metricDirection },
      reviewDate: row.reviewDate, reviewDue: awaitingReview.includes(row.state) && row.reviewDate <= today, updatedAt: row.updatedAt,
    }
  }

  private async row(workspaceId: string, actionId: string) {
    const row = await this.db.prepare(`SELECT ${actionColumns} ${fromActions} WHERE a.id = ? AND a.workspace_id = ?`).bind(actionId, workspaceId).first<ActionRow>()
    if (!row) throw new NotFoundError('This action is not in your workspace.')
    return row
  }

  private async requireOwner(workspaceId: string, operatorId: string) {
    const owner = await this.db.prepare('SELECT id FROM operators WHERE id = ? AND workspace_id = ?').bind(operatorId, workspaceId).first()
    if (!owner) throw new ValidationError('Choose an owner who is an operator of this workspace.')
  }

  async list(workspaceId: string, now = new Date()) {
    const today = workspaceToday(await this.timeZone(workspaceId), now)
    const rows = (await this.db.prepare(`SELECT ${actionColumns} ${fromActions} WHERE a.workspace_id = ? ORDER BY a.review_date, a.id`).bind(workspaceId).all<ActionRow>()).results
    return { today, actions: rows.map(row => this.summary(row, today)) }
  }

  async get(workspaceId: string, actionId: string, now = new Date()): Promise<ActionDetail> {
    const row = await this.row(workspaceId, actionId)
    const today = workspaceToday(await this.timeZone(workspaceId), now)
    const [evidence, measurements, history] = await this.db.batch([
      this.db.prepare('SELECT flow_id AS flowId, revision_id AS revisionId, question_stable_id AS questionId, figures_json AS figures, captured_at AS capturedAt FROM action_evidence WHERE action_id = ?').bind(actionId),
      this.db.prepare(`SELECT m.id, m.flow_id AS flowId, f.title AS flowTitle, m.revision_id AS revisionId, v.number AS revisionNumber, m.observed_value AS observedValue, m.unit,
        m.observed_at AS observedAt, CASE WHEN json_type(e.changes_json,'$.prepared_by.agent.name')='text' THEN json_extract(e.changes_json,'$.prepared_by.agent.name') || ' for ' || o.display_name ELSE o.display_name END AS operator, m.created_at AS createdAt FROM action_measurements m JOIN flows f ON f.id = m.flow_id
        LEFT JOIN flow_revisions v ON v.id = m.revision_id LEFT JOIN operators o ON o.id = m.operator_id LEFT JOIN action_events e ON e.id=m.id AND e.action_id=m.action_id WHERE m.action_id = ? ORDER BY m.created_at, m.id`).bind(actionId),
      this.db.prepare(`SELECT e.id, e.kind, e.from_state AS fromState, e.to_state AS toState, e.note, e.changes_json AS changes, o.display_name AS operator, e.created_at AS createdAt
        FROM action_events e LEFT JOIN operators o ON o.id = e.operator_id WHERE e.action_id = ? ORDER BY e.created_at, e.id`).bind(actionId),
    ])
    const frozen = evidence.results[0] as { flowId: string; revisionId: string; questionId: string | null; figures: string; capturedAt: string }
    return {
      ...this.summary(row, today),
      reminders: await readActionReminders(this.db,workspaceId,actionId,today,this.reminderSenderFailure,this.reminderMailSuppressed),
      rationale: row.rationale, source: row.source, analysisId: row.analysisId, version: row.version, createdAt: row.createdAt,
      metric: { name: row.metricName, unit: row.metricUnit, direction: row.metricDirection, baselineValue: row.baselineValue, baselineSource: row.baselineSource, baselineObservedAt: row.baselineObservedAt },
      evidence: { ...frozen, figures: JSON.parse(frozen.figures) as EvidenceFigures },
      legalTransitions: [...legalTransitions[row.state]],
      measurements: (measurements.results as Array<Omit<Measurement, 'difference' | 'direction'>>).map(measurement => {
        const difference = measurement.observedValue - row.baselineValue
        return { ...measurement, difference, direction: difference === 0 ? 'unchanged' : (difference > 0) === (row.metricDirection === 'increase') ? 'desired' : 'undesired' }
      }),
      history: (history.results as Array<Omit<ActionEvent, 'changes'> & { changes: string | null }>).map(event => {
        const { prepared_by, approvers: _approvers, ...changes } = event.changes ? JSON.parse(event.changes) : {}
        const agent = prepared_by?.agent?.name
        return { ...event, operator: agent && event.operator ? `${agent} for ${event.operator}` : event.operator, changes: Object.keys(changes).length ? changes : null }
      }),
    }
  }

  private audit(workspaceId: string, actionId: string, eventId: string, operatorId: string, kind: string, details: Record<string, number>) {
    // Ids, kinds and counts only: an audit row never repeats the action's text.
    return this.db.prepare(`INSERT INTO audit_entries (id, workspace_id, kind, actor_operator_id, subject_type, subject_id, details_json, created_at)
      SELECT ?, workspace_id, ?, (SELECT id FROM operators WHERE id = ? AND workspace_id = ?), 'action', id, ?, ? FROM actions WHERE id = ? AND last_event_id = ?`)
      .bind(ulid(), kind, operatorId, workspaceId, JSON.stringify({ ...details, ...this.attribution }), new Date().toISOString(), actionId, eventId)
  }

  async create(workspaceId: string, operatorId: string, input: CreateActionInput, figures: EvidenceFigures) {
    await this.requireOwner(workspaceId, input.ownerOperatorId)
    const id = ulid(), eventId = ulid(), now = new Date().toISOString(), metric = input.metric
    await this.db.batch([
      this.db.prepare(`INSERT INTO actions (id, workspace_id, title, rationale, owner_operator_id, state, verdict, review_date, source, analysis_id, metric_name, metric_unit, metric_direction,
        baseline_value, baseline_source, baseline_observed_at, version, last_event_id, created_by_operator_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'planned', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`)
        .bind(id, workspaceId, input.title, input.rationale, input.ownerOperatorId, input.reviewDate, input.analysisId ? 'analysis' : 'manual', input.analysisId ?? null, metric.name, metric.unit, metric.direction, metric.baselineValue, metric.baselineSource, metric.baselineObservedAt, eventId, operatorId, now, now),
      this.db.prepare('INSERT INTO action_evidence (action_id, flow_id, revision_id, question_stable_id, figures_json, captured_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, input.evidence.flowId, input.evidence.revisionId, input.evidence.questionId ?? null, JSON.stringify(figures), now),
      this.db.prepare("INSERT INTO action_events (id, action_id, kind, from_state, to_state, note, changes_json, operator_id, created_at) VALUES (?, ?, 'created', NULL, 'planned', NULL, ?, ?, ?)").bind(eventId, id, this.eventDetails(), operatorId, now),
      this.audit(workspaceId, id, eventId, operatorId, 'action.created', { actions: 1 }),
    ])
    return id
  }

  async edit(workspaceId: string, operatorId: string, actionId: string, input: EditActionInput) {
    const current = await this.row(workspaceId, actionId)
    if (!editableStates.includes(current.state)) throw new ConflictError(`A ${stateLabels[current.state].toLowerCase()} action keeps its record as reviewed and cannot be edited.`)
    if (input.expectedVersion !== current.version) throw new ConflictError('This action changed since you opened it. Reload it and edit again.')
    if (input.ownerOperatorId) await this.requireOwner(workspaceId, input.ownerOperatorId)
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    const previous: Record<string, unknown> = { title: current.title, rationale: current.rationale, ownerOperatorId: current.ownerId, reviewDate: current.reviewDate }
    for (const field of Object.keys(editableColumns) as Array<keyof typeof editableColumns>) {
      if (input[field] !== undefined && input[field] !== previous[field]) changes[field] = { from: previous[field], to: input[field] }
    }
    if (input.metric) {
      const before = { name: current.metricName, unit: current.metricUnit, direction: current.metricDirection, baselineValue: current.baselineValue, baselineSource: current.baselineSource, baselineObservedAt: current.baselineObservedAt }
      if (JSON.stringify(before) !== JSON.stringify(input.metric)) {
        if (!sameUnit(before.unit, input.metric.unit) && await this.db.prepare('SELECT 1 FROM action_measurements WHERE action_id = ? LIMIT 1').bind(actionId).first()) {
          throw new ValidationError(`Measurements are already recorded in ${current.metricUnit}. Keep the unit so they stay comparable.`)
        }
        changes.metric = { from: before, to: input.metric }
      }
    }
    if (!Object.keys(changes).length) return
    const eventId = ulid(), now = new Date().toISOString(), metric = input.metric
    const assignments = Object.keys(changes).filter(field => field !== 'metric').map(field => `${editableColumns[field as keyof typeof editableColumns]} = ?`)
    const values: Array<string | number> = Object.keys(changes).filter(field => field !== 'metric').map(field => input[field as keyof typeof editableColumns]!)
    if (metric && changes.metric) {
      assignments.push('metric_name = ?', 'metric_unit = ?', 'metric_direction = ?', 'baseline_value = ?', 'baseline_source = ?', 'baseline_observed_at = ?')
      values.push(metric.name, metric.unit, metric.direction, metric.baselineValue, metric.baselineSource, metric.baselineObservedAt)
    }
    const [updated] = await this.db.batch([
      this.db.prepare(`UPDATE actions SET ${assignments.join(', ')}, version = version + 1, last_event_id = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND version = ? AND state IN ('planned','in_progress','ready_for_review')`)
        .bind(...values, eventId, now, actionId, workspaceId, current.version),
      this.db.prepare("INSERT INTO action_events (id, action_id, kind, from_state, to_state, note, changes_json, operator_id, created_at) SELECT ?, id, 'edited', state, state, NULL, ?, ?, ? FROM actions WHERE id = ? AND last_event_id = ?")
        .bind(eventId, this.eventDetails(changes), operatorId, now, actionId, eventId),
      this.audit(workspaceId, actionId, eventId, operatorId, 'action.edited', { fields: Object.keys(changes).length }),
    ])
    if (!updated.meta.changes) throw new ConflictError('This action changed since you opened it. Reload it and edit again.')
  }

  async transition(workspaceId: string, operatorId: string, actionId: string, to: ActionState, note?: string, expectedVersion?: number) {
    const current = await this.row(workspaceId, actionId)
    if (!legalTransitions[current.state].includes(to)) {
      const allowed = legalTransitions[current.state].map(state => stateLabels[state])
      throw new ConflictError(`An action that is ${stateLabels[current.state]} cannot move to ${stateLabels[to]}.${allowed.length ? ` It can move to ${allowed.join(' or ')}.` : ' A closed action stays closed.'}`)
    }
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new ConflictError('This action changed since you opened it. Reload it and try again.')
    const eventId = ulid(), now = new Date().toISOString()
    // The only statement in Pencil that writes a verdict: an operator's move to effective or ineffective.
    const [updated] = await this.db.batch([
      this.db.prepare(`UPDATE actions SET state = ?1, verdict = CASE WHEN ?1 IN ('effective','ineffective') THEN ?1 ELSE verdict END, version = version + 1, last_event_id = ?2, updated_at = ?3
        WHERE id = ?4 AND workspace_id = ?5 AND state = ?6 AND version = ?7`).bind(to, eventId, now, actionId, workspaceId, current.state, current.version),
      this.db.prepare("INSERT INTO action_events (id, action_id, kind, from_state, to_state, note, changes_json, operator_id, created_at) SELECT ?, id, 'transition', ?, state, ?, ?, ?, ? FROM actions WHERE id = ? AND last_event_id = ?")
        .bind(eventId, current.state, note?.trim() || null, this.eventDetails(), operatorId, now, actionId, eventId),
      this.audit(workspaceId, actionId, eventId, operatorId, to === 'effective' || to === 'ineffective' ? 'action.verdict_recorded' : 'action.state_changed', { actions: 1 }),
    ])
    if (!updated.meta.changes) throw new ConflictError('This action changed since you opened it. Reload it and try again.')
  }

  async measure(workspaceId: string, operatorId: string, actionId: string, input: { flowId: string; revisionId?: string; observedValue: number; unit: string; observedAt: string }, expectedVersion?: number) {
    const current = await this.row(workspaceId, actionId)
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new ConflictError('This action changed since you opened it. Reload it and try again.')
    if (current.state === 'closed') throw new ConflictError('A closed action keeps its measurements as they were.')
    if (!sameUnit(current.metricUnit, input.unit)) throw new ValidationError(`Record the observed value in ${current.metricUnit}, the unit of the baseline, so the two can be compared.`)
    const flow = await this.db.prepare('SELECT id FROM flows WHERE id = ? AND workspace_id = ?').bind(input.flowId, workspaceId).first()
    if (!flow) throw new NotFoundError('This flow is not in your workspace.')
    if (input.revisionId && !await this.db.prepare("SELECT id FROM flow_revisions WHERE id = ? AND flow_id = ? AND state = 'published'").bind(input.revisionId, input.flowId).first()) {
      throw new NotFoundError('This published revision is not part of the selected flow.')
    }
    const id = ulid(), eventId = id, now = new Date().toISOString()
    const [updated] = await this.db.batch([
      this.db.prepare('UPDATE actions SET last_event_id = ? WHERE id = ? AND workspace_id = ? AND version = ? AND state != ?').bind(eventId, actionId, workspaceId, current.version, 'closed'),
      this.db.prepare('INSERT INTO action_measurements (id, action_id, flow_id, revision_id, observed_value, unit, observed_at, operator_id, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? FROM actions WHERE id=? AND last_event_id=?')
        .bind(id, actionId, input.flowId, input.revisionId ?? null, input.observedValue, current.metricUnit, input.observedAt, operatorId, now, actionId, eventId),
      this.db.prepare("INSERT INTO action_events (id, action_id, kind, from_state, to_state, note, changes_json, operator_id, created_at) SELECT ?, id, 'measurement', state, state, NULL, ?, ?, ? FROM actions WHERE id = ? AND last_event_id = ?")
        .bind(eventId, this.eventDetails({ observedValue: { from: null, to: input.observedValue } }), operatorId, now, actionId, eventId),
      this.audit(workspaceId, actionId, eventId, operatorId, 'action.measurement_recorded', { measurements: 1 }),
    ])
    if (!updated.meta.changes) throw new ConflictError('This action changed since you opened it. Reload it and try again.')
    return id
  }
}
