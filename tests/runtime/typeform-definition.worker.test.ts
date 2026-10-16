import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { googleHttp, counts } from './google-import-http'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => vi.restoreAllMocks())
const path = '/api/app/imports/typeform/definition'
const token = 'synthetic_typeform_credential_for_network_edge_only'
const definition = { id: 'AbCd1234', title: 'Imported from Typeform', fields: [{ ref: 'recommend', title: 'Would you recommend us?', type: 'nps' }] }

test('the authenticated Typeform retrieval feeds the real reviewed import without retaining the credential or creating records early', async () => {
  const f = await googleHttp(), before = await counts()
  const edge = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(definition))
  const response = await f.call(path, { form: 'https://example.typeform.com/to/AbCd1234?source=share', token })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  const loaded = await response.json() as { definition: string; title: string; formId: string }
  expect(JSON.parse(loaded.definition)).toEqual(definition)
  expect(JSON.stringify(loaded)).not.toContain(token)
  expect(await counts()).toEqual(before)
  expect(edge).toHaveBeenCalledOnce()
  const [url, options] = edge.mock.calls[0]
  expect(url).toBe('https://api.typeform.com/forms/AbCd1234')
  expect(options).toMatchObject({ headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' })
  const { report, job } = await f.commit({ source: 'typeform', definition: loaded.definition, csv: '' })
  expect(job.state).toBe('completed')
  expect(report.questions).toEqual(expect.arrayContaining([expect.objectContaining({ prompt: definition.fields[0].title, questionType: 'nps' })]))
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM flows WHERE id=?').bind(report.flowId).first()).toEqual({ n: 1 })
  const stored = (await env.DB.prepare('SELECT plan_json FROM ik_jobs WHERE id=?').bind(job.id).first<{ plan_json: string }>())!.plan_json
  expect(stored).not.toContain(token)
})

test('retrieval refuses unauthorized, cross-origin and unsafe inputs and gives safe actionable provider errors', async () => {
  const f = await googleHttp(), before = await counts()
  const edge = vi.spyOn(globalThis, 'fetch')
  for (const options of [{ auth: false }, { origin: 'https://other.example' }]) {
    const response = await f.call(path, { form: definition.id, token }, options)
    expect(response.status).toBe(options.auth === false ? 401 : 403)
  }
  for (const form of ['https://typeform.com.evil.example/to/AbCd1234', 'https://api.typeform.com@evil.example/to/AbCd1234', 'https://localhost/to/AbCd1234', '../me', 'https://example.typeform.com/to/AbCd1234%2Fresponses']) {
    expect((await f.call(path, { form, token })).status).toBe(400)
  }
  expect((await f.call(path, { form: definition.id, token: 'bad\r\nheader' })).status).toBe(400)
  expect(edge).not.toHaveBeenCalled()
  for (const status of [302, 401, 403, 404, 429, 500]) {
    edge.mockResolvedValueOnce(new Response(`provider error echo ${token}`, { status }))
    const response = await f.call(path, { form: definition.id, token })
    expect(response.status).toBe(400)
    const error = await response.text()
    expect(error).not.toContain(token)
    expect(error).not.toContain('provider error echo')
    expect(JSON.parse(error).message).toMatch(/token|permission|form|minute|later/i)
  }
  edge.mockRejectedValueOnce(new Error(`network error echo ${token}`))
  const failed = await f.call(path, { form: definition.id, token })
  expect(failed.status).toBe(400)
  expect(await failed.text()).not.toContain(token)
  for (const result of [Response.json({ ...definition, id: 'OtherForm' }), Response.json({ ...definition, title: token }), new Response('x', { headers: { 'Content-Length': String(9 * 1024 * 1024) } }), new Response('not JSON')]) {
    edge.mockResolvedValueOnce(result)
    const response = await f.call(path, { form: 'https://admin.typeform.com/form/AbCd1234/create', token })
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain(token)
  }
  expect(await counts()).toEqual(before)
})
