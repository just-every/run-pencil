# sd-pencil-c-f54 results

RSLT-004 remains PARTIAL. The selected original-controller pre-device recovery chain is complete and independently passed on d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85. This is already the landed predecessor commit on main, so no replay, new product commit, registration, production edit, UI edit or contract edit was needed. No acceptance point or status cell changed. Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. No other campaign row was changed.

Product branch: cloud/sd-pencil-c-f54. Published head: d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85. Main and the published branch were both read back at that exact head. No PR is required: the existing workflow accepts cloud branches. No workflow was changed, dispatched or rerun. All candidate identity and trailer checks passed; the candidate range beyond origin/main is empty, and the head author and committer are the fleet identity. No empty commit was created.

## Plan and execution

The complete plan is in PLAN.md. The launcher, fleet Git setup, commit cleanup hook and checkout toolchain were installed. The full-history clone started at the predecessor commit, so a rebase against freshly fetched main was a no-op. The helper, release provenance resolver, historical fixture, original archive controller, current migration adapter, archive registration and its existing Verify entry point were inspected. All local checks passed. The named product branch was published through the provided cloud push guard on its first attempt; source and index remained clean. The evidence packet is separate from the product tree.

## Selected POINTS proof

The single existing registration is scripts/deployment-data.check.mjs, test "complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites" (lines 272 to 277). Its focused subcase is "original pre-device controller restores populated history before the trusted current upgrade" in scripts/deployment-data-pre-device-proof.mjs. It runs with every prior archive subcase retained.

| Selected outcome | Result and location |
| --- | --- |
| Resolve an authentic pre-device source and original controller | PASS. RELEASE.json declares predecessor 0.6.0; scripts/release-upgrade-inputs.mjs resolves local v0.6.0, requires ancestry, pins source commit 4ccc2364080cd822c6a12662c1e191683a8fbe6b and compares released migration bytes. Helper lines 48 to 69 extract that original controller and require the predecessor's exact Zod version. No controller is synthesized. |
| Export populated historical responses and answers | PASS. Helper lines 74 to 103 initialize the original 51-migration database and use the compatible populated 0.6.0 fixture. Fixed assertions require one released and one quarantined response, two deliberate unequal answers, their revisions and two links. Responses have no device_class column. Existing native auth rows are populated before export and excluded from the archive. |
| Restore into a new database with the same trusted original controller | PASS. Helper lines 104 to 113 execute the original testRestore command handler with --input and --output. The current importer separately refuses the original inventory with INVENTORY_MISMATCH and creates no destination. |
| Prove exact re-export equality and retained relationships | PASS. Helper lines 109 to 122 compare the complete archive bytes and checksum, response and answer projections, stable-step and revision joins, and the original applied migration history. Integrity and foreign keys pass. |
| Upgrade using the trusted current path; retain honest unknown historical devices | PASS. Helper lines 123 to 145 invoke the installed deployment kit's migrate function through migrateKit, apply only the trusted current migration bytes, preserve original ledger rows and data, require both response device classes null, and require a second migration run to apply nothing. The current archive retains both nulls and the original backup remains unchanged. |
| Preserve credential custody, no resend, refusals and existing archive workloads | PASS for the touched registration. Helper restoredCustody lines 20 to 33 requires auth sessions and tokens absent, respondent tokens scrubbed, both responses and outbox entries notification-ineligible, while the old active session's mobile class remains separate. Existing archive subcases retain R2 bytes and metadata, complete current-data roundtrip, malformed input and target refusal, storage types and values, unknown table refusal and concurrent target protection. No prior assertion or workload was edited. |

Observed receipt: release 0.6.0; source commit 4ccc2364080cd822c6a12662c1e191683a8fbe6b; 51 original migrations; 78 current migrations; 2 responses; 2 answers; 2 retained links; exact re-export true; both historical response classes null; current importer refusal true. Archive SHA-256: 1874592c8f0839e4c797ffde27ea6dfb7a28018d4220978a64f6669b836444ab. The actual output and receipt are archive-proof.log and pre-device-receipt.json.

PROBE RSLT-004 1: original testRestore command handler with populated pre-device backup and new database, then trusted migrateKit -> identical original re-export, two retained response and answer relationships, both historical response device classes null, repeat migration applies nothing; current import refuses INVENTORY_MISMATCH with no target.

## Clause acceptance sentences and inherited duties

The clause has four prose acceptance sentences and no numbered list. The selected archive compatibility proof is an additional RL-104 engineering gap, rather than a new numbered acceptance sentence. The claim therefore uses points=none instead of relabeling archive recovery as the entire device-split requirement.

| Clause sentence or inherited duty | Evidence and scope |
| --- | --- |
| Results follow combined filters and name numerator and denominator | Existing evidence is tests/runtime/journey.worker.test.ts, tests/e2e/answer-results.spec.ts and tests/e2e/ledger-filters.spec.ts as recorded in CONTRACT.md. Not changed or locally rerun here; existing exact-head full push Verify 42544571644 succeeded. No new completion claim for this sentence. |
| Coarse session device class is response-linked, has no fingerprint and erases with the response | Existing native and browser evidence remains unchanged. The selected historical restore adds null legacy response-class proof without inferring the active session's mobile value. No broader new completion claim. |
| Revision-only session counts do not satisfy filtered response split | Existing combined-filter evidence is unchanged and covered by the same exact-head Verify; this round adds no result-query change. |
| Device class stays out of response exports | Existing export assertions remain unchanged. The private installation archive is the RL-104 exception only; this round adds no response CSV or JSON export field. |
| RL-104 and DATA-001 private restore archive exception | Locally PASS through the original-controller archive command and trusted migration flow above. Imported history gains no device inference or working auth credentials. General hosted replacement, activation, historical no-resend qualification and release holds remain unchanged. |
| BASE-OPS-002 predecessor migration and BASE-DATA-001 recovery | Existing graph archive contract registration invokes the touched node assertion script in Verify. The installed kit validates migration hashes; original history stays byte-identical, trusted current migrations apply once, and populated data and links survive. This does not qualify the unsupported released-0.2.0 hosted hash-ledger upgrade. |

## Checks and exact-head CI

- node --test scripts/deployment-data.check.mjs: PASS, 1 registration, 0 failures, 0 skips, about 55 seconds, full original workloads retained.
- pnpm typecheck: exit 0.
- npx -y @runeditrun/rer check --profile first-party: exit 0.
- node scripts/contract-docs.mjs write RSLT-004, then check RSLT-004: both exit 0; generated ACCEPTANCE.md and docs/CLAIMS.md restored from origin/main, no generated diff.
- node scripts/edition-authoring/cli.mjs lock: exit 0 and no changed lock bytes; pnpm source:check: exit 0, including offline Base integrity.
- No migration file added or edited; migration-ledger change check is not applicable. The runtime proof nevertheless validates original and upgraded ledgers and idempotent migration.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RSLT-004 and check RSLT-004, followed by main-view restoration exit=0; ledger=none, no migration edit exit=0.

Exact head for every receipt: d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85. Local Node assertions and typecheck ran with Node 24.19.0 under the supplied minimum-pin toolchain; rer uses its project Node 22.20.0. Existing CI uses Node 22.20.0. No product byte changed after these runs.

Observed through one gh api exact-head discovery: push Verify candidate 42544571644 completed success; main-push Verify candidate 42546909748 completed success; Run site 42546909872 completed success. URLs are in ci-receipt.json. The existing full push Verify runs the helper in archive-graph, shard 1, through tests/contract/data-release.contract.test.ts and scripts/run-contract-lane.mjs. The new branch carries exactly that already-green commit. No additional dispatch or rerun was requested. GitHub REST calls used for discovery: 1. No CI log-download calls.

Publication scan receipt: {"commit":"d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85","complete":null,"historyScanned":null,"findings":null,"status":"not independently run in this cloud; maintained lander owns the full-history publication scan"}. No scan success is inferred from a workflow name. No new product content or history was introduced.

## DONE-RIDERS and pre-ready review

| Rider | Result on exact head |
| --- | --- |
| 1 | Selected archive outcome PASS locally; whole-clause DONE withheld under the explicit ct restoration and release holds. The original registration passes and the exact-head full push Verify is green. |
| 2 | PASS for selected data-loss flow: populated allowed restore completes; unsupported current inventory is refused without a target; exact bytes, links and ledger are checked independently of inferred devices. Prior unsafe-input and target assertions remain active. |
| 3 | PASS: existing push Verify 42544571644 completed success on the exact head and executes archive-graph, including the helper. |
| 4 | PASS: local proof and all receipts bind to the exact head; no source byte changed. |
| 5 | INSPECTED: RSLT-004 names its response privacy obligations; RL-104 names DATA-001 archive custody. This run changes no inheritance text or duty. |
| 6 | Mechanical PASS: touched contract write and check pass, generated files restored and lock fresh. Status and Gap cells deliberately untouched; the known older-archive Gap remains for the lander's judged update. |
| 7 | PASS by empty product diff: no acceptance rewrite or status change. RL-104 remains the applicable archive ruling. |
| 8 | PASS within selected archive scope: no live auth capability restored, no destination on unsupported import; full existing archive unsafe-path assertions pass. No wider permission claim. |
| 9 | PASS boundary honesty: no provider account, production restore, legal qualification, released-0.2.0 upgrade or activation is claimed. |
| 10 | PASS: no new policy default; RL-104 already authorizes archive-only device custody with unknown history. |
| 11 | Existing main equals the exact head, Verify and Run site green as above. Independent publication scan and any landing custody remain with the maintained Mac lander; no new DONE count claimed. |

Pre-ready: (1) the selected public-command outcome and refusal both run on populated data and fail if equality, links, inventory refusal or null legacy classes break; (2) no assertion was removed, narrowed, skipped or conditionally hidden; (3) the archive proof preserves auth exclusion and no-resend flags, while broader erasure and replay paths remain existing custody; (4) no screen touched, so no browser or tooltip change applies; (5) exact-head existing Verify and Run site are green, source lock fresh, no new fixture or source content introduced, publication scan custody stated honestly above. There is no known new local failure and no repair round.

## Retained holds and claim

GAP RSLT-004: Original-controller pre-device recovery is now independently reproduced, but the explicit ct broader restoration, activation and release qualification holds remain; unsupported released-0.2.0 hash-ledger upgrade and every owner, account, ct and Base hold are unchanged. Historical c5 results, reporting, export, route and download-worker exclusions stay in force. Archive-only device custody remains excluded from response exports.

CLAIM RSLT-004 PARTIAL points=none tests=scripts/deployment-data.check.mjs#complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites

Plan rows changed: none; campaign outcome is confirmation of the already-landed selected recovery chain, with no clause status or count transition. No new policy default and no new external dependency was introduced. Report packet publication is separate from product acceptance.
