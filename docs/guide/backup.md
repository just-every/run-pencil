# Backup and restore

A Pencil backup is one `.rer` archive containing your installation's product data as JSON. It includes personal data and answers, but excludes credentials, active sessions, captured mail and private settings; keep your deployment secrets separately.

You can make one from a local copy of Pencil and restore it into a new, empty local database. Make one before every upgrade and before you move to a new host. The `rer` commands use local data; Pencil's separate owner recovery command handles deployed D1 databases. See [Back up a deployed database](#back-up-a-deployed-database).

Hosted recovery requires stopping every route, schedule and other writer, and separately provisioning an empty migration-only D1 target with matching source and migration history. The recovery script does not provision that target, and an ordinary `rer deploy` claims an owner and makes it nonempty. Read the [hosted restore requirements](#to-a-deployed-database) before relying on a hosted move. This page covers what a backup holds, how to make and restore one, and how to check the result.

Backups are made from the command line. The **Export JSON** and **Export CSV** buttons on a results page are different. They download the responses to one flow for analysis and are not a backup.

## What a backup holds

The archive contains these product records, subject to the exclusions and redactions below:

- Operators, workspace settings, your branding and your logo, byte for byte.
- Flows, revisions, steps, choices and answer paths, with their stable IDs.
- Every response and answer, including quarantined ones and their state.
- Contacts with custom fields and consent state, saved segments, frozen launch audiences and evaluated policies, invitations and the history of every delivery attempt, including failed and unknown ones.
- The audit log, the counters behind your starts and drop-off figures, notification choices and delivery history, and analysis notifications.
- Analysis runs and their evidence links, draft rewrite sources and decisions, and AI usage records.
- Actions with their history, frozen evidence figures, measurements, external task deliveries and every attempt.
- Operators and linked sign-in identities, so restored operators can sign in again with a fresh emailed link. Every Pencil operator has equal access.

Some things are left out or changed on purpose:

- **Your secrets are never collected.** Keep your `SESSION_SECRET`, mail provider key, setup token and any `TASK_API_KEY` somewhere safe yourself. After a restore, set them again.
- **Everyone signs in again.** Sign-in sessions, sign-in and invitation links, step-up confirmations and API credentials are never exported, and a restore refuses an archive that holds one. No cookie or link from before the backup works on the restored installation, even with the same `SESSION_SECRET`, so a sign-out or revocation made after the backup stays in force. People who were invited but had not accepted stay listed as invited; invite them again to send a new link. Respondents part-way through a form start it again.
- **Personal invitation and opt-out links do not survive.** Their plaintext is removed from the archive, so links you already emailed stop working after a restore. Invitations and reminders that were still waiting are never sent, and stay listed as pending. Pencil cannot issue those people a new link for the same revision. To reach them again, publish the flow again and queue them for the new revision. See [Invitations, reminders and consent](invitations.md#send-invitations).
- **Local outbox messages are not exported.** Those are synthetic development mail. Your private settings are not exported either.
- **Original files from an import are not kept.** Only the reviewed result and its record are.
- **Old responses never email anyone.** Existing responses are marked so that restoring cannot send new-response mail about them.

Restoring never sends any mail or external task, and never changes a delivery that was sent, failed or unknown back to pending. An external task that was unknown stays unknown until an operator retries it.

## Keep the archive private

An archive holds personal data and answer text. Pencil creates it readable by you only. Keep it in the `exports` folder inside your copy, which Git ignores, or in another private folder, and keep the file as carefully as you would keep the data itself. Create the folder once, readable by you only:

```sh
mkdir -m 700 exports
```

Each backup goes to a new file. Pencil never replaces a file, so a second backup to the same name is refused. Put the date in the name, such as `install-2026-10-10.rer`.

When a backup or restore finishes, the command prints a short JSON result that includes the archive's `sha256`, which identifies its content, and the number of rows it holds. Keep the `sha256` with the file. You compare it when you check a restore.

**Use the same version of Pencil throughout.** An archive records the database migrations of the source that made it, and only that same source can restore it. Any other refuses with `[MIGRATION_MISMATCH]`. Run backups from the source you use, and note its commit beside the archive.

## Back up a local copy

Stop `dev` or `preview` first. From the checkout:

```sh
rer dev --stop
rer preview --stop
rer export --output exports/install-2026-10-10.rer
```

Pencil finds your local database itself. You do not name it.

## Back up a deployed database

Use the matching source checkout and its maintained owner recovery command. The public `rer export --target remote` and `rer import --target remote` commands still refuse remote transfer. The separate command below accepts the deployment kit's `_rer_deploy_migrations` ledger and Wrangler's `d1_migrations` ledger; it refuses mixed, incomplete or changed history. Source and destination must use the same ledger kind and the exact same migration bytes.

**Released 0.2.0 installations:** this source’s recovery command does not establish compatibility with the old 0019 migration hash. Retain your existing source and database and use only a supported matching-version backup path. Do not edit ledger hashes or archives, or treat restore as a workaround for the [blocked hosted upgrade](hosting.md#upgrading). The current-version recovery proof is separate.

Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in your private shell environment. Use the actual source D1 ID from `.rer/deploy/production.json` (or your chosen environment's receipt), and a token authorized for that account's D1 database. The recovery command reads these values from its environment; none belongs in its arguments, archive or a commit.

Stop every database writer as described below, then:

```sh
node scripts/deployment-data-cli.mjs export --output exports/deployed.rer --writers-stopped
```

`--writers-stopped` confirms that you stopped the Worker, schedules and any other process that writes this database. The exporter also checks D1 consistency bookmarks and primary reads, and refuses if the source changes. This creates the same redacted archive described above, including import custody, the erasure checkpoint and delivery history.

The recovery command is verified against a local Cloudflare API stand-in using the installed deployment kit and real SQL. This is not a live-account recovery acceptance result. In the older October 13 hosted run, the previous exporter refused the kit ledger; a raw Wrangler dump restored only after its SQL was manually regrouped. That workaround did not produce a redacted Pencil archive. Raw D1 exports and Time Travel remain provider tools with their own semantics.
Your running Worker writes to the database as it works: visits to public pages and signed-in pages record rate-limit counters and sessions, and its schedule runs every minute. Pause every writer for the length of the backup. Pencil has no command that pauses a Worker while preserving its database. In the Cloudflare dashboard, turn off its `workers.dev` address, remove its Cron trigger, disable any custom-domain or route access, and stop any other writer to that D1 database. Wait for in-flight work to finish. Your forms, sign-in and `/health` remain unreachable until you restore their routes. Afterwards, restore the routes and Cron trigger or deploy again. Do not use `rer deploy --remove --yes` for this: it deletes the database as well as the Worker.

## Restore into a new database

A restore only ever goes into an empty database. It refuses a database that already holds data. It never overwrites or merges, so a restore cannot replace the data in your running installation.

> [!WARNING]
> A restore brings back everything as it was when the archive was made. Responses, contacts and custom fields you erased since then come back with their archived consent state, and opt-outs recorded since then are lost. The import command prints a reminder. After restoring an older archive, erase those people and responses again and record those opt-outs again. Erasing in Pencil never reaches copies outside it, such as older archives and response exports. See [Privacy and security](privacy.md#keeping-and-erasing-data).

### Refuse an archive made before an erasure

Every erasure (a response, imported or not, and a recipient) advances an erasure count that travels in every later archive. If you still have a later archive of the same installation, name it with `--journal` when you restore an older one:

```sh
rer import --input exports/install-2026-10-01.rer --journal exports/install-2026-10-10.rer --yes
```

When anything was erased between the two archives, the restore is refused whole with `Restore refused (erasure_epoch)` and exit code 4, and nothing is written; restore the later archive instead. A `--journal` archive from another installation, or one older than the archive you restore, is refused with `later_journal`. Without `--journal` the older archive restores as described above.

### Locally

In a fresh clone of the matching source, install dependencies, copy your archive into the private `exports` folder, then import **before setup or build**. The committed runtime configuration lets import apply the schema without either step. Setup afterwards preserves the restored owner; use that owner’s email:

```sh
rer install
rer import --input exports/install-2026-10-10.rer --yes
rer setup --owner-email you@example.com --owner-name "Your Name"
```

For a previously used destination, stop `dev` and `preview`, export anything you need, and run `rer reset --yes` before importing. Reset removes the existing local data.

Restore before setup. Give setup the email of the owner you had when you made the archive, then start `rer dev` and open its private `RER_OPEN` owner link. `import` checks the whole archive before it writes anything and restores in one step. `--yes` confirms the restore. It never sends mail.

### To a deployed database

Use an empty D1 target with the same source, deployment kit and migration-ledger kind. It must contain only its fully applied migrations and their initialization rows. Keep its Worker routes, schedules and other writers stopped throughout recovery. The recovery command does not provision this target. A normal `rer deploy` automatically claims an owner, making its database nonempty, so it is not an empty restore target; do not delete owner records to bypass that guard. Provisioning and attaching a migration-only D1 target requires a deployment procedure appropriate to your installation. Keep the previous deployment and database available until you have verified recovery.

Change `CLOUDFLARE_DATABASE_ID` to the new empty target's actual D1 ID, then:

```sh
node scripts/deployment-data-cli.mjs import --input exports/deployed.rer --yes --writers-stopped
node scripts/deployment-data-cli.mjs export --output exports/deployed-restored.rer --writers-stopped
```

Both commands must print the same `sha256` as the source export. A second restore refuses before writing any application data. A later archive can fence an old backup against erasure with `--journal exports/later.rer`; that check runs before any target request.

Restore validates the whole archive, stages inert tables in bounded batches, verifies their contents, then publishes atomically under repeated empty-target guards. It dispatches no mail. If it reports `RESTORE_STATE_UNCONFIRMED`, keep writers stopped and inspect the target. For a recognized incomplete stage belonging to that archive, use:

```sh
node scripts/deployment-data-cli.mjs cleanup --input exports/deployed.rer --yes --writers-stopped
```

Cleanup removes only a matching inert restore stage. If the result is `RESTORE_VERIFICATION_UNCONFIRMED`, publication already completed: re-export and compare before retrying; cleanup cannot undo publication.

After archive equality is confirmed, reconfigure private secrets and re-enable the Worker. Check it as described in [Hosting on Cloudflare](hosting.md#check-that-it-works): open `/health`, sign in with a fresh emailed link, open a public form, and inspect responses, quarantine and delivery history.
## Check the restored data

Before you start `dev` on a restored local copy, export it to a new file and compare:

```sh
rer export --output exports/restored-check-2026-10-10.rer
```

The `sha256` it prints must be the same as the one the restore printed. Once the restored installation runs, rate-limit counters and other activity from your checks change later exports. That is expected.

## When to make a backup

- Before any upgrade of Pencil. Apply the new source only after you hold a good archive.
- Before moving to another host or Cloudflare account.
- On a regular schedule you choose. Pencil never deletes your data on its own: only sign-in sessions, respondent sessions (after 30 days) and rate-limit counters expire. A backup protects you from your own mistakes, a lost account or a failed upgrade.

For bringing forms in from another builder, see [Moving in](moving-in.md).
