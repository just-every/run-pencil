# Pencil

Pencil is a self-hosted adaptive form builder and feedback workspace for one business. Build and preview answer paths, publish immutable revisions, collect direct or embedded responses, send invitations and reminders, review quarantine, and download factual reports and response ledgers.

The application uses React and TanStack Start with Hono in one Cloudflare Worker and D1 for durable storage. Native emailed operator sign-in and mail delivery use maintained Base source. Source: [just-every/pencil](https://github.com/just-every/pencil). License: [MIT](LICENSE).

## Install and run

Use Node 26.8.1 and pnpm 10.12.4 for the verified toolchain (Node >=22.12 is declared).

```sh
pnpm install --frozen-lockfile
pnpm run setup
pnpm dev --host 127.0.0.1 --port 15621 --strictPort
```

Open `/signin`, enter `owner@aurora-coffee.test`, and follow the link in the local inbox. Setup creates local D1 state and synthetic sample data. Local mail and sample initialization are restricted to explicit loopback development. Configuration generation preserves existing owner configuration.

## Verify and deploy

Install the native test browser once with `pnpm exec playwright install chromium --only-shell`. `pnpm verify` runs types, unit and native Worker tests, the unchanged load workload, data roundtrip/refusal checks, migrations, manifest, source boundaries, build and contract coverage with native desktop/mobile browser journeys. Run `pnpm source:check` after committing intended changes. See [operations](OPERATIONS.md) for export and restore, and [hosting](docs/HOSTING.md) for explicit Cloudflare resource and mail configuration.

The first-release profile defers exactly AUD, ANLY, ACT and NOTIFY. Their 33 TODO clauses remain visible and `pnpm verify:contract:full` remains unsatisfied. All baseline and other product clauses remain active. Local verification does not establish hosted capacity, provider inbox delivery or deployment acceptance.

Migration `0010_base_operator_auth.sql` imports operator identities and revokes legacy links and sessions, signing existing operators out. Export first, configure Base mail and the session secret, then have operators sign in again. Recovery restores a private export to a new database without replaying mail. Read [release scope](docs/FIRST-RELEASE.md), [current state](HANDOVER.md), [requirements](CONTRACT.md) and [security baseline](BASELINE.md) before adapting the product.
