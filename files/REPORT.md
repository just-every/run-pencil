# sd-pencil-c-f22 results

Product: just-every/run-pencil. Branch: cloud/sd-pencil-c-f22. Full candidate: 6290af437d870e3aba69055e7e2578ae748967eb. Main base at preparation: b6a05948c040da9debdeb9d6ca10c13eacc304ee. No PR is required: branch pushes start Verify candidate.

## Outcome and scope

RSLT-007 remains PARTIAL. Its selected ranked first-choice answer-share point is complete locally. Counts remain 142 DONE, 61 PARTIAL, 49 MISSING, before and after. No Status, Gap or Evidence cell changed, and CONTRACT.md is byte-identical to main. No acceptance text, generator view, workflow, Base pin or registration changed in this round.

The supplied starting commit 8fe52b625820a953c327c67cae53ac84ac7bb452 already included the ranked-answer implementation and requested native and browser proof. It has successful push Verify 42410632224. This round retained both predecessor commits, checked their implementation and added meaningful refusal-scope coverage in the existing helper: retained null, empty and object-shaped rankings reject the trend, while collector and revision filters that exclude malformed evidence still return their independently fixed figures. Final incremental changes are that helper and its generated source lock. No unnecessary production rewrite was made.

The plan is retained in PLAN.md. In the terminal claim, points=1 refers to the one planner-selected ranked-answer point; it does not assert completion of the broader legacy clause. Only the RSLT-007 ranked-answer row of the shipped plan extract is advanced to implemented and locally proved; no Mac plan file was available or edited. No next clause is selected. Recurring occurrences require DIST-016; program series require PROG-003; structured-contact shares remain unbuilt. Existing ct 05:00Z wording, original-controller older-archive proof, DONE restoration, release qualification and other holds remain unchanged. This is a successful scoped partial result, not a DONE restoration or a release.

## Local verification

The native registration passes: one file, one registration, including every pre-existing collector, quota, statistic, disclosure, export and saved-report assertion. The complete existing answer-results browser registration passes at 1440 and 390: two executions of one registration. No assertion was removed, narrowed, skipped or moved behind a new width or branch condition. The original 13-question, 12-response fixture and its reversed rankings remain intact. Typecheck and first-party checks pass. Source lock generation and check pass; offline Base source check passes. RSLT-007 view generation and check pass; both generated files were then restored from main and never committed.

Commands, observed exits, relevant-file hashes and browser configuration are in RECEIPTS.json. Logs are runtime.log and browser.log. Local runtime and browser tests ran immediately before the final commit; their relevant source and test bytes did not change afterward. The only later write was the deterministic lock regeneration. Candidate mechanical checks were rerun on the committed head. The temporary Playwright configuration (retained verbatim as BROWSER-CONFIG.ts) selects system Chromium with no-sandbox, absolute checkout paths and the app server only; it changes no test, retries, workload or assertion. The first configuration attempt failed before application startup because its server resolved from the temporary directory; correcting its working directory yielded both passing journeys. Workerd printed broken-pipe diagnostics during server teardown, after passing assertions; browser command exit is zero.

## Scoped proof map

Native registration N is tests/runtime/collectors-trends.worker.test.ts, “named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports”. It calls tests/runtime/ranked-trend-proof.ts at line 190. Browser registration B is tests/e2e/answer-results.spec.ts, “answers first across every type, an RSLT-006 crosstab states shares and suppression, comparison replaces results and ledger confirms erasure”. Line numbers below refer to the final candidate.

| Item | Outcome and proof | Local result |
| --- | --- | --- |
| R1: published score and primitive-answer series | N lines 63–68 exercises weekly and monthly NPS with fixed scores and denominators. B lines 82–90 retains primitive-share display proof and lines 250 onward retains distinct CSAT and thumbs cohorts. | PASS |
| R2: ranked first-choice meaning | N helper lines 47–71 collects complete valid three-choice permutations over three months, fixed first-choice results 2 of 3, 1 of 2 and 0 of 1, independent percentages, and one optional omission each month excluded from denominators. B lines 92–101 retains original reversed rankings and asserts 6 of 12 first-choice matches at 50%, which fails for 12 of 12 any-position matches. | PASS |
| R3: WS-001 zone and period denominator | N lines 64–66 and helper line 72 assert America/New_York midnight; helper lines 69–71 assert independent per-month figures. Shared day, week, month and quarter period implementation is unchanged. | PASS for selected behavior; remaining day and quarter primitive paths INSPECTED |
| R4: minimum-period rule | Helper lines 74–76 uses minimum two, preserves first two months and suppresses the one-answer final month, with null value and numerator. | PASS |
| R5: revision boundaries | Helper line 73 asserts revision 2 marker, exact prompt and chosen stable label; lines 80–85 check revision and combined revision plus collector filters. | PASS |
| R6: collector cohort | Helper lines 77–85 fixes independent counts for both collectors and revisions. Lines 112–116 additionally prove malformed excluded evidence does not poison valid filtered reports. | PASS |
| R7: unknown or missing stable-choice refusal | Helper lines 120–125 refuses unknown choice, missing choice argument and unsupported score metric. Lines 127–136 publishes a revision without the stable choice, refuses cross-revision ambiguity, and permits the explicitly selected older revision. | PASS |
| R8: malformed retained-ranking refusal | Helper lines 106–119 injects null, empty array, scalar, choice object, duplicate IDs, incomplete order, extra ID, unknown ID and non-text entry. Every included malformed record returns 400 even below the minimum, then the corrected ranking restores expected output. | PASS |
| R9: CSV parity | Helper lines 87–104 opens the public response export and independently counts first exported choice for all three months, matching literal expected pairs and report figures. B lines 102–114 opens the downloaded trend CSV and checks question type, stable choice, numerator and percentage. | PASS |
| R10: browser wording and existing outcomes | B lines 92–121 proves First-priority choices in summaries, First-choice share selection, stated numerator and denominator, CSV and explanatory first-choice wording. The same registration retains its statistics, complete exports, disclosure and erasure assertions afterward. | PASS at 1440 and 390 |
| R11: erasure and capture replay | Helper lines 138–145 deletes one retained response; its first-revision trend changes to 1 of 2, replay returns 400, the trend remains 1 of 2 and the erased response stays absent. | PASS |
| Full clause sentence: recurring occurrences use the same series | DIST-016 recurring occurrences remain unbuilt and are explicitly outside this selected point. | UNMET; clause PARTIAL |
| Full clause sentence: programs use the same series | PROG-003 program series remain unbuilt and are explicitly outside this selected point. | UNMET; clause PARTIAL |
| Full clause sentence: any answer share | Structured-contact shares remain unbuilt. Ranked answers are now supported, but this does not close all answer types. | UNMET; clause PARTIAL |

## Inherited duties and riders

| DONE-RIDERS row | Result | Evidence and boundary |
| --- | --- | --- |
| 1: acceptance outcomes reached | FAIL for full clause; PASS for selected ranked point | N and B cover every selected outcome listed above. Recurring occurrences, program series and structured-contact shares remain missing. No DONE claim. |
| 2: real seeded results and unsafe path | PASS | Literal expected pairs in helper lines 69, 79, 83, 85, 103, 114 and 116; refusal and correction lines 106–119; erased replay lines 138–145. No expected first-choice result is calculated from the fixture input. |
| 3: recorded exact-SHA Verify | PENDING_CI | Push run 42412444939 is the candidate run; neither predecessor green nor local results substitute for its conclusion. The existing Verify globs include N and B. |
| 4: relevant exact bytes | PASS | RECEIPTS.json binds all relevant source and test hashes to candidate 6290af437d870e3aba69055e7e2578ae748967eb. No byte of relevant code or test changed between successful local tests and this commit. |
| 5: inherited duty is named | INSPECTED | RSLT-007 expressly names WS-001 zone, denominator, minimum and revision boundaries. Runtime and browser proofs exercise those duties. No new inherited duty is asserted or contract text added. |
| 6: generated views, counts and status provenance | PASS mechanically; Status remains unchanged | Generator write and check pass; generated files restored from main. Counts unchanged. CONTRACT.md and every Status cell retain main's judgments. Source lock fresh. |
| 7: no unauthorized acceptance change | PASS | No contract diff, rewrite, ID change or new acceptance sentence. |
| 8: authority holes | PASS within scope; broader authority INSPECTED | Trend route remains behind existing app session and workspace gates, has no new mutation or credential. N retains existing saved-report authority checks. This round adds no permission or new public disclosure surface. |
| 9: provider or legal claims | NOT APPLICABLE | No provider, legal, real account or release boundary was changed or claimed. |
| 10: policy default without ruling | NOT APPLICABLE | First-choice ranking matches the shipped First-priority choices semantics; no custody, consent, spending or authority decision was introduced. No DEFAULT or ASK. |
| 11: landed main and publication custody | PENDING_LANDER | Main does not equal candidate. Main base is b6a05948c040da9debdeb9d6ca10c13eacc304ee. Exact-SHA publication scan and Run site are not performed by this cloud run. The maintained lander must establish them. |

Inherited BASE-ACCESS-002 and BASE-ACCESS-004 remain enforced by the unchanged authenticated route and workspace selection. No new authority door was added. BASE-DATA-003 erasure and RESP-013 replay fencing are exercised by helper lines 138–145 and retained browser erasure. RSLT-003 named numerator and denominator is exercised at B lines 99 and 111–114; RSLT-005 stable-revision custody is exercised at helper lines 80–85 and 127–136. No independent duty is promoted to DONE by this report.

## Pre-ready self-check

1. Selected user-visible first-choice behavior, filters, refusals, CSV, minimum and erasure are exercised through authenticated native HTTP, ordinary public collection and the built browser app. Wrong any-position aggregation fails independent native and browser expected figures. The full clause remains partial for named unbuilt outcomes. Exact-SHA CI conclusion is recorded separately below.
2. No existing assertion or registration was removed or weakened. Additions are in the existing native helper only; registration delta is zero. Existing saved-report, export and erasure workload is preserved.
3. Erasure and replay are proved directly. Current session and workspace gates are unchanged. No restored or revoked capability is introduced; existing saved-report authority proof remains in the native registration. No new data exposure.
4. Changed trend screen was inspected at 1440 and 390. Text remains at least 13px, panel and field borders remain whole, and trend controls have visible labels. There are no custom icon-only controls in the touched panel needing a new tooltip. Native date inputs retain their browser controls. No configuration action or Settings placement changed.
5. Source lock and generated-view checks pass. No added email-shaped fixture strings, credential-like values or bare prose slash tokens appear in the product diff. The original email-answer fixture is deliberately retained with the original 13 question types. Global removal of pre-existing synthetic email examples was neither attempted nor claimed. Exact-SHA publication scan is NOT RUN here, with complete, historyScanned and findings unestablished; the lander owns it. Main equality and Run site remain pending landing.

PROBE RSLT-007 1: native collection followed by authenticated monthly first-choice trend queries -> 2 of 3, 1 of 2, 0 of 1; minimum two suppresses the last period; omitted rankings excluded; collector and revision results independently fixed; missing or invalid stable choices and malformed retained evidence refused; corrected evidence accepted; CSV figures agree; erased capture replay refused. Built result page at 1440 and 390 -> 6 first-choice answers of 12 answered responses, 50%, and matching downloaded CSV.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then check and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RSLT-007 then check RSLT-007 exit=0, followed by whole-file restoration from origin/main; ledger=none exit=0 (no migration changed).

No product blocker. The full clause's remaining unbuilt features are gaps, not claimed completed. Product push succeeded on its first attempt. Evidence publication is independent from READY, acceptance and landing.

## CI custody

Exact candidate push Verify 42412444939: in_progress at the latest permitted poll, conclusion unestablished. Event push, head 6290af437d870e3aba69055e7e2578ae748967eb. CI discovery and polling use REST with one watcher and at least 300 seconds between requests for this run. The predecessor run is recorded only as prior context. No CI dispatch or rerun was requested. No Run site on this cloud branch is claimed.

## Terminal claim

CLAIM RSLT-007 PARTIAL points=1 tests=tests/runtime/collectors-trends.worker.test.ts#named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports; tests/e2e/answer-results.spec.ts#answers first across every type, an RSLT-006 crosstab states shares and suppression, comparison replaces results and ledger confirms erasure

GAP RSLT-007: DIST-016 recurring occurrences, PROG-003 program series and structured-contact answer shares remain unbuilt; existing holds and release prerequisites are unchanged.
