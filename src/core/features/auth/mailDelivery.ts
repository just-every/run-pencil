import type { MailMessage, MailSender } from '../../../base/operator-auth/index.mjs'
import type { RuntimeConfiguration } from '../../platform/config/runtime'
import type { AuditService } from '../audit'

// Only maintained sender diagnostic names may enter logs or audit records.
// Provider bodies, exception messages, recipients and credentials never do.
const diagnosticCodes = new Set([
  'transport_uncertain', 'provider_rejected', 'provider_rate_limited', 'provider_uncertain',
  'transport_error', 'idempotency_conflict', 'idempotency_in_progress', 'idempotency_unknown_conflict',
  'rate_limited', 'unexpected_response', 'invalid_provider_response',
])
type DeliveryContext = {
  audit: Pick<AuditService, 'record'>
  operator?: { id: string; workspaceId: string }
  configuration: Pick<RuntimeConfiguration, 'mail' | 'isLocalDevelopment'>
}

export async function sendAuthMail(sender: MailSender, message: MailMessage, context: DeliveryContext) {
  const failure = async (outcome: string, code?: string) => {
    const details = { feature: 'operator-auth', adapter: 'mail.sender.v1', error: 'mail_unavailable',
      provider: context.configuration.mail.kind, outcome, ...(code ? { code } : {}) }
    console.error('auth.magic_link_failed', details)
    if (context.operator) await context.audit.record({ workspaceId: context.operator.workspaceId,
      kind: 'auth.magic_link_failed', subjectType: 'operator', subjectId: context.operator.id, details })
  }
  let result: Awaited<ReturnType<MailSender['send']>>
  try { result = await sender.send(message) }
  catch (error) {
    await failure('exception', 'provider_exception')
    throw error
  }
  if (result?.status !== 'accepted' && !(result?.status === 'development' && context.configuration.isLocalDevelopment)) {
    const outcome = ['rejected', 'rate_limited', 'uncertain'].includes(result?.status) ? result.status : 'invalid_sender_result'
    await failure(outcome, result?.code && diagnosticCodes.has(result.code) ? result.code : undefined)
  }
  // Preserve the sender's outcome: Base owns failed-token revocation and errors.
  return result
}
