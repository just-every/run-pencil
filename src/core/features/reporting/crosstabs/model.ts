import { collectorId } from '../../collectors'
import { z } from 'zod'
import { resourceId } from '../../../shared/validation'
import { calendarDate } from '../../../shared/questionTypes'
import { workflowTag } from '../../submissions'

export const dimensionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('question'), stepId: resourceId }).strict(),
  z.object({ kind: z.literal('collector') }).strict(),
])
export const crosstabFilterSchema = z.object({
  workflowStatus: resourceId.optional(), workflowAssignee: resourceId.optional(), workflowTag: workflowTag.optional(),
  collectorId: collectorId.optional(), revisionId: resourceId.optional(),
  source: z.enum(['direct','embed','invitation','unknown','imported']).optional(),
  participantStatus: z.enum(['eligible','opted-out','bounced']).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  answerStepId: resourceId.optional(), answerValue: z.string().max(5000).optional(),
}).strict()
export const crosstabInputSchema = z.object({
  revisionId: resourceId, row: dimensionSchema, column: dimensionSchema,
  filter: crosstabFilterSchema.optional(),
  cutoff: z.string().datetime({ offset: true }).refine(value => calendarDate(value.slice(0, 10))).optional(),
}).strict()
export type Dimension = z.infer<typeof dimensionSchema>
export type CrossTabInput = z.infer<typeof crosstabInputSchema>
export type Bucket = { key: string; value: string | number | boolean; label: string }
export type DimensionOption = { dimension: Dimension; label: string; questionType: string | null; multiple: boolean; buckets: Bucket[] }
export type CrossTabOptions = {
  flow: { id: string; title: string }
  revision: { id: string; number: number; publishedAt: string }
  dimensions: DimensionOption[]
  disclosureThreshold: number
}
export type Margin = Bucket & { pairedRespondents: number | null; suppressed: boolean }
export type CrossTabCell = { rowKey: string; columnKey: string; count: number | null; rowPercent: number | null; columnPercent: number | null; suppressed: boolean }
export type ChiSquare = { eligible: boolean; statistic: number | null; df: number | null; minimumExpected: number | null; reason: string; expectedCondition: string }
export type CrossTabReport = Omit<CrossTabOptions, 'dimensions'> & {
  cutoff: string; filter: NonNullable<CrossTabInput['filter']>
  row: DimensionOption; column: DimensionOption
  rows: Margin[]; columns: Margin[]; cells: CrossTabCell[]
  totalRespondents: number | null; pairedRespondents: number | null; unpairedRespondents: number | null
  percentages: string
  disclosure: { suppressed: boolean; threshold: number; note: string }
  chiSquare: ChiSquare
}
export const bucket = (value: Bucket['value'], label: string): Bucket => ({ key: JSON.stringify(value), value, label })
export const dimensionKey = (dimension: Dimension) => dimension.kind === 'collector' ? 'collector' : `question:${dimension.stepId}`
