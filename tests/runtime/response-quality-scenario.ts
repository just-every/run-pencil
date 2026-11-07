import { env, SELF } from 'cloudflare:test'
import { expect } from 'vitest'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { httpExport } from '../helpers/report-download'
import { matureLoad } from './load-time-fixture'
import type { BuilderDraft, Ledger, QuestionReport } from '../../src/core/app/api'

type Session = { sessionId: string; sessionToken: string; loadTime: string; revisionId: string }
type Receipt = { responseId: string; idempotent: boolean; disposition: string }
type Held = { id: string; quarantineReason: string; answers: Array<{ stepId: string; value: unknown }> }

/** Keep quality-check fixtures separate from the existing matrix workload. */
export async function responseQualityScenario() {
  let address = 0, lastQuarantinePath = '', lastHeldId = ''
  const request = (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST', cookie = ownerCookie): Promise<Response> => SELF.fetch('http://localhost' + path, {
    method, headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', Cookie: cookie, 'CF-Connecting-IP': `198.18.212.${++address % 250}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual',
  })
  const call = async <T,>(path: string, data?: unknown, method?: string): Promise<T> => {
    const response = await request(path, data, method)
    expect(response.ok, response.ok ? path : await response.text()).toBe(true)
    return response.status === 204 ? undefined as T : response.json<T>()
  }
  let ownerCookie = ''
  const signIn = async (email: string) => {
    await call('/auth/magic-link', { email })
    const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), email)
    const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
    expect(login.status).toBe(303)
    return login.headers.get('set-cookie')!.split(';')[0]
  }
  const owner = await env.DB.prepare('SELECT email FROM operators ORDER BY created_at, id LIMIT 1').first<{ email: string }>()
  ownerCookie = await signIn(owner!.email)
  const now = new Date().toISOString(), foreignWorkspace = crypto.randomUUID(), foreignOperator = crypto.randomUUID()
  const foreignEmail = 'synthetic-pencil-foreign-' + owner!.email
  await env.DB.prepare('INSERT INTO workspaces(id,name,time_zone,created_at,updated_at) VALUES(?,?,?,?,?)').bind(foreignWorkspace, 'Synthetic quality isolation', 'UTC', now, now).run()
  await env.DB.prepare('INSERT INTO operators(id,workspace_id,email,display_name,is_setup_operator,created_at,updated_at) VALUES(?,?,?,?,0,?,?)').bind(foreignOperator, foreignWorkspace, foreignEmail, 'Synthetic foreign operator', now, now).run()
  const foreignCookie = await signIn(foreignEmail)

  for (const mode of ['single', 'likert5', 'likert7'] as const) {
    const slug = `synthetic-pencil-quality-${mode}`
    const flow = await call<{ id: string }>('/api/app/flows', { title: 'Matrix quality checks', slug })
    const root = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(root + '/draft')
    const rows = ['Clarity', 'Speed', 'Quality', 'Support'].map((label, index) => ({ id: `synthetic-pencil-${index + 1}`, label }))
    const choices = Array.from({ length: mode === 'likert7' ? 7 : 5 }, (_, index) => ({ label: `Option ${index + 1}`, value: String(index + 1) }))
    const add = async (step: unknown) => call(root + '/draft/steps', { expectedVersion: (await read()).flow.draftVersion, step })
    await add({ kind: 'question', questionType: 'matrix', prompt: 'Rate every row', required: true, questionSettings: { matrixRows: rows, matrixMode: mode }, choices })
    await add({ kind: 'completion', questionType: null, prompt: 'Thank you' })
    let draft = await read()
    const matrix = draft.steps[0], options = draft.choices.filter(choice => choice.stepId === matrix.id)
    const same = Object.fromEntries(rows.map(row => [row.id, options.at(-1)!.id]))
    const mixed = { ...same, [rows[1].id]: options[0].id }
    const settings = (straightLining: boolean) => ({ ...draft.formSettings!, responseQuality: { straightLining } })
    const update = (straightLining: boolean, expectedVersion: number) => call<{ kind: string }>(root + '/draft/settings', { expectedVersion, settings: settings(straightLining) }, 'PUT')
    const publish = async () => {
      const result = await call<{ kind: string; revision: { id: string } }>(root + '/publish', { expectedVersion: (await read()).flow.draftVersion })
      expect(result.kind).toBe('published')
      return result.revision.id
    }
    const start = async () => {
      const session = await call<Session>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' })
      await matureLoad(session)
      return session
    }
    const body = (session: Session, value: unknown) => ({ ...session, idempotencyKey: `synthetic-pencil-${session.sessionId}`, answers: [{ stepId: matrix.id, value }] })
    const submit = (session: Session, value: unknown) => call<Receipt>(`/api/public/flows/${slug}/responses`, body(session, value))
    const outbox = (responseId: string) => env.DB.prepare('SELECT count(*) AS n FROM response_outbox WHERE response_id = ?').bind(responseId).first<{ n: number }>()
    const results = () => call<{ completedResponses: number }>(root + '/results?allRevisions=true')
    const exported = () => httpExport(path => request(path), root + '/responses/export')

    expect(draft.formSettings?.responseQuality).toBeUndefined()
    await publish()
    const defaultOff = await submit(await start(), same)
    expect(defaultOff.disposition).toBe('released')
    expect(await outbox(defaultOff.responseId)).toEqual({ n: 1 })
    const admittedOff = await start()

    draft = await read()
    for (const invalid of [null, true, {}, { straightLining: 'true' }, { straightLining: true, unknown: true }]) {
      const refused = await request(root + '/draft/settings', { expectedVersion: draft.flow.draftVersion, settings: { ...draft.formSettings, responseQuality: invalid } }, 'PUT')
      expect(refused.status).toBe(400)
      expect(await read()).toEqual(draft)
    }
    expect((await request(root + '/draft/settings', { expectedVersion: draft.flow.draftVersion, settings: settings(true) }, 'PUT', '')).status).toBe(401)
    expect((await request(root + '/draft/settings', { expectedVersion: draft.flow.draftVersion, settings: settings(true) }, 'PUT', foreignCookie)).status).toBe(404)
    expect(await read()).toEqual(draft)
    expect(await update(true, draft.flow.draftVersion)).toMatchObject({ kind: 'updated' })
    const enabledDraft = await read()
    expect(await update(false, draft.flow.draftVersion)).toMatchObject({ kind: 'conflict' })
    expect(await read()).toEqual(enabledDraft)
    const enabledRevision = await publish()
    const admittedOn = await start()
    expect((await submit(admittedOff, same)).disposition).toBe('released')
    const varied = await submit(await start(), mixed)
    expect(varied.disposition).toBe('released')
    expect(await outbox(varied.responseId)).toEqual({ n: 1 })

    draft = await read()
    await update(false, draft.flow.draftVersion)
    expect((await read()).formSettings?.responseQuality).toEqual({ straightLining: false })
    const live = await start()
    const responsePath = `/api/public/flows/${slug}/responses`
    for (const value of [{ [rows[0].id]: options[0].id }, { ...same, [rows[0].id]: 'synthetic-pencil-unknown' }, { ...same, unknown: options[0].id }]) {
      expect((await request(responsePath, body(live, value))).status).toBe(400)
    }
    const receipts = await Promise.all([submit(live, same), submit(live, same)])
    const held = receipts[0]
    expect(receipts.map(receipt => receipt.responseId)).toEqual([held.responseId, held.responseId])
    expect(receipts.map(receipt => receipt.idempotent).sort()).toEqual([false, true])
    expect(held.disposition).toBe('quarantined')
    expect(await env.DB.prepare('SELECT count(*) AS n FROM responses WHERE session_id = ?').bind(live.sessionId).first()).toEqual({ n: 1 })
    expect(await outbox(held.responseId)).toEqual({ n: 0 })
    const quarantinePath = `/api/app/revisions/${enabledRevision}/quarantine`
    expect(await call<Held[]>(quarantinePath)).toEqual([{ id: held.responseId, quarantineReason: 'matrix-straight-lining', completedAt: expect.any(String), answers: [{ stepId: matrix.id, value: same }] }])
    expect((await request(quarantinePath, undefined, 'GET', '')).status).toBe(401)
    expect(await (await request(quarantinePath, undefined, 'GET', foreignCookie)).json()).toEqual([])
    const releasePath = `/api/app/responses/${held.responseId}/release`
    expect((await request(releasePath, {}, 'POST', '')).status).toBe(401)
    expect((await request(releasePath, {}, 'POST', foreignCookie)).status).toBe(404)
    expect(await outbox(held.responseId)).toEqual({ n: 0 })
    expect((await call<Held[]>(quarantinePath)).map(row => row.id)).toEqual([held.responseId])
    expect(await results()).toMatchObject({ completedResponses: 3 })
    expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE subject_id = ? AND kind = 'response.quarantine-released'").bind(held.responseId).first()).toEqual({ n: 0 })

    const disabledRevision = await publish()
    expect(disabledRevision).not.toBe(enabledRevision)
    const olderHeld = await submit(admittedOn, same)
    lastQuarantinePath = quarantinePath; lastHeldId = olderHeld.responseId
    expect(olderHeld.disposition).toBe('quarantined')
    expect((await call<Held[]>(quarantinePath)).map(row => row.id).sort()).toEqual([held.responseId, olderHeld.responseId].sort())
    const explicitOff = await submit(await start(), same)
    expect(explicitOff.disposition).toBe('released')
    expect(await results()).toMatchObject({ completedResponses: 4 })
    expect(await call<Ledger>(root + '/ledger')).toMatchObject({ total: 4 })
    const before = await exported()
    expect(before.excludedQuarantined).toBe(2)
    expect(before.responses.map(response => response.id).sort()).toEqual([defaultOff.responseId, varied.responseId, explicitOff.responseId, (await submit(admittedOff, mixed)).responseId].sort())
    expect(await outbox(olderHeld.responseId)).toEqual({ n: 0 })

    const release = await Promise.all([request(releasePath, {}), request(releasePath, {})])
    expect(release.map(response => response.status).sort()).toEqual([204, 404])
    expect(await results()).toMatchObject({ completedResponses: 5 })
    expect(await call<Ledger>(root + '/ledger')).toMatchObject({ total: 5 })
    expect(await env.DB.prepare("SELECT count(*) AS n FROM audit_entries WHERE subject_id = ? AND kind = 'response.quarantine-released'").bind(held.responseId).first()).toEqual({ n: 1 })
    expect(await outbox(held.responseId)).toEqual({ n: 1 })
    const after = await exported()
    expect(after.excludedQuarantined).toBe(1)
    expect(after.responses).toHaveLength(5)
    expect(after.responses.find(response => response.id === held.responseId)?.answers).toMatchObject([{ stepId: matrix.id, value: same }])
    const questions = await call<QuestionReport[]>(root + '/questions?revisionId=' + enabledRevision)
    expect(questions.find(question => question.id === matrix.id)!.summary.matrixRows!.map(row => row.answered)).toEqual([2, 2, 2, 2])
    expect(await submit(live, mixed)).toMatchObject({ responseId: held.responseId, idempotent: true, disposition: 'released' })
    expect(await outbox(held.responseId)).toEqual({ n: 1 })

    // Erasure and revoked authority retain the existing admission fences.
    await call('/api/app/responses/' + held.responseId, {}, 'DELETE')
    expect((await request(responsePath, body(live, same))).status).toBeGreaterThanOrEqual(400)
    expect(await outbox(held.responseId)).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT count(*) AS n FROM response_answers WHERE response_id = ?').bind(held.responseId).first()).toEqual({ n: 0 })
    expect(await results()).toMatchObject({ completedResponses: 4 })
  }
  await call('/auth/signout', {})
  expect((await request(lastQuarantinePath)).status).toBe(401)
  expect((await request(`/api/app/responses/${lastHeldId}/release`, {})).status).toBe(401)
  expect(await env.DB.prepare('SELECT state FROM responses WHERE id = ?').bind(lastHeldId).first()).toEqual({ state: 'quarantined' })
  expect(await env.DB.prepare('SELECT count(*) AS n FROM response_outbox WHERE response_id = ?').bind(lastHeldId).first()).toEqual({ n: 0 })
}
