import { z } from 'zod'
import { defineTool, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'
import { ledgerFilterSchema } from '../../features/reporting/filter'
import { deviceReport } from '../../features/reporting/devices'
import { reportTrends } from '../../features/reporting/trends'
import { crosstab } from '../../features/reporting/crosstab'
import { dimensionPattern } from '../../features/reporting/crosstabDimensions'
import { savedViewInput, dashboardInput } from '../../features/reporting/savedValidation'
import { createSavedView, savedViewDetail } from '../../features/reporting/savedService'
import { dashboardDetail, writeDashboard } from '../../features/reporting/savedDashboards'
import { listSavedViews, listDashboards, loadDashboard } from '../../features/reporting/savedRepository'
import { listReportShares } from '../../features/reporting/sharedAccess'

/** Native aggregate and saved-report paths; session-bound downloads retain their own door. */
export function reportTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const actor = async (ctx: ToolContext) => ({ ...await scope(ctx), displayName: ctx.actor.label, attribution: nativeActor(ctx) })
  const form = z.object({ formId: z.string().min(1).max(256), filter: ledgerFilterSchema.optional() }).strict()
  const schema = (input: z.ZodType) => z.toJSONSchema(input, { io: 'input' }) as JsonSchemaObject
  const base = { scope: 'pencil:results', classes: ['standard' as const], classify: standard, untrusted: true, outputSchema: { type: 'object' } }
  const read = (verb: string, title: string, clauses: string[], inputSchema: JsonSchemaObject, run: (args: Record<string, unknown>, who: Awaited<ReturnType<typeof scope>>) => Promise<unknown>) => defineTool({
    ...base, name: `pencil.results.${verb}`, title, description: title, clauses, readOnly: true, inputSchema,
    async run(args, ctx) { const who = await scope(ctx); return { result: await nativeCall(() => run(args, who)) } },
  })
  const flow = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); const value = await nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, String(args.formId))); return value.flow }
  const dashboard = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); return nativeCall(() => loadDashboard(db, who.workspaceId, String(args.dashboardId))) }
  const revisions = new WeakMap<Record<string, unknown>, string>()
  const savedDashboard = async (args: Record<string, unknown>, ctx: ToolContext) => { const saved = await dashboard(args, ctx); if (!revisions.has(args)) revisions.set(args, saved.updatedAt); return saved }
  return [
    read('devices', 'Read native device denominators', ['RSLT-004'], schema(form), async (args, who) => { const input = form.parse(args); return deviceReport(db, who.workspaceId, input.formId, ledgerFilterSchema.parse(input.filter ?? {})) }),
    read('trends', 'Read native zoned score or answer-share trends', ['RSLT-007'], objectSchema({ formId: identifier, stepId: identifier, metric: { enum: ['score', 'share'] }, unit: { enum: ['day', 'week', 'month', 'quarter'] }, minimum: { type: 'integer', minimum: 1, maximum: 1000000 }, from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, shareValue: { type: ['string', 'number', 'boolean'] }, collectorId: identifier, revisionId: identifier }, ['formId', 'stepId', 'metric', 'unit', 'from', 'to']), async (args, who) => reportTrends({ db, ...who, flowId: String(args.formId), stableStepId: String(args.stepId), metric: args.metric as 'score' | 'share', unit: args.unit as 'day' | 'week' | 'month' | 'quarter', minimum: Number(args.minimum ?? 5), from: String(args.from), to: String(args.to), cutoff: new Date().toISOString(), filter: { collectorId: args.collectorId as string | undefined, revisionId: args.revisionId as string | undefined }, ...(args.shareValue === undefined ? {} : { shareValue: args.shareValue as string | number | boolean }) })),
    read('crosstab', 'Read native crosstabs and suppression', ['RSLT-006'], schema(form.extend({ revisionId: z.string().min(1).max(256), rows: z.string().regex(dimensionPattern), columns: z.string().regex(dimensionPattern) })), async (args, who) => crosstab(db, { workspaceId: who.workspaceId, flowId: String(args.formId), revisionId: String(args.revisionId), rows: String(args.rows), columns: String(args.columns), filter: ledgerFilterSchema.parse(args.filter ?? {}) })),
    read('views', 'List native saved report views', ['RSLT-008'], objectSchema({ formId: identifier }), async (args, who) => ({ views: await listSavedViews(db, who.workspaceId, args.formId as string | undefined) })),
    read('view', 'Read a native saved report', ['RSLT-008', 'RSLT-009'], objectSchema({ viewId: identifier }, ['viewId']), async (args, who) => savedViewDetail(db, who.workspaceId, String(args.viewId))),
    defineTool({ ...base, name: 'pencil.results.save_view', title: 'Save a native report view', description: 'Freeze a published native report selection with its disclosure threshold and attributed preparer; creates no public share.', clauses: ['RSLT-008'], readOnly: false,
      inputSchema: schema(savedViewInput.safeExtend({ formId: z.string().min(1).max(256) })),
      async target(args, ctx) { return { kind: 'flow', id: (await flow(args, ctx)).id } },
      async summary(args, ctx) { const value = await flow(args, ctx); return { target: { id: value.id, name: value.title }, items: [String(args.name), String(args.revisionId), 'Private report selection'] } },
      async run(args, ctx) { const who = await actor(ctx); const { formId, ...input } = args; return { result: await nativeCall(() => createSavedView(db, who, String(formId), savedViewInput.parse(input))) } },
    }),
    read('dashboards', 'List native saved report dashboards', ['RSLT-008'], objectSchema({}), async (_args, who) => ({ dashboards: await listDashboards(db, who.workspaceId) })),
    read('dashboard', 'Read a native saved report dashboard', ['RSLT-008'], objectSchema({ dashboardId: identifier }, ['dashboardId']), async (args, who) => dashboardDetail(db, who.workspaceId, String(args.dashboardId))),
    defineTool({ ...base, name: 'pencil.results.create_dashboard', title: 'Create a native private report dashboard', description: 'Save references to native authorized report views without creating a public link.', clauses: ['RSLT-008'], readOnly: false, inputSchema: schema(dashboardInput),
      summary: args => ({ items: [String(args.name), 'Private dashboard', ...(args.viewIds as string[])] }),
      async run(args, ctx) { const who = await actor(ctx); return { result: await nativeCall(() => writeDashboard(db, who, dashboardInput.parse(args))) } },
    }),
    defineTool({ ...base, name: 'pencil.results.update_dashboard', title: 'Update a native private report dashboard', description: 'Replace the native dashboard selection at its current saved revision without changing public sharing.', clauses: ['RSLT-008'], readOnly: false, inputSchema: schema(dashboardInput.safeExtend({ dashboardId: z.string().min(1).max(256) })),
      revisionType: 'string', async revision(args, ctx) { return (await savedDashboard(args, ctx)).updatedAt },
      async target(args, ctx) { return { kind: 'report-dashboard', id: (await savedDashboard(args, ctx)).id } },
      async summary(args, ctx) { const saved = await savedDashboard(args, ctx); return { target: { id: saved.id, name: saved.name }, items: [String(args.name), ...(args.viewIds as string[])] } },
      async run(args, ctx) { const who = await actor(ctx); await savedDashboard(args, ctx); const { dashboardId, ...input } = args; return { result: await nativeCall(() => writeDashboard(db, who, dashboardInput.parse(input), String(dashboardId), revisions.get(args))) } },
    }),
    read('shares', 'Read native report-link metadata', ['RSLT-009'], objectSchema({ viewId: identifier }, ['viewId']), async (args, who) => ({ shares: await listReportShares(db, who.workspaceId, String(args.viewId)) })),
  ]
}
