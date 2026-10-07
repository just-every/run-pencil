export type DistributionPolicies = { 'flow.reminder-schedule.v1': { delayHours: number } }
export const defaultDistributionPolicies: DistributionPolicies = { 'flow.reminder-schedule.v1': { delayHours: 48 } }
export function reminderDelayHours(policies: DistributionPolicies): number {
  const value = policies['flow.reminder-schedule.v1'].delayHours
  if (!Number.isFinite(value) || value < 0 || value > 8760) throw new Error('Reminder delay must be between zero and 8760 hours.')
  return value
}
