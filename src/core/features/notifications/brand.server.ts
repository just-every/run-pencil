import { neutralBrand } from '../brand'
import { decodeLogo, encodeLogo, logoByteLimit, validateLogo } from '../brand'

export type NotificationLogo = { content: Uint8Array; contentType: string }
export type NotificationBrand = { businessName: string; supportingLine: string; accentColor: string; logo?: NotificationLogo }
type StoredBrand = { name: string; configured: number; supportingLine: string; accent: string; logoBase64: string | null; logoMime: string | null; logoVersion: string | null }

/** Read a bounded snapshot only on dispatch, never on response collection. */
export async function readNotificationBrand(db: D1Database, workspaceId: string): Promise<NotificationBrand> {
  const row = await db.prepare(`SELECT name,brand_configured AS configured,brand_supporting_line AS supportingLine,
    brand_accent AS accent,brand_logo_base64 AS logoBase64,brand_logo_mime AS logoMime,brand_logo_version AS logoVersion
    FROM workspaces WHERE id=?`).bind(workspaceId).first<StoredBrand>()
  if (!row) throw new Error('The notification workspace no longer exists.')
  const businessName = row.configured ? row.name : neutralBrand.name
  if (!businessName || businessName.length > 100 || row.supportingLine.length > 240 || !/^#[a-f\d]{6}$/i.test(row.accent)) throw new Error('Invalid saved notification brand.')
  const brand: NotificationBrand = { businessName, supportingLine: row.supportingLine, accentColor: row.accent }
  if (row.logoBase64 === null && row.logoMime === null && row.logoVersion === null) return brand
  if (!row.logoBase64 || !row.logoMime || !row.logoVersion || row.logoVersion.length > 128) throw new Error('Incomplete saved notification logo.')
  // Refuse oversized or noncanonical encodings before allocating decoded bytes.
  if (row.logoBase64.length > 4 * Math.ceil(logoByteLimit / 3) || row.logoBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.logoBase64)) throw new Error('Invalid saved notification logo encoding.')
  const content = decodeLogo(row.logoBase64)
  if (encodeLogo(content) !== row.logoBase64) throw new Error('Invalid saved notification logo encoding.')
  validateLogo(content, row.logoMime)
  return { ...brand, logo: { content, contentType: row.logoMime } }
}
