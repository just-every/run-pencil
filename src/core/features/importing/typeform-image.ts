import { encodeLogo, logoByteLimit, validateLogo } from '../brand'
import { ValidationError } from '../../shared/errors'
import { linkPreviewIssue } from '../../shared/linkPreview'

/** Only the documented Typeform image endpoint; no caller-selected host or query. */
export function typeformImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !/^https:\/\/images\.typeform\.com\/images\/[A-Za-z0-9_-]{1,256}$/.test(value) || value.trim() !== value) {
    throw new ValidationError('The Typeform share image must use its original images.typeform.com image link. No image was retrieved.')
  }
  return value
}

async function imageBytes(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get('Content-Length')) > logoByteLimit || !response.body) {
    await response.body?.cancel()
    throw new ValidationError(`The Typeform share image must be between 1 and ${logoByteLimit} bytes.`)
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > logoByteLimit) throw new ValidationError(`The Typeform share image exceeds the ${logoByteLimit}-byte limit.`)
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

/** Called only by the operator-requested connection action, never by file review or rendering. */
export async function retrieveTypeformImage(href: unknown, alt: string, signal: AbortSignal) {
  const response = await fetch(typeformImageUrl(href), {
    headers: { Accept: 'image/png,image/jpeg,image/webp' }, redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new ValidationError('Typeform could not return the original share image. Image redirects are refused; check the source image and try again.')
  }
  const mime = (response.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    await response.body?.cancel()
    throw new ValidationError('The Typeform share image must be a PNG, JPEG or WebP. No image was imported.')
  }
  const bytes = await imageBytes(response)
  try { validateLogo(bytes, mime) }
  catch { throw new ValidationError('The Typeform share image content does not match its declared PNG, JPEG or WebP type.') }
  const image = { mime, base64: encodeLogo(bytes), alt }
  const issue = linkPreviewIssue({ image })
  if (issue) throw new ValidationError(`The Typeform share image needs a static title for its alt text. ${issue}`)
  return image
}
