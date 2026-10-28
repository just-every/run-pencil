import { z } from 'zod'
import { phoneNumber } from './contactPhone'
import { ValidationError } from './errors'

export type PrivacyIdentifier = { kind: 'email' | 'phone'; value: string }
export function privacyIdentifier(input: string): PrivacyIdentifier {
  const value = input.trim().toLowerCase()
  if (z.email().safeParse(value).success) return { kind: 'email', value }
  if (/^\+?[\d\s().-]+$/.test(value)) {
    const canonical = phoneNumber(value.startsWith('+') ? '+' + value.replace(/\D/g, '') : value)
    if (canonical) return { kind: 'phone', value: canonical.slice(1) }
  }
  throw new ValidationError('Enter a complete email address or phone number, including its country code.')
}
export async function privacyEmailHash(email: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`privacy-email.v1:${email.trim().toLowerCase()}`))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

