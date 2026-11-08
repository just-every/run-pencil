# sd-pencil-c-f33 — INTEG-006 deadline proof

Repository: just-every/run-pencil
Product branch: cloud/sd-pencil-c-f33
Starting main: 4f7b106744a08557c756e1d7dffe21226ced44d2
Target status: PARTIAL before and after. Counts: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total before and after.

## Full plan and scope

1. Read the launcher, repository instructions, actual contract, existing proof and transport. Map the only assigned gap: actual ten-second Slack and Teams transport deadlines and uncertain-outcome custody. Keep the production transport and service unchanged.
2. Extend the existing response-webhook registration's chat helper. Add a chat-specific unanswered-request mode to the real loopback receiver, record connection-close timing, and clean up outstanding responses on mode reset, receiver reset and teardown.
3. Submit a native response and retain its ledger snapshot. Forward genuine outgoing fetch calls unchanged while observing their production AbortSignals. Require both signals and independent receiver closes within 9.5 to 12 seconds, without response headers, fake timeout exceptions, timer acceleration or changed production deadlines.
4. Check both retained unknown delivery rows through the authenticated integration ledger: one unknown attempt each, null HTTP status, original outgoing idempotency key, safe reason and no private answer or credential values. Confirm collection has exactly one new released response with unchanged answers and revision.
5. Recover the receiver and run scheduler ticks at one, five and thirty minutes. Require no further posts and unchanged delivery and attempt rows. Preserve every existing signature, summary, action, reminder, replay, restoration and size assertion. Add no test registration.
6. Run the touched Worker registration, typecheck, first-party checks, generator write and check, restore generated views, regenerate the source lock last and check it. Integrate current main before pushing; inspect all candidate author, committer and trailer identities. Push only the named branch through the fleet guard.
7. Run the same timed registration on the committed candidate outside push Verify. Discover exact-SHA CI using the decrypted fleet bundle and REST within the ten-call budget. Publish this report and actual receipts only on the evidence ref. The maintained lander owns publication scan, main landing and Run site verification.

## Frozen scope rubric

- R1: Real unanswered Slack post reaches the production deadline and its signal aborts; independent loopback close occurs without any HTTP reply.
- R2: Same proof for Teams; no licensed tenant or genuine Teams claim.
- R3: Both uncertain posts retain their original key and one unknown attempt with null HTTP status and safe reason; no sensitive values leak into delivery records.
- R4: The originating response is admitted released, its answers and revision remain unchanged, and recovered receiver plus subsequent scheduler ticks produce no automatic repost.
- R5: All earlier chat journey assertions and its existing registration remain present. No production source, contract status or generated view is committed.

All runtime rubric rows are exercised by tests/runtime/response-webhooks.worker.test.ts, registration “signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection”, invoking tests/runtime/chat-integrations-proof.ts#proveChatIntegrations. Exact candidate and final results are recorded in receipt.json and the Worker JSON result.

## Acceptance sentence coverage and honest boundaries

1. Native receiver acceptance: existing helper posts both summaries, refuses sensitive fields and validates signed Slack interactions before action creation. Existing successful and refused cases are retained. New proof closes the missing transport deadline component only.
2. ACT-009 inheritance: existing helper covers before, on-date and weekly reminders, repeated and concurrent ticks, sending-window deferral and owner-verdict cancellation on both platforms. Those assertions remain unchanged.
3. Additional scoped requirements in the clause ruling remain owed: Nook delivery and receiving connection; Teams message-action implementation; genuine Teams posting; genuine signed Slack interaction through an owner-configured public Interactivity Request URL and console signing-secret qualification. Earlier live Slack receipt does not bind this runtime SHA. Exact-head provider qualification is not established.
4. NOTIFY-005 policy custody and INTEG-015's unbuilt chat-post replay interface under the existing uip gate remain unchanged. Existing account, ct, Base, historical c5 exclusions, activation and release prerequisites remain held. No launch or DONE restoration is claimed.

## DONE-RIDERS assessment

1. PARTIAL: scoped runtime outcomes exercised, full clause still has named feature and provider gaps. Exact-SHA Verify status is in receipt.json.
2. PASS for this change: real seeded response, genuine forwarding fetch, independent receiver witness and fixed externally meaningful outcomes. An immediate error fails the lower time bound; successful completion or automatic repost fails custody assertions.
3. PENDING until exact-SHA Verify completes: the existing registration is loaded by normal push Verify. Exact-SHA outside-Verify timing receipt also supplied.
4. PASS on the final timed receipt: candidate SHA is recorded; no product or test bytes change afterward.
5. INSPECTED: ACT-009 and WS-002 duties are written in INTEG-006; inherited clock assertions are retained. No inheritance is added.
6. MECHANICAL: generator write and check succeed. Generated views are restored from main as required; status, Gap, Evidence, counts and prior judgments remain untouched.
7. PASS: no acceptance text, ruling, rider or registration change.
8. INSPECTED: existing owner/member, signed actor/channel, stale and disarmed refusals remain; no new authority or outbound production door is introduced.
9. PARTIAL: loopback proof only. Genuine Teams, Slack inbound, Nook and exact-head provider qualification remain explicit gaps.
10. PASS: no policy default adopted; existing conservative custody remains unchanged.
11. LANDER-PENDING: main equality, COMPLETE full-history publication scan and exact-main Run site are not cloud claims. No count change requested.

## PRE-READY self-check

- Scoped behavior has real request, time, abort, unknown-result and no-resend assertions. No prior assertion is removed, narrowed or gated. No production code changes.
- Existing replay, revoked/disarmed connection and stale-control refusals remain intact. Erasure and archive duties owned by existing journeys are unchanged; this round adds no data retention or exposure.
- No UI changed. Browser widths, screen typography and tooltips are not applicable to this runtime-only proof.
- Lock freshness and contract generation are checked. Publication scan, main equality and Run site remain with the guarded lander, not reported as complete here.
- Added fixture strings use synthetic-pencil naming. Added lines contain no email-shaped value or provider-shaped credential. The fleet report packet contains no environment dump, credential, browser session or private held-out material.

## Development diagnostics

The first complete local timing run passed both abort and receiver-close assertions but failed a newly authored expectation for an internal “started” attempt. The public ledger intentionally excludes started events. The new expectation was corrected to require exactly the retained unknown attempt, without changing existing assertions or production behavior. One earlier local process was interrupted during setup cleanup and is not a passing receipt. The final result and committed-head rerun are the authoritative local proof.

Plan row update for the lane: INTEG-006 remains PARTIAL; mark the real ten-second Slack and Teams transport deadline proof complete once this candidate lands. Leave all named feature, provider and interface gaps and all counts unchanged. No further campaign target was taken because the brief explicitly leases only INTEG-006's missing deadline proof.

## Exact candidate proof index

18ef418c11ba90618205512f485918fe5aae68bb

- deadline-start: tests/runtime/chat-integrations-proof.ts:163
- response-admission: tests/runtime/chat-integrations-proof.ts:168
- signal-observer: tests/runtime/chat-integrations-proof.ts:177
- abort-timing: tests/runtime/chat-integrations-proof.ts:188
- receiver-timing: tests/runtime/chat-integrations-proof.ts:193
- unknown-deliveries: tests/runtime/chat-integrations-proof.ts:201
- unknown-attempt: tests/runtime/chat-integrations-proof.ts:206
- response-unchanged: tests/runtime/chat-integrations-proof.ts:211
- scheduler-no-resend: tests/runtime/chat-integrations-proof.ts:214
- cleanup: tests/runtime/chat-integrations-proof.ts:283

Receiver controls and cleanup: tests/runtime/task-receiver.global.ts:13 to 16, 25 to 28, 37 to 43 and 88. Existing registration remains tests/runtime/response-webhooks.worker.test.ts:27, invocation at line 197. Production deadline remains src/core/features/chat-integrations/transport.ts:19.

PROBE INTEG-006 1: native response admission, real loopback Slack and Teams posts held unanswered -> both production signals abort and both receiver connections close at 9.5 to 12 seconds without HTTP headers; two unknown delivery rows retain null HTTP status, safe reason and original keys; admitted answers remain unchanged; three later scheduler ticks send no post.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then pnpm source:check exit=0; views=node scripts/contract-docs.mjs write INTEG-006 then node scripts/contract-docs.mjs check INTEG-006 exit=0; ledger=none exit=0. Generated views restored from origin/main before committing.

Publication scan: commit=18ef418c11ba90618205512f485918fe5aae68bb complete=NOT_RUN_IN_CLOUD historyScanned=NOT_RUN findings=UNESTABLISHED. Full Git history is retained and the Mac lander must perform the COMPLETE scan. Main equality=false; product branch only. Candidate Run site=not applicable before main.

Starting-main health: exact main Verify 42476942551 success and Run site 42476942600 success. Older same-SHA Verify 42476845104 failed, superseded by the later green Verify. No candidate failure has been observed.

Assertion preservation: all 78 existing assertion-bearing lines in the chat helper are retained byte-for-byte. The registration, production transport, production service, CONTRACT.md and test-budget.json are unchanged. The fixture metadata still declares 277 registrations; this round adds zero and does not claim to fix the existing 200-test cap overage.

Runtime limitation: local cloud Node is v24.19.0, allowed by the supplied toolchain installer because it is newer than the 22.20.0 minimum. Exact-SHA CI uses its unchanged Node 22.20.0 pin. The initial local timing receipt names its actual version. The additional exact-head run below uses the unchanged CI Node pin.

CI observation 1: push Verify candidate run 42479761808 remains in_progress on exact head 18ef418c11ba90618205512f485918fe5aae68bb after the minimum 300-second polling interval. No dispatch or rerun was requested. GitHub API budget used: 3 of 10 calls.

Exact-head Node 22.20.0 follow-up: timed existing registration PASS, exit=0, runId=local-node22-sd-pencil-c-f33-20261108T122611Z, elapsed=50.237 seconds including import and setup. The actual test body remains within the unchanged 30-second test timeout. Typecheck PASS exit=0; first-party check PASS exit=0. Earlier Node 24 exact-head run also passed. No product bytes changed between these runs.

CI observation 2: Verify 42479761808 remains in_progress on the exact candidate, after another full 300-second polling interval. The non-secret packet is being preserved separately while that run continues. Product push is complete; this evidence transfer carries no READY or landing signal.
