import type { LinkPreviewAssets } from './assets'
import { decodeLogo } from '../brand'
import { formSettings } from '../../shared/hiddenFields'
import { previewText, readPublishedPreview, resolveLinkPreview, type PublishedLinkPreview } from '../../shared/linkPreview'
import { NotFoundError } from '../../shared/errors'

export type DocumentPreview = {
  title: string; description: string; imageUrl: string; imageAlt: string; canonicalUrl: string; indexable: boolean
}
type Revision = { id: string; title: string; slug: string; status: string; policy: string | null; legacy: string | null; settings: string | null }

/** Reads only deliberately public revision metadata, never response/session/invitation data. */
export class LinkPreviews {
  constructor(private readonly db: D1Database, private readonly origin: string, private readonly assets: LinkPreviewAssets) {}
  private async revision(value: string, byId = false) {
    return this.db.prepare(`SELECT r.id,r.title,f.slug,f.status,r.policy_snapshot_json AS policy,p.preview_json AS legacy,r.form_settings_json AS settings
      FROM flow_revisions r JOIN flows f ON f.id=r.flow_id
      LEFT JOIN revision_link_previews p ON p.revision_id=r.id
      WHERE ${byId ? 'r.id=?' : 'f.slug=? AND r.is_current=1'} AND r.state='published' AND f.status IN ('open','closed') LIMIT 1`).bind(value).first<Revision>()
  }
  private async metadata(row: Revision): Promise<PublishedLinkPreview> {
    const snapshot = readPublishedPreview(row.policy, row.legacy)
    if (snapshot) return snapshot
    // Revisions without either snapshot use only their own saved title and welcome.
    const steps = await this.db.prepare("SELECT kind,prompt,helper_text AS helperText FROM flow_steps WHERE revision_id=? AND kind='welcome' ORDER BY position LIMIT 1").bind(row.id).all<{ kind: string; prompt: string; helperText: string | null }>()
    return resolveLinkPreview(formSettings(row.settings), row.title, steps.results)
  }
  async document(slug: string, path: string, search: string): Promise<DocumentPreview | undefined> {
    const row = await this.revision(slug)
    if (!row) return undefined
    const data = await this.metadata(row), settings = formSettings(row.settings)
    const canonicalPath = `/f/${encodeURIComponent(row.slug)}`
    return {
      title: previewText(data.title), description: previewText(data.description),
      imageUrl: new URL(`/api/public/previews/${encodeURIComponent(row.id)}/image`, this.origin).href,
      imageAlt: previewText(data.image?.alt ?? data.title), canonicalUrl: new URL(canonicalPath, this.origin).href,
      indexable: data.allowIndexing && !settings.access && settings.identityMode === 'anonymous' && row.status === 'open' && path === canonicalPath && search === '',
    }
  }
  async image(revisionId: string): Promise<Response> {
    const row = await this.revision(revisionId, true)
    if (!row) throw new NotFoundError('This published preview is not available.')
    const data = await this.metadata(row)
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; sandbox" }
    if (data.image && 'key' in data.image) return this.assets.read(data.image.key)
    if (data.image) return new Response(decodeLogo(data.image.base64), { headers: { ...headers, 'Content-Type': data.image.mime } })
    // A workspace without a business logo has a neutral, installation-owned preview image.
    const escaped = previewText(data.title).replace(/[<>&"']/g, char => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' })[char]!)
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#fbfaf6"/><text x="80" y="320" fill="#1e2124" font-family="sans-serif" font-size="48">${escaped}</text></svg>`, { headers: { ...headers, 'Content-Type': 'image/svg+xml' } })
  }
}
