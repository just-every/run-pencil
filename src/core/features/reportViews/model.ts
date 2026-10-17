import { z } from 'zod'
import { resourceId } from '../../shared/validation'
import { crosstabInputSchema, type CrossTabInput, type CrossTabReport } from '../reporting/crosstabs'

export const reportViewLimit = 20
export const reportViewCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  definition: crosstabInputSchema.omit({ cutoff: true }),
  cutoff: z.string().datetime({ offset: true }).optional(),
}).strict()
export const reportDashboardSchema = z.object({
  version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  viewIds: z.array(resourceId).max(reportViewLimit).refine(ids => new Set(ids).size === ids.length),
}).strict()
export type ReportViewCreate = z.infer<typeof reportViewCreateSchema>
export type ReportViewDefinition = Omit<CrossTabInput, 'cutoff'>
export type ReportView = {
  id: string; name: string; definition: ReportViewDefinition; cutoff: string; snapshot: CrossTabReport
  createdAt: string; createdBy: { id: string; name: string } | null
}
export type ReportDashboard = { version: number; views: ReportView[] }
export type ReportViewRow = {
  id: string; name: string; definitionJson: string; cutoff: string; snapshotJson: string
  createdAt: string; creatorId: string | null; creatorName: string | null
}
export type ReportViewScope = { workspaceId: string; flowId: string; operatorId: string }
