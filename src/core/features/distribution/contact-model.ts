import { z } from 'zod'
import seed from '../../../../seed.json'
export const contactLimits = seed.limits.contacts
export const fieldsSchema = z.record(z.string().trim().min(1).max(contactLimits.fieldKeyCharacters).refine(k => !['__proto__','constructor','prototype'].includes(k)), z.string().max(contactLimits.fieldValueCharacters)).refine(v => Object.keys(v).length <= contactLimits.customFields, 'Use at most 20 custom fields.')
export const contactSchema = z.object({ name: z.string().trim().min(1).max(200), email: z.email().max(320).transform(v => v.toLowerCase()), fields: fieldsSchema.default({}) })
export type Contact = { id: string; name: string; email: string; fields: Record<string,string>; optedOutAt: string|null }
export type ContactRow = Omit<Contact,'fields'> & { fieldsJson: string }
export const contactColumns = 'id,name,email,fields_json AS fieldsJson,opted_out_at AS optedOutAt'
export const decodeContact = ({fieldsJson,...row}:ContactRow):Contact => ({...row,fields:JSON.parse(fieldsJson)})
