# sd-pencil-c-f36 results

Repository: just-every/run-pencil
Product branch: cloud/sd-pencil-c-f36
Candidate: feebe981e55bb369397c6b6d57b7f0fa5e20bb3b
Integrated main: 18ef418c11ba90618205512f485918fe5aae68bb
Commits: 1bf5f7e (intermediate save, CI skipped); feebe981e55bb369397c6b6d57b7f0fa5e20bb3b (candidate).
PR: none; the branch invokes the existing Verify candidate workflow.

GOV-005 remains PARTIAL. This round closes only the planner's browser response-export event proof. Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, total 252. No contract judgment or acceptance text changed. Plan row to update: GOV-005 browser export-event proof completed; its listed remainders stay held. No other plan row changes.

The full browser acceptance sentence also requires a role change. The claim therefore uses points=none: the export subpoint is proved, but no entire newly completed acceptance sentence is claimed.

CLAIM GOV-005 PARTIAL points=none tests=tests/e2e/ledger-filters.spec.ts#native and imported typed filters download exact JSON, CSV, LEDG-005 XLSX and SPSS response snapshots with readable decisions and compact rows at both widths

GAP GOV-005: ROLE-001 authority and role-change events, GOV-004 reveal events, WORK-002 approval events, Admin-only access and the missing contact-export family remain unbuilt. Current equal-operator access and all existing holds are unchanged. No DONE, activation or release qualification is claimed.

## Change and proof map

The existing registration at tests/e2e/ledger-filters.spec.ts:19 invokes tests/e2e/audit-export-proof.ts:10. No registration or production file changed.

| Assigned outcome | Proof on candidate |
| --- | --- |
| Genuine response export | Helper lines 18–37: no earlier export event for this form; actual response CSV contains both known native response IDs and the private consent answer. |
| Find that export by form and activity | Helper lines 39–58: browser filters produce exactly one export.created event with the independently selected signed-in actor, fixture form and fixed safe details. |
| Display actor, form, activity and safe details | Helper lines 59–62: all four visible cells have the expected values. |
| Actual audit CSV refers to that event | Helper lines 69–77 and 83: actual download has one row with the exact event ID, timestamp, actor ID and name, form ID and name, kind and safe details. Downloaded bytes are saved. |
| No private data in audit output | Helper lines 55 and 78–81: exact details allowlist and absence of the consent value, operator address and exported response IDs from the displayed row, native audit response and downloaded audit CSV. |
| Proof at 1440 and 390 | Existing desktop and mobile projects; helper lines 63–67 and 84–85 prove keyboard-focus tooltips for filter-removal icons, no horizontal page overflow and screenshots. |
| Original workload preserved | The original native and imported loop, now at ledger journey line 48, is byte-identical to main. All JSON, CSV, XLSX and SPSS assertions remain. Forty-four existing response exports per width are retained; one response CSV and one audit CSV are added. |

The actual audit downloads and screenshots are retained for both widths. The response export is genuine: no response, audit event, route or download is mocked.

## Complete clause boundary

| Acceptance sentence or inherited duty | Result |
| --- | --- |
| Browser performs an export and finds it in viewer and CSV | Assigned export portion proved by the helper through the existing registration. Final run result is in the actual browser receipt. |
| Same journey performs and finds a role change | HELD: ROLE-001 is unbuilt. Not claimed. |
| Native filters, pagination, safe details, snapshot stability, isolation and tombstoning | INSPECTED unchanged in tests/runtime/audit-viewer.worker.test.ts, registration “native operators search and export safe audit snapshots without cross-workspace access, insertion drift or retained actor identities”. Not rerun for this browser-proof-only change. |
| Missing event-family journey | HELD: role changes, reveals, approvals and missing contact export remain unbuilt. |
| Admin access | HELD: existing equal-operator access is unchanged; no authority default introduced. |
| BASE-DATA-003 erasure tombstoning | Explicitly named by GOV-005; the unchanged native journey exercises actor removal and invalidated sessions. No erasure or replay production code changed. |

## DONE-RIDERS

No DONE claim is made. Results apply to the exact candidate above.

| Rider | Result and evidence |
| --- | --- |
| 1 | FAIL for full clause: export subpoint now reached in viewer and real CSV through helper lines 18–83; role-change, reveal and approval outcomes remain held. |
| 2 | PASS for assigned proof: two real native records and a nonempty exact event are checked; consent presence in response CSV and absence in audit output asserted. Broader authority proof not claimed. |
| 3 | PENDING exact-head Verify; existing push browser globs load this registration at both widths. No new env gate or nightly-only registration. |
| 4 | PASS local freshness: final browser and local-check receipts bind final candidate. Production and original workload bytes are unchanged. |
| 5 | PASS INSPECTED: GOV-005 names BASE-DATA-003; native journey retains its Base access and data registrations. |
| 6 | PASS mechanical: generator write and check pass with unchanged counts; generated views restored from main; Status, Gap and Evidence cells untouched. No DONE provenance claimed. |
| 7 | PASS INSPECTED: no acceptance point, ct rider, ID map or contract text changed. |
| 8 | HELD for full clause: ROLE-001 and Admin-only access remain unbuilt. No new permission or production door. |
| 9 | PASS boundary: no live provider, legal, retention or release qualification claimed. |
| 10 | NOT APPLICABLE: no policy default or new ruling required by this test-only proof. |
| 11 | PENDING maintained lander: main equality, exact-head Verify, Run site and complete full-history publication scan remain separate gates. |

## Pre-ready checks

1. The assigned export outcome is exercised through native controls and actual downloads with strict actor, form, activity, event identity and safe-detail assertions.
2. No assertion was removed, narrowed, skipped or moved behind a width condition. No workload or threshold changed. One existing registration remains one; test-budget metadata unchanged.
3. Authority, erasure and replay production paths are unchanged. Remaining authority boundary stays held; no new authority claim.
4. Existing screen components retained. Icon-only form and activity chip controls have keyboard-focus tooltip assertions. Screenshots show existing desktop table and phone cards. Pre-existing small table headings and phone field labels are outside this proof-only scope; no UI polish or production change claimed.
5. Typecheck, first-party and source-lock checks pass. Generated views pass write and check, then are restored from main. Exact-head CI, scan and landing are recorded separately. Changed test files contain zero email-shaped literals.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock; pnpm source:check exit=0; views=node scripts/contract-docs.mjs write GOV-005; node scripts/contract-docs.mjs check GOV-005 exit=0; ledger=none exit=0

## Verification and custody

Setup and npx -y @runeditrun/rer build completed successfully through cloud_run. The initial touched journey passed both widths: 2 passed, 0 failed, 0 skipped. Final candidate command, times and exit are in browser-receipt.json and browser-results.json. Typecheck, first-party and source checks have actual command and exit receipts in local-checks.json and complete selected outputs. mechanical-receipt.json records unchanged contract and production scope, preserved workload and lock provenance.

Cloud testing uses the existing browser configuration with /usr/bin/chromium and --no-sandbox. The local-only configuration omits the separate product-site server: touched audit and results pages do not use it. The committed workflow is unchanged and executes the registration through its existing desktop and mobile shards.

Fetched main was green: Verify candidate push runs 42485618733, 42485396555 and 42479761808; Run site push run 42485618652. These prove main only, never candidate.

Publication scan: commit=feebe981e55bb369397c6b6d57b7f0fa5e20bb3b complete=unestablished historyScanned=unestablished findings=unestablished; NOT RUN in cloud under the explicit cloud route. Clone has full history. Maintained Mac lander must supply complete clean-history scan and exact-head landing receipts. Main does not equal candidate. No candidate Run site green result is claimed.

Candidate push and exact-head discovery are recorded in the final custody section below. No real blocker identified for the assigned proof. Held remainder is a scope boundary. Evidence tree contains explicit non-secret packet files only and is published solely to refs/heads/evidence/sd-pencil-c-f36, separately from product custody.

## Final custody

Exact candidate feebe981e55bb369397c6b6d57b7f0fa5e20bb3b pushed successfully to cloud/sd-pencil-c-f36. Candidate Verify push run 42490501081: in_progress; conclusion None. URL: https://github.com/just-every/run-pencil/actions/runs/42490501081. Candidate green is not claimed while the run is unfinished. No PR was needed. No workflow was dispatched or rerun. GitHub API calls used: 2 of 10; one main discovery and one candidate discovery. No run was polled inside 300 seconds.

Final touched browser run: 2 passed, 0 failed, 0 skipped, 0 flaky; exit 0, elapsed 222.915 seconds. Full receipts and both actual audit CSVs are included.

PROBE GOV-005 1: 1440px response CSV download, audit viewer filtered by form i_f72f3dd0aa98df25a30c989d42b3 and export.created, actual audit CSV download -> one event 01M6XS4WHWHDT2F6C9DGF5TQFP, actor 01M6XS4QCGP0XS9Z0CJM186HJQ, matching form and activity, safe details only.

PROBE GOV-005 1: 390px response CSV download, audit viewer filtered by form i_23b503d02998ed19a6a685d7e0f5 and export.created, actual audit CSV download -> one event 01M6XS7JX0MQG0BZ9KM76FEGPR, actor 01M6XS7ES5NMT9XZRNVDKY97BP, matching form and activity, safe details only.

Preserved original assertions and workloads: yes. Production changes: none. Contract Status changes: none. Source lock fresh: yes. No new email-shaped test literals. All candidate commits checked, including all reachable parents above main: fleet author and committer identities; no co-author trailers. Both pushes succeeded on their first attempt. No repair round, rejection or recovery bundle was required.

The cloud handoff marks this locally proven pushed head for the maintained lander. Exact-head Verify, publication scan, guarded landing and Run site are still enforced there. This report never claims product landing or GOV-005 DONE. The product clone will be deleted only after evidence publication succeeds, as required.
