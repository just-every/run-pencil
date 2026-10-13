import { calendarDate } from '../../shared/questionTypes'
import { csvRows } from './csv'
import type { ColumnMapping, GoogleReview, GoogleSettings } from './model'
type Order = NonNullable<GoogleSettings['dateOrder']>
const parts = (value: string) => /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})(?:[ ,T]+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s+(AM|PM))?$/i.exec(value.trim())
export function googleTime(csv: string, columns: ColumnMapping[], settings: GoogleSettings, review: GoogleReview) {
  const evidence = new Set<Order>()
  for (const row of csvRows(csv)) {
    if (row.row === 1) continue
    for (const column of columns.filter(c => c.target === 'submittedAt' || c.target === 'startedAt')) {
      const p = parts(row.cells[column.column] ?? '')
      if (!p) continue
      if (p[1].length === 4) evidence.add('YMD')
      else { if (+p[1] > 12) evidence.add('DMY'); if (+p[2] > 12) evidence.add('MDY') }
    }
  }
  const order = settings.dateOrder ?? (evidence.size === 1 ? [...evidence][0] : undefined)
  if (order) review.dateOrder = order
  if (settings.timeZone) review.timeZone = settings.timeZone
  let formatter: Intl.DateTimeFormat | undefined
  if (settings.timeZone && /^(?:[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+|UTC)$/.test(settings.timeZone)) {
    try { formatter = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) } catch { /* reported per row */ }
  }
  // Cache only zone offsets by civil day, never raw source timestamps or answers.
  const offsets = new Map<string, number[]>()
  const localParts = (time: number) => Object.fromEntries(formatter!.formatToParts(time).filter(p => p.type !== 'literal').map(p => [p.type, +p.value]))
  const wall = (p: Record<string, number>) => { const d = new Date(0); d.setUTCFullYear(p.year, p.month - 1, p.day); d.setUTCHours(p.hour, p.minute, p.second, 0); return d.getTime() }
  return (value: string, submitted = false): string => {
    if (!formatter) throw new Error('Choose an explicit valid IANA Sheet time zone; no default zone is assumed.')
    if (!order) throw new Error(evidence.size > 1 ? 'Conflicting date-order evidence; select one order and correct inconsistent rows.' : 'Ambiguous date order: choose DMY, MDY or YMD explicitly.')
    const p = parts(value)
    if (!p) throw new Error('Expected a Sheet local date and clock time; unsupported timestamp syntax.')
    const [a,b,c] = p.slice(1,4).map(Number)
    const year = order === 'YMD' ? a : c, month = order === 'MDY' ? a : b, day = order === 'DMY' ? a : order === 'YMD' ? c : b
    const date = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    let hour = +p[4]; const minute = +p[5], second = +(p[6] ?? 0)
    if (p[7]) { if (hour < 1 || hour > 12) throw new Error('Invalid 12-hour clock time.'); hour = hour % 12 + (p[7].toUpperCase() === 'PM' ? 12 : 0) }
    if ((order === 'YMD' ? p[1] : p[3]).length !== 4 || !calendarDate(date) || hour > 23 || minute > 59 || second > 59) throw new Error('Invalid calendar date or clock time for the selected date order.')
    const local = wall({year,month,day,hour,minute,second})
    if (!offsets.has(date)) {
      const values = new Set<number>()
      for (let h = -48; h <= 48; h += 6) { const instant = local + h * 3600000; values.add(wall(localParts(instant)) - instant) }
      offsets.set(date, [...values])
    }
    const matches = offsets.get(date)!.map(offset => local - offset).filter(instant => wall(localParts(instant)) === local)
    if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous local time during a time-zone overlap; correct the source timestamp.' : 'Nonexistent local time during a time-zone transition; correct the source timestamp.')
    const utc = new Date(matches[0]).toISOString()
    if (submitted) { const stamp = { local: `${date} ${String(hour).padStart(2,'0')}:${p[5]}:${String(second).padStart(2,'0')} ${settings.timeZone}`, utc }; if (!review.firstTimestamp || utc < review.firstTimestamp.utc) review.firstTimestamp = stamp; if (!review.lastTimestamp || utc > review.lastTimestamp.utc) review.lastTimestamp = stamp }
    return utc
  }
}
