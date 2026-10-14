# Operating Pencil

Use `rer VERB` or `pnpm run VERB -- FLAGS`. `describe` lists actual capabilities and effects. `check --profile first-party` validates command contract 1 before dependencies or private configuration exist. OPERATIONS.json declares the first-party adapter.

## Local operation

Use Node 22.20.0 and pnpm 10.12.4. Run `rer install`, `rer setup --owner-email EMAIL --owner-name NAME`, then `rer dev`. Installation is frozen. Setup builds, applies ordered migrations, creates the real owner through Base operator-auth and checks ordinary outbox sign-in, then stops its temporary production runtime. Dev serves assets and HMR, printing readiness after application health and sign-in. Open the printed Base outbox and finish `/setup`. Other app routes send an unfinished owner there; completed setup enters the app.

Private bindings are in `.dev.vars` (0600); canonical data is `.wrangler/state`. CLI bookkeeping is `.rer/local`; drafts and captures are `.seed/installer`. Setup preserves existing owner, rows and exact private bytes. Conflicting identity, ambiguous legacy state, unsafe symlinks and occupied ports fail before effects. Preserve any reported legacy location: export with compatible source, verify restoration into an empty canonical database and remove legacy state only after explicit recovery. Rer moves or deletes no ambiguous state.

Use `--port PORT` for an explicit loopback port. `preview` serves fixed production output. `outbox` prints the viewer and requests sign-in only with explicit `--owner-email EMAIL`. Remote viewer access is refused. Ctrl-C or the corresponding `--stop` tears down owned processes. `doctor` performs no provider request. `build` excludes private settings temporarily and restores their bytes and permissions.

## Reset and recovery

`rer reset --yes` prints and removes `.wrangler/state`, `.rer/local`, `.seed/installer`, `.dev.vars` and `.dev.vars.previous` when present. Active runtimes and unsafe inventory are refused. Source, dependencies, `exports` and `.rer/deploy` receipts survive. Setup after reset starts a fresh empty installation.

Create `exports` with mode 0700. `rer export --output exports/installation.rer` creates a new 0600 typed integrity archive. `rer import --input exports/installation.rer --yes` applies ordered schema and restores atomically only into an empty database. This uses Pencil's maintained archive engine. Form graphs, response history, importer originals/custody, contacts, invitations and operators remain; sessions, sign-in links, credentials, plaintext secrets, captured mail and private settings are excluded, so everyone signs in again after a restore. Historical notification eligibility is disabled and no mail is replayed. Source paths and archives in other checkouts are refused; this checkout's ignored `exports` is permitted. Public transfer supports local state and refuses remote targets.

Restore before setup, since setup creates owner/workspace records. Supply the retained owner's email when preparing fresh private settings after restore and sign in again. Check recovered forms, ledger, import resume/undo and delivery states before choosing the recovered installation. Never overwrite owner data or replay mail.

## Verification and release

Publication inspection uses the complete maintained Base scanner on a byte-exact parentless export. It requires Gitleaks 8.30.1; `bash scripts/install-gitleaks.sh` installs the reviewed binary after checksum verification. CI installs it before `pnpm verify:publication`. This inspection creates no tag, runs no scale case and publishes nothing.

Install Chromium with `pnpm exec playwright install chromium --only-shell`. `rer verify` runs types, product units, isolated Worker/D1, the entire recursive portable onboarding suite, native rer journeys, source provenance, archives, populated predecessor upgrades, boundaries, production build and desktop/mobile contract journeys. Internal targets have distinct names to prevent recursion. CI retains the functional and high-stakes wall.

Run **`pnpm run verify:release` before every release** for unchanged capacity, maximum-isolate memory, browser maximum heap and load workloads/assertions/thresholds. They are absent from CI and default verify. The maintained Base producer at 6b19df1343fe21e38262790185492f46f7eca36b or a descendant runs default verify and declared `verify:release`; either failure blocks release.

`pnpm run release -- --repo . --ref HEAD --project just-every/pencil --repository https://github.com/just-every/run-pencil --onto https://github.com/just-every/run-pencil#main --tag vVERSION --dry-run --output ../pencil-release` (with the committed `RELEASE.json` version) produces one child of the public repository's current `main`, with that commit as its sole parent and a tree equal to the source tree, and runs the complete scanner over it and the public history. Edition baselines retain copied origins, and source checks compare their actual bytes. Require PASS, complete scan, zero findings and zero reviews without exclusions or allowlists. Dry run tags no source commit and pushes nothing; its `PUBLISH.md` holds the fast-forward push. The 3 deliberately deferred clauses (ANLY-009, NOTIFY-001 and NOTIFY-003) remain unsatisfied by full-contract verification.

## Hosted operation

`pnpm run deploy -- --dry-run` builds real Worker/assets/migrations and validates deploy.json with zero provider calls. Actual deployment needs the intended `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `MAIL_FROM` and `MAIL_API_KEY`. rer 0.2.2 takes `SEED_ADMIN_EMAIL` from the environment or local setup, generates hosted `SESSION_SECRET` and one-time `SETUP_TOKEN` when omitted, claims the hosted owner automatically and removes the setup token. Sign in by email at the printed hosted address and finish `/setup`. Updates keep the owner and existing secrets; leave `SETUP_TOKEN` unset after successful retirement. The declaration selects production mail and disables sample data and local capture. Keep secrets out of argv and output. Health does not prove hosted installation, delivery, permissions or capacity. Read docs/HOSTING.md.

The Base importer row identifies public just-every/pencil, whose source is https://github.com/just-every/run-pencil. Point Base at a reachable public guide commit on its `main` and verify its bytes.

## Managed delivery

`pnpm run build:delivery` builds production artifacts and `pnpm run verify:admission` exercises the actual package, signed admission and owner editor at both viewports. The trusted build workflow uses the project’s pinned Node. Apply migrations through `0034_import_fence_triggers_d1.sql` before serving this source. The consumed-claim ledger survives export and restore; initialized stores refuse further claims. Optional management configuration comes from the intended installation’s issuer and origin. A native owner session gates editor configuration; expiry and sign-out revoke the widget. Hosted install, issuer/account configuration and real management-edge proof require the owner.

For recovery into a fresh clone, run `rer install`, copy the archive into private `exports/`, then import before setup or build. The committed `wrangler.jsonc` supplies the schema configuration. Run setup afterwards with the restored owner email.
