import { contactSchemas, objectIssues, type ContactFieldIssues, type CurrencyAnswer } from './contactSchemas'

/** Parse decimal digits into cents directly: no floating-point rounding. */
export function dollarCents(value: string): number | undefined {
  if (value.length > 40) return undefined
  const match = /^(-)?\$?((?:\d+|\d{1,3}(?:,\d{3})+)?)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match || !match[2] && !match[3]) return undefined
  const cents = BigInt(match[2].replaceAll(',', '') || '0') * 100n + BigInt((match[3] ?? '').padEnd(2, '0') || '0')
  const signed = match[1] ? -cents : cents
  return signed <= BigInt(Number.MAX_SAFE_INTEGER) && signed >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(signed) : undefined
}

export function currencyIssues(value: unknown): ContactFieldIssues {
  if (typeof value === 'string') return dollarCents(value) === undefined ? { minorUnits: 'Enter a USD amount with no more than two decimal places, such as 123.45.' } : {}
  const issues = objectIssues(contactSchemas.currency, value)
  if (Object.keys(issues).length) return { minorUnits: 'Enter a USD amount within the supported range, with no more than two decimal places.' }
  return {}
}

export function normalizeCurrency(value: string | CurrencyAnswer): CurrencyAnswer {
  return { currency: 'USD', minorUnits: typeof value === 'string' ? dollarCents(value)! : value.minorUnits === 0 ? 0 : value.minorUnits }
}

export function currencyDecimal(value: CurrencyAnswer): string {
  const units = BigInt(value.minorUnits), absolute = units < 0n ? -units : units
  return `${units < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

export function displayCurrency(value: CurrencyAnswer): string {
  const decimal = currencyDecimal(value), negative = decimal.startsWith('-'), [whole, fraction] = decimal.replace(/^-/, '').split('.')
  return `${negative ? '-' : ''}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
}
