# Portable mail

`index.mjs` is the portable ESM entry, usable from Node and Workers without a build. Applications own authorization, verified sender setup, durable delivery policy, replay storage, attachment storage and inbox reconciliation. An accepted API submission is not proof of mailbox receipt.

```js
import { createMailSender } from './src/base/mail/index.mjs';

const { RESEND_API_KEY: apiKey } = env;
const sender = createMailSender({
  provider: 'resend', mode: 'production', apiKey,
});
const result = await sender.send({
  deliveryId: durableCommand.id,
  from: 'Support <support@example.com>',
  to: ['recipient@example.net'],
  subject: 'Your requested sign-in link',
  text: 'Open the link you requested.',
});
```

The provider is explicit: `sendgrid`, `resend`, `cloudflare`, or `development`.
`mode` is required (`production`, `development`, or `test`). Remote providers require `apiKey`; Cloudflare additionally requires a 32-hex `accountId`. A remote provider in test/development mode still makes a real provider request unless the caller explicitly supplies a test fetch. Missing credentials, validation errors, or provider failure never select another provider. Config and messages reject unknown fields so requested features cannot silently disappear.

`createMailSender(config, dependencies?)` returns `{send(message)}`. Dependencies are optional standard `fetch`, an explicit asynchronous `outbox.put(message)`, and `clock: () => epochMilliseconds`. Production normally uses global fetch. No configurable provider endpoint, retry, or automatic replay exists. The sender snapshots configuration at construction and the message at submission.

## Message and results

Required fields: `deliveryId` (nonempty, at most 512 characters), `from`, nonempty `to: string[]`, `subject: string` (SendGrid requires nonempty; other providers allow empty), and at least one nonempty `text` or `html`. Addresses accept a mailbox or `Display Name <mailbox>`; the conservative mailbox grammar rejects controls, multiple addresses inside one string and malformed domains. Use arrays for recipients.

Optional `cc`, `bcc`, `replyTo`, and string-valued `headers` preserve envelope and threading. `In-Reply-To` and ordered `References` can be supplied as headers. SendGrid and Resend also accept `Message-ID`; Cloudflare generates it and rejects a caller-supplied value. CR/LF/control characters, duplicate header names ignoring case, reserved envelope/MIME/security headers and invalid header names fail before a request. Provider-specific header restrictions are also enforced.

Attachments use `{filename, contentType, content: Uint8Array, disposition?: 'attachment'|'inline', contentId?}`. Content is raw bytes, never a base64 string at the public boundary. Inline attachments require a content ID. Unsupported attachment features fail explicitly. Provider size and count limits still apply.

Resend checks a conservative 40,000,000-byte total email budget before Base64 or
JSON encoding, including UTF-8 bodies, all recipients/headers, aggregate Base64
attachments and MIME overhead. Its final JSON request is capped at 39,000,000
UTF-8 bytes. Oversize input throws `MailValidationError` with fixed code
`resend_message_too_large` before any send or outbox effect. See the precise
[Resend size budget](src/adapters/resend/README.md#outbound-size-budget); it is a
local guard and may reject input below the provider's maximum.

SendGrid additionally supports `customArgs: Record<string,string>`, positive safe-integer `asmGroupId`, and boolean `subscriptionTracking`. The custom argument JSON including `rer_delivery_id` is limited to 10,000 UTF-8 bytes. Caller arguments cannot replace `rer_delivery_id`, `email`, `event`, `timestamp`, `sg_event_id`, or `sg_message_id`. Resend and Cloudflare reject these SendGrid-only settings, including empty `customArgs` and `subscriptionTracking: false`.

`send` returns `{provider,status,providerMessageId,code?,recipientResults?}`. Status is `accepted`, `rejected`, `rate_limited`, `uncertain`, or `development`. `providerMessageId` is a real provider receipt or null; local correlation never fabricates one. A validation/configuration error throws a redacted error with a fixed code. Errors/results never expose raw provider response bodies or credentials.

- SendGrid requires HTTP 202 for acceptance. Its `X-Message-Id` is nullable. `rer_delivery_id` is correlation, not duplicate suppression. Click, open, and Google Analytics tracking are disabled; subscription tracking is enabled only when requested. `serializeSendGridMessage(message)` exposes validated wire bytes for callers that own durable fingerprints.
- Resend uses `deliveryId` as `Idempotency-Key` and preserves the returned ID. Resend retains idempotency keys for 24 hours; a reused key with a different payload conflicts. This module does not retry or assume indefinite duplicate suppression. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Cloudflare uses the [Email Sending REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/), separate from Email Routing's restricted send binding. Both `success` and recipient result data are checked. Partial recipient outcomes remain visible in `recipientResults`; API send results do not assert actual inbox receipt.

Network loss, redirects, HTTP 408 and 5xx are conservatively `uncertain`; 429 is `rate_limited`, and other definite 4xx rejection is `rejected`. Provider success statuses require their documented semantics. Reconcile uncertain attempts before deciding whether a new submission is safe. No adapter retries or follows redirects.

## Development and unsubscribe

Development requires all three: `provider:'development'`, `mode:'development'`, and explicit `dependencies.outbox.put`. It captures the prepared message with its raw attachment bytes and returns `development`, never remote acceptance. Configure storage only in your development host; the module creates no public route or network replay. Treat message content as sensitive and expose only redacted metadata in development listings.

`unsubscribe: {url, mailto?, oneClick?}` supplies an HTTPS unsubscribe URL and optional mailbox. One-click generates `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Insecure URLs, injection and contradictory custom unsubscribe headers fail before dispatch. `applyUnsubscribeHeaders(message)` returns a new prepared message with the `unsubscribe` request removed. Passing an already prepared message to the facade is safe. Direct adapters reject unconsumed requests before any effect; the facade performs assembly once before dispatch. Applications own unsubscribe authorization and processing. Confirm delivered headers and DKIM coverage with a real delivered message; local serialization is not one-click acceptance.

## Verified events and inbound mail

`verifyWebhook({provider,rawBody,headers,key,now,toleranceSeconds?})` returns a boolean. Providers are `sendgrid` and `resend`; `rawBody` is the exact `Uint8Array`, `headers` a `Headers`, and `now` epoch milliseconds. Default clock tolerance is 300 seconds. SendGrid uses base64 SPKI P-256 public keys and DER ECDSA signatures over timestamp plus exact bytes; Resend uses a `whsec_` base64 HMAC secret and Svix framing. Never decode and reserialize JSON or multipart before verification. Signature validity alone establishes neither schema validity nor sender identity. `MAX_WEBHOOK_BYTES` exports the 32 MiB verifier bound; delivery-event intake has its own 1 MiB bound. `createDeliveryEventIntake({provider,tenantId,eventNamespace,key?,storage,authorize,clock?,cloudflareSource?})` verifies, authorizes, then commits receipts and recipient states in one durable transaction. It exposes `ingestWebhook({rawBody,headers})` for SendGrid/Resend or `consumeQueue(batch)` for the trusted Cloudflare queue boundary. Supply actual serializable durable storage (for Workers, Durable Object SQLite); there is no process-local fallback. See the [event integration contract](src/events/README.md) for atomic deduplication and recipient reconciliation.

`normalizeInbound(input, limits)` returns `{provider,messageId,from,to,subject,text,html,inReplyTo,references,attachments}`. Nullable fields remain null, empty subject remains valid, references retain order, and attachment content remains decoded bytes. Required positive-integer limits are `maxRawBytes`, `maxBodyBytes`, `maxAttachments`, `maxAttachmentBytes`, and `maxTotalAttachmentBytes`; limits apply to actual bytes, including streams and decoded attachments. Over-limit/malformed messages fail atomically.

Inputs are Cloudflare `{provider:'cloudflare',message:{from,to,headers,raw,rawSize}}` from a Worker email handler, SendGrid `{provider:'sendgrid',rawBody,contentType}` after original multipart signature verification, or Resend `{provider:'resend',email,signedEmailId,fetchAttachment?}` after a verified `email.received` event and checked hydration identity. No unsigned HTTP JSON receiver is provided. Cloudflare delivery events use a trusted Event Subscriptions Queue boundary, never an invented HTTP signature. See [inbound dependencies and trust boundaries](src/inbound/README.md), `signedEmailId` must come from the authenticated event, not the hydrated response. The facade exports `createResendAttachmentFetcher({apiKey,maxAttachmentBytes}, {fetch?,clock?})` for the explicit `fetchAttachment` dependency; it validates metadata, fixed provider/CDN origins, size and redirects. No attachment may be silently omitted.

## Doctor and live proof

`mailDoctor({domain,provider,dnsRecords?,live:false}, dependencies?)` returns six items (`mx`, `spf`, `dkim`, `dmarc`, `send`, `receive`) with status, next steps, optional records and safe evidence. Plans are not observations: without probes records remain pending/not checked. DNS values must come from provider setup or supplied records; DKIM keys/selectors are never invented. Missing credentials are actionable, never a pass.

```sh
node src/base/mail/doctor.mjs --domain mail.example.com --provider resend --plan --json
node src/base/mail/doctor.mjs --domain mail.example.com --provider resend --plan
```

Both plan commands are offline and require no credentials. See [doctor dependencies and explicit live invocation](src/doctor/README.md) for DNS checking and bounded send/receive correlation. A send response cannot make receive pass. The protected [live-proof contract](live-proof/README.md) names the exact runner command and receipt path; its evidence writer uses `EVIDENCE_WRITE_TOKEN`. Hosted workflow wiring and all owner-controlled credentials/resources remain separate integration work.

## Verification

From the repository root:

Run `pnpm verify` from the Pencil repository root. The native Worker suites exercise authentication mail, durable distribution, privacy erasure and failure recovery with test-only provider transport. Upstream module-only test suites are not included in this copied runtime source.

Local checks do not establish provider configuration, DNS propagation, deployed webhook reachability or recipient inbox delivery. See docs/HOSTING.md for hosted acceptance.
