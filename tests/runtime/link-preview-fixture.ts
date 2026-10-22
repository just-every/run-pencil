import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import type { BuilderDraft } from '../../src/core/app/api'
import type { FormSettings } from '../../src/core/shared/hiddenFields'
import { readPublishedPreview } from '../../src/core/shared/linkPreview'
import { decodeLogo } from '../../src/core/features/brand/logo'
import { googleHttp } from './google-import-http'

export const previewImage = { mime: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=', alt: 'A small blue mark' }

export async function previewFixture() {
  const f = await googleHttp(), slug = `preview-${crypto.randomUUID()}`
  const created = await f.call('/api/app/flows', { title: 'Customer feedback', slug })
  expect(created.status).toBe(201)
  const { id } = await created.json() as { id: string }, base = `/api/app/flows/${id}`
  const read = async () => await (await f.call(base + '/draft')).json() as BuilderDraft & { flow: BuilderDraft['flow'] & { hasUnpublishedChanges: boolean } }
  for (const step of [
    { kind: 'welcome', questionType: null, prompt: 'Welcome {{hidden:campaign}}', helperText: 'Tell us about your visit.' },
    { kind: 'question', questionType: 'short_text', prompt: 'What would help?', required: true },
    { kind: 'completion', questionType: null, prompt: 'Thank you.' },
  ]) expect((await f.call(base + '/draft/steps', { expectedVersion: (await read()).flow.draftVersion, step })).status).toBe(201)
  const settings: FormSettings = { identityMode: 'anonymous', hiddenFields: [{ id: 'campaign', name: 'utm_campaign', type: 'text', category: 'campaign' }] }
  const save = async (value: unknown) => f.call(base + '/draft/settings', { expectedVersion: (await read()).flow.draftVersion, settings: value }, { method: 'PUT' })
  expect((await save(settings)).status).toBe(200)
  const publish = async () => f.call(base + '/publish', { expectedVersion: (await read()).flow.draftVersion })
  const snapshot = async (revisionId: string) => {
    const row = await env.DB.prepare('SELECT r.policy_snapshot_json AS policy,p.preview_json AS legacy FROM flow_revisions r LEFT JOIN revision_link_previews p ON p.revision_id=r.id WHERE r.id=?').bind(revisionId).first<{ policy: string; legacy: string | null }>()
    return readPublishedPreview(row!.policy, row!.legacy)!
  }
  const publicImage = async (revisionId: string, base64: string) => {
    const response = await f.call(`/api/public/previews/${revisionId}/image`, undefined, { auth: false })
    expect(response.status, response.ok ? undefined : await response.clone().text()).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(decodeLogo(base64))
  }
  return { ...f, id, base, slug, read, save, publish, snapshot, settings, publicImage }
}

