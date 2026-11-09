# sd-pencil-c-f53 report

Product repository: https://github.com/just-every/run-pencil
Product branch: cloud/sd-pencil-c-f53
Product head: d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85
Base main: 191c091413fa30a975150e462f1cc9c4ea869be1
PR: none; a branch push starts the existing Verify candidate workflow.

RSLT-004 remains PARTIAL. The complete planner-selected original-controller pre-device recovery chain is now proved. This is a proof-only change, with no new test registration, production behavior, UI, migration or contract change. Counts remain 142 DONE, 61 PARTIAL and 49 MISSING before and after. The clause's existing Status, Gap and Evidence cells are unchanged, as required. The plan row affected is only RSLT-004's original-controller older-archive proof. The plan extract's broader restoration, activation and release holds remain unchanged.

## Plan and implementation

The complete plan is PLAN.md. All six steps are implemented: resolve and pin the declared predecessor; extend the existing archive registration; export and restore with original source; upgrade with the installed current kit; run touched and mechanical checks; publish product and evidence separately.

RELEASE.json declares 0.6.0 as predecessor. The existing provenance resolver now pins its resolved tag to a full commit before comparing migration bytes and exposes that pin to its callback. The source is v0.6.0 at 4ccc2364080cd822c6a12662c1e191683a8fbe6b, not a controller synthesized from current migrations. The focused helper extracts original controller source and its 51 migrations unchanged from that commit. It verifies the predecessor release metadata and reuses the installed Zod dependency only after checking exact equality to the predecessor's dependency lock.

The populated existing ./tests/runtime/upgrades/0.6.0.sql fixture is compatible with the pinned source. It provides one released response, one quarantined response, distinct answers on two revisions, and a retained mobile respondent session. Independent assertions fix the expected response IDs, revision IDs, answer IDs, stable question ID and unequal choice values. The original controller creates and exports the historical database, then its original restoration command creates a new database. Re-exported checksum and every archive byte match. Row, relationship, integrity and applied-ledger assertions pass before and after restoration.

The current importer is also tried against the old archive. It refuses with INVENTORY_MISMATCH and creates no destination. That refusal remains unchanged. The current installed deployment kit's actual migrate function, reached through the existing migrateKit provider-edge helper, validates migration hashes and upgrades the restored database from 51 to 78 migrations. All original ledger rows, including their IDs, timestamps and hashes, remain unchanged. Every historical response has device_class null afterward, while the retained historical session still has its mobile class and a null resume hash. A repeat upgrade applies nothing. A current-controller archive again retains both null classes. The original backup is unchanged.

Sign-in sessions and magic links are excluded from the historical archive and restored database. Response and respondent-session resume hashes are redacted, and both historical responses and outbox rows retain notification_eligible=0 through the upgrade. Existing attachment, concurrent-target, schema, unsafe-archive, credentials, quarantine, exact-value, custody and refusal workloads all still run through the same registration.

## Scoped proof rubric

Each row is inside the existing registration in ./scripts/deployment-data.check.mjs, named “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites”. Its new case is “original pre-device controller restores populated history before the trusted current upgrade”. It remains wired through the existing archive graph contract test and branch Verify shard 1; the workflow was not edited.

| Item | Outcome | Evidence on the candidate |
| --- | --- | --- |
| P1 | MET: authentic predecessor source and controller pinned before use | ./scripts/release-upgrade-inputs.mjs:153–155,186; ./scripts/deployment-data-pre-device-proof.mjs:46–68; source commit recorded in archive.log |
| P2 | MET: populated pre-device responses and answers exported by original source | ./scripts/deployment-data-pre-device-proof.mjs:74–100; fixed two-response, two-answer expectations, with pre-device column absence |
| P3 | MET: new database restored by the same original trusted controller, with exact re-export | ./scripts/deployment-data-pre-device-proof.mjs:109–122; checksum, archive bytes, responses, answers, stable-question links and exact ledger equality |
| P4 | MET: current upgrade retains historical graph and honest null response classes | ./scripts/deployment-data-pre-device-proof.mjs:125–145; 51 to 78 migrations, two null response classes, same historical ledger prefix and no work on repeat |
| P5 | MET: unsafe current import remains refused and credentials or resend capability do not return | ./scripts/deployment-data-pre-device-proof.mjs:21–33,101–108,122,138; INVENTORY_MISMATCH, nonexistent destination, no authorization rows, null session hash, empty response hashes and disabled historical mail eligibility |

PROBE RSLT-004 original-controller: exportData on populated v0.6.0 source, original testRestore into a new database, exact re-export, then migrateKit with current migrations -> 2 responses, 2 answers, 2 retained graph links, equal archive bytes, unchanged original ledger entries and device_class null for every historical response. Current import of the older archive -> INVENTORY_MISMATCH and no destination file.

## Clause acceptance and remaining boundary

The clause has legacy prose rather than numbered acceptance points. This round closes the named archive-proof gap and does not claim new completion of the clause's broader results sentences. The claim therefore uses points=none, with the exact registration that proves this round's scoped work.

| Acceptance sentence or inherited duty | Result |
| --- | --- |
| Results device split follows combined filters and names numerator and denominator | Existing implementation and journeys preserved; no new results or browser proof claimed in this round |
| Coarse device class, no fingerprint and erasure custody | Historical null-class upgrade delta proved; existing live collection and erasure duties retained |
| Revision-wide session counts alone do not satisfy a response-linked filtered split | Existing behavior unchanged; the recovery proof additionally retains a mobile session without inferring either historical response's class |
| Device class never appears in a response export | Existing response-export behavior and assertions unchanged; only private installation archives are exercised by the new case |
| RL-104 archive-only exception and DATA-001 recovery custody | Original-controller restore, exact re-export and current upgrade proved; current unsafe-inventory refusal and credential exclusions retained; no hosted replacement, provider or release qualification claimed |
| Unsupported released 0.2.0 hash-ledger upgrade | Unchanged and unclaimed; this proof uses the declared compatible 0.6.0 predecessor |

GAP RSLT-004: The named original-controller pre-device archive proof is closed. RSLT-004 remains PARTIAL under ct's retained wording; broader DONE restoration, activation and release qualification, summary integration obligations and all stated owner, account, ct and Base holds remain outside this round.

No new policy default was adopted. RL-104 governs archive-only device custody, with no response-export exception.

## DONE-RIDERS and pre-ready review

| Rider | Result and evidence |
| --- | --- |
| 1 | PASS for all scoped P1–P5 outcomes through the registered archive journey; full clause completion is not claimed. Exact-SHA Verify is recorded separately below. |
| 2 | PASS: genuinely populated source with independently fixed unequal answers; allowed original restore succeeds, unsafe current import refuses without writes, restored graph and ledger are compared. |
| 3 | Existing Verify wiring INSPECTED: ./tests/contract/data-release.contract.test.ts:42 invokes the archive graph child, and existing shard 1 runs archive-graph. Exact-SHA run status is recorded separately. |
| 4 | PASS: archive.log and checks.json were recorded after committing the exact candidate. Migration proof also has an exact-SHA receipt. |
| 5 | INSPECTED: no new inherited duty or clause text change; RL-104 and DATA-001 custody remain bounded as described above. |
| 6 | PASS mechanically: generator write and check pass. Generated views were restored from main and not committed. Status and Gap cells deliberately stay with their sole writer; this report supplies the new proof. |
| 7 | PASS: no acceptance sentence, status row, coverage map or ruling changed. |
| 8 | PASS for scoped recovery custody: original restore and unsafe current import both run; no authorization row or resume capability returns. Wider unchanged authorization journeys remain with existing evidence. |
| 9 | PASS: no live provider, hosted replacement, legal or release boundary is reported as proven. |
| 10 | PASS: existing approved RL-104 used; no new policy default. |
| 11 | PENDING LANDER: no main push or landing was attempted. Candidate main equality, COMPLETE full-history scan and exact-main Run site are not established here. |

Pre-ready review: scoped outcomes have executable assertions on populated data; no existing assertion, workload or registration was removed, narrowed, skipped or placed behind a condition. Credential and no-resend custody remain asserted; wider erasure and replay workloads remain intact. No screens or UI controls changed, so browser screenshots are not applicable. No email-shaped string was added to source or fixtures. The exact source lock check passes. Publication scan is NOT RUN in cloud under the task's cloud adaptation: commit=d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85, complete=not-established, historyScanned=not-established, findings=not-established. The maintained Mac lander owns that scan and landing receipt; no clean-scan or landing claim is made.

## Validation and publication receipts

All exact-candidate commands and exits are in checks.json and migrations-receipt.json, with actual output files selected explicitly for evidence transport. The archive registration passes one test, zero failures, preserving all six previous cases plus the new focused case. Native migration proof passes all three existing cases. Typecheck, first-party check and source-lock check each exit 0. Local runtime is Node 24.19.0; branch CI uses its unchanged Node 22.20.0 pin. Setup and private local settings were not selected for the public evidence packet.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock, then check and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RSLT-004, then check RSLT-004 exit=0, generated views restored from main; ledger=no migration edits, native predecessor migration check exit=0.

Identity and all candidate commit messages were inspected before the product push. The one candidate commit has fleet author and committer, no trailers, and no changed CONTRACT.md Status line. Product push guard succeeded on attempt 1. The checkout is clean. No PR or workflow dispatch was required.

Prior exact-main evidence: Verify 42541318493 success and Run site 42541318436 success at 191c091413fa30a975150e462f1cc9c4ea869be1. These are only baseline health; they are not candidate-green evidence.

Candidate Verify: push event, run 42544571644, head d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85. Discovery and both permitted polls observed in_progress, with head_sha matching the candidate. The latest observed state is recorded in candidate-ci-final.json. GitHub calls so far: 4, including the baseline-health read. No duplicate dispatch or rerun was started. Candidate Run site and main equality remain the lander's responsibility.

Blockers: no unresolved implementation or provenance blocker for the scoped recovery proof. The broader clause remains PARTIAL under the explicit held remainder. CI status and evidence publication remain independent of that clause judgment.

CLAIM RSLT-004 PARTIAL points=none tests=scripts/deployment-data.check.mjs#complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites

Terminal product custody: PUSHED branch=cloud/sd-pencil-c-f53 head=d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85. Verify remains in_progress with no conclusion at the final observed poll. No READY, exact-candidate CI success, landing or publication-scan success is claimed. The complete scoped proof is available for the maintained independent gate.
