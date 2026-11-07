# sd-pencil-c-f21 results

Repository: just-every/run-pencil
Branch: cloud/sd-pencil-c-f21
Candidate: 8fe52b625820a953c327c67cae53ac84ac7bb452
Base main: b6a05948c040da9debdeb9d6ca10c13eacc304ee

The selected ranked first-choice answer-share slice is implemented. RSLT-007 remains PARTIAL. Counts before and after are 142 DONE, 61 PARTIAL and 49 MISSING, 252 total. Contract judgments, status cells and acceptance text are unchanged. No new test registration, skipped assertion, narrowed assertion, dependency pin change, workflow edit, migration or homepage edit was made. The existing test budget metadata is unchanged; this round adds zero registrations and removes zero registrations.

The plan row changed conceptually is the RSLT-007 ranked-share gap: complete rankings now support first-choice answer shares, matching First-priority choices in answer summaries. Recurring occurrences under DIST-016, dashboards under PROG-003 and structured-contact shares remain owed. Retained ct summary wording, original-controller older-archive qualification, DONE restoration, release qualification and existing holds remain unchanged. No further target touching the scoped files was authorized in the supplied extract.

Implementation uses the existing bounded SQL aggregate. A ranking is valid only when it is an array containing every immutable revision choice exactly once, with text stable IDs and no unknown, duplicate, omitted or extra entries. Only the element at position zero matches the selected choice. Every selected question revision must contain that stable choice. Ranked questions offer answer-share metrics only. The existing answered denominator, minimum rule, release scope, collector scope, revision selection, generation fence and revision markers continue to apply. The existing Trends panel labels the metric First-choice share and the numerator first-choice answers. CSV uses the same returned series.

## Frozen proof map

All new native checks are loaded by the existing registration in `tests/runtime/collectors-trends.worker.test.ts`, named "named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports". The helper is not a new registration.

All new browser checks are loaded by the existing registration in `tests/e2e/answer-results.spec.ts`, named "answers first across every type, an RSLT-006 crosstab states shares and suppression, comparison replaces results and ledger confirms erasure". Its thirteen-question scenario, reversed rankings and every original assertion are retained.

| Item | Outcome and proof | Local result |
| --- | --- | --- |
| POINT 1a | Complete ranking collection across July, August and September, independently fixed first-choice counts 2 of 3, 1 of 2 and 0 of 1; one optional omission per month does not join the answered denominator. `tests/runtime/ranked-trend-proof.ts` lines 32 to 71. | PASS |
| POINT 1b | Minimum two preserves July and August, suppresses September numerator and value while retaining denominator one. Helper lines 74 to 76. | PASS |
| POINT 1c | Collector and revision filters separately and together alter counts and denominators, and August retains the updated prompt, stable choice label and revision marker in the workspace zone. Helper lines 72 to 85. | PASS |
| POINT 1d | Ordinary response CSV is downloaded and opened; first exported stable answer value yields independent monthly counts, equal to the trend. Helper lines 87 to 104. | PASS |
| POINT 1e | A scalar, duplicate ranking, incomplete ranking, extra choice, unknown choice and non-text choice each refuse the report even below the reporting minimum; repairing evidence restores the trend. Helper lines 106 to 114. | PASS |
| POINT 1f | Unknown stable selection, missing share value, unsupported score metric and a stable option absent from a later published revision are refused. Selecting a compatible earlier revision succeeds. Helper lines 115 to 131. | PASS |
| POINT 1g | Original native capture is replayed after erasure and refused; July becomes 1 of 2 at 50 percent and remains so; response row stays absent. Helper lines 133 to 138. | PASS |
| POINT 1h | Original thirteen-question browser fixture retains twelve complete reversed rankings; summary and trend both show six of twelve at 50 percent, with explicit first-choice wording; trend CSV numerator, denominator, stable selected ID and value agree. `tests/e2e/answer-results.spec.ts` lines 92 to 121. | PASS at 1440 and 390 |
| Acceptance sentence: weekly and monthly NPS across three months, denominators and revision boundary; below-minimum gap | Original native journey lines 64 to 70 retained and passing. | PASS |
| Acceptance sentence: collector cohorts, primitive shares and CSV | Original native collector journey and all original exports retained and passing. | PASS |
| Full-clause obligation: any answer share, recurring occurrences and program series | Ranking first-choice slice now closes; structured-contact answers, DIST-016 and PROG-003 remain unbuilt. | PARTIAL |

## DONE-RIDERS

No DONE claim is made. These rows are reported to avoid conflating local proof with full-clause acceptance or landing.

| Row | Result | Evidence or honest boundary |
| --- | --- | --- |
| 1 | PARTIAL | Selected ranking outcomes are reached through native endpoints and the built results page; full-clause program, recurring and structured-contact outcomes remain absent. |
| 2 | PASS | Nonempty native data, fixed counts, independent CSV counts, refusal attempts and erasure with capture replay; helper lines 47 to 138. |
| 3 | PENDING | Existing push Verify includes these registered native and browser journeys. Exact candidate workflow result will be recorded below; local proof alone is not CI green. |
| 4 | PASS on local proof | Native journey rerun on candidate; browser rerun on candidate after the final wording change. Receipts identify the actual head and commands. |
| 5 | INSPECTED | No new inherited obligation or receiving clause was authored; the existing reporting route and Base guards remain in use. |
| 6 | PASS mechanical | Generator write and check pass for RSLT-007; generated views restored from main. Status, Gap and Evidence cells untouched. |
| 7 | PASS | No acceptance point or contract wording changed; no ruling required for implementing the already shipped first-choice meaning. |
| 8 | INSPECTED | No new route or authority verb. Existing operator route guards preserved; native and browser journeys retain authority and disclosure checks. |
| 9 | PASS boundary | No provider, legal, release, archive restoration or live-account claim made. |
| 10 | PASS | Established First-priority choices semantics used, with no new policy default. |
| 11 | PENDING lander | Candidate is branch-only. Main equality, full-history publication scan and Run site are not claimed. |

## Pre-ready self-check

1. Selected public behavior has real-data route and browser assertions; first-position matching fails if changed to any-position matching because every submitted ranking contains every option. Exact-SHA Verify is separately recorded below. Remaining full-clause outcomes are explicitly not claimed.
2. Existing assertions are preserved with no skip, width gate or weakened workload. No new registration was added.
3. Existing release, operator, disclosure and erasure paths are retained. Ranking-specific erasure and original-capture replay refusal pass. No credential, authority, archive or data-ingestion behavior changed.
4. Changed Trends panel uses existing controls and styles; chart text is 13 pixels, other text uses existing larger sizing. There is no new icon-only control, one-sided rounded border or settings screen. The screen audit found labeled action buttons. Changed screens are captured at 1440 and 390, including the horizontally scrollable value table on mobile.
5. Source lock fresh, contract generator proved and views restored; exact-SHA publication scan, branch Verify and post-landing Run site remain separately stated. Zero email-shaped strings were introduced in added product lines. The existing thirteen-question fixture retains its email question as required by the assignment.

## Runtime probes

PROBE RSLT-007 1: native trend route with complete rankings in three fixture months -> first-choice counts 2 of 3, 1 of 2 and 0 of 1; minimum two withholds September; optional omissions excluded; collector and revision selection change both numerator and denominator.
PROBE RSLT-007 1: native trend route with malformed retained rankings, unknown selection, missing selection or a choice absent from a selected revision -> 400 validation refusal; compatible earlier revision succeeds.
PROBE RSLT-007 1: erase the known first-choice capture, then replay its original public submission -> 400 and July stays 1 of 2 at 50 percent.
PROBE RSLT-007 1: built results page using original reversed rankings -> six first-choice matches among twelve answers, 50 percent, with matching trend CSV.

GAP RSLT-007: DIST-016 recurring occurrences, PROG-003 program dashboards and structured-contact answer shares remain unbuilt; retained ct wording, older-archive qualification, DONE restoration and release qualification remain outside this slice.

## Mechanical and terminal results

Final local native journey: one registration passed, 38.90 seconds, exit 0. Final browser journey: two viewport cases passed, 4.7 minutes, exit 0, on the committed candidate. Browser proof uses Chromium at /usr/bin/chromium with --no-sandbox and the existing temporary browser contexts; the cloud-only launch config is not part of product source. Original browser proof also passed at both widths before the metric label was shortened. Local workerd emitted broken-pipe and recovered dropped-connection messages; both final cases completed successfully without retries. Typecheck, first-party check, source integrity and contract generation all exit 0. Product push and exact-SHA CI discovery are recorded below. Full plan is preserved in PLAN.md. Complete actual command receipts will be in RECEIPTS.json. Landing, publication scan and main-only Run site remain with the maintained Mac lander.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check plus pnpm source:check exit=0; views=node scripts/contract-docs.mjs write RSLT-007 and check RSLT-007 exit=0; ledger=none exit=0

Product custody: cloud/sd-pencil-c-f21 successfully pushed at 8fe52b625820a953c327c67cae53ac84ac7bb452; both product commits have fleet authors and committers and no trailers. Push guard succeeded on its first attempt. Final fetch and merge reported Already up to date against b6a05948c040da9debdeb9d6ca10c13eacc304ee. No PR is required: the existing workflow starts on named cloud branches.

Exact candidate Verify: run 42410632224, event push, head 8fe52b625820a953c327c67cae53ac84ac7bb452, observed in_progress at 2026-11-07 20:21:09 UTC. URL: https://github.com/just-every/run-pencil/actions/runs/42410632224. No dispatch or rerun was performed. Two GitHub REST calls used: base-main discovery and exact-candidate discovery. This does not establish a green candidate.

Base main b6a05948c040da9debdeb9d6ca10c13eacc304ee has successful Verify run 42374854513 and successful Run site 42270609301. Those results are explicitly not candidate proof. Main does not equal the candidate. Candidate Run site is pending the Mac landing path.

Publication scan receipt: commit=8fe52b625820a953c327c67cae53ac84ac7bb452 status=NOT_RUN_IN_CLOUD complete=unknown historyScanned=unknown findings=unknown. The branch clone has full history. The maintained Mac lander must scan this exact candidate and independently require complete clean publication and exact-SHA CI before landing. No scan finding count is invented.

Production build also passes through cloud_run with the pinned checkout launcher, exit 0. Product origin advertises the exact candidate head. Final changed-screen captures are the six selected files under screens-final; the complete pre-existing journey also passed at both widths.

Terminal claim (points=1 denotes the planner-selected ranking slice, not completion of the full legacy clause):

CLAIM RSLT-007 PARTIAL points=1 tests=tests/runtime/collectors-trends.worker.test.ts#named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports; tests/e2e/answer-results.spec.ts#answers first across every type, an RSLT-006 crosstab states shares and suppression, comparison replaces results and ledger confirms erasure

No blocking local failure or missing account was encountered. Final status is PUSHED while run 42410632224 is in progress at its recorded observation; READY and CI success are not claimed. The cloud-only instructions bound CI waiting and prohibit rapid polling, so no second observation was made inside 300 seconds. No failed job, repair round, rerun or workflow dispatch exists for this candidate.

Rider 3 and rider 11 remain pending the independent CI and landing gates. Clause status stays PARTIAL and all summary counts remain unchanged. The full report, receipt, plan, selected stdout and six final screen captures are the declared public evidence packet. There is no PR because cloud branch pushes are the repository's existing pre-main Verify entry point.

PUSHED branch=cloud/sd-pencil-c-f21 head=8fe52b625820a953c327c67cae53ac84ac7bb452
