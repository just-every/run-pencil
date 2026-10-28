import { z } from 'zod'
import { defineTool, ToolRefusal, type JsonSchemaObject, type ToolContext, type ToolDefinition } from '../../../base/agent-door/index.ts'
import { createDatabase } from '../../platform/db/repository'
import { FlowRepository } from '../../features/flows'
import { Studio } from '../../features/studio/service'
import { studioInput, studySchema } from '../../features/studio/model'
import { providerStatus } from '../../features/analysis'
import type { PencilServices } from '../services'
import { nativeActor, nativeCall, nativeScope } from './native'
import { identifier as id, objectSchema as schema, standard } from './form-context'

const hash = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')

export function studyTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const versions = new WeakMap<Record<string, unknown>, number>(), inputs = new WeakMap<Record<string, unknown>, string>()
  const scope = (ctx: ToolContext) => nativeScope(db, services, ctx.person.id)
  const studio = (ctx: ToolContext) => new Studio(db, new FlowRepository(createDatabase(db), db).attributed(nativeActor(ctx)), services.analysis.provider, nativeActor(ctx))
  const saved = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const record = await nativeCall(async () => studio(ctx).get((await scope(ctx)).workspaceId, String(args.formId)))
    if (!versions.has(args)) versions.set(args, record.version)
    return record
  }
  const evidence = async (args: Record<string, unknown>, ctx: ToolContext) => {
    const data = await studio(ctx).generationInput((await scope(ctx)).workspaceId, studioInput.parse(args))
    if (!inputs.has(args)) inputs.set(args, data)
    return data
  }
  const base = { scope: 'pencil:studies', classes: ['standard' as const], classify: standard, outputSchema: { type: 'object' }, untrusted: true, clauses: ['AGENT-001', 'AI-001'] }
  return [
    defineTool({ ...base, name: 'pencil.studies.list', title: 'Read study preparation options', description: 'Read native prior forms and provider readiness without calling the provider.', readOnly: true, inputSchema: schema({}),
      async run(_args, ctx) { return { result: { provider: providerStatus(services.analysis.provider), forms: await studio(ctx).priorForms((await scope(ctx)).workspaceId) } } },
    }),
    defineTool({ ...base, name: 'pencil.studies.read', title: 'Read a saved study', description: 'Read the native generated study, advisory bias flags and calculated sample size.', readOnly: true, inputSchema: schema({ formId: id }, ['formId']),
      async run(args, ctx) { return { result: await saved(args, ctx), resources: [{ uri: `pencil://forms/${args.formId}`, name: 'Study form' }] } },
    }),
    defineTool({ ...base, name: 'pencil.studies.generate', title: 'Generate a private study draft', description: 'Use the configured provider with the selected native form prompts and source, validate the generated graph and retain an editable private draft.', readOnly: false,
      inputSchema: z.toJSONSchema(studioInput, { io: 'input' }) as JsonSchemaObject, classes: ['standard', 'external'], revisionType: 'string',
      async revision(args, ctx) { return hash([await evidence(args, ctx), providerStatus(services.analysis.provider)]) },
      async classify(args, ctx) {
        await evidence(args, ctx)
        if (services.analysis.provider.state !== 'on') throw new ToolRefusal('provider_unavailable')
        return [...standard(), { class: 'external', facts: { measure: 1, counterparty: 'known' } }]
      },
      async summary(args, ctx) { return { target: { name: String(args.goal) }, items: [await evidence(args, ctx), JSON.stringify(providerStatus(services.analysis.provider))] } },
      async run(args, ctx) {
        const who = await scope(ctx)
        const result = await nativeCall(() => studio(ctx).generate(who.workspaceId, who.operatorId, studioInput.parse(args), inputs.get(args)))
        ctx.emit('form.draft-changed', `pencil://forms/${result.flowId}`)
        return { result, resources: [{ uri: `pencil://forms/${result.flowId}`, name: 'Generated private study' }] }
      },
    }),
    defineTool({ ...base, name: 'pencil.studies.update', title: 'Save the study plan', description: 'Save the native study decision, hypotheses, audience and analysis plan at the current draft version.', readOnly: false,
      inputSchema: schema({ formId: id, study: z.toJSONSchema(studySchema) }, ['formId', 'study']),
      async target(args, ctx) { return { kind: 'flow', id: (await saved(args, ctx)).flowId } },
      async revision(args, ctx) { return (await saved(args, ctx)).version },
      async summary(args, ctx) { const record = await saved(args, ctx); return { target: { id: record.flowId, name: record.title }, items: [JSON.stringify(studySchema.parse(args.study))] } },
      async run(args, ctx) {
        const who = await scope(ctx), record = await saved(args, ctx)
        const result = await nativeCall(() => studio(ctx).saveStudy(who.workspaceId, who.operatorId, record.flowId, versions.get(args)!, studySchema.parse(args.study)))
        ctx.emit('form.draft-changed', `pencil://forms/${record.flowId}`)
        return { result, resources: [{ uri: `pencil://forms/${record.flowId}`, name: 'Study form' }] }
      },
    }),
  ]
}
