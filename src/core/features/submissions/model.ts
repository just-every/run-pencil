import { z } from 'zod'
import { resourceId } from '../../shared/validation'

export const submissionLimits = { pageSize: 50, tagsPerResponse: 20, notesPerResponse: 200, noteLength: 2000, statusesPerForm: 50 } as const
export const builtinStatuses = [
  { id: 'new', name: 'New', custom: false },
  { id: 'in-review', name: 'In review', custom: false },
  { id: 'approved', name: 'Approved', custom: false },
  { id: 'rejected', name: 'Rejected', custom: false },
  { id: 'done', name: 'Done', custom: false },
] as const
export type SubmissionStatus = { id: string; name: string; custom: boolean }
export type SubmissionOperator = { id: string; displayName: string }
export type SubmissionMetadata = { responseId: string; version: number; statusId: string; assignee: SubmissionOperator | null; tags: string[]; noteCount: number; updatedAt: string | null }
export type SubmissionNote = { id: string; text: string; author: SubmissionOperator | null; createdAt: string }
export type SubmissionOptions = { statuses: SubmissionStatus[]; operators: SubmissionOperator[]; limits: typeof submissionLimits }
export type SubmissionRead = { submissions: SubmissionMetadata[] }
export type SubmissionDetail = { submission: SubmissionMetadata; notes: SubmissionNote[]; notesOffset: number; nextNotesOffset?: number }
const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
export const workflowTag = text(40).refine(value => !/[\r\n\t]/.test(value))
export const submissionReadSchema = z.object({ responseIds: z.array(resourceId).min(1).max(50).refine(ids => new Set(ids).size === ids.length) }).strict()
export const submissionStatusSchema = z.object({ name: text(60).refine(name => !/[\r\n\t]/.test(name) && !builtinStatuses.some(status => status.name.toLowerCase() === name.toLowerCase())) }).strict()
export const submissionBulkSchema = z.object({
  responses: z.array(z.object({ id: resourceId, version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict()).min(1).max(50).refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
  changes: z.object({ statusId: resourceId.optional(), assigneeId: resourceId.nullable().optional(), addTags: z.array(workflowTag).max(20).optional(), removeTags: z.array(workflowTag).max(20).optional(), note: text(2000).optional() }).strict()
    .refine(value => Object.keys(value).length > 0 && !(value.addTags ?? []).some(tag => value.removeTags?.includes(tag))),
}).strict()
export type SubmissionBulkInput = z.infer<typeof submissionBulkSchema>
