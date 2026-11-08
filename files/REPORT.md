# sd-pencil-c-f39 — native inbox proof at 360 CSS pixels

Candidate: `955e9eae109eed2a4fdf2fdd49419f94dd181bd4` on `cloud/sd-pencil-c-f39` in just-every/run-pencil. Product branch push succeeded on the first attempt. No PR was created: the repository starts Verify from a cloud branch push. Save commit `fa3cdf9a1a3809dbfc7d255f8a2e60152e28b659` was pushed with skip CI before the final candidate; exact save provenance is also recorded by the candidate history.

MOB-001 remains PARTIAL. The planner-selected inbox slice is locally complete. No full acceptance point, DONE restoration, activation, real-device, provider or release qualification is claimed. Counts stay **142 DONE, 61 PARTIAL, 49 MISSING, 252 total** before and after. No contract wording or Status, Gap or Evidence cell changed. The repository's existing recorded registration count is 277 before and after; this round adds and removes zero registrations. The pre-existing cap overage is not expanded.

## Plan and implementation

The full executed plan is in `PLAN.md`. The round changed only `tests/e2e/response-search.spec.ts`, `tests/e2e/submission-inbox-journey.ts`, the new focused `tests/e2e/submission-inbox-mobile.ts`, and `sources.lock.json`. Production source, CSS, Base pin, migrations, workflow wiring, homepage, identity and generated views are unchanged. There are no feature or requirement changes.

The original two-revision response-search workload, unreleased response, Unicode search, filtered JSON export and 1440 and 390 triage sequence remain intact. The shared capture helper retains the original no-scroll and minimum-text checks at both widths. `ASSERTION-PRESERVATION.json` records that every original assertion line remains in both existing files; no original assertion was put behind a width or environment condition.

The mobile project's new leg creates an independent native form with two different responses through authenticated draft and publish routes and native public collection. It uses the existing release door if the ordinary minimum-fill-time rule quarantines a completion; there is no clock manipulation or database fixture write. It records the original viewport, runs the new leg at an asserted innerWidth of 360 and restores the original viewport in finally, then asserts restoration.

The journey clicks the checkbox label outside its glyph, assigns the selected response, adds a tag, opens it, adds a private note, selects it again, applies Done and filters to Done. After reload it checks the persisted note, tag, assignment and Done status, while the second response remains new, unassigned and unannotated. Native detail and ledger reads check the exact selected response and fixed answer. The audit read checks exactly the four triage kinds, the signed-in actor, the correct form and one changed field for each event. Notes are absent from the ledger and audit payloads.

All 12 measured control uses satisfy both dimensions of at least 44 CSS pixels. `hit-areas-360.json` records actual dimensions: checkbox labels 44 by 44, assignment and status selectors 324 by 44, tag input 324 by 44.390625, Apply buttons 124.84375 by 44, Open 54 by 48, note textarea 272 by 80, Add note 87.265625 by 44, Filter 97.03125 by 44 and workflow filter 324 by 44. The checkbox measurement is of the label and its off-glyph click really toggles selection. No production sizing was changed to obtain these results.

## Actual local results

`BROWSER-RECEIPT.json` is bound to the candidate SHA. The touched browser command passed both projects: **2 passed, 0 failed, 0 skipped, 0 flaky**, total 55.267 seconds including server startup. Desktop retains 1440 by 900; mobile retains 390 by 844 and adds the 360 by 844 scoped leg. The browser uses `/usr/bin/chromium` headlessly with no sandbox and ordinary fresh contexts. The temporary cloud config changes only local browser launch and command paths; CI continues to use the repository's unchanged config.

`CHECKS.json` records exact-candidate commands and real exits: project typecheck 0, first-party rer check 0, and source check including offline Base integrity 0. Only the touched browser test and required mechanical checks ran locally; the complete suite is left to Verify.

`CUSTODY-RECEIPT.json` records mechanical and remote custody. The MOB-001 contract generator write and check both exited 0. Generated `ACCEPTANCE.md` and `docs/CLAIMS.md` were restored whole from origin/main. The generator did not change CONTRACT.md. After the final source edits and merge, the documented lock command regenerated the lock and its check passed. No migration-ledger run was necessary because no migration changed. Final checkout was clean. Full Git history is present. Every candidate author and committer is the fleet identity, trailers are absent and no new email-shaped fixture value was added.

The development runs exposed two incorrect extensions of the proof, both recorded honestly in the custody receipt. First, the new audit assertion initially confused the assignee with the actor; the final journey independently reads the current native auth session and checks that actor and the private-note author. Second, an extra measurement inspected the Back to form results link, which the scoped 360 leg never uses. That pre-existing link is 40 pixels high. Its newly added, out-of-scope measurement was removed; none of the original navigation assertions changed. The final scope covers every control actually exercised in the 360 triage leg. The 40-pixel link remains a follow-up within the wider PARTIAL mobile clause, not a production change in this proof round.

Screens in `screens/` show the original inbox at 1440 and 390 and the independent 360 initial, bulk, private-note, filtered-Done and reloaded states. The changed states were visually inspected. No horizontal scroll was observed; the journey asserts document width at every measured control and at every captured state. Text checks retain the 13-pixel floor. The existing Open submission tooltip is asserted on keyboard focus; the unchanged shared tooltip CSS supplies the 300 ms hover delay and immediate focus visibility. The original screenshots retain the existing fixture's synthetic mailbox; the independent new fixture adds no mailbox or other email-shaped value.

## Frozen scoped proof map

Every row below uses `tests/e2e/response-search.spec.ts` — “operators search responses, see matching answers and download the same filtered records”. The helper line references are at the candidate SHA. Local browser event: dedicated touched command, exit 0. Candidate CI event: push, Verify run 42501312553, status **in_progress, conclusion not yet available**. These rows describe the selected slice, not an expansion or replacement of the full clause.

| Row | Scoped outcome | Public-door proof | Result |
| --- | --- | --- | --- |
| S1 | Independent native data, existing workloads retained | New helper lines 11–31; existing search fixture and original triage unchanged | PASS locally |
| S2 | Actual 360 width and viewport restoration | New helper lines 38–52 and 134–137 | PASS locally |
| S3 | Review, assignment and tag | New helper lines 65–83, 110–117; actual inbox controls and detail route | PASS locally |
| S4 | Private note and correct author, no ledger or audit note exposure | New helper lines 84–90, 113–132 | PASS locally |
| S5 | Done, filter exclusion and reload persistence | New helper lines 91–121; comparison response stays unchanged | PASS locally |
| S6 | Exact matching ledger and audit outcomes | New helper lines 122–132; actual native endpoints, exact IDs and audit families | PASS locally |
| S7 | No horizontal scroll and 44-pixel effective exercised controls | New helper lines 40–48 and all hit calls; shared helper lines 80–91; actual dimensions in receipt | PASS locally |
| S8 | Original 1440 and 390 journey and screens retained | Existing helper lines 11–76; screenshots and assertion-preservation receipt | PASS locally |

## Full acceptance, inherited duties and DONE-RIDERS

| Item | Result | Proof or honest missing outcome |
| --- | --- | --- |
| MOB-001 operator-page sentence | PARTIAL | Inbox review and triage proven at 360; every operator page and every state at 360 are not covered. |
| MOB-001 acceptance sentence: phone-width build and publish, review, approve | PARTIAL | This round proves native inbox review and triage only. The fixture's API publication is setup, not proof of phone builder and publication. Approval needs unbuilt WORK-002. |
| Inherited WORK-001 inbox duty | PASS for retained and extended browser slice | Existing helper lines 11–76 retains assignment, tags, notes, Done, reload, ledger and audit at 1440 and 390; new helper repeats with independent native data at 360. WORK-001 native authority and custody tests are unchanged and were not rerun locally. |
| Rider 1 — every acceptance outcome reached | FAIL for whole MOB-001 | Dashboard, builder and publication, results, ledger, actions, Settings and remaining operator states at 360 remain owed; approval remains unbuilt. Scoped rows S1–S8 pass locally. |
| Rider 2 — real seeded data and independently expected outcomes | PASS for scoped slice | Two native completions, exact selected response, untouched comparison, fixed answer, persisted annotation and exact audit families; new helper lines 11–132. |
| Rider 3 — exact-SHA green Verify | PENDING | Push Verify 42501312553, in_progress, conclusion not yet available. No env flag is needed for the new leg; it runs in the ordinary mobile project. |
| Rider 4 — current proof | PASS locally | Exact-SHA browser and command receipts; all seven screenshots come from that run. |
| Rider 5 — inheritance written | INSPECTED | MOB-001 itself names inbox, page width, touch targets and scrolling. No new Base duty or inheritance claim was introduced. |
| Rider 6 — source, views, Gap and counts | PASS mechanically; status retained | Generator write and check 0; generated views restored, counts unchanged, Status cells not edited. Broader PARTIAL gap is retained. |
| Rider 7 — acceptance changes only by ruling | PASS, INSPECTED | No acceptance, ruling, coverage-map or clause-text change. |
| Rider 8 — dangerous authority paths | OUTSIDE THIS PROOF DELTA | No authority code changed; existing WORK-001 native authority tests retained. This round claims neither a new authority guarantee nor approval. |
| Rider 9 — provider and legal boundaries | PASS, INSPECTED | Emulated Chromium proof only, no real-device, provider, legal, activation or release qualification. |
| Rider 10 — policy defaults | PASS, INSPECTED | No new policy choice or default. |
| Rider 11 — counted only after guarded landing | PENDING | Branch-only candidate; main equality, full-history publication scan and resulting-main Run site remain lander duties. |

## Pre-ready self-check and provenance

1. All selected inbox outcomes have runtime assertions on populated data, with the independent comparison response proving selection and filter discrimination. Entire MOB-001 acceptance is not complete and no DONE is claimed. Candidate Verify is in_progress, conclusion not yet available.
2. Every original assertion line and workload remains; only the added mobile leg is project-scoped. A newly added measurement of an unused navigation link was removed as explained above; no original user-flow guard was removed or weakened.
3. No authority, erasure, replay or persistence implementation changed. New proof checks note custody in detail, ledger and audit and confirms the other response stays unchanged. It does not claim broader erasure or revoked-credential proof from this run.
4. Existing inbox screens were inspected at all required widths; text-floor and Open tooltip checks pass. No screen, navigation structure, configuration placement or styling changed.
5. Exact local source lock and checks pass. Candidate Verify is in_progress, conclusion not yet available. Candidate Run site and publication scan are not established in cloud. The observed main at `9183d1bddd25a6191fe527186b28d2b458249a03` has green Verify 42497362684 and green Run site 42497362710; these runs are not candidate evidence.

Exact-tree scan result: `commit=955e9eae109eed2a4fdf2fdd49419f94dd181bd4 complete=false historyScanned=false findings=not-run`. The cloud branch push does not require a cloud-side scanner; the Mac lander must run its complete full-history publication scan with zero findings. No clean scan result, main equality or landing is claimed here.

Main remains `9183d1bddd25a6191fe527186b28d2b458249a03`; remote product branch equals candidate `955e9eae109eed2a4fdf2fdd49419f94dd181bd4`. Fetch and merge reported already up to date before final lock and commit. No published history was rebased or force pushed. No CI dispatch or rerun was requested. GitHub calls: three total — one main exact-SHA discovery, one candidate exact-SHA discovery, and one candidate status read at least 300 seconds later. The final observed state is retained in CI-STATUS.json. No job-log archive call was needed.

## Probes and handoff

PROBE MOB-001 native-inbox-360: authenticated native form with two public-route completions, then inbox selection, assignment, tag, private note, Done, filter and reload at 360 -> exactly one annotated Done response, one unchanged New response, matching ledger row and four safe actor-bound audit entries; all exercised targets at least 44 by 44 and no horizontal scroll.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write MOB-001 and check MOB-001 exit=0; ledger=none exit=0.

Plan row result: MOB-001 selected inbox slice is proven, PARTIAL stays PARTIAL. No shipped plan file was edited. Remaining 360 coverage and WORK-002 remain held exactly as supplied. No second clause from the extract touches this same file set. No new account, key, provider or Base dependency was introduced. No real blocker to landing this test-only progress was found.

CLAIM MOB-001 PARTIAL points=none tests=tests/e2e/response-search.spec.ts#operators search responses, see matching answers and download the same filtered records
GAP MOB-001: Complete 360-pixel coverage of dashboard, builder and publication, results, ledger, actions, Settings and other operator states remains unproved; approval needs WORK-002. The existing unused Back to form results link measures 40 pixels high. No DONE, activation or release qualification is claimed.
