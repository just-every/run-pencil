import { z } from 'zod'

const capability = z.string().regex(/^[a-f0-9]{64}$/)
export function invalidCapabilityPath(path: string): boolean {
  const prefix = ['/i/', '/optout/'].find(value => path.startsWith(value))
  if (!prefix) return false
  try { return !capability.safeParse(decodeURIComponent(path.slice(prefix.length))).success }
  catch { return true }
}
