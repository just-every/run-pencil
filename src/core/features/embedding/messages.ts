export const challengePattern = /^[a-f0-9]{32}$/
export type EmbedEvent = { type: 'pencil:loaded' | 'pencil:completed'; challenge: string } | { type: 'pencil:height'; challenge: string; height: number }
export function isEmbedEvent(data: unknown, challenge: string): data is EmbedEvent {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const value = data as Record<string, unknown>
  if (!challengePattern.test(challenge) || value.challenge !== challenge) return false
  if (value.type === 'pencil:height') return Object.keys(value).length === 3 && Number.isInteger(value.height) && Number(value.height) > 0 && Number(value.height) <= 100000
  return (value.type === 'pencil:loaded' || value.type === 'pencil:completed') && Object.keys(value).length === 2
}
export function isEmbedInit(data: unknown, challenge: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const value = data as Record<string, unknown>
  return challengePattern.test(challenge) && Object.keys(value).length === 2 && value.type === 'pencil:init' && value.challenge === challenge
}
