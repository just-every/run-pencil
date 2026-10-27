import { z } from 'zod'
import { canonicalTimeZone } from '../../shared/ianaTimeZone'
export const contactTimeZoneMessage = 'The contact time zone is invalid.'
const contactTimeZone = z.string().trim().min(1).max(100).refine(value => !!canonicalTimeZone(value), contactTimeZoneMessage).transform(value => canonicalTimeZone(value)!)
import seed from '../../../../seed.json'
export const contactLimits = seed.limits.contacts
export const fieldsSchema = z.record(z.string().trim().min(1).max(contactLimits.fieldKeyCharacters).refine(k => !['__proto__','constructor','prototype'].includes(k)), z.string().max(contactLimits.fieldValueCharacters)).refine(v => Object.keys(v).length <= contactLimits.customFields, 'Use at most 20 custom fields.')
export const contactSchema = z.object({ name: z.string().trim().min(1).max(200), email: z.email().max(320).transform(v => v.toLowerCase()), fields: fieldsSchema.default({}), timeZone: contactTimeZone.nullable().optional(), mobile:z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable().optional(),smsConsent:z.object({given:z.boolean(),wording:z.string().trim().min(1).max(500)}).optional() })
export type Contact = { id: string; name: string; email: string; fields: Record<string,string>; optedOutAt: string|null; timeZone: string|null; mobile:string|null; smsConsentAt:string|null; smsStoppedAt:string|null }
export type ContactRow = Omit<Contact,'fields'> & { fieldsJson: string }
export const contactColumns = 'id,name,email,fields_json AS fieldsJson,opted_out_at AS optedOutAt,time_zone AS timeZone,mobile,sms_consent_at AS smsConsentAt,sms_stopped_at AS smsStoppedAt'
export const decodeContact = ({fieldsJson,...row}:ContactRow):Contact => ({...row,fields:JSON.parse(fieldsJson)})
