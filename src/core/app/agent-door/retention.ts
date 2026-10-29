import { defineTool, ToolRefusal, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { ForbiddenError } from '../../shared/errors'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema } from './form-context'

export function retentionTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const owner = async (ctx: ToolContext) => { const who = await nativeScope(db, services, ctx.person.id); if (ctx.person.role !== 'owner') throw new ToolRefusal('forbidden'); return who }
  const versions = new WeakMap<Record<string, unknown>, number>()
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => { const value = await nativeCall(async () => services.retention.read((await owner(ctx)).workspaceId, String(args.formId))); if (!versions.has(args)) versions.set(args, value.version); return value }
  const base = { scope: 'pencil:retention', untrusted: true, clauses: ['GOV-003'], outputSchema: { type: 'object' } }
  return [
    defineTool({ ...base, name: 'pencil.retention.read', title: 'Read native retention and legal hold', description: 'Read the real owner-only policy and deletion notices without changing records or schedules.', readOnly: true, classes: ['standard'], inputSchema: objectSchema({ formId: identifier }, ['formId']),
      async classify(args, ctx) { await saved(args, ctx); return [{ class: 'standard', facts: { measure: 1 } }] },
      async run(args, ctx) { return { result: await saved(args, ctx) } },
    }),
    defineTool({ ...base, name: 'pencil.retention.configure', title: 'Configure native business retention', description: 'Save the current native retention policy as the owner with explicit automatic-deletion intent when required by the native service. The ordinary business runner creates its full notice and grace period; this tool never executes scheduled deletion.', readOnly: false, classes: ['standard', 'destructive'],
      inputSchema: objectSchema({ formId: identifier, days: { anyOf: [{ type: 'integer', minimum: 1, maximum: 36500 }, { type: 'null' }] }, legalHold: { type: 'boolean' }, confirmAutomaticDeletion: { type: 'boolean' } }, ['formId', 'days', 'legalHold', 'confirmAutomaticDeletion']),
      async target(args, ctx) { return { kind: 'flow', id: (await saved(args, ctx)).flowId } },
      async revision(args, ctx) { return (await saved(args, ctx)).version },
      async classify(args, ctx) { await saved(args, ctx); return [{ class: args.days !== null && args.legalHold !== true ? 'destructive' : 'standard', facts: { measure: 1 } }] },
      async summary(args, ctx) { const current = await saved(args, ctx); return { target: { id: current.flowId }, items: [JSON.stringify({ previous: { days: current.days, legalHold: current.legalHold }, days: args.days, legalHold: args.legalHold, confirmAutomaticDeletion: args.confirmAutomaticDeletion }), 'Native seven-day notice and deletion grace remain in force'] } },
      async run(args, ctx) { const who = await owner(ctx), current = await saved(args, ctx), now = new Date().toISOString(); const result = await nativeCall(async () => { try { return await services.retention.attributed(nativeActor(ctx)).configure(who.workspaceId, who.operatorId, { flowId: current.flowId, days: args.days as number | null, legalHold: Boolean(args.legalHold), version: versions.get(args)!, confirmAutomaticDeletion: args.confirmAutomaticDeletion === true }, now) } catch(error) { if(error instanceof ForbiddenError)throw new ToolRefusal('forbidden'); throw error } }); return { result } },
    }),
  ]
}
