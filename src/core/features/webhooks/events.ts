// Constants shared by the Worker and the operator screens: nothing here may import server-only code.
/** The wire contract (INTEG-010): the events an endpoint can receive, in the order the screen lists them. */
export const eventTypes = ['response.created', 'response.deleted', 'response.partial_saved', 'payment.changed'] as const
export type EventType = typeof eventTypes[number] | 'webhook.test'
export type DeliveryStatus = 'pending' | 'sending' | 'confirmed' | 'failed' | 'cancelled'
export type EndpointState = 'active' | 'paused' | 'disabled'

export const headers = { eventId: 'pencil-event-id', eventType: 'pencil-event-type', timestamp: 'pencil-timestamp', signature: 'pencil-signature' } as const
export const apiVersion = '2026-10-23'

/** A failing endpoint stops after this many consecutive failed attempts that span at least this long (no confirmed delivery between). */
export const disableAfterFailures = 10
export const disableAfterMilliseconds = 24 * 3_600_000
/** The longest an event keeps retrying: attempt n+1 runs this many minutes after the first attempt. */
export const retryOffsetsMinutes = [1, 5, 15, 30, 60, 120, 240, 480, 960, 1440] as const

