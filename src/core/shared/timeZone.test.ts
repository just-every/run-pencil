import { expect } from 'vitest'
import { contract } from '../../test/contract'
import { timeZoneName, zonedInstant } from './timeZone'

contract(['WS-001','FLOW-010'], 'deadlines preserve seasonal and historical instants, reject gaps and ambiguity, and label valid zones in words', () => {
  for (const zone of ['Australia/Brisbane', 'America/New_York', 'UTC', 'Australia/Lord_Howe']) {
    const label = timeZoneName(zone, '2036-01-15T12:00')
    expect(label).toMatch(/[A-Za-z]+\s+[A-Za-z]+/)
    expect(label).not.toMatch(/^[+-]?\d|^GMT[+-]/)
    expect(timeZoneName(zone)).not.toMatch(/[/_]/)
  }
  expect(() => timeZoneName('Invalid/Zone')).toThrow(RangeError)
  expect(zonedInstant('2026-01-15T12:00', 'America/New_York')).toBe('2026-01-15T17:00:00.000Z')
  expect(zonedInstant('2026-07-15T12:00', 'America/New_York')).toBe('2026-07-15T16:00:00.000Z')
  expect(() => zonedInstant('2026-03-08T02:30', 'America/New_York')).toThrow('does not exist')
  expect(() => zonedInstant('2026-11-01T01:30', 'America/New_York')).toThrow('twice')
  const zone = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Kiev' }).resolvedOptions().timeZone
  expect(timeZoneName(zone, '1970-01-15T12:00')).not.toBe(timeZoneName(zone, '2036-01-15T12:00'))
  expect(() => timeZoneName('America/New_York', '2026-03-08T02:30')).toThrow('does not exist')
  expect(() => timeZoneName('America/New_York', '2026-11-01T01:30')).toThrow('twice')
  expect(zonedInstant('2036-01-15T12:00', zone)).toBe('2036-01-15T10:00:00.000Z')
  expect(zonedInstant('1970-01-15T12:00', zone)).toBe('1970-01-15T09:00:00.000Z')
  expect(zonedInstant('2026-01-15T12:00', 'UTC')).toBe('2026-01-15T12:00:00.000Z')
  expect(() => timeZoneName('UTC', '2026-02-30T12:00')).toThrow()
})
