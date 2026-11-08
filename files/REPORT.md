# sd-pencil-c-f37 — RESP-020 withholding proof

Product: just-every/run-pencil. Branch: cloud/sd-pencil-c-f37. Exact candidate: af4e05084534df677bf5c33ec3b7f776181f9eaf. Parent and fetched main: 18ef418c11ba90618205512f485918fe5aae68bb.

RESP-020 remains PARTIAL. The selected native proof is complete: receipts still send exactly once when copies are off or the allowed-type list is empty, while answer, hidden-field and calculated canaries remain absent from the subject, plain body, HTML body and retained message JSON. Allowing short text reveals its fixed expected value while excluded long text, numeric hidden recall and a permitted-output-type calculation depending on excluded long text remain blank. Unpublished draft changes in both directions leave published behavior unchanged. A permissive positive control first proves all seeded values can render. Every collection is replayed and followed by another dispatcher run without duplicate mail.

Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. RESP-020: PARTIAL to PARTIAL. No Status, Gap or Evidence cell, acceptance point, generated view, production file, workflow or package pin changed. Registration delta: zero. The existing registration remains one test. Its original bytes are identical after removing the added import and helper call; no existing assertion was removed, narrowed, skipped or made conditional. No duplicate or pin registration was encountered or removed. The pre-existing seed test-budget metadata is unchanged.

Read PLAN.md for the full plan and results, RECEIPT.json for commands, exits and exact source hashes, product.diff for the complete candidate diff, and the selected terminal logs for actual check output. All evidence stays outside the product tree. No PR was created: the existing cloud-branch push entry point started Verify directly.

## Proof names and doors

T = tests/runtime/respondent-confirmations.worker.test.ts, test "released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy", registration at line 11 and helper call at line 133.

H = tests/runtime/confirmation-withholding-scenario.ts, helper confirmationWithholdingScenario, called only by T. Authentication obtains and consumes a native sign-in link, lines 26 to 33. The authenticated flow, question and draft-settings routes create the fixture, lines 35 to 61. The publication route is at lines 64 to 67. Unauthenticated session and response routes collect populated answers and hidden context, lines 75 to 83. The unchanged production dispatcher invokes the unchanged mail adapter with a synthetic outgoing network edge, lines 69 to 74 and 85. The receiver and persisted message are compared, lines 87 to 109. Replay is checked at lines 111 to 113. The five scenario cases are at lines 118 to 129.

Local exact-candidate T run: one registration passed, 15.18 seconds total and 2.15 seconds in the test. The earlier same-byte pre-commit run also passed. Typecheck, first-party check, touched contract generation and check, source lock check and complete source check all exited zero. CI: push Verify candidate run 42489922999, exact head af4e05084534df677bf5c33ec3b7f776181f9eaf. Its final observed state is recorded in RECEIPT.json and candidate-ci-status.json when present; no other SHA's run is substituted.

## Frozen scoped rubric

| Item | Outcome | Exact proof |
| --- | --- | --- |
| P1 | PASS locally | Copies off despite a populated whitelist: H lines 120 to 122; one sent row and attempt at 86 to 89; all rendered and retained surfaces blank or free of private values at 94 to 109. A more permissive unpublished draft cannot affect the published revision. |
| P2 | PASS locally | Copies on with no allowed types: H lines 123 to 125; one receipt, all private values withheld, no answer section; an unpublished short-text whitelist does not change that revision. |
| P3 | PASS locally | Short text only: H lines 126 to 129 and 95 to 106; independent fixed expected selected value appears. Excluded long text and numeric hidden data stay absent. The text calculation has an allowed output type but depends on an excluded input and stays blank. |
| P4 | PASS locally | Published settings match the session snapshot at H lines 77 to 78 in all five cases. Draft enablement, type selection and disablement do not change live behavior until publication. |
| P5 | PASS locally | H lines 118 to 119 prove all operands really render with both gates open; H lines 111 to 113 prove a replay and later dispatcher run add no receipt. |
| P6 | PASS inspected and locally | The original T bytes and all original outcomes are preserved. The full T registration passed on the candidate. No production path or registration changed. |

## Clause acceptance sentences

| Point | Result | Test and lines | Verify event and conclusion |
| --- | --- | --- | --- |
| 1 — completion with marked mailbox, one escaped copy, no anonymous recipient, transient retry | PASS locally; original proof preserved | T lines 32 to 55, 81 to 87 and 89 to 97; H lines 75 to 113 add the selected copy-gate coverage. | Push, run 42489922999, terminal observed conclusion in RECEIPT.json. |
| 2 — answer, hidden and calculated recall, blank skipped values, inert injected markup | PASS locally; original positive proof plus new withholding proof | T lines 29 and 51 to 55; H lines 49 to 56, 95 to 109 and 118 to 129. | Push, same exact-head run. |
| 3 — published date display format | PASS locally; original proof preserved | T lines 25 and 55 to 61 assert 07/04/2026 and refuse the ISO representation in the receipt. | Push, same exact-head run. |

## Inherited duties and retained boundaries

| Duty | Result | Test and lines or honest boundary |
| --- | --- | --- |
| LOGIC-001 positive recall, escaping, blank skipped values | PASS locally | T lines 51 to 55; H lines 118 to 119 add a positive conditional-calculation control. |
| LOGIC-001 withholding under the second opt-in and allowed types | PASS locally | H lines 95 to 109 and 120 to 129, including an allowed text output depending on excluded long text. |
| FIELD-015 published date display | PASS locally | T lines 25, 29 and 55 to 61. |
| DIST-006 retry and stable delivery identity | PASS locally | T lines 42 to 48 preserve transient rejection, successful retry and one durable key. |
| Recipient selection and exclusions | PASS locally | T lines 50 to 51, 77 to 79 and 81 to 118 preserve marked mailbox, participant, anonymous refusal, quarantine release, opt-out and bounce handling. H lines 45, 59 and 91 preserve a valid marked mailbox even when its type is excluded from answer copies. |
| RESP-021 no access link by default, one enabled single-use edit link, no Reply-To | PASS locally | T lines 52 and 56 to 75, 119 to 127. |
| DATA-002 receipt and attempt erasure | PASS locally | T lines 128 to 131. |
| Replay protection | PASS locally | T lines 62 to 75; H lines 111 to 113. |
| BRAND-001 current branding | INSPECTED, unchanged | No branding or production source changes. Existing positive receipt rendering runs within T. No new theme qualification claimed. |
| Private archive custody and restored-history refusal | RETAINED, not newly run | Existing notification-restore and archive evidence named by the Status row is unchanged. This round does not claim a new restore execution. |
| GOV-004 sensitive-answer withholding | UNBUILT, held | Remains named in the clause and Status Gap; not replaced by the type gate. |
| LOGIC-004 quiz results | UNBUILT, held | Remains named and inherits before shipping. |
| PAY-001 payment receipt links | UNBUILT, held | Remains named and inherits before shipping. |
| SIGN-001 signed PDFs | UNBUILT, held | Remains named and inherits before shipping. |
| Real mail provider, consent, activation and release qualification | NOT CLAIMED | Synthetic outgoing edge only, with no actual provider request. All supplied account, owner, ct and Base holds, queue exclusions and prerequisites are retained. |

## DONE-RIDERS

| Row | Assessment | Proof or limit |
| --- | --- | --- |
| 1 | Selected scope PASS locally; full clause remains PARTIAL | T covers the three acceptance sentences; H covers every selected withholding outcome. The four unbuilt optional dependencies remain held. No DONE claim. |
| 2 | PASS locally | Populated independent values, permissive positive control, denied cases, exact fixed expected text, one sent row and replay refusal. H lines 80 to 113 and 118 to 129. |
| 3 | PASS exact-SHA CI | Existing default Worker include pattern loads T and its awaited H call. Push Verify run 42489922999 completed successfully on the exact candidate; its terminal state is in the receipt. No nightly flag or new registration. |
| 4 | PASS locally | T reran on the committed candidate. No relevant byte changed afterward; hashes are in RECEIPT.json. |
| 5 | PASS inspected | RESP-020 already names LOGIC-001, FIELD-015, BRAND-001, DIST-006, GOV-004, LOGIC-004, PAY-001 and SIGN-001 duties. No inheritance rewrite. |
| 6 | PASS mechanical, judgment unchanged | Touched generator write and check exited zero, then both generated views were restored from main. No Status, Gap, Evidence or provenance cell was edited. |
| 7 | PASS inspected | CONTRACT.md is unchanged; no acceptance rewrite or new policy. |
| 8 | PASS for touched scope | Settings and publication use an authenticated native session. Public collection is unauthenticated as declared. No authority implementation changed; existing recipient, suppression, release and erasure assertions all pass. No broader new authority qualification claimed. |
| 9 | PASS boundary | No real-provider or legal proof is asserted. All held dependencies and qualification gaps remain explicit. |
| 10 | PASS | No policy default adopted. Uses the supplied ct-approved revision freeze, marked mailbox, second opt-in and type-whitelist rules. |
| 11 | PENDING guarded lander | Main does not equal the branch candidate. Main at the fetched parent has green Verify and Run site. Candidate scan, guarded landing and exact-main Run site belong to the maintained Mac lander. |

## Mechanical and pre-ready checks

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then node scripts/edition-authoring/cli.mjs check and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RESP-020 then node scripts/contract-docs.mjs check RESP-020 exit=0; ledger=none exit=0

The final fetch and rebase found the branch current. Source lock generation followed the final test edit; the source check passed after the no-op rebase. Product commits use fleet author and committer, with no trailers. All candidate commit identities and messages, including side parents if present, were inspected before the guarded push. There is one new commit and no side parent. Full Git history is present; the checkout is not shallow. No new literal email-shaped fixture or provider-shaped key was introduced. No bare prose repository-looking token was added outside real module or route paths and standard media types.

Pre-ready 1: scoped outcomes check both allowed and withheld behavior against independently fixed expected values; removing either gate, its input dependency or revision freeze would violate the explicit assertions. No production mutation was made. Exact-SHA CI is recorded separately.

Pre-ready 2: the original registered test's full byte sequence is preserved after removing the import and final helper call. No existing assertion was removed, narrowed or hidden.

Pre-ready 3: replay and erasure paths remain exercised in T and replay is repeated in every H case. No credential or authority code changed. Broader credential-revocation and recovery qualification is not newly claimed.

Pre-ready 4: no touched screen or UI. Browser screenshots and width checks are not applicable to this test-only change.

Pre-ready 5: local checks and fresh source lock pass. The fetched parent main has green push Verify runs 42485618733 and 42485396555 and green Run site 42485618652. Those runs are parent provenance, not candidate proof. Candidate main equality and candidate Run site remain pending landing. Publication scan for af4e05084534df677bf5c33ec3b7f776181f9eaf: complete=NOT RUN, historyScanned=NOT ESTABLISHED, findings=NOT ESTABLISHED. The cloud branch push is explicitly exempt from a local scanner; the maintained lander must run its complete full-history scan and exact-SHA gates. No COMPLETE or zero-finding scan is claimed here.

PROBE RESP-020 second-opt-in: authenticated settings published with copies off and a populated whitelist, then public native collection with a marked mailbox and populated answer, hidden and calculated values -> one receipt, all answer recall blank and private canaries absent from subject, plain body, HTML body and persisted message JSON.

PROBE RESP-020 empty-whitelist: authenticated settings published with copies on and no allowed types, then the same public native collection -> one receipt, no answer section and every private canary withheld from every rendered and retained surface.

PROBE RESP-020 permitted-type: authenticated settings publish short text only, then public native collection -> fixed selected value appears, long text and hidden numeric value stay absent, and the text calculation depending on excluded long text stays blank.

PROBE RESP-020 draft-freeze: more permissive and more restrictive unpublished settings precede public collection -> published revision and its expected receipt content remain unchanged; replay and another dispatcher run produce no second receipt.

CLAIM RESP-020 PARTIAL points=1,2,3 tests=tests/runtime/respondent-confirmations.worker.test.ts#released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy

GAP RESP-020: GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt and inherit before shipping. Real mail provider and consent, DONE, activation and release qualification remain unclaimed; all existing holds and prerequisites are unchanged.

## Earlier CI observation

At 2026-11-08T14:33:22.671277+00:00, push Verify run 42489922999 remained in progress on af4e05084534df677bf5c33ec3b7f776181f9eaf. Three GitHub core calls have been used: exact-main discovery, exact-candidate discovery and the first candidate status read. The next candidate read is deferred for at least 300 seconds. No dispatch or rerun was issued.

## Final exact-head result

At 2026-11-08T14:43:25.708888+00:00, push Verify candidate run 42489922999 completed with conclusion success on af4e05084534df677bf5c33ec3b7f776181f9eaf. Five GitHub core calls were used in total; no dispatch, rerun, job-log fetch or repair was needed. The final REST response is candidate-ci-status.json. This is the candidate's own run, distinct from parent main provenance. DONE-RIDERS row 3 and pre-ready exact-SHA Verify now pass. Row 11 remains pending the guarded lander. Main equality, candidate Run site, the lander's complete publication scan and clause promotion are not claimed.

Product branch publication and remote readback both succeeded. The exact candidate's source bytes and clean checkout were checked again after CI. The complete relevant packet is published as a later report-only child of the initial evidence snapshot. The initial 23-file evidence readback receipt is retained as evidence-readback.json. Product and report-only histories remain separate. After the final evidence publication, the product clone and its dependencies are deleted as instructed; all actual packet files remain outside it.

READY custody is for guarded landing of the selected proof. RESP-020 remains PARTIAL under the supplied held remainder; the clause status cells and counts are unchanged. No DONE, activation, release, real mail-provider or consent qualification is inferred from green Verify.
