export type Contact = { id: string; name: string; email: string; fields: Record<string, string>; optedOutAt: string | null }
export type Rule = { field: 'name' | 'emailDomain' | 'consent' | 'custom'; key?: string; operator: 'is' | 'contains' | 'is-set'; value?: string }
export type Segment = { id: string; name: string; rules: Rule[]; matchCount: number }
export type ImportReport = { rows: Array<{ row: number; status: string; match?: string; message?: string }>; counts: { added: number; matched: number; updated: number; invalid: number; overLimit: number }; committed: boolean }
export type ErasureReceipt = { completed: true; counts: Record<string, number>; elapsedMilliseconds: number }
export type Launch = { id: string; commandKey: string; revisionId: string; complete: boolean; resumable: boolean; state: 'complete' | 'processing' | 'recovery-required'; counts: { invited: number; alreadyInvited: number; optedOut: number; noAddress: number; policyExcluded: number; pending: number } }
export async function audienceRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, body === undefined ? undefined : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = response.status === 204 ? undefined : await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(data?.message ?? 'The audience request failed.')
  return data as T
}
export const contactsPath = '/api/app/distribution/contacts'
export const segmentsPath = '/api/app/distribution/segments'
export function launchSummary(launch: Launch) {
  const c = launch.counts
  return `${c.invited} invited · ${c.alreadyInvited} already invited · ${c.optedOut} opted out · ${c.noAddress} no address · ${c.policyExcluded} excluded by policy · ${c.pending} pending processing`
}
