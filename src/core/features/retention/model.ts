import { z } from 'zod'

/** Native acknowledgement expresses requested automation, never proof of a person’s act. */
export const retentionSettingsSchema = z.object({
  days: z.number().int().min(1).max(36500).nullable(), legalHold: z.boolean(),
  version: z.number().int().nonnegative(), confirmAutomaticDeletion: z.boolean(),
}).strict()
export type RetentionSettings = z.infer<typeof retentionSettingsSchema>

export const dayMilliseconds = 86_400_000
export const noticeMilliseconds = 7 * dayMilliseconds
export type RetentionPolicy = { flowId:string; days:number|null; legalHold:boolean; version:number }
export type RetentionState = RetentionPolicy & {
  timeZone:string
  notices:{responses:number;saves:number;earliestDeletion:string|null}
}
export type PolicyRow = {flow_id:string;days:number|null;legal_hold:number;version:number;created_at:string;updated_at:string}
export type RetainedItem = {flow_id:string;kind:'response'|'save';item_id:string;expires_at:string;version:number}
