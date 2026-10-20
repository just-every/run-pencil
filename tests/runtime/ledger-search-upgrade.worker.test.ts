import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
import { googleHttp } from './google-import-http'
import type { BuilderDraft, Ledger } from '../../src/core/app/api'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

contract('LEDG-006', 'answers collected before the stored-search migration become searchable without changing the retained answers', async () => {
  // 0.7.0 ends at 0052. Preserve that schema and collect through its normal
  // response door before applying the additive search migration and successors.
  const before = __PENCIL_CORE_MIGRATIONS__.filter(migration => migration.name < '0053')
  const after = __PENCIL_CORE_MIGRATIONS__.filter(migration => migration.name >= '0053')
  await applyD1Migrations(env.DB, before)
  const http = await googleHttp(), slug = `search-upgrade-${crypto.randomUUID()}`
  const flow = await (await http.call('/api/app/flows', { title: 'Older café responses', slug })).json() as { id: string }
  const path = `/api/app/flows/${flow.id}`
  const draft = async () => await (await http.call(`${path}/draft`)).json() as BuilderDraft
  for (const step of [
    { kind: 'question', questionType: 'long_text', prompt: 'What did you enjoy?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Thank you.' },
  ]) expect((await http.call(`${path}/draft/steps`, { expectedVersion: (await draft()).flow.draftVersion, step })).status).toBe(201)
  const current = await draft()
  expect((await http.call(`${path}/publish`, { expectedVersion: current.flow.draftVersion })).status).toBe(201)
  const session = await (await http.call(`/api/public/flows/${slug}/sessions`, { deviceClass: 'desktop', source: 'direct' })).json() as { sessionId: string; sessionToken: string }
  const submitted = await http.call(`/api/public/flows/${slug}/responses`, { ...session, idempotencyKey: crypto.randomUUID(), answers: [{ stepId: current.steps[0].id, value: 'Le CAFE\u0301 près de la Straße. Очень ВКУСНО.' }] })
  expect(submitted.status).toBe(201)
  const receipt = await submitted.json() as { responseId: string; disposition: string }
  if (receipt.disposition === 'quarantined') expect((await http.call(`/api/app/responses/${receipt.responseId}/release`, {})).status).toBe(204)
  const retained = (await env.DB.prepare('SELECT * FROM response_answers WHERE response_id=?').bind(receipt.responseId).all()).results
  await applyD1Migrations(env.DB, after)
  expect((await env.DB.prepare('SELECT * FROM response_answers WHERE response_id=?').bind(receipt.responseId).all()).results).toEqual(retained)
  for (const search of ['café près de la STRASSE', 'очень вкусно']) {
    const response = await http.call(`${path}/ledger?${new URLSearchParams({ search })}`)
    expect(response.status).toBe(200)
    const ledger = await response.json() as Ledger
    expect(ledger.total).toBe(1)
    expect(ledger.responses.map(row => row.id)).toEqual([receipt.responseId])
  }
}, 60_000)
