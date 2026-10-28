import { defineTool, type ToolDefinition, type ClassAndFacts } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { formContext, identifier as id, objectSchema as schema } from './form-context'
import { nativeCall } from './native'

export function formLifecycleTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const native = formContext(db, services)
  const live = (formId: string): ClassAndFacts[] => [{ class: 'external', facts: { measure: 1, counterparty: 'public' } }, { class: 'live', facts: { measure: 1, service: `pencil:${formId}` } }]
  const tools = (['publish', 'close', 'reopen', 'archive'] as const).map((verb): ToolDefinition => defineTool({
    name: `pencil.forms.${verb}`, title: `${verb[0].toUpperCase() + verb.slice(1)} a form`, description: `Perform the native ${verb} transition at its current saved version.`,
    scope: 'pencil:forms', readOnly: false, untrusted: true, clauses: verb === 'publish' ? ['FLOW-008'] : ['FLOW-010'],
    inputSchema: schema({ formId: id }, ['formId']), outputSchema: { type: 'object' },
    classes: verb === 'archive' ? ['standard', 'external', 'live'] : ['external', 'live'],
    revisionType: 'string', async revision(args, ctx) { const { flow } = await native.draft(args, ctx); return `${flow.draftVersion}:${flow.status}` },
    async classify(args, ctx) { const { flow } = await native.draft(args, ctx); return verb === 'archive' && flow.status === 'draft' ? [{ class: 'standard', facts: { measure: 1 } }] : live(flow.id) },
    async summary(args, ctx) { const saved = await native.draft(args, ctx); return { target: { id: saved.flow.id, name: saved.flow.title }, items: [verb, `Draft ${saved.flow.draftVersion}`, ...saved.steps.map(step => step.prompt)] } },
    async run(args, ctx) {
      const who = await native.scope(ctx), flowId = String(args.formId), expectedVersion = await native.version(args, ctx)
      const flows = native.flows(ctx)
      await nativeCall(async () => {
        if (verb === 'publish') return flows.publishDraft({ ...who, flowId, expectedVersion })
        if (verb === 'close') return flows.closeFlow(who.workspaceId, flowId, who.operatorId, expectedVersion)
        if (verb === 'reopen') return flows.reopenFlow(who.workspaceId, flowId, who.operatorId, expectedVersion)
        return flows.archiveFlow(who.workspaceId, flowId, who.operatorId, expectedVersion)
      })
      const saved = await native.draft(args, ctx)
      ctx.emit(verb === 'publish' ? 'form.published' : verb === 'close' ? 'form.closed' : 'form.changed', `pencil://forms/${flowId}`)
      return { result: saved, resources: [{ uri: `pencil://forms/${flowId}`, name: 'Form' }] }
    },
  }))
  return [...tools, defineTool({ name: 'pencil.results.read', title: 'Read native form results', description: 'Read the current published revision summary without starting work.', scope: 'pencil:forms', readOnly: true, untrusted: true,
    clauses: ['RSLT-001'], inputSchema: schema({ formId: id }, ['formId']), outputSchema: { type: 'object' }, classes: ['standard'],
    async classify(args, ctx) { await native.draft(args, ctx); return [{ class: 'standard', facts: { measure: 1 } }] },
    async run(args, ctx) { const who = await native.scope(ctx); return { result: await nativeCall(() => services.flows.getFlowResults(who.workspaceId, String(args.formId))) } },
  })]
}
