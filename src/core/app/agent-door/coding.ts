import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { listCodes, createCode, workspaceCode } from '../../features/coding/catalog'
import { listAnswers, retainedAnswer } from '../../features/coding/answers'
import { assignManually, removeAssignment } from '../../features/coding/assignments'
import { suggestions, decideSuggestion, codingSuggestion } from '../../features/coding/suggestions'
import { codingCounts, codingCrosstab } from '../../features/coding/metrics'
import { ledgerFilterSchema } from '../../features/reporting/filter'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Workspace coding uses the same retained-answer fences as the native screen. */
export function codingTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const form = z.object({ formId: z.string().min(1).max(256), filter: ledgerFilterSchema.optional(), after: z.string().min(1).max(256).optional() }).strict()
  const assignment = objectSchema({ responseId: identifier, questionId: identifier, codeId: identifier }, ['responseId', 'questionId', 'codeId'])
  const base = { scope: 'pencil:coding', classes: ['standard' as const], clauses: ['RSLT-012'], classify: standard, untrusted: true, outputSchema: { type: 'object' } }
  const read = (verb: string, title: string, schema: JsonSchemaObject, run: (args: Record<string, unknown>, who: Awaited<ReturnType<typeof scope>>) => Promise<unknown>) => defineTool({
    ...base, name: `pencil.coding.${verb}`, title, description: title, readOnly: true, inputSchema: schema,
    async run(args, ctx) { const who = await scope(ctx); return { result: await nativeCall(() => run(args, who)) } },
  })
  const answer = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx), row = await nativeCall(() => retainedAnswer(db, who.workspaceId, String(args.responseId), String(args.questionId)))
    await nativeCall(() => workspaceCode(db, who.workspaceId, String(args.codeId)))
    return { who, row }
  }
  const assignmentTool = (verb: 'assign' | 'remove') => defineTool({
    ...base, name: `pencil.coding.${verb}`, title: verb === 'assign' ? 'Code a retained text answer' : 'Remove a text answer code', description: 'Change only a native retained-answer annotation, under the current workspace and answer fences.', readOnly: false, inputSchema: assignment,
    revisionType: 'string', async revision(args, ctx) { return (await answer(args, ctx)).row.valueJson },
    async target(args, ctx) { await answer(args, ctx); return { kind: 'response', id: String(args.responseId) } },
    async summary(args, ctx) { const { row } = await answer(args, ctx); return { target: { id: row.responseId }, items: [verb, row.prompt, String(args.codeId)] } },
    async run(args, ctx) {
      const { who } = await answer(args, ctx)
      const result = verb === 'assign' ? await nativeCall(() => assignManually(db, who.workspaceId, who.operatorId, String(args.responseId), String(args.questionId), String(args.codeId), nativeActor(ctx)))
        : await nativeCall(async () => { await removeAssignment(db, who.workspaceId, String(args.responseId), String(args.questionId), String(args.codeId), who.operatorId, nativeActor(ctx)); return { removed: true } })
      return { result }
    },
  })
  return [
    read('list', 'Read the native workspace codebook', objectSchema({ after: identifier }), async (args, who) => listCodes(db, who.workspaceId, args.after as string | undefined)),
    defineTool({ ...base, name: 'pencil.coding.create', title: 'Create a workspace code', description: 'Save a native case-normalized code label without accepting a provider suggestion.', readOnly: false,
      inputSchema: objectSchema({ label: { type: 'string', minLength: 1, maxLength: 100 } }, ['label']),
      summary: args => ({ items: ['Create workspace code', String(args.label)] }),
      async run(args, ctx) { const who = await scope(ctx); const label = z.string().trim().min(1).max(100).refine(value => !/\p{Cc}/u.test(value)).parse(args.label); return { result: await nativeCall(() => createCode(db, who.workspaceId, who.operatorId, label, nativeActor(ctx))) } },
    }),
    read('answers', 'Read codable retained answers and current assignments', z.toJSONSchema(form.extend({ questionId: z.string().min(1).max(256).optional() }), { io: 'input' }) as JsonSchemaObject,
      async (args, who) => { const { formId, filter, after } = form.parse({ formId: args.formId, filter: args.filter, after: args.after }); return listAnswers(db, who.workspaceId, formId, { ...ledgerFilterSchema.parse(filter ?? {}), after, questionId: args.questionId as string | undefined }) }),
    assignmentTool('assign'), assignmentTool('remove'),
    read('suggestions', 'Read exact native analysis quote suggestions', objectSchema({ formId: identifier, after: identifier }, ['formId']), async (args, who) => suggestions(db, who.workspaceId, String(args.formId), args.after as string | undefined)),
    defineTool({ ...base, name: 'pencil.coding.decide', title: 'Decide an exact quote coding suggestion', description: 'Accept an existing exact native quote into a workspace code, or reject it; native disclosure and immutable-decision fences apply.', readOnly: false,
      inputSchema: objectSchema({ quoteId: identifier, decision: { enum: ['accepted', 'rejected'] }, codeId: identifier }, ['quoteId', 'decision']),
      revisionType: 'string', async revision(args, ctx) { const who = await scope(ctx); return (await nativeCall(() => codingSuggestion(db, who.workspaceId, String(args.quoteId)))).valueJson },
      async target(args, ctx) { const who = await scope(ctx); const quote = await nativeCall(() => codingSuggestion(db, who.workspaceId, String(args.quoteId))); return { kind: 'coding-quote', id: quote.quoteId } },
      async summary(args, ctx) { const who = await scope(ctx); const quote = await nativeCall(() => codingSuggestion(db, who.workspaceId, String(args.quoteId))); return { target: { id: quote.quoteId }, items: [String(args.decision), ...(args.codeId ? [String(args.codeId)] : [])] } },
      async run(args, ctx) { const who = await scope(ctx); const result = await nativeCall(() => decideSuggestion(db, who.workspaceId, who.operatorId, String(args.quoteId), { decision: args.decision as 'accepted' | 'rejected', ...(args.codeId ? { codeId: String(args.codeId) } : {}) }, nativeActor(ctx))); if (!result) throw new ToolRefusal('not_found'); return { result } },
    }),
    read('counts', 'Read coding counts with native denominators', z.toJSONSchema(form, { io: 'input' }) as JsonSchemaObject, async (args, who) => { const input = form.parse(args); return codingCounts(db, who.workspaceId, input.formId, ledgerFilterSchema.parse(input.filter ?? {}), input.after) }),
    read('crosstab', 'Read a native two-code crosstab', z.toJSONSchema(form.omit({ after: true }).extend({ rowCodeId: z.string().min(1).max(256), columnCodeId: z.string().min(1).max(256) }), { io: 'input' }) as JsonSchemaObject,
      async (args, who) => codingCrosstab(db, who.workspaceId, String(args.formId), ledgerFilterSchema.parse(args.filter ?? {}), String(args.rowCodeId), String(args.columnCodeId))),
  ]
}
