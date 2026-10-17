import { contactSchemas, contactText, invalidContactText, objectIssues, type ContactFieldIssues, type PhoneAnswer } from './contactSchemas'

/** US punctuation is accepted; international numbers must be explicit E.164. */
export function phoneNumber(value: string): string | undefined {
  const text = contactText(value)
  if (/^\+[2-9]\d{7,14}$/.test(text)) return text
  if (!/^(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[ .-]?[2-9]\d{2}[ .-]?\d{4}$/.test(text)) return undefined
  const digits = text.replace(/\D/g, '')
  return `+1${digits.length === 11 ? digits.slice(1) : digits}`
}

export function phoneIssues(value: unknown): ContactFieldIssues {
  const issues = objectIssues(contactSchemas.phone, value)
  if (Object.keys(issues).length) return issues
  const answer = value as PhoneAnswer
  if (invalidContactText(answer.number) || !phoneNumber(answer.number)) issues.number = 'Enter a valid US phone number, or an international number beginning with + and its country code.'
  if (answer.extension !== undefined && (invalidContactText(answer.extension) || answer.extension.trim() && !/^\d{1,10}$/.test(answer.extension.trim()))) issues.extension = 'Enter an extension using up to 10 digits.'
  return issues
}

export function normalizePhone(value: PhoneAnswer): PhoneAnswer {
  const extension = value.extension?.trim()
  return { number: phoneNumber(value.number)!, ...(extension ? { extension } : {}) }
}

export function displayPhone(value: PhoneAnswer): string {
  const match = /^\+1([2-9]\d{2})([2-9]\d{2})(\d{4})$/.exec(value.number)
  return `${match ? `(${match[1]}) ${match[2]}-${match[3]}` : value.number}${value.extension ? ` ext. ${value.extension}` : ''}`
}
