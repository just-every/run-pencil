import { z } from 'zod'

export const collectorChannels = ['web', 'embed', 'email', 'sms', 'qr', 'social', 'partner'] as const
export const collectorSources = ['direct', 'embed', 'invitation', 'imported', 'unknown'] as const
export type CollectorChannel = typeof collectorChannels[number]
export type CollectorSource = typeof collectorSources[number]
export const collectorKey = z.string().regex(/^[a-f0-9]{32}$/)
export const collectorId = z.string().min(1).max(256).refine(value => !/[\u0000-\u001f\u007f]/.test(value))
export const collectorLimits = { perFlow: 200 } as const
export const collectorInput = z.object({
  name: z.string().trim().min(1).max(120).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  channel: z.enum(collectorChannels),
  closeAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/).nullable().optional(),
  deadlineAt: z.string().datetime().nullable().optional(),
  responseLimit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
}).strict().refine(value => value.closeAt === undefined || value.deadlineAt === undefined, 'Choose a local close date or an absolute deadline.')
export type CollectorInput = z.infer<typeof collectorInput>
export type CollectorRow = {
  id: string; flowId: string; name: string; channel: CollectorChannel | 'imported' | 'unknown';
  publicKey: string; systemSource: CollectorSource | null;
  deadlineAt: string | null; deadlineTimeZone: string | null; responseLimit: number | null;
  closedAt: string | null; createdAt: string; updatedAt: string; retained: number; released: number;
}
export type CollectorSettings = { name: string; channel: CollectorChannel; deadlineAt: string | null; deadlineTimeZone: string | null; responseLimit: number | null }
export function systemCollectorId(flowId: string, source: CollectorSource) { return `system:${source}:${flowId}` }
export function collectorState(row: CollectorRow, now: string) {
  const state = row.closedAt ? 'closed' : row.deadlineAt && row.deadlineAt <= now ? 'expired'
    : row.responseLimit !== null && row.retained >= row.responseLimit ? 'full' : 'open'
  return { ...row, state, remaining: row.responseLimit === null ? null : Math.max(0, row.responseLimit - row.retained) }
}

