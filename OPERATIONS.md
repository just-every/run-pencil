# Pencil operations

`rer-project.json` records public project identity and links to `OPERATIONS.json`, the versioned descriptor read by `scripts/operations.mjs`. Deployment uses the documented package scripts and explicit Wrangler configuration.

Use Node 26.8.1 and pnpm 10.12.4 for the verification toolchain. `node scripts/operations.mjs describe` reports command effects; `check` validates named configuration without provider calls.

## Local development

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm dev --host 127.0.0.1 --port 15621 --strictPort
```

Setup prepares local configuration and applies D1 migrations. Sign in as `owner@aurora-coffee.test` using `/signin` and the synthetic inbox. Sample initialization is durable and runs once; subsequent requests preserve edited or deleted records. Local mail and sample data must never run in production.

`pnpm build` emits the Worker and assets to dist. To inspect that build, use the same local persistence directory as the migration command:

```sh
pnpm exec wrangler dev --config dist/server/wrangler.json --local \
  --persist-to "$PWD/.wrangler/state" --ip 127.0.0.1 --port 15620 --inspector-port 15659
```

Install the test browser with `pnpm exec playwright install chromium --only-shell`, then run `pnpm verify` for the full local gate. `pnpm test:worker` uses isolated native Worker/D1 state; `pnpm test:load` retains the declared workload and thresholds. `pnpm verify:contract` executes native desktop/mobile journeys and reports the first-release profile. `pnpm verify:contract:full` retains the 33 deferred TODOs. Generated review outputs belong under ignored test-results.

## Data and recovery

```sh
pnpm run export -- --database SOURCE.sqlite --output PRIVATE.json
pnpm run import -- --archive PRIVATE.json --database NEW.sqlite
pnpm verify:data
```

Export reads a consistent snapshot of all application records and migration history. Archives contain personal data and credentials and are created mode 0600. Import validates the entire archive and compiled schema and exclusively creates a new database; it refuses existing destinations and performs no provider effects. See [local recovery](docs/LOCAL-DATA-RECOVERY.md) for D1 binding placement.

Export before migration. `0010_base_operator_auth.sql` imports identities and revokes legacy links and sessions, signing operators out. Configure Base mail and SESSION_SECRET and sign in again afterward. Preserve applied migration names and bytes. Recovery restores the private export into a new database before changing bindings; sent, failed and unknown delivery states must survive without replay.

The minute Cron dispatches due reminders and runs privacy maintenance. Reminder schedules are snapshotted per launch and use the workspace IANA zone and sending window. Ambiguous mail stays unknown without automatic resend; explicit operator retry acknowledges duplicate risk. Response outbox records remain durable while deferred AI/action dispatch is unavailable.

## Hosting

[Hosting instructions](docs/HOSTING.md) cover explicit resource targeting, required secrets, bootstrap, deployment, health, real mail and capacity acceptance. Local setup never creates remote resources. The SQLite export/import commands do not download or replace remote D1; remote backups and resource binding changes are explicit Cloudflare operations.
