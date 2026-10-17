import type { SubmissionBulkInput, SubmissionDetail, SubmissionOptions, SubmissionRead, SubmissionStatus } from '../model'
async function call<T>(path: string, body?: unknown): Promise<T> {
 const response = await fetch(path, { credentials: 'same-origin', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
 const value = await response.json() as T & { message?: string }
 if (!response.ok) throw new Error(value.message ?? 'Submission handling could not complete. Refresh and try again.')
 return value
}
const base = (id: string) => `/api/app/flows/${encodeURIComponent(id)}/submissions`
export const submissionsApi = {
 options: (id: string) => call<SubmissionOptions>(base(id)+'/options'),
 read: (id: string, responseIds: string[]) => call<SubmissionRead>(base(id)+'/read', { responseIds }),
 detail: (id: string, responseId: string, offset = 0) => call<SubmissionDetail>(base(id)+'/'+encodeURIComponent(responseId)+'?notesOffset='+offset),
 update: (id: string, input: SubmissionBulkInput) => call<SubmissionRead>(base(id)+'/bulk', input),
 createStatus: (id: string, name: string) => call<{status: SubmissionStatus}>(base(id)+'/statuses', { name }),
}
