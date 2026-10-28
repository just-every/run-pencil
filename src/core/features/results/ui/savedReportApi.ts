import type { SavedDashboard, SavedReportShare, SavedView, SavedViewDefinition, SavedViewDetail, SharedReport } from '../../reporting/savedModel'

export async function reportRequest<T>(path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
  if (!response.ok) {
    const problem = await response.json() as { message?: string }
    throw new Error(problem.message ?? 'The report could not be loaded.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export const savedReportApi = {
  allViews: () => reportRequest<SavedView[]>('/api/app/saved-views'),
  list: (flowId: string) => reportRequest<SavedView[]>(`/api/app/flows/${flowId}/saved-views`),
  save: (flowId: string, definition: SavedViewDefinition) => reportRequest<SavedViewDetail>(`/api/app/flows/${flowId}/saved-views`, definition),
  open: (id: string) => reportRequest<SavedViewDetail>(`/api/app/saved-views/${id}`),
  shares: (id: string) => reportRequest<SavedReportShare[]>(`/api/app/saved-views/${id}/shares`),
  share: (id: string, input: { password?: string; expiresAt?: string }) => reportRequest<{ share: SavedReportShare; token: string; url: string }>(`/api/app/saved-views/${id}/shares`, input),
  revoke: (id: string) => reportRequest<void>(`/api/app/report-shares/${id}`, undefined, 'DELETE'),
  dashboards: () => reportRequest<SavedDashboard[]>('/api/app/report-dashboards'),
  dashboard: (id: string) => reportRequest<{ dashboard: SavedDashboard; views: SavedViewDetail[] }>(`/api/app/report-dashboards/${id}`),
  arrange: (id: string, input: { name: string; scope: 'form' | 'program'; flowId?: string; viewIds: string[] }) => reportRequest<SavedDashboard>(`/api/app/report-dashboards${id ? `/${id}` : ''}`, input, id ? 'PUT' : 'POST'),
}
export type { SharedReport }
