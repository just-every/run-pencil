import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { rewriteSchema } from '../../features/analysis/rewrites'
import { providerStatus } from '../../features/analysis/service'
import type { PencilServices } from '../services'
import { formContext, identifier, objectSchema, standard } from './form-context'
import { nativeActor, nativeCall, nativeScope } from './native'

/** Rewrites await one provider attempt and keep the real native proposal for an explicit decision. */
export function rewriteTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const form = formContext(db, services)
  const rewrites = (ctx: ToolContext) => services.rewrites.attributed(nativeActor(ctx))
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); return nativeCall(() => rewrites(ctx).get(who.workspaceId, who.operatorId, String(args.rewriteId))) }
  const base = { scope: 'pencil:rewrites', classes: ['standard' as const], classify: standard, untrusted: true, clauses: ['ANLY-009', 'AGENT-001'], outputSchema: { type: 'object' } }
  const input = z.object({ formId: z.string().min(1).max(256), stepId: rewriteSchema.shape.stepId, style: rewriteSchema.shape.style, context: rewriteSchema.shape.context }).strict()
  const proposal = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const draft = await form.draft(args, ctx), step = draft.steps.find(item => item.id === args.stepId && item.kind === 'question')
    if (!step) throw new ToolRefusal('not_found')
    return { draft, input: rewriteSchema.parse({ stepId: step.id, expectedVersion: draft.flow.draftVersion, source: step.prompt, style: args.style, context: args.context }) }
  }
  return [
    defineTool({ ...base, name: 'pencil.rewrites.request', title: 'Request a draft question rewrite', description: 'Send the current native draft question and chosen context for one provider attempt. Retains a proposal without applying it or scheduling a retry.', readOnly: false, classes: ['standard', 'external'],
      inputSchema: z.toJSONSchema(input, { io: 'input' }) as JsonSchemaObject,
      async target(args, ctx) { return { kind: 'flow', id: (await proposal(args, ctx)).draft.flow.id } },
      revisionType: 'string', async revision(args, ctx) { const value = await proposal(args, ctx); return JSON.stringify([value.draft.flow.draftVersion, value.input.source, providerStatus(services.analysis.provider)]) },
      async classify(args, ctx) { await proposal(args, ctx); if (services.analysis.provider.state !== 'on') throw new ToolRefusal('provider_unavailable'); return [...standard(), { class: 'external', facts: { measure: 1, counterparty: 'known' } }] },
      async summary(args, ctx) { const value = await proposal(args, ctx); return { target: { id: value.draft.flow.id, name: value.draft.flow.title }, items: [JSON.stringify(value.input), JSON.stringify(providerStatus(services.analysis.provider))] } },
      async run(args, ctx) { const who = await scope(ctx), value = await proposal(args, ctx), expectedVersion = await form.version(args, ctx); const result = await nativeCall(() => rewrites(ctx).request(who.workspaceId, who.operatorId, value.draft.flow.id, { ...value.input, expectedVersion })); await services.audit.record({ workspaceId: who.workspaceId, actorOperatorId: who.operatorId, kind: 'agent.rewrite.requested', subjectType: 'flow', subjectId: value.draft.flow.id, details: nativeActor(ctx) }); return { result } },
    }),
    defineTool({ ...base, name: 'pencil.rewrites.read', title: 'Read a native draft proposal', description: 'Read only the admitted native person’s retained rewrite proposal and provider outcome.', readOnly: true, inputSchema: objectSchema({ rewriteId: identifier }, ['rewriteId']),
      async run(args, ctx) { return { result: await saved(args, ctx) } },
    }),
    defineTool({ ...base, name: 'pencil.rewrites.decide', title: 'Apply or reject a draft proposal', description: 'Apply the retained proposal only while its exact source and native draft version remain current, or reject it. Does not contact the provider.', readOnly: false, inputSchema: objectSchema({ rewriteId: identifier, accept: { type: 'boolean' } }, ['rewriteId', 'accept']),
      async target(args, ctx) { return { kind: 'flow', id: (await saved(args, ctx)).flowId } },
      revisionType: 'string', async revision(args, ctx) { const record = await saved(args, ctx), who = await scope(ctx); const draft = await nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, record.flowId)); return `${record.state}:${record.draftVersion}:${draft.flow.draftVersion}` },
      async summary(args, ctx) { const record = await saved(args, ctx); return { target: { id: record.flowId }, items: [args.accept ? 'Apply proposal' : 'Reject proposal', record.source, record.proposal ?? ''] } },
      async run(args, ctx) { const who = await scope(ctx), record = await saved(args, ctx); await nativeCall(() => rewrites(ctx).decide(who.workspaceId, who.operatorId, record.id, Boolean(args.accept))); ctx.emit('form.draft-changed', `pencil://forms/${record.flowId}`); return { result: await saved(args, ctx), resources: [{ uri: `pencil://forms/${record.flowId}`, name: 'Native form draft' }] } },
    }),
  ]
}
