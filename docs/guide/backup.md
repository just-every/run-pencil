# Backup and restore

A Pencil backup is a `.rer` file containing your installation’s product data. It includes personal data and answers. Keep it private, and keep your deployment secrets separately.

On a hosted copy, the owner opens **Backup** in the signed-in workspace. It downloads a consistent copy while your forms stay open and checks the saved file. Choose **Test restoration** on that same page to restore the saved file into a new, empty database inside your browser and check identical re-exported contents. No command or Cloudflare dashboard changes are needed for this test. Replacing a hosted deployment still needs your hosting maintainer; the page does not create or attach that replacement.

The **Export JSON** and **Export CSV** buttons on Results download one flow’s released responses. Those files are not complete backups.

## What a backup holds

The archive contains these product records, with the exclusions below:

- Operators, workspace settings, branding and your logo.
- Flows, revisions, steps, choices and answer paths, with stable IDs.
- Every response and answer, including quarantined answers and their state.
- Contacts, custom fields, consent history, saved segments, invitation audiences and delivery history.
- Audit history, starts and drop-off counters, notification preferences and delivery history.
- Analysis runs, evidence links, draft rewrite sources and decisions, and AI usage.
- Actions, measurements, external task deliveries and their attempts.
- Import results, custody and erasure history.

Some things are left out or changed on purpose:

- **Keep your secrets separately.** Mail provider keys, session secrets and private integration settings are not included. Reconnect integrations after restoring.
- **Everyone signs in again.** Sign-in sessions, sign-in links, invitation credentials, API credentials and other active authorization are excluded. A restore cannot revive an old signed-out session. Respondents part-way through a form start again.
- **Personal invitation and opt-out links do not survive.** Links emailed before restoration stop working. Unsent invitations stay pending and are not sent again; publish a new revision to invite those people again.
- **Captured development mail and original import files are excluded.** The reviewed import result and its custody remain.
- **Old responses do not send new notices.** Historical notification eligibility is disabled. Queued analysis does not call a provider automatically after restoration.

Restoration never sends mail or external tasks. Sent, failed and unknown delivery outcomes remain as recorded.

## Keep the archive private

Browser downloads follow your browser’s download location and file permissions. Move them to a private folder. Command-line archives are created readable only by you. Inside the source checkout use its Git-ignored `exports` directory:

```sh
mkdir -m 700 exports
```

Give retained backups different names, such as `pencil-2026-10-16.rer`. Command-line tools refuse existing output files. Your browser may choose a numbered filename when you download again.

Use the same version of Pencil to create, check and restore an archive. Save the source version alongside the backup. A different database history is refused; do not edit the archive or its checksum to bypass this.

## Back up a deployed database

1. Sign in as the installation owner and choose **Backup**, or open `/app/backup` on your copy.
2. Choose **Download backup**. Your forms can stay open. No Cloudflare dashboard changes or account token are needed.
3. Under **Check the saved file**, choose the downloaded `.rer` file and press **Check backup**.
4. Wait for **Backup contents checked**. Pencil shows its record count and checksum. It checks the checksum, version, complete table inventory, privacy rules and linked records.
5. Choose **Test restoration**. Pencil restores the saved file into a new browser database, checks its constraints and linked records, and compares the re-exported contents with your archive. Wait for **Restoration passed** before relying on this backup. The test database is discarded afterwards; your running workspace is unchanged.

Browser downloads are limited to 8 MiB, with a conservative workspace-size guard so an oversized export is refused before reading a large result into memory. No truncated file is published. If you see a size-limit message, use [Large-workspace export](#large-workspace-export).

## Large-workspace export

Larger workspaces need the streaming maintainer command, which requires Cloudflare credentials and a paused source. Ask your hosting maintainer to follow [Large-workspace export in the hosting reference](../HOSTING.md#large-workspace-export). This remains a technical operation; Pencil does not currently complete it from the Backup page.

## Back up a local installation

Stop local servers before exporting:

```sh
rer dev --stop
rer preview --stop
rer export --output exports/pencil-backup.rer
```

These `rer` commands operate on your local installation only. They do not download the hosted database.

## Restore into a new database

A restore never overwrites or merges with a running workspace. Keep the original installation and backup until you have checked the replacement.

A backup made before an erasure can bring erased people and answers back. Make a new backup after erasing data or recording opt-outs. Erasing inside Pencil cannot remove older copies you saved elsewhere. See [Privacy and security](privacy.md#keeping-and-erasing-data).

### Test a hosted or local backup

On the **Backup** page, select the saved file and choose **Test restoration**. The test runs real SQLite in your browser, from files served by your Pencil installation. The selected file stays in your browser during restoration; no archive data is sent elsewhere. It checks integrity and foreign keys and requires an identical checksum after re-export. No mail or external task is sent.

If you have a newer backup of the same installation, select it under **Newer backup for erasure protection** before testing an older archive. A later erasure causes the older archive to be refused. Without a newer file, Pencil cannot know about erasures made since the backup.

### Optional test on your computer

For archives beyond the browser limit, or an independent test, on your computer, open the source version that made the archive. Install its dependencies with `rer install` if needed. Use Node.js 22.20 or later. Save the download as `exports/pencil-backup.rer`, then run from the checkout’s folder:

```sh
node scripts/deployment-data-restore-test.mjs --input exports/pencil-backup.rer --output exports/restore-test.sqlite
```

This creates a new local database, restores all records, checks database constraints and exports it again. Success prints `"ok":true`, `"restored":true` and identical `sha256` and `reexportSha256` values. It never sends mail. It refuses an existing output; use a new filename for each test.

This test accepts hosted archives without changing their database history. Its SQLite output is for the test; it does not start a local Pencil server or replace your hosted deployment. The browser’s **Test restoration** performs the same kind of real restoration and comparison in a disposable browser database.

### Refuse an archive made before an erasure

If you have a newer backup from the same installation, add it as the journal when testing an older one:

```sh
node scripts/deployment-data-restore-test.mjs --input exports/older.rer --journal exports/newer.rer --output exports/restore-test.sqlite
```

If erasure occurred between the archives, the restore is refused before creating the output. Use the newer archive. A journal from another installation or an older journal is also refused. Without a later journal, the command cannot know about erasures made after the backup.

### Locally

For an archive created by local `rer export`, use a fresh matching-source checkout and restore before setup:

```sh
rer install
rer import --input exports/pencil-backup.rer --yes
rer setup --owner-email you@example.com --owner-name "Your Name"
rer dev
```

Use the archived owner’s email. Open the private `RER_OPEN` link that dev prints. For a previously used destination, stop dev and preview, export anything you need, and `rer reset --yes` before importing. Reset removes existing local data.

Hosted archives use a different database controller and cannot be assumed to work with local `rer import`. Use the restore-test command for those files.

### To a deployed database

**The Backup page does not currently create a hosted replacement.** A hosting maintainer must provision and attach a compatible empty target through a supported deployment procedure. Keep your original deployment until the replacement is restored and checked. Do not remove it merely because the browser file check passed.

The [maintainer hosting reference](../HOSTING.md#hosted-replacement-boundary) explains the current boundary and the commands for a target that has already been provisioned. The browser or local restore test proves the archive can restore; it does not activate a hosted replacement.

## Check the restored data

Both the browser restoration test and the optional restore-test command compare archive checksums automatically. For a local `rer import`, before starting dev, re-export to a new filename:

```sh
rer export --output exports/restored-check.rer
```

Require the same `sha256` as the original. Starting Pencil creates normal session and rate-limit activity, which changes later backups. After activating a replacement, sign in again, inspect forms, answers, quarantine and delivery history, then check a public form.

## When to make a backup

- Before upgrading or moving Pencil.
- Before removing a deployment.
- After recording erasures or opt-outs, so your newest backup preserves them.
- On a regular schedule you choose.

For bringing forms from another builder, see [Moving in](moving-in.md).
