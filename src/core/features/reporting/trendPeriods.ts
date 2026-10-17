import { calendarDate } from '../../shared/questionTypes'
import { civilOpening } from '../../shared/civilTime'
import { ValidationError } from '../../shared/errors'

export type TrendUnit = 'day' | 'week' | 'month' | 'quarter'
export type TrendPeriod = { label: string; start: string; end: string; startAt: string; endAt: string }
const date = (day: string) => new Date(`${day}T12:00:00Z`)
const dayString = (value: Date) => value.toISOString().slice(0, 10)

function floorPeriod(day: string, unit: TrendUnit): Date {
  const result = date(day)
  if (unit === 'week') result.setUTCDate(result.getUTCDate() - (result.getUTCDay() + 6) % 7)
  if (unit === 'month' || unit === 'quarter') result.setUTCDate(1)
  if (unit === 'quarter') result.setUTCMonth(Math.floor(result.getUTCMonth() / 3) * 3)
  return result
}
function advance(value: Date, unit: TrendUnit): Date {
  const next = new Date(value)
  if (unit === 'day' || unit === 'week') next.setUTCDate(next.getUTCDate() + (unit === 'week' ? 7 : 1))
  else next.setUTCMonth(next.getUTCMonth() + (unit === 'quarter' ? 3 : 1))
  return next
}

/** Calendar arithmetic names periods; civil openings determine their real instants. */
export function trendPeriods(from: string, to: string, unit: TrendUnit, zone: string): TrendPeriod[] {
  if (!calendarDate(from) || !calendarDate(to) || from >= to) throw new ValidationError('Choose valid start and exclusive end dates for trends.')
  if (!['day', 'week', 'month', 'quarter'].includes(unit)) throw new ValidationError('Choose day, week, month or quarter for trends.')
  if (typeof zone !== 'string' || !zone.length) throw new ValidationError('The workspace time zone is invalid.')
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(date(from)) } catch { throw new ValidationError('The workspace time zone is invalid.') }
  const periods: TrendPeriod[] = [], last = date(to), openings = new Map<string, string>()
  const opening = (day: string) => {
    if (!openings.has(day)) openings.set(day, civilOpening(day, '00:00', zone))
    return openings.get(day)!
  }
  let current = floorPeriod(from, unit)
  while (current < last) {
    if (periods.length === 400) throw new ValidationError('Choose a trend range with at most 400 periods.')
    const next = advance(current, unit), anchor = dayString(current)
    const start = anchor < from ? from : anchor, end = next >= last ? to : dayString(next)
    const label = unit === 'day' ? anchor : unit === 'week' ? `Week of ${anchor}` : unit === 'month' ? anchor.slice(0, 7) : `${current.getUTCFullYear()} Q${Math.floor(current.getUTCMonth() / 3) + 1}`
    periods.push({ label, start, end, startAt: opening(start), endAt: opening(end) })
    current = next
  }
  return periods
}
