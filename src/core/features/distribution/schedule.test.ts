import { expect, test } from 'vitest'
import { insideSendingWindow, nextSendingInstant, retryInstant } from './schedule'
test('sending window holds due mail through midnight, DST gap and repeated hour, with exclusive closing', () => {
  const ny = { timeZone: 'America/New_York', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' }
  expect(nextSendingInstant('2026-03-07T22:00:00.000Z', ny)).toBe('2026-03-08T13:00:00.000Z')
  expect(nextSendingInstant('2026-10-31T21:00:00.000Z', ny)).toBe('2026-11-01T14:00:00.000Z')
  expect(insideSendingWindow(new Date('2026-03-08T13:00:00Z'), ny)).toBe(true)
  expect(insideSendingWindow(new Date('2026-03-08T21:00:00Z'), ny)).toBe(false)
  expect(nextSendingInstant('2026-03-08T15:12:13.456Z', ny)).toBe('2026-03-08T15:12:13.456Z')
})
test('retry plan has five bounded retries without changing the delivery key', () => {
  const start = '2026-10-06T00:00:00.000Z'
  expect([1,2,3,4,5,6].map(n => retryInstant(start, n))).toEqual(['2026-10-06T00:01:00.000Z','2026-10-06T00:05:00.000Z','2026-10-06T00:15:00.000Z','2026-10-06T00:30:00.000Z','2026-10-06T01:00:00.000Z', null])
})
