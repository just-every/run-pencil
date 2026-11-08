# sd-pencil-c-f44 report

Product repository: https://github.com/just-every/run-pencil
Branch: cloud/sd-pencil-c-f44
Full candidate SHA: 45f78e1a7c94ac6d7b1e93b937253f2cb5199322
Main at refresh: c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3
PR: none; the existing push workflow accepts this cloud branch.

The selected two-operator stale step-save outcome is closed. ROLE-004 is claimed PARTIAL, with no DONE, permission-system, activation or release qualification. Its existing source Status remains MISSING because builders do not own Status, Gap or Evidence cells. The lander receives the proposed MISSING to PARTIAL scope from the claim; if that proposal is accepted, counts would become 142 DONE, 62 PARTIAL and 48 MISSING. No such count change is claimed as landed. Before and after source counts are 142 DONE, 61 PARTIAL, 49 MISSING, 252 total. No plan source was shipped or edited; the ROLE-004 extract row receives this scoped completion report only. All existing holds remain.

## Work completed

The existing registration in `tests/e2e/review-corrections.spec.ts` now invokes `proveBuilderConcurrency` in `tests/e2e/builder-concurrency-proof.ts`. It creates a separate native draft and invites two new operators through POST `/api/app/operators`. Each gets a fresh browser context, starts without a session, signs in through `/signin`, captured native mail and the ordinary confirmation page, then proves its authenticated native identity and Pencil operator mapping. Both operators read the same workspace and the same private draft.

Both builder pages load byte-equal draft structures with the same version. They stage different prompt edits. The first saves through the builder's Save button and receives `updated` with one version increment. The second submits its original version and losing prompt through its own Save button, receives `conflict` with the winner's latest version, sees the explicit conflict notice and winning content in both the field and question canvas, then reloads. Full authenticated draft reads after refusal and reload match the first saved snapshot exactly, including the version. Every context closes in finally.

No production file changed. The source references requested by the brief remain unchanged: `src/core/features/flows/ui/FlowBuilderPage.tsx`, `src/core/features/flows/routes.ts`, `src/core/features/flows/service.ts`, `src/core/features/flows/repository.ts` and `tests/runtime/journey.worker.test.ts`. The existing native stale-write case at journey.worker.test.ts lines 161 to 176 was inspected; no native registration was added or rerun because it was unchanged. The entire existing browser registration, including keyboard, accessibility, invalid-edit no-write, publication and rating workloads, is retained without narrowing. Its 120-second timeout remains unchanged. Zero registrations added or removed. The recorded test budget was already above its nominal cap and was left untouched.

## Acceptance and inherited-duty rubric

The clause uses prose acceptance, so report point 1 denotes comment and resolution collaboration; point 2 denotes stale-save refusal with latest content. Only point 2 is selected by this brief.

| Item | Outcome and public door | Evidence | Result |
| --- | --- | --- | --- |
| A1 | Two operators comment and resolve on one draft step | No implementation or passing journey | UNMET; held remainder, no claim |
| A2 | Stale step save refused and latest version shown | helper lines 68 to 124, loaded by review-corrections.spec.ts line 229 | Local browser PASS at 1440 and 390; exact-head Verify pending |
| D1 | FLOW-004 safe version-guarded edits, with allowed and unsafe paths | helper lines 84 to 102 checks both request versions, winning save and stale conflict | PASS through real builder transport |
| D2 | Unsafe edit changes nothing and survives reload | helper lines 95 to 124, authenticated GET of the draft compared in full with the winning snapshot | PASS through authenticated reads |
| D3 | Two distinct current operators, ordinary authentication, same workspace | helper lines 23 to 61 and shared private draft reads at 76 to 78 | PASS; existing equal-operator policy retained |
| D4 | Existing browser registration and assertions retained | review-corrections.spec.ts diff adds import, clause tag, browser fixture and final helper invocation | INSPECTED PASS |

## DONE-RIDERS review

No DONE claim is made. These rows identify what this limited proof does and what remains with the independent lander.

| Rider | Assessment | Evidence or boundary |
| --- | --- | --- |
| 1 | FAIL for full-clause DONE; selected outcome PASS locally | A1 remains unbuilt; A2 runs through the builder at both widths |
| 2 | PASS for selected data-loss outcome | Allowed save succeeds, stale save is refused, full draft is unchanged; helper 84 to 124 |
| 3 | PENDING | Exact-head push Verify 42511893642 invokes the existing browser registration; no env gate or nightly-only path was added |
| 4 | PASS locally on candidate | BROWSER-RECEIPT.json binds the committed head and actual test source hashes; earlier preparatory run is not substituted for it |
| 5 | PASS for selected duty | ROLE-004 already names FLOW-004 version checking in CONTRACT.md line 227; no inherited duty or contract acceptance was changed |
| 6 | Mechanical PASS; source judgment intentionally unchanged | ROLE-004 generator write and check passed; generated views restored from main; no Status, Gap, Evidence or summary edit committed |
| 7 | PASS | No acceptance point, ID map, ruling, or coverage map changed |
| 8 | PASS within selected scope | Two real current operators use the normal authority doors; unauthenticated starting contexts return 401. ROLE-001 and ROLE-002 grants remain unclaimed |
| 9 | PASS boundary | Test mail fixture only, no real provider or legal qualification claimed |
| 10 | PASS | No new custody, authority or consent default adopted |
| 11 | PENDING guarded lander | Candidate differs from main; full-history publication scan, green exact-head Verify, guarded landing and Run site remain with the Mac lander |

## Local checks and browser proof

Setup used the pinned checkout tooling via cloud_run. Typecheck and the first-party check exited 0. ROLE-004 contract write and check exited 0; generated views were restored and none were committed. Edition lock generation, integrity check and `pnpm source:check` exited 0. No migration changed, so migration-ledger validation is not applicable.

The preparatory corrected browser run passed both complete registrations: desktop 32.5 seconds and mobile 43.5 seconds. An initial local proof attempt failed only because it incorrectly equated Base native IDs with Pencil product IDs; the helper now checks those separately and requires distinct values in both systems. No production repair or CI repair round occurred. The final committed-head run passed both complete registrations: desktop 28.3 seconds and mobile 43.7 seconds, total 1.9 minutes, exit 0. Its actual results are in BROWSER-RECEIPT.json and browser.log. Conflict and reloaded screenshots are retained in screens at 1440 and 390. Earlier review screens from the same unchanged existing workload are also retained.

Pre-ready self-check: the selected accepted save, stale conflict, visible winner and no-write reload outcomes have real assertions. No prior assertion, workload, registration or threshold was removed, skipped, narrowed or moved behind a width condition. Production authority, erasure and replay code is unchanged and no new behavior is claimed there. The builder's existing move controls use its shared Tooltip; configuration remains under the existing settings. Text and layout were inspected on the conflict and reloaded screenshots. A pre-existing compact configuration disclosure uses 12px text; that cosmetic observation is outside this proof and no UI source was changed. No email-shaped literal or provider key shape was added in the changed test files. No full local suite was run.

## CI, custody and publication

Product push succeeded through the fleet guard on the first attempt. Every candidate author and committer is the fleet identity, with no trailers. A fetch followed by a no-op rebase found the branch up to date with main before the push. Only the named cloud branch was pushed; main was not changed. The source lock covers exactly the focused helper and amended browser registration.

Exact candidate push Verify: 42511893642, https://github.com/just-every/run-pencil/actions/runs/42511893642, in_progress at discovery. No green claim is made. No workflow was dispatched or rerun. GitHub API budget so far: four calls, including main discovery, failed-job listing, one failed-job archive read and candidate discovery. No short polling loop was used.

Main c7d5a9847d6dcd8787ba5a346efa45bda5ddeae3 had successful exact-head Verify runs 42505950432 and 42504705747 and Run site 42505950175. Later exact-head Verify 42508030645 failed shard job 128815207759: the existing notification preference and failed delivery controls journey timed out on mobile in both attempts; aggregate job 128818353326 then failed. The once-read archive is retained as main-failure.log. This was not reproduced or changed by this scoped round, and it is reported to fv for diagnosis. It is not reported as a proven infrastructure flake.

Publication scan: commit=45f78e1a7c94ac6d7b1e93b937253f2cb5199322, complete=NOT RUN IN CLOUD, historyScanned=NOT ESTABLISHED, findings=NOT ESTABLISHED. The full-history clone was used; the maintained Mac lander owns the COMPLETE zero-finding scan, exact-head CI decision, landing and Run site. Main equality is false for this candidate, as required before landing. Evidence publication is report custody only, never product acceptance or landing.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and node scripts/edition-authoring/cli.mjs check and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write ROLE-004 and node scripts/contract-docs.mjs check ROLE-004 exit=0; ledger=none exit=0
PROBE ROLE-004 2: Two invited mail-authenticated operators open one draft, save different prompts through the builder at the same version -> first updated, second conflict, latest prompt visible, reload and both authenticated draft reads equal the winner with no losing write.
CLAIM ROLE-004 PARTIAL points=2 tests=tests/e2e/review-corrections.spec.ts#plain corrections, compact editing and publication remain visible and accessible
GAP ROLE-004: Draft-step comments, operator mentions with in-app notifications, thread resolution and per-step last-saver attribution remain unbuilt. ROLE-001 and ROLE-002 permissions, activation and release qualification remain unclaimed.
