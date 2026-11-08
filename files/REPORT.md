# sd-pencil-c-f34-pc1 — native action health continuation

Repository: just-every/run-pencil
Product branch: cloud/sd-pencil-c-f34-pc1
Product head: d85088cdbdc290e1f739df7cdfa7ed0632bc0296
Result: the named continuation already has exact-SHA green Verify push run 42491109266, completed successfully. The earlier push run 42481493921 on cloud/sd-pencil-c-f34 failed shard 3 and its aggregate verify job. A fresh REST discovery found the successful continuation run. No product code repair, new product commit, workflow dispatch, rerun, history rewrite, status edit or product push was necessary in this continuation. The existing published implementation and all four candidate commits are retained.

Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. AGENT-005 remains PARTIAL. No registration, assertion, workload or acceptance sentence was added, removed, weakened or changed. The plan's AGENT-005 row remains PARTIAL; no other plan row is changed. PR: none; branch push Verify is the repository's pre-main entry point.

## Plan and execution

The complete plan is in PLAN.md. The run restored the fleet's named published continuation, read the required repository and inline campaign references, inspected the existing health projection and its native delivery and reminder dependencies, obtained completed job metadata and attempted each failed-job log once. Both log commands returned exit zero and no bytes. The one artifact archive attempt was rejected with HTTP 403 Forbidden at the redirected archive; no blocked blob download was retried. The transport receipt records only sanitized commands and results.

Before making any edit, the original worker-2 lane ran against the unchanged saved SHA with Node 22.20.0, its existing 2-of-2 shard, CI environment and release-upgrade wrapper. It passed all 67 registrations including the existing 100,000-response search capacity journey. An initial diagnostic run used the VM's Node 24 and also passed; it is retained separately and is not substituted for the pinned reproduction. A detailed pinned worker run passed 66 runtime registrations and records no failing assertion. The mobile-6 lane passed six registrations on the same SHA. The production build and hosted checks passed after selecting the required system Chromium for every resolved Playwright runtime. Earlier local hosted attempts failed only because the VM's globally available playwright-core looked for its absent bundled browser; these environment-only diagnostics are retained, and no product dependency or source was changed to address them.

The exact-SHA successful continuation Verify was discovered without dispatching or retrying anything. It removes the need for a speculative repair of the older red run. No VERIFY_REPRODUCED claim is made: no original assertion failure was reproduced. Six GitHub calls were used, with one watcher and no rapid CI polling.

## Scope and proof register

The public native door is GET /api/app/actions/{actionId}/health. It validates the operator session and action workspace before projecting the retained task and reminder records. It sends nothing and performs no repair. Source: src/core/features/actions/routes.ts:34 and src/core/features/actions/health.ts:30. The projection excludes payloads, configured destinations, credentials, sender addresses and private action text. It uses factual retained outcome classes instead of inferring an expired token from an HTTP failure.

All rows below are bound to d85088cdbdc290e1f739df7cdfa7ed0632bc0296. Their recorded Verify event is push, run 42491109266, completed/success; the local touched test run also passed all four existing registrations. Native network-edge fixtures establish the scoped native behavior; they establish no real-provider qualification.

| Item | Outcome | Native door and evidence |
| --- | --- | --- |
| R1, requirement monitoring sentence | PARTIAL | Task and reminder projection only. Background watching, other deliveries, bounce monitoring, completion and drop-off, quarantine and evidence-gap monitoring remain omitted. No full-clause DONE is claimed. |
| R2, human-control sentence | PASS for the selected native slice | Existing task retry or fresh explicit confirmation is required; health performs no replay, reconnection, recipient change or external disclosure. Task registration tests/runtime/actions-task.worker.test.ts:30, helper tests/runtime/action-health-scenario.ts:27 and :87. |
| R3, acceptance sentence: broken task plus broken reminder with exact IDs | PASS for the selected native slice | Existing task registration invokes brokenActionHealth at line 63. Real loopback 500 and native owner removal are reported together, with exact action, task key and attempt ID, stale payload and no_owner schedule. Helper lines 45 to 85. |
| R4, acceptance sentence: approved replay | PASS for existing task delivery; remainder held | Existing task registration lines 30 to 62 proves recovery only on explicit retry, identical confirmed body and key, and one remote task. Helper lines 87 to 101 refuses stale retry and old confirmation with 409 and no new request, then accepts fresh confirmation. No reminder replay is offered. |
| R5, selected retained reminder failures | PASS | Existing reminder registration tests/runtime/actions-measurement.worker.test.ts:20 invokes reminderFailureHealth at line 114. Exact failed and unknown occurrence IDs remain visible even behind 31 newer sent rows. Helper lines 105 to 125. Unknown reminders remain unresent after another scheduler tick at registration lines 115 to 118. |
| R6, inherited session and workspace authority | PASS | Missing, foreign, revoked and erased-owner sessions return 401, 404, 401 and 401 without private IDs, rationale or key. Helper lines 65 to 81. Both supported and dangerous paths run through the native route. |
| R7, read-only and safe explanation duties | PASS | Repeated health reads are equal, leave six native tables unchanged and make zero outbound fetches. Helpers lines 27 to 40, 63 to 81 and 118 to 125. Mail-configuration refusal supplies safe repair instructions without sender or credential disclosure at lines 128 to 140. |

PROBES.md contains one public-door probe line for every selected behavior. The test registrations are:

- tests/runtime/actions-task.worker.test.ts — a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task.
- tests/runtime/actions-measurement.worker.test.ts — ACT-009 emails the owner before, on and weekly after review exactly once within hours; only the operator verdict stops queued and future reminders.

## DONE-RIDERS assessment

This is a PARTIAL handoff, not a DONE proposal. Results apply only to the named native slice unless stated otherwise.

| Rider | Result | Evidence or retained boundary |
| --- | --- | --- |
| 1 | FAIL for whole clause; PASS selected slice | R1 retains the omitted monitoring outcomes. R2 to R7 run through native public doors in the green exact-SHA push Verify. |
| 2 | PASS selected slice | Seeded failed, unknown and retained records; allowed reads and denied foreign, revoked and deleted-owner reads; explicit send and stale-payload refusal. Helper lines 27 to 140. |
| 3 | PASS | Existing registrations are inside worker Verify lanes; exact-SHA push Verify 42491109266 completed successfully. |
| 4 | PASS | Local proof and successful Verify are on the unchanged full candidate SHA. No source or test byte changed after proof. |
| 5 | INSPECTED | Human control is named in AGENT-005 itself. Existing native session and workspace authority is exercised, without claiming completion of separate Base agent duties. |
| 6 | PASS mechanical; status retained | AGENT-005 generator write and check pass; generated views restored from origin/main and unchanged. Status, Gap, Evidence and provenance prose retained exactly. No new DONE judgment is requested. |
| 7 | PASS | No contract sentence, acceptance point, Status row or coverage map was edited. |
| 8 | PASS selected slice | Unauthorized reads expose nothing; stale retry and confirmation make no send; authorized explicit task retry or fresh confirmation completes. Helper lines 65 to 101. |
| 9 | PASS boundary | Loopback and native fixture proof only. No provider or legal qualification, reminder replay or release claim. |
| 10 | PASS | No new policy default was adopted. Existing conservative operator-approval boundaries are retained. |
| 11 | PENDING guarded lander | Candidate remains branch-only. Exact-SHA branch Verify is green; main equality, publication scan and Run site are not established by this cloud run. |

## Checks and custody

- Touched native runtime: two files, four tests passed using Node 22.20.0; touched-runtime.log and touched-runtime.exit.
- Original worker-2 reproduction: 67 passed, zero failed, zero pending; reproduce-node22-worker-2.log, its exit receipt and reproduced-worker-2.json. The 100,000-response search capacity p95 was 290 ms, within its unchanged check.
- Detailed original runtime shard: 66 passed, zero failed; reproduce-node22-details.json, reproduce-node22-detail-output.log and reproduce-detail-summary.log.
- Original mobile-6 reproduction: six passed, zero failed; reproduce-node22-mobile-6.log and reproduced-mobile-6.json. System Chromium at /usr/bin/chromium with --no-sandbox; no UI change was made or additional screen proof claimed.
- Hosted checks: hydration passed; agent-door conformance 2307 of 2307 passed; native resource custody passed. hosted-system-chromium.log and exit receipt. A workerd broken-pipe diagnostic occurred during teardown while the complete command returned zero; no assertion failed.
- Production build, typecheck, first-party check, scoped view generation, source check, lock regeneration and lock check all returned zero. Their actual files and exit receipts are retained.
- Contract, generated views, lock and product worktree remained unchanged. No migration was added or edited; ledger check is not applicable.
- Full history is present. All four candidate commits, including merge side parents, pass fleet identity and trailer inspection. product-ref.txt confirms the declared cloud branch already points to the exact head. No force push, amendment, rebase or default-branch mutation occurred.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node scripts/contract-docs.mjs write AGENT-005 and check AGENT-005 exit=0; ledger=none exit=0

Pre-READY self-check: (1) Selected native behaviors have public-door proof and exact-SHA green Verify; the full monitoring clause remains PARTIAL. (2) No assertion was removed, narrowed or gated. (3) Revoked and erased-owner access is refused and repeated reads create no replay or outbound effect; the original confirmed payload and key remain under explicit task approval. (4) No screen was touched. (5) Lock is fresh and branch Verify is green; publication scan, landing and Run site remain with the maintained Mac lander. No fixture or product file was added, and no new email-shaped fixture string was introduced.

Publication scan receipt: commit=d85088cdbdc290e1f739df7cdfa7ed0632bc0296 complete=not-run-in-cloud historyScanned=not-established findings=not-established. This is not a COMPLETE or zero-findings claim. Main equality=not-established; Run site run id=not-established. Required exact-SHA full-history publication scan and landing remain mandatory on the Mac.

## Claim and handoff

CLAIM AGENT-005 PARTIAL points=1 tests=tests/runtime/actions-task.worker.test.ts#a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task; tests/runtime/actions-measurement.worker.test.ts#ACT-009 emails the owner before, on and weekly after review exactly once within hours; only the operator verdict stops queued and future reminders

GAP AGENT-005: Background watching and consolidated interface; other integration deliveries, mail and SMS bounces, completion and drop-off, quarantine and evidence-gap monitoring; reminder replay, reconnection, recipient changes and outside-form disclosure remain omitted with their original operator-approval requirements. Real-provider qualification, owner and account holds, ct and Base holds, INTEG-015 chat replay-interface gate, historical exclusions, activation and release prerequisites remain unchanged.

No product blocker remains. No new product commit was needed because the exact published continuation already passed Verify 42491109266. All product changes predate this continuation. The evidence ref carries only explicitly selected non-secret report files and receipts and is separate from product readiness, acceptance and landing.
