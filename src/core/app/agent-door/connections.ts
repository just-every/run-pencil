import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { analysisConnectionSchema, taskConnectionSchema } from '../../platform/config/connections'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { objectSchema } from './form-context'

/** Connection changes use the same current owner admission as the person routes. */
export function connectionTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const owner = async (ctx: ToolContext) => {
    const who = await nativeScope(db, services, ctx.person.id)
    if (ctx.person.role !== 'owner') throw new ToolRefusal('forbidden')
    return who
  }
  return (['analysis', 'task'] as const).flatMap(kind => {
    const input = kind === 'analysis' ? analysisConnectionSchema : taskConnectionSchema
    const status = async (): Promise<unknown> => kind === 'analysis' ? services.connections.analysisStatus() : services.connections.taskStatus()
    const effect = { kind: 'record' as const, justification: `Save or remove the installation's encrypted ${kind} connection. This changes no native person, agent, role, grant or standing authority.` }
    const base = {
      scope: 'pencil:connections', classes: ['security' as const], clauses: ['WS-003', 'GOV-005'],
      readOnly: false, authority: 'none' as const, effect, outputSchema: { type: 'object' },
      async target(_args: Record<string, unknown>, ctx: ToolContext) { await owner(ctx); return { kind: 'connection', id: kind } },
      async classify(_args: Record<string, unknown>, ctx: ToolContext) { await owner(ctx); return [{ class: 'security' as const, facts: { measure: 1 } }] },
    }
    const audit = async (ctx: ToolContext, verb: string) => {
      const who = await owner(ctx)
      await services.audit.record({ workspaceId: who.workspaceId, actorOperatorId: who.operatorId,
        kind: `connection.${verb}`, subjectType: 'connection', subjectId: kind,
        details: { connection: kind, ...nativeActor(ctx) } })
    }
    return [
      defineTool({ name: `pencil.connections.read_${kind}`, title: `Read ${kind} connection status`,
        description: 'Read native readiness without returning a credential or contacting a provider.',
        scope: 'pencil:connections', readOnly: true, classes: ['standard'], clauses: ['WS-003'],
        inputSchema: objectSchema({}), outputSchema: { type: 'object' },
        async classify(_args, ctx) { await nativeScope(db, services, ctx.person.id); return [{ class: 'standard', facts: { measure: 1 } }] },
        async run(_args, ctx) { await nativeScope(db, services, ctx.person.id); return { result: await nativeCall(status) } },
      }),
      defineTool({ ...base, name: `pencil.connections.configure_${kind}`, title: `Configure ${kind}`,
        description: 'Save the native encrypted connection as the current installation owner. Does not test the provider or grant authority.',
        inputSchema: z.toJSONSchema(input, { io: 'input' }) as JsonSchemaObject,
        async summary(args, ctx) {
          await owner(ctx)
          // Secrets stay out of summaries, resources, events and returned results.
          const address = new URL(String(kind === 'analysis' ? args.baseUrl : args.url))
          return { target: { id: kind, name: `${kind} provider connection` }, items: [address.origin, ...(kind === 'analysis' ? [String(args.provider), String(args.model)] : [])] }
        },
        async run(args, ctx) {
          await owner(ctx)
          await nativeCall(() => kind === 'analysis'
            ? services.connections.saveAnalysis(analysisConnectionSchema.parse(args))
            : services.connections.saveTask(taskConnectionSchema.parse(args)))
          await audit(ctx, 'saved')
          return { result: await status() }
        },
      }),
      defineTool({ ...base, name: `pencil.connections.remove_${kind}`, title: `Remove ${kind} connection`,
        description: 'Remove the saved native connection as its owner; deployment configuration retains its original purpose.',
        inputSchema: objectSchema({}),
        async summary(_args, ctx) { await owner(ctx); return { target: { id: kind, name: `${kind} provider connection` }, items: ['Remove saved connection'] } },
        async run(_args, ctx) { await owner(ctx); await services.connections.remove(kind); await audit(ctx, 'removed'); return { result: await status() } },
      }),
    ]
  })
}
