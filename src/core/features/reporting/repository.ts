import type { Calculation, CalculationValue } from '../../shared/calculations'
import { formSettings, hiddenValue, type HiddenField, type ResponseContext } from '../../shared/hiddenFields'
import { choiceIdsSql, isOtherAnswer } from '../../shared/otherChoices'
import { displayCalendarDate } from '../../shared/dateFormat'
import { retainedAnswer } from './retainedAnswer'
import { aggregateRevision } from './aggregate'
import { booleanAnswer } from './answerSummary'
import { displayContactAnswer } from '../../shared/contactAnswers'
import { isContactType } from './contactReports'
import type { WorkflowFilter } from '../submissions'
import { responseScope, type ResponseSelection } from './scope'
import { type ReportStep, type ReportChoice } from './questionReport'
export type LedgerFilter = WorkflowFilter & { codeId?: string; search?: string; collectorId?: string; revisionId?: string; source?: 'direct' | 'embed' | 'invitation' | 'unknown' | 'imported'; participantStatus?: 'eligible' | 'opted-out' | 'bounced'; from?: string; to?: string; answerStepId?: string; answerValue?: string; offset?: number }
export type LedgerHiddenField = Pick<HiddenField, 'id' | 'name' | 'type'> & { value: string | number | boolean }
export type LedgerCalculation = Pick<Calculation, 'id' | 'name' | 'type'> & { value: CalculationValue }
import type { LedgerPayment } from '../../shared/payments'
export type LedgerResponse = { payment?: LedgerPayment; presentedOrder:import('../../shared/presentationOrder').PresentationOrder|null; verifiedEmail?:string;verifiedSubject?:string; calculations: LedgerCalculation[]; hiddenFields: LedgerHiddenField[]; identityMode: 'anonymous' | 'identified'; discardedParameters: number; collector: { id: string; name: string; channel: string }; omittedQuestions: Array<{ stepId: string; label: string; position: number; questionType?: string }>; participant?: { id: string; name: string | null; email: string | null }; id: string; revisionId: string; revisionNumber: number; source: string; startedAt: string | null; completedAt: string; releasedAt: string | null; state: 'released' | 'quarantined'; quarantineReason: string | null; answers: Array<{ stepId: string; label: string; position: number; questionType: string; value: unknown; displayValue: string }> }

function retainedContext(contextJson: string, settingsJson: string, participantId: string | null) {
  const context = JSON.parse(contextJson) as Partial<ResponseContext>
  const settings = formSettings(settingsJson)
  const hidden = context.hidden ?? {}
  const hiddenFields: LedgerHiddenField[] = settings.hiddenFields.flatMap(field => {
    if (!Object.hasOwn(hidden, field.id)) return []
    const value = hidden[field.id]
    if (hiddenValue(field, value) !== value) throw new Error('A retained hidden field does not match its published type.')
    return [{ id: field.id, name: field.name, type: field.type, value }]
  })
  const retained = context.calculations ?? {}
  const calculations: LedgerCalculation[] = (settings.calculations ?? []).flatMap(calculation => {
    if (!Object.hasOwn(retained, calculation.id)) return []
    const value = retained[calculation.id]
    if (value !== null && (calculation.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'string')) throw new Error('A retained calculation does not match its published type.')
    return [{ id: calculation.id, name: calculation.name, type: calculation.type, value }]
  })
  return { presentedOrder:context.presentedOrder ?? null, ...(context.verifiedEmail?{verifiedEmail:context.verifiedEmail}:{}), ...(context.verifiedSubject?{verifiedSubject:context.verifiedSubject}:{}), hiddenFields, calculations, identityMode: participantId ? 'identified' as const : context.identityMode ?? 'anonymous' as const, discardedParameters: context.discarded ?? 0 }
}

export class ReportingRepository {
  constructor(private readonly binding: D1Database) {}
  async flow(workspaceId: string, flowId: string) {
    return this.binding.prepare('SELECT id, title, slug FROM flows WHERE id = ? AND workspace_id = ?').bind(flowId, workspaceId).first<{ id: string; title: string; slug: string }>()
  }
  async revisions(flowId: string) {
    return (await this.binding.prepare("SELECT id, number, is_current AS isCurrent, form_settings_json AS settingsJson FROM flow_revisions WHERE flow_id = ? AND state = 'published' ORDER BY number DESC").bind(flowId).all<{ id: string; number: number; isCurrent: number; settingsJson: string }>()).results.map(({ settingsJson, ...revision }) => {
      const settings = formSettings(settingsJson)
      return { ...revision, hiddenFields: settings.hiddenFields.map(({ id, name, type }) => ({ id, name, type })), calculations: (settings.calculations ?? []).map(({ id, name, type }) => ({ id, name, type })) }
    })
  }
  async ledger(workspaceId: string, flowId: string, filter: LedgerFilter, cutoff: string, state: ResponseSelection = 'released', limit = 50, continuation?: { total: number; after?: { time: string; id: string } }, signal?: AbortSignal, answerFormat: 'stored' | 'export' = 'stored') {
    signal?.throwIfAborted()
    const { where, bindings } = responseScope(workspaceId, flowId, filter, cutoff, state)
    const total = continuation ? { count: continuation.total } : await this.binding.prepare(`SELECT count(*) AS count FROM responses r WHERE ${where}`).bind(...bindings).first<{ count: number }>()
    signal?.throwIfAborted()
    const pageBindings = [...bindings]
    const after = continuation?.after ? ' AND (r.completed_at < ? OR (r.completed_at = ? AND r.id < ?))' : ''
    if (continuation?.after) pageBindings.push(continuation.after.time, continuation.after.time, continuation.after.id)
    // The fixed row overhead covers identity and counters; hidden and calculation payloads add variable cost.
    const rows = (await this.binding.prepare(`WITH candidates AS (
      SELECT r.id, r.revision_id AS revisionId, revision.number AS revisionNumber, r.source, r.started_at AS startedAt,
      r.completed_at AS completedAt, r.released_at AS releasedAt, r.state, r.quarantine_reason AS quarantineReason,
      r.response_context_json AS contextJson, revision.form_settings_json AS settingsJson, r.participant_id AS participantId,
      32768 + 12 * (
        MAX(0, COALESCE(length(CAST(json_extract(r.response_context_json, '$.hidden') AS BLOB)), 2) - 2)
        + MAX(0, COALESCE(length(CAST(json_extract(revision.form_settings_json, '$.hiddenFields') AS BLOB)), 2) - 2)
        + MAX(0, COALESCE(length(CAST(json_extract(r.response_context_json, '$.calculations') AS BLOB)), 2) - 2)
        + MAX(0, COALESCE(length(CAST(json_extract(r.response_context_json, '$.presentedOrder') AS BLOB)), 2) - 2)
        + MAX(0, (SELECT length(CAST(json_group_array(json_object(
          'id', json_extract(calculation.value, '$.id'), 'name', json_extract(calculation.value, '$.name'), 'type', json_extract(calculation.value, '$.type')
        )) AS BLOB)) FROM json_each(revision.form_settings_json, '$.calculations') calculation) - 2))
      + 12 * COALESCE((SELECT SUM(length(CAST(a.value_json AS BLOB))) FROM response_answers a WHERE a.response_id = r.id),0)
      + 12 * COALESCE((SELECT SUM(length(CAST(s.prompt AS BLOB))) FROM flow_steps s WHERE s.revision_id = r.revision_id),0)
      + 12 * COALESCE((SELECT SUM(length(CAST(c.label AS BLOB))+length(CAST(c.value AS BLOB))) FROM response_answers a JOIN flow_steps s ON s.revision_id=r.revision_id AND s.stable_id=a.step_id JOIN json_each(${choiceIdsSql('a.value_json')}) j JOIN choice_options c ON c.step_id=s.id AND c.stable_id=j.value WHERE a.response_id=r.id AND s.question_type IN ('single_choice','dropdown','multiple_choice','priority')),0) AS cost
      FROM responses r JOIN flow_revisions revision ON revision.id = r.revision_id AND revision.flow_id = r.flow_id
      WHERE ${where}${after} ORDER BY r.completed_at DESC,r.id DESC LIMIT ? OFFSET ?),
      budget AS (SELECT *, SUM(cost) OVER (ORDER BY completedAt DESC,id DESC) AS bytes, ROW_NUMBER() OVER (ORDER BY completedAt DESC,id DESC) AS ordinal FROM candidates)
      SELECT id,revisionId,revisionNumber,source,startedAt,completedAt,releasedAt,state,quarantineReason,contextJson,settingsJson,participantId FROM budget WHERE bytes <= 1048576 OR ordinal = 1 ORDER BY completedAt DESC,id DESC`).bind(...pageBindings,limit,continuation ? 0 : filter.offset ?? 0).all<Omit<LedgerResponse, 'answers'> & { contextJson: string; settingsJson: string; participantId: string | null }>()).results
    signal?.throwIfAborted()
    const participants = rows.length ? (await this.binding.prepare(`SELECT r.id AS responseId, p.id, p.name_snapshot AS name, p.email_snapshot AS email FROM responses r JOIN invitation_participants p ON p.id = r.participant_id WHERE p.workspace_id = r.workspace_id AND r.id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(row => row.id)).all<{ responseId: string; id: string; name: string | null; email: string | null }>()).results : []
    signal?.throwIfAborted()
    const answers = rows.length ? (await this.binding.prepare(`SELECT a.response_id AS responseId, a.step_id AS stepId, s.prompt AS label, s.question_type AS questionType, s.position, s.question_settings_json AS settingsJson, s.required, CASE WHEN length(CAST(a.value_json AS BLOB)) <= 30002 THEN a.value_json ELSE 'null' END AS valueJson
      FROM response_answers a JOIN responses r ON r.id = a.response_id LEFT JOIN flow_steps s ON s.revision_id = r.revision_id AND s.stable_id = a.step_id
      WHERE a.response_id IN (${rows.map(() => '?').join(',')}) ORDER BY s.position`).bind(...rows.map((row) => row.id)).all<{ responseId: string; stepId: string; label: string; position: number; questionType: string; settingsJson: string | null; required: number; valueJson: string }>()).results : []
    signal?.throwIfAborted()
    const optionRows = rows.length ? (await this.binding.prepare(`WITH selected_responses AS (
      SELECT id,revision_id FROM responses WHERE id IN (${rows.map(()=>'?').join(',')})),
      selected_questions AS (SELECT DISTINCT r.revision_id,a.step_id FROM response_answers a JOIN selected_responses r ON r.id=a.response_id),
      selected_choices AS (SELECT DISTINCT r.revision_id,a.step_id,j.value FROM response_answers a JOIN selected_responses r ON r.id=a.response_id JOIN json_each(${choiceIdsSql('a.value_json')}) j)
      SELECT c.stable_id AS id, CASE WHEN picked.value IS NOT NULL THEN c.label END AS label, CASE WHEN picked.value IS NOT NULL THEN c.value END AS value, s.stable_id AS stepId,s.revision_id AS revisionId
      FROM choice_options c JOIN flow_steps s ON s.id=c.step_id JOIN selected_questions q ON q.revision_id=s.revision_id AND q.step_id=s.stable_id
      LEFT JOIN selected_choices picked ON picked.revision_id=s.revision_id AND picked.step_id=s.stable_id AND picked.value=c.stable_id`).bind(...rows.map(row=>row.id)).all<{id:string;label:string|null;value:string|null;stepId:string;revisionId:string}>()).results : []
    signal?.throwIfAborted()
    const questionRows = rows.length ? (await this.binding.prepare(`SELECT revision_id AS revisionId, stable_id AS stepId, prompt AS label, position, question_type AS questionType FROM flow_steps WHERE kind = 'question' AND revision_id IN (${[...new Set(rows.map(row => row.revisionId))].map(() => '?').join(',')}) ORDER BY position`).bind(...new Set(rows.map(row => row.revisionId))).all<{ revisionId: string; stepId: string; label: string; position: number; questionType: string }>()).results : []
    signal?.throwIfAborted()
    const optionIds = new Map<string,string[]>()
    const optionLabels = new Map<string,string>()
    const optionValues = new Map<string,string>()
    for (const option of optionRows) {
      const key = `${option.revisionId}\0${option.stepId}`
      const ids = optionIds.get(key) ?? []; ids.push(option.id); optionIds.set(key,ids)
      if (option.label !== null) optionLabels.set(`${key}\0${option.id}`,option.label)
      if (option.value !== null) optionValues.set(`${key}\0${option.id}`,option.value)
    }
    const attribution = rows.length ? (await this.binding.prepare(`SELECT rc.response_id AS responseId,c.id,c.name,c.channel FROM response_collector rc JOIN collectors c ON c.id=rc.collector_id JOIN responses r ON r.id=rc.response_id WHERE c.flow_id=r.flow_id AND rc.response_id IN (${rows.map(()=>'?').join(',')})`).bind(...rows.map(row=>row.id)).all<{responseId:string;id:string;name:string;channel:string}>()).results : []
    if(rows.some(row=>!attribution.some(item=>item.responseId===row.id)))throw new Error('A retained response is missing collector attribution.')
    const exportValue = (value: unknown, stepId: string, revisionId: string, questionType: string) => {
      if (answerFormat !== 'export' || !['single_choice', 'multiple_choice', 'dropdown', 'priority'].includes(questionType)) return value
      const choiceValue = (id: unknown) => {
        const publishedValue = optionValues.get(`${revisionId}\0${stepId}\0${String(id)}`)
        if (publishedValue === undefined) throw new Error('A retained answer is missing its published choice value')
        return publishedValue
      }
      if (isOtherAnswer(value)) return value
      return Array.isArray(value) ? value.map(choiceValue) : choiceValue(value)
    }
    const display = (value: unknown, stepId: string, revisionId: string, questionType: string, settings: Record<string, unknown>) => {
      if (isContactType(questionType)) return displayContactAnswer(questionType, value)
      if (questionType === 'date' && typeof value === 'string') return displayCalendarDate(value, settings)
      const label = (id: unknown) => {
        const label = optionLabels.get(`${revisionId}\0${stepId}\0${String(id)}`)
        if (label === undefined) throw new Error('A retained answer is missing its published choice label')
        return label
      }
      if (isOtherAnswer(value)) return value.choiceIds.map(id => `${label(id)}${id === settings.otherChoiceId ? `: ${value.otherText}` : ''}`).join('\n')
      if (['single_choice', 'multiple_choice', 'dropdown', 'priority'].includes(questionType)) return Array.isArray(value) ? value.map((id, index) => `${questionType === 'priority' ? `${index + 1}. ` : ''}${label(id)}`).join('\n') : label(value)
      if (questionType === 'yes_no') return booleanAnswer(value) ? 'Yes' : 'No'
      if (questionType === 'thumbs_rating') return booleanAnswer(value) ? 'Thumbs up' : 'Thumbs down'
      if (questionType === 'consent') {
        const accepted = booleanAnswer(value)
        if (!value || typeof value !== 'object' || !('statement' in value) || typeof value.statement !== 'string') throw new Error('Stored consent statement is missing')
        return `${accepted ? 'Accepted' : 'Declined'}\n${value.statement}`
      }
      return typeof value === 'string' ? value : JSON.stringify(value)
    }
    // PAY-001: the operator's response view shows each payment; export columns are PAY-002 and PAY-005's.
    const payments = rows.length && answerFormat === 'stored' ? (await this.binding.prepare(`SELECT response_id AS responseId, state, amount, provider_amount AS providerAmount, checkout_session_id AS checkoutSessionId, payment_intent_id AS paymentIntentId, state_changed_at AS stateChangedAt, attempt
      FROM response_payments WHERE response_id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map(row => row.id)).all<LedgerPayment & { responseId: string }>()).results : []
    return { total: total?.count ?? 0, responses: rows.map(({ contextJson, settingsJson, participantId, ...row }) => ({ ...row, ...retainedContext(contextJson, settingsJson, participantId), ...(payments.some(payment => payment.responseId === row.id) ? { payment: (({ responseId: _response, ...payment }) => payment)(payments.find(payment => payment.responseId === row.id)!) } : {}), collector: (()=>{const {responseId:_id,...collector}=attribution.find(item=>item.responseId===row.id)!;return collector})(), omittedQuestions: questionRows.filter(question => question.revisionId === row.revisionId && !answers.some(answer => answer.responseId === row.id && answer.stepId === question.stepId)).map(({ stepId, label, position, questionType }) => ({ stepId, label, position, questionType })), ...(participants.some(p => p.responseId === row.id) ? { participant: (() => { const { responseId: _responseId, ...p } = participants.find(p => p.responseId === row.id)!; return p })() } : {}), answers: answers.filter((answer) => answer.responseId === row.id).map(({ stepId, label, position, questionType, settingsJson, required, valueJson }) => { const value: unknown = JSON.parse(valueJson); retainedAnswer(questionType,value,optionIds.get(`${row.revisionId}\0${stepId}`) ?? [],JSON.parse(settingsJson ?? '{}'),Boolean(required)); return ({ stepId, label, position, questionType, value: exportValue(value, stepId, row.revisionId, questionType), displayValue: display(value, stepId, row.revisionId, questionType, JSON.parse(settingsJson ?? '{}')) }) }) })) }
  }
  async questionReport(revisionId: string) {
    const [steps, choices] = await this.binding.batch([
      this.binding.prepare(`SELECT s.revision_id AS revisionId, s.stable_id AS id, s.prompt, s.question_type AS questionType, s.question_settings_json AS settingsJson, s.position,
        COALESCE(m.reached,0) AS reached, COALESCE(m.dropped,0) AS dropped FROM flow_steps s
        LEFT JOIN revision_step_metric_counters m ON m.revision_id = s.revision_id AND m.step_stable_id = s.stable_id
        WHERE s.revision_id = ? ORDER BY s.position`).bind(revisionId),
      this.binding.prepare(`SELECT s.revision_id AS revisionId, c.stable_id AS id, c.label, s.stable_id AS stepId FROM choice_options c JOIN flow_steps s ON s.id = c.step_id WHERE s.revision_id = ? ORDER BY c.position`).bind(revisionId),
    ])
    return aggregateRevision(this.binding, revisionId, steps.results as ReportStep[], choices.results as ReportChoice[])
  }

  async revisionComparison(workspaceId: string, flowId: string, offset = 0) {
    const revisions = (await this.binding.prepare(`SELECT v.id, v.number, v.is_current AS isCurrent, COUNT(r.id) AS releasedResponses,
      32768 + 12 * COALESCE((SELECT SUM(length(CAST(s.prompt AS BLOB)) + COALESCE((SELECT SUM(length(CAST(c.label AS BLOB))+128) FROM choice_options c WHERE c.step_id=s.id),0)) FROM flow_steps s WHERE s.revision_id=v.id),0) AS bytes FROM flow_revisions v
      JOIN flows f ON f.id = v.flow_id LEFT JOIN responses r ON r.revision_id = v.id AND r.state = 'released' AND r.workspace_id = f.workspace_id AND r.flow_id = f.id
      WHERE f.id = ? AND f.workspace_id = ? AND v.state = 'published' GROUP BY v.id ORDER BY v.number DESC`).bind(flowId,workspaceId).all<{id:string;number:number;isCurrent:number;releasedResponses:number;bytes:number}>()).results
    const groups = new Map<string, { id: string; versions: Array<Awaited<ReturnType<ReportingRepository['questionReport']>>[number] & { eligibleResponses: number }> }>()
    const selected: typeof revisions = []
    let bytes = 0
    for (const revision of revisions.slice(offset)) {
      if (selected.length && (bytes + revision.bytes > 1048576 || selected.length === 8)) break
      selected.push(revision); bytes += revision.bytes
    }
    // A page contains complete revision cohorts. Even maximum-length option labels
    // cannot multiply the per-request serialization by all one hundred revisions.
    for (const revision of selected) for (const question of await this.questionReport(revision.id)) {
      if (!question.questionType) continue
      const group = groups.get(question.id) ?? { id: question.id, versions: [] }
      group.versions.push({ ...question, eligibleResponses: revision.releasedResponses }); groups.set(question.id,group)
    }
    return { revisions: selected.map(({bytes: _bytes,...revision})=>revision), revisionCount: revisions.length, offset, ...(offset + selected.length < revisions.length ? {nextOffset:offset+selected.length} : {}), questions: [...groups.values()].map(group => ({ ...group, answered: group.versions.reduce((n,q)=>n+q.answered,0), eligibleResponses: group.versions.reduce((n,q)=>n+q.eligibleResponses,0) })) }
  }
}
