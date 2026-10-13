/** Buyer-owned product identity. Business branding is saved in Settings. */
import type { PublicSeedConfig } from '../core/shared/config'

export const publicSeedConfig: Pick<PublicSeedConfig, 'organizationName' | 'productName' | 'showPoweredByCredit'> = {
  organizationName: 'Your organization',
  productName: 'Pencil',
  showPoweredByCredit: false,
}

// Example: choose last-matching-rule for newly published revisions. Existing
// invitations, sessions and responses continue using their recorded snapshot.
export const flowPolicies: import('../core/shared/flowPolicies').FlowPolicies = {
  'flow.branch-selection.v1': 'first-matching-rule',
  'response.identity.v1': 'anonymous-public-link',
  'flow.response-admission.v1': 'independent-direct-completions',
}

// New launches snapshot this schedule; queued invitations retain their schedule.
export const distributionPolicies: import('../core/shared/distributionPolicies').DistributionPolicies = {
  'flow.reminder-schedule.v1': { delayHours: 48 },
  'flow.audience-eligibility.v1': { excludePreviouslyInvitedToFlow: false },
}
