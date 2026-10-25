import type { BuilderDraft, FlowStep } from '../app/api'
import { calculationOperands } from './calculationInputs'
import { conditionShape, conditionValueValid } from './conditionValidation'
import { conditionTests, remapCondition, type Condition } from './conditions'
import { hiddenOperands } from './hiddenFields'

export type AnswerAlertRule = { id: string; name: string; condition: Condition; recipientIds: string[]; chatPlatforms?: Array<'slack'|'teams'> }
export const paymentStateOperand: FlowStep = { id: 'payment:state', position: -1, kind: 'question', questionType: 'short_text', prompt: 'Payment state', helperText: null, required: false, nextStepId: null, questionSettings: null }
export function answerAlertsIssue(value: unknown): string | undefined {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 20) return 'Choose at most 20 answer alert rules.'
  const ids = new Set<string>()
  for (const rule of value) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || Object.keys(rule).some(key => !['id','name','condition','recipientIds','chatPlatforms'].includes(key))
      || typeof rule.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(rule.id) || ids.has(rule.id)
      || typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 100 || !conditionShape(rule.condition)
      || !Array.isArray(rule.recipientIds) || !rule.recipientIds.length || rule.recipientIds.length > 100
      || rule.recipientIds.some((id: unknown) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(id))
      || new Set(rule.recipientIds).size !== rule.recipientIds.length
      || (rule.chatPlatforms !== undefined && (!Array.isArray(rule.chatPlatforms) || rule.chatPlatforms.length > 2 || rule.chatPlatforms.some((platform:unknown) => platform !== 'slack' && platform !== 'teams') || new Set(rule.chatPlatforms).size !== rule.chatPlatforms.length))) return 'Each alert needs a distinct ID, a name, a valid condition and named operator recipients.'
    ids.add(rule.id)
  }
}
/** Field guidance for the editor; the boundary validator above remains authoritative. */
export function answerAlertFieldIssues(rule: AnswerAlertRule, draft: Pick<BuilderDraft,'steps'|'choices'|'formSettings'>): Partial<Record<'name'|'recipientIds'|'condition',string>> {
  const issues: Partial<Record<'name'|'recipientIds'|'condition',string>> = {}
  if (!rule.name.trim() || rule.name.length > 100) issues.name = 'Name this alert.'
  if (!rule.recipientIds.length || rule.recipientIds.length > 100 || rule.recipientIds.some(id => !/^[A-Za-z0-9_-]{1,256}$/.test(id)) || new Set(rule.recipientIds).size !== rule.recipientIds.length) issues.recipientIds = 'Choose at least one recipient.'
  if (!conditionShape(rule.condition) || answerAlertPublicationIssues([rule],draft).length) issues.condition = 'Complete this alert’s condition.'
  return issues
}
export function answerAlertPublicationIssues(rules: AnswerAlertRule[] | undefined, draft: Pick<BuilderDraft,'steps'|'choices'|'formSettings'>) {
  const operands = [...draft.steps, ...hiddenOperands(draft.formSettings?.hiddenFields ?? []), ...calculationOperands(draft.formSettings?.calculations ?? []), paymentStateOperand]
  return (rules ?? []).flatMap(rule => conditionTests(rule.condition).flatMap(test => {
    const step = operands.find(step => step.id === test.stepId)
    return !step || step.kind !== 'question' || !conditionValueValid(test, step, draft.choices)
      ? [{ stepId: `alert:${rule.id}`, reason: `${rule.name}: the alert references a missing operand or an incompatible condition value.` }] : []
  }))
}
export function remapAnswerAlerts(rules: AnswerAlertRule[] | undefined, steps: ReadonlyMap<string,string>, choices: ReadonlyMap<string,string>) {
  return rules?.map(rule => ({...rule, id: crypto.randomUUID(), recipientIds: [...rule.recipientIds], condition: remapCondition(rule.condition, steps, choices)}))
}
