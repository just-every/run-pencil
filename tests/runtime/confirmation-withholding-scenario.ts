import { env, SELF } from 'cloudflare:test'
import { expect, vi } from 'vitest'
import type { BuilderDraft, PublicFlow } from '../../src/core/app/api'
import type { ConfirmationSettings } from '../../src/core/shared/confirmationSettings'
import { RespondentConfirmationDispatcher } from '../../src/core/features/notifications/confirmation-dispatcher'
import { baseMailSender } from '../../src/core/platform/mail/base.server'
import { developmentInbox } from '../helpers/development-outbox'
import { devKeyHeaders } from '../helpers/dev-key.mjs'
import { matureLoad } from './load-time-fixture'

type Session = { sessionId: string; sessionToken: string; revisionId: string; loadTime: string; flow: PublicFlow }
type Receipt = { responseId: string; disposition: string; idempotent: boolean }
type Message = { subject: string; personalizations: Array<{ to: Array<{ email: string }> }>; content: Array<{ type: string; value: string }> }

/** Exercise both copy gates without replacing the existing positive recall journey. */
export async function confirmationWithholdingScenario() {
  let cookie = '', address = 0
  const request = (path: string, data?: unknown, method = data === undefined ? 'GET' : 'POST', authenticated = true) => SELF.fetch('http://localhost' + path, {
    method, headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', Cookie: authenticated ? cookie : '', 'CF-Connecting-IP': `198.18.213.${++address % 250}` },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), redirect: 'manual',
  })
  const call = async <T,>(path: string, data?: unknown, method?: string, authenticated = true): Promise<T> => {
    const response = await request(path, data, method, authenticated)
    expect(response.ok, response.ok ? path : await response.text()).toBe(true)
    return response.json<T>()
  }
  const owner = await env.DB.prepare("SELECT o.email FROM operators o JOIN operator_auth_links l ON l.operator_id=o.id JOIN oa_operators a ON a.id=l.auth_id WHERE a.status='active' ORDER BY o.created_at,o.id LIMIT 1").first<{ email: string }>()
  expect(owner).not.toBeNull()
  await call('/auth/magic-link', { email: owner!.email })
  const inbox = await developmentInbox(path => SELF.fetch('http://localhost' + path, { headers: { Host: 'localhost', ...devKeyHeaders } }), owner!.email)
  const login = await request('/auth/confirm', { token: inbox.messages[0].magicLinkToken })
  expect(login.status).toBe(303)
  cookie = login.headers.get('set-cookie')!.split(';')[0]

  const slug = 'synthetic-pencil-confirmation-withholding'
  const flow = await call<{ id: string }>('/api/app/flows', { title: 'Confirmation copy gates', slug })
  const root = `/api/app/flows/${flow.id}`, read = () => call<BuilderDraft>(root + '/draft')
  for (const step of [
    { kind: 'question', questionType: 'email', prompt: 'Receipt mailbox', required: true },
    { kind: 'question', questionType: 'short_text', prompt: 'Selected answer', required: true },
    { kind: 'question', questionType: 'long_text', prompt: 'Excluded answer', required: true },
    { kind: 'completion', questionType: null, prompt: 'Recorded' },
  ]) await call(root + '/draft/steps', { expectedVersion: (await read()).flow.draftVersion, step })
  const draft = await read(), [email, selected, excluded] = draft.steps
  const mailbox = ['synthetic-pencil-confirmation-37', 'example.test'].join('@')
  const selectedValue = 'synthetic-pencil-selected-answer-37'
  const excludedValue = 'synthetic-pencil-private-answer-37'
  const calculatedValue = 'synthetic-pencil-private-calculated-37'
  const recall = `A [{{${selected.id}}}]; E [{{${excluded.id}}}]; H [{{hidden:private}}]; C [{{variable:private-copy}}]`
  const settings = {
    ...draft.formSettings!,
    hiddenFields: [{ id: 'private', name: 'private', type: 'number' as const, category: 'plain' as const }],
    calculations: [{ id: 'private-copy', name: 'Private derived text', type: 'text' as const, expression: {
      kind: 'conditional' as const, condition: { kind: 'test' as const, stepId: excluded.id, operator: 'equals' as const, value: excludedValue },
      then: { kind: 'literal' as const, value: calculatedValue }, else: { kind: 'literal' as const, value: 'synthetic-pencil-other-calculated-37' },
    } }],
  }
  const update = async (includeAnswers: boolean, answerTypes: string[]) => {
    const confirmation: ConfirmationSettings = { enabled: true, includeAnswers, answerTypes, emailStepId: email.id, subject: recall, body: recall }
    await call(root + '/draft/settings', { expectedVersion: (await read()).flow.draftVersion, settings: { ...settings, confirmation } }, 'PUT')
    expect((await read()).formSettings?.confirmation).toEqual(confirmation)
    return confirmation
  }
  const publish = async () => {
    const result = await call<{ kind: string; revision: { id: string } }>(root + '/publish', { expectedVersion: (await read()).flow.draftVersion })
    expect(result.kind).toBe('published')
    return result.revision.id
  }
  const sent: Message[] = []
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)) as Message)
    return new Response(null, { status: 202 })
  })
  const dispatcher = new RespondentConfirmationDispatcher(env.DB, baseMailSender({ kind: 'sendgrid', apiKey: 'synthetic-pencil-mail-edge', from: mailbox }, env.DB), mailbox)
  const collect = async (revisionId: string, confirmation: ConfirmationSettings, expected: 'none' | 'selected' | 'all') => {
    const session = await call<Session>(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' }, 'POST', false)
    expect(session.revisionId).toBe(revisionId)
    expect(session.flow.formSettings?.confirmation).toEqual(confirmation)
    await matureLoad(session)
    const body = { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: 'synthetic-pencil-' + session.sessionId,
      answers: [{ stepId: email.id, value: mailbox }, { stepId: selected.id, value: selectedValue }, { stepId: excluded.id, value: excludedValue }], hidden: { private: 741963 } }
    const receipt = await call<Receipt>(`/api/public/flows/${slug}/responses`, body, 'POST', false)
    expect(receipt.disposition).toBe('released')
    const before = sent.length
    await dispatcher.run()
    expect(sent).toHaveLength(before + 1)
    const rows = (await env.DB.prepare('SELECT status,attempts,recipient,message_json AS messageJson FROM confirmation_deliveries WHERE response_id=?').bind(receipt.responseId).all<{ status: string; attempts: number; recipient: string; messageJson: string }>()).results
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'sent', attempts: 1, recipient: mailbox })
    const message = sent.at(-1)!, stored = JSON.parse(rows[0].messageJson) as { subject: string; text: string; html: string }
    expect(message.personalizations[0].to).toEqual([{ email: mailbox }])
    const plain = message.content.find(part => part.type === 'text/plain')!.value
    const html = message.content.find(part => part.type === 'text/html')!.value
    expect(stored).toMatchObject({ subject: message.subject, text: plain, html })
    const expectedRecall = expected === 'all'
      ? 'A [synthetic-pencil-selected-answer-37]; E [synthetic-pencil-private-answer-37]; H [741963]; C [synthetic-pencil-private-calculated-37]'
      : expected === 'selected' ? 'A [synthetic-pencil-selected-answer-37]; E []; H []; C []' : 'A []; E []; H []; C []'
    expect(message.subject).toBe(expectedRecall)
    for (const output of [plain, html, stored.text, stored.html]) expect(output).toContain(expectedRecall)
    for (const output of [message.subject, plain, html, rows[0].messageJson]) {
      if (expected === 'none') expect(output).not.toContain(selectedValue)
      if (expected !== 'all') for (const canary of [excludedValue, '741963', calculatedValue]) expect(output).not.toContain(canary)
    }
    if (expected !== 'none') {
      expect(plain).toContain('Selected answer\nsynthetic-pencil-selected-answer-37')
      expect(html).toContain('Your answers')
    } else {
      expect(plain).not.toContain('Your answers')
      expect(html).not.toContain('<dl>')
    }
    expect(await call<Receipt>(`/api/public/flows/${slug}/responses`, body, 'POST', false)).toMatchObject({ responseId: receipt.responseId, idempotent: true })
    await dispatcher.run()
    expect(sent).toHaveLength(before + 1)
  }
  try {
    // Populated operands are visible with both gates open, including a text
    // calculation whose output type will remain allowed when its input is not.
    const all = await update(true, ['short_text', 'long_text', 'number']), allRevision = await publish()
    await collect(allRevision, all, 'all')
    const off = await update(false, ['short_text', 'long_text', 'number']), offRevision = await publish()
    await update(true, ['short_text', 'long_text', 'number'])
    await collect(offRevision, off, 'none')
    const empty = await update(true, []), emptyRevision = await publish()
    await update(true, ['short_text'])
    await collect(emptyRevision, empty, 'none')
    const selectedOnly = (await read()).formSettings!.confirmation!, selectedRevision = await publish()
    await collect(selectedRevision, selectedOnly, 'selected')
    await update(false, [])
    await collect(selectedRevision, selectedOnly, 'selected')
  } finally { network.mockRestore() }
}
