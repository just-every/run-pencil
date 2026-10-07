export type MailConfiguration =
  | { readonly kind: 'local-development' }
  | { readonly kind: 'resend' | 'sendgrid'; readonly apiKey: string; readonly from: string }
