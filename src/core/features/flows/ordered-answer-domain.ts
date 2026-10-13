import { calendarDate } from '../../shared/questionTypes'
function adjacentFloat(value: number, direction: -1 | 1) {
  if (value === 0) return direction * Number.MIN_VALUE
  const buffer = new ArrayBuffer(8), view = new DataView(buffer)
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  view.setBigUint64(0, bits + BigInt((value > 0 ? 1 : -1) * direction))
  return view.getFloat64(0)
}
function decimalNeighbors(value: number, precision: number) {
  const [coefficient, exponent = '0'] = String(value).split('e')
  const fraction = coefficient.split('.')[1]?.length ?? 0
  const digits = BigInt(coefficient.replace('.', ''))
  const scale = precision + Number(exponent) - fraction
  const divisor = scale < 0 ? 10n ** BigInt(-scale) : 1n
  const units = scale < 0 ? digits / divisor : digits * 10n ** BigInt(scale)
  const remainder = scale < 0 ? digits % divisor : 0n
  const floor = units - (remainder < 0n ? 1n : 0n)
  const ceil = units + (remainder > 0n ? 1n : 0n)
  // Decimal string arithmetic avoids overflowing value / quantum and avoids
  // moving a decimal boundary through binary multiplication or toFixed.
  return [floor - 1n, floor, ceil, ceil + 1n].map(candidate => Number(`${candidate}e-${precision}`))
}
export function numericCandidates(boundaries: number[], precision?: number) {
  const values = boundaries.filter(Number.isFinite).flatMap(value => [
    value, adjacentFloat(value, -1), adjacentFloat(value, 1),
    ...(precision === undefined ? [] : decimalNeighbors(value, precision)),
  ])
  // Each ordered predicate changes only at its boundary. Decimal neighbors
  // cover cells where the decimal grid is coarser than the float spacing;
  // adjacent floats cover cells where adding a decimal quantum rounds away.
  // The caller still checks every witness against the answer's exact limits.
  return [...new Set([0, ...values].filter(Number.isFinite))]
}
function neighboringDate(value: string, direction: -1 | 1) {
  let [year, month, day] = value.split('-').map(Number)
  const days = (year: number, month: number) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  day += direction
  if (day === 0) { month--; if (month === 0) { year--; month = 12 }; day = days(year, month) }
  if (day > days(year, month)) { day = 1; month++; if (month === 13) { year++; month = 1 } }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function dateCandidates(boundaries: string[]) {
  return boundaries.filter(calendarDate).flatMap(value => [neighboringDate(value, -1), value, neighboringDate(value, 1)]).filter(calendarDate)
}
