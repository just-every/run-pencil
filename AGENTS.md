# Run it locally

Use `rer install`, `rer setup --owner-email EMAIL --owner-name NAME`, then `rer dev`. Dev opens signed in: open the `RER_OPEN` link it prints (it carries this checkout's private dev key in its fragment) and you are the owner, on `/setup` until first-run is finished. `--as operator` starts as the Dev operator persona and `--as signed-out` signed out; `--login` turns dev identity off and signs in through the key-gated outbox (`RER_SIGN_IN`). The outbox and every dev surface answer 404 without the key. Finish `/setup`. Run `rer verify`; export before `rer reset --yes`. Use `rer export --output exports/installation.rer` and `rer import --input exports/installation.rer --yes` for data movement. `pnpm run deploy -- --dry-run` validates locally; real deploy needs the owner's account. `rer describe` lists the rest.

# Working on Pencil

Read README.md, HANDOVER.md, CONTRACT.md, BASELINE.md and the actual package scripts before changing behavior. This repository is the complete editable product source. Owners may adapt source, schema, UI, framework and infrastructure while preserving their recorded requirements and customizations.

Keep responsibilities in small files, remove dead code, and validate inputs and authorization on the server. No production mocks, silent failures or semantic fallbacks. Keep credentials and server dependencies out of browser bundles. Parallelize independent investigation; keep ordered migrations and coupled writes under one owner.

Run affected checks and the complete `rer verify` gate before release. Tests must exercise behavior and preserve assertions, workload sizes and thresholds. All product and baseline clauses are active. Draft rewrites (ANLY-009), analysis attention (NOTIFY-001), and daily digests (NOTIFY-003) have behavioral checks; no contract deferral remains. Record uncovered requirements honestly. Local checks, CI, live mail delivery and hosted capacity are separate evidence.

Preserve applied migration filenames and bytes. Export before upgrades and verify restoration into a new database. Never overwrite owner data or replay mail during recovery.

Use OPERATIONS.md and docs/HOSTING.md for setup, deployment and recovery. Remote deployment and provider activity require the intended account and explicit resource configuration. No command name, push or pull request implies deployment.

`edition.json` selects components and `sources.lock.json` pins their origin and bytes. Source may be adapted locally. Stage intentional changes, inspect `node scripts/edition-authoring/cli.mjs changes`, run `node scripts/edition-authoring/cli.mjs lock`, commit, then run `pnpm source:check`. Retain provenance and verify real behavior after adopting upstream changes. Preserve contract IDs and explain intentional requirement changes in release metadata.
