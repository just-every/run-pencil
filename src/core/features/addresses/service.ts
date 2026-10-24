import { decodePublicSlug } from '../../app/public-slug'
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors'

/** Address custody is independent of published content: aliases always resolve to the current address. */
export class FormAddresses {
  constructor(private readonly db: D1Database) {}
  async rename(workspaceId: string, flowId: string, expectedSlug: string, slug: string) {
    if (decodePublicSlug(slug) !== slug) throw new ValidationError('Use lowercase letters, numbers and single hyphens, up to 120 characters.')
    const form = await this.db.prepare('SELECT slug FROM flows WHERE id=? AND workspace_id=?').bind(flowId,workspaceId).first<{slug:string}>()
    if (!form) throw new NotFoundError('This form is not in your workspace.')
    if (form.slug !== expectedSlug) throw new ConflictError('The form address changed. Reload before renaming it.')
    if (form.slug === slug) return {slug}
    if (await this.db.prepare('SELECT slug FROM flows WHERE slug=? UNION ALL SELECT slug FROM form_address_aliases WHERE slug=? LIMIT 1').bind(slug,slug).first()) throw new ConflictError('That form address is current or retired. Choose another address.')
    try {
      const changed = await this.db.prepare('UPDATE flows SET slug=?,updated_at=? WHERE id=? AND workspace_id=? AND slug=? RETURNING slug').bind(slug,new Date().toISOString(),flowId,workspaceId,expectedSlug).first<{slug:string}>()
      if (!changed) throw new ConflictError('The form address changed. Reload before renaming it.')
      return changed
    } catch(error) {
      if (/UNIQUE constraint|address is retired/.test(String(error))) throw new ConflictError('That form address is current or retired. Choose another address.')
      throw error
    }
  }
  async redirect(request: Request) {
    const url=new URL(request.url), match=/^\/(f|embed)\/([^/]+)$/.exec(url.pathname)
    if (!match || !['GET','HEAD'].includes(request.method)) return undefined
    const slug=decodePublicSlug(match[2]); if (!slug) return undefined
    const form=await this.db.prepare("SELECT f.slug FROM form_address_aliases a JOIN flows f ON f.id=a.flow_id WHERE a.slug=? AND f.status IN ('open','closed')").bind(slug).first<{slug:string}>()
    if (!form) return undefined
    url.pathname=`/${match[1]}/${form.slug}`
    return new Response(null,{status:301,headers:{Location:url.href,'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
  }
}
