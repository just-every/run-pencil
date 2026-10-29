import { z } from 'zod'
import { defineTool, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { SubmissionService } from '../../features/submissions/service'
import { submissionBulkSchema, submissionReadSchema, submissionStatusSchema } from '../../features/submissions/model'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Triage changes native metadata only; personal notes and respondent sessions keep their own doors. */
export function submissionTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const service = (ctx: ToolContext) => new SubmissionService(db).attributed(nativeActor(ctx))
  const formId = z.string().min(1).max(256)
  const responses = submissionBulkSchema.shape.responses
  const fields = submissionBulkSchema.shape.changes.shape
  const changes = z.object({ statusId: fields.statusId, assigneeId: fields.assigneeId, addTags: fields.addTags, removeTags: fields.removeTags }).strict().refine(value => Object.keys(value).length > 0)
  const bulk = z.object({ formId, responses, changes }).strict()
  const base = { scope: 'pencil:responses', classes: ['standard' as const], classify: standard, outputSchema: { type: 'object' }, untrusted: true, clauses: ['WORK-001'] }
  const current = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx)
    await nativeCall(() => service(ctx).options(who.workspaceId, String(args.formId)))
    return who
  }
  const versions = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await current(args, ctx), input = bulk.parse(args)
    return nativeCall(() => service(ctx).read(who.workspaceId, input.formId, input.responses.map(row => row.id)))
  }
  return [
    defineTool({ ...base, name: 'pencil.responses.options', title: 'Read native triage options', description: 'Read this form’s statuses and real workspace assignees.', readOnly: true,
      inputSchema: objectSchema({ formId: identifier }, ['formId']),
      async run(args, ctx) { const who = await current(args, ctx); return { result: await service(ctx).options(who.workspaceId, String(args.formId)) } },
    }),
    defineTool({ ...base, name: 'pencil.responses.read', title: 'Read selected submission metadata', description: 'Read current native workflow versions, assignments, status and tags for released responses.', readOnly: true,
      inputSchema: z.toJSONSchema(submissionReadSchema.extend({ formId }).strict(), { io: 'input' }) as JsonSchemaObject,
      async run(args, ctx) { const who = await current(args, ctx), input = submissionReadSchema.parse({ responseIds: args.responseIds }); return { result: await nativeCall(() => service(ctx).read(who.workspaceId, String(args.formId), input.responseIds)) } },
    }),
    defineTool({ ...base, name: 'pencil.responses.create_status', title: 'Create a form triage status', description: 'Add a native private status without changing response content or contacting a provider.', readOnly: false,
      inputSchema: z.toJSONSchema(submissionStatusSchema.extend({ formId }).strict(), { io: 'input' }) as JsonSchemaObject,
      async target(args, ctx) { await current(args, ctx); return { kind: 'flow', id: String(args.formId) } },
      async summary(args, ctx) { await current(args, ctx); return { target: { id: String(args.formId) }, items: ['Create submission status', String(args.name)] } },
      async run(args, ctx) { const who = await current(args, ctx); return { result: await nativeCall(() => service(ctx).createStatus(who.workspaceId, String(args.formId), who.operatorId, String(args.name))) } },
    }),
    defineTool({ ...base, name: 'pencil.responses.triage', title: 'Triage released responses', description: 'Atomically change native status, assignment or tags at each selected response’s current workflow version. Does not author a personal note or change an answer.', readOnly: false,
      inputSchema: z.toJSONSchema(bulk, { io: 'input' }) as JsonSchemaObject,
      revisionType: 'string', async revision(args, ctx) { return JSON.stringify((await versions(args, ctx)).submissions.map(row => [row.responseId, row.version])) },
      async target(args, ctx) { await current(args, ctx); return { kind: 'flow', id: String(args.formId) } },
      async classify(args, ctx) { await versions(args, ctx); return standard() },
      async summary(args, ctx) { const native = await versions(args, ctx), input = bulk.parse(args); return { target: { id: input.formId }, items: [JSON.stringify(native.submissions.map(row => ({ id: row.responseId, version: row.version }))), JSON.stringify(input.changes)] } },
      async run(args, ctx) { const who = await current(args, ctx), input = bulk.parse(args); return { result: await nativeCall(() => service(ctx).bulk(who.workspaceId, input.formId, who.operatorId, submissionBulkSchema.parse({ responses: input.responses, changes: input.changes }))) } },
    }),
  ]
}
