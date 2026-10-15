// @ts-expect-error Maintained Base mail source publishes JavaScript without declarations.
import { MailValidationError } from '../../../base/mail/index.mjs'
const configurationCodes: Record<string,string> = {
  api_key_required: 'MAIL_API_KEY', invalid_api_key: 'MAIL_API_KEY', invalid_provider: 'MAIL_PROVIDER',
  invalid_config: 'MAIL_PROVIDER', invalid_mode: 'MAIL_PROVIDER', development_mode_required: 'MAIL_PROVIDER',
  unsupported_development_config: 'MAIL_PROVIDER', development_outbox_required: 'MAIL_PROVIDER',
  cloudflare_account_required: 'MAIL_PROVIDER', unsupported_account_id: 'MAIL_PROVIDER',
}
/** Only known pre-transport configuration failures disable mail. Unknown exceptions stay ambiguous. */
export function notificationConfigurationFailure(error: unknown) {
  if (!(error instanceof MailValidationError)) return null
  const code=(error as {code:string}).code,variable=configurationCodes[code]
  return variable ? `Notification mail disabled: ${variable} failed Base mail validation (${code}).` : null
}
const providerCodes = new Set(['provider_rejected', 'provider_redirected','provider_rate_limited','provider_uncertain','transport_uncertain','transport_error','rate_limited','unexpected_response','invalid_provider_response','idempotency_conflict','idempotency_in_progress','idempotency_unknown_conflict'])
export function safeNotificationReceipt(provider: string, code?: string) {
  return { provider: ['rer','sendgrid','resend','development'].includes(provider) ? provider : null, code: code && providerCodes.has(code) ? code : null }
}

export const notificationPreparationReasons = {
  brand: 'Notification not sent: business branding could not be read or validated.',
  composition: 'Notification not sent: message composition failed.',
  eligibility: 'Notification not sent: delivery eligibility could not be checked.',
} as const
export type NotificationPreparationFailure = keyof typeof notificationPreparationReasons
