/** Dates are calendar values, never instants. */
export function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}
export function decimalPlaces(value: number) {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e')
  return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent))
}
export function typeSettingsValid(type: string | null, settings: Record<string, unknown>) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000
  if (type === 'nps') return ['lowLabel', 'highLabel'].every(key => settings[key] === undefined || text(settings[key]))
  if (type === 'number') return ['min', 'max'].every(key => settings[key] === undefined || (typeof settings[key] === 'number' && Number.isFinite(settings[key]))) && (settings.min === undefined || settings.max === undefined || (settings.min as number) <= (settings.max as number)) && (settings.decimalPlaces === undefined || (Number.isInteger(settings.decimalPlaces) && (settings.decimalPlaces as number) >= 0 && (settings.decimalPlaces as number) <= 15))
  if (type === 'date') return ['earliest', 'latest'].every(key => settings[key] === undefined || calendarDate(settings[key])) && (settings.earliest === undefined || settings.latest === undefined || (settings.earliest as string) <= (settings.latest as string))
  if (type === 'consent') return text(settings.statement)
  return true
}
