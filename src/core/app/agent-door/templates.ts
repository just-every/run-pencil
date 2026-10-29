import { defineTool, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { formContext, identifier, objectSchema, standard } from './form-context'

/** Reuse private builder content; publication, audiences and delivery are never copied. */
export function teamTemplateTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const forms = formContext(db, services)
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const native = (ctx: ToolContext) => services.templates.attributed(nativeActor(ctx))
  const base = { scope: 'pencil:templates', clauses: ['TMPL-002'], classes: ['standard' as const], classify: standard, untrusted: true, outputSchema: { type: 'object' } }
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => { const who = await scope(ctx); return nativeCall(() => native(ctx).current(who.workspaceId, String(args.templateId))) }
  return [
    defineTool({ ...base, name: 'pencil.templates.list', title: 'Read workspace team templates', description: 'List active native team templates with their preparer attribution.', readOnly: true, inputSchema: objectSchema({}),
      async run(_args, ctx) { const who = await scope(ctx); return { result: { templates: await native(ctx).list(who.workspaceId) } } },
    }),
    defineTool({ ...base, name: 'pencil.templates.save', title: 'Save a private team template', description: 'Snapshot the current native draft or publication into a private reusable template at the current draft version.', readOnly: false,
      inputSchema: objectSchema({ formId: identifier, name: { type: 'string', minLength: 1, maxLength: 100 }, source: { enum: ['draft', 'published'] } }, ['formId', 'name', 'source']),
      async revision(args, ctx) { return (await forms.draft(args, ctx)).flow.draftVersion },
      async target(args, ctx) { return { kind: 'flow', id: (await forms.draft(args, ctx)).flow.id } },
      async summary(args, ctx) { const form = await forms.draft(args, ctx); return { target: { id: form.flow.id, name: form.flow.title }, items: [String(args.name), String(args.source)] } },
      async run(args, ctx) { const who = await scope(ctx), expectedVersion = await forms.version(args, ctx); return { result: await nativeCall(() => native(ctx).save({ ...who, flowId: String(args.formId), name: String(args.name), source: args.source as 'draft' | 'published', expectedVersion })) } },
    }),
    defineTool({ ...base, name: 'pencil.templates.create_form', title: 'Create a private draft from a team template', description: 'Copy native private builder content with fresh stable IDs and no audience, responses, publication or credentials.', readOnly: false,
      inputSchema: objectSchema({ templateId: identifier, title: { type: 'string', minLength: 1, maxLength: 200 }, slug: { type: 'string', minLength: 1, maxLength: 120 } }, ['templateId', 'title', 'slug']),
      revisionType: 'string', async revision(args, ctx) { return (await saved(args, ctx)).createdAt },
      async target(args, ctx) { return { kind: 'team-template', id: (await saved(args, ctx)).id } },
      async summary(args, ctx) { const template = await saved(args, ctx); return { target: { id: template.id, name: template.name }, items: ['Create private draft', String(args.title), String(args.slug)] } },
      async run(args, ctx) { const who = await scope(ctx); const result = await nativeCall(() => native(ctx).create({ ...who, templateId: String(args.templateId), title: String(args.title), slug: String(args.slug) })); return { result, resources: [{ uri: `pencil://forms/${result.id}`, name: 'Private form draft' }] } },
    }),
    defineTool({ ...base, name: 'pencil.templates.retire', title: 'Retire a team template', description: 'Remove a native workspace template from future selection while retaining its recorded content and history.', readOnly: false,
      inputSchema: objectSchema({ templateId: identifier }, ['templateId']),
      revisionType: 'string', async revision(args, ctx) { return (await saved(args, ctx)).createdAt },
      async target(args, ctx) { return { kind: 'team-template', id: (await saved(args, ctx)).id } },
      async summary(args, ctx) { const template = await saved(args, ctx); return { target: { id: template.id, name: template.name }, items: ['Retire private template; existing forms stay independent'] } },
      async run(args, ctx) { const who = await scope(ctx); await nativeCall(() => native(ctx).retire(who.workspaceId, String(args.templateId), who.operatorId)); return { result: { retired: true } } },
    }),
  ]
}
