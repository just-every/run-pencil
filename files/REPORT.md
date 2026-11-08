# sd-pencil-c-f38 results

RESP-020 remains PARTIAL. The scoped second-opt-in and answer-type proof is complete on d5c81d3c666e4036f92bc4f4bc43ac12344db75d, branch cloud/sd-pencil-c-f38. Counts remain 142 DONE, 61 PARTIAL, 49 MISSING before and after. No status, gap, evidence or acceptance cell changed.

The requested f37 predecessor af4e05084534df677bf5c33ec3b7f776181f9eaf already contained the focused scenario and all requested cases. This run replayed it onto main feebe981e55bb369397c6b6d57b7f0fa5e20bb3b, preserving the newer audit-export work and every main judgment. No redundant edit or registration was added. The candidate differs from main only in the focused helper, its import and invocation in the existing registration, and the source lock. All four referenced production modules are unchanged. No screen changed; browser proof is not applicable to this native test-only round.

## Plan and execution

The complete initial plan is in PLAN.md. Completed: fleet setup, full-history clone, requested predecessor fetch and replay, source and contract reading, public-door proof mapping, setup with fleet owner, touched Worker run, typecheck, first-party check, generator write and check, generated-view restoration, final main reconciliation, source-lock regeneration and check, identity and trailer review and guarded branch push. Product push succeeded on the first attempt. No pull request is required: Verify candidate runs directly on cloud branches.

No duplicate permanent test was needed: the predecessor already reaches all requested outcomes. All existing positive recall, escaping, date, recipient, retry, replay, edit-link, suppression, release and erasure assertions are retained byte for byte. The only changes in their existing file are the helper import and invocation. Zero registrations added or removed.

## Scoped proof rubric

All rows below execute through the same existing test: tests/runtime/respondent-confirmations.worker.test.ts, “released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy”, registration at line 12, helper invocation at line 133. The helper is tests/runtime/confirmation-withholding-scenario.ts. No answer is obtained from history; independent expected strings are fixed in the committed helper.

- R1 — Authenticated settings and publication: helper lines 28–33 sign in through the native magic-link door; lines 35–67 create a real form, save version-guarded settings, reopen them and publish. PASS in local exact-head Worker run.
- R2 — Populated fixture and allowed baseline: lines 45–56 declare distinct selected, excluded, hidden and calculated canaries. Lines 75–102 collect through unauthenticated public session and response doors and observe the real mail sender at its network edge plus persisted message_json. Lines 118–119 prove all operands render when allowed. PASS.
- R3 — Copies off: lines 120–122 publish includeAnswers=false despite a populated whitelist, then enable copies only in the draft. The public collection still uses the original published settings, delivers one receipt and withholds every private canary from subject, plain body, HTML and message_json. Assertions at lines 77–109. PASS.
- R4 — Empty whitelist: lines 123–125 publish includeAnswers=true with answerTypes=[], then edit only the draft to allow short_text. Receipt still sends once without any copied values or answer section. PASS.
- R5 — One permitted type: lines 126–129 publish short_text only. Fixed “synthetic-pencil-selected-answer-37” appears in subject and bodies and persisted copies; long_text, numeric hidden value and the text calculation depending on excluded long_text remain absent. The calculation output type is permitted, so exclusion proves dependency withholding rather than only output-type filtering. PASS.
- R6 — Frozen revision: lines 77–78 assert returned revision and published settings; lines 120–129 exercise unpublished changes to both gates in both directions. PASS.
- R7 — Exactly one receipt and replay: lines 86–89 assert one sent row and one attempt, lines 111–113 repeat capture with the same idempotency key and run dispatch again with no second mail. PASS.

PROBE RESP-020 second-opt-in: authenticated settings publish copies off with populated allowed types; public complete with valid marked mailbox -> one receipt, blank recall, no answer canaries in subject, plain body, HTML or persisted message_json.
PROBE RESP-020 empty-whitelist: authenticated settings publish copies on with no allowed types; public complete -> one receipt, no private canaries or answer section.
PROBE RESP-020 selected-type: publish short_text only; public complete -> fixed selected value present, excluded long_text, numeric hidden recall and dependent calculated text absent.
PROBE RESP-020 revision-freeze: change draft gates without publishing, then public complete -> published settings and behavior retained.

## Acceptance and inheritance map

- Acceptance sentence 1: escaped answer copy, absent anonymous recipient and transient-failure retry are exercised by the existing registration at lines 46–58 and 88–101; local PASS. The helper strengthens the approved optional-copy boundary without changing those assertions.
- Acceptance sentence 2: three recall sources, blank skipped values and inert markup are checked at lines 55–58; local PASS. Helper lines 95–102 prove all three withholding surfaces with populated values.
- Acceptance sentence 3 and inherited FIELD-015: published date display is checked at lines 58 and 66; local PASS.
- LOGIC-001 inherited recall is named in the clause and registration; allowed and withheld recall are exercised as above.
- DIST-006 retry and durable key are checked at lines 46–53; replay at lines 67–68 and helper 111–113.
- GOV-004 sensitive marking, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt. Their existing inheritance is preserved; this test does not prove them.
- Restored history is owned by the unchanged notification-restore journey and private archive journey. Those files are INSPECTED references only in this round; no additional execution or new qualification is claimed.

## DONE-RIDERS review

No DONE claim is made. These results distinguish scoped proof from whole-clause completion.

1. PARTIAL overall: scoped R1–R7 and the three existing acceptance sentences pass locally; sensitive, quiz, payment and signature obligations remain held. Exact-head full Verify is recorded separately and is not assumed green.
2. PASS for scoped proof: real populated response data, all-allowed baseline, both copy refusals and selected-only allowed case, fixed expected values; helper lines 80–113 and 118–129.
3. PENDING: existing registration matches vitest.worker.config.ts include glob and Verify's native shard; push Verify run 42492708029 on the exact candidate was discovered in progress. No nightly-only proof or environment flag added.
4. PASS: local Worker, typecheck, first-party, generator and lock checks ran on the candidate. No later product edit occurred.
5. INSPECTED: clause explicitly names LOGIC-001, FIELD-015, DIST-006 and the held GOV-004, LOGIC-004, PAY-001 and SIGN-001 inheritance. No clause text changed.
6. PASS mechanically: matching write and check for RESP-020 succeeded with 142 done, 61 partial and 49 missing. Generated views were restored whole from main; contract and status rows are unchanged. Lander owns future provenance and judgments.
7. PASS: no acceptance sentence, status row, ruling or coverage rewrite changed.
8. PASS within touched boundary: authenticated native settings and publication, public collection, typed marked recipient and frozen published revision; original recipient, suppression, public capability reuse and erasure assertions retained. No new authority production code.
9. PASS boundary honesty: synthetic network-edge mail only; no real provider call, consent, live qualification, activation or release is claimed.
10. PASS: no policy default adopted; existing ct-approved second opt-in and revision rules remain unchanged.
11. PENDING guarded landing: branch only; main equality, candidate full-history scan and post-landing Run site are not established here. Existing main has green Verify 42491764033 and Run site 42491764100; neither is presented as candidate evidence.

## Pre-ready review and mechanical receipts

- Scoped behaviors have public-door assertions in the existing registration. Full Verify is tracked on its actual SHA, with no claim from a different run.
- No existing assertion was removed, narrowed, skipped or moved behind a condition. No test registration changed.
- Existing replay, erased-response cleanup, suppression, release and single-use edit-capability assertions remain and pass in the touched registration. Broader revoked-operator and archive paths are unchanged and not newly qualified.
- No UI touched; screen typography, tooltips and dual-width screen proof are not applicable.
- Source lock is fresh. No new email-shaped fixture literal is present: the helper constructs its synthetic mailbox. A complete publication scan remains the Mac lander's responsibility under the cloud adaptation. Scan receipt: commit=d5c81d3c666e4036f92bc4f4bc43ac12344db75d complete=UNESTABLISHED historyScanned=UNESTABLISHED findings=UNESTABLISHED. No zero-findings claim is made.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock && node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write RESP-020 && node scripts/contract-docs.mjs check RESP-020 exit=0; ledger=none exit=0.

Local receipt: Worker 1 file and 1 registration passed, 18.87 seconds total; typecheck exit 0; first-party check exit 0; generator write and check exit 0; lock regeneration and check exit 0. Commands, head and runtime versions are in checks-receipt.json; actual Worker output is worker.log. There was no failed repair and no CI rerun or dispatch.

Plan row update for the lane: RESP-020 scoped second-opt-in and type-whitelist proof COMPLETE; PARTIAL stays PARTIAL. No other campaign row changes.

CLAIM RESP-020 PARTIAL points=1,2,3 tests=tests/runtime/respondent-confirmations.worker.test.ts#released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy
GAP RESP-020: GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt. No real mail provider call or consent was used; no DONE, activation or release qualification is claimed.
