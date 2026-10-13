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
The archive contains personal data, answer text, identities and credential
hashes. Keep it private. The digest detects changes; it is not a signature and
does not authenticate an untrusted sender.

Environment secrets are never collected. Reconfigure `SESSION_SECRET`, mail
provider credentials and other deployment secrets independently. Preserving the
same session secret allows retained keyed credential hashes to remain usable;
changing it invalidates those credentials. Fresh emailed operator sign-in still
works after restoring identities. Bootstrap ownership and invitation
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

Use the public rer contract: create the private ignored exports directory (0700), run `rer export --output exports/installation.rer`, and verify the archive before changing installations. After explicitly confirmed `rer reset --yes`, restore into an empty canonical local database with `rer import --input exports/installation.rer --yes`. Then prepare fresh private settings with the retained owner's email and sign in through the Base outbox. Native credential hashes and owner records remain; plaintext credentials, captured mail and old notification eligibility do not. Public remote transfer is refused. Read OPERATIONS.md for effects and reset inventory.
