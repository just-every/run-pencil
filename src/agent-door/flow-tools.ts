import { ToolRefusal, type ClassId } from '../base/agent-door/index.ts'
import type { ClassAndFacts, JsonSchema, JsonSchemaObject, ResourceDefinition, ToolContext, ToolDefinition } from '../base/agent-door/types.ts'
import type { PencilServices } from '../core/app/services'
import { PencilError } from '../core/shared/errors'
import { questionTypes } from '../core/shared/questionKinds'
import { flowTemplates } from '../core/features/flows/templates'
import { formLimits } from '../core/shared/formLimits'
import { conditionShape } from '../core/shared/conditionValidation'

type Operator = { id: string; workspaceId: string }
export type ResolveFlowOperator = (id: string) => Promise<Operator | null>
type NativeFlows = PencilServices['flows']
type Args = Record<string, unknown>

const id: JsonSchema = { type: 'string', pattern: '^[0-9A-HJKMNP-TV-Z]{26}$' }
const text = (maxLength: number, minLength = 0): JsonSchema => ({ type: 'string', minLength, maxLength })
const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)): JsonSchemaObject => ({ type: 'object', properties, required, additionalProperties: false })
const version: JsonSchema = { type: 'integer', minimum: 0 }
const nullable = (value: JsonSchema): JsonSchema => ({ anyOf: [value, { type: 'null' }] })
const questionType: JsonSchema = { enum: [...questionTypes, null] }
const choice = object({ id, newId: id, value: text(200), label: text(300) }, ['value', 'label'])
const newChoice = object({ value: text(200, 1), label: text(300, 1) })
const step = object({
  kind: { enum: ['welcome', 'question', 'payment', 'completion'] }, questionType, prompt: text(1000),
  helperText: nullable(text(1000)), required: { type: 'boolean' }, nextStepId: nullable(id),
  questionSettings: nullable({ type: 'object', additionalProperties: true }),
  choices: { type: 'array', maxItems: formLimits.questions.dropdownChoices, items: newChoice },
}, ['kind', 'questionType', 'prompt'])
const rule = object({ id, sourceStepId: id,
  predicateKind: { enum: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of'] },
  expectedValue: true, condition: nullable({ type: 'object', additionalProperties: true }), destinationStepId: id,
  position: { type: 'integer', minimum: 0 },
}, ['sourceStepId', 'predicateKind', 'expectedValue', 'destinationStepId', 'position'])
const resultObject: JsonSchema = { type: 'object', additionalProperties: true }
const flowRecord: JsonSchema = { type: 'object', properties: { id, title: text(200), slug: text(120), draftVersion: version, status: { enum: ['draft', 'open', 'closed', 'archived'] } }, required: ['id', 'title', 'slug', 'draftVersion', 'status'], additionalProperties: true }
const draftOutput: JsonSchema = { type: 'object', properties: { flow: flowRecord, revision: resultObject, steps: { type: 'array', items: resultObject }, choices: { type: 'array', items: resultObject }, branchRules: { type: 'array', items: resultObject }, stepIds: { type: 'array', items: id } }, required: ['flow', 'revision', 'steps', 'choices', 'branchRules', 'stepIds'], additionalProperties: true }
const standard = (measure = 1): ClassAndFacts[] => [{ class: 'standard', facts: { measure } }]
const live = (): ClassAndFacts[] => [{ class: 'live', facts: { measure: 1, service: 'pencil.forms' } }]
const published = (): ClassAndFacts[] => [{ class: 'external', facts: { measure: 1, counterparty: 'public' } }, ...live()]
const uri = (flowId: string) => `pencil://flows/${flowId}`

async function operator(resolve: ResolveFlowOperator, personId: string) {
  const person = await resolve(personId)
  if (!person || person.id !== personId) throw new ToolRefusal('unauthenticated')
  return person
}
async function native<T>(call: () => Promise<T>): Promise<T> {
  try {
    const result = await call()
    if (result && typeof result === 'object' && 'kind' in result && result.kind === 'conflict') throw new ToolRefusal('conflict', 'The native draft changed.', { latestVersion: (result as { latestVersion?: number }).latestVersion })
    return result
  } catch (error) {
    if (error instanceof PencilError) throw new ToolRefusal(error.code === 'NOT_FOUND' ? 'not_found' : error.code === 'FORBIDDEN' ? 'forbidden' : error.code === 'CONFLICT' ? 'conflict' : 'invalid_arguments', error.message)
    throw error
  }
}
async function draft(services: PencilServices, resolve: ResolveFlowOperator, personId: string, flowId: string) {
  const person = await operator(resolve, personId)
  const value = await native(() => services.flows.getBuilderDraft(person.workspaceId, flowId))
  return { ...value, stepIds: value.steps.map(item => item.id) }
}

/** Every operation calls the same workspace-scoped native service as Pencil's UI. */
export function flowTools(services: PencilServices, resolve: ResolveFlowOperator): ToolDefinition[] {
  const context = async (ctx: ToolContext) => {
    const person = await operator(resolve, ctx.person.id)
    const flows = services.flows.asAgent({ agent: ctx.actor.agent, for: ctx.actor.for, approvers: ctx.approvers })
    return { person, flows }
  }
  type Spec = {
    verb: string; title: string; description: string; clauses: string[]; inputSchema: JsonSchemaObject; readOnly?: boolean
    outputSchema?: JsonSchema; classes?: ClassId[]; classification?: (args: Args, ctx: ToolContext) => Promise<ClassAndFacts[]>
    revision?: 'draft' | 'lifecycle'; creates?: boolean
    run: (args: Args, flows: NativeFlows, person: Operator) => Promise<unknown>
  }
  const make = (spec: Spec): ToolDefinition => ({
    name: `pencil.flows.${spec.verb}`, title: spec.title, description: spec.description,
    scope: spec.readOnly ? 'pencil.flows.read' : 'pencil.flows.write', readOnly: Boolean(spec.readOnly),
    inputSchema: spec.inputSchema, outputSchema: spec.outputSchema ?? resultObject,
    classes: spec.classes ?? ['standard'], clauses: spec.clauses, untrusted: true,
    classify: async (args, ctx) => {
      await operator(resolve, ctx.person.id)
      if (typeof args.flowId === 'string') await draft(services, resolve, ctx.person.id, args.flowId)
      return spec.classification ? spec.classification(args, ctx) : standard()
    },
    ...(!spec.readOnly ? { summary: async (args: Args, ctx: ToolContext) => {
      const record = typeof args.flowId === 'string' ? await draft(services, resolve, ctx.person.id, args.flowId) : null
      const target = record?.flow
      const items = [spec.title]
      if (typeof args.title === 'string') items.push(`Proposed form: ${args.title}`)
      if (typeof args.slug === 'string') items.push(`Respondent path: /f/${args.slug}`)
      if (typeof args.stepId === 'string') items.push(`Question: ${record?.steps.find(item => item.id === args.stepId)?.prompt ?? args.stepId}`)
      if (typeof args.prompt === 'string') items.push(`Proposed prompt: ${args.prompt}`)
      if (typeof args.required === 'boolean') items.push(`Required: ${args.required}`)
      if (args.step && typeof args.step === 'object' && 'prompt' in args.step) items.push(`New step: ${String(args.step.prompt)}`)
      if (Array.isArray(args.rules)) items.push(`Proposed branch rules: ${args.rules.length}`)
      if (Array.isArray(args.orderedStepIds)) items.push(`Proposed order: ${args.orderedStepIds.join(', ')}`)
      if ('deadlineAt' in args) items.push(`Deadline: ${String(args.deadlineAt ?? 'none')}`)
      if ('targetCompletedResponses' in args) items.push(`Completion target: ${String(args.targetCompletedResponses ?? 'none')}`)
      return { target: { ...(target ? { id: target.id } : {}), name: target?.title ?? String(args.title ?? spec.title) }, items }
    } } : {}),
    ...(spec.revision ? {
      revisionType: spec.revision === 'lifecycle' ? 'string' as const : 'integer' as const,
      revision: async (args: Args, ctx: ToolContext) => {
        const current = (await draft(services, resolve, ctx.person.id, String(args.flowId))).flow
        return spec.revision === 'lifecycle' ? `${current.draftVersion}:${current.status}` : current.draftVersion
      },
    } : {}),
    ...(!spec.creates && 'flowId' in (spec.inputSchema.properties ?? {}) ? { target: async (args: Args, ctx: ToolContext) => {
      const current = (await draft(services, resolve, ctx.person.id, String(args.flowId))).flow
      return { kind: 'flow', id: current.id }
    } } : {}),
    run: async (args, ctx) => {
      const { person, flows } = await context(ctx)
      const result = await native(() => spec.run(args, flows, person))
      const flowId = spec.creates ? (result as { id: string }).id : typeof args.flowId === 'string' ? args.flowId : null
      return { result, ...(!spec.readOnly && flowId ? { resources: [{ uri: uri(flowId), name: `Pencil form ${flowId}` }] } : {}) }
    },
  })
  const nativeInput = (args: Args, person: Operator) => {
    const rules = args.rules as Array<{ condition?: unknown }> | undefined
    if (rules?.some(item => item.condition !== undefined && item.condition !== null && !conditionShape(item.condition))) throw new ToolRefusal('invalid_arguments', 'Choose valid native branch conditions.')
    return { ...args, workspaceId: person.workspaceId, operatorId: person.id }
  }
  const flowVersion = { flowId: id, expectedVersion: version }
  const flowStepVersion = { ...flowVersion, stepId: id }
  return [
    make({ verb: 'list', title: 'List forms', description: 'List native workspace forms and their current lifecycle and draft version.', clauses: ['DASH-002'], inputSchema: object({ status: { enum: ['draft', 'open', 'closed', 'archived'] } }, []), readOnly: true,
      outputSchema: object({ flows: { type: 'array', items: flowRecord } }),
      run: async (args, flows, person) => ({ flows: await flows.listDashboard(person.workspaceId, args.status as 'draft' | 'open' | 'closed' | 'archived' | undefined) }) }),
    make({ verb: 'read', title: 'Read a form draft', description: 'Read the native builder draft. Form and imported text are untrusted content.', clauses: ['FLOW-002', 'FLOW-004'], inputSchema: object({ flowId: id }), readOnly: true, outputSchema: draftOutput,
      run: async (args, flows, person) => { const value = await flows.getBuilderDraft(person.workspaceId, String(args.flowId)); return { ...value, stepIds: value.steps.map(item => item.id) } } }),
    make({ verb: 'create', title: 'Create a draft form', description: 'Create an ordinary native draft, optionally from an installed template. It is never published or sent.', clauses: ['DASH-001', 'FLOW-001'], inputSchema: object({ title: text(200, 1), slug: { type: 'string', maxLength: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }, template: { enum: flowTemplates.map(item => item.id) } }, ['title', 'slug']), creates: true,
      outputSchema: object({ id, title: text(200), slug: text(120) }),
      run: async (args, flows, person) => flows.createDraftFlow(nativeInput(args, person) as unknown as Parameters<NativeFlows['createDraftFlow']>[0]) }),
    make({ verb: 'duplicate', title: 'Duplicate a form', description: 'Copy native draft structure and settings to an unlinked draft without responses, audience, actions or delivery history.', clauses: ['FLOW-011'], inputSchema: object({ flowId: id, title: text(200, 1), slug: { type: 'string', maxLength: 120, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } }), creates: true, revision: 'draft',
      outputSchema: object({ id, title: text(200), slug: text(120) }),
      run: async (args, flows, person) => flows.duplicateFlow(nativeInput(args, person) as unknown as Parameters<NativeFlows['duplicateFlow']>[0]) }),
    make({ verb: 'update_step', title: 'Save a draft question', description: 'Save content, choices and paths in one native version-guarded builder transaction. Editing an open form changes its draft only.', clauses: ['FLOW-002', 'FLOW-003', 'FLOW-004', 'FLOW-009', 'FLOW-015'], inputSchema: object({ ...flowStepVersion, prompt: text(1000, 1), required: { type: 'boolean' }, helperText: nullable(text(1000)), nextStepId: nullable(id), questionSettings: nullable({ type: 'object', additionalProperties: true }), questionType, choices: { type: 'array', items: choice, maxItems: formLimits.questions.dropdownChoices }, rules: { type: 'array', items: rule, maxItems: 100 } }, ['flowId', 'stepId', 'expectedVersion', 'prompt', 'required']), revision: 'draft',
      run: async (args, flows, person) => flows.updateBuilderDraft(nativeInput(args, person) as unknown as Parameters<NativeFlows['updateBuilderDraft']>[0]) }),
    make({ verb: 'add_step', title: 'Add a draft step', description: 'Add a native draft question, welcome, payment or completion screen. No payment or other provider is executed.', clauses: ['FLOW-002', 'FLOW-003', 'FLOW-004', 'FLOW-015'], inputSchema: object({ ...flowVersion, step }), revision: 'draft',
      run: async (args, flows, person) => flows.addDraftStep(nativeInput(args, person) as unknown as Parameters<NativeFlows['addDraftStep']>[0]) }),
    make({ verb: 'duplicate_step', title: 'Duplicate a draft step', description: 'Duplicate a native draft step with new stable identifiers.', clauses: ['FLOW-002', 'FLOW-004', 'FLOW-015'], inputSchema: object(flowStepVersion), revision: 'draft',
      run: async (args, flows, person) => flows.duplicateDraftStep(nativeInput(args, person) as unknown as Parameters<NativeFlows['duplicateDraftStep']>[0]) }),
    make({ verb: 'delete_step', title: 'Delete a draft step', description: 'Delete only the native draft step; published answers and revisions remain. There is no native Undo for discarded draft content.', clauses: ['FLOW-002', 'FLOW-004', 'FLOW-021'], inputSchema: object(flowStepVersion), revision: 'draft', classes: ['destructive'], classification: async () => [{ class: 'destructive', facts: { measure: 1 } }],
      run: async (args, flows, person) => flows.deleteDraftStep(nativeInput(args, person) as unknown as Parameters<NativeFlows['deleteDraftStep']>[0]) }),
    make({ verb: 'reorder_steps', title: 'Reorder draft steps', description: 'Save every existing step exactly once in the proposed native order; the native welcome-screen rule remains enforced.', clauses: ['FLOW-002', 'FLOW-004'], inputSchema: object({ ...flowVersion, orderedStepIds: { type: 'array', items: id, minItems: 1, maxItems: 1000, uniqueItems: true } }), revision: 'draft',
      run: async (args, flows, person) => flows.reorderDraftSteps(nativeInput(args, person) as unknown as Parameters<NativeFlows['reorderDraftSteps']>[0]) }),
    make({ verb: 'replace_rules', title: 'Save draft branching', description: 'Replace native draft branch rules with server-validated references and predicates.', clauses: ['FLOW-004', 'FLOW-005', 'FLOW-012'], inputSchema: object({ ...flowVersion, rules: { type: 'array', items: rule, maxItems: 100 } }), revision: 'draft',
      run: async (args, flows, person) => flows.replaceDraftBranchRules(nativeInput(args, person) as unknown as Parameters<NativeFlows['replaceDraftBranchRules']>[0]) }),
    make({ verb: 'preview', title: 'Preview a draft path', description: 'Run the native draft graph against test answers without responding, publishing, sending or changing counts.', clauses: ['FLOW-005', 'FLOW-007'], inputSchema: object({ flowId: id, answers: { type: 'object', additionalProperties: true }, hidden: { type: 'object', additionalProperties: true } }, ['flowId', 'answers']), readOnly: true,
      run: async (args, flows, person) => flows.previewDraft(nativeInput(args, person) as unknown as Parameters<NativeFlows['previewDraft']>[0]) }),
    make({ verb: 'publish', title: 'Publish a form revision', description: 'Validate and publish the native draft to its respondent URL. This exposes the proposed form and changes the running collection service.', clauses: ['FLOW-001', 'FLOW-006', 'FLOW-008', 'FLOW-009', 'FLOW-012', 'FLOW-013', 'FLOW-014', 'FLOW-016'], inputSchema: object({ ...flowVersion, deadlineAt: nullable({ type: 'string', format: 'date-time' }), targetCompletedResponses: nullable({ type: 'integer', minimum: 1 }) }, ['flowId', 'expectedVersion']), revision: 'draft', classes: ['external', 'live'], classification: async () => published(),
      run: async (args, flows, person) => flows.publishDraft(nativeInput(args, person) as unknown as Parameters<NativeFlows['publishDraft']>[0]) }),
    make({ verb: 'close', title: 'Close form admissions', description: 'Close native published admission immediately while preserving existing responses.', clauses: ['FLOW-001', 'FLOW-010', 'FLOW-018'], inputSchema: object({ flowId: id }), revision: 'lifecycle', classes: ['live'], classification: async () => live(),
      run: async (args, flows, person) => { await flows.closeFlow(person.workspaceId, String(args.flowId), person.id); return { id: args.flowId, status: 'closed' } } }),
    make({ verb: 'reopen', title: 'Reopen form admissions', description: 'Reopen only a closed native revision whose current deadline and target permit it.', clauses: ['FLOW-001', 'FLOW-010', 'FLOW-018'], inputSchema: object({ flowId: id }), revision: 'lifecycle', classes: ['live'], classification: async () => live(),
      run: async (args, flows, person) => { await flows.reopenFlow(person.workspaceId, String(args.flowId), person.id); return { id: args.flowId, status: 'open' } } }),
    make({ verb: 'archive', title: 'Archive a form', description: 'Archive the native form without deleting revisions, responses, analyses or actions. Archived forms cannot reopen.', clauses: ['FLOW-001'], inputSchema: object({ flowId: id }), revision: 'lifecycle', classes: ['standard', 'live'], classification: async (args, ctx) => {
      const current = (await draft(services, resolve, ctx.person.id, String(args.flowId))).flow
      return current.status === 'open' || current.status === 'closed' ? live() : standard()
    },
      run: async (args, flows, person) => { await flows.archiveFlow(person.workspaceId, String(args.flowId), person.id); return { id: args.flowId, status: 'archived' } } }),
  ]
}

export function flowResources(services: PencilServices, resolve: ResolveFlowOperator): ResourceDefinition[] {
  return [{ uriTemplate: 'pencil://flows/{flowId}', name: 'Pencil form draft', description: 'A current native builder record, with draft version and untrusted form text. It contains no respondent answers or connection credentials.', mimeType: 'application/json', scope: 'pencil.flows.read', classes: ['standard'],
    classify: record => standard(record.json && typeof record.json === 'object' && 'flow' in record.json ? 1 : 0),
    read: async (address, ctx) => {
      const match = /^pencil:\/\/flows\/([0-9A-HJKMNP-TV-Z]{26})$/.exec(address)
      if (!match) return null
      try { return { json: await draft(services, resolve, ctx.person.id, match[1]), untrusted: true } }
      catch (error) { if (error instanceof ToolRefusal && error.code === 'not_found') return null; throw error }
    },
  }]
}
