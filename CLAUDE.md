# Run it locally

Use `rer install`, `rer setup --owner-email EMAIL --owner-name NAME`, then `rer dev`. Sign in through the outbox it prints and finish `/setup`. Run `rer verify`; export before `rer reset --yes`. Use `rer export --output exports/installation.rer` and `rer import --input exports/installation.rer --yes` for data movement. `pnpm run deploy -- --dry-run` validates locally; real deploy needs the owner's account. `rer describe` lists the rest.

Read AGENTS.md for the project requirements.
