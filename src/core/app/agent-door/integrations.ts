import { defineTool, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { nativeCall, nativeScope } from './native'
import { objectSchema, standard } from './form-context'

/** These inspection paths read retained delivery truth and never test or replay a provider. */
export function integrationTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const base = { scope: 'pencil:integrations', readOnly: true, classes: ['standard' as const], classify: standard, outputSchema: { type: 'object' }, untrusted: true }
  return [
    defineTool({ ...base, name: 'pencil.integrations.deliveries', title: 'Read integration delivery truth', description: 'Read native retained states, idempotency keys and attempt receipts. Does not send or replay.', clauses: ['INTEG-015'],
      inputSchema: objectSchema({ state: { enum: ['pending', 'confirmed', 'unknown', 'failed'] } }),
      async run(args, ctx) { const who = await scope(ctx); return { result: { deliveries: await nativeCall(() => services.webhooks.ledger.list(who.workspaceId, args as { state?: 'pending' | 'confirmed' | 'unknown' | 'failed' })) } } },
    }),
    defineTool({ ...base, name: 'pencil.integrations.webhooks', title: 'Read registered webhook endpoints', description: 'Read native endpoint state without returning signing material or contacting the endpoint.', clauses: ['INTEG-010'], inputSchema: objectSchema({}),
      async run(_args, ctx) { const who = await scope(ctx); return { result: { endpoints: await nativeCall(() => services.webhooks.endpoints.list(who.workspaceId)) } } },
    }),
    defineTool({ ...base, name: 'pencil.integrations.alerts', title: 'Read integration failure alerts', description: 'Read native webhook, task and Sheets delivery alerts without contacting a provider.', clauses: ['INTEG-015'], inputSchema: objectSchema({}),
      async run(_args, ctx) { const who = await scope(ctx); return { result: { alerts: [...await nativeCall(() => services.webhooks.endpoints.alerts(who.workspaceId)), ...await services.webhooks.ledger.taskAlerts(who.workspaceId), ...await services.webhooks.ledger.sheetAlerts(who.workspaceId)] } } },
    }),
  ]
}
