import type { CSSProperties } from 'react'
import type { PublicSeedConfig } from '../../shared/config'

export type WorkspaceBrand = {
  name: string
  configured: boolean
  supportingLine: string
  accent: string
  logoVersion: string | null
  publicFlowSlug: string | null
}
export type BrandInput = Pick<WorkspaceBrand, 'name' | 'supportingLine' | 'accent' | 'publicFlowSlug'>
export const neutralBrand: WorkspaceBrand = { name: 'Your business', configured: false, supportingLine: '', accent: '#d4d4d4', logoVersion: null, publicFlowSlug: null }

export function luminance(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Use an accent in #rrggbb format.')
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
}
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + .05) / (dark + .05)
}
/** The public form's paper, surface and ink: the product's own (site/styles/tokens.css). */
const publicPaper = '#fbfaf6'

/** Shared by respondent surfaces and notification layouts. `accentInk` is the accent where it reads on paper, else ink. */
export function brandColors(accent: string) {
  const text = contrastRatio(accent, '#000000') >= contrastRatio(accent, '#ffffff') ? '#000000' : '#ffffff'
  if (contrastRatio(accent, text) < 4.5) throw new Error('The accent needs text contrast of at least 4.5:1.')
  return { accent: accent.toLowerCase(), accentText: text, accentInk: contrastRatio(accent, publicPaper) >= 4.5 ? accent.toLowerCase() : '#1e2124' }
}
export function publicBrandConfig(brand: WorkspaceBrand, product: Pick<PublicSeedConfig, 'organizationName' | 'productName' | 'showPoweredByCredit'>): PublicSeedConfig {
  return { ...product, publicFlowBusinessName: brand.name, publicFlowPurpose: brand.supportingLine, publicFlowSlug: brand.publicFlowSlug ?? '', publicFlowLogoUrl: brand.logoVersion ? `/api/public/brand/logo?v=${encodeURIComponent(brand.logoVersion)}` : undefined,
    publicFlowTheme: { ...brandColors(brand.accent), background: publicPaper, surface: '#ffffff', text: '#1e2124' } }
}
export function brandStyle(config: PublicSeedConfig): CSSProperties {
  const colors = brandColors(config.publicFlowTheme.accent)
  // A pale accent (the neutral #d4d4d4 among them) has no 3:1 edge on paper, so its buttons take an ink outline and read as active.
  const edge = contrastRatio(colors.accent, publicPaper) >= 3 ? colors.accent : '#1e2124'
  return { '--brand-accent': colors.accent, '--brand-accent-text': colors.accentText, '--brand-ink': colors.accentInk, '--brand-edge': edge, '--canvas': config.publicFlowTheme.background, '--surface': config.publicFlowTheme.surface, '--ink': config.publicFlowTheme.text } as CSSProperties
}
