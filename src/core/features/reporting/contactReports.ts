import { isCanonicalContactAnswer } from '../../shared/contactAnswers'

export const contactTypes = ['phone', 'postal_address', 'full_name', 'url', 'currency'] as const
export type ContactType = typeof contactTypes[number]
export function isContactType(type: string | null): type is ContactType {
  return contactTypes.some(candidate => candidate === type)
}
export function retainedContactAnswer(type: ContactType, value: unknown) {
  if (!isCanonicalContactAnswer(type, value)) {
    throw new Error('Invalid retained contact answer. It cannot be reported faithfully.')
  }
}

