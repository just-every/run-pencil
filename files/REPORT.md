# sd-pencil-c-f51 results

Candidate: 1e65537decf1b294c86fce248432849d49eaa748.
Repository: just-every/run-pencil. Branch: cloud/sd-pencil-c-f51. No PR is needed: the existing push workflow accepts cloud branches.

DIST-014 remains PARTIAL. This proof-only round closes the planner-selected missing non-NPS scanner and short-choice confirmation paths. CONTRACT.md, its judgments, acceptance text and generated views are unchanged. Counts remain 142 DONE, 61 PARTIAL and 49 MISSING (252 total). Test-budget metadata remains 277 registrations and 380 expanded cases; this round adds and removes zero registrations. The two original registrations and every pre-existing assertion remain intact.

The full plan is in PLAN.md. No Mac plan row was edited. The DIST-014 campaign row should record completion of these scoped proof points while retaining its existing holds.

## Changes and runtime probes

- The existing emitted-worker scanner registration calls a focused helper with separately authored CSAT 1–5, published rating 0–3, and three stable-ID short-choice forms. Expected numeric bounds and authored choice identities are independent of the production eligibility helper. Genuine relay text and HTML must carry exactly the expected answer links. Twelve unique non-NPS buttons receive 48 requests (GET, HEAD, GET, HEAD). Every request must return 200, HEAD must have an empty body, and the full participant row and relevant session, response, answer, view-counter and start-counter tables must remain identical. Existing NPS scans, malformed hints, immutable revision admission, completion and closure checks remain untouched.
- The existing browser registration calls a focused helper with its own three-choice native form and real captured invitation. Three invalid hints (unknown, negative and out-of-range numeric) select no radio, show no email selection, perform no public POST and leave traffic, the ledger and participant state unchanged. A genuine Drawing workshop mail button opens question two with an unsubmitted selection; returning to question one reveals exactly that radio selected. Explicit Continue and Submit carry its stable choice ID, store one released response, and replay returns the same receipt with idempotent true. Reload and the ledger still show one response and one submission. All contexts close in finally.
- Production eligibility, composer, deliveries, invitation route and respondent UI are unchanged. Existing revision, closure, opt-out, prefill, confirmation, erasure, workload and privacy assertions remain in the original journeys.

PROBE DIST-014 1: emitted production invitation route, each CSAT, published rating and short-choice mail button with repeated GET and HEAD -> 48 successful requests, no participant or collection-state write.
PROBE DIST-014 2: captured short-choice email click -> next question and Drawing workshop uncommitted; unknown and out-of-range hints -> no selection; explicit completion and replay -> one response with the declared stable ID.

## Acceptance and inherited-duty map

The clause has two acceptance outcomes, reported as points 1 and 2. Its additional normative sentences are recorded separately below; no new acceptance point was added.

| Item | Proof on candidate | Result |
| --- | --- | --- |
| Acceptance 1: fetch every emitted answer link as a scanner and find no answers or sessions | tests/invitation-links.test.ts, existing emitted invitation answer links registration, helper tests/helpers/invitation-scanner-proof.ts:10–75 | PASS; exact-SHA Verify push 42534636287 completed success |
| Acceptance 2: click 9, land on question two and complete | Existing NPS leg of tests/e2e/distribution-foundation.spec.ts:161–257, same original registration; added stable-choice helper tests/e2e/invitation-choice-proof.ts:74–117 | Local PASS at 1440 and 390; receipt in CHECKS.json; exact-SHA Verify push 42534636287 completed success |
| NPS, CSAT, published rating and short-choice buttons | Original NPS fixture plus independent CSAT, explicit 0–3 rating and authored-choice fixtures, scanner helper:14–46 | Local PASS for these supported invitation examples |
| Clicking selects a value but the GET and HEAD write no answer, session, response, views, starts or participant state | Scanner helper:48–75; browser helper:43–46 and 74–84 | Local PASS |
| Selection stays uncommitted until explicit interaction and stores the same choice once | Browser helper:79–117, real native request, authenticated ledger and replay | Local PASS at 1440 and 390; receipt in CHECKS.json |
| Unknown and out-of-range hints select nothing | Browser helper:58–72; existing NPS malformed-hint checks retained | Local PASS at 1440 and 390; receipt in CHECKS.json |
| Revision admission, closure, opt-out and normal completion still apply | Existing scanner and full distribution browser journey, unchanged assertions | Local PASS; receipt in CHECKS.json |
| Only eligible published-path questions render buttons; other first types and operator-locked prefill do not | Production source inspected unchanged; this round proves only its selected eligible examples | Remaining eligibility combinations not claimed |
| Reminders share the composer | src/core/features/distribution/deliveries.ts and message.ts inspected unchanged | INSPECTED; all reminder combinations not claimed |
| PROG-002 inherits before program email ships | Clause already names the duty; program orchestration is unbuilt and account-held in the plan | NOT CLAIMED |
| Provider boundary and consent | Emitted relay stand-in and local captured mail only; no provider mailbox or consent used | NOT CLAIMED |
| Privacy, erasure and replay | Scanner full-row no-write checks; original audience erasure and revoked-link assertion retained; new same-receipt replay | Local PASS; receipt in CHECKS.json; no broader authority change |

## DONE-RIDERS

| Row | Assessment against this PARTIAL candidate | Evidence |
| --- | --- | --- |
| 1 | PARTIAL for full clause; scoped missing outcomes exercised | Both existing registrations and focused helpers; program and remaining eligibility proof not claimed; current exact source anchors are in PROOF-INDEX.json |
| 2 | PASS for scoped no-write and once-only guarantees | Real authored data, genuine emitted links, full state snapshots, invalid hints, native ledger, replay |
| 3 | PASS on exact-SHA push Verify 42534636287 | Verify push 42534636287 completed success on the full candidate; it loads both existing registrations. Helpers run without flags; only screenshot saving uses PENCIL_CAPTURE_DIR |
| 4 | PASS for local candidate proof | CHECKS.json binds commands to full candidate; no relevant bytes changed after the checks |
| 5 | INSPECTED | DIST-014 already names PROG-002 inheritance; no inheritance or clause rewrite |
| 6 | PASS mechanical generation, no judgment change | Generator write and check succeeded, generated views restored; all status cells remain main's bytes |
| 7 | PASS | No acceptance, rider, coverage or contract edit |
| 8 | PASS for scoped privacy boundary | Inert capability scans and invalid hints make no state changes; authority production is unchanged |
| 9 | PASS honest boundary | No real provider delivery, mailbox qualification or consent is claimed |
| 10 | PASS | Existing 23 October approved semantics retained; no new policy default |
| 11 | PENDING guarded lander | Main equality, complete full-history publication scan and Run site receipt are not established by a cloud branch push |

## Checks and limitations

CHECKS.json records actual commands, exits, full heads and log digests. The final candidate runs the production build, touched scanner, normal typecheck, first-party check, fresh source check and complete touched browser registration at 1440 and 390. SCREEN files preserve the changed email, invalid-hint, deferred-selection and completion screens at each width. The accessibility and overflow checks remain active. The helper uses fixed CSS viewports, with mobile UA scaling disabled for its separate mail-viewer contexts, and asserts innerWidth equals the requested 1440 or 390 before the mail screenshot. The original mobile journey retains its existing device emulation. Respondent buttons and choice controls are text-labelled; no UI control or style was changed.

An initial local browser run on the published save caught an incorrect expectation in the newly added replay assertion: the replay correctly changed idempotent from false to true. The final candidate explicitly requires false on the original released receipt and true on the replay with every other receipt field unchanged. No original assertion was removed or narrowed. An initial temporary browser configuration used /tmp as its server cwd; setting that external configuration's cwd to the checkout fixed the launch. A subsequent full run exposed another invalid new assertion: ledger query cutoffs are assigned afresh on each read. The final comparison permits that request timestamp to vary while still comparing every retained business field exactly. No fixed wall-clock timestamp is asserted. These test-construction corrections change no production behavior.

Pre-ready self-check: scoped user-visible behaviors have public-door assertions; no existing assertion was removed, weakened or hidden behind a width condition; no authority, erasure or production replay path changed; new fixtures contain no email-shaped literal or provider-shaped key. The source lock is generated, not hand-edited. Publication scanning, main equality, final clause judgment and Run site are the Mac lander's independent duties and are not reported as already complete.

GAP DIST-014: Program email and orchestration under held PROG-002, remaining first-question eligibility and reminder combinations, and real mailbox qualification remain outside this scoped proof. No DONE, activation, release qualification or real provider delivery is claimed.

All final build, scanner, browser, typecheck, first-party, generated-document and source-integrity checks passed on the final full head. Earlier local attempts remain in the actual receipt for transparency. No product blocker is known after passing local touched checks. CI and terminal product custody are recorded separately in CI.json and PRODUCT.json. Evidence publication is report transport only and grants no acceptance or landing authority.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node scripts/contract-docs.mjs write DIST-014 and check DIST-014 exit=0; ledger=none exit=0.

The exact upstream main ae8ee162c63e3b970d7ee61eec82614bcf9e2c06 was observed green: Verify candidate push run 42529157765 and Run site push run 42526036281. These are upstream health evidence only, not candidate evidence.

Final product custody: pushed=true, remote head verified as 1e65537decf1b294c86fce248432849d49eaa748; branch cloud/sd-pencil-c-f51; no PR. Verify push run 42534636287 is recorded in CI.json. Publication scan commit=1e65537decf1b294c86fce248432849d49eaa748 complete=NOT-RUN historyScanned=UNESTABLISHED findings=UNESTABLISHED (guarded Mac lander duty). Main equality is false at this cloud handoff: observed main remains ae8ee162c63e3b970d7ee61eec82614bcf9e2c06. No candidate Run site receipt is claimed.

Visual inspection: all four new states were captured at each width, with PNG widths verified as exactly 1440 and 390. The phone email, desktop email, deferred selection and completed state were inspected. The updated email fixture changes only the test viewer viewport, not the emitted email or application.

Final local result: production build exit=0; production emitted-worker scanner 1 passed; touched browser registration 2 passed in 2.2 minutes (1440 and 390); typecheck exit=0; first-party exit=0; source integrity exit=0; contract generator write and check exit=0. Every final command is bound to 1e65537decf1b294c86fce248432849d49eaa748 in CHECKS.json.

CLAIM DIST-014 PARTIAL points=1,2 tests=tests/invitation-links.test.ts#emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses; tests/e2e/distribution-foundation.spec.ts#invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey

Final CI result: Verify candidate push run 42534636287 completed SUCCESS on exact head 1e65537decf1b294c86fce248432849d49eaa748. URL: https://github.com/just-every/run-pencil/actions/runs/42534636287. Six GitHub calls were used, including upstream health, discovery and three rate-limited candidate polls. No dispatch, rerun, failed-job download or PR was needed. Local acceptance proof and exact-SHA branch Verify are green. The remaining clause scope is honestly PARTIAL and row 11 remains with the guarded lander.

Final self-check: no blocker is known; source lock is fresh; no production byte, generated view, status cell, pre-existing assertion or registration was changed. Publication scan, main equality and Run site remain unestablished for the candidate until the Mac lander performs its guards.

READY repo=just-every/run-pencil branch=cloud/sd-pencil-c-f51 head=1e65537decf1b294c86fce248432849d49eaa748
