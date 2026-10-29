import { z } from 'zod'
import { ValidationError } from '../../shared/errors'

/** Shared native settings admission, used by both HTTP and delegated calls. */
export const workspaceSettingsSchema = z.object({
  reminderDelayHours: z.number().min(0).max(8760).optional(),
  embedAllowedOrigins: z.array(z.string().trim().max(300)).max(30).optional(),
  timeZone: z.string().trim().min(1).max(100),
  sendingWindowStart: z.string().regex(/^\d{2}:\d{2}$/),
  sendingWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
})

/** The exact native embed admission, shared by persistence and risk classification. */
export function normalizeEmbedOrigins(values: string[]) {
  return [...new Set(values.map(value => {
    value = value.trim()
    let origin: URL
    try { origin = new URL(value) } catch { throw new ValidationError('Embed hosts must be complete HTTPS origins.') }
    if (origin.hostname.includes('*') || origin.origin !== value || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) throw new ValidationError('Embed hosts must use HTTPS with no path, query or fragment. HTTP is allowed only for loopback review.')
    return origin.origin
  }))]
}
