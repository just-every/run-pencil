import { z } from 'zod'
import { defineTool, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { policiesSchema } from '../../features/analysis/model'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Retained analysis and future business settings; no queued analysis or mail is dispatched here. */
export function analysisRecordTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const analysis = (ctx: ToolContext) => services.analysis.attributed(nativeActor(ctx))
  const preferences = (ctx: ToolContext) => services.notifications.preferences.attributed(nativeActor(ctx))
  const base = { outputSchema: { type: 'object' }, classes: ['standard' as const], classify: standard, untrusted: true }
  const policy = async (ctx: ToolContext) => analysis(ctx).records.policies((await scope(ctx)).workspaceId)
  const attention = async (ctx: ToolContext) => { const who = await scope(ctx); return services.attention.read(who.workspaceId, who.operatorId) }
  const notification = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); return nativeCall(() => preferences(ctx).read(who.workspaceId, String(args.formId), who.operatorId)) }
  const form = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); return nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, String(args.formId))) }
  const notificationRevision = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx), state = await notification(args, ctx), settings = await services.workspace.getSettings(who.workspaceId); return JSON.stringify([state.mode, settings.timeZone, settings.sendingWindowStart]) }
  return [
    defineTool({ ...base, name: 'pencil.analyses.read', title: 'Read a retained analysis', description: 'Read current native findings, withheld evidence, provenance, provider receipts and staleness without requesting a provider call.', scope: 'pencil:analyses', readOnly: true, clauses: ['ANLY-003', 'ANLY-004', 'ANLY-007', 'ANLY-010'], inputSchema: objectSchema({ runId: identifier }, ['runId']),
      async run(args, ctx) { const who = await scope(ctx), result = await nativeCall(() => analysis(ctx).records.detail(who.workspaceId, String(args.runId))); return { result, resources: [{ uri: `pencil://analyses/${result.id}`, name: 'Retained analysis' }] } },
    }),
    defineTool({ ...base, name: 'pencil.analyses.theme_responses', title: 'Read the evidence behind a visible theme', description: 'Use the native disclosure threshold and workspace fence to read the retained answers behind a visible theme. Respondent text is untrusted.', scope: 'pencil:analyses', readOnly: true, clauses: ['ANLY-004', 'ANLY-005', 'ANLY-011'], inputSchema: objectSchema({ runId: identifier, themeId: identifier }, ['runId', 'themeId']),
      async run(args, ctx) { const who = await scope(ctx); return { result: await nativeCall(() => analysis(ctx).records.themeResponses(who.workspaceId, String(args.runId), String(args.themeId))) } },
    }),
    defineTool({ ...base, name: 'pencil.analyses.policies', title: 'Read native analysis settings', description: 'Read native close-time automation, selection and disclosure settings without starting work.', scope: 'pencil:analyses', readOnly: true, clauses: ['ANLY-005', 'ANLY-015'], inputSchema: objectSchema({}), async run(_args, ctx) { return { result: await policy(ctx) } } }),
    defineTool({ ...base, name: 'pencil.analyses.configure', title: 'Save native analysis settings', description: 'Save native analysis settings. A changed disclosure threshold changes record visibility and is classified from the current native policy. Does not request, retry or resume an analysis.', scope: 'pencil:analyses', readOnly: false, classes: ['standard', 'access'], clauses: ['ANLY-005', 'ANLY-015'], inputSchema: z.toJSONSchema(policiesSchema, { io: 'input' }) as JsonSchemaObject,
      revisionType: 'string', async revision(_args, ctx) { return JSON.stringify(await policy(ctx)) },
      async authority() { return null },
      async classify(args, ctx) { const current = await policy(ctx), input = policiesSchema.parse(args); return input.disclosureThreshold === current.disclosureThreshold ? standard() : [{ class: 'access', facts: { measure: 1, direction: input.disclosureThreshold < current.disclosureThreshold ? 'widens' : 'narrows' } }] },
      async summary(args, ctx) { const current = await policy(ctx), input = policiesSchema.parse(args); return { target: { name: 'Workspace analysis settings' }, items: [`Close-time analysis: ${input.autorunEnabled ? 'enabled' : 'disabled'}`, `Minimum responses: ${input.autorunMinimum}`, `Disclosure threshold: ${current.disclosureThreshold} → ${input.disclosureThreshold}`, input.selection] } },
      async run(args, ctx) { const who = await scope(ctx); await nativeCall(() => analysis(ctx).setPolicies(who.workspaceId, who.operatorId, policiesSchema.parse(args))); return { result: await policy(ctx) } },
    }),
    defineTool({ ...base, name: 'pencil.analyses.attention', title: 'Read native analysis attention', description: 'Read the sponsor’s real completed and failed analysis notices without marking a person as having read them.', scope: 'pencil:analyses', readOnly: true, clauses: ['NOTIFY-001'], inputSchema: objectSchema({}), async run(_args, ctx) { return { result: await attention(ctx) } } }),
    defineTool({ ...base, name: 'pencil.analyses.configure_attention', title: 'Configure future analysis attention', description: 'Change whether native automatic analyses create future in-app notices for this sponsor. Does not acknowledge a notice as a person’s reading.', scope: 'pencil:analyses', readOnly: false, clauses: ['NOTIFY-001'], inputSchema: objectSchema({ muted: { type: 'boolean' } }, ['muted']),
      revisionType: 'string', async revision(_args, ctx) { return JSON.stringify({ muted: (await attention(ctx)).muted }) },
      async summary(args, ctx) { await scope(ctx); return { target: { id: ctx.person.id, name: ctx.person.name }, items: [args.muted ? 'Mute future automatic analysis notices' : 'Enable future automatic analysis notices'] } },
      async run(args, ctx) { const who = await scope(ctx); await services.attention.attributed(nativeActor(ctx)).mute(who.operatorId, Boolean(args.muted)); return { result: await attention(ctx) } },
    }),
    defineTool({ ...base, name: 'pencil.notifications.read', title: 'Read native form notification settings', description: 'Read this sponsor’s notification preference and retained delivery truth without sending or replaying mail.', scope: 'pencil:notifications', readOnly: true, clauses: ['NOTIFY-002', 'NOTIFY-003'], inputSchema: objectSchema({ formId: identifier }, ['formId']), async run(args, ctx) { return { result: await notification(args, ctx) } } }),
    defineTool({ ...base, name: 'pencil.notifications.configure', title: 'Configure future form notifications', description: 'Save the sponsor’s native Immediately, Daily or Off setting. Existing cancelled work remains cancelled; no mail is sent by this call.', scope: 'pencil:notifications', readOnly: false, clauses: ['NOTIFY-002', 'NOTIFY-003'], inputSchema: objectSchema({ formId: identifier, mode: { enum: ['immediately', 'daily', 'off'] } }, ['formId', 'mode']),
      revisionType: 'string', revision: notificationRevision,
      async target(args, ctx) { return { kind: 'flow', id: (await form(args, ctx)).flow.id } },
      async summary(args, ctx) { const current = await form(args, ctx), who = await scope(ctx), settings = await services.workspace.getSettings(who.workspaceId); return { target: { id: current.flow.id, name: current.flow.title }, recipients: [ctx.person.email], items: [String(args.mode), settings.timeZone, settings.sendingWindowStart] } },
      async run(args, ctx) { const who = await scope(ctx); return { result: await nativeCall(() => preferences(ctx).set(who.workspaceId, String(args.formId), who.operatorId, args.mode as 'immediately' | 'daily' | 'off')) } },
    }),
    defineTool({ ...base, name: 'pencil.notifications.alerts', title: 'Read native answer alert delivery truth', description: 'Read the sponsor’s native rule-based notices and current delivery states without acknowledging them as read or queueing a replay.', scope: 'pencil:notifications', readOnly: true, clauses: ['NOTIFY-005'], inputSchema: objectSchema({ formId: identifier }),
      async run(args, ctx) { const who = await scope(ctx); return { result: await services.notifications.answerAlerts.read(who.workspaceId, who.operatorId, typeof args.formId === 'string' ? args.formId : undefined) } },
    }),
  ]
}
