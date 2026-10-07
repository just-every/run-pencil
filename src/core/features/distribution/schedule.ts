export type SendingWindow = { timeZone: string; sendingWindowStart: string; sendingWindowEnd: string }
/** Calendar evaluation uses IANA civil time, including DST gaps and folds. */
export function insideSendingWindow(instant: Date, settings: SendingWindow) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant)
  const time = `${parts.find(p => p.type === 'hour')!.value}:${parts.find(p => p.type === 'minute')!.value}`
  return time >= settings.sendingWindowStart && time < settings.sendingWindowEnd
}
export function nextSendingInstant(due: string, settings: SendingWindow): string {
  const start = new Date(due)
  if (insideSendingWindow(start, settings)) return start.toISOString()
  // UTC-minute traversal covers even a civil day skipped by a time-zone change.
  let at = Math.ceil(start.getTime() / 60_000) * 60_000
  for (let minutes = 0; minutes < 3 * 24 * 60; minutes++, at += 60_000) {
    const candidate = new Date(at)
    if (insideSendingWindow(candidate, settings)) return candidate.toISOString()
  }
  throw new Error('No opening exists in the configured sending window.')
}
export function retryInstant(firstAttempt: string, failedAttempt: number) {
  // Initial call plus at most five retries, all within one hour.
  const offsets = [1, 5, 15, 30, 60]
  return failedAttempt <= offsets.length ? new Date(Date.parse(firstAttempt) + offsets[failedAttempt - 1] * 60_000).toISOString() : null
}
