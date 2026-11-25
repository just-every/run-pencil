export type MailConfiguration =
  | { readonly kind: 'local-development' }
  // Mail off (MAIL_PROVIDER=none, rer's mail-off deploy): nothing is sent; the owner signs in with `rer signin`.
  | { readonly kind: 'none'; readonly from: string }
  | { readonly kind: 'resend' | 'sendgrid'; readonly apiKey: string; readonly from: string }
  | { readonly kind: 'rer'; readonly apiKey: string; readonly from: string; readonly relayUrl: string }
