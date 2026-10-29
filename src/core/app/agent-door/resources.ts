import { ToolRefusal, type ResourceDefinition, type ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { nativeCall, nativeScope } from './native'

export function formResources(db: D1Database, services: PencilServices): ResourceDefinition[] {
  return [{
    uriTemplate: 'pencil://forms/{id}', name: 'Native form draft', mimeType: 'application/json', scope: 'pencil:forms', classes: ['standard'],
    classify(record) { return [{ class: 'standard', facts: { measure: record.json ? 1 : 0 } }] },
    async read(uri, ctx) {
      const match = /^pencil:\/\/forms\/([A-Za-z0-9_-]{1,256})$/.exec(uri)
      if (!match) return null
      try {
        const who = await nativeScope(db, services, ctx.person.id)
        return { json: await nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, match[1])), untrusted: true }
      } catch (error) {
        if (error instanceof ToolRefusal && error.code === 'not_found') return null
        throw error
      }
    },
  }]
}

/** The witness is a native read, including every object changed by these tools. */
export function workspaceWitness(db: D1Database, services: PencilServices): ToolDefinition {
  return {
    name: 'pencil.workspace.read', title: 'Read form workspace', description: 'Read a broad native workspace snapshot of forms, audience, workflow, actions and settings. Requires its own workspace scope and current native admission; does not start work or contact a provider.',
    scope: 'pencil:workspace', readOnly: true, classes: ['standard'], clauses: ['DASH-002', 'FLOW-004'],
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }, outputSchema: { type: 'object', required: ['forms'] },
    classify: () => [{ class: 'standard', facts: { measure: 1 } }], untrusted: true,
    async run(_args, ctx) {
      const who = await nativeScope(db, services, ctx.person.id)
      const forms = await services.flows.listDashboard(who.workspaceId)
      const drafts = await Promise.all(forms.map(form => services.flows.getBuilderDraft(who.workspaceId, form.id)))
      const calls = await db.prepare(`SELECT id,feature,provider_origin AS provider,model,outcome,error_code AS error,input_tokens,output_tokens,cost_microusd,receipt_id,created_at
        FROM analysis_calls WHERE workspace_id=? ORDER BY id`).bind(who.workspaceId).all()
      const connections = await db.prepare('SELECT kind,updated_at FROM integration_connections ORDER BY kind').all()
      const actions = await services.actions.records.list(who.workspaceId)
      const actionDetails = await Promise.all(actions.actions.map(action => services.actions.records.get(who.workspaceId, action.id)))
      const submissions = await db.batch([
        db.prepare(`SELECT s.id,s.flow_id AS formId,s.name FROM submission_statuses s JOIN flows f ON f.id=s.flow_id WHERE f.workspace_id=? ORDER BY s.id`).bind(who.workspaceId),
        db.prepare(`SELECT w.response_id AS responseId,w.status_id AS statusId,w.assignee_id AS assigneeId,w.version,w.updated_at AS updatedAt FROM submission_workflows w JOIN responses r ON r.id=w.response_id WHERE r.workspace_id=? ORDER BY w.response_id`).bind(who.workspaceId),
        db.prepare(`SELECT t.response_id AS responseId,t.tag FROM submission_tags t JOIN responses r ON r.id=t.response_id WHERE r.workspace_id=? ORDER BY t.response_id,t.tag`).bind(who.workspaceId),
      ])
      const audience = await db.batch([
        db.prepare('SELECT id,name,email,fields_json AS fields,opted_out_at AS optedOutAt,time_zone AS timeZone,mobile,sms_consent_at AS smsConsentAt,sms_stopped_at AS smsStoppedAt FROM distribution_contacts WHERE workspace_id=? ORDER BY id').bind(who.workspaceId),
        db.prepare('SELECT id,name,rules_json AS rules FROM distribution_segments WHERE workspace_id=? ORDER BY id').bind(who.workspaceId),
        db.prepare('SELECT c.id,c.flow_id AS formId,c.name,c.channel,c.public_key AS publicKey,c.deadline_at AS deadlineAt,c.response_limit AS responseLimit,c.closed_at AS closedAt,c.updated_at AS updatedAt FROM collectors c JOIN flows f ON f.id=c.flow_id WHERE f.workspace_id=? ORDER BY c.id').bind(who.workspaceId),
      ])
      const automation = await db.batch([
        db.prepare('SELECT autorun_enabled AS autorunEnabled,autorun_minimum AS autorunMinimum,disclosure_threshold AS disclosureThreshold,selection,updated_by_operator_id AS updatedBy,updated_at AS updatedAt FROM analysis_policies WHERE workspace_id=?').bind(who.workspaceId),
        db.prepare('SELECT p.operator_id AS operatorId,p.muted FROM analysis_attention_preferences p JOIN operators o ON o.id=p.operator_id WHERE o.workspace_id=? ORDER BY p.operator_id').bind(who.workspaceId),
        db.prepare('SELECT p.flow_id AS formId,p.operator_id AS operatorId,p.mode,p.updated_at AS updatedAt FROM notification_preferences p JOIN flows f ON f.id=p.flow_id WHERE f.workspace_id=? ORDER BY p.flow_id,p.operator_id').bind(who.workspaceId),
        db.prepare('SELECT p.flow_id AS formId,p.operator_id AS operatorId,p.enabled,p.epoch,p.cutoff,p.next_opening AS nextOpening,p.next_day AS nextDay,p.zone,p.window_start AS windowStart FROM digest_preferences p JOIN flows f ON f.id=p.flow_id WHERE f.workspace_id=? ORDER BY p.flow_id,p.operator_id').bind(who.workspaceId),
      ])
      const reports = await db.batch([
        db.prepare("SELECT id,label,normalized_label,created_by_operator_id,created_at FROM workspace_codes WHERE workspace_id=? ORDER BY id").bind(who.workspaceId),
        db.prepare("SELECT id,answer_id,code_id,source,actor_operator_id,quote_id,created_at FROM answer_code_assignments WHERE workspace_id=? ORDER BY id").bind(who.workspaceId),
        db.prepare("SELECT quote_id,decision,code_id,actor_operator_id,decided_at FROM code_suggestion_decisions WHERE workspace_id=? ORDER BY quote_id").bind(who.workspaceId),
        db.prepare("SELECT id,name,structure_json,created_by,created_at,retired_at FROM team_templates WHERE workspace_id=? ORDER BY id").bind(who.workspaceId),
        db.prepare("SELECT id,flow_id,revision_id,name,definition_json,cutoff,threshold,saved_by,saved_by_name,created_at FROM saved_report_views WHERE workspace_id=? ORDER BY id").bind(who.workspaceId),
        db.prepare("SELECT id,name,scope,flow_id,view_ids_json,saved_by,saved_by_name,created_at,updated_at FROM saved_report_dashboards WHERE workspace_id=? ORDER BY id").bind(who.workspaceId),
      ])
      const settings = await services.workspace.getSettings(who.workspaceId)
      const rewrites = await db.prepare('SELECT id,flow_id AS formId,step_id AS stepId,draft_version AS version,state,source,proposal FROM draft_rewrites WHERE workspace_id=? AND operator_id=? ORDER BY id').bind(who.workspaceId,who.operatorId).all()
      const retention = await db.prepare('SELECT p.flow_id AS formId,p.days,p.legal_hold AS legalHold,p.version FROM form_retention p JOIN flows f ON f.id=p.flow_id WHERE f.workspace_id=? ORDER BY p.flow_id').bind(who.workspaceId).all()
      return { result: { reports: reports.map(value => value.results), automation: automation.map(value => value.results), audience: audience.map(value => value.results), settings, rewrites: rewrites.results, retention: retention.results, actions: actionDetails, submissions: submissions.map(value => value.results), forms: drafts.sort((a, b) => a.flow.id.localeCompare(b.flow.id)), providerCalls: calls.results, connections: connections.results } }
    },
  }
}
