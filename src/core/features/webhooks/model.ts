import { z } from 'zod'
import { resourceId } from '../../shared/validation'
import type { DeliveryStatus, EndpointState, EventType } from './events'
export * from './events'

export const createEndpointSchema = z.object({ url: z.string().trim().url().max(2000), flowId: resourceId.optional() }).strict()
export type EndpointSummary = {
  id: string; url: string; flowId: string | null; flowTitle: string | null; state: EndpointState; disabledReason: string | null; disabledAt: string | null
  failureStreak: number; secretSet: boolean; secretVersion: number; createdAt: string; pending: number; failed: number; lastConfirmedAt: string | null
}
export type AttemptSummary = { ordinal: number; event: string; httpStatus: number | null; outcomeClass: string | null; reason: string | null; createdAt: string }
export type DeliverySummary = {
  id: string; endpointId: string; eventId: string; eventType: EventType; formId: string | null; revisionId: string | null; responseId: string | null
  occurredAt: string; status: DeliveryStatus; attempts: number; reason: string | null; availableAt: string; updatedAt: string; attemptLog: AttemptSummary[]
}
