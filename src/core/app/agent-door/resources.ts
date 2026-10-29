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
    name: 'pencil.workspace.read', title: 'Read form workspace', description: 'Read saved form drafts and native operator bindings. Does not start work or contact a provider.',
    scope: 'pencil:forms', readOnly: true, classes: ['standard'], clauses: ['DASH-002', 'FLOW-004'],
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
      return { result: { actions: actionDetails, submissions: submissions.map(value => value.results), forms: drafts.sort((a, b) => a.flow.id.localeCompare(b.flow.id)), providerCalls: calls.results, connections: connections.results } }
    },
  }
}
