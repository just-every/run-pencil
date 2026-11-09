# sd-pencil-c-f60 — PAY-004 processing presentation

Repository: just-every/run-pencil. Branch: cloud/sd-pencil-c-f60.
Head: 0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef.

## Result and scope

The supplied predecessor and freshly fetched origin/main are the same commit. Main already contains the dedicated respondent pending notice, pending visual treatment, component extraction and the extended native ACH browser proof. There is no predecessor delta to replay, no product edit and no new commit. All other writers' commits, contract judgments, generated views and existing workloads remain intact. No PR is needed: this repository starts Verify from the named cloud branch push.

Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. PAY-004 remains PARTIAL. No plan row or contract Status, Gap or Evidence cell was edited. The scoped processing item is already implemented on main; this round revalidates it and returns the actual proof packet. No release, activation, live provider qualification or DONE is claimed.

The full execution plan is in PLAN.md. Setup refreshed the fleet bundle, configured the decrypted-bundle Git helper, installed identity-preserving hooks and used full Git history. The first setup attempt could not fetch pinned pnpm; the documented npm fallback installed pnpm 10.12.4 under the owner's local tool cache, and setup then completed. Proof commands use Node 22.20.0, pinned pnpm and system Chromium with the sandbox disabled for this container. No keys were read into reports and no live provider was called.

## Requirement and proof map

The clause's acceptance sentence combines native ACH success and failure with a PayPal order. It has no numbered acceptance list. Since the PayPal outcome is absent, the claim does not mark that combined acceptance point complete.

| Item | Existing public-door proof on this head | Status |
| --- | --- | --- |
| Native ACH can enter processing, then succeed or fail | tests/runtime/calculations.worker.test.ts, “preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal”, lines 781–813; native submission and signed public webhook routes; success and failure, duplicate delivery, response admission, archive and erasure assertions | Exact-head push Verify 42585055043 success; local native runs failed in earlier unchanged sections, so no local native PASS is claimed |
| Processing presentation follows authoritative persisted payment state | tests/e2e/calculations.spec.ts, “builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals”, calls payment-processing-proof.ts at line 567; helper lines 7–34 and 52–59 compare the genuine Checkout return with authenticated response ledger custody | Exact-head push Verify success; fresh browser result recorded below |
| Accessible pending label and corresponding pending visuals | helper lines 36–44 and 59–60: accessible status, polite atomic announcement, processing text, no paid text, clock instead of check; lines 92–94 compare icon color and background with paid; RespondentPaymentNotice.tsx lines 4–8 and respondent.css lines 30–35 provide the presentation | Exact-head push Verify success; fresh screenshots recorded below |
| Genuine return reload remains processing | helper lines 53–67 reload the same return URL and assert authoritative processing plus the same response IDs | Exact-head push Verify success; fresh browser result recorded below |
| Signed settlement and revisiting the genuine return preserve paid presentation and the same response | helper lines 69–97 deliver signed success, inspect the authenticated payment record and ACH method, revisit the genuine return, assert paid presentation and identical response answers and IDs | Exact-head push Verify success; fresh browser result recorded below |
| PAY-001 payment-state inheritance | CONTRACT.md line 409 explicitly inherits PAY-001; unchanged PaymentReturnPage.tsx passes the returned payment state to RespondentFlowPage.tsx, which uses RespondentPaymentNotice; payment-responses.ts and payments/service.ts retain authority | INSPECTED; the existing native money journey at line 213 passed locally, including signature refusal, authority, replay, retention and erasure assertions |
| Alternative providers and PayPal fixture order | No implementation or provider account proof added | UNMET; clause remains PARTIAL |
| Genuine wallet and ACH test-mode settlement and safe failed-ACH retry | No real provider call or retry implementation added; RL-102's safe replacement obligation and temporary refusal remain unchanged | UNMET; clause remains PARTIAL |

## DONE riders

| Rider | Result | Evidence or boundary |
| --- | --- | --- |
| 1 | FAIL for full DONE | PayPal fixture order and alternative providers are not proved. The scoped pending behavior is covered by the existing browser helper. |
| 2 | PASS for existing native dangerous paths; full clause remains incomplete | Existing native journey line 213 passed in both complete local runs: supported payment, refused forged amount and signature, authority, replay and erasure. The combined later registration did not finish locally; exact-head Verify is green. |
| 3 | PASS for existing scoped proof | Push Verify 42585055043: checks, builds, all eight shards and final verify succeeded on the exact head; jobs are in verified-head-jobs.json. Both viewport projects use the existing registration, without an environment gate. |
| 4 | PASS | Product bytes and tests are unchanged from the successful exact-head run. Fresh browser results are recorded separately. |
| 5 | PASS | PAY-004 explicitly inherits PAY-001 in CONTRACT.md line 409. |
| 6 | PASS mechanically; stale dedicated-label Gap left for the authorized writer | PAY-004 generator write and check exited 0. Generated views were restored whole from origin/main. Counts and Status cells were not changed. |
| 7 | PASS | No acceptance point or obligation was edited. |
| 8 | PASS for unchanged tested authority; no new authority surface | Native payment journey line 213 retains non-owner connection refusal and signed-event authority. No source changed. |
| 9 | FAIL for full provider qualification | Loopback fixture only; genuine wallet and ACH settlement and PayPal remain unproved. |
| 10 | PASS for this round | No new default adopted. Existing RL-102 approval and its safe-retry rider are retained. |
| 11 | Existing exact-head main and CI established; fresh scan unestablished | Fresh origin/main initially equals the full head; Verify 42593015478 and Run site 42593015597 are successful on it. The full-history publication scan belongs to the maintained lander. No fresh scan COMPLETE result is invented. |

## Pre-ready self-check

1. The scoped processing behavior has executable public-door assertions in the existing browser registration, loaded by a successful full exact-head Verify. The full clause still lacks outcomes and is not DONE.
2. Product diff is empty. No existing assertion, workload, registration, test width or branch was removed, narrowed or skipped in source. Diagnostic test selection is recorded honestly in the receipts.
3. Authority, replay and erasure production paths were not changed. The existing money journey at line 213 passed locally. Fresh native observations in the later combined test are retained without claiming success.
4. The pending notice uses 15px text and one complete rounded border. The clock and check are decorative, hidden from assistive technology, and are not controls. The touched completion states have no icon-only control or new configuration. No tooltip or design-system change is necessary.
5. Exact-head Verify and Run site are green; source lock write and check passed without a diff; generator write and check passed and generated files were restored. Publication scan is NOT RUN here under the cloud adaptation, with complete, historyScanned and findings unestablished. No fixture or product file was added, so there is no new email-shaped fixture text.

## Local results and diagnostics

Pinned project typecheck: exit 0. First-party check: exit 0. Setup retry: exit 0. PAY-004 generator write and check: exit 0. Source lock write and check: exit 0. No migration was added or edited; migration ledger check is not applicable.

The complete native calculations file was run twice. Each run passed five tests and failed the same later combined registration before its ACH section. The first run timed out at 30000ms while setup was applying migrations. The isolated repeat failed an existing legacy reconciliation call at line 569 with “Stripe period totals could not be read. Reconciliation is incomplete.” A focused registration run passed that earlier section and later failed before ACH at line 768 with “Stripe could not be reached. Your answers are saved; retry to continue to payment.” All actual logs are retained. These observations are on byte-identical main with an already successful full exact-head CI wall. No code, timeout, assertion or provider fixture was changed to repair them; no CI repair round occurred.

The first temporary browser config resolved a server command from /tmp and was corrected outside the product checkout. The corrected runner then hit its 120000ms server startup limit before tests began. The identical fixture server was therefore prepared independently with a hard 1200-second timeout, allowing the existing test's own 240000ms timeout and every assertion to remain unchanged.

CI discovery initially used one REST call; one completed-run jobs read confirmed the full wall. No workflow dispatch, failed-job rerun or PR was created. Historical failed Verify 42590319983 is superseded by successful exact-head runs. The initial CI JSON and full successful job receipt are in the packet.

## Mechanical receipt

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write PAY-004 and node scripts/contract-docs.mjs check PAY-004 exit=0; ledger=none exit=0

GAP PAY-004: Alternative-provider implementation and the PayPal fixture order remain absent; the PayPal account is not held. Genuine Apple Pay, Google Pay and ACH test-mode settlement and safe failed-ACH Checkout retry remain unproved. These gaps are not narrowed by the completed dedicated processing presentation.

No new policy default, registration, backend, reporting or release change is included. All named activation, owner, account, ct and Base holds remain unchanged.

## Fresh browser proof

The complete existing calculation and payment registration passed at 1440 CSS pixels on this exact head. The pending return, authenticated processing record, genuine return reload, signed settlement and same-response paid revisit all passed. The desktop pending and paid screenshots were inspected: pending uses a clock and complete yellow border, and paid returns to its existing check and neutral presentation. The complete phone registration failed twice before the ACH section, at unchanged earlier embed assertions (lines 268 and 432, both at the default 5000ms assertion timeout). Those failures remain reported; no full local mobile pass is claimed. A separate ad hoc 390-pixel native fixture then invoked the unchanged committed processing-proof helper and passed in 28.1 seconds. Its source and config are included in the evidence packet, outside the product tree. It completes native ACH Checkout and verifies processing, authenticated payment custody, genuine reload, signed success, the same response and unchanged answers. The phone pending and paid screenshots were inspected and fit the viewport with readable text, a complete rounded border and no icon-only controls. No permanent test registration or assertion was added or changed.

PROBE PAY-004 1: native $40 ACH Checkout and genuine respondent return at 1440 and 390 -> processing notice and authenticated processing record; reload retains processing; signed async success and genuine revisit show paid with the same response IDs and answers. Desktop uses the full existing registration; phone uses the unchanged helper through the ad hoc native probe.

Local baseline failures are documented in LOCAL_FAILURES.md and the actual logs. They were not repaired in this UI-only round. The complete exact-head CI wall is green, the product tree has no diff against main, and the scoped processing probe passes at both widths. Broader registration failures are not described as passes.

## Product custody and final checks

The guarded product push succeeded on attempt 1 and created only cloud/sd-pencil-c-f60 at 0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef. Fresh remote refs confirm main and the named product branch are the same head. Full history is retained. Product and staged diffs, including CONTRACT.md Status cells, are empty. The candidate range origin/main..HEAD contains no new commits; the existing head author and committer are the fleet identity and its message has no co-author trailer. No published history was rewritten.

After the final fetch and no-op rebase, PAY-004 generator write and check again passed, generated views were restored from main, the source lock was regenerated last, and pnpm source:check passed with exit 0. No migration changed. The owned proof server PID 3542 stopped with exit 0, and all Playwright contexts closed.

Final REST discovery used the third and final GitHub API call. Full existing Verify 42585055043 is successful on this exact head; main Verify 42593015478 and Run site 42593015597 are also successful. The newly created branch has Verify 42600176457 observed as in_progress with conclusion None. It is not reported as successful before completion. No CI run was dispatched or rerun, and no PR was created. The cloud instruction leaves future branch polling, publication scanning and any landing with the maintained fleet.

SCAN commit=0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef complete=unestablished historyScanned=unestablished findings=unestablished; no cloud-side scan receipt is claimed.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write PAY-004 and node scripts/contract-docs.mjs check PAY-004 exit=0; ledger=none exit=0

CLAIM PAY-004 PARTIAL points=none tests=tests/e2e/calculations.spec.ts#builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals

Plan rows changed: none. Scoped processing presentation and native return proof are complete on existing main. Counts remain 142 DONE, 61 PARTIAL and 49 MISSING. The permanent test suite and all product sources remain unchanged. Full local native and mobile registration failures remain disclosed in the actual logs.

The complete explicitly selected non-secret packet is published only to refs/heads/evidence/sd-pencil-c-f60. The clean product clone will be removed after that transfer succeeds.
