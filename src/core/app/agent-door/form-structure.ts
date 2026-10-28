import type { ToolDefinition } from '../../../base/agent-door/index.ts'
import type { PencilServices } from '../services'
import { questionTypes } from '../../shared/questionKinds'
import type { FormSettings } from '../../shared/hiddenFields'
import type { ScreenLayout } from '../../shared/screenLayout'
import { formContext, identifier as id, objectSchema as schema } from './form-context'

const nullable = (value: object) => ({ anyOf: [value, { type: 'null' }] })
const text = (maxLength: number) => ({ type: 'string', maxLength })
const choices = { type: 'array', maxItems: 500, items: schema({ value: text(200), label: text(300) }, ['value', 'label']) }
const step = schema({ kind: { enum: ['welcome', 'question', 'payment', 'completion'] }, questionType: nullable({ enum: questionTypes }),
  prompt: text(1000), helperText: nullable(text(1000)), required: { type: 'boolean' }, nextStepId: nullable(id),
  questionSettings: nullable({ type: 'object' }), choices }, ['kind', 'questionType', 'prompt'])

export function formStructureTools(db: D1Database, services: PencilServices): ToolDefinition[] {
  const native = formContext(db, services)
  const input = async (args: Record<string, unknown>, ctx: Parameters<typeof native.scope>[0]) => ({ ...await native.scope(ctx), flowId: String(args.formId), expectedVersion: await native.version(args, ctx) })
  return [
    native.write('settings', 'Save private form settings', schema({ formId: id, settings: { type: 'object' } }, ['formId', 'settings']), ['FLOW-004', 'FIELD-001', 'LOGIC-003'], async (args, ctx) => native.flows(ctx).updateFormSettings({ ...await input(args, ctx), settings: args.settings as FormSettings })),
    native.write('layout', 'Save private page or group layout', schema({ formId: id, stepId: id, layout: nullable(schema({ kind: { enum: ['page', 'group'] }, title: { type: 'string', minLength: 1, maxLength: 200 }, description: text(1000), randomize: { type: 'boolean' }, questionIds: { type: 'array', minItems: 1, maxItems: 500, items: id } }, ['kind', 'title', 'questionIds'])) }, ['formId', 'stepId', 'layout']), ['FIELD-008', 'FIELD-012'], async (args, ctx) => native.flows(ctx).updateScreen({ ...await input(args, ctx), stepId: String(args.stepId), layout: args.layout as ScreenLayout | null })),
    native.write('add_question', 'Add a private draft screen or question', schema({ formId: id, step }, ['formId', 'step']), ['FLOW-002', 'FLOW-004'], async (args, ctx) => native.flows(ctx).addDraftStep({ ...await input(args, ctx), step: args.step as Parameters<PencilServices['flows']['addDraftStep']>[0]['step'] })),
    native.write('duplicate_question', 'Duplicate a saved draft question', schema({ formId: id, stepId: id }, ['formId', 'stepId']), ['FLOW-004'], async (args, ctx) => native.flows(ctx).duplicateDraftStep({ ...await input(args, ctx), stepId: String(args.stepId) })),
    native.write('remove_question', 'Remove a question from the private draft', schema({ formId: id, stepId: id }, ['formId', 'stepId']), ['FLOW-004'], async (args, ctx) => native.flows(ctx).deleteDraftStep({ ...await input(args, ctx), stepId: String(args.stepId) })),
    native.write('reorder', 'Reorder every saved draft screen', schema({ formId: id, stepIds: { type: 'array', maxItems: 500, items: id } }, ['formId', 'stepIds']), ['FLOW-004'], async (args, ctx) => native.flows(ctx).reorderDraftSteps({ ...await input(args, ctx), orderedStepIds: args.stepIds as string[] })),
    native.write('branches', 'Replace the draft branch graph', schema({ formId: id, rules: { type: 'array', maxItems: 100, items: schema({ sourceStepId: id, destinationStepId: id, predicateKind: { enum: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of'] }, expectedValue: {}, condition: nullable({ type: 'object' }), position: { type: 'integer', minimum: 0 } }, ['sourceStepId', 'destinationStepId', 'predicateKind', 'expectedValue', 'position']) } }, ['formId', 'rules']), ['FLOW-006', 'LOGIC-006'], async (args, ctx) => native.flows(ctx).replaceDraftBranchRules({ ...await input(args, ctx), rules: args.rules as Parameters<PencilServices['flows']['replaceDraftBranchRules']>[0]['rules'] })),
  ]
}
