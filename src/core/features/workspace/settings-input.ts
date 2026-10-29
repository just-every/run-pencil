import { z } from 'zod'

/** Shared native settings admission, used by both HTTP and delegated calls. */
export const workspaceSettingsSchema = z.object({
  reminderDelayHours: z.number().min(0).max(8760).optional(),
  embedAllowedOrigins: z.array(z.string().trim().max(300)).max(30).optional(),
  timeZone: z.string().trim().min(1).max(100),
  sendingWindowStart: z.string().regex(/^\d{2}:\d{2}$/),
  sendingWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
})
