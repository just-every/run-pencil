# sd-pencil-c-f58 — respondent ACH processing

Repository: https://github.com/just-every/run-pencil
Branch: cloud/sd-pencil-c-f58

## Scope and plan

1. Read the live PAY-004 clause, its Status gap, the supplied campaign extract, RL-102 and DONE-RIDERS. Map the existing native money journey and existing browser registration before changing behavior.
2. Extract only the completion payment notice into RespondentPaymentNotice.tsx. Use the authoritative PaymentState already returned to RespondentFlowPage. Give processing a readable pending explanation, a polite atomic status notice, a clock and the existing pending color tokens. Preserve the paid, refunded and generic confirmation wording for other states.
3. Extend the existing calculations browser registration through payment-processing-proof.ts. Complete the real native fixture Checkout, correlate its native Checkout session to the authenticated ledger, inspect processing on the genuine return, reload that return before settlement, deliver signed success and revisit it, retaining the response, answers and original attempt. Retain the existing ACH operator-record checks and all other workloads and assertions.
4. Run the touched browser journey at 1440 and 390 with the supplied Chromium, the existing native payment registration, typecheck and first-party checks. Generate and check contract views, restore both generated view files, merge fresh main without rewriting the published save, regenerate the source lock last and check it.
5. Publish the product candidate only on the named cloud branch. Discover its exact-SHA Verify through REST. Keep complete reports and actual receipts in a separate report-only evidence ref. The maintained lander owns scanning, landing and exact-main Run site.

No contract text, acceptance point, Status, Gap or Evidence cell is edited. No registration, backend, reporting, payment-return, payment-service or fixture-receiver change is included. Homepage, branding and logos are unchanged. The plan's PAY-004 row gets scoped processing-presentation evidence only; no plan or inbox file is written from cloud.

## Acceptance map and honest boundaries

PAY-004 remains PARTIAL. Before and after counts: 142 DONE, 61 PARTIAL, 49 MISSING (252 clauses). The complete acceptance sentence also requires a PayPal fixture order to paid; this run cannot claim that combined sentence complete.

| Item | Proof and result |
| --- | --- |
| Selected POINT: dedicated respondent processing presentation | Existing calculations browser registration invokes payment-processing-proof.ts through the native collection, Checkout and return doors. It compares processing against the authenticated ledger, checks an accessible pending notice and distinct pending icon and color treatment. |
| Selected POINT: genuine reload while processing | Reload of the captured genuine return reads completed response with payment processing, retains the pending notice and verifies the same stored response IDs. No invented return token or payment-return mock is used. |
| Selected POINT: signed success and paid revisit | Existing signed fixture event updates the same payment, the operator still sees Paid and ACH last four digits, and revisiting the same return shows the existing paid notice with the same response, answers and attempt. |
| ACH native success and failure | Existing calculations Worker registration retains its processing-to-paid and processing-to-failed branches, duplicate-event refusal, processing admission exclusion, archive custody and erasure assertions. |
| PAY-004 full provider target and acceptance | NOT COMPLETE. Alternative PayPal or Square implementation and named PayPal order remain omitted. PayPal sandbox account is not held; this task does not establish any Square provider qualification. Genuine Apple Pay, Google Pay and ACH test-mode settlement, failed ACH retry and wider provider qualification remain unproved. |
| PAY-001 inherited payment-state custody | Existing authority and native event processing remain unchanged. The respondent notice uses the state supplied by the existing return API; browser correlation and signed-success revisit exercise that state rather than deriving paid status from navigation. Plain-iframe payments and Connect OAuth remain held. |
| RL-102 retry custody | No new policy or retry door. The approved temporary refusal remains in place; terminal-attempt verification, original evidence and atomic replacement duties remain owed. |

## DONE-RIDERS review

| Row | Assessment |
| --- | --- |
| 1 | PARTIAL for full clause: chosen processing outcomes are exercised, but PayPal and remaining provider outcomes are not proved. |
| 2 | Existing native payment journey exercises signed success and failure, duplicate refusal, unpaid admission and erasure; unchanged. Browser proof checks real native seeded records and preserves their identity. |
| 3 | Browser helper is invoked unconditionally by the existing Verify registration at both widths. Exact-SHA CI status is recorded in the final receipt; no green run from another SHA is substituted. |
| 4 | Final product and test bytes are bound by the final receipt; earlier local proof is credited only where relevant bytes are identical. |
| 5 | PAY-004 already explicitly inherits PAY-001 payment state. No receiving obligation or clause text is changed. |
| 6 | Incremental PAY-004 generator write and check pass; generated views are restored from main and not committed. Existing Gap cells are deliberately unchanged under the single-writer rule. |
| 7 | No acceptance point, ruling, coverage rewrite or clause status changes. |
| 8 | No permission, refund or correction door changes. Existing payment-authority assertions remain intact. |
| 9 | Fixture-only proof; no live provider, wallet, ACH settlement or release qualification claimed. |
| 10 | No new custody, spending, consent or authority default. RL-102 remains the existing approved interim retry rule. |
| 11 | Pending guarded landing: main equality, exact-main Run site and full-history publication scan belong to the maintained Mac lander. This cloud report is not a landing receipt. |

## Pre-ready review

The selected processing behavior has a runtime assertion through the genuine respondent door. Existing assertions are preserved; only the ACH generic-confirmation expectation is replaced by the dedicated pending expectation, and its operator-record assertions are moved intact into the focused helper. No assertion is moved behind a width or environment condition. Existing replay, authority, admission, failure, archive and erasure workloads remain. Both touched return states have no icon-only control; their decorative icons are hidden from accessibility. Notice text inherits 15px, uses a complete border on every side and adds no configuration control. The clock is static and introduces no motion.

Publication scan: NOT RUN in cloud, as explicitly assigned to the maintained lander. complete, historyScanned and findings are unestablished here. No DONE, live-provider or landing claim is made. Candidate main equality and Run site are pending lander custody. Product and evidence publication are independent.

## Local harness note

The first temporary browser configuration resolved its web-server command relative to /tmp and failed before running a test with MODULE_NOT_FOUND for /tmp/scripts/run-e2e-server.mjs. Only the temporary configuration was corrected to use the product checkout as cwd. No product fix, skipped assertion or CI repair was applied for that harness error.

## Candidate and observed proof

Product head: `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef` on `cloud/sd-pencil-c-f58`.
First pushed save: `1350e7c` (pending presentation; skip-CI save). Final product commit adds the existing-registration extension and fresh source lock. The fresh-main merge was already up to date at `6bb7927ecf707cec630874ddec40a4faa77825f5`; no published history was rewritten. Both candidate commits have the fleet author and committer identity and no trailers. CONTRACT.md has no candidate diff.

The one-off public-door probe imports and executes the exact committed payment-processing-proof.ts helper. It creates its own native published form, submits through the ordinary respondent page, pays through the existing loopback Checkout, reads authenticated ledger records, reloads the genuine return before settlement, delivers signed success and revisits the same return. It adds no registration to the product. The probe passes at 1440 in 19.3 seconds and at 390 in 21.7 seconds; its actual Playwright JSON records two expected tests, zero unexpected, zero skipped and zero flaky. Both widths show the pending clock and notice, then the paid presentation; screenshots are included separately. The app and test bytes are unchanged between this successful probe and the committed head; only sources.lock.json was regenerated afterward.

PROBE PAY-004 1: Native ACH fixture Checkout at 1440 and 390 -> authoritative payment processing, accessible pending notice, genuine processing reload, signed success, existing paid presentation, same response and answers, attempt 1.

MECHANICAL lock=pnpm source:check exit=0; views=node scripts/contract-docs.mjs write PAY-004 and check PAY-004 exit=0; ledger=none exit=0.

Final typecheck and first-party checks exit 0. Source freshness and offline Base-copy integrity both pass; no migration was added. The generator reports 142 done, 61 partial and 49 missing. Both generated views were restored from origin/main and are absent from both product commits.

Exact candidate Verify: push run `42585055043`, https://github.com/just-every/run-pencil/actions/runs/42585055043 . Its observed conclusion is retained in CI.json and RECEIPT.json. At first discovery it was in progress on this exact full SHA. No PR is required for the existing cloud-branch push entry point, and none was opened. The observed main had successful Verify `42569717083` and Run site `42569717140`; those are baseline receipts, not candidate success.

The earlier complete browser registration on Node 22 reached the new processing notice and genuine processing reload, then exceeded its unchanged 240000 ms limit while making a ledger read. New duplicate accessibility scans and a duplicate screenshot, added only during this round, were removed from the new helper; no original main assertion was removed. The new helper also had a response-body race exposed by the one-off probe: reading a submission body after navigation could find its browser resource discarded. It now correlates the actual hosted Checkout session and native response, and awaits each genuine return API response before asserting its state and presentation. This is a test synchronization correction, not a backend or payment-state change.

Local infrastructure notes: Node 24 plus concurrent checks produced a settings request that remained pending until the five-second assertion deadline, and the broad unchanged native payment test timed out at 30000 ms. Node 22 enabled the browser journey to reach the target screens. A cold browser server also exceeded its temporary configuration's 120000 ms startup allowance before tests ran; only that external temporary allowance was increased to 300000 ms. Product workflow and test timeouts remain untouched. Baseline comparison results are recorded below when complete.

The unchanged main native payment registration also fails locally under Node 22 on the same runner: `tests/runtime/calculations.worker.test.ts:789` receives HTTP 400 with “Stripe could not be reached. Your answers are saved; retry to continue to payment.” It emitted the same Workerd disconnected-transport class seen in the candidate attempt. The exact command is in baseline-worker.log. Main's recorded exact-SHA Verify was successful; no native test or payment backend change is made to guess at this cloud transport failure. This local native result is NOT counted as a passing money journey.

The unchanged main browser registration passes on this cloud runner under Node 22 with its original 240000 ms limit: one desktop test, 3.5 minutes (4.9 minutes including server startup), zero failures. Its full browser JSON and log are included. The final candidate's complete original registration is rerun at both widths after the test synchronization correction; results are recorded in the final receipt. No product timeout is increased.

Final complete-registration local result: NOT PASSING, two failures before the new helper. Desktop stops at the unchanged embed fallback assertion in calculations.spec.ts:432 (Continue to Stripe Checkout not visible within 5000 ms); the log records a recovered Workerd connection drop. Mobile stops in the unchanged first public form-load wait at calculations.spec.ts:162 (no successful views response within 15000 ms). No protected assertion, workload or timeout was weakened to make either pass. The same complete main desktop registration passed as recorded above. The focused public-door helper still has its successful 1440 and 390 receipt bound to this exact committed source. Candidate-browser.json and candidate-browser.log preserve the actual full-run failures; this report does not call that local full run green.

## Exact-SHA CI outcome and handoff

Verify candidate push run **42585055043** completed **success** on **0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef**. The exact REST result is CI.json; CI-initial.json records the push event and run identity at discovery. Six GitHub API calls were used, with at least 300 seconds between observations of the candidate run. No dispatch, rerun, PR, main push or force push was performed. Full Verify success is distinct from the local transport failures preserved above, and includes the existing native payment and both browser lanes that load this helper. The scoped processing behavior is ready for guarded landing. PAY-004 remains PARTIAL; no count change is proposed.

Scoped code and proof references on the exact candidate:
- RespondentPaymentNotice.tsx:4-10 renders the existing authoritative state, a polite atomic status notice, pending clock and explanatory pending wording, and preserves paid and refunded wording.
- respondent.css:33-35 applies only the pending state's existing color tokens and full border.
- calculations.spec.ts:567 invokes provePaymentProcessing inside the existing registration, with no added registration or width gate.
- payment-processing-proof.ts:7-20 performs the native Checkout and reads the genuine processing return; lines 22-33 correlate the authenticated payment and response; lines 35-44 check the accessible pending presentation; lines 53-68 capture and reload the genuine processing return; lines 70-83 retain the existing operator processing and signed-success checks; lines 85-98 revisit the same return as paid and assert the same response, answers and attempt plus distinct visual treatment.
- calculations.worker.test.ts:782-812 retains processing, duplicate-event refusal, admission exclusion, archive, signed success and failure, and erasure. This native test is included in the successful exact-SHA Verify; its local transport failure is separately recorded.

CLAIM PAY-004 PARTIAL points=none tests=tests/e2e/calculations.spec.ts#builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals; tests/runtime/calculations.worker.test.ts#preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal
GAP PAY-004: The dedicated respondent processing presentation and genuine reload and paid revisit are proved. PayPal or Square implementation, the named PayPal fixture order, genuine wallet and ACH settlement, failed ACH retry and wider provider qualification remain omitted. PayPal sandbox account is not held. Existing PAY-001, authority, activation and release holds remain unchanged. No new policy default was adopted.

The claim uses points=none because PAY-004's combined acceptance sentence still includes the omitted PayPal order; this does not withhold the completed planner-selected processing POINT. Counts stay 142 DONE, 61 PARTIAL, 49 MISSING. The only plan row updated by this report is PAY-004's scoped processing proof; no shipped plan file is edited. No blocker remains for this scoped product change. The maintained lander must perform its own complete publication scan, guarded landing and exact-main Run site before counting any landing.
