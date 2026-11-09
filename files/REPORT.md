# sd-pencil-c-f56 — standalone question video

Repository: just-every/run-pencil
Branch: cloud/sd-pencil-c-f56
Candidate: 66c12b3b8fc144c701562b979fbae2945ffed7af
Base main: d2863a5ae28f0ca6fcfd4cab28f8f4e9b5f91f85
Save: d7526a2, pushed with skip CI.

FIELD-005 is claimed PARTIAL. All selected video work is implemented. No full FIELD-005 acceptance point is claimed because its compound acceptance also requires image choices and empty-alt publication refusal. Contract statuses remain exactly main's: 142 DONE, 61 PARTIAL, 49 MISSING. The claim proposes FIELD-005 from MISSING to PARTIAL; no count is changed in source. FIELD-012, FIELD-014 and queued FIELD-011 work are unchanged. No other campaign row is changed.

## Implementation

Stored video is a revision-owned object with exactly provider and reference. YouTube IDs have eleven URL-safe characters; Vimeo references are positive numeric IDs of at most twelve digits with no leading zero. Native authoring refuses arbitrary hosts, schemes, markup, extra settings and malformed references before writes. The UI accepts only approved HTTPS public watch links, converts them into canonical references and retains video when the question's answer type changes.

Placement is limited to standalone questions. Native add, step save, screen composition and publication check it; welcome screens, completion screens and both anchors and members of combined screens refuse it. Saves retain existing expected-version checks and publication retains immutable snapshots. No migration, Base adoption, production result, reporting or export path is changed.

The shared player initially renders local explanatory text and a named native Play button. It emits no provider iframe, thumbnail, preconnect, DNS hint or resource. Enter, Space or pointer activation creates exactly the selected YouTube privacy-enhanced iframe or Vimeo iframe with DNT enabled. Embed destinations are derived from validated IDs; query strings or arbitrary markup are never retained. Frames have an accessible title, no-referrer policy, restricted sandbox and only playback capabilities. App CSP admits just the two player origins in addition to its existing sources, enabling real iframe document loading in builder and preview.

Video settings sit inside the existing collapsed Video section. Text is at least 14px, the Play target is at least 44px, and the placeholder has a complete border. Existing icon-only builder controls retain the shared tooltip (300ms hover, immediate focus); no icon-only control is added.

## Plan and completed work

The complete original work plan is PLAN.md. Inspection mapped the missing video behavior to the existing branching native registration and authoring browser registration. Focused validation, editor and renderer modules were added, then native and browser proofs were extended without adding registrations. A phone layout regression from initially expanded video controls was caught by the existing three-screen layout assertion and fixed by collapsing the Video settings section. The assertion was retained unchanged. The final pass also proves video survives an answer-type change and invalid URLs do not write the draft.

The first substantive save was pushed immediately. Before the candidate, main was fetched and merged; Git reported already up to date. CONTRACT.md was unchanged. Generator write and check ran for FIELD-005, both generated views were restored from origin/main, and source lock was regenerated last and checked. The final candidate is a new child of the published save, with no rewritten published history.

## Acceptance and inherited-duty map

| Item | Result | Public-door proof |
| --- | --- | --- |
| Steps may carry approved-host video only after explicit Play | MET for standalone question steps | tests/runtime/question-video-proof.ts through journey.worker.test.ts; tests/e2e/question-video-journey.ts through authoring.spec.ts |
| Steps may carry images with required alt text | UNMET, outside selected work | No implementation or proof claimed |
| Choices may be images with labels | UNMET, outside selected work | No implementation or proof claimed |
| Browser builds image-choice question | UNMET, outside selected work | No implementation or proof claimed |
| Publication refuses empty alt text | UNMET, outside selected work | No implementation or proof claimed |
| Respondent makes no third-party request before Play | MET at provider edge | Browser helper records every external HTTP request, checks absent iframe, image, preconnect and DNS hints, then verifies one selected iframe and its actual document |
| Native version-guarded saves and immutable publication | MET | Native helper lines 100 onward and browser helper; stale save conflicts, draft edits preserve published references, explicit later publication replaces them |
| FIELD-012 optional group media | UNMET, unchanged | Combined media is explicitly refused, not silently dropped |
| FIELD-014 dependency completion | UNMET, unchanged | No dependency completion claim |
| FIELD-011 optional statement media | UNMET, unchanged | No statement implementation or completion claim |

Native registration: tests/runtime/journey.worker.test.ts — builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers. It calls proveQuestionVideo before retaining all original workloads and assertions.

Browser registration: tests/e2e/authoring.spec.ts — labels, one Save, real controls, reorder, branching, Share and a current dashboard. It calls questionVideoJourney after retaining all original workloads and assertions. New behavior assertions run at 1440; the same interactions and changed-screen captures run at 390. Provider fakes replace only the external player document, leaving native authoring, preview, publication, collection and ledger real.

## Probes

PROBE FIELD-005 references: authenticated draft add and PUT with 14 malformed canonical video values, including unapproved host, HTTP, script scheme and invalid ID -> 400 VALIDATION_ERROR, identical draft version and all snapshotted flow data.
PROBE FIELD-005 placement: welcome and completion media, combined-screen anchor and member media, and composing a screen around existing video -> 400 and no flow write; both page and group checked.
PROBE FIELD-005 publication: valid YouTube and Vimeo references -> saved, reloaded and published; anonymous replacement refused; stale version conflicted; later draft replacement leaves public reference and stored published row unchanged.
PROBE FIELD-005 privacy: built builder, draft preview and public page -> installation-only requests and no provider resource before Play; Enter and Space -> only selected privacy-enhanced provider frame with readable provider-edge document.
PROBE FIELD-005 completion: native public form with video -> released response, exact original-revision answers retained; explicit Vimeo republish -> current public Vimeo with a fresh revision and still no request until Play.

## DONE riders

| Row | Result | Evidence or boundary |
| --- | --- | --- |
| 1 | PARTIAL | Video outcomes have native and browser proof; image outcomes remain unmet. No DONE claim. |
| 2 | PASS locally | Genuine populated native forms, valid completion and invalid authenticated no-write refusals; independent expected references and answers. |
| 3 | PENDING CI | Both helpers are invoked through existing Verify registrations; exact-SHA workflow state is in CI.json. |
| 4 | PASS locally | Final native and browser checks run against the final candidate code; receipts bind the full SHA. |
| 5 | INSPECTED | FIELD-005 already names explicit activation and approved-host privacy-enhanced video. No inherited duty is claimed fulfilled for groups, statements or accessibility checker completion. |
| 6 | MECHANICAL PASS | Generator write and check succeed; generated views restored; no Status, Gap or Evidence cell edited. Main's missing status remains unchanged for lander custody. |
| 7 | PASS | No acceptance text, ID, ruling, coverage rewrite or Status row changed. |
| 8 | PASS for selected custody | Anonymous draft write refused without writes; ordinary authenticated version guards retained. No new permission model or mutation door. |
| 9 | HONEST BOUNDARY | Provider-edge document fixture proves request timing and selected URL, not real provider playback, tracking guarantees or provider qualification. |
| 10 | INSPECTED | Uses the clause's existing YouTube and Vimeo click-to-play policy. No new custody, consent, spending or authority default adopted. |
| 11 | PENDING LANDER | Main equality, complete full-history publication scan and main Run site belong to the maintained Mac lander. None claimed from cloud. |

## Pre-READY self-check

1. The selected user-visible video behaviors are exercised through real native and browser doors. Full clause completion is not asserted. Exact-SHA CI state is reported honestly.
2. No existing assertion was removed, narrowed or moved under a width or branch condition. The only old registration change is adding the helper call and FIELD-005 metadata. The test registration count is unchanged (test-budget.json unchanged).
3. Native authority, response storage, erasure and replay code is unchanged. The existing journey's original closure, replay, erasure, quarantine and export assertions still run. New media data lives only in revision question settings, with no independent capture or disclosure door.
4. Changed screens captured at 1440 and 390; existing layout assertion retained. Video controls use named text and existing tooltip behavior; no new icon-only control, one-sided border or small text.
5. Fresh source lock and local checks are in receipts. No new email-shaped fixture value. Publication scan, landing and Run site are unestablished in cloud and remain required fleet gates.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then pnpm source:check exit=0; views=node scripts/contract-docs.mjs write FIELD-005 then check FIELD-005 exit=0; ledger=none exit=0.

CLAIM FIELD-005 PARTIAL points=none tests=tests/runtime/journey.worker.test.ts#builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers; tests/e2e/authoring.spec.ts#labels, one Save, real controls, reorder, branching, Share and a current dashboard
GAP FIELD-005: Images, labeled image choices and empty-alt publication refusal, welcome and completion media, grouped media, media imports and the remainder of acceptance are omitted. FIELD-012, FIELD-014, FIELD-011, accessibility checker, activation and release prerequisites remain unchanged.

No external blocker is claimed for the completed selected video work. No provider qualification, full checker, DONE, activation or release is claimed. Evidence publication is report transport only, not product readiness or landing.


## Final validation and custody

Candidate 66c12b3b8fc144c701562b979fbae2945ffed7af passed the native journey file (12 tests), the entire original authoring registration plus its video helper at both widths (2 passes), typecheck, first-party checks, manifest and boundaries, production build, generator write and check and source-lock check. Desktop took 58.9 seconds and mobile 57.1 seconds. All changed question states are captured at 1440 and 390, including both selected providers. Screens were inspected; local records and image hashes are in RECEIPT.json.

The initial mobile layout failure was checkAuthoringLayout at tests/e2e/authoring-helpers.ts:46, invoked from authoring.spec.ts:74: expected document height ratio <=3, received 3.0971563981042656. Collapsing the optional Video settings fixed this without changing that assertion. Two subsequent complete browser passes succeeded; the final one is bound to the candidate above.

Product remote readback equals 66c12b3b8fc144c701562b979fbae2945ffed7af on cloud/sd-pencil-c-f56. Main was fetched again immediately before candidate push and there were zero missing main commits; merge reported already up to date. Both candidate commits have fleet author and committer, no trailers, and no changed Contract Status row. Zero newly introduced email-shaped fixture values. No test registration added or removed; the one registration metadata replacement has one added line and one deleted line.

Exact-SHA Verify candidate run 42557045263 (push) is in_progress with null conclusion as observed at 2026-11-09T03:34:03Z. URL: https://github.com/just-every/run-pencil/actions/runs/42557045263 . One GitHub API call used for discovery, no dispatch or rerun, no PR required. No exact-SHA green claim is made. The cloud-only READY handoff names the pushed head so the maintained lander can enforce Verify, complete full-history publication scanning and main Run site before landing. No cloud main write was attempted.

Publication scan receipt: commit=66c12b3b8fc144c701562b979fbae2945ffed7af complete=unestablished historyScanned=unestablished findings=unestablished (cloud cannot run the fleet publication scan). Main equality=false; branch-only custody; Run site not established. This remains a PARTIAL proposal, never DONE.
