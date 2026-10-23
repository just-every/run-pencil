export const challengePattern = /^[a-f0-9]{32}$/
export const checkoutOrigin = 'https://checkout.stripe.com'
export type CheckoutHandoff = { url: string; sessionId: string }
export type EmbedEvent = { type: 'pencil:loaded' | 'pencil:completed'; challenge: string } | { type: 'pencil:height'; challenge: string; height: number } | ({ type: 'pencil:checkout'; challenge: string } & CheckoutHandoff)

export function validCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.origin === checkoutOrigin && !url.username && !url.password
  } catch { return false }
}
const validSession = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(value)
/** Validate before projecting: an unexpected payer or response field is refused, never forwarded. */
export function checkoutHandoff(payment: unknown): CheckoutHandoff | undefined {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return
  const value = payment as Record<string, unknown>
  if (Object.keys(value).length !== 3 || !['pending','paid','failed','expired','cancelled','refunded'].includes(String(value.state)) || !validCheckoutUrl(value.checkoutUrl) || !validSession(value.checkoutSessionId)) return
  return {url:value.checkoutUrl,sessionId:value.checkoutSessionId}
}
export function isEmbedEvent(data: unknown, challenge: string): data is EmbedEvent {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const value = data as Record<string, unknown>
  if (!challengePattern.test(challenge) || value.challenge !== challenge) return false
  if (value.type === 'pencil:height') return Object.keys(value).length === 3 && Number.isInteger(value.height) && Number(value.height) > 0 && Number(value.height) <= 100000
  if (value.type === 'pencil:checkout') return Object.keys(value).length === 4 && validCheckoutUrl(value.url) && validSession(value.sessionId)
  return (value.type === 'pencil:loaded' || value.type === 'pencil:completed') && Object.keys(value).length === 2
}
export function isEmbedAcknowledgement(data: unknown, challenge: string) {
  return isEmbedEvent(data,challenge) && data.type === 'pencil:loaded'
}
