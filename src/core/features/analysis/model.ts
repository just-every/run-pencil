import { z } from 'zod'

export const runStates = ['queued', 'running', 'completed', 'insufficient_evidence', 'failed'] as const
export type RunState = typeof runStates[number]
export const levels = ['low', 'medium', 'high'] as const
export type Level = typeof levels[number]

/** analysis.disclosure.v1 and recommendation.selection.v1 as one run evaluated them (ANLY-015). */
export type PolicySnapshot = {
  disclosure: { policy: 'analysis.disclosure.v1'; threshold: number }
  selection: { policy: 'recommendation.selection.v1'; rule: 'highest-impact' }
}
export type Policies = { autorunEnabled: boolean; autorunMinimum: number; disclosureThreshold: number; selection: 'highest-impact' }
export const defaultPolicies: Policies = { autorunEnabled: true, autorunMinimum: 5, disclosureThreshold: 5, selection: 'highest-impact' }
export const policySnapshot = (policies: Policies): PolicySnapshot => ({
  disclosure: { policy: 'analysis.disclosure.v1', threshold: policies.disclosureThreshold },
  selection: { policy: 'recommendation.selection.v1', rule: policies.selection },
})
export const policiesSchema = z.object({
  autorunEnabled: z.boolean(), autorunMinimum: z.number().int().min(1).max(100000),
  disclosureThreshold: z.number().int().min(1).max(1000), selection: z.literal('highest-impact'),
}).strict()

/** Operators may select text and numeric score questions; an email question is an identifier and never leaves. */
export const analysableTypes = ['short_text', 'long_text', 'nps', 'csat', 'ces', 'rating'] as const

export const contradictionKinds = ['score_text', 'revision_reversal', 'collector_reversal', 'segment_reversal', 'within_response'] as const
const excerptSchema = z.object({ responseId: z.string().min(1).max(200), questionId: z.string().min(1).max(200), start: z.number().int().min(0), end: z.number().int().min(1), text: z.string().min(1).max(2000) }).strict()
export const contradictionSchema = z.object({
  kind: z.enum(contradictionKinds), summary: z.string().min(1).max(2000),
  sides: z.array(z.object({cohort:z.string().min(1).max(200),responseIds:z.array(z.string().min(1).max(200)).min(1).max(100000),quotes:z.array(excerptSchema).min(1).max(20)}).strict()).min(2).max(10),
}).strict()
export type Contradiction = z.infer<typeof contradictionSchema>

/** The strict JSON schema the provider must answer with (ANLY-012). Respondent text is data, never instructions (ANLY-014). */
export const outputJsonSchema = {
  type: 'object', additionalProperties: false, required: ['outcome', 'reason', 'themes', 'recommendations', 'contradictions'],
  properties: {
    outcome: { type: 'string', enum: ['findings', 'insufficient_evidence'] },
    reason: { type: 'string' },
    themes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'summary', 'responseIds', 'count', 'quotes'], properties: {
      title: { type: 'string' }, summary: { type: 'string' },
      responseIds: { type: 'array', items: { type: 'string' } }, count: { type: 'integer' },
      quotes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['responseId', 'questionId', 'start', 'end', 'text'], properties: {
        responseId: { type: 'string' }, questionId: { type: 'string' }, start: { type: 'integer' }, end: { type: 'integer' }, text: { type: 'string' } } } },
    } } },
    contradictions: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['kind','summary','sides'], properties: {
      kind: {type:'string',enum:[...contradictionKinds]}, summary:{type:'string'}, sides:{type:'array',minItems:2,maxItems:10,items:{type:'object',additionalProperties:false,required:['cohort','responseIds','quotes'],properties:{
        cohort:{type:'string'},responseIds:{type:'array',items:{type:'string'}},quotes:{type:'array',minItems:1,items:{type:'object',additionalProperties:false,required:['responseId','questionId','start','end','text'],properties:{responseId:{type:'string'},questionId:{type:'string'},start:{type:'integer'},end:{type:'integer'},text:{type:'string'}}}}
      }}}
    }}},
    recommendations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'rationale', 'themeIndexes', 'confidence', 'expectedImpact', 'effort'], properties: {
      title: { type: 'string' }, rationale: { type: 'string' }, themeIndexes: { type: 'array', items: { type: 'integer' } },
      confidence: { type: 'string', enum: [...levels] }, expectedImpact: { type: 'string', enum: [...levels] }, effort: { type: 'string', enum: [...levels] } } } },
  },
} as const

const text = (maximum: number) => z.string().min(1).max(maximum)
export const providerOutputSchema = z.object({
  outcome: z.enum(['findings', 'insufficient_evidence']),
  reason: z.string().max(2000),
  themes: z.array(z.object({
    title: text(200), summary: z.string().max(2000),
    responseIds: z.array(text(200)).max(100000), count: z.number().int().min(0),
    quotes: z.array(z.object({ responseId: text(200), questionId: text(200), start: z.number().int().min(0), end: z.number().int().min(1), text: text(2000) }).strict()).max(20),
  }).strict()).max(20),
  contradictions: z.array(contradictionSchema).max(20).optional(),
  recommendations: z.array(z.object({
    title: text(200), rationale: z.string().max(4000), themeIndexes: z.array(z.number().int().min(0)).max(20),
    confidence: z.enum(levels), expectedImpact: z.enum(levels), effort: z.enum(levels),
  }).strict()).max(10),
}).strict()
export type ProviderOutput = z.infer<typeof providerOutputSchema>

export const requestRunSchema = z.object({
  flowId: z.string().min(1).max(200), revisionId: z.string().min(1).max(200), questionIds: z.array(z.string().min(1).max(200)).min(1).max(50).optional(),
}).strict()
export type RequestRunInput = z.infer<typeof requestRunSchema>

/** A run's failure, as stored and shown with its retry action (ANLY-008). */
export class AnalysisFailure extends Error {
  constructor(readonly code: string, message: string, readonly transient = false) { super(message) }
}
