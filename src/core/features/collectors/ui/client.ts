import type { collectorState } from '../model'
export type Collector = ReturnType<typeof collectorState> & { publicPath: string | null; embedPath: string | null }
export async function collectorRequest<T>(path: string, data?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, data === undefined ? undefined : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
  const body = response.status === 204 ? undefined : await response.json() as { message?: string } & T
  if (!response.ok) throw new Error(body?.message ?? 'The collector request failed.')
  return body as T
}
export const collectorsPath = (flowId: string) => `/api/app/flows/${encodeURIComponent(flowId)}/collectors`
