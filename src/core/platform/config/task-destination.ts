// Reads the optional `task.destination.v1` settings (WS-003). Only the platform layer reads environment bindings.
export type TaskDestinationConfiguration =
  | { kind: 'webhook'; url: string; apiKey: string; allowLoopbackHttp: boolean }
  | { kind: 'unavailable'; message: string }

const setup = 'Choose Todoist or a custom receiver under External task → Connection, save it, then send a test task.'
export const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** WS-003: the adapter is optional. Absent or invalid settings leave everything else working and say what to set. */
export function readTaskDestination(environment: { TASK_PROVIDER?: string; TASK_WEBHOOK_URL?: string; TASK_API_KEY?: string }, localRuntime: boolean): TaskDestinationConfiguration {
  const provider = environment.TASK_PROVIDER?.trim()
  if (!provider) return { kind: 'unavailable', message: `External tasks are not set up. ${setup}` }
  if (provider !== 'webhook') return { kind: 'unavailable', message: `TASK_PROVIDER must be webhook; no other task system is included. ${setup}` }
  const missing = (['TASK_WEBHOOK_URL', 'TASK_API_KEY'] as const).filter(name => !environment[name]?.trim())
  if (missing.length) return { kind: 'unavailable', message: `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing. ${setup}` }
  const apiKey = environment.TASK_API_KEY!.trim()
  if (/[\r\n]/.test(apiKey)) return { kind: 'unavailable', message: 'TASK_API_KEY must not contain line breaks.' }
  let url: URL
  try { url = new URL(environment.TASK_WEBHOOK_URL!.trim()) } catch { return { kind: 'unavailable', message: 'TASK_WEBHOOK_URL must be an absolute https URL.' } }
  if (url.username || url.password) return { kind: 'unavailable', message: 'TASK_WEBHOOK_URL must not contain credentials; the key goes in TASK_API_KEY.' }
  const loopbackHttp = localRuntime && url.protocol === 'http:' && loopbackHosts.has(url.hostname)
  if (url.protocol !== 'https:' && !loopbackHttp) return { kind: 'unavailable', message: 'TASK_WEBHOOK_URL must use https. Plain http is accepted only for a loopback receiver in local development and tests.' }
  return { kind: 'webhook', url: url.href, apiKey, allowLoopbackHttp: localRuntime }
}
