import type { RunDetail, RunSummary, ThemeView } from '../repository'
import type { Policies } from '../model'

export type { RunDetail, RunSummary, ThemeView, Policies }
export type ProviderStatus = { state: 'on'; origin: string; model: string; transport: 'direct' | 'models' | 'dev' | 'demo'; costReported: boolean } | { state: 'off' | 'misconfigured'; setup: string }
export type UsageRow = { day: string; feature: string; calls: number; inputTokens: number | null; outputTokens: number | null; unknownInputCalls: number; unknownOutputCalls: number; costMicrousd: number | null; unreportedCalls: number }
export type AnalysisOptions = { flow: { id: string; title: string }; revisions: Array<{ id: string; number: number; isCurrent: boolean; completed: number; questions: Array<{ id: string; prompt: string; questionType: string }> }>; provider: ProviderStatus; policies: Policies }
export type ThemeResponses = { timeZone: string; flowId: string; theme: { id: string; rank: number; title: string }; responses: Array<{ id: string; completedAt: string; source: string; answers: Array<{ questionId: string; prompt: string; text: string }> }> }

async function request<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const data = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'The analysis request failed.')
  return data
}

export const analysisApi = {
  overview: () => request<{ timeZone: string; provider: ProviderStatus; policies: Policies; runs: RunSummary[]; usage: UsageRow[] }>('/api/app/analysis'),
  options: (flowId: string) => request<AnalysisOptions>(`/api/app/analysis/options?flowId=${encodeURIComponent(flowId)}`),
  request: (input: { flowId: string; revisionId: string; questionIds: string[] }) => request<RunDetail>('/api/app/analysis', input),
  get: (id: string) => request<RunDetail>(`/api/app/analysis/${encodeURIComponent(id)}`),
  retry: (id: string) => request<RunDetail>(`/api/app/analysis/${encodeURIComponent(id)}/retry`, undefined, 'POST'),
  themeResponses: (id: string, themeId: string) => request<ThemeResponses>(`/api/app/analysis/${encodeURIComponent(id)}/themes/${encodeURIComponent(themeId)}/responses`),
  setPolicies: (policies: Policies) => request<Policies>('/api/app/analysis/policies', policies, 'PUT'),
}

export const stateLabels: Record<RunSummary['state'], string> = { queued: 'Queued', running: 'Running', completed: 'Completed', insufficient_evidence: 'Insufficient evidence', failed: 'Failed' }
export const shortId = (id: string) => `${id.slice(0, 3)}…${id.slice(-2)}`
export const when = (iso: string, timeZone: string) => new Date(iso).toLocaleString(undefined, { timeZone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const transportLabel = (transport: string) => transport === 'demo' ? 'Demo' : transport === 'models' ? 'Models service' : transport === 'dev' ? 'Local dev double' : 'Direct key'
export function costLabel(calls: Array<{ inputTokens: number | null; outputTokens: number | null; costMicrousd: number | null }>) {
  const input = calls.reduce((sum, call) => sum + (call.inputTokens ?? 0), 0), output = calls.reduce((sum, call) => sum + (call.outputTokens ?? 0), 0)
  const priced = calls.filter(call => call.costMicrousd !== null), cost = priced.reduce((sum, call) => sum + call.costMicrousd!, 0)
  const tokens = `${input.toLocaleString()} in / ${output.toLocaleString()} out known tokens${calls.some(call => call.inputTokens === null || call.outputTokens === null) ? ' + unreported usage' : ''}`
  return priced.length ? `${tokens} · US$${(cost / 1_000_000).toFixed(4)}${priced.length < calls.length ? ` + ${calls.length - priced.length} calls with unreported cost` : ''}` : `${tokens} · cost not reported`
}
