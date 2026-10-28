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
      return { result: { forms: drafts.sort((a, b) => a.flow.id.localeCompare(b.flow.id)) } }
    },
  }
}
