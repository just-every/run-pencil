export type AudienceEligibility = { excludePreviouslyInvitedToFlow: boolean }
export type DistributionPolicies = {
  'flow.reminder-schedule.v1': { delayHours: number }
  'flow.audience-eligibility.v1': AudienceEligibility
}
export const defaultDistributionPolicies: DistributionPolicies = {
  'flow.reminder-schedule.v1': { delayHours: 48 },
  'flow.audience-eligibility.v1': { excludePreviouslyInvitedToFlow: false },
}
export function reminderDelayHours(policies: DistributionPolicies): number {
  const value = policies['flow.reminder-schedule.v1'].delayHours
  if (!Number.isFinite(value) || value < 0 || value > 8760) throw new Error('Reminder delay must be between zero and 8760 hours.')
  return value
}
export function audienceEligibility(policies: DistributionPolicies): AudienceEligibility {
  const value=policies['flow.audience-eligibility.v1']
  if (!value || typeof value.excludePreviouslyInvitedToFlow!=='boolean' || Object.keys(value).some(k=>k!=='excludePreviouslyInvitedToFlow')) throw new Error('Audience eligibility may only exclude previous flow invitations.')
  return {...value}
}
