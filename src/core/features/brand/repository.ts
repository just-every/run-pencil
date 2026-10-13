import { and, eq } from 'drizzle-orm'
import type { PencilDatabase } from '../../platform/db/repository'
import { flows, workspaces } from '../../platform/db/schema'
import type { BrandInput } from './brand'

export class BrandRepository {
  constructor(private readonly database: PencilDatabase) {}
  async get(workspaceId?: string) {
    const [row] = await this.database.select().from(workspaces).where(workspaceId ? eq(workspaces.id, workspaceId) : undefined).orderBy(workspaces.createdAt).limit(1)
    return row
  }
  async byLogoVersion(version: string) {
    const [row] = await this.database.select().from(workspaces).where(eq(workspaces.brandLogoVersion, version)).limit(1)
    return row
  }
  async publishedFlow(workspaceId: string, slug: string) {
    const [flow] = await this.database.select().from(flows).where(and(eq(flows.workspaceId, workspaceId), eq(flows.slug, slug), eq(flows.status, 'open'))).limit(1)
    return flow
  }
  async save(workspaceId: string, input: BrandInput) {
    await this.database.update(workspaces).set({ name: input.name, brandConfigured: true, brandSupportingLine: input.supportingLine, brandAccent: input.accent, publicFlowSlug: input.publicFlowSlug, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, workspaceId))
  }
  async logo(workspaceId: string, data: { brandLogoBase64: string | null; brandLogoMime: string | null; brandLogoVersion: string | null }) {
    await this.database.update(workspaces).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(workspaces.id, workspaceId))
  }
}
