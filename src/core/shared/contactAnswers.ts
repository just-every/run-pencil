import { addressIssues, nameIssues, normalizeAddress, normalizeName } from './contactAddress'
import { currencyIssues, displayCurrency, normalizeCurrency } from './contactCurrency'
import { displayPhone, normalizePhone, phoneIssues } from './contactPhone'
import { contactText, invalidContactText, type AddressAnswer, type ContactFieldIssues, type CurrencyAnswer, type NameAnswer, type PhoneAnswer } from './contactSchemas'
export { contactAnswerObject } from './contactSchemas'

export const contactQuestionTypes = ['phone', 'postal_address', 'full_name', 'url', 'currency'] as const
export type ContactQuestionType = typeof contactQuestionTypes[number]

export function contactFieldIssues(type: string, value: unknown): ContactFieldIssues {
  if (type === 'phone') return phoneIssues(value)
  if (type === 'postal_address') return addressIssues(value)
  if (type === 'full_name') return nameIssues(value)
  if (type === 'currency') return currencyIssues(value)
  if (type === 'url') {
    const message = 'Enter an absolute HTTP or HTTPS website URL, such as https://example.com.'
    if (typeof value !== 'string' || value.length > 2048 || invalidContactText(value) || !/^https?:\/\//i.test(value.trim()) || /\s/.test(value.trim())) return { url: message }
    try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) && url.hostname ? {} : { url: message } } catch { return { url: message } }
  }
  return { _form: 'This question has no valid contact answer type.' }
}

export function contactAnswerIssue(type: string, value: unknown): string | undefined {
  return Object.values(contactFieldIssues(type, value))[0]
}

export function normalizeContactAnswer(type: string, value: unknown): unknown {
  const issue = contactAnswerIssue(type, value)
  if (issue) throw new Error(issue)
  if (type === 'phone') return normalizePhone(value as PhoneAnswer)
  if (type === 'postal_address') return normalizeAddress(value as AddressAnswer)
  if (type === 'full_name') return normalizeName(value as NameAnswer)
  if (type === 'currency') return normalizeCurrency(value as string | CurrencyAnswer)
  return new URL(contactText(value as string)).href
}

/** Retained answers must already be canonical; raw input belongs at admission. */
export function isCanonicalContactAnswer(type: string, value: unknown): boolean {
  if (contactAnswerIssue(type, value)) return false
  const normalized = normalizeContactAnswer(type, value)
  if (typeof normalized === 'string') return normalized === value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const canonical = normalized as Record<string, unknown>, actual = value as Record<string, unknown>
  return Object.keys(canonical).length === Object.keys(actual).length && Object.entries(canonical).every(([key, item]) => actual[key] === item)
}

export function displayContactAnswer(type: string, value: unknown): string {
  const normalized = normalizeContactAnswer(type, value)
  if (type === 'phone') return displayPhone(normalized as PhoneAnswer)
  if (type === 'currency') return displayCurrency(normalized as CurrencyAnswer)
  if (type === 'full_name') {
    const name = normalized as NameAnswer
    return [name.given, name.middle, name.family, name.suffix].filter(Boolean).join(' ')
  }
  if (type === 'postal_address') {
    const address = normalized as AddressAnswer
    return [address.street, address.unit, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country].filter(Boolean).join('\n')
  }
  return normalized as string
}

const exportKeys: Record<ContactQuestionType, readonly string[]> = {
  phone: ['phone.number', 'phone.extension'],
  postal_address: ['address.street', 'address.unit', 'address.city', 'address.state', 'address.postalCode', 'address.country'],
  full_name: ['name.given', 'name.middle', 'name.family', 'name.suffix'],
  url: ['url'], currency: ['currency.currency', 'currency.minorUnits'],
}

/** Undefined asks only for the fixed CSV inventory, including optional parts. */
export function contactExportFields(type: string, value: unknown): Record<string, string | number> {
  const keys = exportKeys[type as ContactQuestionType]
  if (!keys) throw new Error('Unsupported contact export type.')
  if (value === undefined) return Object.fromEntries([...keys, 'formatted'].map(key => [key, '']))
  const normalized = normalizeContactAnswer(type, value)
  const fields: Record<string, string | number> = {}
  for (const key of keys) fields[key] = type === 'url' ? normalized as string : (normalized as Record<string, string | number>)[key.slice(key.indexOf('.') + 1)] ?? ''
  fields.formatted = displayContactAnswer(type, normalized)
  return fields
}
