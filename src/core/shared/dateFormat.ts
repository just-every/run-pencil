export const dateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const
export type DateDisplayFormat = typeof dateFormats[number]
export function dateFormat(settings: Record<string, unknown> = {}) {
  const format = (settings.displayFormat ?? 'MM/DD/YYYY') as DateDisplayFormat
  const separator = String(settings.separator ?? '/')
  const order = format === 'DD/MM/YYYY' ? ['day', 'month', 'year'] : format === 'YYYY-MM-DD' ? ['year', 'month', 'day'] : ['month', 'day', 'year']
  return { order, separator, label: order.map(part => part === 'year' ? 'YYYY' : part === 'month' ? 'MM' : 'DD').join(separator) }
}
export function dateDisplaySettingsValid(settings: Record<string, unknown>) {
  return (settings.displayFormat === undefined || dateFormats.includes(settings.displayFormat as DateDisplayFormat)) && (settings.separator === undefined || ['/', '-', '.'].includes(String(settings.separator)))
}
export function displayCalendarDate(value: string, settings: Record<string, unknown> = {}) {
  const [year, month, day] = value.split('-')
  const parts: Record<string, string> = { year, month, day }
  const format = dateFormat(settings)
  return format.order.map(part => parts[part]).join(format.separator)
}
