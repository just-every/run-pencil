# Operator auth

Portable server-only ESM: import `createOperatorAuth` and `createAuthHandler` from
`src/base/operator-auth/index.mjs`. TypeScript declarations are `index.d.mts`.
No framework or mail transport is bundled. Apply the additive
`src/base/operator-auth/schema/operator-auth.sql` as a **new numbered migration**; preserve old migrations
and plan an explicit existing-operator import when adopting in a populated seed.
Tables use the `oa_` namespace. This module does not seed any product data. Pencil already installs the schema through migration 0010; do not apply it again. The standalone schema guidance is for a new integration.

```js
import { createOperatorAuth, createAuthHandler } from './src/base/operator-auth/index.mjs';
import { createMailSender } from './src/base/mail/index.mjs';
const { SESSION_SECRET, SETUP_TOKEN, MAIL_API_KEY: apiKey } = env;
const auth = createOperatorAuth({
  db: env.DB,
  config: {
    origin: 'https://app.example.com', OWNER_EMAIL: env.OWNER_EMAIL,
    SESSION_SECRET, SETUP_TOKEN,
    MAIL_FROM: env.MAIL_FROM,
    // Optional explicit address list further restricts active operators.
    // allowList: ['owner@example.com', 'staff@example.com'],
  },
  mailSender: createMailSender({ provider: env.MAIL_PROVIDER, mode: 'production',
    apiKey, accountId: env.MAIL_ACCOUNT_ID }),
  // Use only infrastructure-authenticated client addresses. In Cloudflare's
  // public Worker boundary CF-Connecting-IP is edge-owned. Do not reuse this
  // resolver behind a proxy which lets callers supply that header.
  clientIp: request => request.headers.get('CF-Connecting-IP') ?? '',
});
const response = await createAuthHandler(auth)(request);
// response === null means another dispatcher owns this path.
```

For first setup omit `mailSender` and `MAIL_FROM` entirely. Provision independent
random `SESSION_SECRET` and `SETUP_TOKEN` secrets (at least 32 characters; generate
32 random bytes or more). POST `/auth/bootstrap` with `{token,displayName,returnTo}`
creates the configured owner and session atomically only on an empty auth store.
Remove SETUP_TOKEN after bootstrap. Changing it never resets the bootstrap ledger.
No owner is automatically provisioned when requesting a link or invoking OIDC.

All public mutation APIs require POST, the exact configured request origin and
`Origin` header, and reject cross-site Fetch Metadata. Never derive `origin` from
request headers. `Host`, when supplied, must match the configured authority; local
HTTP additionally requires an explicit matching loopback Host. Browser forms and
JSON are accepted by the handler (8 KiB maximum). Parsed query/form parameters
with duplicate decoded names or JSON object keys are rejected with `invalid_input` before
auth processing, including escaped names. POST tokens are accepted only in the
body; a query token on a POST is rejected as an ambiguous credential source.
Protect every private API, server function and document with
`auth.getSession(request)`. Missing/invalid,
expired, revoked, deactivated and disallowed sessions yield null; host violations
throw `AuthError` with 403. Never return a private page then check in the browser.

## HTTP contract

| Path | Method | Input / result |
| --- | --- | --- |
| `/auth/bootstrap` | POST | token, displayName, returnTo?; 303 with cookie and safe Location |
| `/auth/magic-link` | POST | email, returnTo?; 202 `{status:'accepted'}` for admitted/unknown/disallowed address |
| `/auth/confirm?token=…` | GET/HEAD | 200 confirmation form, or 400 expired/invalid; **no writes, no session cookie** |
| `/auth/confirm` | POST | token; consume once, create session and 303 to stored returnTo |
| `/auth/session` | GET | session and operator, or 401 |
| `/auth/signout` | POST | `{}`; revoke current session, clear cookie, 204 |
| `/auth/invite` | POST | email, displayName, role? (member), returnTo?; mail invitation, 202 |
| `/auth/operators` | GET | authorized operator list |
| `/auth/operator/status` | POST | operatorId, status (`active`/`inactive`) |
| `/auth/operator/role` | POST | operatorId, role |
| `/auth/sessions?operatorId=…` | GET | authorized session metadata, no credentials |
| `/auth/session/revoke` | POST | sessionId; 204 |
| `/auth/review-session` | POST | returnTo?; explicitly configured loopback review session |

Unknown `/auth/*` paths return 404. Unsupported methods return 405. Known public
errors are JSON `{error:code}`: invalid input 400, unauthenticated 401, policy/host/
Origin rejection 403, missing resource 404, conflict/last owner 409, oversized input
413, unsupported content type 415, rate limit 429, missing mail/database 503.
Internal errors are redacted as `auth_unavailable`. Methods throw typed AuthError;
the Fetch adapter translates it. Every response has no-store headers. Successful
confirmation GET/HEAD responses use `Referrer-Policy: strict-origin` so native
form POSTs retain their Origin without exposing the token path or query in
Referer; HTTPS-to-HTTP downgrade requests omit Referer. Other responses retain
`Referrer-Policy: no-referrer`. Exact Origin/CSRF validation is unchanged.
Do not log confirmation URLs, input tokens, cookies or provider message bodies.

## Sessions, tokens and policies

Opaque 256-bit credentials are HMAC-SHA256 hashed with domain separation at rest.
Cookies are host-only, Path=/, HttpOnly, SameSite=Lax; production uses Secure and
`__Host-operator_session`. Explicit `local:true` allows only literal localhost,
127.0.0.1 or [::1] and uses `operator_session_local`. Session expiry defaults to
7 days (maximum 30), links to 15 minutes (maximum 60); no silent sliding renewal.
`returnTo` must be a local absolute path; unsafe values become `/app`. It is stored
with the token, and cannot be replaced on confirmation. Auth methods never return
raw link tokens. `CompletedSession.cookie` is server-only and must only be emitted
as Set-Cookie, never serialized into browser data.

D1 batches transactionally claim setup, consume links, accept invitations, bind
external identities and issue sessions. A unique token/session relation prevents
double consumption. Operator version fences invalidate **all** old links and
sessions after status/role changes, including after reactivation. Mutation SQL
rechecks the actor's active session and authority snapshot. Last active owner
removal/demotion is rejected by SQL triggers, including competing mutations.
Reactivate never bypasses invitation acceptance. Retrying an invitation with the
same email/role resends it and revokes older links; an existing active/inactive
operator conflicts. Unknown addresses never become operators through sign-in.

Invitations also bind their issuer's identity and authority version. Preview and
confirmation require that issuer to remain active and allowed, and re-evaluate
the configured `operators:invite` policy for the issued role. Confirmation fences
that issuer/version in the same transaction as invitation acceptance and session
creation. Changing the issuer's status or role permanently invalidates unused
invitations, even after restoration; an authorized operator must issue a fresh
link. Signing out or revoking just the issuing browser session does not invalidate
an invitation whose issuer still has authority.

Fixed-window durable IP and normalized-email limits default to 30/IP and 5/email
per 15 minutes; setup, magic, invitations, confirmation and review have separate scopes.
Confirmation limits bind the presented opaque token instead of sharing one global
email bucket. `clientIp` is mandatory; unavailable addresses fail closed (503).
Header trust belongs to the deployment boundary. Do not trust X-Forwarded-For.
Periodically prune old oa_limits rows and expired tokens/sessions in an
edition-owned maintenance job; preserve referenced rows or delete referencing
sessions first. Never delete oa_bootstrap as maintenance.

Default applied: **owner/admin/member**. Owner manages all operators; admin invites
members and manages members; members view/revoke their own sessions. Only owners
can promote roles. `rolePolicy({actor,action,target,role})` replaces this policy
for product variations. It receives current persisted operators, never caller
role claims; keep it deterministic and side-effect-free. Active operator, active
session, allow-list, version fences and last-owner safeguards cannot be overridden.
The exported `isActiveOperator` is the shared admission predicate.

## Mail, OIDC, password and review seams

Mail consumes actual mail API `createMailSender(config).send(message)`;
`deliveryId` is the token record UUID. No parallel transport or implicit outbox
exists. Missing/failing/uncertain transport revokes the link and reports
`mail_unavailable`; retries require a new link. Explicit development results are
accepted only in local mode. Auth never claims mailbox receipt.

The OIDC adapter verifies authorization-code/PKCE/state/nonce/issuer/audience/
signature/expiry before passing a principal to the core. The existing server-only
`auth.admitVerifiedIdentity(request, identity, {returnTo})` requires
`{issuer,subject,email,emailVerified:true}`. `config.externalIssuers` is a
deployment-controlled HTTPS issuer allow-list. Verified email can establish an
account's **first** external binding. Once any issuer+subject is bound to that
account, another principal cannot join it merely by presenting the same email,
including from another allowed issuer. Existing identical principals can sign in
again. The absence-of-binding check, binding insertion and session creation run
inside one atomic D1 batch, so competing first admissions cannot both succeed.

An explicit trusted server association may admit an additional principal:

```js
const admit = auth.createIdentityAdmission({
  issuer: 'https://idp.example.com',
  subjectEmails: { 'independently-verified-subject': 'operator@example.com' },
});
// Only after full protocol validation; the mapping supplies the account.
const result = await admit(request, { issuer, subject }, { returnTo });
```

The factory validates and snapshots its issuer and subject map. Its returned
function accepts a `VerifiedPrincipal` (`issuer`, `subject`, optional `email` and
`emailVerified`). A configured subject needs no email claim; every unmapped
subject still needs `emailVerified:true` and the first-binding rule. The map must
come from trusted deployment configuration or independently verified server-side
association records, never HTTP input or token email/role claims. There is no
per-login linking flag. The OIDC adapter builds this function from its existing
`config.subjectEmails`, preserving Microsoft's subject association path.

Neither path provisions operators, moves a bound issuer+subject to another
account, nor changes local roles. Both require existing active, allowed operators
and fence the current authority version when issuing an `oidc` session. No schema
change is needed; retain existing identity rows on upgrade. These are trusted
server seams, not HTTP JSON routes. OIDC correlation storage belongs to its
adapter; operator/session storage does not.

`admitVerifiedPassword(request, operatorId, {returnTo})` supports a seed's existing
real password verifier. It requires POST/Origin and shares active-operator,
allow-list, version and session policy. The caller must verify and rate-limit the
password **before** invoking it. It neither creates an operator nor claims setup;
there is no password checker or password endpoint in this module.

For local review, configure `review:{enabled:true,operatorEmail}` and invoke
`issueReviewSession`. It requires an already-active operator, POST/Origin, and
literal loopback URL **and Host**. Non-loopback Host returns 403 regardless of
flags or forwarded headers; admission of the resulting review cookie checks the
same boundary every time. Review defaults/maxes at one hour. Disable the flag to
invalidate review admission immediately. Bind the local review listener to a
loopback interface; a forged Host is not network isolation. Production configuration
must never enable review. No fixture/sample operator is created for review.

## Integration and checks

Copy this directory as source; import only its server entry from `.server` modules.
A Start server function must call getSession on each invocation. A Vite SPA must
use protected HTTP APIs and never bundle this implementation, secrets or D1. The
consumer owns its native unauthorized document redirect and API 401 behavior.
Mount `/auth/*` before private namespace guards and before Start; keep private
unknown API paths behind authentication before returning 404.

Pencil verifies this integration through `pnpm test:worker`, including native session, privacy, migration and revocation checks, and through the emitted desktop/mobile journeys in `pnpm verify`. Provider delivery and hosted identity-provider acceptance require separate live evidence. Upstream module-only suites are not part of this copied runtime source.
