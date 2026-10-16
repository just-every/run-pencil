import type { TaskPayload } from './task-destination'

export const todoistEndpoint = 'https://api.todoist.com/api/v1/sync'
export const isTodoist = (url?: string) => url === todoistEndpoint

// Stable command and temporary resource UUIDs survive retries and archive restoration.
async function uuid(key: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))).slice(0, 16)
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function todoistRequest(payload: TaskPayload) {
  const action = payload.action, metric = action.metric
  return { commands: [{ type: 'item_add', uuid: await uuid(payload.idempotencyKey), temp_id: await uuid(`resource:${payload.idempotencyKey}`), args: {
    content: action.title,
    description: `${action.rationale}\n\nOwner: ${action.owner.name} (${action.owner.email})\nMetric: ${metric.name} (${metric.unit}; ${metric.direction})\nBaseline: ${metric.baseline.value} — ${metric.baseline.source} — ${metric.baseline.observedAt}\nReview date: ${action.reviewDate}\nPencil: ${action.reportLink}`,
    due: { date: action.reviewDate },
  } }] }
}
