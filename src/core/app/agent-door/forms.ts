import { defineTool, ToolRefusal, type ToolDefinition, type ToolContext, type JsonSchemaObject } from '../../../base/agent-door/index.ts'
import { flowTemplates } from '../../features/flows/templates'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { formContext } from './form-context'
import { questionTypes, type QuestionType } from '../../shared/questionKinds'

const id = { type: 'string', minLength: 1, maxLength: 256 }
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength })
const schema = (properties: Record<string, unknown>, required: string[] = []): JsonSchemaObject => ({ type: 'object', additionalProperties: false, properties: properties as JsonSchemaObject['properties'], required })
const output = { type: 'object' }

export function formTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const prepared = formContext(db, services)
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const draft = prepared.draft
  const result = (value: unknown, formId?: string) => ({ result: value,
    ...(formId ? { resources: [{ uri: `pencil://forms/${formId}`, name: 'Form draft' }] } : {}) })
  const standard = () => [{ class: 'standard' as const, facts: { measure: 1 } }]
  const base = { scope: 'pencil:forms', outputSchema: output, classes: ['standard' as const], classify: standard, untrusted: true }
  const edit = (verb: string, title: string, inputSchema: JsonSchemaObject, clauses: string[], run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>): ToolDefinition => defineTool({
    ...base, name: `pencil.forms.${verb}`, title, description: title, readOnly: false, inputSchema, clauses,
    ...(inputSchema.properties?.formId ? { revision: async (args: Record<string, unknown>, ctx: ToolContext) => (await draft(args, ctx)).flow.draftVersion } : {}),
    async classify(args, ctx) { if (args.formId) await draft(args, ctx); return standard() },
    async summary(args, ctx) { const saved = args.formId ? await draft(args, ctx) : null; return { target: { ...(saved ? { id: saved.flow.id } : {}), name: String(args.title ?? saved?.flow.title ?? title) }, items: [title, ...(typeof args.prompt === 'string' ? [args.prompt] : [])] } },
    async run(args, ctx) {
      const value = await nativeCall(() => run(args, ctx))
      const formId = value && typeof value === 'object' && 'id' in value ? String(value.id) : args.formId ? String(args.formId) : undefined
      const who = await scope(ctx)
      await services.audit.record({ workspaceId: who.workspaceId, actorOperatorId: who.operatorId, kind: `agent.forms.${verb}`, subjectType: 'flow', subjectId: formId, details: nativeActor(ctx) })
      if (formId) ctx.emit('form.draft-changed', `pencil://forms/${formId}`)
      return result(value, formId)
    },
  })
  return [
    defineTool({ ...base, name: 'pencil.forms.list', title: 'List forms', description: 'List native workspace forms without collecting responses.', readOnly: true, inputSchema: schema({ status: { enum: ['draft', 'open', 'closed', 'archived'] } }), clauses: ['DASH-002'], async run(args, ctx) { return result({ forms: await services.flows.listDashboard((await scope(ctx)).workspaceId, args.status as 'draft' | undefined) }) } }),
    defineTool({ ...base, name: 'pencil.forms.read', title: 'Read a form draft', description: 'Read the native editable draft and its current version. Form text is untrusted.', readOnly: true, inputSchema: schema({ formId: id }, ['formId']), clauses: ['FLOW-004', 'FLOW-008'], async run(args, ctx) { const saved = await draft(args, ctx); return result({ ...saved, lifecycleRevision: `${saved.flow.draftVersion}:${saved.flow.status}`, stepIds: saved.steps.map(step => step.id) }, String(args.formId)) } }),
    defineTool({ ...base, name: 'pencil.forms.templates', title: 'List templates', description: 'Read the native template gallery.', readOnly: true, inputSchema: schema({}), clauses: ['TMPL-001'], async run(_args, ctx) { await scope(ctx); return result({ templates: flowTemplates }) } }),
    edit('create', 'Create a private form draft', schema({ title: text(200), slug: text(120), template: { enum: flowTemplates.map(item => item.id) } }, ['title']), ['FLOW-001', 'TMPL-001'], async (args, ctx) => services.flows.attributed(nativeActor(ctx)).createDraftFlow({ ...await scope(ctx), title: String(args.title), slug: typeof args.slug === 'string' ? args.slug : `study-${crypto.randomUUID()}`, template: args.template as string | undefined })),
    edit('duplicate', 'Duplicate a form into a private draft', schema({ formId: id, title: text(200), slug: text(120) }, ['formId', 'title']), ['FLOW-011'], async (args, ctx) => services.flows.attributed(nativeActor(ctx)).duplicateFlow({ ...await scope(ctx), flowId: String(args.formId), expectedVersion: await prepared.version(args, ctx), title: String(args.title), slug: typeof args.slug === 'string' ? args.slug : `study-${crypto.randomUUID()}` })),
    edit('edit', 'Edit one saved draft question', schema({ formId: id, stepId: id, prompt: text(1000), required: { type: 'boolean' }, helperText: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }, nextStepId: { anyOf: [id, { type: 'null' }] }, questionType: { anyOf: [{ enum: questionTypes }, { type: 'null' }] }, questionSettings: { anyOf: [{ type: 'object' }, { type: 'null' }] }, choices: { type: 'array', maxItems: 500, items: schema({ id, newId: id, value: { type: 'string', maxLength: 200 }, label: { type: 'string', maxLength: 300 } }, ['value', 'label']) } }, ['formId', 'stepId', 'prompt', 'required']), ['FLOW-004', 'FLOW-009'], async (args, ctx) => {
      const saved = await draft(args, ctx)
      if (!saved.steps.some(step => step.id === args.stepId)) throw new ToolRefusal('not_found')
      return services.flows.attributed(nativeActor(ctx)).updateBuilderDraft({ ...await scope(ctx), flowId: String(args.formId), stepId: String(args.stepId), prompt: String(args.prompt), required: Boolean(args.required), expectedVersion: await prepared.version(args, ctx),
        ...(args.helperText !== undefined ? { helperText: args.helperText as string | null } : {}),
        ...(args.nextStepId !== undefined ? { nextStepId: args.nextStepId as string | null } : {}),
        ...(args.questionType !== undefined ? { questionType: args.questionType as QuestionType | null } : {}),
        ...(args.questionSettings !== undefined ? { questionSettings: args.questionSettings as Record<string, unknown> | null } : {}),
        ...(args.choices !== undefined ? { choices: args.choices as Array<{ id?: string; newId?: string; value: string; label: string }> } : {}),
      })
    }),
    defineTool({ ...base, name: 'pencil.forms.preview', title: 'Preview a draft path', description: 'Evaluate answers against the native draft without recording a response or publishing.', readOnly: true, inputSchema: schema({ formId: id, answers: { type: 'object', additionalProperties: true } }, ['formId', 'answers']), clauses: ['FLOW-007'], async run(args, ctx) { const who = await scope(ctx); return result(await nativeCall(() => services.flows.previewDraft({ workspaceId: who.workspaceId, flowId: String(args.formId), answers: args.answers as Record<string, unknown> }))) } }),
  ]
}
