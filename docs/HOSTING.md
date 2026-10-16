# Hosting Pencil

Managed hosting through RER sends Pencil mail through the RER relay. RER supplies the verified sender automatically for sign-in, response notifications and Daily digests. No separate mail provider account or API key is needed. Free and Assisted installations retain the ordinary SendGrid or Resend choices.

The instructions below cover direct deployment into your own Cloudflare account, which requires your own mail provider, verified sender and API key.

Install Node.js 22 or later with npm from [nodejs.org](https://nodejs.org/en/download), then `npm install -g @runeditrun/rer`. Node and npm must already be on `PATH` for this npm installation route; Git is also required. The one-line install on the [Run page](https://run-pencil.com/run) does this for you. The global rer launcher delegates to the exact checkout pin in `package.json` and its lockfile; keep that pin rather than changing it to match the global launcher.

rer installs Pencil's pinned runtime and pnpm for its own commands, without putting pnpm on the shell's `PATH`. Run `rer install` in the checkout. For source changes, install the browser with `npx --no-install playwright install chromium --only-shell` and run `rer verify`; run `npm run verify:release` before release. These checks are separate from deploying an unchanged checkout.

`rer deploy --dry-run --environment pencil-check` builds and validates the real Worker/assets/migrations and owner declaration with zero provider requests. Environment names have at most 32 characters, start with a lowercase letter, and contain lowercase letters or digits separated by single hyphens; no leading, trailing or repeated hyphens. `pencil-check` is a dry-run example, not a rename of an existing environment. Choose the intended name before deployment and retain it for deploy, sign-in, receipt and removal. Validate the intended environment separately before a real deploy.

Before the first deploy, find the account's `workers.dev` subdomain under Workers & Pages. The Worker name is `pencil-<environment>`: default production is `pencil-production`, and its address is `https://pencil-production.<workers-subdomain>.workers.dev`. A named environment uses `https://pencil-<environment>.<workers-subdomain>.workers.dev`. Real deploy looks up the subdomain and sets `APP_ORIGIN` to that generated origin automatically; do not copy a local `.dev.vars` origin into production. Dry run makes no account lookup.

Actual `rer deploy --environment production` requires the intended Cloudflare account/API token and production MAIL_FROM and MAIL_API_KEY. Set OWNER_EMAIL to the hosted owner’s email and pass it with `SEED_ADMIN_EMAIL="$OWNER_EMAIL" rer deploy --environment production`; Pencil’s current declaration reads SEED_ADMIN_EMAIL. rer generates fresh hosted SESSION_SECRET and one-time SETUP_TOKEN values when omitted. An explicitly supplied SESSION_SECRET must have at least 32 characters; preserve the deployed value across updates. Supply secrets privately through the authorized deployment environment, never literal values in argv or output. `PENCIL_MAIL_PROVIDER` selects `sendgrid` (the default) or `resend`; the earlier `MAIL_PROVIDER` environment setting is accepted when it agrees. The deploy adapter passes this through the published kit as the Worker’s `MAIL_PROVIDER` binding. Choose it and the matching `MAIL_API_KEY` before the first deploy. For an existing released Worker whose provider is a plain variable, the adapter reads and preserves that provider while the kit inherits its opaque API key; a conflicting explicit provider is refused. Once provider and key are both secrets, subsequent deployments inherit them rather than rotate them. deploy.json selects production mail, derived resource identities, scheduled maintenance, ordered D1 migrations and public origin; local capture and sample data are disabled. A healthy Worker does not prove real mail delivery or hosted capacity.

Use a plain provider-verified `noreply@` or `no-reply@` MAIL_FROM address, with no display name, for response notifications and Daily digests. Sign-in email can work with another verified sender; Results explains that response notification mail is off in that case.

After a healthy first deploy, rer automatically claims the hosted owner through native Base authentication, removes SETUP_TOKEN and records the new Worker version. Once deploy confirms success, the owner signs in by email at `/signin` and finishes `/setup`; no manual setup-token claim is needed. Preserve owner data and opaque existing provider secrets. Export before upgrades, verify restore into an empty database and retain a compatible deployment until owner acceptance. Never replay mail in recovery. Hosted managed admission requires owner proof; a private push or dry run installs nothing. Tags, public publication and site listing are separate owner actions after full release verification and a zero-finding scan.

After successful automatic owner claim and token retirement, unset SETUP_TOKEN in the calling environment. Repeat deployments keep the existing owner and secrets without uploading the retired token. If claim or retirement fails, follow the CLI’s recovery instructions with the same environment credentials. An initialized installation refuses another owner claim. Do not mutate Worker secrets in the dashboard: rer treats that new Worker version as `owned-resource-replaced`. Keep and privately back up `.rer/deploy/<environment>.json`; do not edit it to bypass the refusal. A Worker already changed outside rer requires the deploy kit’s supported ownership recovery.

`rer signin --environment production` uses the deployment's Cloudflare credentials and private receipt to issue a single-use link for its recorded owner without email. The link expires within 15 minutes and is printed only to the terminal; keep it private and open it promptly. An older deployment without owner-sign-in support is refused with upgrade guidance. Use `/signin` for ordinary operator email sign-in.

Archives contain product data, including personal data, but exclude credentials, active sessions, captured mail and private settings. The signed-in owner can use `/app/backup` to download and check a bounded archive. Reads happen in one D1 atomic batch, including a size guard before product rows are read; forms and schedules may keep writing. The browser path checks checksum, exact committed schema/history, row shape, privacy rules and foreign-key references. **Test restoration** then lazily loads SQL.js and its WASM from the same origin, creates a new in-memory SQLite database, restores using only the trusted build-time schema and typed values, checks integrity/foreign keys and requires an identical re-exported checksum. Signed 64-bit integers bind through decimal strings cast inside SQLite and are read with BigInt support; text and blobs retain their storage types. Triggers are added after loading rows, as with file recovery, and no notifications or external tasks run. A newer archive can apply the existing erasure fence before any test database is created. The test database is closed and discarded on both success and failure. It does not execute arbitrary archive SQL or activate a restored deployment. The manifest is generated from this checkout’s migrations at build time by `scripts/deployment-data-browser-manifest.mjs`.

The matching-version command below validates all database constraints, creates a new local SQLite database using the archive’s own migration controller, and re-exports it. It refuses an existing output and requires checksum equality. It works for both local and deployment-kit archives, without the `rer import` hosted/local controller mismatch:

```sh
node scripts/deployment-data-restore-test.mjs --input exports/pencil-backup.rer --output exports/restore-test.sqlite
```

This is a restore test, not an active hosted replacement and not a local `rer dev` installation. The restored SQLite file intentionally retains the original controller. Do not substitute ledgers to make `rer dev` accept it. An optional `--journal exports/later.rer` refuses a backup predating a later erasure.

## Large-workspace export

Browser export uses a conservative 8 MiB JSON size budget and a row-count guard. The archive is never truncated. Oversized workspaces require the streaming maintainer CLI. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` (the actual D1 ID in the private deployment receipt), and `CLOUDFLARE_API_TOKEN` in the private environment. Use the source version that matches the live database. Stop routes, schedules and all other writers while preserving D1, wait for in-flight work, then run:

```sh
node scripts/deployment-data-cli.mjs export --output exports/deployed.rer --writers-stopped
node scripts/deployment-data-restore-test.mjs --input exports/deployed.rer --output exports/restore-test.sqlite
```

Unlike the page’s single-transaction export, the streaming CLI uses paginated primary reads and consistency bookmarks; it requires a stable source. The flag confirms the operator stopped writers. This remains a maintainer operation, and the browser path does not silently switch to it.

## Hosted replacement boundary

The current product does not provision or attach a restored hosted target from the Backup page. A normal owner-claimed `rer deploy` is not an empty restore target. Do not delete owner records to bypass the empty-target guard. Keep the original deployment until an installation-specific recovery procedure has provisioned a matching-source migration-only D1 database, restored it, re-exported matching contents and attached it through the supported deployment workflow. The page’s real browser restore test and the optional local restore-test command give concrete archive acceptance checks; they do not activate a hosted replacement.

For an already provisioned, stopped, empty D1 target with the same migration controller, point `CLOUDFLARE_DATABASE_ID` at that target and run:

```sh
node scripts/deployment-data-cli.mjs import --input exports/deployed.rer --yes --writers-stopped
node scripts/deployment-data-cli.mjs export --output exports/deployed-restored.rer --writers-stopped
```

Require identical `sha256` values. Staging is inert and publication is atomic; recovery never sends mail. For `RESTORE_STATE_UNCONFIRMED`, keep the target stopped and inspect it. `cleanup --input exports/deployed.rer --yes --writers-stopped` removes only the archive’s recognized inert stage. For `RESTORE_VERIFICATION_UNCONFIRMED`, publication already occurred; re-export and compare before retrying.

## Deployment ownership recovery

Do not delete or change Worker secrets in the dashboard between deployments. Those changes create a Worker version outside the saved deployment receipt; the next deploy refuses it as `owned-resource-replaced`. Preserve `.rer/deploy/production.json` (or the file for your chosen environment) privately and back it up after each successful deploy. Do not edit the receipt or bypass an ownership refusal. A deployment whose Worker version has already changed outside rer needs the deploy kit's supported ownership recovery.

To remove a deployment and its data, use `rer deploy --remove --yes --environment production` with its receipt and the same account credentials. It deletes only resources recorded as created by rer for that environment and reads back that they are gone. Make and verify a hosted backup first if you need the data. Removal deletes D1; it is not a temporary pause for backup.

This hosting path requires Workers Paid. Pencil sets no explicit per-Worker CPU limit in its deployment declaration and uses the provider plan's default. Pencil being free software does not select a free provider plan. Consult [Cloudflare’s limits](https://developers.cloudflare.com/workers/platform/limits/).

Hosted upgrades from released 0.2.0 require separate qualification: the recorded rer 0.2.1 attempt refused the changed `0019_import_custody.sql` hash before any upgrade writes or migration 0034. The exact current rer version is pinned in `package.json` and its lockfile; a version change is not proof of a safe transition. The name-based Workers D1 upgrade proof does not cover this kit path. Retain the existing source and database and use a supported matching-version backup path until a reviewed transition retains the actual applied history and applies the additive convergence migration. Do not rewrite ledger hashes, bypass checks, switch migration controllers or assume export/restore qualifies this transition. This source’s deployed recovery CLI also checks migration hashes and does not establish export compatibility with the old 0019 history. Fresh installation and provider preservation are separate proofs.
