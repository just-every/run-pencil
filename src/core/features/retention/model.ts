export const dayMilliseconds = 86_400_000
export const noticeMilliseconds = 7 * dayMilliseconds
export type RetentionPolicy = { flowId:string; days:number|null; legalHold:boolean; version:number }
export type RetentionState = RetentionPolicy & {
  timeZone:string
  notices:{responses:number;saves:number;earliestDeletion:string|null}
}
export type PolicyRow = {flow_id:string;days:number|null;legal_hold:number;version:number;created_at:string;updated_at:string}
export type RetainedItem = {flow_id:string;kind:'response'|'save';item_id:string;expires_at:string;version:number}
