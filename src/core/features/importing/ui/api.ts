import type { ImportInput, ImportReview } from '../model'
import { readReviewStream, reviewMediaType } from '../review-stream'
export type Job = { id: string; state: string; checkpoint: number; total: number; error: string | null; erasedRecords?: number }
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/app/imports${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(result.message ?? 'The import request failed. No unconfirmed progress is assumed; reload import history to inspect the durable checkpoint.')
  return result
}
export const importsApi = {
  async review(input: ImportInput): Promise<ImportReview> {
    const response = await fetch('/api/app/imports/review', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: reviewMediaType }, body: JSON.stringify(input) })
    if (!response.ok) throw new Error((await response.json() as { message?: string }).message ?? 'The import review failed.')
    if (!response.body || !response.headers.get('Content-Type')?.startsWith(reviewMediaType)) throw new Error('The import review format is unavailable.')
    return readReviewStream(response.body)
  },
  commit: (input: ImportInput, fingerprint: string) => request<Job>('/commit', { ...input, fingerprint, acknowledged: true }),
  cancelStaging: (fingerprint: string) => request<{ cancelled: true } | { cancelled: false; job: Job }>('/cancel-staging', { fingerprint }),
  list: () => request<Job[]>(''),
  resume: (id: string) => request<Job>(`/${id}/resume`, {}),
  undo: (id: string) => request<Job>(`/${id}/undo`, {}),
}
