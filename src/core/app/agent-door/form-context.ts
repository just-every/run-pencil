import { defineTool, type ToolDefinition, type ToolContext, type JsonSchemaObject } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'

export const identifier = { type: 'string', minLength: 1, maxLength: 256 }
export const objectSchema = (properties: Record<string, unknown>, required: string[] = []): JsonSchemaObject => ({ type: 'object', additionalProperties: false, properties: properties as JsonSchemaObject['properties'], required })
export const standard = () => [{ class: 'standard' as const, facts: { measure: 1 } }]

/** Carry the version read during admission into the native conditional write. */
export function formContext(db: D1Database, services: PencilServices) {
  const versions = new WeakMap<Record<string, unknown>, number>()
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const draft = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx)
    const saved = await nativeCall(() => services.flows.getBuilderDraft(who.workspaceId, String(args.formId)))
    if (!versions.has(args)) versions.set(args, saved.flow.draftVersion)
    return saved
  }
  const version = async (args: Record<string, unknown>, ctx: ToolContext) => {
    await draft(args, ctx)
    return versions.get(args)!
  }
  const write = (verb: string, title: string, inputSchema: JsonSchemaObject, clauses: string[], run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>): ToolDefinition => defineTool({
    name: `pencil.forms.${verb}`, title, description: title, scope: 'pencil:forms', readOnly: false,
    inputSchema, outputSchema: { type: 'object' }, clauses, classes: ['standard'], untrusted: true,
    async target(args, ctx) { return { kind: 'flow', id: (await draft(args, ctx)).flow.id } },
    revision: async (args, ctx) => (await draft(args, ctx)).flow.draftVersion,
    async classify(args, ctx) { await draft(args, ctx); return standard() },
    async summary(args, ctx) { const saved = await draft(args, ctx); return { target: { id: saved.flow.id, name: saved.flow.title }, items: [title, JSON.stringify(args)] } },
    async run(args, ctx) {
      await draft(args, ctx)
      const value = await nativeCall(() => run(args, ctx))
      ctx.emit('form.draft-changed', `pencil://forms/${args.formId}`)
      return { result: value, resources: [{ uri: `pencil://forms/${args.formId}`, name: 'Form draft' }] }
    },
  })
  return { scope, draft, version, write, flows: (ctx: ToolContext) => services.flows.attributed(nativeActor(ctx)) }
}
