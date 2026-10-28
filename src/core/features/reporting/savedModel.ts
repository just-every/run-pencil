import type { LedgerFilter } from './repository'
import type { Crosstab } from './crosstab'

export type SavedViewDefinition = {
  name: string
  revisionId: string
  filter: LedgerFilter
  cohorts: Array<{ id: string; name: string; filter: LedgerFilter }>
  crosstabs: Array<{ id: string; rows: string; columns: string }>
  charts: string[]
}
export type SavedView = {
  id: string; name: string; flowId: string; revisionId: string; cutoff: string; threshold: number
  savedBy: { id: string; name: string }; createdAt: string; definition: SavedViewDefinition
}
export type SharedQuestion = {
  id: string; prompt: string; questionType: string; answered: number; unanswered: number
  multipleSelect: boolean; distribution: Array<{ label: string; count: number }>
  note?: string
}
export type SharedCrosstab = { id: string } & (
  { withheld: true; reason: string } | { withheld: false; table: Crosstab }
)
export type SharedCohort = {
  id: string; name: string; responseCount: number; breakdownWithheld: boolean; reason?: string
  questions: SharedQuestion[]; crosstabs: SharedCrosstab[]
}
export type SharedReport = {
  name: string; cutoff: string; threshold: number; policy: 'analysis.disclosure.v1'
  protectionNotice: string; charts: string[]; cohorts: SharedCohort[]
}
export type SavedViewDetail = { view: SavedView; report: SharedReport }
export type SavedReportShare = {
  id: string; viewId: string; passwordRequired: boolean; expiresAt: string | null
  revokedAt: string | null; createdAt: string
}
export type SavedDashboard = {
  id: string; name: string; scope: 'form' | 'program'; flowId: string | null
  viewIds: string[]; savedBy: { id: string; name: string }; createdAt: string; updatedAt: string
}
