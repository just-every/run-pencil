# Backup and restore

A Pencil backup is one `.rer` archive containing JSON that holds your whole installation. You can make one from a local copy of Pencil and restore it into a new, empty local database. Make one before every upgrade and before you move to a new host. Pencil's own commands work on a local copy only; for a deployed database, see [Back up a deployed database](#back-up-a-deployed-database). This page covers what a backup holds, how to make and restore one, and how to check the result.

Backups are made from the command line. The **Export JSON** and **Export CSV** buttons on a results page are different. They download the responses to one flow for analysis and are not a backup.

## What a backup holds

The archive contains every record Pencil keeps:

- Operators, workspace settings, your branding and your logo, byte for byte.
- Flows, revisions, steps, choices and answer paths, with their stable IDs.
- Every response and answer, including quarantined ones and their state.
- Contacts with custom fields and consent state, saved segments, frozen launch audiences and evaluated policies, invitations and the history of every delivery attempt, including failed and unknown ones.
- The audit log, the counters behind your starts and drop-off figures, and each person's notification choices.
- Actions with their history, frozen evidence figures, measurements, external task deliveries and every attempt.
- Sign-in credential hashes, so restored operators can sign in with a fresh emailed link.

Some things are left out or changed on purpose:

- **Your secrets are never collected.** Keep your `SESSION_SECRET`, mail provider key, setup token and any `TASK_API_KEY` somewhere safe yourself. After a restore, set them again. Using the same `SESSION_SECRET` keeps the restored credential hashes usable. A different one invalidates them, though emailed sign-in still works.
- **Personal invitation and opt-out links do not survive.** Their plaintext is removed from the archive, so links you already emailed stop working after a restore. Invitations and reminders that were still waiting are never sent, and stay listed as pending. Pencil cannot issue those people a new link for the same revision. To reach them again, publish the flow again and queue them for the new revision. See [Invitations, reminders and consent](invitations.md#send-invitations).
- **Local outbox messages are not exported.** Those are synthetic development mail. Your private settings are not exported either.
- **Original files from an import are not kept.** Only the reviewed result and its record are.
- **Old responses never email anyone.** Existing responses are marked so that restoring cannot send new-response mail about them.

Restoring never sends any mail or external task, and never changes a delivery that was sent, failed or unknown back to pending. An external task that was unknown stays unknown until an operator retries it.

## Keep the archive private

An archive holds personal data, answer text and credential hashes. Pencil creates it readable by you only. Keep it in the `exports` folder inside your copy, which Git ignores, or in another private folder, and keep the file as carefully as you would keep the data itself. Create the folder once, readable by you only:

```sh
mkdir -m 700 exports
```

Each backup goes to a new file. Pencil never replaces a file, so a second backup to the same name is refused. Put the date in the name, such as `install-2026-10-10.rer`.

When a backup or restore finishes, the command prints a short JSON result that includes the archive's `sha256`, which identifies its content, and the number of rows it holds. Keep the `sha256` with the file. You compare it when you check a restore.

**Use the same version of Pencil throughout.** An archive records the database migrations of the source that made it, and only that same source can restore it. Any other refuses with `[MIGRATION_MISMATCH]`. Run backups from the source you use, and note its commit beside the archive.

## Back up a local copy

Stop `dev` or `preview` first. Then:

```sh
rer export --output exports/install-2026-10-10.rer
```

Pencil finds your local database itself. You do not name it.

## Back up a deployed database

Pencil's own `export` and `import` commands work on a local copy and refuse a deployed database. To keep a copy of a deployed database, use Cloudflare's own D1 tools, such as Time Travel and `wrangler d1 export`, and keep the previous deployment until you have checked a new one. Those are Cloudflare's tools, not Pencil's: Pencil does not check an archive made that way, and it does not leave out secrets or personal invitation links for you.

Your running Worker writes to the database as it works: visits to public pages and signed-in pages record rate-limit counters and sessions, and its schedule runs every minute. If you are about to move your data, stop the Worker for the length of the backup. Pencil has no command for this. Use the Cloudflare dashboard: in your Worker's settings, turn off its `workers.dev` address and remove its Cron trigger. Your forms, sign-in and `/health` are unreachable until you turn them back on. The database is not touched. Afterwards, turn both back on in the dashboard, or deploy again.

## Restore into a new database

A restore only ever goes into an empty database. It refuses a database that already holds data. It never overwrites or merges, so a restore cannot replace the data in your running installation.

> [!WARNING]
> A restore brings back everything as it was when the archive was made. Responses, contacts and custom fields you erased since then come back with their archived consent state, and opt-outs recorded since then are lost. The import command prints a reminder. After restoring an older archive, erase those people and responses again and record those opt-outs again. Erasing in Pencil never reaches copies outside it, such as older archives and response exports. See [Privacy and security](privacy.md#keeping-and-erasing-data).

### Locally

In a fresh clone of the matching source, install dependencies, copy your archive into the private `exports` folder, then import **before setup or build**. The committed runtime configuration lets import apply the schema without either step. Setup afterwards preserves the restored owner; use that owner’s email:

```sh
rer install
rer import --input exports/install-2026-10-10.rer --yes
rer setup --owner-email you@example.com --owner-name "Your Name"
```

For a previously used destination, stop `dev` and `preview`, export anything you need, and run `rer reset --yes` before importing. Reset removes the existing local data.

Restore before setup. Give setup the email of the owner you had when you made the archive, then sign in again through the local outbox. `import` checks the whole archive before it writes anything and restores in one step. `--yes` confirms the restore. It never sends mail.

### To a deployed database

Pencil's commands do not restore into a deployed database. Hosted recovery is a separate step that is not part of Pencil's commands: restore with Cloudflare's own D1 tools into a new, empty database, deploy the source that matches the backup against it, and keep the previous database until you are sure. Check it as described in [Hosting on Cloudflare](hosting.md#check-that-it-works): open `/health`, sign in with a fresh emailed link, open a public form, and look at your response ledger, your quarantine queue and your delivery history.

## Check the restored data

Before you start `dev` on a restored local copy, export it to a new file and compare:

```sh
rer export --output exports/restored-check-2026-10-10.rer
```

The `sha256` it prints must be the same as the one the restore printed. Once the restored installation runs, sessions and rate-limit counters from your checks change later exports. That is expected.

## When to make a backup

- Before any upgrade of Pencil. Apply the new source only after you hold a good archive.
- Before moving to another host or Cloudflare account.
- On a regular schedule you choose. Pencil never deletes your data on its own: only sign-in sessions, respondent sessions (after 30 days) and rate-limit counters expire. A backup protects you from your own mistakes, a lost account or a failed upgrade.

For bringing forms in from another builder, see [Moving in](moving-in.md).
