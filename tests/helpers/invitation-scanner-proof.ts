import { expect } from 'vitest'
import type { BuilderDraft } from '../../src/core/app/api'
import type { emittedWorker } from './emitted-worker.mjs'

type Json = <T>(path: string, data?: unknown) => Promise<T>
type Mail = { text: string; html: string }

/** Independent native forms exercise every non-NPS button the relay actually emits. */
export async function proveNonNpsInvitationScanners(
  runtime: Awaited<ReturnType<typeof emittedWorker>>, db: D1Database,
  json: Json, messages: Mail[], contactId: string, origin: string,
) {
  const fixtures = [
    { name: 'csat', questionType: 'csat', prompt: 'How satisfied was your visit?', expected: ['1', '2', '3', '4', '5'] },
    { name: 'rating', questionType: 'rating', prompt: 'Rate the workshop', questionSettings: { min: 0, max: 3, lowLabel: 'Low', highLabel: 'High' }, expected: ['0', '1', '2', '3'] },
    { name: 'choice', questionType: 'single_choice', prompt: 'Which session suits you?', choices: [
      { value: 'morning', label: 'Morning workshop' },
      { value: 'afternoon', label: 'Afternoon workshop' },
      { value: 'evening', label: 'Evening workshop' },
    ] },
  ]
  for (const fixture of fixtures) {
    const flow = await json<{ id: string }>('/api/app/flows', { title: fixture.prompt, slug: `synthetic-pencil-scanner-${fixture.name}` })
    const path = `/api/app/flows/${flow.id}`
    const draft = () => json<BuilderDraft>(`${path}/draft`)
    for (const step of [
      { kind: 'question', questionType: fixture.questionType, prompt: fixture.prompt, required: true,
        ...(fixture.questionSettings ? { questionSettings: fixture.questionSettings } : {}),
        ...(fixture.choices ? { choices: fixture.choices } : {}) },
      { kind: 'question', questionType: 'short_text', prompt: 'Tell us more', required: true },
      { kind: 'completion', questionType: null, prompt: 'Scanner fixture complete' },
    ]) await json(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })
    const authored = await draft()
    const first = authored.steps.find(step => step.prompt === fixture.prompt)!
    const expected = fixture.expected ?? ['morning', 'afternoon', 'evening'].map(value => {
      const choice = authored.choices.find(choice => choice.stepId === first.id && choice.value === value)!
      expect(choice.label).toBe({ morning: 'Morning workshop', afternoon: 'Afternoon workshop', evening: 'Evening workshop' }[value])
      return choice.id
    })
    await json(`${path}/publish`, { expectedVersion: authored.flow.draftVersion })
    const mailStart = messages.length
    await json(`${path}/distribution`, { contactIds: [contactId], commandKey: `synthetic-pencil-scanner-${fixture.name}` })
    const mail = messages.slice(mailStart).find(message => message.text.includes(fixture.prompt))!
    expect(mail, fixture.name).toBeDefined()
    const textLinks = [...mail.text.matchAll(/https?:\/\/[^\s<>"']+\?__pencil_first=[^\s<>"']+/g)].map(match => match[0])
    const htmlLinks = [...mail.html.matchAll(/href="([^"]+\?__pencil_first=[^"]+)"/g)].map(match => match[1].replace(/&amp;/g, '&'))
    expect(textLinks.map(link => new URL(link).searchParams.get('__pencil_first'))).toEqual(expected)
    expect(htmlLinks).toEqual(textLinks)
    const token = new URL(textLinks[0]).pathname.split('/').at(-1)!
    const participant = await db.prepare('SELECT id, revision_id FROM invitation_participants WHERE token=?').bind(token).first<{ id: string; revision_id: string }>()
    expect(participant).toBeTruthy()
    const revisionId = participant!.revision_id
    const snapshot = async () => ({
      participant: await db.prepare('SELECT * FROM invitation_participants WHERE id=?').bind(participant!.id).first(),
      sessions: (await db.prepare('SELECT * FROM respondent_sessions WHERE revision_id=? ORDER BY id').bind(revisionId).all()).results,
      responses: (await db.prepare('SELECT * FROM responses WHERE revision_id=? ORDER BY id').bind(revisionId).all()).results,
      answers: (await db.prepare('SELECT a.* FROM response_answers a JOIN responses r ON r.id=a.response_id WHERE r.revision_id=? ORDER BY a.response_id,a.step_id').bind(revisionId).all()).results,
      views: (await db.prepare('SELECT * FROM revision_view_counters WHERE revision_id=?').bind(revisionId).all()).results,
      starts: (await db.prepare('SELECT * FROM revision_start_counters WHERE revision_id=?').bind(revisionId).all()).results,
    })
    const before = await snapshot()
    expect(before.participant).toMatchObject({ response_status: 'not-started' })
    for (const rows of [before.sessions, before.responses, before.answers, before.views, before.starts]) expect(rows).toEqual([])
    for (const link of new Set([...textLinks, ...htmlLinks])) {
      expect(new URL(link).origin).toBe(origin)
      expect(new URL(link).pathname).toBe(`/i/${token}`)
      for (const method of ['GET', 'HEAD', 'GET', 'HEAD']) {
        const response = await runtime.dispatchFetch(link, { method, redirect: 'manual', headers: {
          Host: new URL(origin).host, 'User-Agent': 'Synthetic mail security scanner', 'CF-Connecting-IP': '192.0.2.243',
        } })
        expect(response.status, `${fixture.name} ${method}`).toBe(200)
        const body = await response.text()
        if (method === 'HEAD') expect(body).toBe('')
        else expect(body).toContain(fixture.prompt)
        expect(await snapshot()).toEqual(before)
      }
    }
  }
}
