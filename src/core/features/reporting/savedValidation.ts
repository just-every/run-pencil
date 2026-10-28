import { z } from 'zod'
import { resourceId } from '../../shared/validation'
import { ledgerFilterSchema } from './filter'
import { dimensionPattern } from './crosstabDimensions'

const name = z.string().trim().min(1).max(200)
const dimension = z.string().regex(dimensionPattern)
export const savedViewInput = z.object({
  name, revisionId: resourceId, filter: ledgerFilterSchema.default({ offset: 0 }),
  cohorts: z.array(z.object({ id: resourceId, name, filter: ledgerFilterSchema })).max(8).default([]),
  crosstabs: z.array(z.object({ id: resourceId, rows: dimension, columns: dimension })).max(12).default([]),
  charts: z.array(resourceId).max(100).default([]),
}).superRefine((value, context) => {
  if (new Set(value.cohorts.map(item => item.id)).size !== value.cohorts.length || value.cohorts.some(item => item.id === 'selection')) context.addIssue({ code: 'custom', message: 'Give each compared cohort a distinct ID.' })
  if (new Set(value.crosstabs.map(item => item.id)).size !== value.crosstabs.length) context.addIssue({ code: 'custom', message: 'Give each crosstab a distinct ID.' })
  if (value.filter.revisionId && value.filter.revisionId !== value.revisionId) context.addIssue({ code: 'custom', message: 'The selected filter must use the saved revision.' })
})
export const dashboardInput = z.object({ name, scope: z.enum(['form', 'program']), flowId: resourceId.optional(), viewIds: z.array(resourceId).max(24) }).superRefine((value, context) => {
  if ((value.scope === 'form') !== Boolean(value.flowId)) context.addIssue({ code: 'custom', message: 'Choose a form for a form dashboard.' })
  if (new Set(value.viewIds).size !== value.viewIds.length) context.addIssue({ code: 'custom', message: 'Include each view once in a dashboard.' })
})
export const shareInput = z.object({ password: z.string().min(1).max(4096).optional(), expiresAt: z.string().datetime().optional() })
