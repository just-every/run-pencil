import type { ActionReminders } from './reminders'
import { z } from 'zod'
import { resourceId } from '../../shared/validation'
import { actionStates, type ActionState, type Verdict } from './states'
export * from './states'

const text = (maximum: number) => z.string().trim().min(1).max(maximum).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)
const instant = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString())
const finite = z.number().finite().min(-1e12).max(1e12)

export const metricSchema = z.object({
  name: text(120), unit: text(40), direction: z.enum(['increase', 'decrease']),
  baselineValue: finite, baselineSource: text(300), baselineObservedAt: instant,
}).strict()
export const actionFieldsSchema = z.object({
  title: text(200), rationale: text(4000), ownerOperatorId: resourceId, reviewDate: calendarDate, metric: metricSchema,
}).strict()
export const createActionSchema = actionFieldsSchema.extend({
  evidence: z.object({ flowId: resourceId, revisionId: resourceId, questionId: resourceId.optional() }).strict(),
  // ACT-008 / ANLY-006: an action an operator makes from an analysis's recommendation names that analysis.
  analysisId: resourceId.optional(),
}).strict()
export const editActionSchema = actionFieldsSchema.partial().extend({ expectedVersion: z.number().int().min(1) }).strict()
export const transitionSchema = z.object({ to: z.enum(actionStates), note: z.string().trim().max(2000).optional(), expectedVersion: z.number().int().min(1).optional() }).strict()
export const measurementSchema = z.object({ flowId: resourceId, revisionId: resourceId.optional(), observedValue: finite, unit: text(40), observedAt: instant }).strict()

export type ActionFields = z.infer<typeof actionFieldsSchema>
export type CreateActionInput = z.infer<typeof createActionSchema>
export type EditActionInput = z.infer<typeof editActionSchema>

/** Frozen aggregate figures: counts with the numerator and denominator they came from, never answers. */
export type EvidenceFigures = {
  flowTitle: string
  revisionNumber: number
  completedResponses: number
  starts: number
  question?: { prompt: string; questionType: string; reached: number; answered: number; counts: Array<{ label: string; count: number; of: number }>; countLabel: string }
}

export type ActionSummary = {
  id: string; title: string; state: ActionState; verdict: Verdict | null
  owner: { id: string; displayName: string } | null
  metric: { name: string; unit: string; direction: 'increase' | 'decrease' }
  reviewDate: string; reviewDue: boolean; updatedAt: string
}
export type ActionEvent = {
  id: string; kind: 'created' | 'transition' | 'edited' | 'measurement'; fromState: ActionState | null; toState: ActionState | null
  note: string | null; changes: Record<string, { from: unknown; to: unknown }> | null; operator: string | null; createdAt: string
  preparedBy?: { agent: { id: string; name: string }; for: { id: string; name: string } }
  approvers?: Array<{ id: string; name: string }>
}
export type Measurement = { id: string; flowId: string; flowTitle: string; revisionId: string | null; revisionNumber: number | null; observedValue: number; unit: string; observedAt: string; operator: string | null; createdAt: string; difference: number; direction: 'desired' | 'undesired' | 'unchanged' }
export type ActionDetail = ActionSummary & {
  reminders: ActionReminders
  rationale: string; source: 'manual' | 'analysis'; analysisId: string | null; version: number
  metric: ActionSummary['metric'] & { baselineValue: number; baselineSource: string; baselineObservedAt: string }
  evidence: { flowId: string; revisionId: string; questionId: string | null; figures: EvidenceFigures; capturedAt: string }
  legalTransitions: ActionState[]
  measurements: Measurement[]
  history: ActionEvent[]
  createdAt: string
}
