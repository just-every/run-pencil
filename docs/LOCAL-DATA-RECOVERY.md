# Local Pencil data recovery

This is the verified recovery path for Pencil's current native local D1/Miniflare
database. It preserves every current application table, stable ID, raw answer,
quarantine state, retained metric, auth record, audit fact, outbox state and local
fixture marker, plus Wrangler's applied-migration ledger. Export is a consistent
read-only transaction. Import creates a new database and leaves existing paths
untouched. Neither command starts a runtime or dispatches an effect.

## Commands

Use `pnpm run import` explicitly: `pnpm import` is pnpm's lockfile-import command.
The data commands accept explicit filesystem paths and require the existing
Pencil migrations to match exactly. Run them in this edition repository.

```sh
pnpm run export -- --database SOURCE.sqlite --output PRIVATE-ARCHIVE.json
pnpm run import -- --archive PRIVATE-ARCHIVE.json --database NEW.sqlite
pnpm run export -- --database NEW.sqlite --output ROUNDTRIP-ARCHIVE.json
pnpm verify:data
```

The JSON output reports only format, content digest, table/record counts and
whether effects were dispatched. Matching content digests establish that the
current-data contents round-trip; archive bytes also match. Files are created
with mode 0600. No existing archive or database file, including an empty file or
symlink, can be replaced. A missing parent directory is an error.

To locate the local source file without guessing a binding identity:

```sh
rg --files --hidden --no-ignore .wrangler/state/v3/d1/miniflare-D1DatabaseObject -g '*.sqlite'
```

Choose the file for Pencil's declared `pencil-local` binding. A different schema
or migration history is refused. Keep archives in a private location outside
Git, or the ignored `.pencil-backups/` directory. They contain sensitive answer
and authentication records, including local development inbox tokens. They are
not encrypted. Credentials from environment configuration and static build
assets are not database records and need their own owner-controlled custody.

## Use with an isolated local runtime

For the same binding and existing Wrangler configuration, place the new file
under a new state directory with the same source storage filename:

```text
NEW-STATE/v3/d1/miniflare-D1DatabaseObject/SOURCE-STORAGE-FILENAME.sqlite
```

Create only the new directories, then pass that previously nonexistent filename
to `pnpm run import`. Keep the original state directory intact. The storage
filename identifies the local binding; a renamed arbitrary SQLite file is not
automatically selected by Wrangler. Rebinding to a different configuration needs
its own verified mapping.

```sh
CI=1 WRANGLER_SEND_METRICS=false pnpm exec wrangler d1 migrations apply pencil-local --local --persist-to NEW-STATE --config wrangler.toml
pnpm exec wrangler dev --config dist/server/wrangler.json --local --persist-to NEW-STATE --port 15621 --inspector-port 15658 --ip 127.0.0.1
```

Use only ports allocated to this owner. The migration command must report no
migrations to apply. Re-export before starting the runtime and compare digests.
After startup, native auth, public documents, the ledger/results and quarantine
must be checked. Starting or signing into the runtime can legitimately create
new sessions, rate-limit windows and local mail rows, so those later exports
will differ. The retained fixture marker prevents silent sample reinitialization.

## Integrity and exact scope

The archive has a strict versioned schema and a SHA-256 content digest. The
digest detects changes; it does not authenticate an untrusted sender. Import
never executes archive SQL. It builds the database from this repository's
committed migrations, checks the complete table/column inventory and schema,
restores all cells into an in-memory database, checks constraints and foreign
keys, and verifies a full round-trip before touching a target path. A second
private staging database is verified and closed before atomic exclusive
publication. A target appearing during staging is preserved.

Text is exact, including whitespace, Unicode and embedded nulls. SQLite storage
types are explicit: null, text, signed 64-bit integer, finite real and blob.
Out-of-range integers, non-finite numbers, corrupt content, incomplete migration
ledgers, unknown application tables and incompatible migration histories fail.
Only SQLite internal tables and the known provider `_cf_METADATA` table are
outside application inventory; the migration ledger is retained separately.

Auth revocation, consumed links, expiry timestamps and outbox attempts remain as
recorded at export time. Later revocations are not present in an older backup.
Completed response receipts intentionally survive removed session rows; historical
audit actors can name operators removed earlier. Restore preserves those
accepted relationships rather than inventing new foreign keys or regenerating
tokens. No pending effect is reset or sent by import.

Run `pnpm verify:data` for full-data roundtrip and refusal checks. These commands operate on explicit local SQLite files. Remote D1 backup/export and restoration are explicit Cloudflare operations. Upload questions and attachments are not implemented. Deferred AUD, ANLY, ACT and NOTIFY obligations remain visible in the full-contract gate.
