# sd-pencil-c-f26 report

Pencil's explicit email-question suffix acceptance point is implemented and locally proved. LOGIC-006 remains **PARTIAL**. No DONE restoration, activation, release qualification or landing is claimed.

- Repository: just-every/run-pencil.
- Product branch: cloud/sd-pencil-c-f26.
- Candidate: 9877fe36b4c31f61cc6a4a13b1096634c822198f.
- Base and latest fetched main: 49b3a00c8c789258ac93cbcde23c0103ae829b2d.
- Save commit: 6d43bc40f0ddc82a1f882fdeca22cd73bd518722.
- Candidate commit: 9877fe36b4c31f61cc6a4a13b1096634c822198f.
- Predecessor replayed: 2edc469 and 8ca2948d787b989dd6057406881fde2e5a982539, as new commits with fleet identity. No predecessor commit is a candidate ancestor. All other writers' main commits are retained.
- Before and after: 142 DONE, 61 PARTIAL, 49 MISSING. Clause status PARTIAL → PARTIAL. No Status, Gap or Evidence cell changed; CONTRACT.md has no diff.
- PR: none; the repository starts Verify candidate on a cloud branch push.
- Exact candidate Verify: push run 42428434428, initially queued. Final observation after at least 300 seconds: in progress, conclusion null, exact candidate SHA confirmed. It is recorded in RECEIPT.json and CI.txt. No final green result is claimed.
- Main health: Verify candidate push 42425806037 and Run site push 42425806066 both completed successfully at 49b3a00c8c789258ac93cbcde23c0103ae829b2d. An earlier successful Verify on that same SHA is 42422831202.
- Product push custody: both saves and the final candidate succeeded through the provided cloud push guard. No push to main, no force push, no published-history rewrite.

## Work and plan results

The full original execution plan is PLAN.md. Its steps are complete except the independent exact-SHA CI, publication scan and landing results described below. The sole plan row changed is LOGIC-006: its selected email-question suffix point is now implemented and locally proved; all held remainder stays held and the clause is still partial. The plan extract was not rewritten or re-sorted.

The existing condition editor now offers “ends with” for native email questions. It retains the authored value after save and reload and displays the rule summary. Shared preview and collection evaluation compare text after trimming, Unicode NFC normalization and lowercasing, keeping the existing equality normalization order. Blank and skipped operands still match only is blank. Other text types and hidden or calculated operands do not gain this operator.

A small email-domain solver preserves exact correlated publication decisions across repeated equality, inequality and suffix conditions. It uses the real admission validator for email syntax and the raw 200-character bound, including a shorter Unicode preimage when lowercasing expands a character. Compatible suffixes retain their longest tail; incompatible suffixes, contradictory equalities and rules shadowed by earlier correlated matches cannot create a reachable destination. Each attempted witness spends the existing shared proof budget, and exhaustion refuses the authoring write. Unestablished unusual Unicode normalization cases refuse proof rather than inventing a possible destination.

The two existing native conditions registrations and the existing browser conditions registration were extended. No registration was added or removed, no previous assertion was removed or narrowed, no workload or threshold changed, and no assertion was put behind a width flag. The additional native helper covers admission and refusal boundaries. No reporting, export, results, migration, dependency, Base pin, homepage or workflow production file changed. Existing test-budget metadata remains unchanged (277 registrations and 380 expanded cases as recorded on main); this round adds zero.

After the save, `git fetch origin main` and `git merge --no-commit origin/main` reported already up to date. No merge conflict or new merge commit occurred. The contract generator write and check succeeded with LOGIC-006; generated ACCEPTANCE.md and docs/CLAIMS.md were restored from main. The source lock was generated last and its check passed before the candidate commit. Only product source, its focused tests and sources.lock.json are in the product branch.

## Selected-point rubric and public-door proof

The acceptance paragraph is not numbered in CONTRACT.md. `points=2` denotes its second semicolon-delimited outcome: the explicit gmail.com email suffix example. Supporting checks below do not claim completion of any held full-clause outcome.

| Row | Outcome | Proof and result |
| --- | --- | --- |
| R1 | An operator authors the email suffix rule and reopens the same saved operand, operator and value | MET locally: `tests/e2e/conditions.spec.ts` existing “builds nested lead conditions, inspects their values and collects both published paths”, invoking `tests/e2e/email-suffix-scenario.ts:25` through line 50. Both widths pass. |
| R2 | Uppercase GMAIL.COM matches and gmail.co follows the default in preview | MET locally: same browser registration and helper at line 52 through 68; displayed operand, true or false trace and chosen destination are asserted. |
| R3 | Both outcomes reach their expected published native collection completion | MET locally: same helper at line 70 through 82, with the ledger showing two submissions. Also native `emailSuffixRoutingProof` at lines 33 through 76. |
| R4 | Comparison trims the authored suffix and normalizes Unicode NFC and case | MET locally: browser rule retains surrounding spaces; `tests/runtime/email-suffix-proof.ts:77` through 90 publishes decomposed accented text and an admitted 200-character expanding Unicode address. |
| R5 | Optional omitted, empty and whitespace-only answers remain blank; skipped matching answers do not affect the route | MET locally: native helper at lines 50 through 60. Missing and blank values go to default; an email answer submitted while its question is skipped is discarded. |
| R6 | Equality and suffix contradictions, repeated suffix compatibility and negative precedence remain correlated | MET locally: native helper at lines 115 through 152. Compatible repeated suffixes publish; incompatible suffixes and equalities refuse the unreachable matching completion; both orders of suffix precedence and a negated-equality first rule are exercised. |
| R7 | Publication uses actual admitted email syntax and its raw 200-character bound | MET locally: native helper at lines 61 through 69 and 115 through 143. Valid 200-character address accepted; 201 characters, surrounding raw whitespace, missing separator and duplicate separator refused without response writes. Boundary suffix and equality publication witnesses are checked independently. |
| R8 | Existing admitted visitors keep their published suffix revision after a new draft is published | MET locally: native helper at lines 71 through 76, where the admitted old session matches and the new session takes default after the suffix changes. |
| R9 | Extra off-path answers are absent from stored response answers | MET locally: native helper at lines 52 through 60 queries the actual stored answer IDs for both skipped email and skipped note cases. |
| R10 | Proof-budget exhaustion refuses without a draft or rule mutation | MET locally: native helper at lines 157 through 169. The 24-question fixture's rule write refuses with the exact reachability-proof-limit reason and preserves rules, draft version and revision. |
| R11 | Existing numeric publication ordering remains intact | MET locally: `tests/runtime/graph-reachability.worker.test.ts` “publication rejects impossible screens without writing a revision, remains editable, and validates the policy actually published”: one test passed at the final candidate. |
| R12 | Existing nested conditions, copies, immutable revisions and the original four browser paths retain their assertions | MET locally: the original native and browser registrations passed with their assertions unchanged. |

PROBE LOGIC-006 2: existing builder selects native email, ends with and spaced GMAIL.COM, saves and reloads -> identical saved rule and readable summary at 1440 and 390.
PROBE LOGIC-006 2: draft preview enters an address with uppercase matching domain and an address ending gmail.co -> true matching trace and false default trace, respectively, at both widths.
PROBE LOGIC-006 2: published form submits those two valid addresses -> matching and default completion headings, respectively; authenticated ledger total is two.
PROBE LOGIC-006 2: native response route receives optional blanks and a matching email on a skipped question -> default completion; skipped answer absent from actual stored answer IDs.
PROBE LOGIC-006 2: native response route receives 200-character admitted and 201-character invalid emails -> 201 created and 400 validation refusal, respectively, with no response write on refusal.
PROBE LOGIC-006 2: native publication receives incompatible repeated suffixes, contradictory equality and shadowed correlated rules -> unreachable destination refusal; compatible suffixes publish.
PROBE LOGIC-006 2: a previously admitted session and a fresh session submit after a new suffix revision -> old matching and new default completion, respectively.

## Full-clause acceptance sentences and inherited duties

| Acceptance sentence or outcome | This round's disposition |
| --- | --- |
| Compound lead form, four answer sets including a hidden enterprise operand | Existing original four-path journey is preserved. The complete hidden-operand acceptance example is not newly claimed by this round. |
| Email ends with gmail.com, uppercase domain matches and gmail.co does not | CLOSED locally by R1 through R4; exact-SHA Verify still has to finish. |
| Single-choice is not routes every other choice | Existing native conditions assertions preserved; not a newly closed point. |
| Optional blank routes, does-not-equal does not match it, preview shows condition values | Existing native and browser assertions preserved; additional email blank and skipped-answer cases pass under R5. |
| Later or deleted hidden operand publication refusal names its rule | Existing native registration assertions preserved; no new broader condition-validation claim. |
| Off-path answer accepted and excluded from storage, scoring and exports | Existing behavior preserved. The new email proof directly checks storage and routing under R9; broader scoring and export custody remains with the existing RESP-004 proof, not a new full-clause completion claim. |
| Faithful Typeform compound text and hidden conditions and Jotform Any import | HELD and still owed. No import production change. |

| Named completion dependency | Disposition |
| --- | --- |
| FIELD-001, FIELD-002, FIELD-008, FIELD-010, FIELD-012 | Existing main judgments retained. Email suffix delta makes no completion claim about missing hidden supply, Other text or grid operand coverage. |
| LOGIC-003, LOGIC-005 | Existing evaluator consumers and main judgments retained. No new calculated-operand or redirect work. |
| LOGIC-004 | Still required; remaining quiz and outcome operands and consumers are outside the selected point. |
| NOTIFY-005 and NOTIFY-006 | Still required. Remaining alert and answer-bearing email consumers and provider or legal holds are not represented as proved. |
| PAY-001 | Still required; remaining payment operands and its own qualification are unchanged. |
| IMPORT-005, IMPORT-006, IMPORT-007 | Still required; compound-condition mappings and account-held imports remain owed. |
| A11Y-001 | Existing keyboard duties remain; the changed editor and respondent screens have passing Axe and overflow assertions at both widths. |
| DIST-015, DIST-021, FIELD-005, FIELD-011 and other already declared holds | Explicitly preserved. This point adds no registration, results or export production change and does not release any hold. |

## DONE-RIDERS and pre-candidate checks

These are assessed honestly for a PARTIAL claim; there is no claim that all rows meet the full-clause DONE bar.

| Rider | Result | Evidence |
| --- | --- | --- |
| 1 | PASS for selected point; FAIL for full-clause DONE | R1 through R12 cover the selected public-door outcomes. Remaining operators, operands, imports, consumers and named prerequisites remain owed. |
| 2 | PASS for selected point | Independent fixed matching and default completions, actual native admission refusals, actual response rows and immutable-session comparison. |
| 3 | PENDING | Exact-SHA push Verify 42428434428 runs the unchanged existing native and browser lane registrations. No green result is inferred from another SHA. |
| 4 | PASS locally | Browser and production bytes did not change after the recorded browser proof; final commit adds only native boundary proof and lock bytes. Native helper's final bytes passed before commit and remain byte-identical. Graph-ordering proof ran on the final commit. |
| 5 | INSPECTED, unchanged | No clause text or inherited duty changed. Existing clause names its completion dependencies; no inheritance is newly claimed. |
| 6 | PASS mechanical; status work reserved to lander | Incremental write and check passed, views restored, counts unchanged. No Status, Gap or Evidence cell edited. |
| 7 | PASS | No acceptance wording, ID, rider or coverage-map change. |
| 8 | NOT APPLICABLE to this delta | No authority, payment correction, refund or permission path changed. Existing authenticated authoring is exercised by the browser journey. |
| 9 | PASS | No real provider or legal qualification claimed; all external and broader clause holds remain explicit. |
| 10 | NOT APPLICABLE | No policy default adopted; normalization and admission semantics follow the existing contract and validator. |
| 11 | PENDING LANDER | Candidate is branch-only. Main equality, full-history scan and candidate Run site remain with the maintained Mac lander. |

Pre-candidate (1): Selected email point has native and browser public-door assertions; full-clause DONE is not claimed. (2): Existing assertions and workloads retained; zero new registrations. (3): No authority, erasure or replay production path changed. Off-path answers are actually submitted and shown absent from storage; immutable revision admission is exercised. The broader revoked-credential, erasure and replay guarantees remain existing CI duties, not newly claimed local proof. (4): Inspected both changed-screen widths. Condition fields retain existing typography and full field borders. Condition editor controls are labeled; surrounding icon-only move controls already use the shared tooltip with 300ms hover and immediate focus. No new configuration surface. (5): Source lock and local gates pass; exact candidate scan, main equality, Verify and Run site statuses are reported separately and never fabricated.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and node scripts/edition-authoring/cli.mjs check exit=0; views=node scripts/contract-docs.mjs write LOGIC-006 and node scripts/contract-docs.mjs check LOGIC-006 exit=0; ledger=none exit=0.

Publication scan: commit=9877fe36b4c31f61cc6a4a13b1096634c822198f; complete=false; historyScanned=unestablished; findings=unestablished; NOT RUN in cloud under the explicit adaptation. Fresh full-history clone and exact candidate identity and message inspection passed. The independent Mac lander must perform its COMPLETE zero-finding scan and exact-SHA workflow gates. Main equality is false by design: this cloud pushes only its named branch. Run site on the candidate is not yet available because it is main-only.

## Operational results and limits

Both initial native conditions tests passed (28.68s); the extended final native tests passed (26.45s, two registrations). The browser registration passed twice, 39.9s at 1440 and 40.6s at 390 (2.2m including fresh server startup). The graph-ordering regression passed (22.33s including startup). Typecheck and first-party checks passed again on the final candidate; the production build completed with exit 0. Generator, source lock and final source check including offline Base integrity passed. The first browser launch attempt failed before tests because its temporary config resolved the web-server command under /tmp; adding the explicit checkout cwd corrected that local harness configuration. No product change was needed and no CI repair was attempted. Successful browser output includes workerd pipe-disconnection diagnostics during connection shutdown; both registrations and the runner exit passed. Relevant complete logs and actual screenshots are selected explicitly in the evidence packet; no profile, cookie state, credential, trace archive or private environment dump is included.

No target blocker remains for the selected email suffix point. Full-clause remainder stays owed rather than being narrowed away. Evidence transfer is report-only custody and does not signal acceptance, readiness or landing. PLAN.md and RECEIPT.json provide the complete execution plan and actual command results. The candidate is handed to the maintained lander under the explicit cloud READY rule while CI is still running; READY is a branch-custody handoff, not a green-CI or landing assertion. Publication scan and landing remain mandatory there.

CLAIM LOGIC-006 PARTIAL points=2 tests=tests/e2e/conditions.spec.ts#builds nested lead conditions, inspects their values and collects both published paths; tests/runtime/conditions.worker.test.ts#publishes correlated AND OR conditions, handles blank and negative operands and preserves immutable routing and copies; tests/runtime/conditions.worker.test.ts#refuses destinations made impossible by constraints on an earlier question without publishing
GAP LOGIC-006: The explicit email-question suffix point is locally proved; all remaining text operators and operand types, Other text, remaining grid and quiz and payment coverage, quiz and alert and response-email consumers, compound imports and every unmet named completion dependency remain required. No DONE restoration, activation or release qualification is claimed.
