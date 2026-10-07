export type MagicLinkMessage = {
  readonly to: string
  readonly magicLinkUrl: string
  readonly expiresAt: string
  readonly deliveryIdempotencyKey: string
}

export type MailDelivery = 'local' | 'email'

export type MailDeliveryOutcome =
  | { readonly kind: 'confirmed'; readonly providerMessageId?: string }
  | { readonly kind: 'terminal_failure'; readonly message: string }
  | { readonly kind: 'retryable_failure'; readonly message: string }
  | { readonly kind: 'unknown'; readonly message: string }

export interface MailSender {
  readonly delivery: MailDelivery
  /**
   * The caller persists deliveryIdempotencyKey before calling. A provider may
   * only return retryable_failure when retrying that exact key is safe.
   */
  sendMagicLink(message: MagicLinkMessage): Promise<MailDeliveryOutcome>
}

export interface LocalDevelopmentInbox {
  addLocalInboxMessage(message: {
    id: string
    toEmail: string
    magicLinkToken: string
    expiresAt: string
    createdAt: string
  }): Promise<void>
}
