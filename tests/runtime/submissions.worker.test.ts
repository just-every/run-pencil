import { applyD1Migrations, env, SELF, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { developmentInbox } from '../helpers/mail-capture.mjs'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import type { BuilderDraft } from '../../src/core/app/api'
import type { SubmissionDetail, SubmissionOptions, SubmissionRead, SubmissionStatus } from '../../src/core/features/submissions/model'
import { allStoredData } from './import-privacy-fixture'
import { simpleJson, simpleCsv } from '../fixtures/form-import/fixture'
import type { ImportReview } from '../../src/core/features/importing/model'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
let cookie = '', serial = 0
const request = (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', signedIn = true) => SELF.fetch('http://localhost' + path, {
  method, headers: { Host: 'localhost', Origin: 'http://localhost', cookie: signedIn ? cookie : '', 'content-type': 'application/json', 'CF-Connecting-IP': `198.18.209.${++serial % 250}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
})
async function call<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const response = await request(path, body, method)
  expect(response.ok, response.ok ? path : `${path}: ${await response.clone().text()}`).toBe(true)
  return response.status === 204 ? undefined as T : response.json<T>()
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  await call('/health')
  const owner = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at,id LIMIT 1').first<{ email: string }>()
  expect(owner).not.toBeNull()
  await call('/auth/magic-link', { email: owner!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]
})
contract(['WORK-001', 'BASE-ACCESS-004', 'BASE-DATA-003', 'BASE-OPS-005', 'IMPORT-004', 'LEDG-002'], 'operators triage real submissions atomically, export the selected workflow cohort, and preserve annotated imports through undo and erase their private custody', async () => {
  const slug = 'northstar-submissions-' + crypto.randomUUID().slice(0, 8)
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Northstar requests', slug })
  const root = `/api/app/flows/${flow.id}`, inboxRoot = root + '/submissions'
  let draft = await call<BuilderDraft>(root + '/draft')
  await call(root + '/draft/steps', { expectedVersion: draft.flow.draftVersion, step: { kind: 'question', questionType: 'short_text', prompt: 'What do you need?', required: true } })
  draft = await call<BuilderDraft>(root + '/draft')
  const stepId = draft.steps[0].id
  await call(root + '/draft/steps', { expectedVersion: draft.flow.draftVersion, step: { kind: 'completion', questionType: null, prompt: 'Request received' } })
  draft = await call<BuilderDraft>(root + '/draft')
  await call(root + '/publish', { expectedVersion: draft.flow.draftVersion })
  const ids: string[] = []
  for (const answer of ['Repair the front door', 'Send an estimate']) {
    const session = await call<{ sessionId: string; sessionToken: string; revisionId: string }>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' })
    await env.DB.prepare('UPDATE respondent_sessions SET created_at=? WHERE id=?').bind(new Date(Date.now() - 6000).toISOString(), session.sessionId).run()
    const receipt = await call<{ responseId: string; disposition: string }>(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: 'inbox-' + session.sessionId, answers: [{ stepId, value: answer }] })
    expect(receipt.disposition).toBe('released'); expect(receipt).not.toHaveProperty('workflow')
    ids.push(receipt.responseId)
  }
  expect((await request(inboxRoot + '/options', undefined, 'GET', false)).status).toBe(401)
  const initial = await call<SubmissionRead>(inboxRoot + '/read', { responseIds: ids })
  expect(initial.submissions.every(row => row.statusId === 'new' && row.version === 0 && row.assignee === null && !row.tags.length && row.noteCount === 0)).toBe(true)
  const options = await call<SubmissionOptions>(inboxRoot + '/options'), operator = options.operators[0]
  const { status } = await call<{ status: SubmissionStatus }>(inboxRoot + '/statuses', { name: 'Awaiting estimate' })
  const note = 'Call the maintenance team before quoting.'
  const changed = await call<SubmissionRead>(inboxRoot + '/bulk', { responses: ids.map(id => ({ id, version: 0 })), changes: { statusId: status.id, assigneeId: operator.id, addTags: [' repair ', 'priority'], note } })
  for (const row of changed.submissions) expect(row).toMatchObject({ version: 1, statusId: status.id, assignee: operator, tags: ['priority', 'repair'], noteCount: 1 })
  const detail = await call<SubmissionDetail>(inboxRoot + '/' + ids[0])
  expect(detail.notes).toEqual([expect.objectContaining({ text: note, author: operator, createdAt: expect.any(String) })])
  expect((await call<SubmissionOptions>(inboxRoot + '/options')).statuses).toContainEqual(status)
  const selected = `workflowStatus=${status.id}&workflowAssignee=${operator.id}&workflowTag=repair`
  expect((await call<{ total: number }>(root + '/ledger?' + selected)).total).toBe(2)
  const frozen = await call<{ token: string }>(root + '/responses/export/start?format=json&' + selected)
  const moved = await call<SubmissionRead>(inboxRoot + '/bulk', { responses: [{ id: ids[1], version: 1 }], changes: { statusId: 'done', removeTags: ['priority'], assigneeId: null } })
  expect(moved.submissions[0]).toMatchObject({ version: 2, assignee: null, tags: ['repair'] })
  expect((await request(root + '/responses/export', { token: frozen.token })).status).toBe(400)
  let { token } = await call<{ token: string }>(root + '/responses/export/start?format=json&' + selected), output = ''
  while (token) { const part = await request(root + '/responses/export', { token }); expect(part.status).toBe(200); output += await part.text(); token = part.headers.get('x-export-next') ?? '' }
  expect(JSON.parse(output).responses.map((row: { id: string }) => row.id)).toEqual([ids[0]])
  expect((await call<{ total: number }>(root + '/ledger?workflowAssignee=unassigned')).total).toBe(1)
  const before = await call<SubmissionRead>(inboxRoot + '/read', { responseIds: ids })
  for (const input of [
    { responses: [{ id: ids[0], version: 1 }, { id: ids[1], version: 1 }], changes: { note: 'A stale bulk write must not duplicate notes', addTags: ['should-not-appear'] } },
    { responses: [{ id: ids[0], version: 1 }], changes: { assigneeId: 'foreign-operator' } },
    { responses: [{ id: ids[0], version: 1 }], changes: { statusId: 'foreign-status' } },
  ]) expect((await request(inboxRoot + '/bulk', input)).status).toBe(409)
  expect(await call<SubmissionRead>(inboxRoot + '/read', { responseIds: ids })).toEqual(before)
  expect((await call<SubmissionDetail>(inboxRoot + '/' + ids[0])).notes).toHaveLength(1)
  const other = await call<{ id: string }>('/api/app/flows', { title: 'Other requests', slug: slug + '-other' })
  expect((await request(`/api/app/flows/${other.id}/submissions/read`, { responseIds: [ids[0]] })).status).toBe(404)
  expect((await request(`/api/app/flows/${other.id}/submissions/bulk`, { responses: [{ id: ids[0], version: 1 }], changes: { note: 'Wrong form' } })).status).toBe(409)
  // Removing an operator clears live assignment and anonymises authored notes in the same removal batch.
  const reviewerEmail = `reviewer-${crypto.randomUUID()}@example.test`
  const reviewer = await call<{ id: string }>('/api/app/operators', { email: reviewerEmail, displayName: 'Maintenance reviewer' })
  const ownerCookie = cookie
  await call('/auth/magic-link', { email: reviewerEmail })
  const reviewerInbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), reviewerEmail)
  const reviewerLogin = await request('/auth/confirm', { token: reviewerInbox.messages[0].magicLinkToken })
  expect(reviewerLogin.status).toBe(303); cookie = reviewerLogin.headers.get('set-cookie')!.split(';')[0]
  await call(inboxRoot + '/bulk', { responses: [{ id: ids[1], version: 2 }], changes: { assigneeId: reviewer.id, note: 'Reviewed by maintenance.' } })
  cookie = ownerCookie
  await call(`/api/app/operators/${reviewer.id}`, undefined, 'DELETE')
  const anonymised = await call<SubmissionDetail>(inboxRoot + '/' + ids[1])
  expect(anonymised.submission).toMatchObject({ version: 4, assignee: null })
  expect(anonymised.notes.find(row => row.text === 'Reviewed by maintenance.')?.author).toBeNull()
  type AuditRow = { kind: string; actor: { id: string } | null; form: { id: string } | null; details: Record<string, unknown> }
  const audit = await call<{ rows: AuditRow[] }>(`/api/app/audit?flowId=${flow.id}&limit=100`)
  for (const kind of ['submission.status_changed', 'submission.assignment_changed', 'submission.tags_changed', 'submission.note_added', 'submission.status_created']) expect(audit.rows).toContainEqual(expect.objectContaining({ kind, form: expect.objectContaining({ id: flow.id }), actor: expect.any(Object) }))
  expect(JSON.stringify(audit)).not.toContain(note)
  expect(JSON.stringify(audit)).not.toContain('Repair the front door')
  await call(`/api/app/responses/${ids[0]}`, undefined, 'DELETE')
  for (const table of ['submission_workflows', 'submission_tags', 'submission_notes']) expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE response_id=?`).bind(ids[0]).first()).toEqual({ n: 0 })

  const input = { definition: simpleJson, csv: simpleCsv }
  const review = await call<ImportReview>('/api/app/imports/review', input)
  expect(review.rowErrors).toEqual([])
  type Job = { id: string; state: string }
  let job = await call<Job>('/api/app/imports/commit', { ...input, columns: review.columns, plannedAt: review.plannedAt, fingerprint: review.fingerprint, acknowledged: true })
  while (job.state !== 'completed') job = await call<Job>(`/api/app/imports/${job.id}/resume`, {})
  const importedRoot = `/api/app/flows/${review.flowId}`
  const ledger = await call<{ responses: Array<{ id: string }> }>(importedRoot + '/ledger'), importedId = ledger.responses[0].id
  const importedNote = 'Preserve this reviewed imported request.'
  await call(importedRoot + '/submissions/bulk', { responses: [{ id: importedId, version: 0 }], changes: { statusId: 'in-review', note: importedNote, addTags: ['import-reviewed'] } })
  const undo = await request(`/api/app/imports/${job.id}/undo`, {})
  expect(undo.status, await undo.clone().text()).toBe(409)
  expect((await call<SubmissionDetail>(importedRoot + '/submissions/' + importedId)).notes[0].text).toBe(importedNote)
  await call(`/api/app/responses/${importedId}`, undefined, 'DELETE')
  for (const table of ['submission_workflows', 'submission_tags', 'submission_notes']) expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE response_id=?`).bind(importedId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) AS n FROM form_import_targets WHERE target_id=?').bind(importedId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE subject_type='response' AND subject_id=?").bind(importedId).first()).toEqual({ n: 0 })
  expect(await env.DB.prepare('SELECT count(*) AS n FROM ik_d1_native_staging').first()).toEqual({ n: 0 })
  expect(await allStoredData()).not.toContain(importedNote)
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}, 90000)
