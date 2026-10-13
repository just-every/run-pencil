# Production mail

Pencil uses maintained Base mail for operator sign-in, invitations and reminders. Configure MAIL_PROVIDER as `sendgrid` or `resend`, MAIL_API_KEY as a secret and MAIL_FROM as a verified sender. APP_ORIGIN, SEED_ADMIN_EMAIL and SESSION_SECRET are also required for production. See [hosting](HOSTING.md) for bootstrap and resource configuration.

The provider receives the recipient address and the message, including the sign-in, invitation or opt-out capability where applicable. Keep these capabilities and provider credentials out of logs and public receipts. Production configuration errors fail visibly; a provider failure does not create a local inbox or authentication bypass.

Invitations and reminders persist their delivery attempt before sending. Rate-limit refusals have bounded retries with the original correlation key. Network/server uncertainty stays unknown without automatic resend. An operator can explicitly retry after acknowledging duplicate risk. SendGrid correlation is not provider deduplication; missing provider IDs remain null. A failed or uncertain sign-in send revokes its link.

`MAIL_PROVIDER=local` requires explicit PENCIL_LOCAL_DEVELOPMENT and loopback hosting. Local D1 mail is synthetic development evidence, not proof of delivery to a real inbox. Production acceptance needs provider evidence and actual receipt by the authorized recipient.
