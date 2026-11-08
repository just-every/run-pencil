# sd-pencil-c-f41 results

Product repository: https://github.com/just-every/run-pencil
Product branch: cloud/sd-pencil-c-f41
Product head: 955e9eae109eed2a4fdf2fdd49419f94dd181bd4

The selected native submission-inbox proof is complete on the current main. The fresh full-history clone's main was already exactly the predecessor named in the brief. Reapplying it would duplicate landed work. No production, test, contract, lock, workflow or generated-view bytes were changed; no product commit was created. The named branch was published at this existing commit. No PR is needed for the repository's cloud-branch push workflow. All other writers' work is retained.

MOB-001 stays PARTIAL. Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. Plan row: the native inbox review and triage slice at 360 is proven; the overall MOB-001 row stays partial. No lane plan or inbox file was read or written. No acceptance point, Status, Gap or Evidence cell was changed. No policy default was adopted and no release qualification is claimed.

## Plan and execution

The full plan is in PLAN.md. Read the supplied builder rules, DONE-RIDERS, plan extract and rulings inline. Read the launcher's AGENTS.md and the seed's AGENTS.md, README.md, HANDOVER.md, BASELINE.md, MOB-001 and WORK-001, the test and fixture helpers, and the submission UI's final CSS cascade. Compared current main with the supplied predecessor; both were the same full SHA. Ran the existing response-search registration at desktop and mobile widths, including its scoped 360-pixel leg, then inspected all seven inbox captures. Ran typecheck, first-party checks, touched-clause generation and check, restored the generated views from main, regenerated the source lock and checked it. Fetched main and rebased before the product push; there was no main drift and no conflict. Inspected the empty candidate range plus the existing head's full identity and message. Used the fleet push guard for the named product branch. Reports and screenshots remain outside the product tree and are published only through the evidence ref.

## Actual local proof

Command: cloud_run timeout 1200 pnpm exec playwright test tests/e2e/response-search.spec.ts --config .pencil-cloud.config.ts --project desktop --project mobile --workers=1 --reporter=list,json

Exit 0. Two project cases passed, zero failed, zero skipped, zero flaky. Reporter start: 2026-11-08T17:12:13.076Z; total duration 59908.95 ms. Browser: system Chromium, headless, with --no-sandbox. The temporary runner imported the repository's actual Playwright config, changed only the executable and launch arguments, and omitted the unrelated product-site server. It preserved both projects, the real application server, fixtures, test registrations and assertions. It was removed afterward. The complete actual JSON reporter output is browser-report.json. Seven actual PNG captures and hit-areas-360.json accompany it.

The test ran on the exact product SHA above. No relevant code or test bytes changed afterward. No assertion or workload was removed, weakened, skipped or placed behind a new condition. Existing search, revision, Unicode, export and triage coverage remains intact. No new test registration was added. The existing test-budget file's recorded over-cap counts were left unchanged.

Local setup installed dependencies and built the application but returned exit 1 during its separate runtime handshake: `SyntaxError: Unexpected token 'U', "Using secr"... is not valid JSON`, following `Using secrets defined in dist/server/.dev.vars`. Browser startup was launched before setup had fully exited, so concurrent generation of the shared build directory may have affected that attempt; it is not evidence of a production regression. The browser harness then built its own native mail-capture runtime, applied all migrations, served the application and passed both cases. No Base or production fix is proposed for this setup-only diagnostic. No secret values, environment dump or setup-private file is selected for publication.

## Scoped proof rubric

Every row uses the existing registration in tests/e2e/response-search.spec.ts named "operators search responses, see matching answers and download the same filtered records". The mobile helper is invoked at line 79; the original triage helper is invoked unconditionally at line 78. The published exact-head push Verify 42501312553 is successful, as are main Verify 42502979962 and main Run site 42502980154 on this same SHA. Their recorded REST results are in initial-ci.json.

| Item | Result | Proof at the exact product head |
| --- | --- | --- |
| R1 Independent native fixture | PASS | tests/e2e/submission-inbox-mobile.ts:11-31 creates a separate form and two real completions through native draft, publication, session and response doors; the original five-response search workload is unchanged. |
| R2 Original 1440 and 390 journey | PASS | tests/e2e/response-search.spec.ts:14-79 and tests/e2e/submission-inbox-journey.ts:11-76; both project cases passed with all existing assertions. |
| R3 Scoped 360 width and restoration | PASS | tests/e2e/submission-inbox-mobile.ts:38-52 and 134-137 assert actual innerWidth, restore in finally and assert the original viewport afterward. |
| R4 Assignment and tagging | PASS | tests/e2e/submission-inbox-mobile.ts:69-83 uses the checkbox label, assigns and tags through the visible bulk controls, then checks the row and answer. |
| R5 Private note | PASS | tests/e2e/submission-inbox-mobile.ts:84-90 and 116-132 enters the note, reads history, checks its author, and excludes note text from the ledger and audit representations. |
| R6 Done, filtering and reload | PASS | tests/e2e/submission-inbox-mobile.ts:91-121 moves the selected response to Done, filters out the independent untouched response, reloads and checks assignment, tag, note and status persistence while the second response stays new and unchanged. |
| R7 Matching ledger and audit outcomes | PASS | tests/e2e/submission-inbox-mobile.ts:122-132 fixes the expected selected response and answer, exactly four change kinds, current actor, form and one changed field, with no private note leakage. |
| R8 No horizontal scroll and effective 44-pixel targets | PASS | tests/e2e/submission-inbox-mobile.ts:40-48 and each exercised control; tests/e2e/submission-inbox-journey.ts:80-87 checks scroll and visible text at every captured state. All 12 recorded control measurements are at least 44 in each dimension; the effective checkbox label is 44 by 44, not the glyph. |
| R9 Screens and icon tooltip | PASS | Seven inbox captures inspected: filtered original triage at 1440 and 390, plus initial, bulk, noted, filtered and reloaded states at 360. tests/e2e/submission-inbox-mobile.ts:81 and tests/e2e/submission-inbox-journey.ts:28-29 verify the Open submission tooltip on focus. |

## Full acceptance and inherited duties

| Requirement sentence | Result | Boundary |
| --- | --- | --- |
| Every operator page works at 360 with 44-pixel targets and no horizontal scroll | PARTIAL | The native inbox triage slice passes; full dashboard, builder, results, ledger, actions, settings and other operator-page state journeys remain unproved. |
| Phone journeys build and publish a form, review a response and approve a submission | PARTIAL | Native inbox response review passes at 360. Fixture publication is through the API and is not claimed as a phone builder journey. Approval depends on unbuilt WORK-002. |
| Existing WORK-001 authority, private custody, erasure and replay duties | INSPECTED, unchanged | WORK-001 cites its existing native-route and browser evidence. This round changes no authority or persistence path and does not claim new permission, erasure or replay proof. |

## DONE-RIDERS

| Row | Result | Evidence or remaining gap |
| --- | --- | --- |
| 1 | FAIL for overall DONE | Full operator-page and approval outcomes remain unproved; scoped R1-R9 pass. |
| 2 | PASS for scope | Two real native completions; exact selected and untouched response outcomes, ledger answer and audit expectations in mobile helper lines 116-132. No new money or dangerous authorization path. |
| 3 | PASS for scope | The existing registration is in default Verify; exact-head push Verify 42501312553 succeeded. Local browser report also runs both projects and the 360 leg. |
| 4 | PASS | Local proof uses the exact unchanged head; no source or test change afterward. |
| 5 | INSPECTED | No new Base inheritance or acceptance rewrite. MOB-001 directly names the mobile layout duties; WORK-001 keeps its own private-custody obligations. |
| 6 | PASS mechanical; PARTIAL scope | MOB-001 generator write and check exited 0; generated views restored from main, contract cells unchanged. Existing broad Gap retained. |
| 7 | PASS | No acceptance, coverage mapping or rider text changed. |
| 8 | INSPECTED, unchanged | No authority path changed; this is mobile proof for existing WORK-001 triage, not an approval implementation. |
| 9 | PASS boundary | Synthetic native fixtures only. No provider, real-device or release qualification claimed. |
| 10 | PASS | No custody, consent, spending or authority default adopted. |
| 11 | UNESTABLISHED scan receipt | Main equals this source SHA and exact-head Verify and Run site are green; no cloud full-history scanner receipt is claimed. The maintained lander owns publication scanning and custody. No DONE or count increase is claimed. |

## Pre-ready self-check

1. Scoped user-visible outcomes have actual runtime assertions and passing local cases; exact-head Verify 42501312553 is green. Overall clause remains partial.
2. No existing assertion was removed, narrowed, skipped or moved behind a new width condition. Product diff is empty.
3. No authority, erasure or replay implementation changed; no new claim of those independent duties.
4. Visible inbox text is at least 13 pixels in the captured states; Open submission has its existing focus tooltip. Production CSS and components unchanged. Screens at 1440, 390 and 360 inspected.
5. Exact-head Verify and Run site are green; source lock fresh. Cloud publication scan is unestablished and deferred to the maintained lander. No fixture or product file was added, including no new address literal. Existing synthetic search-mailbox values remain unchanged.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write MOB-001 and node scripts/contract-docs.mjs check MOB-001 exit=0; ledger=none exit=0

PROBE MOB-001 scoped inbox review: native two-response fixture, inbox route at 360, label selection, assignment, tag, private note, Done, filter and reload -> target response persisted exactly, independent response unchanged, matching ledger and four audit events, no private note in either export representation, no horizontal scroll, exercised targets at least 44 pixels, viewport restored.

No product blocker was found. Remaining full-clause work is intentionally outside the selected proof slice, including WORK-002 approvals. No further target touching these same files is provided in the extract.

CLAIM MOB-001 PARTIAL points=none tests=tests/e2e/response-search.spec.ts#operators search responses, see matching answers and download the same filtered records
GAP MOB-001: Full 360-pixel coverage of all other operator-page states remains unproved; approval requires unbuilt WORK-002. The scoped native inbox review and triage proof passes.

The point list is none because the clause's single composite acceptance sentence still includes phone build and publication plus approval; this round establishes its review portion, not the entire sentence. The planner-selected inbox POINT is closed without an overall status change.

## Terminal custody

The new cloud/sd-pencil-c-f41 push started Verify candidate run 42504071498 on the same exact product SHA. At the final discovery it was in progress, conclusion null; this is not reported as green. Existing exact-SHA branch Verify 42501312553, main Verify 42502979962 and Run site 42502980154 are completed and successful. No dispatch, rerun or PR was created. Two GitHub REST calls were used, separated by more than 300 seconds; no watcher remains running. Candidate status is handed to the maintained lander without waiting on the new duplicate run.

The source lock remained byte-identical after regeneration. The worktree and index were clean at push. The silent typecheck and first-party logs reflect the repository's `.npmrc` (`reporter=silent`, `loglevel=error`), not a missing command: both exited 0. Direct TypeScript and rer check invocations were additionally run to resolve that output ambiguity and both exited 0. No local command was left pending.
