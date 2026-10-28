# Run it locally

For the npm installation route, require Node.js 22+ including npm and Git, then use `npm install -g @runeditrun/rer` as on the Run page. The global launcher delegates to the exact checkout pin in `package.json` and its lockfile; do not change the pin to match the launcher. `rer dev` installs locked dependencies and prepares the local owner automatically; `rer setup --owner-email EMAIL --owner-name NAME` is optional.

Dev opens signed in: open the `RER_OPEN` link it prints (it carries this checkout's private dev key in its fragment) and you are the owner, on `/setup` until first-run is finished. `--as operator` starts as the Dev operator persona and `--as signed-out` signed out. Dev/demo mail is suppressed silently; there is no captured-mail inbox or injected bar. Finish `/setup`. Run affected project-only checks locally; CI is the full wall. Export before `rer reset --yes`.

Use `rer export --output exports/installation.rer` and `rer import --input exports/installation.rer --yes` for local product-data movement; credentials, sessions and private settings are excluded. Hosted owners use `/app/backup` for a bounded transactional download, file check and real SQLite restoration into a new in-browser database without pausing writers. SQL.js/WASM loads lazily from the same installation; restoration uses only the trusted build-time schema, checks integrity and foreign keys, and requires re-export SHA equality. The test database is discarded. `node scripts/deployment-data-restore-test.mjs --input exports/pencil-backup.rer --output exports/restore-test.sqlite` restores into a new local database with the archive’s own migration controller and proves re-export equality. Browser and local restore tests verify the archive without replacing a hosted deployment. Large archives and hosted replacement remain maintainer operations; see docs/HOSTING.md.

`rer deploy --dry-run --environment pencil-check` validates locally (environment names: at most 32 characters, lowercase letter first, lowercase letters/digits separated by single hyphens; choose a name once and retain it); real deploy needs the owner's account. `rer describe` lists the rest.

# Working on Pencil

Read README.md, HANDOVER.md, CONTRACT.md, BASELINE.md and the actual package scripts before changing behavior. This repository is the complete editable product source. Owners may adapt source, schema, UI, framework and infrastructure while preserving their recorded requirements and customizations.

Keep responsibilities in small files, remove dead code, and validate inputs and authorization on the server. No production mocks, silent failures or semantic fallbacks. Keep credentials and server dependencies out of browser bundles. Parallelize independent investigation; keep ordered migrations and coupled writes under one owner.

Run only affected project checks locally (the tests for changed behavior and the project typecheck); never run a full local `rer verify` or full suite. CI on the exact candidate head is the full wall before merge. Tests must exercise behavior and preserve assertions, workload sizes and thresholds. All product and baseline clauses are active. Draft rewrites (ANLY-009), analysis attention (NOTIFY-001), and daily digests (NOTIFY-003) have behavioral checks; no contract deferral remains. Record uncovered requirements honestly. Local checks, CI, live mail delivery and hosted capacity are separate evidence.

Preserve applied migration filenames and bytes. Export before upgrades and verify restoration into a new database. Never overwrite owner data or replay mail during recovery.

Use OPERATIONS.md and docs/HOSTING.md for setup, deployment and recovery. Remote deployment and provider activity require the intended account and explicit resource configuration. No command name, push or pull request implies deployment.

`rer-project.json` declares the editable project, its operations and verification scope; `sources.lock.json` retains source provenance and bytes. Source may be adapted locally. Stage intentional changes, inspect `node scripts/edition-authoring/cli.mjs changes`, run `node scripts/edition-authoring/cli.mjs lock`, commit, then run `pnpm source:check`. Retain provenance and verify real behavior after adopting upstream changes. Preserve contract IDs and explain intentional requirement changes in release metadata.

# Lander-Regenerate

After resolving CONTRACT.md, run `node scripts/contract-docs.mjs write CLAUSE...` with the touched clause IDs, then `node scripts/contract-docs.mjs check CLAUSE...`. This preserves the current acceptance layout, derives the touched entries and claim rows, and refreshes summary counts and docs/CLAIMS.md from the complete Status table. Regenerate the source lock last.
