# sd-pencil-c-f42 report

MOB-001 remains PARTIAL. The round's scoped native inbox proof was already implemented and landed at 955e9eae109eed2a4fdf2fdd49419f94dd181bd4 before this run. No new product commit, production change, test registration, assertion change, contract edit or count change was warranted. Counts: 142 DONE, 61 PARTIAL, 49 MISSING before and after. Full clause completion and release qualification are not claimed.

## Plan and execution

1. Read the inline builder rules, plan extract, Pencil rulings and all eleven DONE-RIDERS; read the clone's AGENTS.md, README.md, HANDOVER.md, BASELINE.md, CONTRACT.md, ACCEPTANCE.md and package scripts. Map the assigned scope to the existing registration and helper before editing.
2. Use a fresh full-history clone; fetch the predecessor branch, start cloud/sd-pencil-c-f42 at the requested SHA, and retain the fleet identity and hooks. The starting SHA equals origin/main. Rebase onto freshly fetched main before handoff; no replay or conflict was needed.
3. Preserve the existing search workload and desktop and mobile triage assertions. Verify the independent native fixture, scoped 360 leg and viewport restoration already present; run the existing registration at its original 1440 and 390 widths, including the 360 leg inside the mobile project. Inspect the resulting inbox captures. Make no speculative source edit to work already complete.
4. Run typecheck, first-party checks, touched-clause generator write and check, restore both generated views, regenerate the lock last and run source:check. Keep the product tree clean.
5. Push only the required cloud branch at the proven SHA, preserve reports and actual receipts outside the product tree, and publish the selected packet to the separate evidence branch. Leave publication scanning and any landing action with the maintained lander.

Plan row report: MOB-001 remains PARTIAL to PARTIAL. The inbox-only scope is proven; the full row and all owner, account, ct, Base, activation and release holds stay unchanged. No other campaign target was started.

## Scoped proof map

All rows use the existing test in tests/e2e/response-search.spec.ts:13, named "operators search responses, see matching answers and download the same filtered records". The registration runs on the existing Verify browser lanes; no new registration or flag was added.

| Item | Door and assertion | Evidence |
| --- | --- | --- |
| Preserve the existing 1440 and 390 search journey | Native results page searches two immutable revisions, exports matching JSON, highlights Unicode matching, then triages the original response. | tests/e2e/response-search.spec.ts:13–79 and tests/e2e/submission-inbox-journey.ts:11–76 |
| Independent native fixture | Authenticated form creation and publication plus two real public session and response submissions, independent of the original search data. | tests/e2e/submission-inbox-mobile.ts:11–31 |
| Scoped 360 CSS-pixel leg | Only the mobile project enters the helper; innerWidth is checked at 360, previous viewport is restored in finally and checked after the helper. | tests/e2e/response-search.spec.ts:79; tests/e2e/submission-inbox-mobile.ts:35–52 and 134–137 |
| Assignment and tagging | Select the effective checkbox label outside the glyph, assign a native operator, add a fixed synthetic tag and inspect that row. | tests/e2e/submission-inbox-mobile.ts:58–79 |
| Review and private note | Open the real detail, inspect the fixed answer, add a private note and inspect its visible history. Keyboard focus exposes the Open submission tooltip. | tests/e2e/submission-inbox-mobile.ts:80–90 |
| Done status and filtering | Apply Done, select the Done filter, see the intended row and exclude the independent second row; detail still contains the status and note. | tests/e2e/submission-inbox-mobile.ts:91–106 |
| Reload persistence | Reload, reopen and inspect Done, assignee, tag and note; independent second row retains its default state. Filter selection is intentionally ephemeral; stored triage metadata persists. | tests/e2e/submission-inbox-mobile.ts:107–121 |
| Matching ledger | Native ledger filtered to Done contains exactly the intended response ID and fixed answer; private note text is absent. | tests/e2e/submission-inbox-mobile.ts:122–125 |
| Matching audit | Exactly four submission events, each with the authenticated actor, correct form and safe fields count; private note text is absent. | tests/e2e/submission-inbox-mobile.ts:126–132 |
| No horizontal scroll | Check document width before every measured control and each captured state. | tests/e2e/submission-inbox-mobile.ts:40–48; tests/e2e/submission-inbox-journey.ts:80–87 |
| Effective hit areas | Measure both dimensions at least 44 for every exercised control, including label.selection-hit rather than the small checkbox glyph; click the label away from its glyph and check selection. | tests/e2e/submission-inbox-mobile.ts:40–48 and 58–100; actual sizes in hit-areas.json |
| Typography and captures | All visible measured inbox text is at least 13px; captures cover the original inbox at both project widths and five 360 states. | tests/e2e/submission-inbox-journey.ts:80–92 |

The unchanged final inbox cascade is in src/core/features/submissions/ui/inbox.css:150–240. In particular, later rules wrap fields and metadata, keep the Open control and selection label at least 44 pixels, and keep narrow rows and the detail within the viewport. No production CSS or component was changed.

## Full clause and rider assessment

| MOB-001 requirement | Result |
| --- | --- |
| Every operator page works at 360 CSS pixels with at least 44-pixel targets and no horizontal scroll | PARTIAL: native submission inbox only is proven here. Complete 360 coverage of dashboard, builder, results, ledger, actions, settings and other operator states remains unproved. |
| Browser journeys at phone width build and publish a form, review a response and approve a submission | PARTIAL: response review and inbox triage proven; full 360 build-and-publish is unproved and approval requires unbuilt WORK-002. |

| DONE-RIDERS row | Result and evidence |
| --- | --- |
| 1 | FAIL for a full DONE claim: scope reaches native inbox review, not every operator page or approval. |
| 2 | PASS for this scope: two independent native completions; fixed expected selected and untouched outcomes; exact ledger IDs; exact four audited changes and private-note exclusion. See mobile helper:65–132. |
| 3 | PASS for scoped proof: existing Verify registration runs at this exact SHA; exact run identifiers and conclusions are in the CI receipt. Full-clause proof remains incomplete. |
| 4 | PASS: browser rerun passed on the requested starting SHA; unchanged-proof-receipt.json proves no byte of relevant source, test or harness changed on the final head. Final typecheck and mechanical checks run on the final SHA. |
| 5 | INSPECTED: no inheritance or clause rewrite was introduced. Baseline access and private-data duties are unchanged. |
| 6 | PASS mechanically: touched-clause generator write and check exit zero; views restored whole from main, lock remains fresh, counts and all Status cells remain unchanged. Existing Gap remains honest. |
| 7 | PASS: no acceptance text, status, coverage mapping or ruling changed. |
| 8 | NOT CLAIMED: no authority model changed; prior unauthenticated and stale-write assertions remain intact. This UI-only rerun does not substitute for the native authority journey. |
| 9 | PASS: no native device, real provider, legal or release qualification claimed. Browser emulation only. |
| 10 | PASS: no policy default or new authority decision adopted. |
| 11 | CUSTODY: main equals the starting SHA and its Verify and Run site are successful. No new landing or publication scan is claimed by this cloud run; the maintained lander owns its scan and custody checks. |

Pre-READY: all assigned inbox outcomes execute on nonempty native data and inspect visible or persisted results; no assertion was removed, narrowed, skipped or moved. Authority, erasure and replay product paths are unchanged. Inbox captures check typography; the Open icon retains its existing focus and hover tooltip, and no new configuration UI exists. Source lock is fresh. No new fixture or email-shaped string was added. Full-history publication scan is NOT RUN in this cloud adaptation: commit=c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3, complete=unestablished, historyScanned=unestablished, findings=unestablished. No claim of a zero-finding scan is made.

## Setup observation

The required rer setup command installed locked dependencies and applied migrations, then failed during its optional application-start step: "SyntaxError: Unexpected token 'U', \"Using secr\"... is not valid JSON" from onboarding/production-runtime.mjs while parsing Wrangler output beginning "Using secrets defined in dist/server/.dev.vars". No secret value is in this report. This unchanged setup issue is separate from the browser harness and is relayed to fv; it does not change the successful touched-check or CI results. No setup or Base code was edited.

## Probes and mechanical handoff

PROBE MOB-001 inbox: native inbox at 360 with two independent submissions -> selected response assigned, tagged, privately noted, Done and filtered; metadata survives reload; second response unchanged; ledger and safe audit agree; all measured controls at least 44 by 44, no horizontal scroll; viewport restored.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock followed by pnpm source:check exit=0; views=node scripts/contract-docs.mjs write MOB-001 followed by check MOB-001 exit=0; ledger=none exit=0.

CLAIM MOB-001 PARTIAL points=none tests=tests/e2e/response-search.spec.ts#operators search responses, see matching answers and download the same filtered records
GAP MOB-001: Complete 360-pixel coverage of every other operator page and state remains unproved; approval flows require unbuilt WORK-002. No DONE or release qualification is claimed.

## Exact head, checks and custody

Branch: cloud/sd-pencil-c-f42. Final full SHA: c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3. Remote product branch equals this SHA, verified with git ls-remote; main equality at receipt: True. Product diff against fetched main is empty. No PR was opened: the workflow runs on a cloud branch push.

Initial product save was the requested starting SHA 955e9eae109eed2a4fdf2fdd49419f94dd181bd4. Main then advanced with two other writers' commits while the packet was being assembled. The published cloud branch merged origin/main by fast-forward, retaining those commits and never rewriting published history. Changes are limited to docs/guide/publish-and-share.md, tests/e2e/hidden-fields.spec.ts, tests/e2e/plain-iframe-hidden-fields.ts and sources.lock.json. All production source, selected inbox tests, native fixture, build scripts, harness and package bytes remain identical; the comparison receipt lists every checked path.

Local browser result: 2 passed, 0 failed, 0 skipped, 0 flaky; desktop 40.0 seconds, mobile 38.4 seconds; overall runtime 206.7 seconds including server setup. The mobile result includes the scoped 360 leg and viewport restoration. The browser result and first-party check are from the starting SHA and carry forward under DONE-RIDERS row 4 with the explicit unchanged-byte proof. Final-head typecheck and all final mechanical commands exit 0. Actual Playwright receipt, hit measurements, unchanged-byte receipt, mechanical receipt and local check receipt accompany this report.

The checkbox label measured 44 by 44 CSS pixels. Open measured 54 by 48; Assign, Set status and Workflow status filter measured 324 by 44; the private-note input measured 272 by 80. All twelve measurements meet both dimension assertions. Five 360 inbox states plus original 1440 and 390 inbox captures were visually inspected and retained. The original fixture retains its synthetic email answers; no new fixture or string was introduced.

Starting exact-SHA workflows:

- Verify candidate: run 42504071498, event push, completed, conclusion success, head 955e9eae109eed2a4fdf2fdd49419f94dd181bd4.
- Verify candidate: run 42502979962, event push, completed, conclusion success, head 955e9eae109eed2a4fdf2fdd49419f94dd181bd4.
- Run site: run 42502980154, event push, completed, conclusion success, head 955e9eae109eed2a4fdf2fdd49419f94dd181bd4.
- Verify candidate: run 42501312553, event push, completed, conclusion success, head 955e9eae109eed2a4fdf2fdd49419f94dd181bd4.

Initial task-branch push observation:

- Verify candidate: run 42505969124, event push, in_progress, conclusion pending, head 955e9eae109eed2a4fdf2fdd49419f94dd181bd4.

Final exact-SHA workflows:

- Verify candidate: run 42505950432, event push, completed, conclusion success, head c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3.
- Run site: run 42505950175, event push, completed, conclusion success, head c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3.
- Verify candidate: run 42504705747, event push, completed, conclusion success, head c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3.

Final task-branch push observation:

- Verify candidate: run 42506128332, event push, in_progress, conclusion pending, head c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3.

GitHub API calls: four run-discovery calls, two for existing exact-SHA runs and two filtered to each pushed task-branch SHA; no polling, log downloads, dispatch or rerun. No run was polled within 300 seconds. The new duplicate branch run is handed off honestly at its observed status. Existing successful Verify and Run site refer to the final exact full SHA.

Packet publication is separate from product readiness. The report-only evidence manifest records the product head and hashes of every explicitly selected file. No credentials, environment dumps, private gate material, symlink, trace archive or setup secret file is selected. Clone removal follows successful product and evidence transfer; the packet is retained outside the clone.
