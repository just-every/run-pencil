# sd-pencil-c-f59 results

Handoff BLOCKED: latest requested-branch Verify 42590319983 is red in the unrelated WordPress embedding journey; the exact desktop lane reproduction exited before test cases, so no repair or rerun is justified under the brief.

PAY-004 remains PARTIAL. The requested dedicated respondent processing presentation and its scoped native Checkout proof are complete on `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef`, pushed to `cloud/sd-pencil-c-f59` in `just-every/run-pencil`.

The supplied starting commit already contained the entire requested implementation and committed proof. This run inspected it, rebased onto current main (already up to date), verified it, and published that exact commit under the requested branch. No new product commit, test registration, backend change, reporting change, contract edit or scope extension was necessary. The candidate retains both original fleet commits, `1350e7c6ef95334c3ff82d9fb36e0c23ee8ba991` and `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef`; no published history was rewritten.

Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING. The plan's PAY-004 row stays PARTIAL; only the dedicated processing presentation and corresponding browser proof gap is closed by this handoff. No other plan row is changed. The full work plan is in PLAN.md.

## Product and retained scope

`src/core/features/responses/ui/RespondentPaymentNotice.tsx:4` extracts the existing payment notice. Its state comes from `RespondentFlowPage.tsx:323` and the existing authoritative return result. Processing renders an accessible named live status, explicit pending wording, a clock and pending colours; paid retains the existing received wording and check. `respondent.css:33` gives processing a complete rounded border and distinct pending background and foreground. The notice uses the existing 15px typography and has no interactive icon-only control. Screens at both CSS widths were inspected.

`tests/e2e/calculations.spec.ts:567` invokes `tests/e2e/payment-processing-proof.ts:6` inside the existing registration, "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals". Only the old ACH generic-confirmation expectation is replaced; the earlier payment, embedding, admission, failure, replay, archive and erasure workloads and assertions remain. No registration is added. Recorded test-budget metadata remains 277 registrations and 380 expanded cases, unchanged from main; no cap increase is requested.

`PaymentReturnPage.tsx`, `responses/payment-responses.ts`, `payments/service.ts` and `tests/e2e/stripe-receiver.ts` remain byte-identical to main. All backend, reporting, authentication, erasure, replay and retry custody stays unchanged. Homepage, logos, Base pin, workflow and generated views are unchanged.

## Proof and actual results

The fresh focused browser probe uses the exact candidate's existing proof helper, a small temporary native fixture and the normal authenticated authoring and public collection doors. Its source is retained in scoped-probe.ts, outside the product tree. It ran under Node 22.20.0, system Chromium with `--no-sandbox`, CPU throttle 4, and a 1200-second outer timeout. Both cases passed: desktop 1440 by 900 in 27.5 seconds; mobile 390 by 844 in 53.2 seconds. The complete run took 2.9 minutes including server startup. See proof-receipt.json and probe-results.txt. No temporary registration was committed.

| Scoped requirement | Public-door proof | Outcome |
| --- | --- | --- |
| Native ACH fixture Checkout | helper lines 7–20 submits the published form, observes 201, opens the fixture's real Checkout, verifies ACH, and follows its signed completion return | PASS at both widths |
| Authoritative processing and accessible pending presentation | helper lines 22–60 compares the genuine processing return and authenticated ledger, checks one matching response, amount 4000, attempt 1, live status, clock, pending state and absence of the paid presentation | PASS at both widths |
| Reload while still processing | helper lines 62–67 reloads the exact genuine return URL and verifies processing, unchanged response IDs and matching authenticated state | PASS at both widths |
| Signed success and existing paid presentation | helper lines 69–97 delivers signed asynchronous success and charge events, checks authenticated paid ACH details, revisits the same return, verifies received wording, check icon and different visual colours | PASS at both widths |
| Same response and answers | helper lines 28–34, 57–58 and 95–96 verifies exactly one matching response, the same complete response-ID set and identical retained answers | PASS at both widths |
| Changed screens at 1440 and 390 | helper lines 46–50, 60 and 97 captures processing and paid screens and checks no horizontal overflow | PASS; screenshots included |

PROBE PAY-004 1: native published ACH fixture Checkout and genuine processing return -> processing status agrees with the authenticated payment record, survives reload, and signed success produces the existing paid presentation with unchanged response IDs and answers at 1440 and 390.

Typecheck, first-party check, contract generation and check, and source integrity pass. Their actual command exits are in mechanical.json. Repository script output is intentionally silent for typecheck and first-party checking.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write PAY-004 then node scripts/contract-docs.mjs check PAY-004 exit=0; ledger=none exit=0.

Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main after generation. CONTRACT.md has no diff, including no Status, Gap or Evidence cell change. Lock regeneration produced no diff. The checkout was clean at the pushed SHA.

## Local infrastructure limitations

The required `rer setup` invocation built and migrated, then its pinned runtime startup parser received the Wrangler preface "Using secrets defined in dist/server/.dev.vars" instead of JSON. No secret values are retained. The existing dedicated browser harness runs independently; setup-result.txt records the sanitized error. No Base or product repair was made.

The broad native calculations run returned five passed and one failed. Its unchanged payment registration first failed during legacy reconciliation with "Stripe period totals could not be read. Reconciliation is incomplete." An isolated retry passed that step and later failed at Checkout creation with "Stripe could not be reached. Your answers are saved; retry to continue to payment." Both logs contain loopback workerd "Network connection lost" diagnostics. The same isolated test on current main `6bb7927ecf707cec630874ddec40a4faa77825f5` reproduced that Checkout connection failure, later at its ACH fixture. The relevant native source and test bytes are identical on main and candidate. See native-comparison.json and the three actual assertion files. No product fix or test weakening was attempted.

The first broad browser attempt exhausted its 120-second server startup allowance during local migrations, before any test ran. The retry used Node 22.20.0 and a local-only 300-second server startup allowance. Its first desktop registration reached existing embed workloads but encountered a dropped local session-advance connection and eventually timed out in an authenticated API request at calculations.spec.ts:409. The remaining broad run was stopped at its recorded Playwright PID: one failed, one passed, one interrupted and three not run. This is not reported as a passing local full suite. browser-transport-failure.txt records the actual error. The separate fresh targeted probe subsequently passed both widths using the unchanged ACH proof helper.

These local transport limitations also affect unchanged main and do not establish a product regression. No CI repair round, workflow rerun or dispatch was requested.

## CI and custody

Exact candidate SHA: `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef`.

Existing exact-SHA Verify candidate run `42585055043`, event push, is completed with conclusion success: https://github.com/just-every/run-pencil/actions/runs/42585055043 . This is the prior branch run on the identical supplied SHA, with unchanged product and proof bytes.

The new requested-branch push started exact-SHA Verify candidate run `42590319983`: https://github.com/just-every/run-pencil/actions/runs/42590319983 . The final REST observation at 09:17:20 UTC is completed with conclusion failure. Job `129070748419` (worker-1, desktop-7 and archive-delivery) passed all 64 Worker tests and its archive group, but desktop-7 failed the existing WordPress embedding registration twice at `tests/e2e/wordpress-embed.ts:104:144`, called from `tests/e2e/script-embed.spec.ts:197:5`. All other shard jobs, checks and builds passed. Aggregate job `129076285287` consequently failed. The prior successful run on this identical SHA does not clear this new red result.

The failed job's exact authored log was read once with `gh run view 42590319983 --repo just-every/run-pencil --job 129070748419 --log-failed`. It exposes the test title and source coordinates, not assertion values. Selected actual non-secret lines are in ci-failed-job.txt. The aggregate job's one archive read, `gh run view 42590319983 --repo just-every/run-pencil --job 129076285287 --log-failed`, failed with `failed to get run log: zip: not a valid zip file`; HTTP status and response body were not supplied. It was not retried. ci-log-transport-error.txt retains the exact command and error.

Before any product edit, the failed desktop command was attempted at the exact candidate with Node 22.20.0, CI=1, shard desktop-7, GITHUB_RUN_ID=42590319983 and PENCIL_CI_BUILDS=.rer/ci-builds: `node scripts/run-contract-lane.mjs desktop-7 /home/agent/rer-consolidation/work/sd-pencil-c-f59/reproduced-lane`. The cloud hardware adapter temporarily selected system Chromium and a longer server startup allowance; the original configuration was restored whole afterward. The actual output was `Browser setup failed before test cases (1 runner errors, exit 1).` and `desktop-7: 0 passed, 0 failed; exit 1.` No WordPress assertion was reached. This is NOT a successful reproduction. The brief explicitly requires stopping BLOCKED when the failing CI assertion does not reproduce, rather than guessing a fix. No product repair round, failed-job rerun or workflow dispatch was attempted. Seven GitHub API and log calls were used, within the ten-call budget. See verify-reproduction.json and the actual reproduction evidence.

VERIFY_NOT_REPRODUCED head=0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef job=129070748419 command="node scripts/run-contract-lane.mjs desktop-7 /home/agent/rer-consolidation/work/sd-pencil-c-f59/reproduced-lane" exit=1 failure="Browser setup failed before test cases (1 runner errors, exit 1)."

The fleet push guard succeeded on its first attempt. product-push.txt is the actual receipt. Every candidate commit, including side parents, was inspected: authors and committers are the fleet identity; trailers are absent. Full history is present and main is an ancestor. Remote readback confirmed the named branch equals the candidate and main still equals `6bb7927ecf707cec630874ddec40a4faa77825f5`. No PR was required or created. Nothing was pushed to main.

Publication scan record for commit `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef`: complete=unestablished; historyScanned=unestablished; findings=unestablished. The cloud branch-push exemption applies; no cloud-side scan, landing or release qualification is claimed. The Mac lander owns the complete publication scan, exact branch verification, guarded landing, generated views and Run site checks. Main equality is false; Run site on the candidate is pending landing.

## DONE-RIDERS and pre-READY review

This is a PARTIAL claim. The following rows record scope honestly rather than claim the complete provider clause DONE.

| Rider | Result | Evidence or remaining boundary |
| --- | --- | --- |
| 1 | PASS for scoped processing; incomplete for full PAY-004 | Committed helper lines 7–97 plus fresh two-width probe; PayPal fixture order and alternative provider remain unmet |
| 2 | PASS for scoped state correctness | Genuine unpaid processing return cannot satisfy paid checks; authenticated record and same-response assertions; retained native failure and refusal workloads are covered by exact-SHA Verify 42585055043 |
| 3 | FAIL for current handoff | Prior exact-SHA Verify 42585055043 succeeded, but the new exact-SHA run 42590319983 is red on the unrelated WordPress test. The scoped probe passes; the standing Verify bar still blocks this handoff. |
| 4 | PASS | Fresh scoped probe at the candidate; no byte differs from the prior successful CI SHA |
| 5 | INSPECTED, unchanged | PAY-004 explicitly inherits PAY-001 payment state; no new inherited duty or acceptance sentence introduced |
| 6 | PASS for generation; judgment unchanged | PAY-004 write and check pass; generated views restored from main; counts and status cells unchanged |
| 7 | PASS | No acceptance or policy rewrite |
| 8 | INSPECTED for unchanged authority; scoped runtime PASS | No authority write changed; authenticated ledger comparison; dangerous native refusal workloads retained and exact-SHA CI green; local transport comparison does not claim full local native success |
| 9 | PASS for honest boundary | All proof is against the network-edge fixture; no live settlement, wallet, PayPal, Square, legal or release qualification claimed |
| 10 | PASS, no new default | Existing RL-102 temporary retry refusal is retained; native safe retry remains owed and is not reclassified as an owner-policy blocker |
| 11 | BLOCKED BEFORE LANDING | Candidate is branch-only and its latest Verify is red; main equality, complete publication scan and candidate Run site are unestablished |

Pre-READY: (1) each requested visible processing outcome is asserted by the permanent helper and passes the fresh probe; prior exact-SHA Verify is green but the latest run is red, so no READY is issued. (2) No existing assertion was removed or narrowed except the specifically replaced ACH generic-confirmation expectation; its surrounding assertions are preserved in the helper, with additional same-response and reload checks. (3) Backend authority, erasure and replay paths are unchanged and their existing workloads remain. (4) Changed completion screens use 15px notice text, a complete border and decorative icons, with no icon-only controls or new configuration. (5) Source lock is fresh; full scan, main equality and Run site remain with the guarded lander and are not fabricated. Changed product text adds no email-shaped value or provider-shaped key. No credentials, environment dump, private gate material, trace archive or session cookie is selected for evidence publication.

## Claim and remaining work

CLAIM PAY-004 PARTIAL points=none tests=tests/e2e/calculations.spec.ts#builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals; tests/runtime/calculations.worker.test.ts#preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal

`points=none` avoids claiming a complete numbered acceptance point: this legacy clause has an unnumbered combined ACH and PayPal acceptance sentence, and its PayPal outcome remains unmet. The requested processing-presentation outcome is independently proved above.

GAP PAY-004: Alternative-provider implementation and the named PayPal fixture order remain omitted; no PayPal sandbox account is held. Genuine Apple Pay, Google Pay and ACH test-mode settlement, failed ACH retry and wider provider qualification remain unproved. RL-102's temporary retry refusal and all existing payment, account, owner, Base, activation and release holds are unchanged. The planner's later Square account allowance does not prove a Square implementation or the named PayPal outcome.

No new policy default or DONE judgment was adopted. The current handoff is BLOCKED by unreproduced exact-SHA Verify failure in the WordPress journey, run 42590319983, job 129070748419; fv diagnosis is required. The local transport failures reproduced on main and the setup startup error are reported separately as infrastructure findings. The complete plan, actual receipts, scope report and selected changed-screen screenshots are published only on the separate evidence ref.
