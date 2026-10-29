import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { createActionSchema, editActionSchema, measurementSchema, transitionSchema } from '../../features/actions/model'
import { freezeEvidence } from '../../features/actions/evidence'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Native action records stay separate from provider task delivery and personal verdicts. */
export function actionTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const records = (ctx: ToolContext) => services.actions.records.attributed(nativeActor(ctx))
  const versions = new WeakMap<Record<string, unknown>, number>()
  const prepared = new WeakMap<Record<string, unknown>, { figures: Awaited<ReturnType<typeof freezeEvidence>>; owner: string; analysis: string | null }>()
  const evidence = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx), input = createActionSchema.parse(args)
    const owner = (await services.auth.listOperators(who.workspaceId)).find(person => person.id === input.ownerOperatorId)
    if (!owner) throw new ToolRefusal('not_found')
    const figures = await nativeCall(() => freezeEvidence(services.flows, services.reporting, who.workspaceId, input.evidence))
    let analysisId: string | null = null
    if (input.analysisId) { const analysis = await nativeCall(() => services.analysis.records.detail(who.workspaceId, input.analysisId!)); if (!analysis.recommendation || analysis.flowId !== input.evidence.flowId || analysis.revisionId !== input.evidence.revisionId) throw new ToolRefusal('invalid_arguments'); analysisId = analysis.id }
    const value = { figures, owner: owner.displayName, analysis: analysisId }
    if (!prepared.has(args)) prepared.set(args, value)
    return value
  }
  const revision = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')
  const linked = (result: {id: string}) => ({ result, resources: [{ uri: `pencil://actions/${result.id}`, name: 'Accountable action' }] })
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx), value = await nativeCall(() => records(ctx).get(who.workspaceId, String(args.actionId)))
    if (!versions.has(args)) versions.set(args, value.version)
    return value
  }
  const withId = (value: z.ZodObject) => value.extend({ actionId: z.string().min(1).max(256) }).strict()
  const readInput = objectSchema({ actionId: identifier }, ['actionId'])
  const base = { scope: 'pencil:actions', classes: ['standard' as const], classify: standard, untrusted: true, outputSchema: { type: 'object' } }
  const write = (verb: string, title: string, input: z.ZodObject, clauses: string[], run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>) => defineTool({
    ...base, name: `pencil.actions.${verb}`, title, description: title, readOnly: false, clauses,
    inputSchema: z.toJSONSchema(input, { io: 'input' }) as JsonSchemaObject,
    async target(args, ctx) { return { kind: 'action', id: (await saved(args, ctx)).id } },
    async revision(args, ctx) { return (await saved(args, ctx)).version },
    async classify(args, ctx) { await saved(args, ctx); return standard() },
    async summary(args, ctx) { const current = await saved(args, ctx); return { target: { id: current.id, name: current.title }, items: [title, JSON.stringify(args)] } },
    async run(args, ctx) { await saved(args, ctx); const result = await nativeCall(() => run(args, ctx)); const actionId = String(args.actionId); ctx.emit('action.changed', `pencil://actions/${actionId}`); return { result, resources: [{ uri: `pencil://actions/${actionId}`, name: 'Accountable action' }] } },
  })
  return [
    defineTool({ ...base, name: 'pencil.actions.read', title: 'Read an accountable action', description: 'Read the real action, evidence, measurements and attributed history without contacting its task provider.', readOnly: true, clauses: ['ACT-001', 'ACT-002', 'ACT-007'], inputSchema: readInput,
      async run(args, ctx) { return linked(await saved(args, ctx)) },
    }),
    defineTool({ ...base, name: 'pencil.actions.create', title: 'Prepare accountable work', description: 'Create the native planned action with current server-frozen evidence. Does not send a task or record a personal verdict.', readOnly: false, clauses: ['ACT-001', 'ACT-003', 'ACT-008'],
      inputSchema: z.toJSONSchema(createActionSchema, { io: 'input' }) as JsonSchemaObject,
      revisionType: 'string', async revision(args, ctx) { return revision(await evidence(args, ctx)) },
      async classify(args, ctx) { await evidence(args, ctx); return standard() },
      async summary(args, ctx) { const input = createActionSchema.parse(args), value = await evidence(args, ctx); return { target: { name: input.title }, items: [value.owner, input.reviewDate, input.rationale, JSON.stringify(input.metric), JSON.stringify(value.figures)] } },
      async run(args, ctx) {
        const who = await scope(ctx), input = createActionSchema.parse(args), current = await evidence(args, ctx), value = prepared.get(args)!
        if (await revision(current) !== await revision(value)) throw new ToolRefusal('revision_conflict')
        const id = await nativeCall(() => records(ctx).create(who.workspaceId, who.operatorId, input, value.figures))
        ctx.emit('action.changed', `pencil://actions/${id}`)
        return linked(await records(ctx).get(who.workspaceId, id))
      },
    }),
    write('edit', 'Edit planned accountable work', withId(editActionSchema.omit({ expectedVersion: true })), ['ACT-001', 'ACT-003'], async (args, ctx) => {
      const who = await scope(ctx), { actionId: _id, ...input } = args
      await records(ctx).edit(who.workspaceId, who.operatorId, String(args.actionId), editActionSchema.parse({ ...input, expectedVersion: versions.get(args)! }))
      return records(ctx).get(who.workspaceId, String(args.actionId))
    }),
    write('transition', 'Move work to its next native state', withId(transitionSchema.omit({ expectedVersion: true }).extend({ to: z.enum(['in_progress', 'ready_for_review', 'closed']) })), ['ACT-002', 'ACT-005'], async (args, ctx) => {
      const who = await scope(ctx), input = transitionSchema.parse({ to: args.to, note: args.note, expectedVersion: versions.get(args)! })
      await records(ctx).transition(who.workspaceId, who.operatorId, String(args.actionId), input.to, input.note, input.expectedVersion)
      return records(ctx).get(who.workspaceId, String(args.actionId))
    }),
    write('measure', 'Record a comparable action measurement', withId(measurementSchema), ['ACT-006', 'ACT-007'], async (args, ctx) => {
      const who = await scope(ctx), { actionId: _id, ...input } = args
      await records(ctx).measure(who.workspaceId, who.operatorId, String(args.actionId), measurementSchema.parse(input), versions.get(args)!)
      return records(ctx).get(who.workspaceId, String(args.actionId))
    }),
  ]
}
