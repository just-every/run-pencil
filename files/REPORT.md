# sd-pencil-c-f24 results

Repository: just-every/run-pencil. Product branch: `cloud/sd-pencil-c-f24`. Full candidate SHA: `3c10ae66e7efbc27a936dfd4e3dcc563eee19e6c`. Parent and fetched main: `8fe52b625820a953c327c67cae53ac84ac7bb452`. One product commit, pushed successfully through the fleet guard on its first attempt. No PR was needed: the existing push workflow accepts the named cloud branch. Main was not changed.

The scoped native POINTS are complete. RESP-022 remains PARTIAL. Counts before and after are 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. No contract text, Status, Gap or Evidence cell changed. The plan row to report is RESP-022: native straight-lining admission and custody proof complete; all held remainder stays held. No lane file was read or written. The actual full plan is `PLAN.md` in this packet.

## Implemented behavior

The existing authenticated draft-settings route accepts `responseQuality: { straightLining: true }`, validates its boolean and refuses unknown quality keys. An absent setting or explicit false leaves the check off. The existing expected-version guard, immutable published revisions and session revision binding remain the authority for this setting.

The small shared quality helper checks only fully answered valid single-selection matrices in single, likert5 and likert7 modes, with at least two rows. It examines accepted on-path answers, after native answer validation. An all-same grid uses the distinct `matrix-straight-lining` quarantine reason. Honeypot and minimum-time checks keep their existing precedence. Answers pass unchanged into the existing atomic response transaction. No registration, reporting production module, results module, builder screen, migration, Base pin or workflow changed. The existing matrix workload and all its assertions are retained.

## Actual checks

On the exact candidate, Node 22.20.0 ran the expanded new-question-types registration and the existing minimum-time quarantine regression: 2 passed, 0 failed; 11 unrelated registrations in the selected second file were filtered out by the command, not changed or skipped in source. `worker-results.json` and `worker-run.log` are the actual runner outputs. The expanded journey executes all three modes in its one registration.

Project typecheck, first-party check, feature boundaries, contract generation and check for RESP-022, and source lock generation and integrity checks exited 0. Contract generation reported 142 done, 61 partial and 49 missing. The two generated views were restored from main and omitted from the commit. The final source lock includes precisely the intended source and fixture changes. No migration ledger change is applicable. `CHECKS.json`, `views-write.log`, `views-check.log`, `boundaries.log` and `SOURCE-CHANGES.json` retain the actual receipts and provenance.

An initial local fixture assertion incorrectly expected JSON matrix exports to translate choice IDs to option values. The existing export retains stable IDs. The assertion was corrected to require the exact admitted grid, then all checks passed. This was an unpublished local fixture correction, not a CI repair. No assertion from main was removed, narrowed or made conditional.

Verify push run 42416149194 belongs to the exact candidate. Discovery at 2026-11-07T21:30:44Z reported in_progress, with no conclusion. No success is claimed. No dispatch or rerun was made. Two GitHub API calls were used: main status and candidate discovery. Main's exact-head Verify 42414400507 and Run site 42414400548 succeeded on `8fe52b625820a953c327c67cae53ac84ac7bb452`; these do not establish candidate success. The complete observations are `ci-runs.jsonl` and `main-ci.jsonl`.

Publication scan receipt: commit=3c10ae66e7efbc27a936dfd4e3dcc563eee19e6c; complete=NOT RUN; historyScanned=NOT ESTABLISHED; findings=NOT ESTABLISHED. The cloud branch route delegates the complete full-history scan to the maintained Mac lander. The clone has full history. Main equality is false as expected for an unlanded candidate. Candidate Run site and landing are pending that lander. This report claims neither publication clearance nor DONE.

## Scope proof register

All new rows below run through native HTTP collection, settings, quarantine, release, results and export routes in `tests/runtime/response-quality-scenario.ts`, invoked at line 92 by the existing registration in `tests/runtime/new-question-types.worker.test.ts`: **publishes, previews, submits, duplicates and losslessly exports each new type**. Exact-head local result is PASS; Verify event is push, observed in progress, not yet concluded.

| Item | Outcome and exact proof | Result |
| --- | --- | --- |
| Native straight-lining | Lines 38–45 seed four rows and five or seven choices for each supported mode; lines 95–107 submit mature all-same grids and concurrent replay; line 110 checks exact values and the distinct reason in authenticated quarantine. | PASS locally |
| Default and explicit off | Lines 65–71 collect an all-same grid under omitted settings; lines 125–134 publish explicit false and collect normally. Outbox and result counts are checked. | PASS locally |
| Settings authority and version | Lines 73–87 refuse malformed, anonymous, foreign and stale updates, comparing complete before and after drafts. | PASS locally |
| Immutable published and older settings | Lines 70, 88–98 and 123–131 retain both off and on sessions across later draft edits and publications. Their opposite dispositions prove both directions of revision custody. | PASS locally |
| Mixed answers | Lines 45 and 91–93 change one valid row, assert released disposition and one completed-response outbox record while checks are enabled. | PASS locally |
| Quarantine custody and exclusions | Lines 107–120 and 130–138 check exact retained grid values, no outbox entry, zero unauthorized release audit, unchanged quarantine, released-only results and ledger, and opened default JSON exports excluding both held responses. | PASS locally |
| Replay and release concurrency | Lines 103–107 assert one response for concurrent capture; lines 140–154 require concurrent release statuses 204 and 404, one audit, one effect, results rising from four to five, export restoration with exact stable choice IDs, and enabled-revision row denominators of two. Later replay retains the same response and effect count. | PASS locally |
| Workspace isolation and revoked authority | Lines 79–81 and 111–120 refuse foreign and anonymous settings, private reads and release; lines 163–167 revoke the actual owner credential and refuse private quarantine and release while retained state and effects stay unchanged. | PASS locally |
| Erasure fence | Lines 156–161 erase a released response, refuse capture replay, remove answers and effects, and restore the result count to four. | PASS locally |
| Existing minimum-time quarantine | `tests/runtime/journey.worker.test.ts`, **quarantines fast submissions, excludes them from reporting, releases exactly once after closure, and erases rejected answers**, lines 202–228, remains unchanged and passes in the exact-head run. | PASS locally |
| FIELD-002 prerequisite | Main declares FIELD-002 DONE; the original matrix fixture remains byte-identical and runs before the new helper, including its 29-response workload, row reports, exports, crosstabs, replay and erasure. | PASS locally; status INSPECTED |

## Complete clause boundary

| Clause sentence or inherited obligation | Evidence and remaining boundary |
| --- | --- |
| Check completed responses for straight-lining, median-relative speed, duplicate open text and gibberish. | The native single-selection straight-lining subset passes as above. Median-relative speed, including 3 seconds against a 90-second median, duplicate text and gibberish remain unbuilt or unproved. |
| Quarantine flags with reasons under RESP-017 and RESP-018, discarding nothing. | Exact values, distinct reason, exclusion, release and replay pass for the new flag. Existing minimum-time custody regression also passes. Other quality checks remain held. |
| Operators choose checks per form. | Existing authenticated version-guarded API now chooses the one default-off native check. Builder controls and operator-facing reason copy remain omitted. |
| Amend RESP-015 activation exclusion to name the checks. | Omitted as the planner explicitly requires. No acceptance text was edited. |
| Worker acceptance submits a straight-lined grid and a 3-second completion against a 90-second median, both with reasons, then restores results on release. | Straight-lined grids and release restoration pass in all three modes. The median example remains held. No full acceptance sentence is claimed complete, so the claim uses points=none. |
| FIELD-002 matrix prerequisite and existing owner, account, ct and Base holds. | FIELD-002 is declared DONE on main. Other holds, earlier results and export exclusions, and release prerequisites are unchanged. |

## DONE riders

| Rider | Result on this candidate | Evidence or boundary |
| --- | --- | --- |
| 1 | PARTIAL for full clause; PASS for scoped native behavior | Scope proof register above; median, duplicate text and gibberish are not claimed. |
| 2 | PASS for scope | Real populated grids, opened exports, exact values, independent fixed counts, allowed release and unsafe release refusal with unchanged records. |
| 3 | PENDING | Exact-head local runner passes; push Verify 42416149194 is in progress. |
| 4 | PASS locally | Actual Worker JSON binds this committed SHA; source hash inventory is in CHECKS.json. No subsequent source edit. |
| 5 | INSPECTED | RESP-022 retains its existing RESP-015, RESP-017 and RESP-018 references; FIELD-002 remains DONE. No inheritance rewrite. |
| 6 | PASS mechanical; status unchanged | Generator write and check exit 0. Main's source rows and both generated views are preserved. |
| 7 | PASS | No acceptance point, clause text or coverage map changed. |
| 8 | PASS for scope | Native authenticated allowed release succeeds; anonymous, foreign and revoked credentials cannot release or expose the held data. Audit and effects counts prove no unauthorized transition. |
| 9 | NOT APPLICABLE to native increment | No live provider or legal proof claimed. Existing provider and release boundaries stay held. |
| 10 | PASS for scope | Default-off is the explicit brief instruction. Existing authenticated equal-operator authority is retained; no new custody policy is claimed. |
| 11 | PENDING LANDER | Candidate differs from main; exact-head Verify, complete publication scan and Run site gates are not claimed. |

## Pre-READY self-check

1. The scoped behaviors have populated native-door assertions, and the expanded registration remains in the existing push Verify Worker glob. Exact-head CI remains pending.
2. No existing assertion or registration was removed, narrowed or conditionally hidden. No registration was added. The full old matrix fixture is unchanged.
3. Foreign and revoked authority refuse private custody actions; concurrent capture and release remain singular; erasure and capture replay cannot restore deleted data.
4. No screen changed. Builder controls, browser proof and reason copy are expressly held by this brief.
5. Source lock is fresh. New product and fixture text has no email-shaped string. Changed slash tokens were inspected; the only non-path candidate is the actual application/json MIME type. Identities and all trailers were inspected for every candidate commit before push; the sole commit uses fleet identity and has no trailer. Publication scan, branch CI completion and Run site remain with the Mac lander.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RESP-022 and node scripts/contract-docs.mjs check RESP-022 exit=0; ledger=none exit=0

PROBE RESP-022 native-straight-lining: native sessions and submission routes with mature complete all-same grids in single, likert5 and likert7 -> quarantined, unchanged values and matrix-straight-lining reason; mixed and check-off captures released; default exports and results excluded held records; concurrent authorized release restored one result and one effect; foreign and revoked custody attempts refused; erased capture replay refused.

CLAIM RESP-022 PARTIAL points=none tests=tests/runtime/new-question-types.worker.test.ts#publishes, previews, submits, duplicates and losslessly exports each new type
GAP RESP-022: Median-relative speed including the 3-second and 90-second example, duplicate text, gibberish, multiple-selection and partial-grid semantics, builder controls, browser proof, operator-facing reason copy, RESP-015 activation amendments and full DONE qualification remain omitted; all existing owner, account, ct, Base and release prerequisites remain unchanged.

No real blocker remains for this native increment. The candidate is branch-only; READY is handoff custody under the brief's cloud route and does not claim CI success, acceptance, publication clearance or landing. The report packet is published only on evidence/sd-pencil-c-f24 and is separate from the product candidate.
