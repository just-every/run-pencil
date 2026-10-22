import { jpegStructure } from './jpeg'
import manifest from '../../../../seed.json' with { type: 'json' }
import { ValidationError } from '../../shared/errors'

export const logoByteLimit = manifest.limits.brand.logoBytes
const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp'])
export function validateLogo(bytes: Uint8Array, mime: string) {
  if (!allowedMime.has(mime)) throw new ValidationError('Choose a PNG, JPEG or WebP logo. SVG is not accepted.')
  if (!bytes.length || bytes.length > logoByteLimit) throw new ValidationError(`The logo must be between 1 and ${logoByteLimit} bytes.`)
  const matches = (offset: number, values: number[]) => values.every((value, index) => bytes[offset + index] === value)
  const ascii = (offset: number, value: string) => matches(offset, [...value].map(c => c.charCodeAt(0)))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const png = bytes.length >= 45 && matches(0, [137, 80, 78, 71, 13, 10, 26, 10]) && ascii(12, 'IHDR') && view.getUint32(8) === 13 && view.getUint32(16) > 0 && view.getUint32(20) > 0 && ascii(bytes.length - 8, 'IEND') && matches(bytes.length - 4, [174, 66, 96, 130])
  const jpeg = jpegStructure(bytes)
  const webp = bytes.length >= 20 && ascii(0, 'RIFF') && ascii(8, 'WEBP') && view.getUint32(4, true) === bytes.length - 8 && ['VP8 ', 'VP8L', 'VP8X'].some(type => ascii(12, type))
  if (!(mime === 'image/png' ? png : mime === 'image/jpeg' ? jpeg : webp)) throw new ValidationError('The logo content does not match its image type.')
}
export function encodeLogo(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export function decodeLogo(base64: string) { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }
