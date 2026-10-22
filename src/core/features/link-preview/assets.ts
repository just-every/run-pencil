import { decodeLogo, validateLogo } from '../brand'
import { NotFoundError, ValidationError } from '../../shared/errors'
import type { FormSettings } from '../../shared/hiddenFields'
import { linkPreviewIssue, linkPreviewLimits, previewImageKey, type LinkPreviewReference } from '../../shared/linkPreview'

const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp'])
const assetHeaders = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; sandbox" }

/** Custom share images live outside the transactional product-data snapshot. */
export class LinkPreviewAssets {
  constructor(private readonly bucket: R2Bucket) {}

  private metadata(object: R2Object, key: string, workspaceId?: string, flowId?: string, claimedMime?: string) {
    const [, workspace, flow] = key.split('/'), metadata = object.customMetadata
    if (!previewImageKey(key) || metadata?.workspaceId !== workspace || metadata?.flowId !== flow ||
      workspaceId !== undefined && workspaceId !== workspace || flowId !== undefined && flowId !== flow ||
      !allowedMime.has(metadata?.mime ?? '') || object.httpMetadata?.contentType !== metadata?.mime ||
      claimedMime !== undefined && claimedMime !== metadata?.mime || object.size < 1 || object.size > linkPreviewLimits.imageBytes) {
      throw new ValidationError('This share image does not belong to the requested form or has invalid image metadata.')
    }
    return metadata!.mime
  }

  private async owned(workspaceId: string, flowId: string, key: string, mime?: string) {
    if (!previewImageKey(key) || !key.startsWith(`previews/${workspaceId}/${flowId}/`)) throw new ValidationError('Choose a share image uploaded to this form.')
    const object = await this.bucket.head(key)
    if (!object) throw new ValidationError('This share image is no longer available. Upload it again.')
    this.metadata(object, key, workspaceId, flowId, mime)
    return object
  }

  async save(workspaceId: string, flowId: string, settings: FormSettings): Promise<FormSettings> {
    const image = settings.linkPreview?.image
    if (!image) return settings
    const issue = linkPreviewIssue(settings.linkPreview)
    if (issue) throw new ValidationError(issue)
    if ('key' in image) {
      await this.owned(workspaceId, flowId, image.key, image.mime)
      return settings
    }
    const bytes = decodeLogo(image.base64)
    validateLogo(bytes, image.mime)
    return this.store(workspaceId, flowId, settings, bytes, image.mime, image.alt)
  }

  private async store(workspaceId: string, flowId: string, settings: FormSettings, bytes: Uint8Array, mime: string, alt: string) {
    const prefix = new TextEncoder().encode(mime + '\0'), fingerprint = new Uint8Array(prefix.length + bytes.length)
    fingerprint.set(prefix); fingerprint.set(bytes, prefix.length)
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', fingerprint))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const key = `previews/${workspaceId}/${flowId}/${hash}`
    if (!previewImageKey(key)) throw new ValidationError('This form cannot own a share image with its current identifier.')
    await this.bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: mime }, customMetadata: { workspaceId, flowId, mime } })
    await this.owned(workspaceId, flowId, key, mime)
    const reference: LinkPreviewReference = { mime, key, alt }
    return { ...settings, linkPreview: { ...settings.linkPreview, image: reference } }
  }

  async copyOwned(workspaceId: string, sourceFlowId: string, destinationFlowId: string, settings: FormSettings): Promise<FormSettings> {
    const image = settings.linkPreview?.image
    if (!image || 'base64' in image) return this.save(workspaceId, destinationFlowId, settings)
    await this.owned(workspaceId, sourceFlowId, image.key, image.mime)
    const object = await this.bucket.get(image.key)
    if (!object) throw new ValidationError('This share image is no longer available. Upload it again.')
    const mime = this.metadata(object, image.key, workspaceId, sourceFlowId, image.mime)
    const bytes = new Uint8Array(await object.arrayBuffer())
    validateLogo(bytes, mime)
    return this.store(workspaceId, destinationFlowId, settings, bytes, mime, image.alt)
  }

  async readOwned(workspaceId: string, flowId: string, key: string): Promise<Response> {
    await this.owned(workspaceId, flowId, key)
    return this.read(key)
  }

  /** Caller must first resolve the key through an accessible published revision. */
  async read(key: string): Promise<Response> {
    if (!previewImageKey(key)) throw new NotFoundError('This share image is not available.')
    const object = await this.bucket.get(key)
    if (!object) throw new NotFoundError('This share image is not available.')
    const mime = this.metadata(object, key)
    return new Response(object.body, { headers: { ...assetHeaders, 'Content-Type': mime } })
  }
}
