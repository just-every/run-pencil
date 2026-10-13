import { decodePublicSlug } from '../../app/public-slug'
import { expect } from 'vitest'
import { contract } from '../../../test/contract'
import { brandColors, contrastRatio, neutralBrand, publicBrandConfig } from './brand'
import { decodeLogo, validateLogo, logoByteLimit } from './logo'
import { isEmbedEvent, isEmbedInit } from '../embedding'
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII='
contract(['BRAND-001', 'BASE-PUBLIC-003'], 'accent foreground is at least 4.5:1 at the black-white boundary and at the extremes', () => {
  for (const accent of ['#000000', '#ffffff', '#747474', '#757575', '#767676', '#777777', '#ff0000', '#00ff00', '#0000ff', '#abcdef']) {
    const colors = brandColors(accent)
    expect(contrastRatio(accent, colors.accentText)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(colors.accentInk, publicBrandConfig(neutralBrand, { productName: 'Pencil', organizationName: '', showPoweredByCredit: false }).publicFlowTheme.background)).toBeGreaterThanOrEqual(4.5)
  }
  expect(brandColors('#747474').accentText).toBe('#ffffff')
  expect(brandColors('#767676').accentText).toBe('#000000')
  for (const value of ['red', '#fff', '#gggggg', '#ffffff;', 'url(x)']) expect(() => brandColors(value)).toThrow()
})
contract('BRAND-001', 'neutral branding has no business example, logo or selected root, and produces the shared public shape', () => {
  const config = publicBrandConfig(neutralBrand, { productName: 'Pencil', organizationName: 'Your organization', showPoweredByCredit: false })
  expect(config.publicFlowSlug).toBe(''); expect(config.publicFlowLogoUrl).toBeUndefined()
  expect(JSON.stringify(config)).not.toMatch(/aurora|cafe|coffee/i)
  expect(config.publicFlowTheme.accent).toBe('#d4d4d4')
})
contract(['BRAND-001', 'BASE-INPUT-001'], 'logo content signatures and declared MIME must agree and oversize, SVG and truncated uploads are refused', () => {
  const bytes = decodeLogo(png)
  expect(() => validateLogo(bytes, 'image/png')).not.toThrow()
  for (const [data, mime] of [[bytes, 'image/jpeg'], [Uint8Array.from([255,216,255,0,0,0,0,0,0,0,255,217]), 'image/jpeg'], [bytes, 'image/svg+xml'], [new TextEncoder().encode('<svg onload="alert(1)"/>'), 'image/png'], [bytes.slice(0, -1), 'image/png'], [new Uint8Array(logoByteLimit + 1), 'image/png'], [new Uint8Array(), 'image/webp']] as const) expect(() => validateLogo(data, mime)).toThrow()
})
contract(['DIST-002', 'DIST-009', 'BASE-PUBLIC-002'], 'embed protocol only accepts exact field shapes and the matching challenge', () => {
  const challenge = 'ab'.repeat(16)
  expect(isEmbedInit({ type: 'pencil:init', challenge }, challenge)).toBe(true)
  expect(isEmbedInit({ type: 'pencil:init', challenge, answers: [] }, challenge)).toBe(false)
  for (const type of ['pencil:loaded', 'pencil:completed']) expect(isEmbedEvent({ type, challenge }, challenge)).toBe(true)
  expect(isEmbedEvent({ type: 'pencil:height', challenge, height: 435 }, challenge)).toBe(true)
  for (const data of [null, [], { type: 'pencil:answers', challenge }, { type: 'pencil:completed', challenge, responseId: 'private' }, { type: 'pencil:height', challenge, height: '500' }, { type: 'pencil:height', challenge, height: 0 }, { type: 'pencil:height', challenge, height: 100001 }, { type: 'pencil:height', challenge, height: 5.5 }, { type: 'pencil:loaded', challenge: 'cc'.repeat(16) }]) expect(isEmbedEvent(data, challenge)).toBe(false)
})

contract('BASE-INPUT-001', 'malformed public slug encoding is refused without throwing or reaching a flow lookup', () => {
  for (const encoded of ['%ZZ', '%', 'visit%2fprivate', 'visit%00', '../private', 'a'.repeat(121)]) expect(decodePublicSlug(encoded)).toBeUndefined()
  expect(decodePublicSlug('visit-review')).toBe('visit-review')
})
