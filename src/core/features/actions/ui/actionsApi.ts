import type { ActionDetail, ActionState, ActionSummary } from '../model'
import type { TaskStatus } from '../deliveries'
import type { TaskPayload } from '../task-destination'

export type { ActionDetail, ActionState, ActionSummary, TaskStatus, TaskPayload }
export type ActionView = ActionDetail & { task: TaskStatus }
export type TaskPreview = TaskStatus & { payload?: TaskPayload; payloadSha256?: string }
export type ActionFieldsInput = { title: string; rationale: string; ownerOperatorId: string; reviewDate: string; metric: { name: string; unit: string; direction: 'increase' | 'decrease'; baselineValue: number; baselineSource: string; baselineObservedAt: string } }

export async function actionRequest<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const data = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'The action request failed.')
  return data
}

export const actionsApi = {
  list: () => actionRequest<{ today: string; actions: ActionSummary[] }>('/api/app/actions'),
  get: (id: string) => actionRequest<ActionView>(`/api/app/actions/${encodeURIComponent(id)}`),
  create: (input: ActionFieldsInput & { evidence: { flowId: string; revisionId: string; questionId?: string } }) => actionRequest<ActionView>('/api/app/actions', input),
  edit: (id: string, input: Partial<ActionFieldsInput> & { expectedVersion: number }) => actionRequest<ActionView>(`/api/app/actions/${encodeURIComponent(id)}`, input, 'PATCH'),
  move: (id: string, to: ActionState, note: string, expectedVersion: number) => actionRequest<ActionView>(`/api/app/actions/${encodeURIComponent(id)}/transitions`, { to, ...(note.trim() ? { note } : {}), expectedVersion }),
  measure: (id: string, input: { flowId: string; revisionId?: string; observedValue: number; unit: string; observedAt: string }) => actionRequest<ActionView>(`/api/app/actions/${encodeURIComponent(id)}/measurements`, input),
  task: (id: string) => actionRequest<TaskPreview>(`/api/app/actions/${encodeURIComponent(id)}/task`),
  confirmTask: (id: string, payloadSha256: string) => actionRequest<TaskStatus>(`/api/app/actions/${encodeURIComponent(id)}/task/confirm`, { payloadSha256 }),
  retryTask: (id: string) => actionRequest<TaskStatus>(`/api/app/actions/${encodeURIComponent(id)}/task/retry`, {}),
}

export const directionLabel = (direction: 'increase' | 'decrease') => direction === 'increase' ? 'Higher is better' : 'Lower is better'
export const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
