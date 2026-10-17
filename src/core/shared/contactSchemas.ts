import { z } from 'zod'

export const contactSchemas = {
  phone: z.object({ number: z.string().max(80), extension: z.string().max(10).optional() }).strict(),
  postal_address: z.object({ street: z.string().max(200), unit: z.string().max(100).optional(), city: z.string().max(100), state: z.string().max(100), postalCode: z.string().max(20), country: z.string().max(2) }).strict(),
  full_name: z.object({ given: z.string().max(100), middle: z.string().max(100).optional(), family: z.string().max(100), suffix: z.string().max(30).optional() }).strict(),
  currency: z.object({ currency: z.literal('USD'), minorUnits: z.number().int().refine(Number.isSafeInteger) }).strict(),
}

/** Bounded transport shapes; semantic validation remains question-specific. */
export const contactAnswerObject = z.union([contactSchemas.phone, contactSchemas.postal_address, contactSchemas.full_name, contactSchemas.currency])
export type PhoneAnswer = z.infer<typeof contactSchemas.phone>
export type AddressAnswer = z.infer<typeof contactSchemas.postal_address>
export type NameAnswer = z.infer<typeof contactSchemas.full_name>
export type CurrencyAnswer = z.infer<typeof contactSchemas.currency>
export type ContactFieldIssues = Record<string, string>
export const contactText = (value: string) => value.trim().normalize('NFC')
export const invalidContactText = (value: string) => /[\u0000-\u001f\u007f]/.test(value)

export function objectIssues(schema: z.ZodType, value: unknown): ContactFieldIssues {
  const result = schema.safeParse(value)
  if (result.success) return {}
  const issues: ContactFieldIssues = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '_form')
    issues[field] ??= field === '_form' ? 'Use only the fields defined for this question.' : `Enter a valid ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} within its length limit.`
  }
  return issues
}
