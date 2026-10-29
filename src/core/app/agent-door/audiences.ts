import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { contactSchema, contactLimits } from '../../features/distribution/contact-model'
import { segmentSchema } from '../../features/distribution/segments'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier, objectSchema, standard } from './form-context'

/** Audience record changes complete in-call; consent renewal and delivery use their native person doors. */
export function audienceTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const contacts = (ctx: ToolContext) => services.distribution.contacts.attributed(nativeActor(ctx))
  const segments = (ctx: ToolContext) => services.distribution.segments.attributed(nativeActor(ctx))
  const input = contactSchema.omit({ smsConsent: true }).strict()
  const inputSchema = (value: z.ZodObject): JsonSchemaObject => {
    const schema = z.toJSONSchema(value, { io: 'input' }) as JsonSchemaObject
    // The native keyed field map is represented with supported patternProperties.
    // Native contact parsing still owns trimming and every semantic field rule.
    if (schema.properties?.fields) schema.properties.fields = { type: 'object', maxProperties: contactLimits.customFields, default: {}, patternProperties: { [`^(?!(?:__proto__|constructor|prototype)$)[\\s\\S]{1,${contactLimits.fieldKeyCharacters}}$`]: { type: 'string', maxLength: contactLimits.fieldValueCharacters } }, additionalProperties: false }
    return schema
  }
  const contact = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx)
    return nativeCall(() => contacts(ctx).get(who.workspaceId, String(args.contactId)))
  }
  const segment = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const who = await scope(ctx), row = (await segments(ctx).list(who.workspaceId)).find(row => row.id === args.segmentId)
    return row ?? null
  }
  const requireSegment = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const row = await segment(args, ctx)
    if (!row) throw new ToolRefusal('not_found')
    return row
  }
  const base = { outputSchema: { type: 'object' }, untrusted: true, classes: ['standard' as const], classify: standard }
  const contactMutation = (verb: string, title: string, schema: z.ZodObject, run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>) => defineTool({
    ...base, name: `pencil.contacts.${verb}`, title, description: title, scope: 'pencil:contacts', readOnly: false, clauses: ['AUD-001'],
    inputSchema: inputSchema(schema),
    ...(schema.shape.contactId ? {
      async target(args: Record<string, unknown>, ctx: ToolContext) { return { kind: 'contact', id: (await contact(args, ctx)).id } },
      revisionType: 'string' as const, async revision(args: Record<string, unknown>, ctx: ToolContext) { return JSON.stringify(await contact(args, ctx)) },
    } : {}),
    async summary(args, ctx) { await scope(ctx); return { target: { ...(args.contactId ? { id: (await contact(args, ctx)).id } : {}), name: String(args.name ?? 'Audience contact') }, items: [title, JSON.stringify(args)] } },
    async run(args, ctx) { const result = await nativeCall(() => run(args, ctx)); const id = result && typeof result === 'object' && 'id' in result ? String(result.id) : undefined; if (id) ctx.emit('contact.changed', `pencil://contacts/${id}`); return { result, ...(id ? { resources: [{ uri: `pencil://contacts/${id}`, name: 'Audience contact' }] } : {}) } },
  })
  return [
    defineTool({ ...base, name: 'pencil.contacts.read', title: 'Read one audience contact', description: 'Read a native workspace contact without contacting or renewing consent for them.', scope: 'pencil:contacts', readOnly: true, clauses: ['AUD-001'], inputSchema: objectSchema({ contactId: identifier }, ['contactId']),
      async run(args, ctx) { const result = await contact(args, ctx); return { result, resources: [{ uri: `pencil://contacts/${result.id}`, name: 'Audience contact' }] } },
    }),
    contactMutation('create', 'Create an audience contact', input, async (args, ctx) => { const who = await scope(ctx); return contacts(ctx).save(who.workspaceId, input.parse(args), who.operatorId) }),
    contactMutation('edit', 'Edit an audience contact', input.extend({ contactId: z.string().min(1).max(256) }), async (args, ctx) => { const who = await scope(ctx), { contactId: _id, ...value } = args; return contacts(ctx).edit(who.workspaceId, String(args.contactId), input.parse(value), who.operatorId) }),
    contactMutation('opt_out', 'Stop mail to an audience contact', z.object({ contactId: z.string().min(1).max(256), source: z.string().trim().min(1).max(200) }).strict(), async (args, ctx) => {
      const who = await scope(ctx)
      await contacts(ctx).consent({ workspaceId: who.workspaceId, contactId: String(args.contactId), actor: who.operatorId, source: String(args.source), renewed: false })
      return contacts(ctx).get(who.workspaceId, String(args.contactId))
    }),
    defineTool({ ...base, name: 'pencil.segments.read', title: 'Read a saved audience segment', description: 'Read its native rules and current matching contacts without launching invitations.', scope: 'pencil:segments', readOnly: true, clauses: ['AUD-002'], inputSchema: objectSchema({ segmentId: identifier }, ['segmentId']),
      async run(args, ctx) { const row = await requireSegment(args, ctx), who = await scope(ctx); return { result: { ...row, contactIds: await segments(ctx).ids(who.workspaceId, row.id) } } },
    }),
    ...(['create', 'edit'] as const).map(verb => defineTool({ ...base, name: `pencil.segments.${verb}`, title: `${verb === 'create' ? 'Create' : 'Edit'} a saved audience segment`, description: 'Save the native field rules. This does not launch or rewrite any invitation.', scope: 'pencil:segments', readOnly: false, clauses: ['AUD-002'],
      inputSchema: z.toJSONSchema(verb === 'edit' ? segmentSchema.extend({ segmentId: z.string().min(1).max(256) }).strict() : segmentSchema.strict(), { io: 'input' }) as JsonSchemaObject,
      ...(verb === 'edit' ? { async target(args: Record<string, unknown>, ctx: ToolContext) { return { kind: 'segment', id: (await requireSegment(args, ctx)).id } }, revisionType: 'string' as const, async revision(args: Record<string, unknown>, ctx: ToolContext) { const row = await requireSegment(args, ctx); return JSON.stringify({ name: row.name, rules: row.rules }) } } : {}),
      async summary(args, ctx) { await scope(ctx); return { target: { ...(verb === 'edit' ? { id: (await requireSegment(args, ctx)).id } : {}), name: String(args.name) }, items: [JSON.stringify(args.rules)] } },
      async run(args, ctx) { const who = await scope(ctx), { segmentId: _id, ...value } = args; return { result: await nativeCall(() => segments(ctx).save(who.workspaceId, segmentSchema.parse(value), verb === 'edit' ? String(args.segmentId) : undefined, who.operatorId)) } },
    })),
    defineTool({ ...base, name: 'pencil.segments.erase', title: 'Erase a saved audience segment', description: 'Delete only the saved native rule set. Historical launches and contacts are retained.', scope: 'pencil:segments', readOnly: false, clauses: ['AUD-002'], classes: ['destructive'], inputSchema: objectSchema({ segmentId: identifier }, ['segmentId']), revisionType: 'string', async revision(args, ctx) { const row = await requireSegment(args, ctx); return JSON.stringify({name: row.name,rules: row.rules}) },
      async target(args, ctx) { const row = await segment(args, ctx); return row ? { kind: 'segment', id: row.id } : null },
      async classify(_args, ctx) { await scope(ctx); return [{ class: 'destructive', facts: { measure: 1 } }] },
      async summary(args, ctx) { const row = await requireSegment(args, ctx); return { target: { id: row.id, name: row.name }, items: ['Delete saved segment rules; keep contacts and historical launches'] } },
      async run(args, ctx) { const who = await scope(ctx); await nativeCall(() => segments(ctx).erase(who.workspaceId, String(args.segmentId), who.operatorId)); return { result: { erased: true } } },
    }),
  ]
}
