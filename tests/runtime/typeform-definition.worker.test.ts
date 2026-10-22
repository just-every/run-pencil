import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { googleHttp, counts } from './google-import-http'
import { decodeLogo, logoByteLimit } from '../../src/core/features/brand/logo'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(() => vi.restoreAllMocks())
const path = '/api/app/imports/typeform/definition'
const token = 'synthetic-pencil-1'
const definition = {
  id: 'AbCd1234', title: 'Imported from Typeform', fields: [{ ref: 'recommend', title: 'Would you recommend us?', type: 'nps' }],
  settings: { language: 'en', meta: { title: 'A source share title', description: 'The original source preview description.', allow_indexing: true, image: { href: 'https://images.typeform.com/images/synthetic-pencil-2' } } },
}
const image = { mime: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', alt: definition.settings.meta.title }
const imageResponse = () => new Response(decodeLogo(image.base64), { headers: { 'Content-Type': image.mime } })

test('the authenticated Typeform retrieval feeds the real reviewed import without retaining the credential or creating records early', async () => {
  const f = await googleHttp(), before = await counts()
  const edge = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(definition)).mockResolvedValueOnce(imageResponse())
  const response = await f.call(path, { form: 'https://example.typeform.com/to/AbCd1234?source=share', token })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  const loaded = await response.json() as { definition: string; title: string; formId: string }
  expect(JSON.parse(loaded.definition)).toEqual({ ...definition, settings: { ...definition.settings, meta: { ...definition.settings.meta, image: { ...definition.settings.meta.image, pencilImage: image } } } })
  expect(JSON.stringify(loaded)).not.toContain(token)
  expect(await counts()).toEqual(before)
  expect(edge).toHaveBeenCalledTimes(2)
  const [url, options] = edge.mock.calls[0]
  expect(url).toBe('https://api.typeform.com/forms/AbCd1234')
  expect(options).toMatchObject({ headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' })
  const [imageUrl, imageOptions] = edge.mock.calls[1]
  expect(imageUrl).toBe(definition.settings.meta.image.href)
  expect(imageOptions).toMatchObject({ redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer' })
  expect(new Headers(imageOptions?.headers).get('Authorization')).toBeNull()
  expect(new Headers(imageOptions?.headers).get('Cookie')).toBeNull()
  expect(JSON.stringify(imageOptions)).not.toContain(token)
  // A normal definition file still reports its external image, without fetching it.
  const file = await f.review({ source: 'typeform', definition: JSON.stringify(definition), csv: '' })
  expect(file.report).toContainEqual(expect.objectContaining({ location: '/settings/meta/image', state: 'unsupported', reason: expect.stringContaining(definition.settings.meta.image.href) }))
  expect(file.settings?.linkPreview?.image).toBeUndefined()
  expect(edge).toHaveBeenCalledTimes(2)
  const assets = (env as unknown as { FORM_ASSETS: R2Bucket }).FORM_ASSETS
  expect((await assets.list({ prefix: `previews/${f.workspace}/` })).objects).toEqual([])
  const { report, job } = await f.commit({ source: 'typeform', definition: loaded.definition, csv: '' })
  expect(job.state).toBe('completed')
  expect(report.questions).toEqual(expect.arrayContaining([expect.objectContaining({ prompt: definition.fields[0].title, questionType: 'nps' })]))
  const preview = { title: definition.settings.meta.title, description: definition.settings.meta.description, allowIndexing: true, image }
  expect(report.settings).toMatchObject({ hiddenFields: [], identityMode: 'anonymous', linkPreview: { ...preview, image: { mime: image.mime, alt: image.alt } } })
  expect(report.report).toEqual(expect.arrayContaining([
    expect.objectContaining({ location: '/settings/meta/title', state: 'imported' }),
    expect.objectContaining({ location: '/settings/meta/description', state: 'imported' }),
    expect.objectContaining({ location: '/settings/meta/allow_indexing', state: 'imported' }),
    expect.objectContaining({ location: '/settings/meta/image', state: 'imported' }),
    expect.objectContaining({ location: '/settings/language', state: 'unsupported' }),
  ]))
  // Both revisions retain the reviewed preview and image; rendering never fetches the external source.
  const revisions = (await env.DB.prepare('SELECT state,form_settings_json FROM flow_revisions WHERE flow_id=? ORDER BY number').bind(report.flowId).all<{ state: string; form_settings_json: string }>()).results
  expect(revisions.map(revision => revision.state)).toEqual(['published', 'draft'])
  expect(JSON.parse(revisions[0].form_settings_json)).toEqual(JSON.parse(revisions[1].form_settings_json))
  expect(JSON.parse(revisions[0].form_settings_json)).toMatchObject({ ...report.settings, linkPreview: { ...report.settings?.linkPreview, image: { mime: image.mime, alt: image.alt } } })
  expect(revisions[0].form_settings_json).not.toContain(image.base64)
  const migration = __PENCIL_CORE_MIGRATIONS__.find(item => item.name.includes('link_preview_snapshots'))!
  const importedBefore = await env.DB.prepare('SELECT policy_snapshot_json AS policy FROM flow_revisions WHERE flow_id=? ORDER BY number').bind(report.flowId).all()
  await env.DB.batch(migration.queries.map(query => env.DB.prepare(query)))
  expect((await env.DB.prepare('SELECT policy_snapshot_json AS policy FROM flow_revisions WHERE flow_id=? ORDER BY number').bind(report.flowId).all()).results).toEqual(importedBefore.results)
  const storedImage = report.settings!.linkPreview!.image!
  expect(storedImage).toEqual({ mime: image.mime, alt: image.alt, key: expect.any(String) })
  const servedImage = await f.call(`/api/app/flows/${report.flowId}/preview-image?key=${encodeURIComponent((storedImage as { key: string }).key)}`)
  expect(servedImage.status).toBe(200)
  expect(servedImage.headers.get('Content-Type')).toBe(image.mime)
  expect(new Uint8Array(await servedImage.arrayBuffer())).toEqual(decodeLogo(image.base64))
  expect(edge).toHaveBeenCalledTimes(2)
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM flows WHERE id=?').bind(report.flowId).first()).toEqual({ n: 1 })
  const stored = (await env.DB.prepare('SELECT plan_json FROM ik_jobs WHERE id=?').bind(job.id).first<{ plan_json: string }>())!.plan_json
  expect(stored).not.toContain(token)
  expect(stored).not.toContain(image.base64)
  const importedDraft = await (await f.call(`/api/app/flows/${report.flowId}/draft`)).json() as {flow:{draftVersion:number}}
  const published = await f.call(`/api/app/flows/${report.flowId}/publish`,{expectedVersion:importedDraft.flow.draftVersion})
  expect(published.status,await published.clone().text()).toBe(201)
  const {revision} = await published.json() as {revision:{id:string}}
  const publicImage = await f.call(`/api/public/previews/${revision.id}/image`,undefined,{auth:false})
  expect(publicImage.status).toBe(200)
  expect(new Uint8Array(await publicImage.arrayBuffer())).toEqual(decodeLogo(image.base64))
  expect(edge).toHaveBeenCalledTimes(2)
  // File imports use the same mapping, including explicit false and empty description.
  const disabled = await f.review({ source: 'typeform', csv: '', definition: JSON.stringify({ ...definition, settings: { meta: { title: '  Exact source whitespace  ', description: '', allow_indexing: false } } }) })
  expect(disabled.settings?.linkPreview).toEqual({ title: '  Exact source whitespace  ', description: '', allowIndexing: false })
  const absent = await f.review({ source: 'typeform', csv: '', definition: JSON.stringify({ ...definition, settings: {} }) })
  expect(absent.settings).toBeUndefined()
  expect(edge).toHaveBeenCalledTimes(2)
  // Real one-pixel rasters cover every permitted transport type, without network calls during review.
  for (const [mime, base64] of [
    ['image/jpeg', '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkaKKK+xPnj//Z'],
    ['image/webp', 'UklGRjwAAABXRUJQVlA4IDAAAADwAQCdASoBAAEAAUAmJaACdLoB+AAF9AAA/vFNr/0mzxNnibPkkf/KVeCxub4AAAA='],
  ]) {
    const calls = edge.mock.calls.length
    edge.mockResolvedValueOnce(Response.json({ ...definition, settings: { meta: { image: definition.settings.meta.image } } })).mockResolvedValueOnce(new Response(decodeLogo(base64), { headers: { 'Content-Type': mime } }))
    const fetched = await f.call(path, { form: definition.id, token })
    expect(fetched.status).toBe(200)
    const source = await fetched.json() as { definition: string }
    const reviewed = await f.review({ source: 'typeform', definition: source.definition, csv: '' })
    expect(JSON.parse(source.definition).settings.meta.image.pencilImage).toEqual({ mime, base64, alt: definition.title })
    expect(reviewed.settings?.linkPreview?.image).toEqual({ mime, key: expect.any(String), alt: definition.title })
    expect(edge.mock.calls.length).toBe(calls + 2)
  }
  const noImage = { ...definition, settings: {} }, calls = edge.mock.calls.length
  edge.mockResolvedValueOnce(Response.json(noImage))
  const plain = await f.call(path, { form: definition.id, token })
  expect(plain.status).toBe(200)
  expect(JSON.parse((await plain.json() as { definition: string }).definition)).toEqual(noImage)
  expect(edge.mock.calls.length).toBe(calls + 1)
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
  for (const href of ['http://images.typeform.com/images/a', 'https://images.typeform.com.evil.example/images/a', 'https://images.typeform.com@evil.example/images/a', 'https://images.typeform.com:443/images/a', 'https://127.0.0.1/images/a', 'https://images.typeform.com/other/a', 'https://images.typeform.com/images/../a', 'https://images.typeform.com/images/a%2Fother', 'https://images.typeform.com/images/a?token=synthetic-pencil-3', 'https://images.typeform.com/images/a#fragment']) {
    const calls = edge.mock.calls.length
    edge.mockResolvedValueOnce(Response.json({ ...definition, settings: { meta: { image: { href } } } }))
    const refused = await f.call(path, { form: definition.id, token })
    expect(refused.status).toBe(400)
    expect(await refused.text()).not.toContain(token)
    expect(edge.mock.calls.length).toBe(calls + 1)
  }
  const streamed = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(logoByteLimit)); controller.enqueue(new Uint8Array(1)); controller.close() } }), { headers: { 'Content-Type': 'image/png' } })
  for (const response of [
    new Response('provider error', { status: 302, headers: { Location: 'https://evil.example/image' } }),
    new Response('provider error', { status: 403 }),
    new Response('', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(logoByteLimit + 1) } }), streamed(),
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response(decodeLogo(image.base64), { headers: { 'Content-Type': 'image/jpeg' } }),
    new Response(null, { headers: { 'Content-Type': 'image/png' } }),
  ]) {
    const calls = edge.mock.calls.length
    edge.mockResolvedValueOnce(Response.json(definition)).mockResolvedValueOnce(response)
    const refused = await f.call(path, { form: definition.id, token })
    expect(refused.status).toBe(400)
    expect(await refused.text()).not.toContain(token)
    expect(edge.mock.calls.length).toBe(calls + 2)
  }
  edge.mockResolvedValueOnce(Response.json(definition)).mockRejectedValueOnce(new Error(`image network error echo ${token}`))
  const imageFailure = await f.call(path, { form: definition.id, token })
  expect(imageFailure.status).toBe(400)
  expect(await imageFailure.text()).not.toContain(token)
  for (const meta of [{ title: '{{field:answer}}', description: 'x'.repeat(1001), allow_indexing: 'false' }, { title: 42, description: null, allow_indexing: null }]) {
    const reviewed = await f.review({ source: 'typeform', csv: '', definition: JSON.stringify({ ...definition, settings: { meta } }) })
    expect(reviewed.settings).toBeUndefined()
    for (const key of ['title', 'description', 'allow_indexing']) expect(reviewed.report).toContainEqual(expect.objectContaining({ location: `/settings/meta/${key}`, state: 'unsupported' }))
  }
  for (const pencilImage of [{ mime: image.mime, key: 'some-other-workspace-object', alt: image.alt }, { ...image, base64: 'invalid!' }, { ...image, alt: '' }, { ...image, mime: 'image/jpeg' }]) {
    const reviewed = await f.review({ source: 'typeform', csv: '', definition: JSON.stringify({ ...definition, settings: { meta: { image: { href: definition.settings.meta.image.href, pencilImage } } } }) })
    expect(reviewed.settings?.linkPreview?.image).toBeUndefined()
    expect(reviewed.report).toContainEqual(expect.objectContaining({ location: '/settings/meta/image', state: 'unsupported' }))
  }
  expect(await counts()).toEqual(before)
})
