# sd-pencil-c-f28 results

Product repository: just-every/run-pencil
Branch: cloud/sd-pencil-c-f28
Candidate: ce28546376e4103537a12d660d3ecfc4c6c88e4c
Integrated main: 9877fe36b4c31f61cc6a4a13b1096634c822198f
PR: none; the existing push workflow is the branch entry point.

DIST-013 remains PARTIAL to PARTIAL. Counts before and after: 142 DONE, 61 PARTIAL, 49 MISSING, total 252. The scoped WordPress acceptance is implemented. The extract's DIST-013 row gains plugin and real container proof; its held remainder and all other plan rows remain unchanged. No lane file, acceptance sentence, Status, Gap or Evidence cell was edited. Full plan: PLAN.md in this packet.

Implementation: `integrations/wordpress/pencil.php` registers the actual WordPress shortcode. An administrator configures one trusted installation origin in `wp-config.php`; post authors supply only a validated form slug. HTTPS is required outside loopback. Credentials, paths, queries, fragments, unknown shortcode attributes and invalid slugs fail closed. The script is asynchronous and explicitly sends only the referrer origin. The plugin reuses Pencil's existing frame transport and stores no responses in WordPress. Installation steps and the current inline-only boundary are in `integrations/wordpress/README.md`.

The fixture uses the real WordPress 6.8.3 PHP distribution, MariaDB 11.4 and WP CLI. It activates the actual mounted plugin and theme, installs WordPress against its real database, and publishes pages with `wp post create`. No renderer, shortcode parser, native response route, database or transport is mocked. Ports are random and loopback-only; each journey has its own database, network and volume. The helper tears its project down with volumes in success and failure paths. No workflow edit was necessary: the existing script embed registration runs in both push Verify browser projects and starts its own fixture.

## Exact candidate proof

The unchanged registration is `tests/e2e/script-embed.spec.ts` — “copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages”. It calls `tests/e2e/wordpress-embed.ts` at line 197. It runs all existing checks at both 1440 and 390; no assertion or registration was removed, narrowed, skipped or moved behind a new condition. Test timeout increases from two to five minutes to accommodate cold Docker pulls. There are zero new registrations; the recorded baseline remains 277 registrations and 380 project-expanded cases, already above the 200 cap before this round.

Acceptance sentence mapping:

| Item | Public door and proof | Result |
| --- | --- | --- |
| A1: each existing mode opens by its trigger, completes and sends permitted events | Existing registration, lines 144–195: all five non-inline modes, each trigger, native completion, event projections, campaign storage and opening cap; inline and hostile messages at lines 38–143 | Local exact-SHA browser result in browser-receipt.json; CI below |
| A2: popup and side-tab campaign storage | Existing registration, lines 153–185: landing query `utm_campaign=spring`, independently counted native archive rows | Local exact-SHA browser result in browser-receipt.json; CI below |
| A3: actual WordPress shortcode in a container | `tests/helpers/wordpress.ts` lines 20–40 installs and publishes; `tests/e2e/wordpress-embed.ts` lines 27–118 renders and completes real collection | Local exact-SHA browser result in browser-receipt.json; CI below |

Frozen scoped WordPress rubric:

| Item | Proof in `tests/e2e/wordpress-embed.ts` unless otherwise stated | Result |
| --- | --- | --- |
| W1: install the actual plugin and publish the shortcode page | Lifecycle helper lines 34–39; browser helper lines 28–37 | MET locally |
| W2: complete the allowed-host form | Lines 26–58, native radio, answer, submission and completion heading | MET locally |
| W3: exactly one stored response with the private canary | Lines 77–83: independent before and after archive rows and exact retained answer | MET locally |
| W4: opaque frame isolation | Lines 35–40: sandbox excludes same-origin, host contentDocument is null and DOM access throws | MET locally |
| W5: loaded, height and completed only | Lines 38, 43–68: actual resize equality, changed completion height, event allowlist and exact detail shapes | MET locally |
| W6: no private canary or response identifier reaches host | Lines 70–85 and 93–94: host DOM, source HTML, event detail, raw messages and request URLs | MET locally |
| W7: invalid shortcodes refuse without writes or script requests | Lines 29 and 96–102: missing slug, invalid slug, arbitrary origin attribute; three visible refusals, no frame, no script, no request, unchanged records | MET locally |
| W8: removing the allowed host refuses both script and frame | Lines 104–117: actual WordPress reload requests the script, native source is 403 without executable code, direct frame is 403, no frame or events and unchanged response IDs | MET locally |
| W9: replay cannot create a second response | Lines 86–92: replay the genuine native captured body with opaque Origin, receive the same ID, unchanged archive and one completed event | MET locally |
| W10: preserve all existing mode, campaign and hostile-message checks | Diff of `tests/e2e/script-embed.spec.ts`: only helper import, timeout and helper call added | INSPECTED and run locally |
| W11: both requested widths and complete fixture teardown | Browser receipt and desktop and mobile screenshots in this packet; teardown receipt lists no remaining task containers or volumes | Receipt in packet |

Inherited duty mapping:

| Duty | Proof and limit |
| --- | --- |
| DIST-002: async shared embed, resize, opaque sandbox, strict messages and plain-frame alternative | Existing registration lines 23–143 retained, plus WordPress W4–W6. Checkout assertions are preserved at lines 73–143; no new host event is added. |
| DIST-009: host refusal and no private answer or identifier disclosure | Existing hostile-message matrix retained and WordPress W4, W6 and W8 execute allowed and refused paths. The existing disallowed-host checkout fallback conflict is unchanged and not claimed solved. |
| BASE-PUBLIC-001: no third-party visitor transport or new tracking | Both host and installation origins are the complete observed request-origin set at line 75. Plugin source has no cookie, tracking or server request code. Other existing privacy qualifications remain unchanged. |
| BASE-PUBLIC-002: exact allowed origins under Settings | Native workspace Settings mutation admits WordPress at line 26 and removes it at line 104; refusal is exercised through its real page and native endpoints. |

## DONE-RIDERS

| Row | Result on this candidate | Proof or honest boundary |
| --- | --- | --- |
| 1 | PARTIAL for the full clause; scoped WordPress MET locally | A1–A3 and W1–W11 above; Webflow and Squarespace installation and DIST-021 options remain unbuilt. Exact-SHA CI status below. |
| 2 | PASS locally for changed security and data behavior | Allowed collection stores the independent canary; invalid input and revoked host refuse and preserve response IDs; repeat capture retains one record. |
| 3 | CI status below | Same existing push Verify registration includes the helper unconditionally at both projects; no environment flag, nightly-only path or external-only proof. |
| 4 | PASS locally | Browser and mechanical receipts bind the final full SHA; screenshots are from that run. |
| 5 | INSPECTED, unchanged | DIST-013 explicitly names isolation under DIST-009; DIST-009 names BASE-PUBLIC-002. No inheritance text was added or weakened. |
| 6 | Mechanical PASS; judgment remains with lander | Contract generator write and check exit 0; generated views restored to main. Status and legacy Gap text intentionally remain the lander's sole write scope. |
| 7 | PASS | No acceptance point, ruling, coverage map or contract text changed. |
| 8 | PASS locally for touched authority boundary | Only administrator configuration chooses a script origin; shortcode URL override is refused. Settings host revocation is tested. No correction, refund or operator permission path changed. |
| 9 | PASS within stated boundary | A real local WordPress and database container are proved, with no legal, provider, scale, hosted-release or production-account claim. |
| 10 | Not applicable | No new custody, consent, spending or delegation policy default; the plugin respects configured installation and allowed-host authority. |
| 11 | Pending guarded landing | Main equality, complete publication scan and candidate Run site are not asserted. The maintained Mac lander owns them. |

## Pre-ready self-check

1. Changed user behavior is exercised through a published WordPress page and native Pencil routes. Independent stored values, counts and refusals detect missing or incorrect behavior. CI status is recorded below, never borrowed from another SHA.
2. No existing assertion was removed, narrowed, skipped or moved behind a new width or branch condition. No test registration added.
3. The touched authority and replay boundary is tested in both directions. No erasure, export, payment or account credential code changed. Existing erasure and credential duties and holds stay unchanged; this round does not independently requalify every such path.
4. Desktop and phone public and completion screens were inspected. New WordPress fixture text uses 16px. The plugin adds no icon-only control, configuration screen or one-sided border; current native form components are reused. The privacy lock and button arrow are decorative beside text, not new controls.
5. Source lock is fresh, generated source views generate and check successfully, and first-party and type checks pass. Publication scan, main equality and Run site are delegated and not misreported as done. Newly added product text contains no literal email-shaped address; the WordPress synthetic install address is assembled only at runtime. All product commits use fleet identity without trailers.

PROBE DIST-013 1: real host pages open inline, full-page, popup, popover, slider and side-tab forms by their triggers -> native completions, permitted events and opening caps observed.
PROBE DIST-013 2: popup and side-tab landing pages with utm_campaign=spring -> corresponding native archive rows retain spring, with independent cumulative counts.
PROBE DIST-013 3: real published WordPress shortcode page -> one stored private-canary response, opaque frame, loaded and height and completed-only events; malformed shortcodes and removed host refuse without new responses; replay returns the same ID.

## Checks and custody

Actual mechanical commands, exit codes, duration and output digests are in checks.json. The browser receipt includes the exact command, two widths, result and output digest; screenshots show the actual WordPress page, completion and host refusal. Viewport widths are CSS pixels; mobile PNG dimensions also reflect the browser project device scale. No trace archive, runtime credential, environment dump or private held-out material is selected for evidence publication.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and pnpm source:check exit=0; views=node scripts/contract-docs.mjs write DIST-013 and node scripts/contract-docs.mjs check DIST-013 exit=0; ledger=none exit=0

Main baseline: 9877fe36b4c31f61cc6a4a13b1096634c822198f, Verify push 42434423607 success and Run site push 42434423551 success (main-ci.json). These establish initial main health only. The candidate does not equal main before landing.

Candidate CI:
{"conclusion":null,"head_sha":"ce28546376e4103537a12d660d3ecfc4c6c88e4c","html_url":"https://github.com/just-every/run-pencil/actions/runs/42437034335","status":"in_progress"}


Publication scan: commit=ce28546376e4103537a12d660d3ecfc4c6c88e4c; status=NOT_RUN_CLOUD; complete=unestablished; historyScanned=unestablished; findings=unestablished. The cloud adaptation delegates exact-tree full-history scanning to the maintained Mac lander; no clean scan or candidate main Run site result is claimed here.

Initial local fixture corrections: the CLI image required an explicit `wp` command; private workspace permissions on new files were made readable by WordPress. An early browser response watcher could not observe Chromium's blocked refused-script response, so final proof observes the real browser request and confirms native 403 refusal. A browser-evaluated extra replay hit a local Worker OPTIONS transport failure; final replay uses the captured request body at the same native HTTP route with opaque Origin and validates the same response ID and unchanged storage. No production path or pre-existing assertion was changed to accommodate those fixture issues. The interrupted diagnostic fixture was explicitly torn down, as were its containers and volume.

No implementation blocker remains for the scoped WordPress work. No PR or default-branch push was made. No CI dispatch or rerun is planned where a run already exists. The complete actual non-secret packet is published only on evidence/sd-pencil-c-f28. Product changes remain on the named cloud branch.

CLAIM DIST-013 PARTIAL points=1,2,3 tests=tests/e2e/script-embed.spec.ts#copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages
GAP DIST-013: Webflow and Squarespace-specific installation and DIST-021 forwarding, fixed-value, hidden and GA options remain unbuilt, including every-mode and shortcode obligations; existing checkout conflicts, payment holds and release qualification are unchanged.
