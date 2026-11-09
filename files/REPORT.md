# sd-pencil-c-f52 results

Repository: just-every/run-pencil
Branch: cloud/sd-pencil-c-f52
Candidate: 191c091413fa30a975150e462f1cc9c4ea869be1
Integrated main: 1e65537decf1b294c86fce248432849d49eaa748
Predecessor: 4b681954ca9199771a792441ef15615c258884e8

The predecessor already contained the complete requested scoped fix. This run read and validated it, replayed its single commit onto current main without conflicts, retained the newer invitation proof from main, regenerated and checked the source lock, and pushed the rebased implementation. No duplicate implementation or no-op commit was added. CONTRACT.md and its Status, Gap and Evidence cells are unchanged. Generated views were written and checked locally, then restored whole from main; no generated view was committed.

Plan executed: inspect the native flow routes and service and edition adapter; run the predecessor's registered journey; integrate current main; prove generated views and lock; build and run the exact candidate's touched gates; publish the product branch and separate evidence packet. The original campaign plan was not rebuilt or changed. Only the BASE-AGENT-002 scoped continuation is being returned; no next clause was started.

## Scope and behavior

The edition adapter passes PencilError.code to ToolRefusal unchanged at src/agent-door/flow-tools.ts:53. Its missing-step classifier emits NOT_FOUND at line 86, and its resource reader continues to return null for native NOT_FOUND at line 179. Shared Base, native flow routes, native service, native errors, UI and agent-surface.json are unchanged.

The focused helper tests/agent-door/business-refusals.mjs extends the existing nativeJourney registration in tests/agent-door/native-journey.mjs:114. It uses a valid authenticated native draft and the same eligible-policy MCP actor. The code expectations are independently fixed to the native seed business codes rather than derived from the adapter result.

PROBE BASE-AGENT-002 4 absent-step deletion: authenticated DELETE of a valid but absent step ID and pencil.flows.delete_step against the same draft -> native HTTP 404 NOT_FOUND and MCP HTTP 200 with isError and NOT_FOUND; unchanged draft content, version, status, native effect audit and reviews; exactly one refused MCP audit row, no completion receipt or resource link.
PROBE BASE-AGENT-002 4 draft reopen: authenticated POST reopen and pencil.flows.reopen against that same unpublished draft -> native HTTP 400 VALIDATION_ERROR and MCP HTTP 200 with isError and VALIDATION_ERROR; the same no-effect, no-review and refused-audit assertions hold.

Before and after counts: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. BASE-AGENT-002 stays PARTIAL. Only the two selected acceptance-4 refusal cases are closed; no full-clause DONE, wider tool family, activation, release or live-provider qualification is claimed. No policy default or new ruling was needed.

## Acceptance proof map

| Point | Result and proof |
| --- | --- |
| 1, complete Core coverage and reasons | HELD. Declared tools remain form design and lifecycle only; other job families and complete reasons remain omitted. agent-surface.json is unchanged. |
| 2, fixture output schemas | Existing declared-tool conformance preserved; BASE-AGENT-002.2 schema and autonomous and held journey assertions remain active. Not a new completion claim. |
| 3, truthful annotations | Existing declared-tool conformance preserved; schema declarations and runtime class assertions remain active. Not a wider coverage claim. |
| 4, same native refusal code | PASS for the two scoped cases: tests/agent-door/business-refusals.mjs:12-22,40-50; native route serialization src/core/features/flows/routes.ts:57-63; native missing-step and wrong-state checks src/core/features/flows/service.ts:381-385,492-494. Remaining refusal cases remain held. |
| 5, equal state and audit | Scoped refusal no-effect evidence at tests/agent-door/business-refusals.mjs:25-38,51-66. Existing successful action and attribution assertions in tests/agent-door/native-journey.mjs:40-94 are preserved. Full UI and tool parity remains omitted. |
| 6, embedded registry adoption | HELD. No adoption or wider registration is claimed. |

The helper independently checks unchanged native state after each native refusal and again after each MCP refusal. It checks native audit equality, review equality, MCP isError, absent structured result, effect link, completion receipt, review and approval, and one matching refused audit row with the expected business code. It deliberately replaces the prior lowercase missing-step expectation without narrowing its no-write assertions. No other assertion, workload or registration was removed, weakened or conditionalized. The existing held-policy approval and no-effect, authority, attribution, native revision, idempotency and Pause proof remain active.

## DONE riders, reviewed without a DONE claim

| Rider | Result |
| --- | --- |
| 1 | PARTIAL for the whole clause: complete Core coverage, other refusals, full parity and embedded adoption remain omitted. Scoped cases use real native HTTP and MCP, not service fakes. |
| 2 | PASS scoped: existing journey proves successful native mutations and these two refused dangerous actions with unchanged real seeded state. Helper lines 30-66 assert outputs and writes independently. |
| 3 | Exact-SHA hosted CI proof pending at discovery. The unchanged push Verify hosted lane invokes scripts/verify-hosted-output.mjs, which calls checkAgentDoor and loads agent-surface.json verification.journey. No new registration or CI dispatch. |
| 4 | Exact candidate rerun recorded in CHECKS.json and agent-door.log; predecessor proof retained separately and not substituted for candidate proof. |
| 5 | INSPECTED: no receiving-clause or inheritance rewrite. BASE-AGENT-002 itself owns the tool obligation. |
| 6 | PASS mechanical: touched generator write and check passed; generated views restored; counts and all contract judgments unchanged. |
| 7 | PASS: no acceptance point, rider, ID, coverage rewrite or ruling changed. |
| 8 | PASS scoped: native allow-path journey, eligible-policy refused paths, authority negatives, held approval, attribution and Pause remain asserted. No broader permission claim. |
| 9 | PASS boundary: no provider, legal, device or scale qualification claimed or required for these refusal cases. |
| 10 | PASS: no policy default adopted or new authority decision introduced. |
| 11 | PENDING LANDER: product is branch-only. Main does not equal the candidate. Exact-SHA scan, guarded landing and resulting Run site are not cloud receipts. |

## Pre-ready self-check

1. The selected user-visible refusal outcomes are covered through the same public actions. Reverting the code-preserving adapter would fail VALIDATION_ERROR, reverting its classifier would fail NOT_FOUND, and admitting either action or emitting an effect or review would fail independent persisted-state and audit assertions. The full clause is not DONE.
2. No existing assertion was removed or narrowed except the explicitly required lowercase-to-native missing-step expectation replacement, retaining and extending all its no-effect assertions. No new registration was added. The existing test-budget file is unchanged; unrelated pre-existing over-cap counts were not rewritten.
3. Existing authority, revoked consent, replay and Pause conformance remain active. Resource adapter hiding is retained by matching native NOT_FOUND and returning null, with unchanged shared Base resource_unavailable mapping; projection and sponsor-scope checks run separately. This run does not newly qualify erasure or every resource authority variant.
4. No screen or UI code is touched; viewport browser proof and icon audits are not applicable to this transport-only change.
5. Source lock is fresh. Verify and Run site status are recorded honestly below. Publication scan: commit=191c091413fa30a975150e462f1cc9c4ea869be1 complete=not-run-in-cloud historyScanned=not-established findings=not-established. The Mac lander owns the complete full-history publication scan and exact-SHA landing gates. Changed product text contains no added email-shaped fixture values or credentials. All candidate author and committer identities are fleet, and there are no trailers.

## Validation and custody

Setup completed via cloud_run npx -y @runeditrun/rer setup with the requested owner and noninteractive flags. Candidate build completed via cloud_run timeout 1200 npx -y @runeditrun/rer build --non-interactive, exit 0. Dependencies and Base pin were retained. Candidate runtime checks use the installed Node 22.20.0 and each check has a hard 1200-second timeout. The predecessor conformance also passed, 2312 of 2312 points, before integration.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then pnpm source:check exit=0; views=node scripts/contract-docs.mjs write BASE-AGENT-002 then check BASE-AGENT-002 exit=0; ledger=none exit=0.

Product push succeeded on attempt 1 using the fleet cloud-push guard. No force push, main push, PR, workflow edit, new test registration, deployment or outbound provider activity was performed. Exact-SHA Verify push run 42539915478 was in_progress at discovery; its conclusion was null. No green result from another SHA is substituted. No CI rerun or dispatch was requested. CI.json holds the actual REST receipt. Run site remains a post-landing gate. The publication scan and guarded landing remain with the Mac fleet.

CLAIM BASE-AGENT-002 PARTIAL points=4 tests=tests/agent-door/native-journey.mjs#nativeJourney; tests/agent-door/business-refusals.mjs#proveBusinessRefusals
GAP BASE-AGENT-002: Complete Core tool coverage and not-a-tool reasons, remaining refusal cases, full UI and tool state and audit parity, and embedded-agent registry adoption remain omitted. Wider job families, all other BASE-AGENT judgments, owner, account, ct and Base holds, historical exclusions, activation and release prerequisites are unchanged.

Final candidate local receipts and evidence transfer result are appended below after all commands finish. Evidence publication is separate from product readiness and acceptance.

Final local checks on 191c091413fa30a975150e462f1cc9c4ea869be1:

- agent-door: exit 0, 39.06 seconds; actual command and log in CHECKS.json.
- resources: exit 0, 8.36 seconds; actual command and log in CHECKS.json.
- typecheck: exit 0, 41.0 seconds; actual command and log in CHECKS.json.
- first-party: exit 0, 2.26 seconds; actual command and log in CHECKS.json.
- source-check: exit 0, 2.74 seconds; actual command and log in CHECKS.json.

Agent conformance: 2312 of 2312 PASS, including the native business refusal helper. Resource projection, evidence scope and sponsor authority: PASS. The product checkout remains clean and no local command is pending. No product blocker was found. The remaining wider clause gaps keep the claim PARTIAL.

The separate evidence publication explicitly selects all report and actual receipt files; no credential, environment dump, captured mail, private gate material or symlink is selected. Product head, branch and index are unchanged by evidence transport. Cleanup removes the disposable product clone after successful publication; the packet stays outside it.
