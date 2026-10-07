# Hosting Pencil

Pencil runs on Cloudflare Workers and D1. Authenticate Wrangler in the intended account. Set `APP_ORIGIN` to the exact HTTPS workers.dev origin, `PENCIL_BUILD_ID`, `SEED_ADMIN_EMAIL`, `MAIL_PROVIDER=sendgrid` (or `resend`) and `MAIL_FROM`. Supply MAIL_API_KEY, a random SESSION_SECRET of at least 32 characters and a distinct random SETUP_TOKEN of at least 32 characters through the operator's secret environment. Never put secrets in tracked configuration or shell history.

Select resources explicitly, using your own account subdomain:

```sh
export PENCIL_WORKER_NAME=pencil
export PENCIL_DATABASE_NAME=pencil-db
export PENCIL_WRANGLER_CONFIG=deploy/pencil.toml
export APP_ORIGIN=https://pencil.YOUR-SUBDOMAIN.workers.dev
pnpm run setup --remote
pnpm run deploy
```

Pass `--remote` directly after `setup`; the setup script accepts no extra `--` separator. Remote setup finds or creates D1 by exact name and creates the named private configuration only when absent. Repeated setup preserves matching configuration and refuses incompatible owner values. Deploy takes no command-line options and runs full verification before compiling the target, applying migrations, installing supplied secrets and uploading the Worker. Local-only flags PENCIL_LOCAL_DEVELOPMENT and SEED_SAMPLE_DATA, and local mail, must remain disabled.

Export existing data before migration. Migration `0010_base_operator_auth.sql` imports operator identities and revokes legacy links and sessions, signing existing operators out. Configure maintained Base mail and SESSION_SECRET, then sign in again. Preserve prior migration identities and bytes. Restore backups into a new database before changing bindings and never replay mail merely to prove recovery.

For a fresh database, POST same-origin JSON to `/auth/bootstrap` containing the SETUP_TOKEN as `token` and the operator's `displayName`. Retain the returned session cookie and redirect privately. The identity comes from SEED_ADMIN_EMAIL. Remove SETUP_TOKEN after bootstrap acceptance. A migrated installation cannot bootstrap again. Test `/signin` with an authorized mailbox: GET confirmation is read-only; Confirm performs the single-use POST. Confirm sign-out revokes private access.

Before considering a deployment accepted, record the source commit, Worker version/deployment ID, origin, D1 identity, schema version, UTC time and redacted results. Require HTTPS `/health` to report the exact build and healthy D1 within one second. Actual recipient inbox arrival and provider evidence establish delivery; HTTP acceptance or a local inbox does not. Exercise build, publish, respond, report and export on that same deployment, including keyboard and accessibility checks at desktop/mobile widths.

Measure hosted public-screen, transition, final-submission and ledger p95 latency against the declared 500/500/1000/500 ms limits. Preserve rate/admission controls and record workload cardinalities, concurrency, failures, warm/cold treatment, rows read/written and p50/p95/p99. Local load tests do not establish the manifest's hosted capacity of 1,000 flows, 50 open flows, 100 revisions and 100,000 responses per revision. Retain failed measurements honestly.

Results summaries use published-revision denominators; response-only ledger filters do not alter anonymous session counters or correlate sessions with answers. Upload questions are not implemented; multipart/binary intake remains refused. Public embeds use an opaque sandbox and exact host allowlist. No host answer messaging is emitted.

The first-release profile defers AUD, ANLY, ACT and NOTIFY; the full-contract gate remains unsatisfied. Local verification, source publication and hosted acceptance are separate. Preserve the prior compatible deployment identity for rollback. A first deployment has no prior version: disabling its Worker preserves D1 while recovery is evaluated.
