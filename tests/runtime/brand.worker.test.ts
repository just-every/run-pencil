import { digest, type BackupArchive } from '../../src/core/features/backup/model'
import { previewFixture, previewImage } from './link-preview-fixture'
import { linkPreviewLimits, type LinkPreviewReference } from '../../src/core/shared/linkPreview'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { beforeAll, expect } from 'vitest'
import { contract } from '../../src/test/contract'
import worker from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
import { initializePencil } from '../../src/core/app/worker'
import { publicBrandConfig } from '../../src/core/features/brand/brand'
import { publicSeedConfig } from '../../src/ext/config'
import { decodeLogo, logoByteLimit } from '../../src/core/features/brand/logo'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
const origin = 'https://forms.example.test'
const bindings = { ...env, APP_ORIGIN: origin, SESSION_SECRET: 'synthetic-brand-session-secret-at-least-32-characters', SETUP_TOKEN: 'synthetic-brand-setup-secret-at-least-32-characters', SEED_ADMIN_EMAIL: 'brand-owner@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_FROM: 'forms@example.test', MAIL_API_KEY: 'synthetic-unused-key', PENCIL_LOCAL_DEVELOPMENT: 'false', SEED_SAMPLE_DATA: 'false' }
const png = decodeLogo('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=')
const raw = (path: string, init: RequestInit = {}) => worker.fetch(new Request(origin + path, init), bindings, {} as ExecutionContext)
contract(["BRAND-001","BRAND-003","HOME-001","BASE-ACCESS-004","BASE-INPUT-001"], 'production D1 branding persists, refuses unauthorized and invalid writes, and selects only a published owned flow', async () => {
  const services = await initializePencil(createPencilPlatform(origin, bindings))
  expect(publicBrandConfig(await services.brand.get(), publicSeedConfig)).toMatchObject({ publicFlowBusinessName: 'Your business', publicFlowSlug: '', publicFlowPurpose: '' })
  const bootstrap = await raw('/auth/bootstrap', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.241.1' }, body: JSON.stringify({ token: bindings.SETUP_TOKEN, displayName: 'Business owner' }) })
  expect(bootstrap.status).toBe(303)
  const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0]
  const headers = { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.18.241.1' }
  const save = (body: unknown) => raw('/api/app/brand', { method: 'PUT', headers, body: JSON.stringify(body) })
  const brand = { name: 'North Studio', supportingLine: 'Tell us what would help.', accent: '#757575', publicFlowSlug: null as string | null }
  expect((await raw('/api/app/brand', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(brand) })).status).toBe(401)
  expect((await raw('/api/app/brand', { method: 'PUT', headers: { ...headers, Origin: 'https://hostile.test' }, body: JSON.stringify(brand) })).status).toBe(403)
  expect((await save(brand)).status).toBe(200)
  for (const patch of [{ name: '' }, { accent: '#fff' }, { accent: 'url(x)' }, { supportingLine: 'x'.repeat(241) }, { publicFlowSlug: 'missing' }]) expect((await save({ ...brand, ...patch })).status).toBe(400)
  const created = await raw('/api/app/flows', { method: 'POST', headers, body: JSON.stringify({ title: 'Customer feedback', slug: 'business-feedback', template: 'feedback' }) }).then(r => r.json()) as { id: string }
  expect((await save({ ...brand, publicFlowSlug: 'business-feedback' })).status).toBe(400)
  const draft = await raw(`/api/app/flows/${created.id}/draft`, { headers }).then(r => r.json()) as { flow: { draftVersion: number } }
  expect((await raw(`/api/app/flows/${created.id}/publish`, { method: 'POST', headers, body: JSON.stringify({ expectedVersion: draft.flow.draftVersion }) })).status).toBe(201)
  brand.publicFlowSlug = 'business-feedback'
  expect((await save(brand)).status).toBe(200)
  const restored = await initializePencil(createPencilPlatform(origin, bindings))
  expect(await restored.brand.get()).toMatchObject({ ...brand, configured: true })
  expect(JSON.stringify(publicBrandConfig(await restored.brand.get(), publicSeedConfig))).not.toMatch(/aurora|cafe/i)
  const upload = (body: Uint8Array, mime: string, authenticated = true) => raw('/api/app/brand/logo', { method: 'PUT', headers: { ...(authenticated ? headers : { Origin: origin }), 'Content-Type': mime }, body })
  expect((await upload(png, 'image/png', false)).status).toBe(401)
  for (const [bytes, mime] of [[png, 'image/jpeg'], [new TextEncoder().encode('<svg/>'), 'image/svg+xml'], [new Uint8Array(logoByteLimit + 1), 'image/png']] as const) expect((await upload(bytes, mime)).status).toBe(400)
  expect((await upload(png, 'image/png')).status).toBe(200)
  const config = publicBrandConfig(await restored.brand.get(), publicSeedConfig)
  const logo = await raw(config.publicFlowLogoUrl!)
  expect(logo.status).toBe(200); expect(logo.headers.get('Content-Type')).toBe('image/png'); expect(logo.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(new Uint8Array(await logo.arrayBuffer())).toEqual(png)
  expect((await raw('/api/app/brand/logo', { method: 'DELETE', headers })).status).toBe(200)
  expect((await raw(config.publicFlowLogoUrl!)).status).toBe(404)
  expect((await restored.brand.get()).logoVersion).toBeNull()
  const workspace = await raw('/api/app/workspace', { headers }).then(r => r.json()) as { timeZone: string; sendingWindowStart: string; sendingWindowEnd: string }
  expect(workspace).toMatchObject({ name: brand.name, timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })
})

contract(["DIST-020","DIST-026"], 'settings API preserves preview overrides and publication freezes defaults and images across later edits', async () => {
  const f = await previewFixture()
  await env.DB.prepare('UPDATE workspaces SET name=?,brand_configured=1,brand_logo_base64=?,brand_logo_mime=?,brand_logo_version=? WHERE id=?').bind('Synthetic studio', previewImage.base64, previewImage.mime, crypto.randomUUID(), f.workspace).run()
  const initial = await f.publish()
  expect(initial.status, await initial.clone().text()).toBe(201)
  const first = await initial.json() as { revision: { id: string } }
  const original = await f.snapshot(first.revision.id)
  expect(original).toMatchObject({ title: 'Customer feedback', description: 'Welcome  Tell us about your visit.', image: { mime: previewImage.mime, base64: previewImage.base64, alt: 'Synthetic studio' }, allowIndexing: false })
  expect(original.description).not.toContain('{{')
  await f.publicImage(first.revision.id, previewImage.base64)
  expect((await f.read()).flow.hasUnpublishedChanges).toBe(false)
  const custom = { ...f.settings, linkPreview: { title: 'Plan your next visit', description: 'Help shape our next season.', image: previewImage, allowIndexing: true } }
  expect((await f.save(custom)).status).toBe(200)
  const stored = (await f.read()).formSettings!
  const storedImage = stored.linkPreview!.image as LinkPreviewReference
  expect(storedImage).toMatchObject({ key: expect.any(String), mime: previewImage.mime, alt: previewImage.alt })
  expect(storedImage).not.toHaveProperty('base64')
  expect(stored).toMatchObject({ ...custom, linkPreview: { ...custom.linkPreview, image: storedImage } })
  expect((await f.read()).flow.hasUnpublishedChanges).toBe(true)
  expect((await f.call('/api/app/brand/logo', undefined, { method: 'DELETE' })).status).toBe(200)
  const republished = await f.publish()
  expect(republished.status, await republished.clone().text()).toBe(201)
  const second = await republished.json() as { revision: { id: string } }
  expect(await f.snapshot(second.revision.id)).toMatchObject({ ...custom.linkPreview, image: storedImage })
  expect(await f.snapshot(first.revision.id)).toEqual(original)
  await f.publicImage(first.revision.id, previewImage.base64)
  await f.publicImage(second.revision.id, previewImage.base64)
  const publicFlow = await f.call(`/api/public/flows/${f.slug}`, undefined, { auth: false })
  expect(publicFlow.status).toBe(200)
  expect(await publicFlow.json()).toMatchObject({ formSettings: stored })
  expect((await f.read()).flow.hasUnpublishedChanges).toBe(false)
  const other = await previewFixture()
  expect((await other.save({ ...other.settings, linkPreview: { image: storedImage } })).status).toBe(400)
  expect((await other.call(other.base + '/preview-image?key=' + encodeURIComponent(storedImage.key))).status).toBe(400)
  expect((await f.save({ ...stored, linkPreview: { ...stored.linkPreview, image: { ...storedImage, mime: 'image/jpeg' } } })).status).toBe(400)
  // The published image is also the source for independent duplicate/template custody.
  const sourceImage = storedImage
  const copiedResponse = await f.call(f.base + '/duplicate', { title: 'Copied preview', slug: `copy-${f.slug}` })
  expect(copiedResponse.status).toBe(201)
  const copied = await copiedResponse.json() as { id: string }
  const templateResponse = await f.call(f.base + '/templates', { name: 'Preview template', source: 'draft', expectedVersion: (await f.read()).flow.draftVersion })
  expect(templateResponse.status).toBe(201)
  const template = await templateResponse.json() as { id: string }
  const fromTemplate = await f.call(`/api/app/templates/${template.id}/flows`, { title: 'Templated preview', slug: `template-${f.slug}` })
  expect(fromTemplate.status).toBe(201)
  const templated = await fromTemplate.json() as { id: string }
  for (const flowId of [copied.id, templated.id]) {
    const base = `/api/app/flows/${flowId}`
    const draft = await (await f.call(base + '/draft')).json() as import('../../src/core/app/api').BuilderDraft
    const settings = draft.formSettings!, image = settings.linkPreview!.image as LinkPreviewReference
    expect(image).toMatchObject({ mime: previewImage.mime, alt: previewImage.alt })
    expect(image.key).not.toBe(sourceImage.key)
    expect(image).not.toHaveProperty('base64')
    const imageResponse = await f.call(base + '/preview-image?key=' + encodeURIComponent(image.key))
    expect(imageResponse.status).toBe(200)
    expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(decodeLogo(previewImage.base64))
    expect((await f.call(base + '/draft/settings', { expectedVersion: draft.flow.draftVersion, settings }, { method: 'PUT' })).status).toBe(200)
    const publish = await f.call(base + '/publish', { expectedVersion: draft.flow.draftVersion + 1 })
    expect(publish.status).toBe(201)
    const result = await publish.json() as { revision: { id: string } }
    await f.publicImage(result.revision.id, previewImage.base64)
  }
  const replacement = { ...previewImage, base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', alt: 'Our updated studio mark' }
  expect((await f.save({ ...stored, linkPreview: { ...stored.linkPreview, image: replacement } })).status).toBe(200)
  const replacementPublication = await f.publish()
  expect(replacementPublication.status).toBe(201)
  const third = await replacementPublication.json() as { revision: { id: string } }
  await f.publicImage(third.revision.id, replacement.base64)
  await f.publicImage(second.revision.id, previewImage.base64)
  await f.publicImage(first.revision.id, previewImage.base64)
})


contract(["DIST-020","DIST-026"], 'settings API rejects recalled preview text and invalid, oversized or unlabelled image uploads without mutating the draft, and publication rejects indexing on restricted and identified forms while preserving their existing admission rules', async () => {
  {
    const f = await previewFixture(), before = await f.read()
    const invalid = [
      { title: '{{hidden:campaign}}' }, { description: '{{variable:score}}' }, { title: '*|EMAIL|*' }, { description: '%%answer%%' },
      { title: 'x'.repeat(linkPreviewLimits.titleCharacters + 1) }, { description: 'x'.repeat(linkPreviewLimits.descriptionCharacters + 1) },
      { image: { ...previewImage, alt: '' } }, { image: { ...previewImage, alt: '{{hidden:campaign}}' } },
      { image: { ...previewImage, mime: 'image/jpeg' } }, { image: { ...previewImage, mime: 'image/svg+xml' } },
      { image: { ...previewImage, base64: 'invalid!' } },
      { image: { ...previewImage, base64: btoa('x'.repeat(linkPreviewLimits.imageBytes + 1)) } },
      { allowIndexing: 'true' }, { unknownSetting: true },
    ]
    for (const linkPreview of invalid) expect((await f.save({ ...f.settings, linkPreview })).status).toBe(400)
    expect((await f.read()).flow.draftVersion).toBe(before.flow.draftVersion)
    expect((await f.read()).formSettings).toEqual(before.formSettings)
    expect((await f.save({ ...f.settings, linkPreview: { title: '', description: '', image: previewImage } })).status).toBe(200)
    expect((await f.publish()).status).toBe(201)
  }
  {
    const f = await previewFixture()
    expect((await f.call(f.base + '/access', { expectedVersion: (await f.read()).flow.draftVersion, rule: { mode: 'password', password: 'synthetic-survey-password' } }, { method: 'PUT' })).status).toBe(200)
    const restricted = (await f.read()).formSettings!
    expect((await f.save({ ...restricted, linkPreview: { allowIndexing: true } })).status).toBe(200)
    const refused = await f.publish()
    expect(refused.status).toBe(400)
    expect(await refused.text()).toContain('indexing')
    expect((await f.read()).formSettings!.access).toEqual(restricted.access)
    expect((await f.save({ ...restricted, linkPreview: { allowIndexing: false } })).status).toBe(200)
    expect((await f.publish()).status).toBe(201)
    const gate = await f.call(`/api/public/flows/${f.slug}`, undefined, { auth: false })
    expect(gate.status).toBe(403)
    expect(await gate.json()).toMatchObject({ restriction: { mode: 'password' } })
    const identified = await previewFixture()
    expect((await identified.save({ ...identified.settings, identityMode: 'identified', linkPreview: { allowIndexing: true } })).status).toBe(200)
    expect((await identified.publish()).status).toBe(400)
    expect((await identified.save({ ...identified.settings, identityMode: 'identified', linkPreview: { allowIndexing: false } })).status).toBe(200)
    expect((await identified.publish()).status).toBe(201)
  }
})
contract(["DIST-020","DIST-026"], 'upgrading existing publications freezes their logo preview without changing admission policy', async () => {
  const f = await previewFixture()
  await env.DB.prepare('UPDATE workspaces SET name=?,brand_configured=1,brand_logo_base64=?,brand_logo_mime=? WHERE id=?').bind('Harbour Studio',previewImage.base64,previewImage.mime,f.workspace).run()
  const publication = await f.publish()
  expect(publication.status).toBe(201)
  const {revision} = await publication.json() as {revision:{id:string}}
  await env.DB.prepare("UPDATE flow_revisions SET policy_snapshot_json=json_remove(policy_snapshot_json,'$.linkPreview') WHERE id=?").bind(revision.id).run()
  const policyBefore = await env.DB.prepare('SELECT policy_snapshot_json AS policy FROM flow_revisions WHERE id=?').bind(revision.id).first<{policy:string}>()
  const migration = __PENCIL_CORE_MIGRATIONS__.find(item => item.name.includes('link_preview_snapshots'))!
  await env.DB.batch(migration.queries.map(query => env.DB.prepare(query)))
  const frozen = await f.snapshot(revision.id)
  expect(frozen).toMatchObject({title:'Customer feedback',allowIndexing:false,image:{base64:previewImage.base64,mime:previewImage.mime,alt:'Harbour Studio'}})
  const policyAfter = await env.DB.prepare('SELECT policy_snapshot_json AS policy FROM flow_revisions WHERE id=?').bind(revision.id).first<{policy:string}>()
  expect(policyAfter).toEqual(policyBefore)
  await f.publicImage(revision.id,previewImage.base64)
  expect((await f.call('/api/app/brand/logo',undefined,{method:'DELETE'})).status).toBe(200)
  await env.DB.batch(migration.queries.map(query => env.DB.prepare(query)))
  expect(await f.snapshot(revision.id)).toEqual(frozen)
  await f.publicImage(revision.id,previewImage.base64)
})

contract(["BASE-DATA-001","DATA-001","DIST-020","DIST-026"], 'owner backup carries immutable R2 share images, checks their bytes and refuses missing attachment custody', async () => {
  const f = await previewFixture()
  expect((await f.save({...f.settings,linkPreview:{image:previewImage}})).status).toBe(200)
  expect((await f.publish()).status).toBe(201)
  const saved = (await f.read()).formSettings!.linkPreview!.image!
  if (!('key' in saved)) throw Error('Expected an R2 image reference')
  const response = await f.call('/api/app/backup/export',{})
  expect(response.status,await response.clone().text()).toBe(200)
  const archive = await response.json() as BackupArchive
  const image = archive.payload.objects!.find(object => object.key === saved.key)!
  expect(image).toEqual({bucket:'FORM_ASSETS',key:saved.key,mime:previewImage.mime,customMetadata:{workspaceId:f.workspace,flowId:f.id,mime:previewImage.mime},data:previewImage.base64})
  const checked = await f.call('/api/app/backup/check',archive)
  expect(checked.status,await checked.clone().text()).toBe(200)
  const invalid = structuredClone(archive)
  invalid.payload.objects!.find(object => object.key === saved.key)!.data = btoa('damaged image')
  invalid.sha256 = await digest(invalid.payload)
  expect((await f.call('/api/app/backup/check',invalid)).status).toBe(400)
  const bucket = env.FORM_ASSETS
  try {
    await bucket.delete(saved.key)
    expect((await f.call('/api/app/backup/export',{})).status).toBe(400)
  } finally {
    await bucket.put(image.key,Uint8Array.from(atob(image.data),character=>character.charCodeAt(0)),{httpMetadata:{contentType:image.mime},customMetadata:image.customMetadata})
  }
})

