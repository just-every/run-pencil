import { decodeLogo, logoByteLimit, validateLogo } from '../features/brand/logo'
import type { FormSettings } from './hiddenFields'

export type LinkPreviewUpload = { mime: string; base64: string; alt: string }
export type LinkPreviewReference = { mime: string; key: string; alt: string }
export type LinkPreviewImage = LinkPreviewUpload | LinkPreviewReference
export type LinkPreviewSettings = { title?: string; description?: string; image?: LinkPreviewImage; allowIndexing?: boolean }
export type LinkPreviewDefaults = { image?: LinkPreviewImage; background?: string }
export type LinkPreviewAssetStore = {
  save(workspaceId: string, flowId: string, settings: FormSettings): Promise<FormSettings>
  copyOwned(workspaceId: string, sourceFlowId: string, destinationFlowId: string, settings: FormSettings): Promise<FormSettings>
}
export type PublishedLinkPreview = { title: string; description: string; image: LinkPreviewImage | null; allowIndexing: boolean; background?: string }
export const linkPreviewLimits = { titleCharacters: 200, descriptionCharacters: 1000, altCharacters: 300, imageBytes: logoByteLimit } as const
const recall = /\{\{[\s\S]*?\}\}|\*\|[^|]*\|\*|%%[^%]*%%/g
const hasRecall = (text: string) => /\{\{|\}\}|\*\||\|\*|%%/.test(text)
export const previewImageKey = (key: string) => /^previews\/[A-Za-z0-9_-]{1,200}\/[A-Za-z0-9_-]{1,200}\/[a-f0-9]{64}$/.test(key)

/** Preview defaults are static text; never interpolate respondent context. */
export function previewText(text: string): string {
  return text.replace(recall, '').replace(/\{\{[\s\S]*$|\*\|[\s\S]*$|%%[\s\S]*$/g, '').trim()
}

export function linkPreviewIssue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Choose valid link preview settings.'
  if (Object.keys(value).some(key => !['title', 'description', 'image', 'allowIndexing'].includes(key))) return 'Unknown link preview setting.'
  const settings = value as LinkPreviewSettings
  for (const [field, limit] of [['title', linkPreviewLimits.titleCharacters], ['description', linkPreviewLimits.descriptionCharacters]] as const) {
    const text = settings[field]
    if (text !== undefined && (typeof text !== 'string' || text.length > limit || hasRecall(text))) return `Share ${field} must be static text of at most ${limit} characters, without recall tokens.`
  }
  if (settings.allowIndexing !== undefined && typeof settings.allowIndexing !== 'boolean') return 'Choose whether search engines may index this public form.'
  if (settings.image !== undefined) {
    const image = settings.image
    if (!image || typeof image !== 'object' || Array.isArray(image) || !['alt,base64,mime', 'alt,key,mime'].includes(Object.keys(image).sort().join(','))) return 'Choose a PNG, JPEG or WebP share image with alt text.'
    if (typeof image.alt !== 'string' || !image.alt.trim() || image.alt.length > linkPreviewLimits.altCharacters || hasRecall(image.alt)) return `Share image alt text is required, must be static and may contain at most ${linkPreviewLimits.altCharacters} characters.`
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.mime)) return 'Choose a PNG, JPEG or WebP share image.'
    if ('key' in image) return typeof image.key === 'string' && previewImageKey(image.key) ? undefined : 'Choose a valid saved share image.'
    if (typeof image.mime !== 'string' || typeof image.base64 !== 'string' || image.base64.length > 4 * Math.ceil(logoByteLimit / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64)) return `Choose a valid share image of at most ${logoByteLimit} bytes.`
    try { validateLogo(decodeLogo(image.base64), image.mime) }
    catch { return `Choose a valid PNG, JPEG or WebP share image of at most ${logoByteLimit} bytes.` }
  }
}

export function linkPreviewPublicationIssues(settings: FormSettings) {
  const issue = settings.linkPreview === undefined ? undefined : linkPreviewIssue(settings.linkPreview)
  if (issue) return [{ stepId: 'link-preview', reason: issue }]
  return settings.linkPreview?.allowIndexing && (settings.access || settings.identityMode === 'identified')
    ? [{ stepId: 'link-preview', reason: 'Restricted and identified forms cannot allow search indexing. Turn indexing off before publishing.' }]
    : []
}

export function resolveLinkPreview(settings: FormSettings, title: string, steps: ReadonlyArray<{ kind: string; prompt: string; helperText?: string | null }>, defaultImage?: LinkPreviewImage, background?: string): PublishedLinkPreview {
  const welcome = steps.find(step => step.kind === 'welcome')
  const preview = settings.linkPreview
  return {
    title: preview?.title ?? previewText(title),
    description: preview?.description ?? previewText(welcome ? [welcome.prompt, welcome.helperText].filter(Boolean).join(' ') : ''),
    image: preview?.image ?? defaultImage ?? null,
    allowIndexing: preview?.allowIndexing === true && !settings.access && settings.identityMode !== 'identified',
    ...(background ? { background } : {}),
  }
}

/** Missing snapshots belong only to publications made before link previews. */
export function readPublishedPreview(policySnapshotJson: string | null): PublishedLinkPreview | undefined {
  if (policySnapshotJson === null) return undefined
  const snapshot = JSON.parse(policySnapshotJson) as { linkPreview?: PublishedLinkPreview }
  return snapshot.linkPreview
}
