# Whole-install data recovery

Pencil exports the complete migrated installation as typed JSON. The public
rer commands restore locally with the same committed migrations. Export
before upgrades, keep the original installation available for recovery, and
verify the new database before changing the running application's binding.

## Archive custody

Choose an existing private directory outside every repository or this checkout's
ignored `exports` directory (mode 0700). Export creates one new file with mode
0600 and refuses existing files. Other repository paths and symlinks into
repositories are rejected, even when Git would ignore the file.
The archive contains personal data, answer text and identities. Keep it
private. The digest detects changes; it is not a signature and
does not authenticate an untrusted sender.

Environment secrets are never collected. Reconfigure `SESSION_SECRET`, mail
provider credentials and other deployment secrets independently. Sign-in
authorization never travels: sessions, sign-in and invitation links, step-up
challenges, minted credentials and respondent resume tokens are excluded, and
import refuses an archive that holds one. After a restore everyone signs in
again with a fresh emailed link, whatever the session secret. Bootstrap ownership and invitation
cancellations remain durable, so setup cannot create a second first owner.

The explicit table/column classification in
`scripts/deployment-data-policy.mjs` fails closed on unreviewed schema additions.
Every application table remains in the archive inventory. The migration ledger
is retained separately; only SQLite internal tables and `_cf_METADATA` are
excluded. Column handling is intentional:

- Operator token/session hashes, expiry, consumption and revocation state remain.
- Plaintext participant invitation and opt-out tokens become null. Existing
  links using these capabilities do not survive restoration.
- Legacy local inbox tokens become empty text while metadata and counts remain.
  Captured local mail tables (`local_mail_outbox` and
  `rer_mail_development_outbox`) retain their required schema but export zero
  rows. Base messages require a real sender and nonempty recipient list;
  substituting empty addresses would create invalid messages. Excluding these
  private captures avoids both plaintext credentials and fabricated addresses.
  Their capture counts normalize to zero; durable delivery and attempt records
  remain in their separate tables.
- Import originals retain names, digests and sizes, while original bytes and
  transient staging bytes are redacted. Import lease credentials are cleared.
  Imported product records, their durable provenance and immutable native
  publication timestamps remain.
- Historical response notification eligibility becomes zero. Delivery statuses,
  attempt counts, timestamps, idempotency keys, provider names/codes and
  preferences remain unchanged.
  Restoring never resets sent, failed or unknown delivery states to pending.
- Workspace logo content is retained byte for byte. Structured answers, exact
  text, stable graph identifiers, revisions, quarantine and metrics remain.

Redaction happens during export and is idempotent. Re-exporting a restored
installation before starting the runtime produces exactly the same archive.
Archives containing non-redacted excluded credentials are rejected on import.


## Recovery commands

Use the public rer contract: create the private ignored exports directory (0700), run `rer export --output exports/installation.rer`, and verify the archive before changing installations. After explicitly confirmed `rer reset --yes`, restore into an empty canonical local database with `rer import --input exports/installation.rer --yes`. Then prepare fresh private settings with the retained owner's email and sign in through the Base outbox. Native credential hashes and owner records remain; plaintext credentials, captured mail and old notification eligibility do not. Public rer remote transfer is refused; the separate maintained owner command below handles deployed D1. Read OPERATIONS.md for effects and reset inventory.


## Deployed D1 recovery

From the exact deployed source checkout, set `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` privately. Stop all routes,
schedules and other writers before confirming `--writers-stopped`:

```sh
node scripts/deployment-data-cli.mjs export --output exports/deployed.rer --writers-stopped
```

Create an empty target with the same kit and migration bytes, stop its writers
before owner admission, and point `CLOUDFLARE_DATABASE_ID` at that target:

```sh
node scripts/deployment-data-cli.mjs import --input exports/deployed.rer --yes --writers-stopped
node scripts/deployment-data-cli.mjs export --output exports/restored.rer --writers-stopped
```

Require identical content digests before starting the restored runtime. Keep the
old database. The optional import `--journal exports/later.rer` applies the same
erasure fence as local restore before any target request. Cleanup of a recognized
incomplete inert stage uses `cleanup --input exports/deployed.rer --yes
--writers-stopped`; a completed publication is never rolled back by cleanup.

The archive retains the selected migration ledger, including the deployment
kit's name, SQL SHA-256 and applied state. Recovery validates its exact column
classification and constraints, every migration name and hash, and the complete
committed application schema. A legacy Wrangler ledger retains its original
IDs and timestamps. Both ledgers together, unknown columns, changed SQL hashes,
missing migrations and any applying/uncertain state refuse. Recovery does not
invent or convert one controller's ledger into another's.

Preparation and publication each repeat schema, history and empty-target guards
inside an atomic batch. Inert staging is bounded, checks its full digest before
publication, and preserves foreign keys, indexes and triggers. Repeated restore
refuses without writes. Source paging requires unchanged D1 bookmarks and primary
reads. Credential redaction, erased import custody, stable form links and durable
delivery history use the same archive policy as local recovery. No scheduled or
mail work runs during restore.

The installed `@runeditrun/rer` 0.2.1 kit and app routes were exercised through a
local provider-edge stand-in; this proves the maintained recovery path locally,
not hosted acceptance. The earlier hosted raw Wrangler dump needed manual SQL
regrouping and was not a redacted archive. Do not use that workaround as evidence
for this command. Public `rer ... --target remote` remains unsupported by the
current Pencil adapter; no Base changes or provider account calls were needed
for the separate command.
