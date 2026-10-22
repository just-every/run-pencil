import type { FormSettings } from '../../shared/hiddenFields'
import { linkPreviewIssue, type LinkPreviewSettings } from '../../shared/linkPreview'
import type { ReportItem } from './model'

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Typeform's documented metadata lives under settings.meta, including indexing. */
export function mapTypeformSettings(value: unknown, report: ReportItem[]): FormSettings | undefined {
  if (value === undefined) return
  const item = (location: string, label: string, state: ReportItem['state'], change: string, reason: string) => report.push({ location, label, sourceType: 'form setting', state, change, reason })
  if (!record(value)) {
    item('/settings', 'Form settings', 'unsupported', 'Settings omitted', 'Source settings must be an object; no settings were guessed.')
    return
  }
  for (const key of Object.keys(value)) if (key !== 'meta') item(`/settings/${key}`, key, 'unsupported', 'Setting omitted', 'This source setting has no imported native behavior.')
  if (value.meta === undefined) return
  if (!record(value.meta)) {
    item('/settings/meta', 'Link preview', 'unsupported', 'Metadata omitted', 'Source metadata must be an object; no preview settings were guessed.')
    return
  }
  const preview: LinkPreviewSettings = {}
  for (const [source, target, label] of [['title', 'title', 'Share title'], ['description', 'description', 'Share description'], ['allow_indexing', 'allowIndexing', 'Search indexing']] as const) {
    if (value.meta[source] === undefined) continue
    const candidate = { [target]: value.meta[source] }
    const issue = linkPreviewIssue(candidate)
    if (issue) item(`/settings/meta/${source}`, label, 'unsupported', 'Setting omitted', issue)
    else {
      Object.assign(preview, candidate)
      item(`/settings/meta/${source}`, label, 'imported', target === 'allowIndexing' ? (preview.allowIndexing ? 'Search indexing allowed' : 'Search indexing disabled') : String(value.meta[source]), 'Preserved as published-revision link preview settings; indexing remains subject to native publication restrictions.')
    }
  }
  if (value.meta.image !== undefined) {
    const image = value.meta.image
    const embedded = record(image) ? image.pencilImage : undefined
    if (embedded !== undefined) {
      // A definition is an untrusted upload, even if its bytes came from the connection action.
      // Stored object references are never admitted through this source field.
      const shape = record(embedded) && Object.keys(embedded).sort().join(',') === 'alt,base64,mime'
      const issue = shape ? linkPreviewIssue({ image: embedded }) : 'The embedded image needs exactly its MIME type, base64 bytes and required alt text.'
      if (issue) item('/settings/meta/image', 'Share image', 'unsupported', 'Image omitted', issue)
      else {
        preview.image = embedded as { mime: string; base64: string; alt: string }
        item('/settings/meta/image', 'Share image', 'imported', 'Source image retained with alt text', 'Validated PNG, JPEG or WebP bytes are imported with the revision; the source share title, or form title when no share title is set, supplies editable alt text. Rendering never retrieves the external image.')
      }
    } else {
      const source = record(image) && typeof image.href === 'string' ? ` Source image: ${image.href}` : ''
      item('/settings/meta/image', 'Share image', 'unsupported', 'Image requires retrieval or an upload', `This file contains an external image reference only. Use Test connection and get form to retrieve the Typeform image, or upload it with alt text in the share panel. Reviewing a file makes no external request.${source}`)
    }
  }
  for (const key of Object.keys(value.meta)) if (!['title', 'description', 'allow_indexing', 'image'].includes(key)) item(`/settings/meta/${key}`, key, 'unsupported', 'Metadata omitted', 'This source metadata has no imported native behavior.')
  return Object.keys(preview).length ? { hiddenFields: [], identityMode: 'anonymous', linkPreview: preview } : undefined
}
