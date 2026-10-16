# Production mail

Pencil uses maintained Base mail for operator sign-in, invitations, reminders, response notifications and Daily digests.

Managed hosting through RER sends through the RER relay. Owners need no separate SendGrid or Resend account or API key; RER supplies the managed mail configuration. The relay accepts one recipient, text and optional HTML, without attachments. Response notifications containing a saved inline logo cannot be sent through this contract; their delivery problem remains visible on Results. Sign-in, invitations, response notifications and Daily digests use the relay with RER's assigned verified sender. RER supplies the sender automatically; it does not need a `noreply@` or `no-reply@` local part.

Free and Assisted installations keep the ordinary SendGrid or Resend choices. For direct Cloudflare deployment, configure MAIL_PROVIDER as `sendgrid` or `resend`, MAIL_API_KEY as a secret and MAIL_FROM as a verified sender. APP_ORIGIN, SEED_ADMIN_EMAIL and SESSION_SECRET are also required for production. See [hosting](HOSTING.md) for bootstrap and resource configuration.

The configured delivery service (RER relay for Managed hosting, or your chosen provider for direct hosting) receives the recipient address and the message, including the sign-in, invitation or opt-out capability where applicable. Keep these capabilities and provider credentials out of logs and public receipts. Production configuration errors fail visibly; a provider failure does not create a local inbox or authentication bypass.

Invitations and reminders persist their delivery attempt before sending. Rate-limit refusals have bounded retries with the original correlation key. Network/server uncertainty stays unknown without automatic resend. An operator can explicitly retry after acknowledging duplicate risk. SendGrid correlation is not provider deduplication; missing provider IDs remain null. A failed or uncertain sign-in send revokes its link.

`MAIL_PROVIDER=local` requires explicit PENCIL_LOCAL_DEVELOPMENT and loopback hosting. Local D1 mail is synthetic development evidence, not proof of delivery to a real inbox. Production acceptance needs provider evidence and actual receipt by the authorized recipient.
