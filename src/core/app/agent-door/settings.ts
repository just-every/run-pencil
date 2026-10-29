import { defineTool, type ClassAndFacts, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { normalizeEmbedOrigins } from '../../features/workspace/settings-input'
import { nativeActor, nativeCall, nativeScope } from './native'
import { objectSchema, standard } from './form-context'

const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')

/** These native business settings change synchronously; later business automation keeps its own identity. */
export function settingTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const current = async (ctx: ToolContext) => services.workspace.getSettings((await scope(ctx)).workspaceId)
  const base = { scope: 'pencil:settings', readOnly: false, untrusted: true, outputSchema: { type: 'object' } }
  const target = async (_args: Record<string, unknown>, ctx: ToolContext) => ({ kind: 'workspace', id: (await current(ctx)).id })
  const revision = async (_args: Record<string, unknown>, ctx: ToolContext) => digest(await current(ctx))
  const audit = async (ctx: ToolContext) => { const who = await scope(ctx); await services.audit.record({ workspaceId: who.workspaceId, actorOperatorId: who.operatorId, kind: 'agent.workspace.updated', subjectType: 'workspace', subjectId: who.workspaceId, details: nativeActor(ctx) }) }
  return [
    defineTool({ ...base, name: 'pencil.settings.update', title: 'Update business sending settings', description: 'Save the native workspace time zone, sending window and reminder delay. Does not start or send queued work.', clauses: ['WS-001', 'WS-002', 'DIST-005'], classes: ['standard'], classify: standard,
      inputSchema: objectSchema({ timeZone: { type: 'string', minLength: 1, maxLength: 100 }, sendingWindowStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }, sendingWindowEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' }, reminderDelayHours: { type: 'number', minimum: 0, maximum: 8760 } }, ['timeZone', 'sendingWindowStart', 'sendingWindowEnd']),
      target, revisionType: 'string', revision,
      async summary(args, ctx) { const saved = await current(ctx); return { target: { id: saved.id, name: saved.name }, items: [JSON.stringify({ timeZone: args.timeZone, sendingWindowStart: args.sendingWindowStart, sendingWindowEnd: args.sendingWindowEnd, reminderDelayHours: args.reminderDelayHours ?? saved.reminderDelayHours })] } },
      async run(args, ctx) { const who = await scope(ctx); const result = await nativeCall(() => services.workspace.updateSettings({ workspaceId: who.workspaceId, timeZone: String(args.timeZone), sendingWindowStart: String(args.sendingWindowStart), sendingWindowEnd: String(args.sendingWindowEnd), ...(typeof args.reminderDelayHours === 'number' ? { reminderDelayHours: args.reminderDelayHours } : {}) })); await audit(ctx); return { result } },
    }),
    defineTool({ ...base, name: 'pencil.settings.embedding', title: 'Change permitted embed origins', description: 'Save the native installation’s exact allowed embed hosts. This changes form visibility but no person, agent, role or standing grant.', clauses: ['DIST-002'], classes: ['standard', 'external', 'access', 'live'],
      inputSchema: objectSchema({ origins: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 300 } } }, ['origins']), target, revisionType: 'string', revision,
      async authority() { return null },
      async classify(args, ctx): Promise<ClassAndFacts[]> {
        const saved = await current(ctx), origins = await nativeCall(async () => normalizeEmbedOrigins(args.origins as string[])), added = origins.filter(value => !saved.embedAllowedOrigins.includes(value)), removed = saved.embedAllowedOrigins.filter(value => !origins.includes(value))
        return !added.length && !removed.length ? standard() : [...(added.length ? [{ class: 'external' as const, facts: { measure: added.length, counterparty: 'new' as const } }] : []), { class: 'access', facts: { measure: added.length + removed.length, direction: added.length ? 'widens' : 'narrows' } }, { class: 'live', facts: { measure: 1, service: `pencil:${saved.id}` } }]
      },
      async summary(args, ctx) { const saved = await current(ctx); return { target: { id: saved.id, name: saved.name }, items: [JSON.stringify({ previousOrigins: saved.embedAllowedOrigins, origins: args.origins })] } },
      async run(args, ctx) { const who = await scope(ctx), saved = await current(ctx); const result = await nativeCall(() => services.workspace.updateSettings({ workspaceId: who.workspaceId, timeZone: saved.timeZone, sendingWindowStart: saved.sendingWindowStart, sendingWindowEnd: saved.sendingWindowEnd, embedAllowedOrigins: args.origins as string[] })); await audit(ctx); return { result } },
    }),
  ]
}
