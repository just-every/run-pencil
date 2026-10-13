# Native import custody

The server import adapter uses the kit's explicit 2 MiB transport policy, while
retaining the ten-record batch cap and all admitted file, question and response
limits. A single large form is never split into partly visible native entities.
Its safe normalized SQL values enter private indexed custody before one guarded
SQL transaction publishes its complete native tables, provenance and checkpoint.

The separate `nativeImportStagingSchema` export adds an anonymous monotonic clock,
per-target mutation stamps and temporary publication fences. Apply it together
with the maintained kit's `d1NativeStagingSchema` in a new product migration.
Existing imported targets receive stamps without rewriting their native content.
Ordinary native targets are not stamped. Every relevant imported native mutation
advances its stamp; deleting a response or form removes that target's stamp.
The anonymous one-row clock remains to prevent delete/recreate revision reuse.

Exact native checks precede installation of a known publication receipt. Native
writes and direct stamp changes invalidate that receipt. After all publication
fences and private value rows are removed, read-only receipt and current-session
checks close the transaction. Nothing mutates after those final checks.

An interrupted request can leave private values without native progress. Their
complete source/target hash index exists before any payload. The current owning
operator can resume or cancel them through the importer. Destination privacy
erasure removes matching private generations across importing operators together
with source and target tombstones. Private generations are not public jobs, and
stale writers cannot publish after cancellation, erasure or a winning retry.

The schema export belongs only to server migration setup. Browser importer modules
do not export native SQL, crypto, compression or custody implementation.

The exact stored-row checks also cover new provenance, source claims, decisions,
journal rows and original-file metadata. A fitting transaction checks its
expected state again after assertion cleanup. A staged transaction installs its
receipt only after those comparisons, then verifies it after all cleanup.

Response erasure retains normalized replacement values privately if needed, and
publishes native deletion, complete custody redaction and tombstones together.
An interruption leaves the public response and custody unchanged. Retry uses
current destination privacy authority; cancellation removes only the requesting
operator's private erasure generation. The file-derived namespace and native IDs
identify one admitted import; reviewing or replaying the same files reuses its
public custody rather than creating additional copies.
Creation also checks that namespace ownership inside every publication
transaction, so two operators racing the same files cannot publish two copies.
