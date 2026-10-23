import type { DeliverySummary, EndpointSummary } from '../model'
import type { WebhookAlert } from '../endpoints'
import type { LedgerDelivery } from '../ledger'

export type { DeliverySummary, EndpointSummary, LedgerDelivery, WebhookAlert }

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const data = response.status === 204 ? ({} as T) : await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error((data as { message?: string }).message ?? 'The webhook request failed.')
  return data
}

/** Fired by the endpoints card so the operator banner refreshes at once. */
export const webhooksChanged = 'pencil:webhooks-changed'
const base = '/api/app/webhooks'
export const webhooksApi = {
  list: () => call<{ endpoints: EndpointSummary[] }>(base),
  alerts: () => call<{ alerts: WebhookAlert[] }>(`${base}/alerts`),
  deliveries: (endpointId: string) => call<{ deliveries: DeliverySummary[] }>(`${base}/deliveries?endpointId=${encodeURIComponent(endpointId)}`),
  undelivered: (endpointId: string) => call<{ responses: Array<{ responseId: string; status: string }> }>(`${base}/${encodeURIComponent(endpointId)}/undelivered`),
  ledger: (state?: LedgerDelivery['state']) => call<{ deliveries: LedgerDelivery[] }>(`/api/app/integration-deliveries${state ? `?state=${state}` : ''}`),
  create: (input: { url: string; flowId?: string }) => call<{ endpoint: EndpointSummary; secret: string }>(base, 'POST', input),
  rotate: (id: string) => call<{ endpoint: EndpointSummary; secret: string }>(`${base}/${encodeURIComponent(id)}/rotate`, 'POST', {}),
  setActive: (id: string, active: boolean) => call<{ endpoint: EndpointSummary }>(`${base}/${encodeURIComponent(id)}/${active ? 'resume' : 'pause'}`, 'POST', {}),
  remove: (id: string) => call<unknown>(`${base}/${encodeURIComponent(id)}`, 'DELETE', {}),
  test: (id: string) => call<{ delivery: DeliverySummary }>(`${base}/${encodeURIComponent(id)}/test`, 'POST', {}),
  replay: (deliveryId: string) => call<{ delivery: DeliverySummary }>(`${base}/deliveries/${encodeURIComponent(deliveryId)}/replay`, 'POST', {}),
}
