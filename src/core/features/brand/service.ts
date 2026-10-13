import { NotFoundError, ValidationError } from '../../shared/errors'
import { brandColors, neutralBrand, type BrandInput, type WorkspaceBrand } from './brand'
import { decodeLogo, encodeLogo, validateLogo } from './logo'
import type { BrandRepository } from './repository'

export class BrandService {
  constructor(private readonly repository: BrandRepository, private readonly checkAdmission: (slug: string) => Promise<unknown>) {}
  async get(workspaceId?: string): Promise<WorkspaceBrand> {
    const row = await this.repository.get(workspaceId)
    if (!row) return { ...neutralBrand }
    return { name: row.brandConfigured ? row.name : neutralBrand.name, configured: row.brandConfigured, supportingLine: row.brandSupportingLine, accent: row.brandAccent, logoVersion: row.brandLogoVersion, publicFlowSlug: row.publicFlowSlug }
  }
  async save(workspaceId: string, input: BrandInput) {
    const row = await this.repository.get(workspaceId)
    if (!row) throw new NotFoundError('The workspace no longer exists.')
    const name = input.name.trim(), supportingLine = input.supportingLine.trim()
    if (!name || name.length > 100 || supportingLine.length > 240) throw new ValidationError('Use a business name of 1–100 characters and a supporting line of at most 240 characters.')
    let accent: string
    try { accent = brandColors(input.accent).accent } catch (error) { throw new ValidationError((error as Error).message) }
    // Retain a selected closed flow so its landing follows the canonical admission outcome.
    if (input.publicFlowSlug && input.publicFlowSlug !== row.publicFlowSlug) {
      if (!await this.repository.publishedFlow(workspaceId, input.publicFlowSlug)) throw new ValidationError('Choose an open published flow for the public landing.')
      try { await this.checkAdmission(input.publicFlowSlug) } catch (error) {
        if (error instanceof Error && 'code' in error && ['FLOW_CLOSED', 'NOT_FOUND'].includes(String(error.code))) throw new ValidationError('Choose an open published flow for the public landing.')
        throw error
      }
    }
    await this.repository.save(workspaceId, { ...input, name, supportingLine, accent })
    return this.get(workspaceId)
  }
  async saveLogo(workspaceId: string, bytes: Uint8Array, mime: string) {
    if (!await this.repository.get(workspaceId)) throw new NotFoundError('The workspace no longer exists.')
    validateLogo(bytes, mime)
    await this.repository.logo(workspaceId, { brandLogoBase64: encodeLogo(bytes), brandLogoMime: mime, brandLogoVersion: crypto.randomUUID() })
    return this.get(workspaceId)
  }
  async removeLogo(workspaceId: string) {
    if (!await this.repository.get(workspaceId)) throw new NotFoundError('The workspace no longer exists.')
    await this.repository.logo(workspaceId, { brandLogoBase64: null, brandLogoMime: null, brandLogoVersion: null })
    return this.get(workspaceId)
  }
  async logoResponse(version: string) {
    const row = await this.repository.byLogoVersion(version)
    if (!row?.brandLogoBase64 || !row.brandLogoMime) throw new NotFoundError('No business logo is configured.')
    const bytes = decodeLogo(row.brandLogoBase64)
    validateLogo(bytes, row.brandLogoMime)
    return new Response(bytes, { headers: { 'Content-Type': row.brandLogoMime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Access-Control-Allow-Origin': '*' } })
  }
}
