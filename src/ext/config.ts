/**
 * Buyer-owned Pencil configuration.
 *
 * Example: change `publicFlowBusinessName`, `publicFlowPurpose`, and the four
 * `publicFlowTheme` colors to make the configured public surface your own.
 */
import type { PublicSeedConfig } from '../core/shared/config'

export const publicSeedConfig: PublicSeedConfig = {
  organizationName: 'Your organization',
  productName: 'Pencil',
  publicFlowSlug: 'aurora-coffee-post-visit',
  publicFlowBusinessName: 'Aurora Coffee',
  publicFlowPurpose: 'Your feedback helps the cafe team improve what matters most.',
  publicFlowTheme: {
    accent: '#afa4f5',
    background: '#11131d',
    surface: '#191c28',
    text: '#f4f0e8',
  },
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
}
