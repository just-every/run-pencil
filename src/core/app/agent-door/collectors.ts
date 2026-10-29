import { z } from 'zod'
import { defineTool, ToolRefusal, type ClassAndFacts, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { collectorInput } from '../../features/collectors/model'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Collector settings are native synchronous admission changes; no invitation is sent. */
export function collectorTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = async (args: Record<string, unknown>, ctx: ToolContext) => ({ ...await nativeScope(db, services, ctx.person.id), flowId: String(args.formId) })
  const service = (ctx: ToolContext) => services.collectors.attributed(nativeActor(ctx))
  const form = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(args, ctx); return nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, who.flowId)) }
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(args, ctx); return nativeCall(() => service(ctx).get(who.workspaceId, who.flowId, String(args.collectorId))) }
  const target = async (args: Record<string, unknown>, ctx: ToolContext) => {
    try { const record = await saved(args, ctx); return { kind: 'collector', id: record.id } }
    catch (error) { if (error instanceof ToolRefusal && error.code === 'not_found') return null; throw error }
  }
  const classification = async (args: Record<string, unknown>, ctx: ToolContext, erase = false): Promise<ClassAndFacts[]> => {
    const current = await form(args, ctx)
    const risk: ClassAndFacts[] = current.flow.status === 'open'
      ? [{ class: 'external', facts: { measure: 1, counterparty: 'public' } }, { class: 'live', facts: { measure: 1, service: `pencil:${current.flow.id}` } }]
      : erase ? [] : standard()
    return erase ? [...risk, { class: 'destructive', facts: { measure: 1 } }] : risk
  }
  const input = z.object({ formId: z.string().min(1).max(256), settings: collectorInput }).strict()
  const selected = objectSchema({ formId: identifier, collectorId: identifier }, ['formId', 'collectorId'])
  const base = { scope: 'pencil:collectors', outputSchema: { type: 'object' }, untrusted: true, clauses: ['DIST-017'] }
  return [
    defineTool({ ...base, name: 'pencil.collectors.read', title: 'Read a named collector', description: 'Read native collector admission and retained response counts without sending anything.', readOnly: true, inputSchema: selected, classes: ['standard'], classify: standard,
      async run(args, ctx) { return { result: await saved(args, ctx) } },
    }),
    ...(['create', 'edit'] as const).map(verb => defineTool({ ...base, name: `pencil.collectors.${verb}`, title: `${verb === 'create' ? 'Create' : 'Edit'} a native collector`, description: 'Save the native named collection link, channel, deadline and response limit without launching deliveries.', readOnly: false,
      inputSchema: z.toJSONSchema(verb === 'create' ? input : input.extend({ collectorId: z.string().min(1).max(256) }), { io: 'input' }) as JsonSchemaObject,
      classes: ['standard', 'external', 'live'],
      ...(verb === 'edit' ? { target } : {}), revisionType: 'string' as const, async revision(args, ctx) { const who = await scope(args, ctx); const current = await form(args, ctx); return JSON.stringify([verb === 'edit' ? (await saved(args, ctx)).updatedAt : null, current.flow.status, (await services.workspace.getSettings(who.workspaceId)).timeZone]) },
      async classify(args, ctx) { return classification(args, ctx) },
      async summary(args, ctx) { const current = await form(args, ctx); const record = verb === 'edit' ? await saved(args, ctx) : null; const who = await scope(args, ctx); return { target: { id: record?.id ?? current.flow.id, name: String((args.settings as Record<string, unknown>).name) }, items: [current.flow.title, (await services.workspace.getSettings(who.workspaceId)).timeZone, JSON.stringify(args.settings)] } },
      async run(args, ctx) { const who = await scope(args, ctx), settings = collectorInput.parse(args.settings); return { result: await nativeCall(() => verb === 'create' ? service(ctx).create(who, settings) : service(ctx).update(who, String(args.collectorId), settings)) } },
    })),
    ...(['close', 'reopen'] as const).map(verb => defineTool({ ...base, name: `pencil.collectors.${verb}`, title: `${verb === 'close' ? 'Close' : 'Reopen'} a named collector`, description: 'Perform the native collector admission transition without changing form publication or sending invitations.', readOnly: false, inputSchema: selected,
      classes: ['standard', 'external', 'live'], target, revisionType: 'string' as const, async revision(args, ctx) { return (await saved(args, ctx)).updatedAt },
      async classify(args, ctx) { return classification(args, ctx) },
      async summary(args, ctx) { const record = await saved(args, ctx); return { target: { id: record.id, name: record.name }, items: [verb, record.channel, record.deadlineAt ?? 'No collector deadline', record.responseLimit === null ? 'No response limit' : String(record.responseLimit)] } },
      async run(args, ctx) { return { result: await nativeCall(async () => service(ctx).setClosed(await scope(args, ctx), String(args.collectorId), verb === 'close')) } },
    })),
    defineTool({ ...base, name: 'pencil.collectors.erase', title: 'Erase an unused named collector', description: 'Use native deletion, which refuses retained responses, sessions or invitation history; system source collectors cannot be erased.', readOnly: false, inputSchema: selected,
      classes: ['destructive', 'external', 'live'], target, revisionType: 'string', async revision(args, ctx) { return (await saved(args, ctx)).updatedAt },
      async classify(args, ctx) { return classification(args, ctx, true) },
      async summary(args, ctx) { const record = await saved(args, ctx); return { target: { id: record.id, name: record.name }, items: ['Erase unused collector', record.channel] } },
      async run(args, ctx) { await nativeCall(async () => service(ctx).erase(await scope(args, ctx), String(args.collectorId))); return { result: { erased: true } } },
    }),
  ]
}
