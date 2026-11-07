# sd-pencil-c-f20 report

Candidate: `a406ea88260a073b5a37dbfabc090fa26278d321` on `cloud/sd-pencil-c-f20` in just-every/run-pencil.
Base: `b6a05948c040da9debdeb9d6ca10c13eacc304ee`. Product push succeeded on its first attempt. No PR was created: the existing push event starts Verify candidate.

INTEG-010 remains PARTIAL. The two assigned native transport proof gaps are closed. Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. No status, Gap, Evidence, acceptance wording or plan source was edited. The plan row to update is the INTEG-010 entry for sd-pencil-replan-4: the two transport proofs are complete; retain every held remainder.

## Plan and completed results

1. Read the inline plan, rulings, builder rules and all eleven DONE-RIDERS rows; inspect the launcher, repository AGENTS.md, README.md, HANDOVER.md, BASELINE.md, INTEG-010 and its current Status row. Map existing assertions before changing them. Complete.
2. Extend the existing signed-response-event registration only. Forward the actual outgoing signal into the receiver fixture. Let the hanging receiver reject exclusively with that signal's native reason after its abort event. Assert independent elapsed-time bounds around the ten-second deadline, a timeout attempt with null HTTP status, a pending delivery, the one-minute retry boundary, the same event ID and successful recovery. Complete.
3. Return a successful streaming response with a private synthetic canary, a read witness and a cancellation witness. Use zero high-water mark so creating the stream cannot read it eagerly. Assert exactly one cancellation, zero reads, confirmation, and absence of the canary in both delivery APIs and every stored database value. Complete.
4. Preserve the registration and every existing assertion, including signature verification, redirect refusal, retry ladder, disablement, alerts, replay, rotation, erasure, response edits, paid edits and chat integration proof. Complete. The only removed test lines are widened fixture and response types and the extra signal argument; no assertion was removed or narrowed.
5. Run affected native proof, typecheck and first-party checks; regenerate and check the touched contract views, restore generated files from main, regenerate the source lock last and check it. Commit, fetch main, rebase the unpublished candidate, repeat mechanical checks, audit all candidate identities and trailers, and push the named branch. Complete. An initial pre-commit rebase was refused because changes were unstaged; the clean committed rebase before the push succeeded and was already up to date.
6. Run the affected native proof, typecheck and first-party check on the exact committed SHA; record exit codes, durations and log hashes; discover exact-SHA CI once; publish this separate report packet. Local checks complete. CI and guarded landing remain with the lander.

## Proof map

Every local PASS below is from `tests/runtime/response-webhooks.worker.test.ts` — “signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection”, at the exact candidate. The entire existing registration passed: one registration before and after, zero new registrations. Its native test body took about 15 seconds, including the real ten-second timeout. The outside-Verify timing receipt is `candidate-webhook-receipt.json`, started 2026-11-07T20:10:50.850982+00:00, command exit 0; total process duration 41.405 seconds. No clock, timeout constructor or timeout error is mocked for the new proof.

| Item | Outcome and public door | Test lines | Evidence |
| --- | --- | --- | --- |
| Acceptance 1 | Register an endpoint, receive the event, verify HMAC, return 500 twice, retry with one event ID and replay | 58–100 | Local PASS; push Verify pending |
| Acceptance 2 | Sustained failures disable the endpoint and its operator alert appears | 128–176 | Local PASS; push Verify pending |
| Assigned point 1 | Owner endpoint test waits for outgoing AbortSignal; native TimeoutError, 9,900 to 15,000 ms observed bounds, null HTTP status, pending same-ID retry and recovery | 194–238 | Local PASS; push Verify pending |
| Assigned point 2 | Owner endpoint test receives successful streaming response; one cancel, no read and no private body in stored data or delivery APIs | 240–257 | Local PASS; push Verify pending |
| Authority duty | Member endpoint registration and replay refused; owner succeeds | 58–66, 95–100 | Local PASS |
| Secret duty | Secret shown once, sealed, absent from stored plaintext, then rotated; old signature fails | 65–70, 186–193 | Local PASS |
| Data minimization duty | Signed payload contains identifiers without private answers; deleted response data is removed | 82–91, 177–184 | Local PASS |
| Replay and retry duty | Original event identity retained, ladder terminates, explicit owner replay confirms; no extra response event | 74–100, 128–176 | Local PASS |
| Edit and erasure duty | Single-use edit and erasure assertions preserved through existing helpers | 258–261 and ./tests/runtime/response-edit-proof.ts | Local PASS |
| Held events and masking | Approval decided requires WORK-002; answer masking requires GOV-004; this round adds no new exposure | CONTRACT.md INTEG-010 and its Status row unchanged | HELD, not claimed |
| Provider and release qualification | Real-provider, live alert-email delivery and release qualification remain unproved | Existing clause boundary retained | HELD, not claimed |

## DONE-RIDERS assessment

This is a PARTIAL claim, not a DONE claim. Pending landing receipts and the retained full-clause gaps are explicit.

| Rider | Result | Evidence or limit |
| --- | --- | --- |
| 1 | PARTIAL | The two scoped points and current native outcomes pass the named journey; approval events and other held remainders remain. Exact-SHA Verify pending. |
| 2 | PASS locally | Seeded nonempty deliveries; actual hanging signal and streaming cancellation; owner operations succeed and member mutations are refused. Lines 58–100, 194–257. |
| 3 | PENDING | Push Verify candidate 42409757285, exact SHA, in progress when discovered. Existing worker lanes load the unchanged registration through the Worker test glob. |
| 4 | PASS locally | Exact-SHA receipts for the native journey, typecheck and first-party check. |
| 5 | INSPECTED | No receiving clause or inherited duty changed. Authority, minimization and erasure remain named and exercised as above. |
| 6 | PASS mechanically | Touched generator write and check exit 0; generated views restored whole from main; source lock and source check exit 0. No judgment cell changed. |
| 7 | PASS | No acceptance wording, status row, ID map or coverage rewrite changed. |
| 8 | PASS locally | Existing owner success and member registration and replay refusal retained and passing. |
| 9 | PASS boundary | Network-edge fixture proof only; no real-provider or legal boundary claimed. |
| 10 | NOT APPLICABLE | No new policy default or custody decision adopted. |
| 11 | PENDING LANDER | Main differs from the branch head; branch Verify is in progress; candidate Run site and full-history publication scan remain with the maintained lander. |

## Pre-READY self-check

1. The assigned deadline, retry and cancellation outcomes have behavioral assertions through owner routes and the transport boundary. An early timeout fails the independent elapsed bound; no timeout leaves the receiver hanging; missing cancellation fails its witness; consumption triggers the read witness; persistence of the canary fails the data assertions. This is inspection of the assertions, not a mutation campaign. Exact-SHA full Verify remains pending.
2. No existing assertion or test registration was removed, skipped, narrowed or made conditional. One registration before and after; recorded repository budget metadata stays unchanged at 277 current registrations and 380 expanded cases, against the existing 200 cap. The pre-existing budget excess was not expanded.
3. Existing authority, erasure, replay, rotation and single-use edit proof runs in the same passing registration. No production path changed and no new disclosure is introduced.
4. No screen changed; browser screenshots, widths, typography and icon tooltips are not applicable to this test-only round.
5. Generated views and source integrity checks pass locally. No new fixture contains an email-shaped string. The product diff is limited to the one test file and its generated source-lock hash. No cloud publication scan was run or claimed. Candidate Verify and main landing remain independent gates.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write INTEG-010 then check INTEG-010 exit=0; ledger=none exit=0
PROBE INTEG-010 1: owner POST endpoint test with a receiver waiting only for the outgoing signal -> native timeout after the independently bounded ten-second interval, failed attempt with null HTTP status, pending retry, same event ID and confirmed recovery.
PROBE INTEG-010 2: owner POST endpoint test with a successful private streaming body -> one cancellation, zero reads, confirmed attempt, no private canary in persisted data or delivery APIs.

## CI, scan and custody

Exact candidate Verify: run 42409757285, event push, status in_progress, conclusion null, head `a406ea88260a073b5a37dbfabc090fa26278d321`. This is not a green claim. One discovery and no poll or dispatch were used for this run. GitHub REST calls used: 2 of 10 (main discovery and candidate discovery). No failing candidate assertion was observed and no repair round was started.

Observed main Verify: run 42374854513 completed success at `b6a05948c040da9debdeb9d6ca10c13eacc304ee`. Observed main Run site: run 42270609301 completed success at that same main SHA. These are baseline evidence, not candidate green evidence.

Candidate publication scan: commit=a406ea88260a073b5a37dbfabc090fa26278d321; complete=NOT_RUN_IN_CLOUD; historyScanned=NOT_ESTABLISHED; findings=NOT_ESTABLISHED. The clone had full history. The maintained Mac lander must run its full-history publication scan, require exact-SHA green Verify, integrate the candidate and confirm Run site on the resulting main SHA. Main equality: false, confirmed by the actual remote-ref receipt. No main push, force push, manual landing, production deployment or workflow edit occurred.

The complete selected public packet includes this report, actual command receipts and logs, view generation output, source-integrity output, CI discovery output and product-push provenance. Evidence publication is a separate report-only ref and does not signal landing, DONE, or acceptance.

CLAIM INTEG-010 PARTIAL points=1,2 tests=tests/runtime/response-webhooks.worker.test.ts#signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection
GAP INTEG-010: approval decided events require WORK-002; identifier-only bodies remain until GOV-004 masking; email alerts, real-provider qualification and release qualification remain unproved, with existing holds unchanged.
