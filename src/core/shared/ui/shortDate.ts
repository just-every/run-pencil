/** The one short date style on every screen: "Oct 29, 2026, 3:00 PM" for a moment, "Oct 29, 2026" for a day. */
export function shortDateTime(value: string | number | Date, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value))
}
export function shortDate(value: string | number | Date, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone }).format(new Date(value))
}
/** A stored calendar day ("2026-10-29") has no zone of its own; it reads the same everywhere. */
export function shortDay(day: string) {
  return shortDate(`${day}T12:00:00Z`, 'UTC')
}
/** A trend period's label ("2026-10-26", "Week of 2026-10-26", "2026-10") in the same style. */
export function shortPeriod(label: string) {
  return label
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, day => shortDay(day))
    .replace(/^(\d{4})-(\d{2})$/, (_, year, month) => new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1))))
}
