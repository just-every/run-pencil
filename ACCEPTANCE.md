<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Accept a Pencil installation

The primary journey: Build and preview a branching form, publish and distribute it, collect valid responses, review results and evidence, and close an owned action against a comparable measurement.

## Progress

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 60 | 154 | 58 | 272 |
| Agent surface | 0 | 0 | 5 | 5 |
| Later | 0 | 0 | 0 | 0 |
| Full target | 60 | 154 | 63 | 277 |

Judged from the code and tests at commit `712c770c14264668f9380c1b67190cefbaf4820a` (23 October 2026). ct reviewed `dd63975478b100f7df5e52799eea1e5663da6a0e` on 27 October 2026 for PAY-005, INTEG-006 and DIST-011 scope only, crediting no completion. Applying ct’s 05:00Z contract rulings; these text-only corrections claim no new DONE evidence. Subsequent target completions are maintained alongside their cited clause-tagged tests. RSLT-001, RSLT-003 and RSLT-004 include the combined-filter and response device-class implementation with native and browser journeys from sd-pencil-c10, repaired in sd-pencil-c12; they remain PARTIAL under ct's 05:00Z wording and no restoration is counted DONE. Release 0.7.0 was cut before these completions: on top of 0.6.0 it adds FIELD-006 and GOV-003 and fixes backup and restore on a database installed by Run Edit Run Platform (CHANGELOG.md). Each done row's evidence is its tagged tests, which `rer verify` runs. Field proof register: 11 rows; 0 passed, 0 failed, 11 not run.

## Core

### Landing

#### HOME-001 — Public landing

Core · published · **partial** · Cites BASE-DATA-005, BASE-PUBLIC-001

**Requirement.** Pencil supports public landing. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#home-001).

**Acceptance.**
1. By the owner's 12 October 2026 decision, the public home page serves Base's shared Lobby when no public landing flow is selected (Finish setup until the owner confirms first-run setup, then Sign in; `GET /setup/state` answers the same claim state), and the documented page or route redirects to the public home page.
2. An explicitly selected open published flow keeps its canonical respondent experience and admission checks at the public home page.
3. A later closed flow shows the standard closed page; an archived or missing flow returns 404, just as its direct link does.
4. Business branding follows BRAND-001, BRAND-003.
5. The optional default-off static `Powered by Pencil · runeditrun.com` credit remains available.
6. A selected respondent landing contains no vendor marketing, pricing, invented metrics, testimonials, or third-party requests.

**Evidence.** `tests/e2e/accessibility-foundation.spec.ts`, `tests/e2e/business-brand.spec.ts`, `tests/e2e/installed-home.spec.ts`
**Gap.** Missing a cited browser journey that follows the legacy Pencil redirect and enables then reads the optional public credit. Cited journeys show Lobby and selected-form lifecycle with the credit absent by default.

### Product site

#### SITE-001 — Product page

Core · published · **partial** · Cites BASE-DATA-005, BASE-PUBLIC-001

**Requirement.** Pencil supports product page. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#site-001).

**Acceptance.**
1. The run site's the public home page (run-pencil.com, written by `rer build --site`) renders Pencil's own product page for people evaluating the software: what Pencil does, its Run Pencil action to the documented page or route, and links to the source repository and the documentation.
2. The installed the public home page is governed by HOME-001.
3. The product page links no installed-instance route and makes claims only about delivered clauses: no invented metrics, customers, testimonials or pricing.

**Evidence.** `tests/e2e/site-page.spec.ts`
**Gap.** Missing a cited reader journey that follows the source link and reads claim content for the contract-only publication boundary. Cited journey reads headings, Run/Docs links and privacy, but never source link or claim content.

#### SITE-002 — Live answer path

Core · published · **done** · Cites BASE-PUBLIC-003

**Requirement.** Pencil supports live answer path. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#site-002).

**Acceptance.**
1. The product page's first screen demonstrates an answer path: choosing an answer on the illustrated card shows the follow-up question that answer leads to, works by keyboard, announces the change to assistive technology, and respects reduced motion.
2. Without JavaScript the card shows one complete question, answer and follow-up.

**Evidence.** `tests/e2e/site-hero.spec.ts` — "the note card retains its complete question and answer follow-ups without JavaScript, by pointer and keyboard, and with reduced motion"
**Gap.** None.

#### DOCS-001 — Documentation

Core · published · **partial** · Cites BASE-PUBLIC-001

**Requirement.** Pencil supports documentation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#docs-001).

**Acceptance.**
1. the documentation and the documented page or route render the product documentation from Markdown in this repository at build time, with navigation, an on-page table of contents and previous/next links.
2. Unknown slugs return 404.
3. The analysis guide states that withheld themes affect the analysis view, Results crosstabs use the same small-cell threshold, and answer summaries, the ledger and exports are unchanged.

**Evidence.** `tests/e2e/docs-site.spec.ts`
**Gap.** Missing a cited docs journey that reads analysis-guide withholding, crosstab threshold and unchanged summary/ledger/export statements. Cited journey visits overview/build/branch/results guides and checks shell/navigation/404, not analysis-guide content.

### Application shell

#### SHELL-001 — Operator shell

Core · published · **done** · Cites BASE-ACCESS-002, BASE-PUBLIC-003

**Requirement.** Pencil supports operator shell. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#shell-001).

**Acceptance.**
1. A valid session receives labeled, keyboard-operable navigation to the implemented operator surfaces; the public respondent experience is never an operator navigation destination. sign-in remains sessionless and is the only entry point to the operator session flow, so an unauthenticated request never receives the operator shell as a fallback.

**Evidence.** `tests/e2e/accessibility-foundation.spec.ts` — "keyboard and axe cover the landing, sign-in, operator navigation, builder and reports at declared viewports"; `tests/e2e/rendering-migration.spec.ts` — "native document/API/generated transport session matrix preserves private data boundaries"; `tests/runtime/private-auth-freshness.worker.test.ts` — "a warmed private route denies native session revocation"
**Gap.** None.

### Operators

#### OPER-001 — Equal operators

Core · published · **done** · Cites BASE-ACCESS-004

**Requirement.** Pencil supports equal operators. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#oper-001).

**Acceptance.**
1. Every operator can see and act on every flow, audience, response, analysis, and action.
2. There are no roles.

**Evidence.** `tests/runtime/access-foundation.worker.test.ts` — "a second equal operator edits another operators flow while foreign workspace IDs never become ownership authority"
**Gap.** None.

#### OPER-002 — Management

Core · published · **partial** · Cites BASE-ACCESS-004

**Requirement.** Pencil supports management. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#oper-002).

**Acceptance.**
1. Operators are invited and removed in settings.
2. Any operator may invite another and may remove any other operator, except that the setup operator can be removed only by themselves and the last operator cannot be removed.
3. There are no roles (OPER-001), so there is no seam that narrows who may do this.

**Evidence.** `tests/runtime/auth.worker.test.ts`, `tests/runtime/first-owner.worker.test.ts`
**Gap.** Missing a cited settings or HTTP journey that refuses another operator removing the setup operator with credentials unchanged, then permits setup self-removal. Cited public journeys show invitation and peer-removal races; setup/last guards run directly on the repository.

#### OPER-003 — Sign-in depends on mail

Core · published · **done** · Cites BASE-ACCESS-001

**Requirement.** Pencil supports sign-in depends on mail. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#oper-003).

**Acceptance.**
1. `BASE-ACCESS-001` magic links are delivered through mail sender adapter, so mail is a required external, not an optional one: startup fails under WS-003 naming the missing variable when the documented field or setting, the documented field or setting, or the documented field or setting is absent.
2. No deployment starts in a state where no operator can sign in.

**Evidence.** `tests/runtime/optional-configuration.worker.test.ts` — "native startup still names every missing required variable while absent deferred adapters do not block health"; `tests/runtime/base-auth.worker.test.ts` — "Base bootstraps once, signs in only existing operators and confirms with a read-only GET before a single-use POST"; `tests/managed-mail.test.ts` — "Managed mail uses its assigned sender for sign-in, response notifications and digests, queues rate limits and shows rejected mail to its owner"
**Gap.** None.

### Workspace

#### WS-001 — Workspace time zone

Core · published · **partial**

**Requirement.** Pencil supports workspace time zone. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#ws-001).

**Acceptance.**
1. Settings hold one IANA time zone for the workspace.
2. First-run setup offers the browser's IANA time zone as an editable default; existing configured workspaces retain their saved zone.
3. Every deadline, sending window, digest send time, and operator-facing date and time is evaluated and displayed in it.
4. A revision records the zone in force when its deadline was set, so changing the workspace zone later cannot move a deadline on an open revision.

**Evidence.** `tests/e2e/publication-zone.spec.ts`, `tests/runtime/access-foundation.worker.test.ts`, `tests/runtime/analysis-safety.worker.test.ts`
**Gap.** Missing a cited public journey that changes workspace zone after publication and reads unchanged open-revision deadline/zone. Cited journeys show settings, publication conversion and historical usage. The deadline-retention service journey is in uncited foundation.worker.test.ts.

#### WS-002 — Sending hours

Core · published · **partial**

**Requirement.** Pencil supports sending hours. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#ws-002).

**Acceptance.**
1. Settings hold a daily sending window in the WS-001 zone, defaulting to 09:00–17:00 every day.
2. Scheduled mail — reminders and digests — that falls due outside the window is held and sent when the window next opens; nothing is dropped for falling outside it.
3. Mail an operator triggers directly, and every magic link, is sent immediately regardless of the window.

**Evidence.** `tests/runtime/access-foundation.worker.test.ts`, `tests/runtime/distribution.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts`
**Gap.** Missing a cited public scheduling journey that holds reminders/digests outside the window, releases at opening, and sends operator-triggered mail and magic links immediately outside it. Cited files show settings through HTTP and scheduling through direct services/maintenance; the immediate exception is never exercised under an out-of-window clock.

#### WS-003 — Optional externals are configuration, not degradation

Core · published · **partial** · Cites BASE-SECRET-002

**Requirement.** Pencil supports optional externals are configuration, not degradation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#ws-003).

**Acceptance.**
1. Supersedes `BASE-SECRET-002`.
2. Pencil starts only when every variable marked required in the declared env limits is present, and fails at startup naming the first missing one. ai provider adapter and task destination adapter are declared optional: with either absent the deployment starts and serves, every clause that does not name that adapter holds in full, and each feature offered by the implemented profile that does name it is shown as unavailable alongside page-local connection setup, with deployment variables retained as an alternative.
3. Features deferred by the declared contract profile are omitted from the interface until implemented.
4. No feature silently produces a reduced result instead.

**Evidence.** `tests/e2e/review-corrections.spec.ts`, `tests/runtime/optional-configuration.worker.test.ts`
**Gap.** Missing a cited browser journey with absent AI/task adapters that reads unavailable feature states and page-local connection setup while independent collection/results work. Startup proves optional absence permits health; cited browser does not configure absent-adapter cases.

### Business branding

#### BRAND-001 — Saved business identity

Core · published · **partial** · From BRAND-001 · Cites BASE-INPUT-002, BASE-INPUT-003

**Requirement.** Pencil supports saved business identity. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#brand-001).

**Acceptance.**
1. Supersedes `BASE-INPUT-003` for business logos only.
2. Operators save the business name, one supporting line, an accent in #rrggbb format, and an optional PNG, JPEG or WebP logo within the declared limits brand limits.
3. A fresh workspace asks its owner for the business name at first-run setup and uses neutral defaults until saved.
4. The same saved brand appears in preview, direct and embedded forms, completion and closed states, the selected public landing, and new-response email.
5. Email includes the saved name and supporting line as literal text and escaped HTML, the saved accent, and any validated logo as inline CID bytes with no remote resources; removing the logo affects the next dispatch run.
6. The accent's button text has at least 4.5:1 contrast; a readable foreground is selected for other accent text.
7. Logo removal takes effect everywhere.
8. Authenticated server uploads check size, declared MIME and content signatures, refusing SVG.

**Evidence.** `tests/e2e/business-brand.spec.ts`, `tests/runtime/brand.worker.test.ts`
**Gap.** Missing a cited journey that dispatches and opens branded new-response mail, checks literal/escaped identity/accent/inline logo, then removes the logo and reads next mail. Cited journeys cover screens/public states/uploads/removal; neither opens new-response email.

#### BRAND-003 — Saved business identity: Logos are served from this installation with the validated Content-Type and nosniff

Core · published · **partial** · From BRAND-001 · Cites BASE-INPUT-002, BASE-INPUT-003

**Requirement.** This part of BRAND-001 covers logos are served from this installation with the validated Content-Type and nosniff, with no third-party request.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#brand-001).

**Acceptance.**
1. Logos are served from this installation with the validated Content-Type and nosniff, with no third-party request.
2. This clause supersedes BASE-INPUT-003 for business logos only: their bytes live in D1 and are deliberately public inline images, included in deployment exports, rather than private R2 downloads.
3. Business identity is independent of Pencil's operator authentication branding.

**Evidence.** `tests/e2e/business-brand.spec.ts`, `tests/runtime/brand.worker.test.ts`
**Gap.** Missing a cited journey that dispatches and opens branded new-response mail, checks literal/escaped identity/accent/inline logo, then removes the logo and reads next mail. Cited journeys cover screens/public states/uploads/removal; neither opens new-response email.

### Dashboard

#### DASH-001 — First flow

Core · published · **partial**

**Requirement.** Pencil supports first flow. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dash-001).

**Acceptance.**
1. A fresh deployment has no sample flows or responses.
2. A workspace with no flows shows an empty state that explains Ask → Signal → Act.
3. The empty dashboard and New flow offer Customer feedback, NPS and Contact/lead templates alongside a blank flow.
4. Templates create ordinary editable drafts and can be duplicated under FLOW-011.
5. Synthetic sample data is an explicit local development option.

**Evidence.** `tests/runtime/first-owner.worker.test.ts`
**Gap.** Missing a cited dashboard browser journey that reads empty Ask → Signal → Act and chooses Customer feedback/NPS/Contact-lead or blank drafts. First-owner journey checks zero flows and creates templates through API, never the empty dashboard or its choices.

#### DASH-002 — Flow list

Core · published · **partial**

**Requirement.** Pencil supports flow list. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dash-002).

**Acceptance.**
1. Operators can list flows by draft, open, closed, or archived state, sorted by last activity, with completed-response count, audience, and analysis status visible.
2. An invited flow also shows completions divided by launched participants not bounced or opted out; zero eligible participants shows `0 / 0` with no percentage.
3. An anonymous public flow shows starts and completions without inventing a target denominator.

**Evidence.** `tests/runtime/feedback-attention.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited dashboard journey that reads last-activity ordering and invited-audience completion denominators, including zero eligible participants, across state filters. Cited HTTP journeys show counts/analysis; archive filter is service-level.

### Flows

#### FLOW-001 — Lifecycle

Core · published · **partial**

**Requirement.** Pencil supports lifecycle. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-001).

**Acceptance.**
1. A new flow is draft; publishing makes it open; an open flow can close; a closed flow can reopen the same published revision only after no deadline or target condition remains satisfied, or it can archive; a draft can archive; and an archived flow cannot reopen.
2. Draft public URLs return 404, closed revisions show the standard closed page, and archived public URLs return 404.
3. Archiving removes the flow from default operator views without deleting its revisions, responses, analyses, or actions.

**Evidence.** `tests/runtime/foundation.worker.test.ts`
**Gap.** Missing a cited public lifecycle journey that completes allowed close/reopen/archive, refuses archived reopen and reads unchanged history. The cited test calls services directly; foundation-fixture methods are not HTTP proxies.

#### FLOW-002 — Ordered steps

Core · published · **partial**

**Requirement.** Pencil supports ordered steps. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-002).

**Acceptance.**
1. A draft contains an ordered list of steps: at most one welcome screen, which is optional and can only be first; one or more questions; and one or more named completion screens.
2. Operators can add, edit, duplicate, reorder, and delete them.

**Evidence.** `tests/e2e/journey.spec.ts`
**Gap.** Missing a cited builder journey that duplicates, reorders and deletes steps and reads the resulting order while preserving welcome/completion constraints. Cited journey adds/edits, but never performs those three operations.

#### FLOW-003 — Question types

Core · published · **partial**

**Requirement.** Pencil supports question types. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-003).

**Acceptance.**
1. A question is short text, long text, email, single choice, multiple choice, rating, priority, dropdown, yes/no, NPS, number, date, or consent; it has a prompt, optional why-we-ask text, required flag, and applicable editable type-specific options within the limits in `seed.json`.
2. The builder canvas uses the same respondent controls.

**Evidence.** `tests/e2e/new-question-types.spec.ts`, `tests/runtime/new-question-types.worker.test.ts`
**Gap.** Missing a cited builder/respondent journey covering original short/long text, email, single/multiple choice, rating and priority alongside the six added types. Cited browser covers dropdown/yes-no/NPS/number/date/consent; wider type work in runtime file is largely direct services.

#### FLOW-004 — Saved edits

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports saved edits. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-004).

**Acceptance.**
1. A field-valid builder write includes the draft version it read and may leave the graph incomplete until publication.
2. One Save per step acknowledges a single version-checked transaction containing its content, choices and answer paths.
3. Invalid writes change none of those fields.
4. A current-version edit is persisted before the builder shows it as saved; a stale edit is rejected with the latest version and cannot overwrite another operator's edit.
5. Leaving or reloading after the saved indicator cannot lose the accepted edit.

**Evidence.** `tests/e2e/review-corrections.spec.ts`
**Gap.** Missing a cited save journey that commits content/choices/paths, reloads after Saved, and attempts a stale competing edit without overwriting. Cited journey shows invalid-label refusal and editing controls, without stale-write or accepted-save reload readback.

#### FLOW-005 — Branching

Core · published · **partial**

**Requirement.** Pencil supports branching. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-005).

**Acceptance.**
1. A single-choice or dropdown answer can match equality against a stable choice ID; yes/no and consent answers can match boolean equality; rating, priority, NPS, number and calendar-date answers can match equality or ordered comparison; and a multiple-choice answer can match any or all selected stable choice IDs.
2. Priority equality compares the complete ordering and ordered comparisons use a choice's rank.
3. Preview shows the ordered rule evaluations and chosen next step used by the published runtime, using the same predicates. *Policy: flow branch-selection adapter; default: first matching rule in displayed order, then the required default path.

**Evidence.** `tests/e2e/journey.spec.ts`, `tests/e2e/publication-zone.spec.ts`, `tests/e2e/review-corrections.spec.ts`
**Gap.** Missing a cited branching journey that exercises boolean, numeric/date comparisons, priority ranking and multiple-choice any/all predicates through builder, preview and collection. Cited browser set demonstrates single-choice branching only.

#### FLOW-006 — Publish validation

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports publish validation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-006).

**Acceptance.**
1. Publishing runs every FLOW-012 through FLOW-014 validation and is rejected with all offending stable step IDs and reasons; rejection creates no revision and leaves the draft editable.
2. This clause inherits PAY-001, PAY-006, PAY-007: publishing refuses misplaced PAY-001, PAY-006, PAY-007 payment steps by step ID.

**Evidence.** `tests/runtime/calculations.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/graph-reachability.worker.test.ts`
**Gap.** Missing a cited HTTP publication journey refusing invalid graph references, unreachable/cyclic screens and invalid questions, reading stable IDs/reasons, then editing/publishing same draft. Cited HTTP journey proves payment/calculation refusal; general graph paths use services.

#### FLOW-007 — Preview isolation

Core · published · **done**

**Requirement.** Pencil supports preview isolation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-007).

**Acceptance.**
1. Preview runs the current draft with test answers, identifies itself as preview, sends no invitations or external effects, and never creates a response or changes result counts.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "previews the current draft and incomplete branches with test answers while preserving every product record and effect"
**Gap.** None.

#### FLOW-008 — Published revisions

Core · published · **partial**

**Requirement.** Pencil supports published revisions. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-008).

**Acceptance.**
1. Publishing creates an immutable numbered revision and makes it the current revision resolved by the flow's canonical direct and embed URL.
2. Every invitation, first-interaction session permitted by RESP-013, completed response, analysis, and export records the revision it used; merely loading the page creates no session or visitor record.
3. The only load-time recording is RSLT-013, RSLT-017’s anonymous aggregate counter increment, with no identifier or cookie and no link to a response.

**Evidence.** `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited public revision journey that reads launched-invitation and analysis revisions and verifies load creates no session before interaction. Cited native journey proves anonymous revisions/exported answers; invitation pinning is service-level and load-only/analysis revision are not read.

#### FLOW-009 — Live edits

Core · published · **done**

**Requirement.** Pencil supports live edits. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-009).

**Acceptance.**
1. Editing an open flow changes a new draft only.
2. Existing invitations and first-interaction sessions stay pinned to their recorded revision; publishing the draft affects only later direct or embedded sessions and later invitation launches.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers"
**Gap.** None.

#### FLOW-010 — Closure

Core · published · **partial**

**Requirement.** Pencil supports closure. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-010).

**Acceptance.**
1. An operator may close a flow immediately or configure a revision-specific deadline or completed-response target.
2. A deadline is an instant in the WS-001 zone recorded with that revision.
3. A manual flow close closes every revision's admission; a deadline or target closes only that revision's admission atomically.

**Evidence.** `tests/e2e/publication-zone.spec.ts`
**Gap.** Missing a cited closure journey that reaches deadline/target and manually closes a flow, then reads admission across revisions. Cited browser sets/publishes values and stops before either closure condition or manual close.

#### FLOW-011 — Duplication

Core · published · **partial**

**Requirement.** Pencil supports duplication. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-011).

**Acceptance.**
1. Duplicating a flow creates an unlinked draft containing its latest draft or published structure and settings, but no audience members, invitations, responses, analyses, actions, delivery history, or external IDs.

**Evidence.** `tests/runtime/foundation.worker.test.ts`
**Gap.** Missing a cited public duplication journey that duplicates populated data and opens the independent draft and empty audience/response/analysis/action/delivery views. Cited lifecycle test duplicates/reads directly through services.

#### FLOW-012 — Valid references

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports valid references. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-012).

**Acceptance.**
1. Every branch predicate references an existing structured question and stable choice when applicable, and every branch destination references an existing question or completion screen.

**Evidence.** `src/core/features/flows/graph.contract.test.ts`
**Gap.** Missing a cited publication-door journey accepting valid references and refusing missing/incompatible branch references without revision writes. Only cited file directly calls the graph validator.

#### FLOW-013 — Reachable termination

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports reachable termination. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-013).

**Acceptance.**
1. The flow's first step is its welcome screen or its first question, every step is reachable from it on at least one path, and every possible path reaches one completion screen without a cycle.

**Evidence.** `tests/runtime/graph-reachability.worker.test.ts`
**Gap.** Missing a cited publication-door journey refusing unreachable/cyclic graphs without writes, then publishing/completing reachable paths. Cited fixture calls services; cycle outcome is not exercised in this file.

#### FLOW-014 — Valid questions

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports valid questions. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-014).

**Acceptance.**
1. Every question has a non-empty prompt within the text limit, every structured question has valid distinct options within its type limits, and the flow contains at least one question.

**Evidence.** `tests/e2e/review-corrections.spec.ts`
**Gap.** Missing a cited builder/publication journey refusing empty/over-limit prompts, invalid type options and a form with no question, then publishing a valid question. Cited browser proves duplicate-label refusal, not these missing conditions.

#### FLOW-015 — Stable structure IDs

Core · published · **partial**

**Requirement.** Pencil supports stable structure IDs. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-015).

**Acceptance.**
1. A step and each of its choices receive stable IDs when created; editing, reordering, publishing, exporting, and importing preserve them, while duplication creates new IDs.
2. Operators enter choice labels; answer values are generated from them, remain unchanged when a saved label is renamed, and can be edited under Advanced.

**Evidence.** `tests/contract/data-release.contract.test.ts`, `tests/runtime/foundation.worker.test.ts`
**Gap.** Missing a cited authoring journey reading stable IDs through saved label rename/reorder/publication, then public duplication with new IDs and editable Advanced values. Cited archive command preserves recovery IDs; lifecycle services prove duplication without authoring door.

#### FLOW-016 — Published policy snapshot

Core · published · **partial**

**Requirement.** Pencil supports published policy snapshot. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-016).

**Acceptance.**
1. A published revision stores the evaluated configuration for flow branch-selection adapter, response identity adapter, and flow response-admission adapter; later policy changes affect only a newly published revision.

**Evidence.** `tests/runtime/graph-reachability.worker.test.ts`, `tests/runtime/policy-snapshot.worker.test.ts`
**Gap.** Missing a cited public publish/session journey that changes policy and reads old identity/admission/branch settings on existing invitations/sessions while later publication adopts new policy. Both cited files test policy changes through direct services.

#### FLOW-017 — Revision admission

Core · published · **partial**

**Requirement.** Pencil supports revision admission. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-017).

**Acceptance.**
1. A new direct or embedded visit starts the current revision; an invitation starts its recorded revision; and a returning first-interaction session resumes its recorded revision.
2. A superseded revision cannot start a new anonymous session and remains reachable only through an existing invitation or session until its admission closes.

**Evidence.** `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited public admission journey that refuses a fresh anonymous start on a superseded revision, resumes a returning first-interaction session and opens an old invitation until closure. Native journey shows old submission/new current session; invitation/resume admission is service-level.

#### FLOW-018 — Revision counts

Core · published · **partial**

**Requirement.** Pencil supports revision counts. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-018).

**Acceptance.**
1. Deadline and target admission checks use completed responses for that revision only.
2. Reaching either condition cannot close another revision, while manual close and archive close all revisions.

**Evidence.** `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited two-revision count journey reaching deadline/target on one while the other stays open, then manually closing/archiving both and reading refusals. Cited native target-race journey has only one revision.

#### FLOW-019 — Answer values by type

Core · published · **partial** · Cites BASE-INPUT-001

**Requirement.** Pencil supports answer values by type. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-019).

**Acceptance.**
1. A stored answer is exactly one of: for short text and long text, a string within that type's character limit in the declared limits limits; for email, a syntactically valid address stored as the respondent typed it and compared case-insensitively; for single choice and dropdown without Other selected, one stable choice ID belonging to that question; for multiple choice without Other selected, a set of distinct stable choice IDs belonging to that question, within its configured minimum and maximum selections, except that the configured None option alone satisfies the minimum; when Other is selected on any of these types, exactly `{choiceIds: string[], otherText: string}`, with distinct IDs belonging to the question and including its configured Other ID, exactly one ID for single choice or dropdown, and non-blank Other text within the short-text limit and configured FIELD-013 validation.
2. None cannot be combined with another choice or an Other-answer object, and Other text without the Other selection is invalid; for rating, an integer within the question's configured scale; for priority, a complete ordering of that question's stable choice IDs with no repetition and no omission; for yes/no, a boolean; for NPS, an integer from 0 through 10; for number, a finite number within optional minimum, maximum and decimal precision; for date, a true calendar YYYY-MM-DD value within optional earliest/latest bounds without timezone conversion; for consent, `{accepted: boolean, statement: string}` retaining the immutable published statement, with required consent accepting only true.
3. For FIELD-003 score and FIELD-004 contact questions, the stored values are the typed, normalized values those clauses define.
4. Nothing else is a valid answer.

**Evidence.** `tests/e2e/ledger-filters.spec.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts`
**Gap.** Missing a cited answer-submission journey for configured Other/None objects and their exclusive selection/text refusal rules with accepted-value readback. Cited typed-filter fixture has ordinary typed answers only; Other/None objects and normalized contact/score cases never occur.

#### FLOW-020 — Required applies to the path taken

Core · published · **done**

**Requirement.** Pencil supports required applies to the path taken. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-020).

**Acceptance.**
1. A required question blocks progress only on a path that reaches it.
2. A question that the respondent's answers route around is never asked, never recorded as unanswered or missing, and never blocks final submission; publish validation does not require a required question to appear on every path.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers"
**Gap.** None.

#### FLOW-021 — Deleting a question keeps its answers

Core · published · **partial** · Cites BASE-DATA-002

**Requirement.** Pencil supports deleting a question keeps its answers. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#flow-021).

**Acceptance.**
1. Deleting a step in a draft changes only that draft.
2. Answers already collected keep their stable step ID and the revision that asked them, stay in the ledger, results, exports, and existing analyses, and are never rewritten or removed by a later publication.
3. A question first added in a later revision is never reported as unanswered by responses to an earlier revision that did not contain it.

**Evidence.** `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited question-deletion journey collecting answers/analysis, deleting draft step, republishing and opening retained ledger/results/export/analysis. Cited comparison journey adds a question and renames labels, but never deletes a draft question.

#### LOGIC-005 — Conditional completion and redirects

Core · published · **done** · Cites BASE-DATA-004

**Requirement.** A response ends on the completion screen or approved outside destination selected from its accepted answers and context. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-005).

**Acceptance.**
1. LOGIC-006 conditions over answers, hidden fields, calculations and scores choose the completion screen or an HTTPS redirect on an approved origin with only declared values appended.
2. A compound AND condition over an answer and hidden field can route two response paths to distinct completion targets.
3. Publication refuses a redirect to an unapproved origin; preview displays the selected target without navigating or collecting, and only a committed submission returns the server-derived destination.
4. Retries retain the original revision, accepted values and destination, and a copied form remaps its destination-parameter operands.

**Evidence.** `tests/runtime/completion-redirects.worker.test.ts` — "chooses screen or approved redirect from accepted answer, hidden, calculation and score conditions; replay and copies preserve revision custody"; `tests/runtime/completion-redirects.worker.test.ts` — "refuses unapproved, insecure, credential-bearing and invalid operand redirects at publish without changing the live revision"; `tests/e2e/completion-redirects.spec.ts` — "authors an approved redirect, previews without leaving and collects both conditional completion targets"
**Gap.** None.

#### A11Y-001 — Accessible respondent states and layouts

Core · published · **done** · Cites BASE-ACCESSIBILITY-001 · Register R-1, R-2

**Requirement.** Pencil applies Base's shared accessibility bar to its full respondent journey, including error and unavailable states. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#a11y-001).

**Acceptance.**
1. The respondent journey covers every shipped question type and the one-question, classic-page and question-group layouts, including welcome, answer errors, progress, completion, closed-form and unavailable-resume states.
2. Each added question type or layout extends that same respondent coverage before it ships.

**Evidence.** `tests/e2e/respondent-accessibility.spec.ts` — "completes every shipped type across standalone, classic and grouped screens with keyboard, associated errors, focus, contrast and 320px reflow"
**Gap.** None.

#### FIELD-006 — Randomized choice and question order

Core · published · **done**

**Requirement.** Operators randomize choices or question blocks while retaining the exact presentation order for later analysis. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-006).

**Acceptance.**
1. Operators may randomize a question's choices or a block of questions, with Other and None of the above under FIELD-010 always anchored last.
2. Each completed response stores the order the respondent saw, and the export retains that presentation order.
3. Across 200 collected responses every stored permutation contains exactly the permitted members, retains the anchored choices and matches the exported order.

**Evidence.** `tests/runtime/randomized-order.worker.test.ts` — "200 respondents retain valid varied choice and block orders through sessions, resume, immutable revisions, copies and ledger exports"; `tests/e2e/randomized-order.spec.ts` — "a workshop organiser randomizes a question group and choices, previews it and retains the respondent’s displayed order in results and exports"
**Gap.** None.

### Audience

#### AUD-001 — Contacts

Core · published · **done**

**Requirement.** Pencil supports contacts. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-001).

**Acceptance.**
1. Operators can create, edit, import, and delete contacts with name, email, and custom fields.
2. Email addresses compare case-insensitively and an import reports, rather than silently duplicating, matching contacts.

**Evidence.** `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey"; `tests/runtime/audience.worker.test.ts` — "audience CSV public preview and commit report case matches, repeats, invalid rows and explicit updates without retaining raw CSV"
**Gap.** None.

#### AUD-002 — Segments

Core · published · **done**

**Requirement.** Pencil supports segments. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-002).

**Acceptance.**
1. A segment filters contacts by stored fields.
2. Launching invitations records the participant set plus evaluated flow audience-eligibility adapter and flow reminder-schedule adapter configuration, so later contact, segment, or policy changes do not rewrite the launch; AUD-006 still enforces current hard consent and existence checks at send time.

**Evidence.** `tests/runtime/audience.worker.test.ts` — "saved segments launch a frozen evaluated audience and concurrent command replay creates no extra participants, jobs or attempts"; `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey"
**Gap.** None.

#### AUD-003 — Participants

Core · published · **partial**

**Requirement.** Pencil supports participants. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-003).

**Acceptance.**
1. Each invited contact becomes one participant with an opaque invitation token, independent queued/sent/bounced/failed delivery status, eligible/opted-out consent status, and not-started/started/completed response status.
2. Delivery attempts are append-only, and names, emails, and other contact values never appear in the public URL.

**Evidence.** `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public delivery journey that records a second attempt and reads append-only attempt history plus independent bounced/failed/consent states. Browser journey reads sent/pending/completed participants; attempt and consent transitions in distribution.worker.test.ts run through services.

#### AUD-004 — Eligibility

Core · published · **partial**

**Requirement.** Pencil supports eligibility. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-004).

**Acceptance.**
1. Invitations are created only for contacts allowed by the audience policy; that policy may narrow but never admit a missing-email or opted-out contact. *Policy: flow audience-eligibility adapter; default: also exclude contacts already invited to that published revision.

**Evidence.** `tests/runtime/audience.worker.test.ts`
**Gap.** Missing a cited public eligibility journey that tries a new launch command for already-invited and missing-email contacts, reads exclusions and unchanged participants, then completes eligible launch. Cited public journey excludes opted-out contacts and replays same command; broader policy exclusions are direct services.

#### AUD-005 — Launch idempotency

Core · published · **done** · Cites BASE-OPS-003

**Requirement.** Pencil supports launch idempotency. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-005).

**Acceptance.**
1. Repeating the same audience-launch command for one revision returns the original launch and cannot create duplicate participants, invitation jobs, or delivery attempts.

**Evidence.** `tests/runtime/audience.worker.test.ts` — "saved segments launch a frozen evaluated audience and concurrent command replay creates no extra participants, jobs or attempts"
**Gap.** None.

#### AUD-006 — Send-time eligibility

Core · published · **partial**

**Requirement.** Pencil supports send-time eligibility. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#aud-006).

**Acceptance.**
1. Immediately before each invitation or reminder, Pencil verifies that the contact still exists and has not opted out.
2. Mail uses the participant email snapshot displayed and recorded at launch; editing the contact later never silently reroutes an active participant.

**Evidence.** `tests/runtime/audience.worker.test.ts`, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public/scheduled delivery journey that attempts invitations and reminders after contact opt-out/deletion, observes no send/no new attempt and then observes allowed snapshot-address send. Cited file mutates contacts through HTTP but invokes each send-time guard directly on delivery services.

### Distribution

#### DIST-001 — Public link

Core · published · **done** · Cites BASE-PUBLIC-001

**Requirement.** Pencil supports public link. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-001).

**Acceptance.**
1. Every open revision has a canonical direct link that renders the respondent experience without an operator session.

**Evidence.** `tests/e2e/public-flow.spec.ts` — "direct and embedded respondents complete the same accessible flow without an operator session"
**Gap.** None.

#### DIST-002 — Embed

Core · published · **partial** · From DIST-002 · Cites BASE-PUBLIC-001, BASE-PUBLIC-002

**Requirement.** Pencil supports embed. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-002).

**Acceptance.**
1. One asynchronous script or HTTPS iframe embeds the same respondent experience.
2. It does not block the host page, and direct and embedded submissions produce the same response data and validation.
3. Script embeds use an asynchronously loaded installation-origin script that mounts a sandboxed iframe without allow-same-origin, resizes to its content and emits only loaded, height, completed and checkout events.
4. Exact allowed host origin, exact frame source, opaque child origin, challenge and field shape are checked.
5. No answers, response identifiers, credentials or contact details enter the host URL, DOM or messages.
6. The plain iframe option remains available.
7. The checkout message carries only the HTTPS Checkout URL on a Stripe-owned origin and the session ID, with no payer data.
8. It is posted to the exact owner-configured embedding origin, never `*`; the host must be on the form's allowed-origin list or no checkout event is sent and the respondent gets the same-tab fallback.

**Evidence.** `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “the accessible embedded route completes the same flow inside a real iframe”, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” (1440/390)
**Gap.** Opaque script/iframe collection and exact host/frame admission have local browser proof. Checkout carries only its Stripe HTTPS URL and Checkout Session ID plus the transport challenge, targets the configured allowed origin, and is consumed once in child and host. The four permitted events include loaded acknowledgements; other message shapes are refused. An allowed script frame without acknowledgement offers an explicit user-activated same-tab continuation. Gap: a disallowed embedding host is refused with 403 before any payment can start, so its checkout same-tab fallback is not implemented; child rejection of an application receipt with extra payer fields is not asserted through a public door. Payment in a plain iframe remains PAY-001's named gap.

#### DIST-022 — Embed: There is one handoff per payment attempt

Core · published · **partial** · From DIST-002 · Cites BASE-PUBLIC-001, BASE-PUBLIC-002

**Requirement.** This part of DIST-002 covers there is one handoff per payment attempt.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#dist-002).

**Acceptance.**
1. There is one handoff per payment attempt.
2. No other new host event is permitted without ct's ruling.

**Evidence.** `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “the accessible embedded route completes the same flow inside a real iframe”, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” (1440/390)
**Gap.** Opaque script/iframe collection and exact host/frame admission have local browser proof. Checkout carries only its Stripe HTTPS URL and Checkout Session ID plus the transport challenge, targets the configured allowed origin, and is consumed once in child and host. The four permitted events include loaded acknowledgements; other message shapes are refused. An allowed script frame without acknowledgement offers an explicit user-activated same-tab continuation. Gap: a disallowed embedding host is refused with 403 before any payment can start, so its checkout same-tab fallback is not implemented; child rejection of an application receipt with extra payer fields is not asserted through a public door. Payment in a plain iframe remains PAY-001's named gap.

#### DIST-003 — Invitations

Core · published · **partial**

**Requirement.** Pencil supports invitations. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-003).

**Acceptance.**
1. An operator can send an invitation to eligible participants.
2. Each message names the business and flow, contains that participant's opaque link, and records a durable delivery attempt before calling mail sender adapter.

**Evidence.** `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited operator launch/mail transport journey that sends eligible invitation, opens business/form/opaque-link content and observes durable attempt before provider call. Only cited file prepares and records delivery through services.

#### DIST-004 — Reminders

Core · published · **partial**

**Requirement.** Pencil supports reminders. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-004).

**Acceptance.**
1. Reminders are sent only to sent participants who have not completed, opted out, bounced, or reached a closed or archived flow.
2. Completion cancels pending reminders. *Policy: flow reminder-schedule adapter; default: one reminder 2 days after the invitation, released within the WS-002 sending hours.

**Evidence.** `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public scheduled reminder journey that delivers to eligible sent/noncompleted recipient and refuses unsafe completed/opted-out/bounced/closed/archived sends without changes. Cited Evidence file exercises reminder eligibility and cancellation only through direct services.

#### DIST-005 — Opt-out

Core · published · **partial**

**Requirement.** Pencil supports opt-out. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-005).

**Acceptance.**
1. Every invitation and reminder includes an opt-out link.
2. Opting out prevents future flow mail to that contact regardless of policy.
3. Renewed consent records its actor, time, and source before mail can resume; opt-out does not delete an existing response.

**Evidence.** `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public consent-renewal journey that records actor/time/source and then reads resumed mail without deleting existing response. Browser journey saves opt-out; renewal/readback and no-later-send checks in distribution.worker.test.ts use services.

#### DIST-006 — Mail retry

Core · published · **partial** · Cites BASE-OPS-003, BASE-OPS-004

**Requirement.** Pencil supports mail retry. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-006).

**Acceptance.**
1. A transient mail sender adapter failure is retried at most 5 times over 1 hour using the original delivery idempotency key.

**Evidence.** `tests/runtime/distribution.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts`, `tests/runtime/notifications.worker.test.ts`
**Gap.** Missing a cited public scheduled delivery journey driving transient failure through five retries over one hour and reading original-key attempt history plus terminal refusal. All cited retry loops invoke delivery/dispatcher services directly, not the native scheduled Worker transport.

#### DIST-007 — Adapter isolation

Core · published · **partial**

**Requirement.** Pencil supports adapter isolation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-007).

**Acceptance.**
1. Mail cannot be unconfigured (OPER-003).
2. A failing mail sender adapter disables invitations, reminders, notification mail, and new magic-link sign-ins with a named error visible to operators, while existing operator sessions, direct links, embeds, response collection, results, the ledger, and exports keep working.
3. Recovery is restoring the sender; Pencil offers no password or bypass sign-in.

**Evidence.** `tests/runtime/base-auth.worker.test.ts`
**Gap.** Missing a cited sender-failure journey that reads operator-visible named failure for invitations/reminders/notifications and successfully collects via direct/embed, opens results/ledger/exports with existing session. Cited journey fails sign-in send and checks dashboard/health only.

#### DIST-008 — Terminal delivery

Core · published · **partial** · Cites BASE-OPS-004

**Requirement.** Pencil supports terminal delivery. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-008).

**Acceptance.**
1. A permanent mail failure or exhausted retry is marked failed with the provider reason and retry action visible to operators; no invitation is recorded as sent merely because it was queued.

**Evidence.** `tests/e2e/mail-recovery.spec.ts`, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public permanent/exhausted delivery journey that reads failed status with provider reason and retry action, with queued never shown sent. Browser journey covers unknown outcome; permanent/exhausted failed states in distribution.worker.test.ts are service-only.

#### DIST-009 — Embed isolation

Core · published · **partial** · Cites BASE-PUBLIC-001, BASE-PUBLIC-002

**Requirement.** Pencil supports embed isolation. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-009).

**Acceptance.**
1. The embed rejects a host origin not allowed by BASE-PUBLIC-002 before rendering the flow.
2. It exposes no answer, response ID, participant token, or contact value to the host URL, DOM, or `postMessage`; host communication is limited to non-identifying loaded, height, completed and checkout events.
3. The checkout message carries only the HTTPS Checkout URL on a Stripe-owned origin and the session ID, with no payer data.
4. It is posted to the exact owner-configured embedding origin, never `*`; the host must be on the form's allowed-origin list or no checkout event is sent and the respondent gets the same-tab fallback.
5. There is one handoff per payment attempt.
6. No other new host event is permitted without ct's ruling.

**Evidence.** `tests/e2e/embed-security-foundation.spec.ts`, `tests/e2e/rendering-migration.spec.ts`, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts` (1440/390)
**Gap.** Opaque child isolation, exact origin/source/challenge admission, strict four-event messages, Stripe HTTPS URL/Checkout Session ID projection, exact outbound target and handoff replay refusal have local assertions through the script/payment journeys. Non-HTTPS and non-Stripe provider URLs produce no checkout message or navigation. Missing acknowledgement on an allowed script frame exposes a user-activated same-tab continuation. Gap: disallowed-host checkout fallback cannot occur after the existing pre-render 403; extra payer fields on an application payment receipt have no public-door child rejection proof. Plain iframe payments remain outside this handoff proof.

#### DIST-010 — Ambiguous mail outcome

Core · published · **done** · Cites BASE-OPS-004

**Requirement.** Pencil supports ambiguous mail outcome. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-010).

**Acceptance.**
1. mail sender adapter implements send-or-get by delivery idempotency key when its provider supports lookup.
2. An ambiguous timeout without lookup is marked unknown and is not automatically retried; an operator may reconcile or explicitly resend it with the duplicate-delivery risk shown.

**Evidence.** `tests/e2e/mail-recovery.spec.ts` — "a real sender failure is visible and an explicit duplicate-risk retry retains its durable key and history"
**Gap.** None.

#### DIST-012 — QR codes and kiosk mode

Core · published · **done**

**Requirement.** Pencil supports qR codes and kiosk mode. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-012).

**Acceptance.**
1. Every public collector, including each named collector and the default direct and embed links, has its own public URL and a downloadable QR code (SVG and PNG) carrying its source label.
2. Invitation, imported and unknown system-source buckets are historical attribution, not public collectors: they have no public collection URL, receive no QR code, and retain their existing identity semantics; kiosk mode restarts the form after completion on a shared device, clears all answers from the browser after a configurable idle time, and never shows the previous respondent's answers.
3. Through the browser, checks the public URL and SVG/PNG QR downloads for each named public collector and the default direct and embed links, scans each QR to collect a response with the matching source, and verifies that invitation, imported and unknown system-source buckets offer neither a public collection URL nor a QR download and retain their identity semantics; it completes a kiosk form twice and proves the second session starts empty and the first response's source is the kiosk collector, then waits through the configured idle time and verifies that all browser answers are cleared and the previous respondent's answers are never shown.

**Evidence.** `tests/e2e/kiosk.spec.ts` — "download labelled QR codes and collect isolated shared-device responses with idle clearing"; `tests/runtime/qr.worker.test.ts` — "QR downloads require operator authority, retain the exact collection link and reject unrelated collectors and formats"
**Gap.** None.

#### DIST-019 — Restricted access

Core · published · **done** · Cites BASE-ACCESS-002

**Requirement.** Pencil supports restricted access. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-019).

**Acceptance.**
1. A form can require a password, a verified email in an allowed domain or list (by one-time code, one response per verified email), or a signed link from the business's own app; the restriction is checked on the server before the first step renders and is stated in RESP-005's disclosure when it makes the response identified.
2. Through the browser, is refused without the password, verifies an allowed-domain email by code and completes once, and a second completion by the same email is refused.

**Evidence.** `tests/e2e/restricted-access.spec.ts` — "build password, verified-email and app-signed forms, with server-first gating and one completion per verified email"; `tests/runtime/restricted-access.worker.test.ts` — "restricted collection gates graph and session doors, verifies identity, serializes email uniqueness and binds app signatures to their revision"; `scripts/deployment-data-custody-replay.check.mjs` — "[DATA-001,BASE-DATA-001,IMPORT-004,BASE-OPS-003,LEDG-006,PAY-001] whole-data delivery recovery retains exact product custody and never replays restored capabilities"
**Gap.** None.

### Responding

#### RESP-001 — Respondent layouts

Core · published · **partial**

**Requirement.** A published form presents its selected layout without builder or operator controls. Layout behavior is shared with FIELD-008 and FIELD-012.

**Acceptance.**
1. A respondent sees one welcome or completion screen at a time.
2. One-question layout presents one question per screen.
3. Classic pages present several questions per page and apply the shared page conditions of LOGIC-006, LOGIC-008 and LOGIC-009.
4. Question groups present several questions under one heading on one screen, with individual required flags and validation.
5. Classic-page progress and validation follow RESP-025; grouped progress counts each grouped question.
6. No respondent layout exposes builder or operator controls.
7. Question groups include the optional media of FIELD-005 and statement blocks of FIELD-011 and FIELD-018.

**Evidence.** `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “a sessionless direct flow presents one accessible screen at a time and reaches immutable completion”
**Gap.** Missing a cited journey through classic pages and grouped questions that checks each layout, shared conditions, validation and progress. Cited public-flow journey covers one-question screens only.

#### RESP-002 — Truthful progress

Core · published · **partial**

**Requirement.** Respondent progress describes the reachable path for the answers already given.

**Acceptance.**
1. The page shows the current question position and remaining reachable questions; classic layout shows the current page and remaining reachable pages instead.
2. Branching recomputes that count, excluding skipped and unreachable questions.

**Evidence.** `tests/e2e/question-progress.spec.ts`
**Gap.** Missing a cited classic-page journey that checks current and remaining reachable pages. The cited progress journey covers question counts only.

#### RESP-003 — Explicit and validated answers

Core · published · **partial** · From RESP-003 · Cites BASE-INPUT-001

**Requirement.** Respondents supply explicit values for the published question and its configured limits, following FLOW-019.

**Acceptance.**
1. Every question begins unanswered; false yes/no answers and zero scores or numbers count only after explicit selection or entry.
2. Rating, priority and choice questions begin unselected and require affirmative respondent selection.
3. Required fields show Required and expose required semantics.
4. An unanswered required question or invalid answer stays on screen with a field-specific error and creates no response.
5. Choosing Other requires its text even when the question is optional; empty or whitespace-only text shows “Please specify your Other answer.” and creates no response.
6. Configured Other-text validation applies in the browser and API, and None is exclusive.
7. The server accepts only values permitted by the published question type and configured limits.

**Evidence.** `tests/e2e/new-question-types.spec.ts`, `tests/e2e/question-accessibility-foundation.spec.ts`, `tests/e2e/question-progress.spec.ts`
**Gap.** Missing a journey in the old cited evidence that exercises Other-text validation in browser and API and exclusive None choices. Cited one-question journeys prove ordinary types, explicit selection and required refusals; the covering Other journey is outside this old Evidence set.

#### RESP-025 — Reachable validation and answer progress

Core · published · **partial** · From RESP-003

**Requirement.** Progress and validation follow the current visible path in each respondent layout.

**Acceptance.**
1. In one-question and grouped layouts, progress is the share of reachable questions answered validly or deliberately skipped when optional; remaining includes every unfinished reachable question.
2. Classic pages count reachable pages, validate only visible questions and never let a hidden required question block progress.
3. Skipping never creates an answer.

**Evidence.** `tests/e2e/new-question-types.spec.ts`, `tests/e2e/question-accessibility-foundation.spec.ts`, `tests/e2e/question-progress.spec.ts`
**Gap.** Missing a cited journey for grouped-question progress and classic-page hidden-required validation and page progress. The cited progress journey covers one-question progress only.

#### RESP-004 — Back navigation

Core · published · **done**

**Requirement.** A respondent can revisit earlier screens and change an answer without retaining data from an abandoned branch.

**Acceptance.**
1. Back opens a screen already visited in the current session and permits editing its answer.
2. Changing an answer recomputes the forward path and progress.
3. Answers belonging to newly unreachable steps are discarded before final validation, export or analysis.

**Evidence.** `tests/e2e/journey.spec.ts` — "an operator builds and previews an adaptive form, a respondent changes branches, and the report retains only final reachable answers"; `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers"
**Gap.** None.

#### RESP-005 — Privacy disclosure

Core · published · **partial**

**Requirement.** Before answering, respondents can understand the form’s purpose, identity mode and onward use of answers.

**Acceptance.**
1. Before the first answer, the form states why feedback is requested, whether the response is anonymous or identified, who can see individual answers, and every configured external and data category that may receive answers.
2. The selected identity policy cannot suppress or weaken that disclosure; public links default to anonymous and invited responses are identified.
3. An identified publication records the chosen mode on its revision. Identifying hidden values from a public link are typed, link-supplied and unverified, and the disclosure explains the values received and the implications of forwarding the link.
4. Identifying links obey RESP-028’s revision binding and fixed-value rules.

**Evidence.** `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/analysis-safety.worker.test.ts`
**Gap.** Missing a cited disclosure journey that reads the stated purpose, viewers and each configured external/data category before answering. The cited journey checks invitation identification; the analysis-safety journey checks provider payload minimization rather than the respondent disclosure.

#### RESP-006 — Anonymous means anonymous

Core · published · **partial** · Cites BASE-PUBLIC-001

**Requirement.** Anonymous collection retains a response without deriving respondent identity from transport or contact records.

**Acceptance.**
1. An anonymous response has no contact or participant link, no name or email copied from an invitation, contact or session, no raw IP address and no host-page identifier.
2. Its random response ID cannot be reversed to identify the respondent and is not linked to expiring rate-limit or session state.
3. A name or email knowingly typed as an answer remains only that answer and creates no contact or participant.
4. Before answering, RESP-005’s disclosure explains that such an identifying answer will identify the respondent to the operator.

**Evidence.** `tests/runtime/distribution.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`
**Gap.** Missing an anonymous-collection journey through the public HTTP or browser door that reads the retained anonymous identity and the disclosure for a typed identifying answer. Both cited Worker files use foundationFixture service calls for this behavior; their data assertions remain useful lower-level evidence.

#### RESP-007 — Atomic final submission

Core · published · **partial**

**Requirement.** Final submission commits the completed response and its required effects as one indivisible admission.

**Acceptance.**
1. The completed response, every answer, count change and durable command for each required downstream effect commit together.
2. No downstream effect is dispatched before that transaction commits.

**Evidence.** `tests/e2e/journey.spec.ts`, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited final-submit rollback journey that fails the transaction and proves no response, answer, count or effect remains. The cited browser journey covers normal commit and retry; the covering failure journey is in tests/runtime/journey.worker.test.ts, which this old Evidence cell does not cite.

#### RESP-008 — Admission per invitation

Core · published · **partial**

**Requirement.** An invitation follows the response-admission rule recorded for it.

**Acceptance.**
1. An invitation admits only the completions its recorded rule permits.
2. A visit beyond that allowance shows the existing completion state and creates no further response.
3. No rule admits a completion after RESP-009 admission closure.
4. The configurable default is one completion per invitation; anonymous direct links allow independent completions.

**Evidence.** `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts`
**Gap.** Missing a cited public-door journey that attempts an over-quota or closed invitation completion and confirms no additional response. The cited distribution Worker journey covers concurrency through services; the browser journey checks invitation receipt and reload.

#### RESP-009 — Concurrent closure

Core · published · **done**

**Requirement.** Final admission resolves concurrent submissions against the form’s actual remaining capacity.

**Acceptance.**
1. Final submission rechecks deadline, target and manual closure in the same admission transaction.
2. A submission that loses the last available place sees the standard closed page naming the business and form, and creates no response.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "rechecks manual closure and deadline inside final admission; losers receive a named closed outcome with no saved response"; `tests/runtime/journey.worker.test.ts` — "admits only one released completion at a target of one, while retaining its replay after automatic closure"
**Gap.** None.

#### RESP-010 — No silent partials

Core · published · **partial**

**Requirement.** Pencil retains incomplete answers only when the respondent explicitly chooses save and resume under PART-002.

**Acceptance.**
1. Answers in an abandoned or reloaded session are not visible to operators, included in results, exported as responses or counted as completions.
2. A respondent-chosen save retains answers separately for resume and does not expose them to operators, completed results, analysis or default response exports.
3. Only final submission creates completed response data.

**Evidence.** `tests/runtime/foundation.worker.test.ts`, `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited explicit-save journey that checks saved partial answers stay unavailable to operators, completed results, analysis and default exports. The cited files prove ordinary abandoned-session isolation, not the PART-002 saved exception.

#### RESP-011 — Completion

Core · published · **done**

**Requirement.** A successful submission reaches the completion screen published for that response.

**Acceptance.**
1. The respondent sees the published completion screen only after successful submission.
2. The ordinary public form link cannot edit the completed response; optional editing follows RESP-021.

**Evidence.** `tests/e2e/public-flow.spec.ts` — "direct and embedded respondents complete the same accessible flow without an operator session"
**Gap.** None.

#### RESP-012 — Submission retry

Core · published · **done** · Cites BASE-OPS-003

**Requirement.** Retrying one completed submission returns its recorded receipt instead of creating another effect.

**Acceptance.**
1. The submission key is scoped to one respondent session and published revision and retained with the completed response.
2. Retry returns the same response ID and completion screen, without incrementing counts or dispatching downstream effects twice.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "retains the committed completion across changed-answer retries, pinned revisions and removal of the session"
**Gap.** None.

#### RESP-013 — Session metrics

Core · published · **partial** · Cites BASE-DATA-002

**Requirement.** The first respondent interaction creates limited, expiring session state for the form’s collection metrics.

**Acceptance.**
1. Session state contains only an opaque session ID, revision ID, source, start time, furthest-reached stable step ID, coarse mobile/tablet/desktop class and FIELD-006 choice/block presentation identities.
2. It contains no answers, contact identity, raw IP, user-agent string or host identity.
3. The session pins the revision and supplies starts, drop-off, device and completion-time metrics.
4. Abandoned sessions expire after the documented retention period, and RESP-019 preserves only their aggregate metrics.

**Evidence.** `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts`, `tests/runtime/transition.worker.test.ts`
**Gap.** Missing a cited journey that reads FIELD-006 stable choice/block presentation identities and the complete session-only field boundary through the public door. Cited HTTP journeys prove pinning, expiry and metrics; the session-privacy assertions use services and the presentation-order outcome is not exercised.

#### RESP-014 — Submit failure

Core · published · **done**

**Requirement.** A failed final submission keeps the respondent’s work available for a safe retry.

**Acceptance.**
1. A final request that did not commit leaves the respondent off the completion screen and preserves the current in-browser answers.
2. A visible, retryable error lets the respondent retry with the original submission key.

**Evidence.** `tests/e2e/journey.spec.ts` — "an operator builds and previews an adaptive form, a respondent changes branches, and the report retains only final reachable answers"; `tests/runtime/journey.worker.test.ts` — "rolls a failed final transaction back completely and commits one original-key retry without partial answers or effects"
**Gap.** None.

#### RESP-015 — Owned abuse defenses

Core · published · **partial** · Cites BASE-ACCESS-003, BASE-PUBLIC-001

**Requirement.** Pencil checks public submissions using defenses the installation owns; the operating rules document the limits and signed load-time mechanism.

**Acceptance.**
1. Every submission checks a hidden honeypot, the documented minimum elapsed time from form load, and a submission token bound to the respondent session.
2. Elapsed time comes from the signed, non-identifying form-load timestamp, with no visitor identity or server-side view record linked to it.
3. A missing or unrecognized session token produces a visible retryable error naming the expired session; the response is never silently discarded.
4. Honeypot and minimum-time submissions retain their reasons and answers under RESP-016 and RESP-017 for review and reversal under RESP-018.

**Evidence.** `tests/e2e/public-rate.spec.ts` — “public request and final submission limits refuse excess traffic without retaining invalid answers and recover after expiry”, `tests/runtime/journey.worker.test.ts`, `tests/runtime/transition.worker.test.ts`
**Gap.** Missing a cited journey exercising signed load timing and honeypot admission, retention and reversal through the public door. The cited journey and transition files cover session credential failures and minimum-time quarantine, not the honeypot/load-time matrix; tests/runtime/traffic.worker.test.ts has that journey but is absent from this old Evidence cell.

#### RESP-016 — Retained bot exclusions

Core · published · **done** · From RESP-016 · Cites BASE-OPS-005, BASE-AUDIT-001

**Requirement.** A honeypot submission remains recoverable in quarantine while staying outside accepted collection.

**Acceptance.**
1. A filled honeypot produces the ordinary completion screen and atomically retains every answer with the honeypot reason in quarantine.
2. An excluded response changes no accepted-response count, admission check, result, analysis evidence set, notification or other downstream effect.
3. Exclusion and reversal leave anonymous view and start counters unchanged.
4. An operator can read the reason and answers and reverse a false positive under RESP-018, after which it counts as an ordinary completed response.
5. The exclusion audit identifies the defense and revision without answer text or respondent identity.
6. Exclusion creates no visitor identity or server-side view record; the retained response follows DATA-002 erasure and its form’s retention rules.

**Evidence.** `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"; `tests/e2e/traffic-review.spec.ts` — "an operator reviews and releases a retained bot exclusion without changing views or starts"
**Gap.** None.

#### RESP-026 — Exporting automated exclusions

Core · published · **done** · From RESP-016

**Requirement.** Automated-exclusion exports are an explicit option separate from quarantine review and accepted results.

**Acceptance.**
1. Default exports omit honeypot and minimum-time exclusions.
2. An operator may explicitly include them; each included response is marked quarantined with its exclusion reason.
3. Inclusion keeps the same filter and cutoff, changes no accepted count or downstream effect, and does not release the response.

**Evidence.** `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"; `tests/e2e/traffic-review.spec.ts` — "an operator reviews and releases a retained bot exclusion without changing views or starts"
**Gap.** None.

#### RESP-017 — Retained minimum-time exclusions

Core · published · **partial**

**Requirement.** A submission failing only the minimum elapsed-time check is retained for review rather than lost.

**Acceptance.**
1. The signed load-time check commits every answer with the minimum-fill-time reason in quarantine under RESP-007.
2. An excluded response stays outside completed counts, admission checks, results, analysis evidence and notifications.
3. Response exports follow RESP-026’s default omission and explicit-inclusion rules.
4. An operator can read and reverse a false positive under RESP-018, making it an ordinary completed response.
5. Exclusion and reversal leave view/start counters unchanged and create no visitor identity or server-side view record.
6. The retained response follows its form’s retention and DATA-002 erasure rules.

**Evidence.** `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited journey that reads the minimum-fill-time reason and all retained answers before release and checks the full exclusion boundary, including unchanged view/start counters. The cited journey covers held completion, export omission, release and deletion; the fuller traffic journey is not in the old Evidence cell.

#### RESP-018 — Quarantine review

Core · published · **partial** · Cites BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Operators can inspect and resolve each quarantined response.

**Acceptance.**
1. The revision’s quarantine list shows every held response’s answers and the defense that held it.
2. An operator can release or delete each response; deletion follows DATA-002.
3. Release makes it an ordinary completed response at that moment and recomputes every affected count, rate and result.
4. Release works after admission closure and records the acting operator and time without reopening admission or retriggering its deadline or target.
5. A response leaves quarantine only through an explicit resolution; when an agent resolves it, the call carries standard for release or destructive for irreversible deletion, and the company’s policy decides the disposition.

**Evidence.** `tests/runtime/journey.worker.test.ts`
**Gap.** Missing a cited quarantine-list journey that reads each held answer and defense and observes every affected rate/results value after release while admission remains closed. The cited journey does not read the quarantine list; it proves release/delete persistence and counts.

#### RESP-019 — Retained flow metrics

Core · published · **done**

**Requirement.** Collection keeps historical aggregate metrics after private session state expires.

**Acceptance.**
1. On completion or expiry, a session’s start, furthest step, device class and completion outcome fold into per-revision counters.
2. Those counters hold only counts, cannot be traced to a session, response or person, and remain with the revision after session expiry.
3. Every historical starts, drop-off and device figure uses those counters, which contain no partial answer.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "scheduled retention folds abandoned sessions once, preserves active auth and every current persistent entity, and logs counts only"
**Gap.** None.

### Response ledger

#### LEDG-001 — Response ledger

Core · published · **partial**

**Requirement.** Operators can list and open the released completed responses of a form.

**Acceptance.**
1. Every row retains its stable response ID, form revision, source, participant when identified, started/submitted times and each answer keyed by stable step ID.
2. A quarantined response appears only in RESP-018 review until release.

**Evidence.** `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts`
**Gap.** Missing a cited ledger journey that reads the complete retained response record, including stable response ID and started/submitted times, and checks quarantine exclusion with real held data. Cited browser journeys inspect answers, participant and cohort counts, but do not read the complete listed record.

#### LEDG-002 — Collection counts

Core · published · **done**

**Requirement.** Collection counts come from retained collection records rather than delivery or preview activity.

**Acceptance.**
1. Completed-response and participant counts derive from stored completed responses and participants.
2. Starts derive only from RESP-013 sessions and RESP-019 counters.
3. Preview, duplicate submission, failed delivery, abandoned session, dropped submission and unreleased quarantine never increment completed responses.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "quarantines fast submissions, excludes them from reporting, releases exactly once after closure, and erases rejected answers"
**Gap.** None.

#### LEDG-003 — Response filters

Core · published · **done**

**Requirement.** The ledger and its exports use the same selected response identities.

**Acceptance.**
1. Operators can filter by revision, submission time, source, participant status and structured answer.
2. Filtering preserves the response IDs shown in the ledger, exports and supporting evidence.

**Evidence.** `tests/e2e/ledger-filters.spec.ts` — "native and imported typed filters download exact JSON, CSV, LEDG-005 XLSX and SPSS response snapshots with readable decisions and compact rows at both widths"; `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey"
**Gap.** None.

#### LEDG-004 — Response export

Core · published · **partial** · Cites BASE-DATA-001

**Requirement.** An operator can download a fixed selection of responses as lossless CSV or JSON.

**Acceptance.**
1. Starting the export fixes its filter and evidence-cutoff time.
2. Default exports contain exactly the matching released responses committed by that cutoff, including response/revision IDs, source, timestamps, stable step IDs/labels and lossless values for every answer, including open text.
3. Quarantined and excluded responses stay out until release, and the export states how many were excluded.
4. RESP-026’s explicit automated-exclusion option is the sole exception: included responses are marked with their exclusion reasons and obey the same filter/cutoff without release, changed accepted counts or downstream effects.

**Evidence.** `tests/e2e/journey.spec.ts`, `tests/e2e/ledger-filters.spec.ts`, `tests/e2e/new-question-types.spec.ts`
**Gap.** Missing a cited journey for the explicit automated-exclusion inclusion option, marked reasons and unchanged accepted counts/effects. The cited browser journeys prove ordinary exports; tests/e2e/traffic-review.spec.ts covers the option but this old Evidence cell does not cite it.

### Results

#### RSLT-001 — Response summary

Core · published · **partial**

**Requirement.** Every published revision has a results view independent of AI analysis.

**Acceptance.**
1. Question-answer summaries appear before session metrics.
2. The current combined revision/response filters govern completed responses, starts, completion rate and average completion time, each shown beside its underlying counts.
3. Imported completions contribute to answer summaries and completed counts but never native starts, completion-rate numerators or duration samples; their count is stated separately.
4. The view is available from publication, shows zeros before the first session and does not wait for analysis.
5. Operators with response access keep complete summaries beside a suppressed crosstab; aggregate-only reports apply RSLT-015/RSLT-016 to crosstabs without suppressing answer summaries.

**Evidence.** `tests/runtime/journey.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/reporting-bounded.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts`, `tests/e2e/reporting-counts.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts` (line 10)
**Gap.** The published-revision selector and response filters share one response scope across summary, answer summaries, device split, ledger and exports. Native starts, rate numerator/denominator, duration total/sample count, completed and imported counts are stated beside the values. All-revision answers retain their published question versions. Zero, quarantine/release, erasure and imported exclusions remain factual; no AI run is required. Gap: all-published-revision average completion time with unequal per-revision durations has no independently computed public-door assertion.

#### RSLT-002 — Drop-off by question

Core · published · **partial**

**Requirement.** Results preserve per-question collection reach and drop-off after session expiry.

**Acceptance.**
1. Every published step shows how many sessions reached it and how many reached no later step.
2. The figures use RESP-019 counters and remain readable after the sessions expire.
3. A never-reached step is shown with zero rather than omitted.

**Evidence.** `tests/e2e/answer-results.spec.ts`, `tests/e2e/imported-results.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts`
**Gap.** Missing a cited journey that expires a real abandoned session and reads the retained per-step reached/drop-off report afterward, including zero-reached steps. Cited browser reports show ordinary native answers and historical zero telemetry; tests/runtime/transition.worker.test.ts exercises expiry but is absent from this old Evidence cell.

#### RSLT-003 — Stated denominators

Core · published · **partial**

**Requirement.** Every results and analysis percentage identifies the population it measures.

**Acceptance.**
1. Each percentage names its numerator, denominator and filtered set; changing a filter changes both together.
2. Single-answer distributions divide by responses that answered the question and their parts sum to that denominator.
3. Multiple-choice distributions use that same denominator, are labeled multiple-select and may exceed one hundred percent in total.
4. A response-only filter shows started-to-completed within filtered responses and states that view-based rates are unfiltered; revision/date-only views use views.
5. Imported history never enters native starts, completion numerators or durations.
6. Completion is kept distinct from per-question answer rates.

**Evidence.** `tests/runtime/journey.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/reporting-bounded.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts`, `tests/e2e/reporting-counts.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts` (line 10)
**Gap.** Response filters use matching native released and quarantined response starts for started-to-completed; the screen states that view-based rates are unfiltered by response filters. Revision/date-only selections use the matching view counters. Numerator and denominator, duration total and samples, imported exclusions and per-question answered denominators are named; clearing a response filter restores the view basis. Gap: CSAT and thumbs-up score-trend percentages have no public-door assertion of their displayed numerator and denominator labels. The answer-share trend, zero-denominator states, unequal started-to-completed rate, date-only scope, multiple-select label and single-answer bucket sums are asserted by the existing results journeys.

#### RSLT-004 — Device split

Core · published · **partial** · Cites BASE-DATA-003, BASE-ROLE-001

**Requirement.** Results present only coarse device classes and keep their response-export boundary, including RL-104’s archive exception.

**Acceptance.**
1. Device shares follow the combined revision and response filters, with the numerator and denominator stated under RSLT-003.
2. A coarse mobile, tablet or desktop class is derived at session start and linked to its response for filtering; revision-wide unlinked session counts do not satisfy a filtered split.
3. No fingerprint is retained; the class erases with its response and historical missing classes remain honestly unknown.
4. Device class is excluded from every response export.
5. Under RL-104, its sole archive exception is the private integrity-checked whole-installation restore archive of DATA-001; restoration preserves erasure fences and applies current authority.

**Evidence.** `tests/runtime/journey.worker.test.ts` — "retains factual zero, quarantine, release and erasure summaries and matching dashboard counts"; `tests/runtime/distribution.worker.test.ts`; `tests/runtime/retention-schedule.worker.test.ts`; `tests/runtime/upgrades.worker.test.ts` — "retains the representative legacy rows, graph relationships, and idempotency behavior declared by the predecessor fixture"; `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"; `tests/e2e/answer-results.spec.ts`; `tests/e2e/ledger-filters.spec.ts` (1440/390)
**Gap.** Coarse session-start class is copied only on admitted commit, preserved under unpaid replacement, filterable through the shared response selection and erased with the response. Historical classes are unknown. Filtered device shares name native-response denominators; imported completions and unlinked open/abandoned sessions are separate. Unfiltered shares name session starts. No class enters CSV/JSON response records; DATA-001 portable archives carry the response column for restoration.  Gap: the current archive importer requires the same committed migration inventory; restoration of an older pre-device archive has not been proved with its original trusted controller. RSLT-001/RSLT-003 summary integration remains their own target.

#### RSLT-005 — Results across revisions

Core · published · **done**

**Requirement.** Cross-revision reporting compares questions only within the revisions that actually contained them.

**Acceptance.**
1. Each question uses the responses that could have answered it as its denominator.
2. A question added later is never treated as unanswered by earlier responses.
3. Different stable step IDs never merge, even when their labels match.

**Evidence.** `tests/e2e/revision-comparison-http.spec.ts` — "native revision comparison keeps absent questions, containing-revision cohorts and historical labels distinct"
**Gap.** None.

#### RSLT-012 — Open-text coding

Core · published · **partial** · Cites BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Operators can organize open text with workspace codes, manual assignments and exact-excerpt AI suggestions.

**Acceptance.**
1. A person can assign codes, accept a suggestion citing the exact retained excerpt or reject it; a rejected suggestion creates no assignment.
2. Code assignments retain who or what made them and drive charts, filters and code crosstabs.
3. Coding twenty answers manually and twenty by accepted suggestions yields the correct counts and filters with no code from rejected suggestions.
4. Agent code-assignment decisions carry standard, adding sensitive for regulated personal data; the company’s policy decides their disposition.
5. Raw-authorized operator panels stay complete; aggregate-only code crosstabs obey RSLT-015/RSLT-016, including the refusal fixture.

**Evidence.** `src/core/features/coding/`, `tests/runtime/coding.worker.test.ts`, `tests/e2e/coding.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Missing the aggregate-only code-crosstab disclosure/refusal journey and the company-policy journey for standard/sensitive agent coding decisions. Cited old journeys prove the raw-authorized operator’s manual and accepted/rejected AI suggestion workflows, chart/filter/export and unsafe refusals.

### Analysis

#### ANLY-001 — Analysis run

Core · published · **partial**

**Requirement.** Operators can request analysis for any published revision with completed responses.

**Acceptance.**
1. The requested run is durably queued and exposes queued, running, completed, insufficient-evidence or failed state.
2. The configurable autorun policy starts analysis when a form closes with at least five completed responses by default.

**Evidence.** `tests/e2e/analysis.spec.ts`, `tests/runtime/analysis-run.worker.test.ts`
**Gap.** Missing a cited close-time autorun journey and a running-state observation for the full queued/running lifecycle. Cited analysis-run and browser journeys cover requested completed/insufficient/failed runs; feedback-attention has queued/running observations but is absent from this old Evidence cell.

#### ANLY-002 — Fixed evidence set

Core · published · **done**

**Requirement.** An analysis keeps the exact collection evidence it read.

**Acceptance.**
1. It records the exact response IDs and revision and reads only released responses.
2. Later submissions or quarantine releases are excluded from that run and mark the completed analysis stale instead of changing it in place.

**Evidence.** `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing"; `tests/runtime/analysis-safety.worker.test.ts` — "only the selected answers and stable response IDs leave, to the configured origin with the key as a bearer value, and every call records its usage and cost"
**Gap.** None.

#### ANLY-003 — Findings

Core · published · **done**

**Requirement.** A completed analysis presents ranked findings from its fixed evidence set.

**Acceptance.**
1. It ranks themes and selects one primary finding.
2. Insufficient-evidence runs follow ANLY-013 instead.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run"
**Gap.** None.

#### ANLY-004 — Exact evidence

Core · published · **done**

**Requirement.** Analysis distinguishes retained respondent words from generated interpretation.

**Acceptance.**
1. Every respondent quote is an exact excerpt of a stored answer.
2. Generated paraphrases and summaries are labeled analysis and never quoted or attributed as a respondent’s words.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run"
**Gap.** None.

#### ANLY-005 — Disclosure threshold

Core · published · **done**

**Requirement.** Analysis presentation protects cohorts below its configured disclosure threshold.

**Acceptance.**
1. A theme or filtered segment below threshold reveals no raw excerpt, participant identity, unique field combination or breakdown; exactly the threshold is permitted.
2. The configurable default is five completed responses in the theme or current filter cohort.
3. Suppression affects presentation, not the operator’s raw ledger or export.
4. RSLT-014 crosstabs and RSLT-015/RSLT-016 aggregate reports use the same threshold under their own rules; an authorized operator’s own summaries, ledger and exports remain complete.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run"
**Gap.** None.

#### ANLY-006 — Recommendations

Core · published · **done**

**Requirement.** A sufficient analysis can identify one primary action supported by its findings.

**Acceptance.**
1. The recommendation includes rationale, linked findings, confidence, expected impact and effort.
2. An insufficient-evidence run proposes no action.
3. The configurable selection policy defaults to the action supported by the highest-impact finding with sufficient evidence.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "a sufficient run proposes one primary action, and turning it into an action records the analysis without contacting anyone"; `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"
**Gap.** None.

#### ANLY-007 — Staleness

Core · published · **done**

**Requirement.** A stale analysis remains available as an historical record of its original evidence.

**Acceptance.**
1. It stays readable and shows its evidence cutoff.
2. Operators can request a new analysis while prior runs remain in history, except for DATA-002 erasure redaction.

**Evidence.** `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing"
**Gap.** None.

#### ANLY-008 — Provider failure

Core · published · **done**

**Requirement.** Unavailable analysis never fabricates a result or stops ordinary form collection.

**Acceptance.**
1. An unconfigured or failed provider marks the analysis or builder-assistance request failed with its error and retry action.
2. No suggestion, finding or recommendation is invented.
3. Form publication, response collection, ledger and exports continue working.

**Evidence.** `tests/runtime/analysis-safety.worker.test.ts` — "an unconfigured or failing provider fails the request with its error and a retry action while collection keeps working; a transient transport failure is retried at most three times within ten minutes with the same request and a schema failure is never retried"; `tests/runtime/feedback-rewrites.worker.test.ts` — "rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run"
**Gap.** None.

#### ANLY-009 — Builder assistance

Core · published · **partial** · Cites BASE-AGENT-006, BASE-AGENT-007

**Requirement.** Operators can request sharper, broader or contextual draft-question wording while preserving the original text. Agent changes carry their class and follow the company’s policy.

**Acceptance.**
1. A suggestion shows the source wording and the proposed rewrite.
2. An operator can accept or reject the proposal; a stale version cannot overwrite a later draft edit and publication remains a separate action.
3. An agent’s application of wording carries standard; a publication that exposes a form outside the business carries external. The company’s policy decides whether either call runs, is reviewed, waits or is refused.

**Evidence.** `tests/runtime/feedback-rewrites.worker.test.ts`
**Gap.** Missing the class-and-company-policy journey for agent wording application and external publication. Old cited evidence proves the held human workflow only; it does not compute the standard/external classes or run the all-autonomous company policy.

#### ANLY-010 — AI usage and cost

Core · published · **done**

**Requirement.** Operators can inspect the usage and cost of analysis and builder-assistance calls.

**Acceptance.**
1. Each call records provider, model, input/output usage, feature, analysis or draft ID and reported cost.
2. The usage view totals calls and cost by day and feature.

**Evidence.** `tests/runtime/analysis-safety.worker.test.ts` — "only the selected answers and stable response IDs leave, to the configured origin with the key as a bearer value, and every call records its usage and cost"; `tests/runtime/feedback-rewrites.worker.test.ts` — "rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution"
**Gap.** None.

#### ANLY-011 — Evidence provenance

Core · published · **done**

**Requirement.** Operators can follow analysis figures and excerpts back to the retained evidence that supports them.

**Acceptance.**
1. Each displayed theme count, percentage, supporting excerpt and recommendation records its included response IDs.
2. Navigating from displayed evidence opens those retained responses.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run"
**Gap.** None.

#### ANLY-012 — Output validation

Core · published · **done** · Cites BASE-INPUT-001

**Requirement.** Provider output must agree with the analysis’s fixed evidence before the run can complete.

**Acceptance.**
1. Pencil checks the output schema and that every cited response belongs to the evidence set.
2. Quote ranges match stored answers exactly, and counts/percentages are recomputed from that evidence.
3. Any failed check marks the run failed.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"
**Gap.** None.

#### ANLY-013 — Insufficient evidence

Core · published · **done**

**Requirement.** Analysis can truthfully report that its evidence cannot support a finding.

**Acceptance.**
1. Insufficient evidence or insufficient disclosure-eligible cohorts produce an insufficient-evidence outcome.
2. The outcome shows the evidence cutoff and reason and emits no theme, quote or recommendation.

**Evidence.** `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing"
**Gap.** None.

#### ANLY-014 — Untrusted evidence

Core · published · **done** · Cites BASE-AGENT-005

**Requirement.** Respondent text remains evidence rather than instructions to the analysis or its adapters.

**Acceptance.**
1. Respondent text cannot change system instructions/configuration, select tools, call adapters, create jobs or authorize effects.
2. Provider output that violates the required schema fails under ANLY-012.

**Evidence.** `tests/runtime/analysis-safety.worker.test.ts` — "instructions planted in answers change nothing: a tool call or webhook-shaped answer fails, and no task, job, policy or setting changes"
**Gap.** None.

#### ANLY-015 — Analysis and report policy snapshots

Core · published · **partial**

**Requirement.** Historical analysis and saved aggregate reports retain the disclosure policy bound to them.

**Acceptance.**
1. Each analysis stores the evaluated disclosure and recommendation-selection configuration.
2. A later policy change applies to a new analysis and never reveals or reinterprets historical output retroactively.
3. A saved/shared aggregate view records its threshold at save/share and uses a threshold never below that record under RSLT-015/RSLT-016.
4. Lowering the current policy reveals nothing in that saved/shared view; the operator’s current-threshold results page does not require saved-view snapshots.

**Evidence.** `tests/runtime/analysis-run.worker.test.ts`
**Gap.** Missing the saved/shared aggregate-view snapshot journey retained by RSLT-009. Cited analysis-run journey proves analysis snapshots only; it does not create a saved/shared aggregate view or lower policy and read that view.

#### ANLY-016 — Provider retry

Core · published · **done**

**Requirement.** Transient analysis transport errors retry the original request without changing its evidence or policy.

**Acceptance.**
1. A transient provider failure retries at most three times over ten minutes, preserving request, evidence set and policy snapshot.
2. Schema and evidence-validation failures are terminal and never retried as transport failures.

**Evidence.** `tests/runtime/analysis-safety.worker.test.ts` — "an unconfigured or failing provider fails the request with its error and a retry action while collection keeps working; a transient transport failure is retried at most three times within ten minutes with the same request and a schema failure is never retried"
**Gap.** None.

### Actions and measurement

#### ACT-001 — Action record

Core · published · **partial**

**Requirement.** An operator can turn an analysis recommendation into owned work.

**Acceptance.**
1. The action retains title, rationale, owner, target metric, review date and links to the analysis and its evidence.
2. Accepting the action does not itself contact an external service.

**Evidence.** `tests/e2e/actions.spec.ts`
**Gap.** Missing a journey in the cited evidence that accepts an analysis recommendation and reads the resulting analysis/evidence links and action fields. The cited actions browser journey creates a manual action; tests/e2e/analysis.spec.ts covers recommendation acceptance but is absent from this old Evidence cell.

#### ACT-002 — Action lifecycle

Core · published · **done**

**Requirement.** Actions have an explicit lifecycle with attributed transition history.

**Acceptance.**
1. A new action starts planned.
2. Planned can move to in progress or closed; in progress to ready for review or closed; ready for review to effective, ineffective, in progress or closed; effective/ineffective to closed.
3. Each transition records its operator, time and optional outcome note.

**Evidence.** `tests/runtime/actions-lifecycle.worker.test.ts` — "the server enforces the lifecycle: every legal move is recorded, every illegal move answers 409 and changes nothing"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due"
**Gap.** None.

#### ACT-003 — External task

Core · published · **done** · Cites BASE-OPS-003

**Requirement.** The configured task destination creates or returns one remote task for a Pencil action.

**Acceptance.**
1. Repeated activation or delivery uses the action’s same key and returns the existing remote task ID.
2. Retry never creates a second remote task for that action.

**Evidence.** `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due"
**Gap.** None.

#### ACT-004 — Task failure

Core · published · **done** · Cites BASE-OPS-004

**Requirement.** Task delivery problems remain visible without losing local work.

**Acceptance.**
1. An unconfigured task connection makes external task creation unavailable with setup guidance.
2. A failed call retains the local action, records the attempt/error and offers a same-key retry.

**Evidence.** `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/runtime/actions-task.worker.test.ts` — "with no adapter configured the external task is unavailable and the action works; redirects are not followed and a plain http URL is refused outside the dev and test runtimes"
**Gap.** None.

#### ACT-005 — Follow-up measurement

Core · published · **partial** · Cites BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Actions retain comparable measurements and a separate attributed outcome decision.

**Acceptance.**
1. An action records metric name, unit, desired direction, baseline value, source and observation time.
2. An operator can link a later form or analysis and record the comparable observed value and time.
3. Effective/ineffective is a separate decision: recording a measurement or passing a review date never sets or changes the verdict as a side effect.
4. A past review date is surfaced on the action for resolution.
5. An agent’s verdict call carries commitment and the company’s policy decides its disposition; attribution follows the actor who made the decision.

**Evidence.** `tests/e2e/actions.spec.ts`, `tests/runtime/actions-measurement.worker.test.ts`
**Gap.** Missing a cited class-and-company-policy journey for an agent’s commitment-class verdict decision. Existing cited journeys prove the separate human decision and no verdict from measurement or overdue date, not policy-driven agent decisions.

#### ACT-006 — Exact task payload

Core · published · **partial** · Cites BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008

**Requirement.** An external task binds the exact action payload being sent, without raw response content.

**Acceptance.**
1. The product shows the action fields and authenticated report link that would leave the installation.
2. A person can confirm that displayed payload; the sent values equal that confirmed revision and changed values require a new decision.
3. Raw answers and excerpts are never included.
4. An agent’s send carries external and the company’s policy decides the disposition, without treating an agent-provided flag as a person’s confirmation.

**Evidence.** `tests/e2e/actions.spec.ts`, `tests/runtime/actions-task.worker.test.ts`
**Gap.** Missing a cited external-class agent-send journey under company policy, including the autonomous policy without a person confirmation and truthful handling of person-confirmation flags. Existing cited journeys prove the human-confirmed task payload only.

#### ACT-007 — Task delivery state

Core · published · **done** · Cites BASE-AUDIT-001

**Requirement.** Operators can follow an external task’s recorded delivery attempts.

**Acceptance.**
1. Delivery shows pending, confirmed, unknown or failed, its key, every attempt and the remote task ID when confirmed.
2. An uncertain network result retries with the same key and is never assumed failed or retried with a new one.

**Evidence.** `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/runtime/actions-task.worker.test.ts` — "with no adapter configured the external task is unavailable and the action works; redirects are not followed and a plain http URL is refused outside the dev and test runtimes"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due"
**Gap.** None.

#### ACT-008 — Manual recommendation

Core · published · **done**

**Requirement.** An operator can write a recommendation directly from retained results evidence.

**Acceptance.**
1. The resulting ACT-001 action links a form, published revision and optionally one question, with the displayed result counts frozen at that moment.
2. Its evidence contains no response IDs, answer excerpts or cohort filters.
3. A manually written action has no analysis link; an action accepted from analysis requires that link.
4. All other ACT-001 through ACT-007 requirements still apply.

**Evidence.** `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due"
**Gap.** None.

### Notifications

#### NOTIFY-001 — Analysis attention

Core · published · **done**

**Requirement.** The notification center records each terminal analysis outcome for its intended operators.

**Acceptance.**
1. Manual analysis completion/failure records one notification for the requesting operator.
2. Automatic close-time analysis records one for each unmuted operator.
3. Duplicate queue delivery never duplicates the same notification.

**Evidence.** `tests/runtime/feedback-attention.worker.test.ts` — "terminal attention is scoped and duplicate-safe across manual retries, autoruns, insufficient evidence and interruption; cards retain the latest actual revision and state"
**Gap.** None.

#### NOTIFY-002 — New-response mail

Core · published · **partial** · Cites BASE-MAIL-001

**Requirement.** Each operator chooses immediate, daily or off response notifications for each form.

**Acceptance.**
1. Publication selects Immediately for the publisher only when no preference exists; other operators and existing unrepublished forms default Off.
2. A message uses the saved business identity, names the form and submission time in the workspace zone, and links to the authenticated results ledger.
3. It contains no answer text, respondent identity or access-granting link.
4. A committed released response queues one delivery per opted-in operator with durable attempts, bounded retries and explicit confirmation of uncertain outcomes.
5. Daily delivery follows NOTIFY-003 and keeps its recipient snapshot separate from immediate mail.
6. Payment-form notification waits for PAY-001/PAY-006/PAY-007 payment.

**Evidence.** `tests/e2e/notifications.spec.ts`, `tests/e2e/request-notifications.spec.ts`, `tests/managed-mail.test.ts`
**Gap.** Missing a cited mail journey that reads saved business identity, workspace-zone submission time and the complete operator cohort/default boundary; the cited journeys cover preference controls, request-time once-only delivery and managed-relay retries. PAY-001 gating is also retained but not exercised by this old Evidence set.

#### NOTIFY-003 — Daily digest

Core · published · **done**

**Requirement.** A digest groups one operator’s newly completed responses for one form and local day.

**Acceptance.**
1. It sends at the WS-002 opening hour in the WS-001 zone and covers completions committed since the previous digest.
2. One operator/form/day produces one digest; an empty day sends nothing.
3. A failed digest retries under DIST-006 with its original day rather than merging into the next day.
4. Payment-form digest admission waits for PAY-001/PAY-006/PAY-007 payment.

**Evidence.** `tests/runtime/feedback-digest.worker.test.ts` — "Daily freezes independent local-day cohorts, catches missed openings without empty mail, preserves commit recipients and releases, and crosses DST, zone edits and overnight windows once"; `tests/runtime/feedback-digest.worker.test.ts` — "digest retries retain their frozen day and key, unknown requires consent, erasure stops sends and retains anonymous audit facts, and local capture requires a live durable claim"; `tests/managed-mail.test.ts` — "Managed mail uses its assigned sender for sign-in, response notifications and digests, queues rate limits and shows rejected mail to its owner"
**Gap.** None.

#### NOTIFY-004 — No mail loops

Core · published · **partial**

**Requirement.** Outbound form mail cannot turn replies or operator-mail bounces into respondent activity.

**Acceptance.**
1. Notifications, digests, invitations and reminders use the configured no-reply address, or Managed hosting’s assigned verified sender, and are marked auto-generated.
2. Pencil ingests no inbound mail; a reply or vacation response cannot create a response, participant, notification or further outbound message.
3. Operator notification/digest bounce state belongs only to that operator’s mail setting and never marks a participant bounced.
4. Participant bounce state comes only from DIST-008 invitation/reminder delivery.

**Evidence.** `tests/e2e/notifications.spec.ts`, `tests/e2e/request-notifications.spec.ts`, `tests/managed-mail.test.ts`
**Gap.** Missing a cited no-inbound-loop journey that tries a reply/autoresponder and proves zero response/participant/notification/further-mail effects, plus an operator-notification bounce that preserves participant delivery state. Current cited journeys exercise outbound deliveries and preferences, not those unsafe cases.

### Data

#### DATA-001 — Export contents

Core · published · **done** · Cites BASE-DATA-001

**Requirement.** Pencil's portable archive retains its complete product graph as original data, including relationships that connect a response to its collection, evidence and follow-up work.

**Acceptance.**
1. The archive includes every operator, contact, segment, flow, revision, step, branch, participant and delivery attempt; released and quarantined responses and answers retain their state and RESP-019 counters.
2. It includes analyses, evidence links, recommendations, actions, notifications, settings, audit entries and referenced original files.
3. Restoration preserves stable graph, revision, response, evidence, recommendation and action links.

**Evidence.** `tests/contract/data-release.contract.test.ts` — "whole-data archives preserve stable revisions, quarantine, receipts, effects and exact values and refuse unsafe targets"; `tests/contract/data-release.contract.test.ts` — "whole-data owner recovery round-trips a hosted installation and refuses altered migration ledgers"; `tests/contract/data-release.contract.test.ts` — "whole-data recovery preserves import custody, delivery facts, actions, analyses and reporting scope without replay"; `tests/runtime/archive-stream.worker.test.ts` — "native D1 stages bounded writes and atomically publishes all tables, payment states and Stripe IDs included, with exact constraints and concurrent-writer refusal"
**Gap.** None.

#### DATA-002 — Response erasure

Core · published · **partial** · Cites BASE-DATA-003, BASE-OPS-005

**Requirement.** Erasing a Pencil response, directly or through its owning contact, removes its influence from collection and analysis while preserving honest aggregate and delivery history.

**Acceptance.**
1. Erasure revokes and deletes active invitation tokens, removes contact links or anonymizes retained delivery facts, and removes the response's answers, raw excerpts and evidence links from every analysis.
2. Affected aggregates are recomputed or marked unavailable, and affected analyses become redacted and stale.

**Evidence.** `tests/e2e/answer-results.spec.ts`, `tests/runtime/analysis-safety.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts`
**Gap.** A cited journey must attempt response/contact erasure through its protected door with an inadmissible actor or state, see refusal, and read that populated records remain unchanged. Cited journeys prove successful response/contact erasure, recomputation/redaction and stopped sends; the browser Keep response cancellation does not execute a refused destructive request.

#### GOV-003 — Retention schedules

Core · published · **done** · From GOV-003 · Cites BASE-DATA-002, BASE-DATA-003

**Requirement.** Supersedes `BASE-DATA-002` only for a form whose owner opts into a retention schedule; other forms retain Base's retention rule. Pencil schedules deletion of form data with advance notice; legal holds and release are governed by GOV-008.

**Acceptance.**
1. An Admin configures a retention period for responses, partials, uploads, signatures and payment references; deletion applies DATA-002's recomputation, redaction and stale-analysis effects. The installation owner manages the setting and notices until ROLE-001 supplies Admins.
2. The period is a whole number of elapsed 24-hour days from completion, or from a private save's creation; private saves retain their original link expiry.
3. Every deletion receives at least seven days of in-app notice, including data already older than a newly enabled period.
4. Released and quarantined completions, imported-response custody and private PART-002 saves receive the same schedule; FILE-001, SIGN-001, PAY-001/PAY-006 and PART-001 inherit it.
5. A 30-day schedule leaves aged data untouched during notice, then removes it with DATA-002 effects. An unconfirmed, unauthorized or stale setting change is refused without changing the schedule.

**Evidence.** `tests/runtime/retention-schedule.worker.test.ts` — "owner opt-in gives old responses and private saves seven days of notice, hold preserves expiry, and release erases with DATA-002 effects"; `tests/e2e/retention.spec.ts` — "an owner opts into retention, sees advance notice, pauses deletion and releases legal hold"
**Gap.** None.

#### GOV-008 — Legal hold and release

Core · published · **partial** · From GOV-003 · Cites BASE-DATA-002, BASE-DATA-003

**Requirement.** An Admin can hold a form's scheduled deletion and private-save expiry, then release it into a fresh notice period. The installation owner exercises this authority until ROLE-001 supplies Admins.

**Acceptance.**
1. Legal hold preserves released and quarantined completions and private saved responses past their automatic deletion or save-data expiry; it never revives an expired resume link.
2. Releasing hold starts a fresh seven-day notice window before automatic deletion.
3. Manual DATA-002 erasure remains available during hold.
4. The retention page shows the active hold and the notice created on release; settings survive reload on desktop and phone.

**Evidence.** `src/core/features/retention/`, `migrations/core/0052_retention.sql`, `tests/runtime/retention-schedule.worker.test.ts`, `tests/e2e/retention.spec.ts`, `tests/runtime/calculations.worker.test.ts`
**Gap.** A cited journey must open an expired private resume link while legal hold preserves its saved state and observe that the link remains unavailable. The retention journey proves hold preserves expired rows, manual erasure remains available and release creates a fresh seven-day grace before deletion, but never opens the expired link.

### Form imports

#### IMPORT-001 — Reviewed definition

Core · published · **partial** · Register R-5

**Requirement.** Operators review a documented form definition before importing it as an editable Pencil draft.

**Acceptance.**
1. Import creates a new draft with new stable IDs.
2. Before writes, every field, screen and logic action is listed with its source type, imported/changed/unsupported outcome, explicit change and reason.
3. Unsupported logic leaves its affected paths incomplete; native graph validation continues to control publication.

**Evidence.** `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/runtime/form-import.worker.test.ts`
**Gap.** A cited journey must import unsupported logic, inspect that its affected path remains incomplete, then try publication and observe native validation refusal with no revision created. Cited journeys review unsupported items and preview a valid imported branch, but do not exercise that promised incomplete-path publish refusal.

#### IMPORT-002 — Reviewed CSV

Core · published · **partial** · Register R-5

**Requirement.** Operators map and acknowledge response-file changes before any public import is published; interrupted preparation remains private and recoverable.

**Acceptance.**
1. Every CSV column can map to a supported question, timestamp or Skip; every row error is reported.
2. Blank answers stay unanswered, and malformed values or configured capacity excess are refused before commit.
3. Commit requires acknowledgement of every reported change or omission; canceling review creates no job, flow or response.
4. Acknowledgement stores owner-private indexed preparation using bounded database transport.
5. Continue verifies the complete stored fingerprint before publishing any job, form or response.
6. Interrupted preparation can be retried or canceled under current authority; erasure removes retained copies and prevents publication or resurrection.

**Evidence.** `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts`
**Gap.** A cited journey must submit malformed or over-capacity CSV and read every row error/refusal before writes, then interrupt private preparation and exercise changed-authority/erasure refusal without publication or resurrection. Cited browser journeys cover valid review/acknowledgement, untouched native inventory before Continue, reload and completed typed export, but not those promised refusal/custody cases.

#### IMPORT-003 — Historical privacy and pinning

Core · published · **partial**

**Requirement.** Imported completions remain honest historical records, isolated from live collection and later draft changes.

**Acceptance.**
1. Released imported completions retain their original timestamps, remain anonymous, identify their source as imported and retain an immutable revision matching the mapped source.
2. Hidden values and network/IP metadata are discarded before durable planning; original file bytes are not retained, and the omission is disclosed before commit.
3. Import creates no respondent session, contact, mail, outbox event or admission effect.
4. Later draft edits cannot reinterpret historical answers.

**Evidence.** `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts`
**Gap.** A cited journey must edit the imported form after completion and reopen its historical answers to verify they retain the original revision interpretation; it must inspect retained planning/original custody for the promised hidden/network/file-byte discard. Cited browsers show anonymous historical results and source timestamps, but the edited Google journey ends at an undo-conflict alert without reading historical results again.

#### IMPORT-004 — Durable replay and reversal

Core · published · **partial**

**Requirement.** A reviewed Pencil import can resume and reverse from durable custody without losing native edits or requiring the original files. The Base import kit owns source identity, bounded application and undo.

**Acceptance.**
1. Identical files create no duplicate native records; interruption resumes the exact stored safe plan.
2. Undo removes unedited imported records while exact native snapshot guards preserve and report later edits.
3. Completed reversal is idempotent and retains its safe plan and provenance.
4. Published import work resumes and undoes without the original files.

**Evidence.** `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts`
**Gap.** A cited journey must read the edited native form/answers after an unsafe undo is refused, and verify safe plan/provenance remain with idempotent completed reversal. Cited browsers show successful undo and a later-native-edit conflict alert but do not read retained native state after that refusal. tests/runtime/form-import.worker.test.ts has a readback journey outside the old Evidence set.

### Target: roles, sharing and sign-in

#### ROLE-001 — Workspace roles

Core · target · **missing** · From ROLE-001 · Cites BASE-ACCESS-004

**Requirement.** Pencil supports workspace roles. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-001).

**Acceptance.**
1. Each operator holds one role: Owner, Admin, Editor, Analyst or Viewer.
2. Owners and Admins manage operators, installation settings, connections and retention; Editors build, publish and distribute the forms they can access; Analysts read results, run analysis and create actions but cannot edit or publish; Viewers read reports only.
3. Every API route and page checks the role on the server; a refused request names the missing permission and writes nothing.
4. On activation this replaces OPER-001 and the no-roles sentence of OPER-002; the last Owner cannot be removed or demoted.
5. This clause inherits TMPL-002's Admin-only team-template retirement; only Owners and Admins may retire templates.
6. For roles without form-response access, this clause inherits RSLT-009, RSLT-015, RSLT-016's aggregate-only disclosure rule, before it ships.
7. A Worker suite signs in as each role and calls every operator route family (flows, publish, audience, responses, export, analysis, actions, settings, connections), asserting allowed and refused outcomes from one role matrix; Through the browser, shows an Analyst the results but no Publish control.
8. The role matrix includes template retirement, refusing Editors, Analysts and Viewers without changing the template.

**Evidence.** None.
**Gap.** No code yet.

#### ROLE-005 — Workspace roles: For roles without form-response access, it inherits the RSLT-009 aggregate-only fixtu

Core · target · **missing** · From ROLE-001 · Cites BASE-ACCESS-004

**Requirement.** This part of ROLE-001 covers for roles without form-response access, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#role-001).

**Acceptance.**
1. For roles without form-response access, it inherits the RSLT-009, RSLT-015, RSLT-016 aggregate-only fixture: the same figures are refused or complemented identically.
2. A Viewer gets the aggregate-only form and is refused the ledger and export.

**Evidence.** None.
**Gap.** No code yet.

#### ROLE-002 — Per-form access and folders

Core · target · **missing** · Cites BASE-ACCESS-004

**Requirement.** Pencil supports per-form access and folders. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-002).

**Acceptance.**
1. Forms live in folders; an Admin can restrict a folder or form to named operators, and an operator sees, searches, exports and receives notifications only for forms they can access.
2. Access to respondent identity (identified participants, typed email and phone answers, uploads, signatures, payment details) is a separate grant; without it the ledger, exports and integrations show those values masked.
3. This clause inherits LEDG-006, LEDG-008: ledger search matches identity values (identified names and emails, typed email and phone answers) only for operators with the identity grant.
4. For grants without form-response access, this clause inherits RSLT-009, RSLT-015, RSLT-016's aggregate-only disclosure rule, before it ships.
5. Through the public door, restricts a form to one Editor and proves a second Editor gets 404 from its page, results, export and API, and an operator without the identity grant receives masked values in the ledger and CSV.
6. The acceptance also proves: search by an identified email and a typed phone answer returns the response only for an operator with the identity grant.
7. For grants without form-response access, it inherits the RSLT-009, RSLT-015, RSLT-016 aggregate-only fixture: the same figures are refused or complemented identically.
8. A Viewer gets the aggregate-only form and is refused the ledger and export.

**Evidence.** None.
**Gap.** No code yet.

#### ROLE-003 — Single sign-on and provisioning

Core · target · **missing** · Cites BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-SIGNIN-001 · Register R-4

**Requirement.** Pencil supports single sign-on and provisioning. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-003).

**Acceptance.**
1. Owners can require SAML 2.0 or OpenID Connect sign-in through the business identity provider (Okta, Microsoft Entra ID, Google Workspace, JumpCloud or the sibling Auth), map IdP groups to ROLE-001, ROLE-005 roles, and accept SCIM 2.0 provisioning so a deprovisioned user loses every session within one minute.
2. Magic-link sign-in remains the break-glass path for Owners only when SSO is enforced.
3. Through the public door, signs in through a test OIDC provider and a signed SAML assertion, maps a group to Analyst, then a SCIM `active:false` PATCH revokes the session and the next request is refused.

**Evidence.** None.
**Gap.** No code yet.

#### ROLE-004 — Builder collaboration

Core · target · **missing** · Cites BASE-ACCESS-004

**Requirement.** Pencil supports builder collaboration. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-004).

**Acceptance.**
1. Operators with edit access can leave comments on a draft step, mention another operator (who receives an in-app notification), resolve the thread, and see who last saved each step.
2. Concurrent edits stay safe under FLOW-004's version check.
3. Through the browser, has two operators comment and resolve on one step; a stale save by the second is refused with the latest version shown.

**Evidence.** None.
**Gap.** No code yet.

### Target: form design themes

#### BRAND-002 — Form design themes

Core · target · **partial** · From BRAND-002

**Requirement.** Pencil supports form design themes. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#brand-002).

**Acceptance.**
1. An Editor keeps a library of named themes (for example one per campaign or client) and chooses one per form; a new form uses the workspace default theme, which starts from BRAND-001, BRAND-003's accent and logo.
2. A theme sets: a question font and an answer-and-button font, chosen from a bundled set of open-licensed families or an uploaded WOFF2 the owner is licensed to use (size- and signature-checked like BRAND-001, BRAND-003 logos), always served from this installation so BASE-PUBLIC-001 holds; separate #rrggbb colors for questions, answers, buttons, button text and background; a background color or a PNG, JPEG or WebP background image with brightness from −100 to 100 and a focal point; corner style; and, per welcome, question and completion screen, an image or video layout (above the question, beside it on the left or right, or behind it as a full-bleed backdrop) with its own phone layout.
3. The theme applies to preview, direct, embedded, popup and kiosk forms and their completion and closed states, and RESP-020, RESP-027 and NOTIFY-006, NOTIFY-007 emails take its colors.
4. Every text and background pair, measured against the background color and against the background image at its brightness, must reach A11Y-001's 4.5:1 (3:1 for large text, focus indicators and button borders); A11Y-002 refuses publish and names the failing pair and screen.
5. A published revision snapshots its theme under FLOW-008, so editing a theme lists the forms that use it and changes each one only at its next publish.
6. Themes are duplicated, renamed and deleted (deletion is refused while a draft or published form uses the theme), and are carried in deployment exports.
7. This clause inherits TMPL-002: a saved team template retains its chosen per-form theme, and a new form made from it uses that theme.
8. Through the browser, publishes two forms on two themes and asserts, at phone and desktop widths, that each renders its own computed font families, question, answer, button and background colors, background image and brightness, and screen layout, and that every request the respondent page makes is to the installation origin; Through the public door, refuses publish of a theme whose button text is 2:1 against the button and names that pair; editing a theme leaves a published form's revision unchanged until it is republished.

**Evidence.** `src/core/features/brand/brand.ts`, `public/fonts/`, `tests/runtime/brand.worker.test.ts`, `tests/e2e/business-brand.spec.ts`
**Gap.** Named themes, per-form choice, font choice, element colors, backgrounds and layouts do not.

#### BRAND-004 — Form design themes: The journey also saves a themed form as a team template and proves a new form from it

Core · target · **partial** · From BRAND-002

**Requirement.** This part of BRAND-002 covers the journey also saves a themed form as a team template and proves a new form from it keeps that theme.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#brand-002).

**Acceptance.**
1. The journey also saves a themed form as a team template and proves a new form from it keeps that theme.

**Evidence.** `src/core/features/brand/brand.ts`, `public/fonts/`, `tests/runtime/brand.worker.test.ts`, `tests/e2e/business-brand.spec.ts`
**Gap.** Named themes, per-form choice, font choice, element colors, backgrounds and layouts do not.

### Target: templates and generated forms

#### TMPL-001 — Template gallery

Core · target · **partial**

**Requirement.** New form offers a searchable gallery of at least 60 US-business templates that become ordinary editable drafts.

**Acceptance.**
1. Categories include customer feedback, NPS, CSAT, CES, product research, employee engagement/eNPS, event registration, contact/lead capture, orders/payments, job applications, client intake, W-9/vendor onboarding, quizzes and GOV-001 patient intake.
2. Every template previews in the respondent experience and passes FLOW-006 publication; templates using payments, uploads or signatures show required connections before creation.
3. Every gallery template can be created and published without validation errors; a branching template can be found by search, previewed, created and used to collect a response.

**Evidence.** `tests/runtime/first-owner.worker.test.ts` — local first-owner setup preserves identity and requires email proof before inviting an equal operator; `tests/e2e/templates.spec.ts` — “built-in templates each progress from an empty dashboard to publication, response and counted result” — empty dashboard to publication, response and counted result (1440/390)
**Gap.** 75 editable templates in 12 named business categories; native CSAT/CES and 29 branched templates. W-9, quizzes (LOGIC-004), HIPAA intake (GOV-001) and actual payment templates remain unbuilt. Order templates collect requests only; vendor onboarding has no upload or signature. Gallery previews show the first question and a path summary; full respondent previews for every template remain unproved.

#### TMPL-002 — Team templates

Core · target · **done**

**Requirement.** Editors can turn a draft or published form into a reusable workspace template; Admins can retire it. The installation owner exercises Admin retirement until ROLE-001 supplies that role.

**Acceptance.**
1. Templates retain structure, logic, branding choice and question settings, excluding publication deadlines, response targets, responses, audiences, connection credentials and external IDs.
2. A new form receives new stable IDs and correctly remapped logic; its questions and settings match the saved template.
3. New forms use the workspace brand until BRAND-002/BRAND-004 supplies per-form theme carryover; those clauses retain that obligation.
4. Retirement removes the template from reuse without deleting forms already created from it.

**Evidence.** `tests/runtime/team-templates.worker.test.ts` — "workspace templates preserve branching and settings without copying private source history"; `tests/e2e/team-templates.spec.ts` — "save and reuse a team form, then retire its template"
**Gap.** None.

#### AI-001 — Generate a form from a prompt or a document

Core · target · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** Pencil supports generate a form from a prompt or a document. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#ai-001).

**Acceptance.**
1. An operator describes the goal in words, or pastes or uploads a document (Word, PDF, Google Doc export, an existing paper form or a SurveyMonkey/Typeform question list), and the configured ai provider adapter drafts a form: question types, choices, required flags, branching, hidden fields and a completion screen.
2. The draft opens in the builder with each generated step marked, passes FLOW-012 to FLOW-014 before it can be published, and its agent publication, distribution and connection calls carry external and, for connection credentials, security or gated as the provider step requires; the company’s policy decides each step.
3. Uploaded source documents are used for this request only and are not retained.
4. Through the AI receiver fixture turns a prompt and a two-page PDF into drafts whose graph validates; schema-invalid provider output fails under ANLY-012 rules with no draft written; Through the browser, edits and publishes the generated, draft.

**Evidence.** `tests/runtime/feedback-rewrites.worker.test.ts` — rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution; `tests/e2e/analysis.spec.ts` — an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run; Studio generation runs inside both tagged tests (`tests/runtime/studio-scenario.ts`, `tests/e2e/studio-journey.ts`)
**Gap.** Explicit provider-origin requests generate validated drafts from a goal and bounded text, Markdown, CSV or HTML, with all native question types, typed hidden fields and forward branching. Invalid output writes no draft or answered usage row; source text and goals are not retained. Generated marks appear in Studio review, not the builder. PDF/Word readers, generated marks in the builder, compound conditions, hidden-field branch operands and recall generation remain unbuilt.

### Target: the complete builder

#### FIELD-001 — Hidden fields and URL parameters

Core · target · **partial**

**Requirement.** Operators attach declared, typed context to a response without adding visible questions; identifying context follows the form's identity mode. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-001).

**Acceptance.**
1. Operators declare each hidden field's name, type and identifying status, and classify it as campaign, click identifier, identifying or plain context. Click identifiers are used only by INTEG-017 and INTEG-020.
2. Declared values may come from a direct link, an embed's fixed attributes, its host page's URL parameters, its explicit hidden-value call or analytics cookie, an in-product survey, or an invitation; invalid or undeclared values are discarded and a missing declared value is blank.
3. Accepted values are stored with the response and appear in the ledger, filters, crosstabs under RSLT-006, exports and the named integration consumers, and may drive answer recall and branching, completion, visibility, alert and email conditions.
4. An identifying hidden field is admitted on a direct link or embed only in the identified mode under RESP-023; the disclosure identifies that effect before the first answer, and an anonymous revision refuses identifying parameters at publication.
5. Aggregate-only views neither cross nor summarize identifying hidden fields under RSLT-009.
6. A declared context value routes the response by its condition, omission routes by the blank-value condition, and the CSV export carries only declared values.
7. Script forwarding, fixed values and explicit hidden values under DIST-021 and DIST-024 obey the same declaration filter; DIST-015, DIST-003, INTEG-001 through INTEG-011, INTEG-015, INTEG-017, INTEG-020, LOGIC-005, NOTIFY-005, NOTIFY-006 and NOTIFY-007 retain their stated consumer obligations.

**Evidence.** `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Revision-bound typed declarations, direct-link query values, identifying-field publication checks, blank/value branching and page visibility, preview, escaped recall, private save/resume, ledger search/typed filters, CSV/JSON and copy/archive custody ship. Undeclared, invalid and unsubstituted merge values are discarded and counted; anonymous click IDs are discarded. Remaining: script fixed/forwarded/hidden/GA values (DIST-021), SDK (DIST-015) and invitation-supplied values (DIST-003), integration consumers (INTEG-001 to INTEG-011, INTEG-015 and INTEG-017), alerts (NOTIFY-005), email (NOTIFY-006) and anonymous click-ID delivery custody (INTEG-017).

#### FIELD-002 — Matrix, Likert and scale grids

Core · target · **missing**

**Requirement.** A matrix collects several stable rows against a shared answer scale and reports each row independently. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-002).

**Acceptance.**
1. A matrix supports single- or multiple-selection rows and five- or seven-point Likert scales, with a stable identity for each row.
2. Each row has a distribution with the denominators under RSLT-003 and is available to the shared condition model under LOGIC-006.
3. Each row is a crosstab dimension under RSLT-006 and RSLT-014, with stated shares, the same chi-square rule and ANLY-005 suppression.
4. A published four-row, five-column matrix accepts responses, reports the hand-counted values, exports a distinct column keyed to each stable row and crosses one row against another.

**Evidence.** None.
**Gap.** No code yet.

#### FIELD-003 — CSAT, CES and visual rating questions

Core · target · **done**

**Requirement.** Typed satisfaction, effort, emoji and thumbs questions provide comparable scores independently of survey-program setup under PROG-001. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-003).

**Acceptance.**
1. CSAT uses the fixed one-to-five satisfaction scale and reports the share of four-or-five answers with its denominator.
2. CES uses the fixed one-to-seven effort scale and reports the arithmetic mean with its denominator.
3. Emoji and thumbs answers retain their fixed semantics and report their distributions; score exports retain normalized numeric or boolean values.
4. Collected answer sets produce the hand-computed CSAT percentage and CES mean, independently of PROG-001 program setup.

**Evidence.** `tests/runtime/contact-scores-scenario.ts` — "contactScoresScenario"; `tests/e2e/satisfaction-scores.spec.ts` — "builds and collects satisfaction, effort, emoji and thumbs scores with stated results and numeric exports"
**Gap.** None.

#### FIELD-004 — US contact fields

Core · target · **partial** · Cites BASE-PUBLIC-001, BASE-INPUT-001

**Requirement.** Respondents enter structured contact details and USD amounts with type-specific validation and useful exports. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-004).

**Acceptance.**
1. A phone answer retains an E.164 number and separate optional extension and displays the number in US format; international numbers remain accepted.
2. A postal address retains street, optional unit, city, two-letter state, five- or nine-digit ZIP and country, including the non-US address option.
3. A full name retains its component parts, a website answer is a valid URL, and a USD amount retains exact cents rather than accepting fractional cents.
4. Valid contact values are admitted and invalid phone, ZIP, state, name, URL or amount values show a field-specific error through the form and API.
5. CSV and JSON downloads carry the normalized values and formatted columns, including separate phone extensions and name parts.

**Evidence.** `src/core/shared/contactAnswers.ts`, `src/core/shared/ui/ContactQuestionInput.tsx`, `src/core/features/reporting/contactExport.ts`, `migrations/core/0040_scores_contact_fields.sql`, `tests/runtime/contact-scores-scenario.ts`
**Gap.** A cited browser journey must enter valid and invalid US contact values and read field-specific errors and the normalized download. The cited native contactScoresScenario proves API validation, international values and normalized exports, but the old Evidence set names no contact-field browser journey.

#### FIELD-005 — Media in questions and choices

Core · target · **missing** · Cites BASE-ACCESSIBILITY-001, BASE-PUBLIC-001

**Requirement.** Question steps and choices support accessible visual media without contacting a video provider before play. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-005).

**Acceptance.**
1. A step may carry an image with required alt text or a YouTube or Vimeo video through an approved host's privacy-enhanced embed.
2. An image choice retains its label, and publication refuses an image whose required alt text is empty.
3. The respondent page contacts the video provider only after the respondent chooses play.

**Evidence.** None.
**Gap.** No code yet.

#### FIELD-007 — Scheduling handoff

Core · target · **missing** · Cites BASE-DATA-004

**Requirement.** A scheduling step hands a respondent to an existing booking service and retains its confirmed appointment. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-007).

**Acceptance.**
1. The step opens the business's booking page in Dial, Calendly or Google Calendar appointment schedules, rather than implementing availability or calendars in Pencil.
2. Name and email are passed only when the respondent entered them and the disclosure names the destination; anonymous collection passes neither.
3. A Dial or Calendly-compatible booking completes through the provider handoff and its confirmation stores the booked time with the response.

**Evidence.** None.
**Gap.** No code yet.

#### FIELD-008 — Classic page layout

Core · target · **done**

**Requirement.** Operators build forms with several questions on each page, including conditional questions within that page. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-008).

**Acceptance.**
1. A classic page shows multiple questions together and applies LOGIC-006 conditions to earlier answers, including earlier answers on the same page.
2. Branching and required-on-path under FLOW-020 apply per page; hidden required questions cannot block navigation or submission, and only visible questions are validated.
3. Progress under RESP-002, RESP-003 and RESP-025 counts reachable pages, alongside the one-question and grouped layouts named by RESP-001.
4. A three-page form with in-page conditional questions completes with the correct reachable-page progress and without retaining newly hidden answers.

**Evidence.** `tests/e2e/pages.spec.ts` — "builds three classic pages, edits in-page visibility and completes with hidden required answers discarded"
**Gap.** None.

#### FIELD-009 — Video and audio answers

Core · target · **missing** · Cites BASE-INPUT-003, BASE-DATA-004

**Requirement.** Respondents record media answers and operators review the recording and any configured transcription as response evidence. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-009).

**Acceptance.**
1. A question may accept browser-recorded video or audio up to the operator's chosen length after explicit camera or microphone permission.
2. The recording is retained as an upload under FILE-001; when the AI provider is configured it is transcribed, and analysis uses that transcript while authorized operators may open the clip.
3. A ten-second recording can be played back by the operator through its authorized download, and its transcript appears in the ledger and analysis evidence.

**Evidence.** None.
**Gap.** No code yet.

#### FIELD-010 — Other write-ins and exclusive None choices

Core · target · **partial** · From FIELD-010

**Requirement.** Choice questions offer an optional write-in and an exclusive none answer without losing their stable choice identity. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-010).

**Acceptance.**
1. Single-choice, multiple-choice and dropdown questions may offer Other; multiple choice may also offer None of the above. Each has a stable choice identity under FLOW-015 and an editable translated label under LANG-001 and LANG-003.
2. Selecting Other reveals a required short-text answer governed by the stated limits and FIELD-013 validation, and deselecting Other discards that text.
3. Selecting None clears all other choices, selecting another choice clears None, and None alone satisfies a multiple-choice minimum; a submission combining None with another choice is refused.
4. Stored answers preserve the chosen stable identities and the Other text beside its choice; an empty or whitespace-only Other answer is refused with a field-specific error and creates no response.
5. Results count Other and None with RSLT-003 denominators and list write-ins as open text available to RSLT-012 coding, LEDG-003 filters, LEDG-006 and LEDG-008 search, and analysis evidence.
6. CSV and JSON exports under LEDG-004 retain Other text in its own column beside the choice column, keyed by stable question identity.
7. FLOW-005 branches on Other or None, LOGIC-001 recalls the write-in, and FIELD-006 keeps Other and None anchored last during randomization; the respondent sees the write-in appear and other selections clear when None is chosen.

**Evidence.** `src/core/shared/otherChoices.ts`, `src/core/shared/ui/ChoiceQuestionInput.tsx`, `src/core/features/importing/choice-response.ts`, `tests/runtime/other-choices.worker.test.ts`, `tests/e2e/other-choices.spec.ts` — “Other write-ins survive native collection, results export and explicit import column review”
**Gap.** Stable Other IDs and required validated write-ins, exclusive None (including selection-minimum exemption), builder controls, branching, distributions/open text, search/filters, analysis evidence, lossless JSON and a separate stable-step CSV text column ship. Typeform/Google definition and reviewed CSV imports retain unambiguous write-ins. Source response API retrieval, SurveyMonkey/Jotform imports, and translation await their target features; ambiguous Google checkbox cells require explicit reviewed columns.

#### FIELD-017 — Import Other choices and historical write-ins

Core · target · **partial** · From FIELD-010

**Requirement.** Moving a form into Pencil preserves its Other option and every historical write-in without inventing a replacement choice. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-010).

**Acceptance.**
1. Typeform Other-choice definitions and response write-ins, and Google Forms Other options with typed values, map to the stable Other choice and text under IMPORT-007.
2. SurveyMonkey's Other answer and text map under IMPORT-005, and Jotform's Other options on radio and checkbox fields map under IMPORT-006.
3. Typeform and Google Forms imports with historical Other responses retain every write-in on its matching Other choice with the exact text.

**Evidence.** `src/core/shared/otherChoices.ts`, `src/core/shared/ui/ChoiceQuestionInput.tsx`, `src/core/features/importing/choice-response.ts`, `tests/runtime/other-choices.worker.test.ts`, `tests/e2e/other-choices.spec.ts` — “Other write-ins survive native collection, results export and explicit import column review”
**Gap.** Stable Other IDs and required validated write-ins, exclusive None (including selection-minimum exemption), builder controls, branching, distributions/open text, search/filters, analysis evidence, lossless JSON and a separate stable-step CSV text column ship. Typeform/Google definition and reviewed CSV imports retain unambiguous write-ins. Source response API retrieval, SurveyMonkey/Jotform imports, and translation await their target features; ambiguous Google checkbox cells require explicit reviewed columns.

#### FIELD-011 — Statement screens between questions

Core · target · **partial** · From FIELD-011 · Cites BASE-INPUT-002, BASE-ACCESSIBILITY-001

**Requirement.** Operators insert answerless information screens between questions and route respondents through them. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-011).

**Acceptance.**
1. A statement may appear anywhere between questions, with headings, emphasis, lists and approved HTTPS links, LOGIC-001 recall, optional FIELD-005 media with required alt text and a Continue label editable under LANG-002.
2. A statement asks for no answer and is a valid branch destination, including a quiz's per-question feedback under LOGIC-004.
3. Progress and required checks never count a statement as a question; RSLT-002 counts a reached step rather than an answered question, and the response, ledger and exports contain no statement answer.
4. Inside a classic page under FIELD-008 the statement appears as a text block between questions; FLOW-002 admits statement steps beyond the optional first welcome screen.
5. A form routing through a recalled statement displays its Continue label, counts only the two surrounding questions in progress and leaves no statement answer in the ledger or CSV; publication refuses its image when alt text is missing.

**Evidence.** `src/core/features/importing/fields.ts`, `tests/e2e/journey.spec.ts`, `tests/runtime/form-import.worker.test.ts`
**Gap.** A no-answer screen ships only as the optional first welcome screen, and the Typeform importer maps only a leading Statement while later Statements are reported unsupported; the SurveyMonkey file importer likewise maps only a leading descriptive-text item to the welcome screen and reports later items unsupported (IMPORT-005).

#### FIELD-018 — Import statement screens

Core · target · **partial** · From FIELD-011

**Requirement.** Moving a form into Pencil keeps its intervening information items as ordered statement steps. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-011).

**Acceptance.**
1. Typeform Statements after the welcome screen and Google Forms text items map to statement steps under IMPORT-007.
2. Jotform paragraph and header fields map under IMPORT-006, and SurveyMonkey descriptive-text items map under IMPORT-005.
3. A Typeform form with a welcome and two statements between questions retains both statements in their original order in the import review.

**Evidence.** `src/core/features/importing/fields.ts`, `tests/e2e/journey.spec.ts`, `tests/runtime/form-import.worker.test.ts`
**Gap.** A no-answer screen ships only as the optional first welcome screen, and the Typeform importer maps only a leading Statement while later Statements are reported unsupported; the SurveyMonkey file importer likewise maps only a leading descriptive-text item to the welcome screen and reports later items unsupported (IMPORT-005).

#### FIELD-012 — Question groups

Core · target · **partial**

**Requirement.** Operators place several individually validated questions together under one heading within a one-question-at-a-time form. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-012).

**Acceptance.**
1. A group has one heading, optional description and optional FIELD-005 media; every member keeps its stable identity, type, required flag and validation.
2. Next validates every visible member and remains on the group with field-specific errors until its required questions are answered; progress counts each grouped question.
3. Conditions after the group may test any member, and the group is one branch destination under FLOW-012 and FLOW-013.
4. A group may contain statement text under FIELD-011 and FIELD-018 but cannot contain a nested group.
5. A published group of three questions with one required shows all three together, reports the required error, routes by a grouped answer and counts three questions in progress.
6. Typeform groups and inline groups map under IMPORT-007 to one group containing their questions in the import review.

**Evidence.** `src/core/shared/screenLayout.ts`, `src/core/features/importing/typeform-groups.ts`, `tests/runtime/groups.worker.test.ts`, `tests/e2e/groups.spec.ts`
**Gap.** Group builder, per-question validation/progress, grouped-answer branching, Typeform group/inline_group import and hierarchical review ship at 1440 and 390. Optional media and statement blocks remain unbuilt under FIELD-005/FIELD-011.

#### FIELD-013 — Text length, masks and patterns

Core · target · **partial** · Cites BASE-INPUT-001

**Requirement.** Operators constrain text answers and give respondents useful, matching validation in the form and API. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-013).

**Acceptance.**
1. Short and long text support operator-set minimum and maximum character counts within the question-type limits, with a live character counter whenever a maximum is set.
2. Short text may use a digit/letter/alphanumeric input mask or a bounded linear-time pattern without backreferences or lookaround, with a custom error message translated under LANG-001 and LANG-003; publication refuses patterns outside that subset.
3. The form and API apply the same rules: minimum three, maximum ten and a three-digit/four-digit phone mask refuse two characters, eleven characters and a mask mismatch with a field-specific error while admitting 555-0100; the form shows the counter and custom error.
4. Typeform maximum lengths, SurveyMonkey text validation and Jotform input masks retain faithful length, mask, supported-pattern and custom-error settings under IMPORT-005 through IMPORT-007; a Typeform maximum of 150 remains 150.

**Evidence.** `src/core/shared/textValidation.ts`, `src/core/features/flows/ui/TextSettings.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/text-validation.spec.ts`
**Gap.** A cited public-door journey must refuse an unsupported pattern at publication and verify browser/API parity for the named invalid lengths and mask. The cited browser journey covers counters, custom errors, correction, submission and export; native precision checks reject these values and patterns through direct service calls, while the HTTP importer exercises only its supported imported pattern.

#### FIELD-014 — Long choice lists

Core · target · **partial** · From FIELD-014 · Cites BASE-ACCESSIBILITY-001

**Requirement.** Operators create large choice lists and respondents find an answer without losing keyboard or screen-reader access. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-014).

**Acceptance.**
1. A dropdown supports at least 1,000 choices and single- and multiple-choice questions support at least 250 choices.
2. A dropdown filters anywhere in each label, case- and accent-insensitively, and its filtering and selection remain accessible under A11Y-001.
3. The builder accepts one choice per pasted line and names duplicate and blank lines before save; pasting 300 lines with one duplicate identifies that duplicate.
4. Operators insert and edit built-in lists of the 50 US states, District of Columbia and US territories with their USPS codes, and countries with ISO 3166-1 alpha-2 codes.
5. A respondent typing united sees only matching countries and selects United States by keyboard; country and 1,000-choice dropdowns collect stable choice identities.
6. Publication refuses one choice above the configured limit and names the question; an imported list above the limit is reported with its question and count rather than silently truncated.

**Evidence.** `src/core/shared/formLimits.ts`, `src/core/shared/choiceLists.ts`, `tests/runtime/long-forms.worker.test.ts`, `tests/e2e/long-choices.spec.ts`
**Gap.** Remaining: Optional group media and statement items under FIELD-005/FIELD-011 remain dependencies; mixed-layout capacity alone does not complete this clause. 250 questions across pages, groups and standalone screens; country and 1,000-choice dropdowns; over-limit publication refusal, stable IDs, exports and original 20-sample p95 limits. Browser builder/keyboard/export proof at 1440 and 390. Hosted capacity is not claimed.

#### FIELD-019 — Long forms without layout penalties

Core · target · **partial** · From FIELD-014

**Requirement.** A form's question capacity remains available when its questions are arranged in pages or groups. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-014).

**Acceptance.**
1. A published revision supports at least 250 questions; each question counts once whether standalone, grouped or on a classic page.
2. Statements, groups and pages consume a separate structure allowance, so choosing those layouts does not shrink the question budget.
3. The declared question, choice and structure limits meet these floors with recorded seeded load measurements, and the public-screen and answer-transition p95 bars continue to hold on the longest permitted form.
4. A 250-question form mixing groups and pages collects a complete response; an imported form over the limit is reported with its count rather than silently truncated.
5. FIELD-008 classic pages, FIELD-011 and FIELD-018 statements, FIELD-012 question groups and A11Y-001 retain their own acceptance obligations at these capacities.

**Evidence.** `src/core/shared/formLimits.ts`, `src/core/shared/choiceLists.ts`, `tests/runtime/long-forms.worker.test.ts`, `tests/e2e/long-choices.spec.ts`
**Gap.** Remaining: Optional group media and statement items under FIELD-005/FIELD-011 remain dependencies; mixed-layout capacity alone does not complete this clause. 250 questions across pages, groups and standalone screens; country and 1,000-choice dropdowns; over-limit publication refusal, stable IDs, exports and original 20-sample p95 limits. Browser builder/keyboard/export proof at 1440 and 390. Hosted capacity is not claimed.

#### FIELD-015 — Locale-independent date entry and display

Core · target · **partial** · From FIELD-015 · Cites BASE-ACCESSIBILITY-001

**Requirement.** Operators choose a question's calendar format and respondents see that same format throughout their answer journey. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-015).

**Acceptance.**
1. Editors choose MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD and a slash, hyphen or dot separator; the language default follows LANG-001 and LANG-003, including MM/DD/YYYY for US English and US Spanish, with a per-question override.
2. Respondents enter labeled month, day and year fields in that order, or use an accessible date picker, independently of the browser locale; the answer is displayed in the chosen format.
3. The answer, LOGIC-001 recall, review, completion, ledger and response emails use the published format; NOTIFY-006, NOTIFY-007, RESP-020, RESP-027 and WORK-005 carry it into answer-bearing emails, confirmations and submission PDFs.
4. An impossible or out-of-bounds date is refused with a field-specific error naming the expected format.
5. The stored calendar value remains YYYY-MM-DD under FLOW-019, leaving CSV, JSON, API and integration values unchanged.
6. In an en-GB browser, 07/04/2026 entered under MM/DD/YYYY appears that way in recall and review and exports as 2026-07-04; 02/30/2026 is refused, and the same entered date under DD/MM/YYYY is stored as 2026-04-07.

**Evidence.** `src/core/shared/dateFormat.ts`, `src/core/shared/ui/CalendarDateInput.tsx`, `src/core/shared/answerRecall.ts`, `src/core/features/reporting/repository.ts`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/date-format.spec.ts`
**Gap.** A cited public-door journey must import a Typeform date structure/separator and read its retained setting. The browser journey proves locale-independent entry, refusal, recall, review/completion, ledger and ISO export, but the cited Typeform format check uses FormImports directly rather than an import route or command.

#### FIELD-020 — Import date formats

Core · target · **partial** · From FIELD-015

**Requirement.** A moved form keeps its source date-entry format instead of adopting the installation's locale. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-015).

**Acceptance.**
1. Typeform month/day/year, day/month/year and year/month/day structures and separators map under IMPORT-007 to the corresponding question settings.
2. Jotform date formats retain their source format under IMPORT-006.
3. A Typeform day/month/year date with a dot separator arrives in the import review with that same format and separator.

**Evidence.** `src/core/shared/dateFormat.ts`, `src/core/shared/ui/CalendarDateInput.tsx`, `src/core/shared/answerRecall.ts`, `src/core/features/reporting/repository.ts`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/date-format.spec.ts`
**Gap.** A cited public-door journey must import a Typeform date structure/separator and read its retained setting. The browser journey proves locale-independent entry, refusal, recall, review/completion, ledger and ISO export, but the cited Typeform format check uses FormImports directly rather than an import route or command.

#### FIELD-016 — Labeled opinion scales

Core · target · **partial** · From FIELD-016 · Cites BASE-ACCESSIBILITY-001

**Requirement.** Operators publish a numeric rating scale with meaningful labels while keeping its answers and reports numeric. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-016).

**Acceptance.**
1. A rating question starts at zero or one, has two to eleven steps and may label its low, middle and high points with up to 100 characters each, translated under LANG-001 and LANG-003.
2. On phone and desktop the low, middle and high labels sit over the corresponding steps, including between the two middle steps for an even count; each step's accessible name joins its number and any label.
3. The stored answer is the number; numeric conditions, LOGIC-003 calculations, recall and results use it, and the results distribution includes every step with endpoint labels on its axis.
4. NPS retains its fixed zero-to-ten scale and two labels. Other scale starts, lengths and labels belong to the published revision, and each revision's results retain that revision's scale.
5. A labeled zero-to-six scale shows Not at all, Neutral and Completely over zero, three and six; answering zero routes through a less-than-two condition and retains zero in the ledger and CSV.
6. Publication refuses one or twelve steps and a 101-character label.

**Evidence.** `src/core/shared/ratingScale.ts`, `src/core/shared/ui/RatingInput.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/opinion-scale.spec.ts`
**Gap.** A cited public-door journey must refuse invalid scale settings at publication and import/read Typeform and Google scale labels. The browser journey covers labeled zero, routing, ledger, result labels and CSV; cited invalid settings are service-level saves, and the old Evidence set does not contain a Google Forms scale-import journey.

#### FIELD-021 — Import opinion scales and labels

Core · target · **partial** · From FIELD-016

**Requirement.** Moving a form preserves its numeric scale and endpoint and midpoint labels. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-016).

**Acceptance.**
1. Typeform scale starts, step counts and low/middle/high labels map under IMPORT-007; a seven-step scale starting at zero arrives as zero through six with all three labels.
2. Google Forms scale endpoints and low/high labels map under IMPORT-007 without losing either label.
3. SurveyMonkey and Jotform scale starts, step counts and labels map under IMPORT-005 and IMPORT-006.

**Evidence.** `src/core/shared/ratingScale.ts`, `src/core/shared/ui/RatingInput.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/opinion-scale.spec.ts`
**Gap.** A cited public-door journey must refuse invalid scale settings at publication and import/read Typeform and Google scale labels. The browser journey covers labeled zero, routing, ledger, result labels and CSV; cited invalid settings are service-level saves, and the old Evidence set does not contain a Google Forms scale-import journey.

#### LOGIC-001 — Answer recall

Core · target · **partial** · Cites BASE-INPUT-002

**Requirement.** Forms reuse an earlier accepted answer in respondent-facing text without changing the underlying answer. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-001).

**Acceptance.**
1. Prompts, supporting text, choice labels, completion screens and emails may include an earlier answer, a declared hidden value under FIELD-001 or a calculated value under LOGIC-003.
2. Question references use stable question identities; missing, current, future or impossible off-path question references are refused at publication with the containing question named, and duplication remaps references to the copied identities.
3. Only valid answers on the current path appear in recalled text; skipped or invalid answers insert blank text, and recalled HTML or respondent-supplied reference tokens remain inert.
4. Changing a name by going Back updates the later prompt and recalled choice text, in preview and published collection, while stored answers remain unchanged.
5. NOTIFY-006, NOTIFY-007, RESP-020 and RESP-027 retain answer, hidden-value and calculated-value recall, including escaped output and blank skipped or invalid values, in their answer-bearing emails.

**Evidence.** `src/core/shared/answerRecall.ts`, `src/core/features/flows/ui/RecallHelp.tsx`, `tests/runtime/answer-recall.worker.test.ts`, `tests/e2e/answer-recall.spec.ts`
**Gap.** A cited public-door journey must exercise publication refusals for invalid recall references and duplicate/remap a recalled form, including blank skipped or invalid values. The browser journey proves preview, updated prompt/choice/completion recall and inert script text, while the remaining cited outcomes are direct service or interpolation checks.

#### LOGIC-002 — Known-data prefill in invitations

Core · target · **partial** · From LOGIC-002 · Cites BASE-DATA-003, BASE-SECRET-001

**Requirement.** Known invitation recipients can review and correct explicitly mapped contact data without exposing it to anonymous collection. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-002).

**Acceptance.**
1. A published revision freezes its explicit mapping from stored contact fields to questions; older revisions have no mapping, and anonymous collection never prefills.
2. Only the invitation-token holder receives validated string-compatible stored values, visibly marked and editable unless locked by the operator; invalid values are dropped without coercion.
3. The submitted answer retains an unchanged, edited or locked prefill marker rather than the original contact value; normal erasure, ledger/search, CSV/JSON and archives preserve that answer and marker.
4. Contact-prefill values never appear in a URL, audit row, log or analysis input before submission, and public, embed, collector, preview and resume paths supply no contact prefills.
5. Mapped invitations cannot save across devices, and publication refuses deleted or string-incompatible mappings with their question identities.
6. An invited contact sees a mapped company value, edits it and finds the edited answer with its prefill marker in the ledger.

**Evidence.** `tests/runtime/distribution.worker.test.ts` — "invitation prefill stays pinned, is editable and marked in the ledger, locks are enforced and one completion cancels reminders"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"
**Gap.** Prefill obligations are complete for editable and locked invitation prefills and marker custody. The in-product and CRM halves remain inherited by DIST-015 and INTEG-003 to INTEG-005 before shipping and are unbuilt. Default APPROVED by ct (23 October 2026): revision-frozen explicit mapping, invitation-token-only values and no cross-device save on mapped invitations. No real mail provider call or consent was used.

#### LOGIC-007 — Known-data prefill from connected records

Core · target · **partial** · From LOGIC-002

**Requirement.** Identified in-product surveys and CRM-linked collection use explicitly mapped known records under the same custody as invitation prefill. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-002).

**Acceptance.**
1. An identified in-product survey under DIST-015 or a CRM-linked collection under INTEG-003, INTEG-018, INTEG-004 or INTEG-005 may prefill mapped stored fields or connected CRM values.
2. These sources follow LOGIC-002's published mapping, visible marking, edit-or-lock behavior, validation, submitted-answer custody, erasure and exclusion from anonymous collection before their collection door is offered.

**Evidence.** `tests/runtime/distribution.worker.test.ts` — "invitation prefill stays pinned, is editable and marked in the ledger, locks are enforced and one completion cancels reminders"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"
**Gap.** Prefill obligations are complete for editable and locked invitation prefills and marker custody. The in-product and CRM halves remain inherited by DIST-015 and INTEG-003 to INTEG-005 before shipping and are unbuilt. Default APPROVED by ct (23 October 2026): revision-frozen explicit mapping, invitation-token-only values and no cross-device save on mapped invitations. No real mail provider call or consent was used.

#### LOGIC-003 — Variables and calculations

Core · target · **done**

**Requirement.** Operators calculate typed response values and use them consistently to route, explain and report the result. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-003).

**Acceptance.**
1. Numeric and text variables derive from answers and hidden fields through arithmetic, LOGIC-006 conditionals, rounding and calendar-date differences, and are stored with the response.
2. Publication refuses missing references, wrong types and possible division by zero; calculations may drive branching, completion, alerts, recall, PAY-001 amounts and results, with NOTIFY-005 and PAY-001 retaining those consumer obligations.
3. Calculated conditions over bounded integer numbers, ratings, scores, booleans, single choices and text equality classes are proved exactly, and publication refuses an unreachable destination.
4. A calculated condition reading unbounded or decimal numbers, dates, multi-select, masked or patterned text, or numeric hidden context may be true or false for reachability; destinations remain forward-only and feasible cycles are refused.
5. A quantity-and-discount form stores the hand-computed total for ten answer sets and refuses an expression referencing a deleted question.
6. A rounded BMI from decimal weight and height values previews both calculated branches and publishes and routes both answer sets through the form at 1440 and 390.

**Evidence.** `tests/runtime/calculations.worker.test.ts` — "agrees across preview, collection, recall and exports for ten quotes and preserves committed values on replay"; `tests/runtime/calculations.worker.test.ts` — "refuses cyclic, deleted, mistyped and zero-denominator calculations, and misplaced or out-of-range payment steps, without publishing the draft"; `tests/runtime/calculations.worker.test.ts` — "calculates typed hidden inputs, arithmetic, calendar differences and dependent blanks after duplication"; `tests/runtime/calculations.worker.test.ts` — "a BMI from two decimal answers gates a branch and publishes"; `tests/e2e/calculations.spec.ts` — "a BMI from two decimal answers gates a branch and publishes"
**Gap.** None.

#### LOGIC-004 — Quiz scores and outcomes

Core · target · **missing**

**Requirement.** Forms grade answers or identify an outcome and report both the respondent's result and the aggregate performance. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-004).

**Acceptance.**
1. A quiz supports correct-answer grading, points per choice and personality-outcome mapping, and shows the respondent their score and per-question feedback.
2. A score range or top outcome chooses a completion screen and may be combined with answers or hidden fields through LOGIC-006 conditions.
3. Reports show score distributions, per-question correctness and pass rates for fixed answer sets from graded and personality quizzes.
4. Quiz scores and outcomes are crosstab dimensions under RSLT-006 and RSLT-014 with stated shares, the same chi-square rule and ANLY-005 suppression; an outcome can be crossed against a question.

**Evidence.** None.
**Gap.** No code yet.

#### LOGIC-006 — One condition model and typed operands

Core · target · **partial** · From LOGIC-006

**Requirement.** The same typed conditions decide response-dependent behavior throughout the form. Its operand and consumer scope includes FIELD-001, FIELD-002, FIELD-008, FIELD-010, FIELD-012, FIELD-017, LOGIC-003, LOGIC-004, LOGIC-005, NOTIFY-005, NOTIFY-006, NOTIFY-007 and PAY-001; import mapping is governed by LOGIC-009 and accessible authoring by A11Y-001. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-006).

**Acceptance.**
1. AND and OR groups serve FLOW-005 branches, LOGIC-005 completions, FIELD-008 visibility, LOGIC-003 conditionals, LOGIC-004 outcomes, NOTIFY-005 alerts and NOTIFY-006 and NOTIFY-007 response-email rules; the builder, preview, collection and server admission give the same result.
2. The declared capacity supports at least 20 conditions and three nesting levels, while preserving the always-default path.
3. A condition may read an earlier on-path question, including the question being left or a page/group member, a matrix row, Other text, a hidden field, a variable, a quiz score or outcome; post-submission rules may also read payment state.
4. Single-choice, dropdown and matrix-row values support equality, inequality, any-of and none-of; multi-choice values support includes-any, includes-all, includes-none and exact-set comparisons.
5. Text, email, URL, phone, Other text and text context or variables support equality, inequality, begins-with, ends-with, contains and does-not-contain after case-insensitive, trimmed Unicode normalization.
6. Numbers, ratings, native scores, USD amounts and numeric context or variables support all equality and ordering comparisons; calendar dates support before/on/after and inclusive comparisons without timezone conversion; boolean/consent values support yes/no; priority compares a choice's rank numerically.
7. Every operand supports answered and blank; skipped, empty optional or absent hidden values satisfy only blank, fail all other operators including negative comparisons and never block progress.
8. Publication names the source, rule and condition when an operand is deleted or cannot precede the rule, an operator does not fit the operand's type, a choice belongs to another question or the tree exceeds its limits.

**Evidence.** `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request.

#### LOGIC-008 — Condition authoring, preview and runtime custody

Core · target · **partial** · From LOGIC-006 · Cites BASE-ACCESSIBILITY-001

**Requirement.** Operators can read the rule they wrote, preview its exact decision and rely on that same decision after publication. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-006).

**Acceptance.**
1. The builder provides only earlier operands, lets an Editor add conditions and groups and choose AND or OR, and displays a plain-language summary beside the path with keyboard access under A11Y-001.
2. Preview displays the tree, each operand's value and result, each group's result and the selected next step exactly as collection evaluates it.
3. Destinations remain forward-only so every path terminates, and branch selection uses the first matching rule in displayed order followed by the default path.
4. Admission re-evaluates conditions from accepted on-path answers; an off-path answer is discarded before validation and never stored, scored or exported under RESP-004.
5. Published rules retain stable references, so renaming a question, choice or hidden field cannot change a rule.
6. A company-size/decision-maker AND rule combined with an enterprise-context OR rule routes all four stated truth cases correctly; uppercase GMAIL.COM matches an ends-with condition while gmail.co does not, single-choice inequality routes other choices, and blank optional answers match blank but not inequality.
7. Publication refuses later-question and deleted-hidden-field operands with the rule named, while a submission containing an off-path answer is admitted when its on-path answers are valid and leaves the off-path value absent from storage, scoring and exports.

**Evidence.** `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request.

#### LOGIC-009 — Import compound conditions faithfully

Core · target · **partial** · From LOGIC-006

**Requirement.** A moved form retains its source condition tree or explicitly reports an unsupported path rather than guessing its meaning. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-006).

**Acceptance.**
1. Typeform AND/OR trees retain question, hidden-field, variable, choice and constant operands and equality, inequality, text prefix/suffix/containment, numeric/date ordering and always operators under IMPORT-001 and IMPORT-007.
2. SurveyMonkey advanced branching retains its AND/OR conditions on questions and custom variables under IMPORT-005.
3. Jotform conditions retain All/Any linking and equality, inequality, containment, prefix/suffix, numeric/date ordering and empty/filled terms under IMPORT-006.
4. A source condition without a faithful mapping is listed as unsupported and leaves the path incomplete.
5. A Typeform AND jump over a question, hidden value and text-contains condition, and a Jotform Any-linked condition, arrive intact in the import review.

**Evidence.** `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request.

#### LANG-001 — Multi-language forms

Core · target · **missing** · From LANG-001

**Requirement.** Pencil supports multi-language forms. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#lang-001).

**Acceptance.**
1. A form may have several languages (English and Spanish first-class for US buyers, any BCP 47 language allowed); the respondent sees the language matching their browser with a visible switcher, all steps, choices, errors, disclosures and emails are translated, and stable IDs are shared across languages so results merge with language as a filter.
2. Each language carries its own default date display format for FIELD-015, FIELD-020 (MM/DD/YYYY for `en-US` and `es-US`).
3. Missing translations block publish for that language.
4. Operators export and import translations as CSV or XLIFF, and may request an AI draft translation whose application carries standard, adding external on publication, under the company’s policy (AI-002).
5. This clause inherits FIELD-013: translated custom and default text-validation errors use the same published length, mask and pattern rules.
6. This clause inherits FIELD-016, FIELD-021: an opinion scale's low, middle and high labels are translated per language and stay over the same steps.
7. This clause inherits RSLT-006, RSLT-014: response language is a crosstab dimension with the same stated shares, chi-square rule and ANLY-005 suppression.
8. Through the browser, answers the same form in English and Spanish, and a date question shows MM/DD/YYYY in both under `en-US` and `es-US`; results show one distribution with a language filter; publish is refused while one Spanish choice is untranslated.

**Evidence.** None.
**Gap.** No code yet.

#### LANG-003 — Multi-language forms: The journey also triggers FIELD-013 length and mask errors in each language and check

Core · target · **missing** · From LANG-001

**Requirement.** This part of LANG-001 covers the journey also triggers FIELD-013 length and mask errors in each language and checks the translated custom message, and checks a FIELD-016 scale's translated labels over steps 0, 3 and 6 in each language, and crosses language against a question under RSLT-006.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#lang-001).

**Acceptance.**
1. The journey also triggers FIELD-013 length and mask errors in each language and checks the translated custom message, and checks a FIELD-016, FIELD-021 scale's translated labels over steps 0, 3 and 6 in each language, and crosses language against a question under RSLT-006, RSLT-014.

**Evidence.** None.
**Gap.** No code yet.

#### AI-002 — AI translation

Core · target · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** An operator can request draft translations beside the source strings.

**Acceptance.**
1. An operator can ask ai provider adapter to draft a translation of every untranslated string; the draft is shown beside the source.
2. Applying an agent translation carries standard, adding external when published to respondents; the company’s policy decides whether it applies alone or waits for the operator.
3. Under the held company policy, With the AI receiver fixture, the specialist drafts Spanish, strings, accepts half, and the rest stay untranslated and block publish for Spanish.

**Evidence.** None.
**Gap.** No code yet.

#### LANG-002 — Editable closed and system text

Core · target · **partial**

**Requirement.** Pencil supports editable closed and system text. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#lang-002).

**Acceptance.**
1. An Editor overrides, per form, the closed-form message, the response-limit message (RESP-008, RESP-009), the button labels (Start, OK, Next, Submit), required-answer and validation messages, the progress text and the keyboard hint, with recall (LOGIC-001) in messages and a stated length limit.
2. Overrides are part of the published revision, are translated per language under LANG-001, LANG-003, and an empty override falls back to Pencil's default; A11Y-002 refuses a label that would leave a control without an accessible name.
3. Through the browser, sets a custom Submit label and closed message, sees the label on the published form, closes the form and sees the closed message, and sees the Spanish translation of the label under LANG-001, LANG-003; Through the public door, refuses publish with a whitespace-only button label.

**Evidence.** `src/core/shared/respondentText.ts`, `src/core/shared/closedFlow.ts`, `src/core/features/flows/ui/RespondentTextSettings.tsx`, `tests/runtime/foundation.worker.test.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival”
**Gap.** Translation (LANG-001), the OK label, required and validation messages, the keyboard hint and recall in messages are not built.

#### A11Y-002 — Accessibility checker before publication

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001

**Requirement.** The builder identifies fixable form defects before they can reach respondents. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#a11y-002).

**Acceptance.**
1. The checker identifies missing alt text, low-contrast brand choices, unlabeled matrix rows, overly long choice lists, timed elements and ambiguous link text.
2. A defect breaching A11Y-001 prevents publication and offers a fix link to its question or step.
3. A draft containing an image without alt text and a two-to-one contrast accent returns both stable step identities and reasons when publication is attempted.

**Evidence.** `src/core/features/brand/brand.ts`, `tests/runtime/brand.worker.test.ts`
**Gap.** There is no per-step checker.

### Target: every distribution channel

#### DIST-011 — SMS invitations and reminders

Core · target · **partial** · Register R-8

**Requirement.** Pencil supports sMS invitations and reminders. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-011).

**Acceptance.**
1. Operators send invitations and reminders by text message through Twilio to contacts with a mobile number and recorded SMS consent (TCPA prior express consent: actor, time, source and wording).
2. Messages carry the opaque link and "Reply STOP to opt out"; an inbound STOP, sent to a signed Twilio status and inbound webhook, opts the contact out of SMS immediately (DIST-005 for SMS), and HELP returns the business name.
3. Delivery attempts, retries and terminal failures follow DIST-006, DIST-008 and DIST-010; quiet hours follow WS-002 in the contact's time zone where known.
4. A2P 10DLC registration is the owner's Twilio account step and the settings page shows its state.
5. Through the a Twilio receiver fixture sends to a consented, contact, refuses an unconsented one, records a STOP that blocks the scheduled reminder, and verifies the inbound webhook signature.

**Evidence.** `tests/runtime/sms.worker.test.ts` — “SMS invitations require recorded consent, use sealed owner custody, and signed STOP cancels the reminder while HELP names the business”; `src/core/features/sms/`, `migrations/core/0065_sms_invitations.sql`; Twilio test-credential receipt `docs/evidence/dist011-twilio-test-2026-10-26.json` (`scripts/proof/sms-twilio-test.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `migrations/core/0071_contact_time_zones.sql`, `tests/runtime/sms.worker.test.ts`:248 (known-zone deferral and workspace fallback on one launch, once-only opening), `tests/runtime/sms.worker.test.ts`:40 (unapproved A2P state makes no provider request), `tests/runtime/sms.worker.test.ts`:240 (invalid save and import), `tests/runtime/sms.worker.test.ts`:255 (erasure), `scripts/deployment-data-custody-replay.check.mjs`:269 (archive restoration), `tests/e2e/distribution-foundation.spec.ts`:11 (SMS Settings, recorded consent and invitation channel at 1440 and 390)
**Gap.** Gap — genuine handset delivery after the owner’s carrier-registration step and genuine provider callback evidence. The shared integration-ledger join remains in INTEG-015; automatic carrier-state lookup is an unclaimed boundary, not completed evidence.

#### DIST-013 — Embed modes and site plugins

Core · target · **partial** · Cites BASE-PUBLIC-002

**Requirement.** Pencil supports embed modes and site plugins. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-013).

**Acceptance.**
1. Besides the inline script and iframe (DIST-002, DIST-022), the embed offers full-page, popup on click, popover bubble, slider and side tab modes, with open triggers on click, delay, scroll depth or exit intent, frequency capping per browser, and the same isolation as DIST-009.
2. A WordPress plugin and a Webflow/Squarespace snippet install the embed without editing theme code.
3. Every mode and the WordPress shortcode take DIST-021, DIST-024's forward, fixed-value, `hidden` and `_ga` options, so a popup on a paid-ad landing page carries the campaign like an inline embed.
4. Through the browser, on a host fixture opens each mode by its trigger, completes a response, and proves the host receives only loaded, height and completed events; the popup and side-tab modes on the documented page or route store the forwarded `utm_campaign`; the WordPress plugin renders a form via shortcode in a WordPress test container.

**Evidence.** `tests/e2e/script-embed.spec.ts` — copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages (1440/390)
**Gap.** Inline, full-page, popup, popover, slider and side-tab modes with click/delay/scroll/exit triggers and per-browser opening caps ship. Campaign parameters are forwarded subject to declared hidden-field rules. WordPress plugin/container proof, Webflow/Squarespace-specific installation and DIST-021 forward/fixed-value/hidden/_ga options remain unbuilt. Defaults confirmed by ct (24 Oct): click trigger, one opening per host-origin/browser/form/mode, 1 s delay, 50% scroll; unavailable storage keeps modes closed.

#### DIST-014 — Email-embedded first question

Core · target · **partial** · From DIST-014

**Requirement.** Pencil supports email-embedded first question. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-014).

**Acceptance.**
1. An invitation or program email may carry the first question (NPS 0–10, CSAT 1–5, or a short single choice) as buttons.
2. Clicking opens the form with that answer selected and the rest of the flow ready; the click itself is a GET that records nothing, so mail-security link scanners cannot create answers, and the answer is saved only when the respondent confirms or continues.
3. Invitation buttons use only the invitation's opaque token and a namespaced answer hint; their GET and HEAD perform no answer, session, response, view-counter or participant-state write.
4. Selection remains in the page until explicit interaction, and normal completion, closure, opt-out and revision admission still apply.
5. Unknown or out-of-range hints select nothing.
6. Only an eligible first published-path question renders buttons: NPS, CSAT, a published rating scale, or a single choice with at most eight short labels (80 characters each); a different first type or an operator-locked contact prefill renders no buttons.
7. Reminders share this same composer.
8. PROG-002 inherits these rules before program email ships.

**Evidence.** `tests/runtime/distribution.worker.test.ts` — "invitation score buttons preserve the recipient snapshot, consent blocks sending and renewal records actor and source"; `tests/invitation-links.test.ts` — "emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390)
**Gap.** Default APPROVED by ct (23 October 2026): invitation-token link plus a namespaced answer hint, GET/HEAD with no response/session/answer/view/participant mutation, and short-choice bounds of eight options/80-character labels. Program email (PROG-002) inherits before shipping and remains unbuilt. No real mail provider call or consent was used.

#### DIST-023 — Email-embedded first question: Through the public door, fetches every embedded answer link as a scanner would and fi

Core · target · **partial** · From DIST-014

**Requirement.** This part of DIST-014 covers through the public door, fetches every embedded answer link as a scanner would and finds no answer or session recorded. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#dist-014).

**Acceptance.**
1. Through the public door, fetches every embedded answer link as a scanner would and finds no answer or session recorded; Through the browser, clicks "9", lands on question 2 with 9 selected and completes.

**Evidence.** `tests/runtime/distribution.worker.test.ts` — "invitation score buttons preserve the recipient snapshot, consent blocks sending and renewal records actor and source"; `tests/invitation-links.test.ts` — "emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390)
**Gap.** Default APPROVED by ct (23 October 2026): invitation-token link plus a namespaced answer hint, GET/HEAD with no response/session/answer/view/participant mutation, and short-choice bounds of eight options/80-character labels. Program email (PROG-002) inherits before shipping and remains unbuilt. No real mail provider call or consent was used.

#### DIST-015 — In-product and website surveys

Core · target · **missing**

**Requirement.** Pencil supports in-product and website surveys. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-015).

**Acceptance.**
1. A JavaScript SDK served from the installation (no third-party origin) shows micro-surveys inside the business's web app or site, targeted by page, event, user attributes the host passes and a sampling rate, with global and per-survey fatigue limits (for example no more than one survey per user per 14 days).
2. Identified targeting requires a server-signed user identity from the host, and RESP-005 discloses the identification; unsigned attributes keep the response anonymous.
3. Through the browser, on a host fixture fires an event, the survey appears for a matching user and not for a non-matching one, a second trigger inside the fatigue window shows nothing, and a forged unsigned identity yields an anonymous response.

**Evidence.** None.
**Gap.** No code yet.

#### DIST-016 — Recurring surveys

Core · target · **missing**

**Requirement.** Pencil supports recurring surveys. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-016).

**Acceptance.**
1. A form can repeat on a schedule (weekly, monthly, quarterly, or a cron in the WS-001 zone) to a segment or by a fresh public link per occurrence, each occurrence pinned to the then-current revision and reported as its own period in trends (RSLT-007); the distributor is reminded before each occurrence and can skip one.
2. Through the public door, advances a fake clock through three monthly occurrences and asserts three launches, three periods in the trend report and one skipped occurrence that sent nothing.

**Evidence.** None.
**Gap.** No code yet.

#### DIST-017 — Collectors and source labels

Core · target · **done**

**Requirement.** Pencil supports collectors and source labels. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-017).

**Acceptance.**
1. An operator can create several named collectors per form (web link, embed on a named site, email campaign, SMS, QR, social post, partner), each with its own link, close date and response limit; every response records its collector, and results filter and compare by collector.
2. Through the public door, collects through two collectors, closes one by limit while the other stays open, and the results comparison shows each collector's counts.
3. The native-route journey also races the last collector place without exceeding its limit, pins a returning session to its collector, and checks independent close/reopen, collector filters and snapshot exports.

**Evidence.** `tests/runtime/collectors-trends.worker.test.ts` — "named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports"
**Gap.** None.

#### DIST-018 — Form addresses

Core · target · **partial**

**Requirement.** Pencil supports form addresses. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-018).

**Acceptance.**
1. Each form has an editable readable slug on the installation's own domain (for example the documented page or route), additional custom domains or subdomains can be mapped to the installation through Cloudflare custom hostnames, and old slugs keep redirecting after a rename.
2. Every address serves the form's DIST-020 link preview with its canonical `og:url` and robots setting.
3. Under RL-101, a retired slug stays bound to its existing form and may be explicitly restored as that form’s canonical slug in one atomic rename, with every other alias redirecting directly to the resulting canonical address; another form cannot claim an address while it remains an obligated redirect.
4. Through the public door, renames a slug, the old one redirects with 301 to the new one, and a form served on a mapped test hostname renders with the same admission checks and the same DIST-020 preview tags, with `og:url` naming the canonical address.

**Evidence.** `tests/e2e/rendering-migration.spec.ts` — “emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission” (rename through builder; direct/embed 301 with query; retired-slug refusal; second hostname admission and canonical preview; owner archive restoration and exact re-export; 1440/390, CPU throttle 4); `src/core/features/addresses/`, `migrations/core/0064_form_addresses.sql`
**Gap.** Cloudflare custom-hostname provisioning is not built (Platform zone path). Current equal operators retain builder access until ROLE-001 grants ship.

#### DIST-020 — Link previews and search indexing

Core · target · **partial**

**Requirement.** Pencil supports link previews and search indexing. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-020).

**Acceptance.**
1. Each form has a share title (default: the form title), description (default: the welcome screen's text, otherwise empty) and share image (default: the BRAND-001, BRAND-003 business logo on the BRAND-002, BRAND-004 theme background; an Editor may upload a PNG, JPEG or WebP within a stated size limit, with required alt text), which are part of the published revision and translated under LANG-001, LANG-003.
2. The public form page, the embed page and every DIST-018 address serve them as `<title>`, `og:title`, `og:description`, `og:image` (an absolute URL on the installation's own origin), `og:image:alt`, `og:url` (the canonical DIST-018 address) and `twitter:card` set to `summary_large_image`, so a link pasted into an ad, a Facebook, LinkedIn or X post, Slack, or a text message shows that preview.
3. Preview text never contains answers or recalled values (LOGIC-001), and rendering it makes no third-party request.
4. Search indexing is off by default: every form, embed, invitation, save-and-resume (PART-002) and completion page sends `<meta name="robots" content="noindex, nofollow">` and `X-Robots-Tag: noindex`.
5. An Editor may allow indexing for one public form, which removes both only from that form's canonical address; invitation-only, restricted (DIST-019), identified (RESP-023, RESP-028) and HIPAA-mode (GOV-001) forms can never be indexed.
6. DIST-017 collectors and DIST-018 addresses share the form's preview.
7. Typeform's meta title, description, image and `allow_indexing` setting import with the form (IMPORT-007).
8. Through the public door, fetches a published form's page and asserts its `og:title`, `og:description`, `og:image` (same origin and fetchable), `og:url` and `twitter:card` tags and the `noindex` meta tag and header; after an Editor sets a custom title and image and allows indexing, the republished form serves them without `noindex`; publish refuses the indexing setting on a DIST-019 restricted form, which keeps `noindex`; Through the browser, sees the preview card in the builder's share panel.

**Evidence.** Published tags, fetchable same-origin image, defaults, canonical-only opt-in, collector/embed/selected-home and completion privacy, restricted refusal and no outbound requests: `tests/e2e/rendering-migration.spec.ts` — “emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission”. Editor card, upload/alt, save/reload/publish at 1440/390: `tests/e2e/authoring.spec.ts` — “labels, one Save, real controls, reorder, branching, Share and a current dashboard”. Revision/default custody and bounded upload validation: `tests/runtime/brand.worker.test.ts` — “settings API preserves preview overrides and publication freezes defaults and images across later edits”; “settings API rejects recalled preview text and invalid, oversized or unlabelled image uploads without mutating the draft”; “upgrading existing publications freezes their logo preview without changing admission policy”. Valid invitation and private resume meta/header: `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — “Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible”; `tests/e2e/save-resume.spec.ts` — “a respondent saves two answers, resumes privately on another device and sees completion on reuse”. Typeform metadata and bounded image retrieval/commit/publication: `tests/runtime/typeform-definition.worker.test.ts` — “the authenticated Typeform retrieval feeds the real reviewed import without retaining the credential or creating records early”. Image archive custody: `tests/runtime/brand.worker.test.ts` — “owner backup carries immutable R2 share images, checks their bytes and refuses missing attachment custody”; `tests/e2e/rendering-migration.spec.ts` — “owner browser backup restores preview image bytes with the same archive checksum”; `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — “complete archive restores R2 bytes and ownership metadata with D1, re-exports identically, and standalone proof keeps actual attachment custody”.
**Gap.** Missing cited public journeys for translated preview metadata, theme-background logo compositing and HIPAA-mode indexing refusal. Existing journeys comprehensively prove current preview/edit/import/archive and restricted/identified indexing, but inherited LANG-001/BRAND-002/GOV-001 outcomes are not performed.

#### DIST-021 — Forwarded landing-page parameters

Core · target · **missing** · From DIST-021

**Requirement.** Pencil supports forwarded landing-page parameters. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#dist-021).

**Acceptance.**
1. A script embed (DIST-002, DIST-022), every DIST-013 mode (full-page, popup, popover, slider and side tab) and the WordPress plugin's shortcode take a list of parameter names to forward from the URL of the page the form sits on: `data-pencil-forward="utm_source,utm_medium,utm_campaign,gclid,fbclid"` on the snippet, `forward="…"` in the shortcode.
2. The installation-origin script reads the host page's `location.search`, keeps only names that are both listed and declared as FIELD-001 fields on the published revision (the script the documented page or route serves carries the revision's declared field names and nothing else about the form), and hands those values to the form in the `pencil:init` message it already sends after the frame loads, never in the frame's URL, so they reach no access log or Referer; every other parameter, listed or not, stays on the host page.
3. The landing page can also supply values itself: `data-pencil-<field>="…"` sets a fixed value, and a documented `hidden` call, made before or after the snippet loads (`(window.pencil = window.pencil || []).push(['hidden', {utm_source: '…'}])`), hands over values the page holds from earlier in the visit, for example the first-visit UTMs it kept in its own first-party cookie.
4. For GA4, `data-pencil-ga4="cookie"` makes the script read the host's own `_ga` cookie and pass its client ID (the last two dot-separated parts of `GA1.1.123456789.1700000000`, here `123456789.1700000000`) as `ga_client_id`, only when the form declares that field; Pencil sets no cookie of its own.
5. One precedence holds: a fixed `data-pencil-<field>` value beats a `hidden` value, which beats a forwarded URL value; a declared field with none of them is blank (FIELD-001).
6. The respondent page accepts the first answer only after `pencil:init` is processed, so no response loses a forwarded value to timing, and the Worker re-checks every received value against the revision's declared names and types, discarding and counting anything else whatever the script sent.
7. Forwarded values follow every FIELD-001 rule: they drive LOGIC-001 recall and LOGIC-006, LOGIC-008, LOGIC-009 conditions, and are stored, filtered, exported and delivered like link values; an identifying field is accepted only on a RESP-023, RESP-028 identified form; on an anonymous form click IDs are held only for INTEG-017, INTEG-020 delivery and purged once it ends.
8. Values flow from the host page into the form only: DIST-002, DIST-022 and DIST-009 isolation are unchanged, and nothing about the response flows back beyond the loaded, height and completed events.

**Evidence.** None.
**Gap.** The script embed (`src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`) mounts the frame with only its challenge and forwards no host parameter, and `/embed.js` accepts no option but `flow`.

#### DIST-024 — Forwarded landing-page parameters: The plain iframe takes the same values in its src query string (the documented page o

Core · target · **missing** · From DIST-021

**Requirement.** This part of DIST-021 covers the plain iframe takes the same values in its src query string (the documented page or route), written by the operator's page template, under the same declared-field filter at the Worker. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#dist-021).

**Acceptance.**
1. The plain iframe takes the same values in its `src` query string (the documented page or route), written by the operator's page template, under the same declared-field filter at the Worker; DOCS-001 gives that recipe, the `hidden` first-visit cookie recipe and the `_ga` recipe.
2. Forwarded names per snippet are capped by the declared limits embed forwardedParameters limits (design target 20, added with a load-tested value on activation) and each value by its declared type's FIELD-001 length.
3. When this clause activates, DIST-002, DIST-022 is rewritten to name the forward, fixed-value, `hidden` and `_ga` options, and DIST-009's host-communication sentence to name the inbound `pencil:init` values.
4. Through the browser, loads a host fixture at the documented page or route with the script embed forwarding `utm_campaign,gclid,fbclid,secret` on a form that declares `utm_campaign`, `gclid` and `fbclid`, is routed by a LOGIC-006, LOGIC-008, LOGIC-009 rule on `utm_campaign`, completes the response, and asserts that the stored response and the CSV hold `utm_campaign=spring`, that `secret` is in neither the stored response, the `pencil:init` message nor any request the frame makes, and that the INTEG-017, INTEG-020 receiver fixtures get one Google Ads click conversion carrying `G1` and one Meta event whose `fbc` is built from `F1`; the same journey with `data-pencil-utm_campaign="fixed"` stores `fixed`; a host fixture with a `_ga` cookie and `data-pencil-ga4="cookie"` produces one GA4 event carrying that client ID, and one whose page calls `hidden` with a first-visit `utm_source` stores that value; the popup mode forwards the same values; a plain iframe whose `src` carries `?utm_campaign=spring&secret=x` stores only `utm_campaign`; on an anonymous form a forwarded `email` is not stored and is counted as discarded; and throughout, the host page receives only loaded, height and completed events.

**Evidence.** None.
**Gap.** The script embed (`src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`) mounts the frame with only its challenge and forwards no host parameter, and `/embed.js` accepts no option but `flow`.

### Target: respondent follow-through and partial responses

#### RESP-020 — Respondent confirmation content

Core · target · **partial** · From RESP-020 · Cites BASE-INPUT-002

**Requirement.** A form can send one branded respondent receipt after release; recipient custody is governed by RESP-027.

**Acceptance.**
1. The receipt may include an opted-in answer copy, quiz result, payment receipt link or signed PDF under LOGIC-004, PAY-001/PAY-006/PAY-007 and SIGN-001.
2. Subjects and bodies can recall earlier answers, declared hidden fields and calculated values under LOGIC-001; skipped or invalid values are blank and values render as escaped text and HTML.
3. Dates use the question’s published FIELD-015/FIELD-020 display format.
4. Sensitive answers under GOV-004 are never included.
5. The receipt uses the saved business brand under BRAND-001/BRAND-003 and DIST-006 retry behavior.
6. It has no Reply-To or response-access link, except the single-use edit link when response editing is explicitly enabled under RESP-021.

**Evidence.** `tests/runtime/respondent-confirmations.worker.test.ts` — "released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy"; `tests/runtime/notification-restore.worker.test.ts` — "restored failed and unknown mail can be explicitly retried with their original key while every other restored delivery remains unarmed"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"
**Gap.** Receipt wording APPROVED by ct (25 October 2026). Default-off receipts have no link; enabled receipts carry exactly one single-use edit link, consumed through the public edit door with reuse refused. The receipt has no Reply-To or other response-access link. Default APPROVED by ct (23 October 2026): revision-frozen opt-in, one marked typed mailbox or identified participant, second opt-in/type whitelist for copies, and no resend from restored history. GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt and inherit before shipping. No real mail provider call or consent was used.

#### RESP-027 — Respondent confirmation custody

Core · target · **partial** · From RESP-020 · Cites BASE-INPUT-002

**Requirement.** Confirmation delivery is bound to one consented recipient and released response.

**Acceptance.**
1. Confirmation defaults off on each published revision; an answer copy is a separate opt-in whose allowed question types start empty.
2. Only the selected “send my confirmation here” question or the identified invitation participant supplies a recipient. Other typed or link-supplied addresses do not; unchanged or locked contact prefill is eligible only when it is that participant’s own address.
3. Opted-out participants and opted-out or bounced mailboxes receive none. Excluded or quarantined responses receive none until a live response is released.
4. One durable key per released response prevents replay or restored history from resending; existing request rates and one delivery per response bound the mail path.
5. Recipient mailboxes, rendered bodies and attempts remain private archive history, restore with sending disabled and erase with the response.
6. The same custody, escaping and exclusion rules apply to the optional quiz, payment and signature receipt content of RESP-020.
7. A form with the marked mailbox delivers once with escaped recall, blank skipped values and the published date format; an anonymous response without that mailbox delivers none, and a transient failure retries the same delivery.

**Evidence.** `tests/runtime/respondent-confirmations.worker.test.ts` — "released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy"; `tests/runtime/notification-restore.worker.test.ts` — "restored failed and unknown mail can be explicitly retried with their original key while every other restored delivery remains unarmed"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"
**Gap.** Receipt wording APPROVED by ct (25 October 2026). Default-off receipts have no link; enabled receipts carry exactly one single-use edit link, consumed through the public edit door with reuse refused. The receipt has no Reply-To or other response-access link. Default APPROVED by ct (23 October 2026): revision-frozen opt-in, one marked typed mailbox or identified participant, second opt-in/type whitelist for copies, and no resend from restored history. GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt and inherit before shipping. No real mail provider call or consent was used.

#### RESP-021 — Edit after submission

Core · target · **done**

**Requirement.** A form may permit a respondent to change a completed submission until a stated deadline.

**Acceptance.**
1. A single-use edit link is delivered with the confirmation and opens the existing answers.
2. A successful edit retains the prior response version, creates the new version, recomputes results and notifies integrations with an updated event.
3. The ledger shows both versions and the updated event reaches the integration; a second use of the same edit link is refused.

**Evidence.** `tests/runtime/response-webhooks.worker.test.ts` — "signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection"; `tests/e2e/save-resume.spec.ts` — "a respondent saves two answers, resumes privately on another device and sees completion on reuse"
**Gap.** None.

#### PART-001 — Consented partial-response capture

Core · target · **missing**

**Requirement.** A form can opt into partial capture under RESP-005's advance disclosure; without that opt-in, RESP-010's no-partial rule applies.

**Acceptance.**
1. Before the first answer, disclosure says answers are saved as the respondent goes; each completed step is retained against the RESP-013 session.
2. Operators see partials separately with the last step reached; partials are excluded from completed counts, admission and analysis, and from exports unless explicitly included.
3. Incomplete partials expire after a retention period, defaulting to 30 days; completion ends partial status.
4. Three answered steps of a six-step form appear as one three-answer partial without affecting counts or analysis; the same activity without opt-in stores no partial, and advancing past retention deletes the partial.

**Evidence.** None.
**Gap.** No code yet.

#### PART-002 — Save and resume

Core · target · **partial**

**Requirement.** Respondents can explicitly email themselves a private link to resume the same answers and revision on another device, separately from partial-response capture.

**Acceptance.**
1. Save and finish later resumes the same revision, answer path, collector and invitation until expiry (30 days by default) or closure; the delivery email is used only for the link unless independently answered in an email question.
2. A completed link shows its completion receipt; erased, expired, closed or otherwise unavailable links offer Start again.
3. Saving creates no completion, contact, operator-visible partial or analysis evidence, and saved answers remain absent from completed results and default exports until submission.
4. Save-mail failure is visible and retryable without duplicating the save.
5. Completion, expiry subject to GOV-003/GOV-008, and erasure scrub private saved state; archive restore removes delivery capabilities.
6. After two answers, a fresh browser context opens the emailed link, reads both answers, completes and sees completion on link reuse; without choosing Save, answering stores no partial.

**Evidence.** `src/core/features/resuming/`, `src/core/features/responses/ui/SaveResponse.tsx`, `src/core/features/responses/ui/ResumeFlowPage.tsx`, `migrations/core/0043_saved_responses.sql`, `tests/runtime/resuming.worker.test.ts`, `tests/e2e/save-resume.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** A cited journey must leave after answering without choosing Save and inspect that no partial answer state was stored; it must also exercise legal hold/notice custody before automatic private-save expiry. The cited save/resume journeys prove explicit saves, revision pinning, email separation, retries, expiry/closure/erasure and restored credential removal. The legal-hold journey is in tests/runtime/retention-schedule.worker.test.ts, outside the old PART-002 Evidence set.

#### RESP-022 — Response-quality flags

Core · target · **partial**

**Requirement.** Per-form checks can flag additional response-quality concerns without discarding the data.

**Acceptance.**
1. Completed responses can be checked for grid straight-lining, completion far faster than the form’s median, duplicated open text and gibberish.
2. Operators choose the checks for a form; a flag quarantines the response with its reasons under RESP-017/RESP-018 rather than deleting it.
3. A straight-lined grid and a three-second completion against a ninety-second median are held with their reasons, and release restores them to results.

**Evidence.** `src/core/features/responses/service.ts`, `tests/runtime/journey.worker.test.ts`
**Gap.** Only the behaviour named in Evidence ships; the rest of the clause is not built.

#### RESP-023 — Identified public collection

Core · target · **partial** · From RESP-023

**Requirement.** Editors choose whether each published form collects anonymous or identified public responses.

**Acceptance.**
1. The builder’s share settings choose anonymous by default or identified collection for links, embeds, popups and QR codes; a change requires republication.
2. Identifying hidden fields declared under FIELD-001 accept typed link, embed or popup values for uses such as Mailchimp, HubSpot, Mango and CRM sequences.
3. Retained values are marked link-supplied and unverified. Unsubstituted merge tags and values failing their declared types are discarded and counted, never stored.
4. Optional contact matching links a supplied email to the matching AUD-001 contact and uses it as the key for the applicable CRM/email-platform deliveries.
5. Before answering, RESP-005 states the identified mode, shows the values received, explains forwarding and offers “This isn’t me” to clear them before storage.
6. Results, filters and exports show the collected identity mode.

**Evidence.** `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Per-revision anonymous/identified public-link mode, typed link-supplied unverified identity, pre-answer disclosure, This isn’t me, merge-tag rejection/counting and ledger/export identity mode ship. Remaining: public-link revision binding, fixed identifying values and reasoned cross-revision refusal; contact matching, CRM/email-platform identity deliveries, popup and QR tooling. The current runtime validates submitted hidden values against the admitted session's revision. It does not yet bind the public URL itself to a revision or freeze identifying values: direct links resolve the current revision, and hidden values arrive with the submitted answers. Cross-revision identified-link refusal and fixed identifying values therefore remain obligations of this partial clause.

#### RESP-028 — Revision-bound public identity

Core · target · **partial** · From RESP-023

**Requirement.** Identifying public links bind their values to one published revision, while anonymous collection keeps its identity boundary.

**Acceptance.**
1. An identifying link names exactly one form revision and fixes its identifying values against that revision’s declarations.
2. Values cannot change during collection except by removal through “This isn’t me”.
3. Using a revision-A identifying link on revision B is refused with a reason and creates no response; identity never silently moves to another revision.
4. Anonymous mode keeps RESP-006 and FIELD-001’s refusal of identifying parameters, and changing modes never re-identifies an earlier anonymous response.
5. A published identified form collects a typed email/name supplied by a link, shows the disclosure and retains the email in the response and CSV and as the contact key in the HubSpot delivery.
6. An unsubstituted merge tag stores no email and increments the discarded-value count; “This isn’t me” collects no supplied identity; the same identifying parameter on an anonymous form is refused at publication and discarded at runtime.

**Evidence.** `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Per-revision anonymous/identified public-link mode, typed link-supplied unverified identity, pre-answer disclosure, This isn’t me, merge-tag rejection/counting and ledger/export identity mode ship. Remaining: public-link revision binding, fixed identifying values and reasoned cross-revision refusal; contact matching, CRM/email-platform identity deliveries, popup and QR tooling. The current runtime validates submitted hidden values against the admitted session's revision. It does not yet bind the public URL itself to a revision or freeze identifying values: direct links resolve the current revision, and hidden values arrive with the submitted answers. Cross-revision identified-link refusal and fixed identifying values therefore remain obligations of this partial clause.

#### RESP-024 — Review before submit

Core · target · **done**

**Requirement.** Editors may enable a review screen before final submission.

**Acceptance.**
1. Review lists every reachable answer in published order and display format, including FIELD-015/FIELD-020 dates, FIELD-016/FIELD-021 scale labels and choice labels.
2. Each answer has an edit link through RESP-004 Back navigation, which recomputes the path and removes newly unreachable answers from review.
3. Final submission from review uses RESP-007 and the same RESP-012 submission key.
4. An anonymous respondent sees only their own answers.
5. In a branching form, editing one answer removes the old branch, shows the new branch in the published display format and submits exactly once.

**Evidence.** `tests/e2e/date-format.spec.ts` — "RESP-024 reviews display formats, edits a branch and submits once; FIELD-015 keeps locale-independent entry, recall and ISO exports"
**Gap.** None.

### Target: submission workflow

#### LEDG-005 — Spreadsheet exports

Core · target · **partial** · From LEDG-005

**Requirement.** The LEDG-004 selection is available as XLSX with response and question-metadata sheets, using the documented spreadsheet format.

**Acceptance.**
1. The response sheet has the CSV’s columns and values, retaining JSON-valued columns as JSON text.
2. Text is inert rather than a formula, including values beginning with =, +, - or @.
3. An answer beyond the spreadsheet cell limit refuses the whole export rather than being cut.
4. The metadata sheet lists each revision’s stable question ID, position, type and label, and each offered choice’s stable ID, published value and label, including its statistics variable and code.
5. The download is cursor-paged with bounded memory and a cutoff-bearing XLSX filename.
6. An independent spreadsheet reader opens the export and reads back the same response IDs and values as CSV.

**Evidence.** `src/core/features/reporting/export.ts`, `src/core/features/reporting/xlsxExport.ts`, `src/core/features/reporting/zip.ts`, `src/core/features/reporting/savDictionary.ts`, `src/core/features/reporting/savWriter.ts`, `src/core/features/reporting/exportInventory.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/runtime/export-reader.global.ts`, `tests/e2e/ledger-filters.spec.ts`, `docs/evidence/ledg005-exports-1440.png`, `docs/evidence/ledg005-exports-390.png`
**Gap.** Missing an over-limit spreadsheet-cell journey that attempts export and observes complete refusal rather than truncation with no partial success. Cited journeys read ordinary text and formula-like values and two-page exports, not this dangerous boundary.

#### LEDG-007 — Statistics exports

Core · target · **partial** · From LEDG-005

**Requirement.** The LEDG-004 selection is available as an SPSS system file whose exact byte format and limits are documented with the operating rules.

**Acceptance.**
1. One case represents one response, preserving CSV response columns and JSON text for omitted questions and presentation order, with typed hidden-field and calculation variables.
2. Stable question/choice IDs determine codes across revisions: single-choice/dropdown values carry choice labels; multiple choices use one binary variable per option; priorities use ranks; yes/no, thumbs and consent use binary values; scores/numbers remain numeric; open/contact answers and Other write-ins remain text.
3. A question absent from the response’s revision is system-missing.
4. Very long text uses the documented long-string representation; a value beyond the format limit refuses the export without truncation.
5. Format-shortened variable/value labels retain their full text in the XLSX metadata sheet.
6. The UTF-8 compressed download uses bounded cursor pages and a cutoff-bearing statistics filename, under the same filter, cutoff and quarantine rules as CSV.
7. An independent statistics reader opens the file and reads back the same response IDs and coded values as CSV.

**Evidence.** `src/core/features/reporting/export.ts`, `src/core/features/reporting/xlsxExport.ts`, `src/core/features/reporting/zip.ts`, `src/core/features/reporting/savDictionary.ts`, `src/core/features/reporting/savWriter.ts`, `src/core/features/reporting/exportInventory.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/runtime/export-reader.global.ts`, `tests/e2e/ledger-filters.spec.ts`, `docs/evidence/ledg005-exports-1440.png`, `docs/evidence/ledg005-exports-390.png`
**Gap.** Missing a cited statistics-export journey for system-missing absent-revision questions, very-long strings, over-limit refusal without truncation and full metadata labels after format limits. Existing readers inspect ordinary coded values and cursor continuity only.

#### LEDG-006 — Response search

Core · target · **partial** · From LEDG-006 · Cites BASE-ROLE-001

**Requirement.** Operators can search the retained response content they are entitled to see.

**Acceptance.**
1. Search matches open text, FIELD-010/FIELD-017 Other write-ins, choice labels, hidden fields and identified name/email when the ROLE-002 grant permits identity.
2. GOV-004 sensitive answers match only when visible to the operator; quarantined matches appear only in RESP-018 review and erased responses never match.
3. Search composes with every LEDG-003 filter, highlights the original matching answer and fixes the same response IDs into LEDG-004 exports.
4. Count and first-page results complete within one second p95 at the declared response capacity.
5. Matching follows the documented Unicode case-folding and canonical-composition rules; accents remain significant and wildcard/SQL punctuation is literal.
6. Accented, Cyrillic, Greek and mixed-script text, decomposed accents and expanding case folds match correctly, including a two-hundred-letter phrase without query-depth refusal.

**Evidence.** `migrations/core/0053_response_search_values.sql`, `src/core/features/reporting/search.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/ledger-search-upgrade.worker.test.ts`, `tests/runtime/other-choices.worker.test.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”, `tests/e2e/response-search.spec.ts`, `tests/release/ledger-search.worker.test.ts`, `docs/evidence/ledger-search-2026-10-20.json`; Verify runtime (worker-2) via `scripts/run-contract-lane.mjs`: `tests/release/ledger-search.worker.test.ts` — “[LEDG-006] returns count and first page under one second p95 across 100,000 responses”.
**Gap.** Missing the ROLE-002/GOV-004 identity/sensitive-grant search journey in the old evidence. Current cited journeys cover all-equal-operator Unicode/literal search, filters, highlighting, erasure and capacity; the retained grant-aware query scope is unbuilt.

#### LEDG-008 — Search custody through change

Core · target · **partial** · From LEDG-006

**Requirement.** Searchable content follows answer changes, upgrades and archive custody without changing retained answers.

**Acceptance.**
1. Each answer write updates its searchable value; editing an answer replaces its old searchable text.
2. Upgrading from release 0.7.0 makes existing answers searchable without changing the retained answers.
3. An archive round trip preserves search values and produces an identical re-export.
4. Searching retained open text, hidden values and Other write-ins with revision/source filters exports exactly the matching released IDs, excluding quarantine and erasure.
5. The browser shows the original matching spelling and downloads those same filtered records.
6. Grant-aware identity and sensitive-answer cases remain required under ROLE-002 and GOV-004.

**Evidence.** `migrations/core/0053_response_search_values.sql`, `src/core/features/reporting/search.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/ledger-search-upgrade.worker.test.ts`, `tests/runtime/other-choices.worker.test.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”, `tests/e2e/response-search.spec.ts`, `tests/release/ledger-search.worker.test.ts`, `docs/evidence/ledger-search-2026-10-20.json`; Verify runtime (worker-2) via `scripts/run-contract-lane.mjs`: `tests/release/ledger-search.worker.test.ts` — “[LEDG-006] returns count and first page under one second p95 across 100,000 responses”.
**Gap.** Missing the retained ROLE-002/GOV-004 identity/sensitive-grant custody cases in the old evidence. Current all-equal-operator search/upgrade/archive journeys cover the other retained outcomes; this part cannot be done before its grant-aware cases are shown.

#### WORK-001 — Submission inbox

Core · target · **partial** · Cites BASE-OPS-005

**Requirement.** Each form's submissions can be assigned, annotated and moved through a private workflow inbox.

**Acceptance.**
1. Submissions hold a new, in review, approved, rejected, done or custom status, an assignee, tags and internal notes invisible to respondents.
2. Operators filter and bulk-update submissions; assigning, tagging, noting and moving one to done makes it appear in that status filter and records each change.
3. Unauthenticated requests and stale bulk writes are refused without partial changes; private notes are paged and custom statuses are retained.
4. The selected workflow cohort exports, and workflow custody survives import undo, response erasure and operator removal.

**Evidence.** `src/core/features/submissions/`, `src/core/features/reporting/scope.ts`, `tests/runtime/submissions.worker.test.ts`
**Gap.** Native-route triage, private notes, bulk version guards, filters, audit and custody are proved. Gap: the browser journey at 1440 and 390 assigning, tagging, noting and moving a submission to done is absent; done only when that journey exists.

#### WORK-002 — Approval flows

Core · target · **missing** · Cites BASE-OPS-005

**Requirement.** A submission can follow sequential, parallel or answer-selected approval steps, including a second approver above a configured amount.

**Acceptance.**
1. Approvers are operators or named external people; each external approver receives a single-use signed link restricted to that submission and its permitted fields.
2. Approve, reject and request-changes retain actor, time and comment, can notify the respondent under RESP-020/RESP-027 and can trigger integrations.
3. A $6,000 request passes through two approvers, one external; both decisions appear in the audit, and the external link cannot be reused or opened for another submission.

**Evidence.** None.
**Gap.** No code yet.

#### WORK-003 — Multi-person forms

Core · target · **missing**

**Requirement.** A response can pass a later section to another person while protecting the earlier person's answers.

**Acceptance.**
1. The first respondent names, or is assigned, the next person, who receives their own link and can complete only their section while seeing only permitted earlier answers.
2. The response becomes complete only after every section is complete.
3. In a two-person form, the second person cannot alter part one, and completion counts increase only after part two.

**Evidence.** None.
**Gap.** No code yet.

#### WORK-004 — Workflow reminders and escalation

Core · target · **missing**

**Requirement.** Pending approvals and section handoffs remind their assignees and escalate to a named operator after a deadline.

**Acceptance.**
1. Reminders follow the configured schedule within WS-002 sending hours; completion or cancellation stops them.
2. Advancing a pending approval through two reminders and an escalation produces those notices; approving it then leaves no further reminder queued.

**Evidence.** None.
**Gap.** No code yet.

#### WORK-005 — Submission PDFs and generated documents

Core · target · **missing**

**Requirement.** Operators can render a submission as a PDF using a default or designed layout, including an uploaded fillable PDF.

**Acceptance.**
1. Authorized operators can download PDFs, attach them to respondent or WORK-002 approval emails, and deliver them through FILE-002 storage integrations.
2. Both a recalled-value template and a filled AcroForm retain their expected text content.
3. Dates in documents and submission PDFs retain the question's FIELD-015/FIELD-020 published display format.

**Evidence.** None.
**Gap.** No code yet.

### Target: reports buyers share

#### RSLT-006 — Crosstab dimensions and statistics

Core · target · **partial** · From RSLT-006

**Requirement.** An operator can cross structured questions, hidden fields, collectors, language, calculations and scores over a stated response cohort.

**Acceptance.**
1. The crosstab uses distinct released responses from one revision under LEDG-003 filters and an evidence cutoff, excluding quarantine and erasure.
2. Cells show counts and RSLT-003 row/column shares; chi-square is flagged only when every expected cell count is at least five.
3. Unanswered is a stated row or column, and the table says when none exists.
4. A multiple-select dimension counts a response in each chosen option, labels shares that may exceed one hundred percent and offers no chi-square.
5. Priority crosses by first-priority choice. Numeric/date/calculated dimensions use distinct finite values, up to fifty stated categories; empty collectors are omitted.
6. Language under LANG-001/LANG-003, quiz scores/outcomes under LOGIC-004 and stable matrix rows under FIELD-002 are included before their respective capabilities ship.
7. A fixed three-choice by two-choice cohort produces the correct cells, row/column shares and statistic; disclosure follows RSLT-014.

**Evidence.** `src/core/features/reporting/crosstab.ts`, `src/core/features/reporting/crosstabDimensions.ts`, `src/core/features/reporting/crosstabStats.ts`, `src/core/features/results/ui/CrosstabPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `docs/evidence/rslt006-crosstab-1440.png`, `docs/evidence/rslt006-crosstab-390.png`
**Gap.** Missing cited language, quiz-score/outcome, stable matrix-row and remaining promised dimension journeys. Existing cited journeys prove question, hidden-field and collector matrices, shares and chi-square, but the retained LANG-001/LANG-003/LOGIC-004/FIELD-002 dimensions are unbuilt.

#### RSLT-014 — Crosstab disclosure boundaries

Core · target · **partial** · From RSLT-006

**Requirement.** A crosstab protects its own table while accurately stating what other figures remain available.

**Acceptance.**
1. A cell below the ANLY-005 threshold, including zero, shows suppressed without a count or share; exactly the threshold is shown.
2. The affected row total, column total, grand total, shares using withheld totals and chi-square are withheld, with the reason stated.
3. A raw-authorized operator retains complete answer summaries, response count, other panels, ledger and exports. The note explains that these can recover withheld values and claims no non-reconstruction guarantee beyond the table.
4. Aggregate-only reports apply the stronger whole-report rule of RSLT-015/RSLT-016, including code crosstabs.
5. In the forty-three-response fixture, the Plan summary states Scale eight of forty-three and Responses forty-three; the table shows Scale × Churn five and suppresses Scale × Renew, while the raw ledger and CSV/XLSX/statistics exports retain its three matching responses.

**Evidence.** `src/core/features/reporting/crosstab.ts`, `src/core/features/reporting/crosstabDimensions.ts`, `src/core/features/reporting/crosstabStats.ts`, `src/core/features/results/ui/CrosstabPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `docs/evidence/rslt006-crosstab-1440.png`, `docs/evidence/rslt006-crosstab-390.png`
**Gap.** Missing the retained aggregate-only whole-report crosstab/refusal fixture through a shared report/tool result. Old evidence proves the raw-authorized operator boundary only; RSLT-015/RSLT-016 aggregate protection remains unbuilt.

#### RSLT-007 — Trends over time

Core · target · **partial**

**Requirement.** Results chart score and answer-share changes over the workspace calendar.

**Acceptance.**
1. Day, week, month and quarter charts state each period’s denominator, apply its minimum-size rule and mark revision boundaries in the WS-001 zone.
2. DIST-016 recurring occurrences and PROG-003 programs use the same series.
3. Three months of responses produce correct weekly/monthly NPS, denominators and revision markers; a period below the minimum has no value.
4. Collector cohorts, primitive-answer shares and CSV use that series; recurring programs and ranked/structured-contact answer shares remain included.

**Evidence.** `src/core/features/reporting/trends.ts`, `src/core/features/reporting/trendPeriods.ts`, `src/core/features/results/ui/TrendsPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts`
**Gap.** Zoned day/week/month/quarter score and primitive-answer-share charts, answered denominators, minimum-size gaps, revision markers, collector cohorts and CSV ship. DIST-016 recurring occurrences, PROG-003 program dashboards, and shares of ranked/structured contact answers remain unbuilt.

#### RSLT-008 — Saved views and dashboards

Core · target · **partial**

**Requirement.** Operators can save report views and arrange them into form or program dashboards.

**Acceptance.**
1. A named view retains filters, compared cohorts, crosstabs and chosen charts, and records who saved it.
2. Reopening the view yields the same figures for the same cutoff, including when another operator opens it.
3. A saved/shared aggregate view records its disclosure threshold and never applies a lower one later under ANLY-015 and RSLT-015/RSLT-016.
4. Lowering current policy reveals nothing in the saved aggregate view; the operator’s current-threshold results page needs no saved-view snapshot.

**Evidence.** `src/core/features/reporting/answerFilter.ts`, `tests/runtime/ledger-filters.worker.test.ts`
**Gap.** Saved views do not.

#### RSLT-009 — Shared report links

Core · target · **missing** · From RSLT-009

**Requirement.** A saved view can be shared as a read-only aggregate link, under the disclosure rules of RSLT-015 and RSLT-016.

**Acceptance.**
1. The link offers an optional password and expiry and can be revoked at any time.
2. Opening needs no operator session and reveals aggregates only, never respondent identity, below-threshold excerpts, uploads or payment details.
3. It uses no cookies beyond its own session.
4. The opened page contains no response ID or identity and returns not found after revocation.

**Evidence.** None.
**Gap.** No code yet. Today that is every operator.

#### RSLT-015 — Aggregate-only report cohorts

Core · target · **missing** · From RSLT-009

**Requirement.** Aggregate-only protection covers shared links, report files/emails, tool results, API tokens without response-read scope and roles without response access. Raw-authorized operators retain their ledger and exports.

**Acceptance.**
1. Every figure names one cohort: revision, response filters including hidden-field/code/search filters, released responses and cutoff.
2. The view uses the ANLY-005 disclosure threshold, never below its save/share record; lowering current policy reveals nothing.
3. Answer summaries remain complete, but a cohort below threshold or a nested subset differing by one through threshold-minus-one responses shows no breakdown.
4. Rare observed-value categories of hidden fields, numbers, dates and calculations are not labeled, and identifying hidden fields are neither crossed nor summarized.
5. Protection covers one report/tool result at one cutoff, not differencing across separate links, files, emails, calls, filters or cutoffs; the view states that limit.
6. This is presentation protection, not anonymization, differential privacy or legal protection.

**Evidence.** None.
**Gap.** No code yet. Today that is every operator.

#### RSLT-016 — Whole-report complementary suppression

Core · target · **missing** · From RSLT-009

**Requirement.** Aggregate-only crosstabs, including code crosstabs, remain protected against the equations in the same report. Exact matrix mechanics are documented with the operating rules.

**Acceptance.**
1. The check includes the crosstab’s cells/totals, both dimension summaries and answered counts, Unanswered and response count, beyond what the summaries alone determine.
2. Only valid single-select partition sums constrain counts; overlapping and multiple-select incidences are never treated as partitions.
3. The report suppresses further cells until each suppressed cell has at least two feasible non-negative integer values, or withholds cells/totals/chi-square and explains that other reported figures would recover a cell.
4. A cell below threshold, including zero, is suppressed; exactly the threshold is visible.
5. For the forty-three-response Plan/Renewal fixture with Scale eight, a shared report either withholds the crosstab with that explanation or leaves two feasible values for every suppressed cell while summaries stay complete.
6. A nested collector cohort differing by three responses has no breakdown, a multiple-select crossing contributes no partition sum, and identifying hidden fields are absent.
7. Lowering the shared threshold reveals nothing; in the same run the raw-authorized operator’s results and exports still contain the three Scale × Renew responses.

**Evidence.** None.
**Gap.** No code yet. Today that is every operator.

#### RSLT-010 — Report exports

Core · target · **missing**

**Requirement.** Operators can export views as PDF, PowerPoint and XLSX reports.

**Acceptance.**
1. Each exported page states its charts, denominators and filters.
2. Every format contains the same selected figures and filter text as the view.
3. Aggregate-only exports apply RSLT-015/RSLT-016 to the same fixture, withholding or complementing its crosstab identically.

**Evidence.** None.
**Gap.** No code yet.

#### RSLT-011 — Scheduled report email

Core · target · **missing**

**Requirement.** Operators can schedule aggregate reports for named operators.

**Acceptance.**
1. Weekly or monthly report email includes aggregates and an authenticated-view link under NOTIFY-004 and WS-002 sending hours.
2. Two scheduled occurrences produce two deliveries without answer text or respondent identity.
3. Aggregate-only messages apply RSLT-015/RSLT-016 to the same fixture, withholding or complementing its crosstab identically.

**Evidence.** None.
**Gap.** No code yet.

#### RSLT-013 — Anonymous traffic and conversion

Core · target · **done** · From RSLT-013

**Requirement.** Results report aggregate traffic without creating visitor identities.

**Acceptance.**
1. Views, starts and submissions are reported by revision, source (link/embed/popup/QR/collector) and day, with start/completion rates beside their numerators and denominators.
2. Loading a published form before interaction increments only a revision/source/day aggregate counter; no visitor or session record is created.
3. The counter has no identifier, cookie, IP, user agent or host-page identifier and cannot join to a response or session.
4. Preview loads are excluded, and later automation signals never adjust view counts.
5. Three real loads, two starts and one completion show three views, two starts and one submission, with preview excluded.
6. Reports state that views and starts are counted separately from accepted responses.

**Evidence.** `tests/e2e/traffic.spec.ts` — "three real form loads yield two starts and one submission, while preview remains isolated"; `tests/runtime/traffic.worker.test.ts` — "anonymous view and durable start buckets report native conversion cohorts without retaining visitor metadata"; `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"
**Gap.** None.

#### RSLT-017 — Submission-time traffic exclusions

Core · target · **done** · From RSLT-013

**Requirement.** Traffic exclusions use the same owned checks as RESP-015 while keeping aggregates independent of response review.

**Acceptance.**
1. Honeypot and minimum-time checks run at submission, using the signed non-identifying form-load timestamp without a joined server-side view record.
2. Either failed check retains all answers with its respective quarantine reason under RESP-018, while a mature human submission with an empty honeypot is accepted.
3. An operator can reverse either exclusion; exclusions and reversals never change anonymous view or start counters.
4. The reported view/start/submission figures distinguish excluded responses from accepted ones.
5. The stored view fields remain only revision, source, day and count with no response linkage.

**Evidence.** `tests/e2e/traffic.spec.ts` — "three real form loads yield two starts and one submission, while preview remains isolated"; `tests/runtime/traffic.worker.test.ts` — "anonymous view and durable start buckets report native conversion cohorts without retaining visitor metadata"; `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"
**Gap.** None.

### Target: actions that are chased

#### ACT-009 — Action owner reminders

Core · target · **partial** · From ACT-009

**Requirement.** An action reminds its owner before, on and after review until its outcome is decided.

**Acceptance.**
1. Email and connected Slack/Teams reminders occur three calendar days before review, on the review date and weekly afterward while unresolved, within WS-002 hours.
2. An action created during the lead period gets its before reminder at the next eligible sending opening.
3. Each occurrence delivers once in order; repeated or concurrent scheduling cannot duplicate it, and outside-hours work is deferred rather than lost.
4. A verdict cancels queued retries and future reminders without the reminder setting a verdict itself.
5. Missing/departed owners and missing email receive no mail and show an honest explanation.
6. The action displays its reminder state and stopped state; INTEG-006 connections use the same timing, deferral and cancellation.

**Evidence.** `src/core/features/notifications/action-reminder-dispatcher.ts`, `src/core/features/actions/reminders.ts`, `migrations/core/0054_action_owner_reminders.sql`, `tests/runtime/actions-measurement.worker.test.ts`, `tests/e2e/actions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Missing a cited connected Slack/Teams owner-reminder journey for the same before/on/weekly timing, sending-hour deferral and verdict cancellation. Existing cited journeys show email only; linked-task readback moved to ACT-010.

#### ACT-010 — Linked task status

Core · target · **partial** · From ACT-009

**Requirement.** An action keeps the status of its linked external task visible and refreshed under INTEG-013.

**Acceptance.**
1. The action displays the linked task’s status.
2. Refreshing reads back that task’s current status and updates the action’s displayed status.

**Evidence.** `src/core/features/notifications/action-reminder-dispatcher.ts`, `src/core/features/actions/reminders.ts`, `migrations/core/0054_action_owner_reminders.sql`, `tests/runtime/actions-measurement.worker.test.ts`, `tests/e2e/actions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”
**Gap.** Missing a journey through the action detail and refresh door that reads linked external task status, changes it at the provider and reads the refreshed state. Existing cited evidence shows task delivery identity, not status display/readback.

### Target: alerts

#### NOTIFY-005 — Answer-based alerts

Core · target · **partial**

**Requirement.** Operators can route form alerts using the shared conditions on answers, hidden fields, scores, calculations and payment state.

**Acceptance.**
1. A matching rule notifies its named operators by email, in-app, Slack/Teams and MOB-003 push.
2. Alerts carry the form, rule and authenticated link without answer text; Slack/Teams may include a triggering answer only when the author chose it and the recipient holds the ROLE-002 identity grant.
3. Numeric and text calculations use the shared typed condition evaluator, and payment-state conditions follow PAY-001/PAY-006/PAY-007.
4. A detractor-only rule alerts once per recipient for a detractor and never a promoter; adding enterprise-plan eligibility restricts it to an enterprise detractor.
5. A calculated-total rule alerts only for its matching total.

**Evidence.** `tests/runtime/notifications.worker.test.ts` — “publisher defaults Immediately only if unset, others Off; committed private mail has a durable attempt and replay cannot double send” with `tests/runtime/answer-alert-proof.ts`; `tests/e2e/notifications.spec.ts` — “notification preference and failed delivery controls are accessible on desktop and mobile with authenticated results” (rule editor and attention at 1440/390); `src/core/features/notifications/answer-alerts.ts`, `migrations/core/0068_answer_alerts.sql`
**Gap.** Named operators receive durable email and in-app attention once per matching rule/recipient/released response. Typed LOGIC-006 conditions cover question answers, hidden fields, numeric/text calculations and payment state; proof covers detractor/promoter, enterprise conjunction, calculated total/text, pending/paid gating, no answer text, retries, unknown outcomes and erasure. Restored alert deliveries are disarmed. Configured Slack/Teams rule targets now receive one durable, identifier-only post per matching rule/released response, with failures in the integration ledger and public erasure custody; the existing notification registration includes `tests/runtime/answer-alert-chat-proof.ts`. Remaining: mobile push (MOB-003, no Apple/Google developer accounts), answer inclusion (ROLE-002), and derived quiz/outcome score operands (LOGIC-004). Ruled defaults (ct 24 Oct 19:47Z): at most 20 rules per form and 100 named recipients per rule; the recipient cohort freezes at first eligible evaluation, and later response edits do not generate another alert.

#### NOTIFY-006 — Conditional response-email content

Core · target · **partial** · From NOTIFY-006 · Cites BASE-INPUT-002

**Requirement.** Editors can define answer-bearing email rules for a form, with recipient custody governed by NOTIFY-007.

**Acceptance.**
1. A rule names operator or other recipients within the documented limit and may condition delivery on answers, hidden fields, scores, calculations or payment state through the shared LOGIC-006/LOGIC-008/LOGIC-009 evaluator.
2. Its subject and body recall answers, declared hidden fields and calculated values under LOGIC-001, with skipped/invalid values blank and every value escaped as text and HTML.
3. Dates use the question’s published FIELD-015/FIELD-020 display format and the message uses the form’s BRAND-002/BRAND-004 theme.
4. Optional Reply-To is one validated email from a question on the respondent’s path; carriage returns or newlines are refused.
5. Sensitive answers render “withheld, sign in to view”. HIPAA-mode forms include no answers or respondent identity, only form/time/authenticated link; contact/invitation identity needs the author’s ROLE-002 grant.
6. An enterprise-only condition and an alternative company-size-or-email-domain condition deliver only for their matching responses, while injected markup remains inert.
7. Per-operator answerless mail remains the default; answers leave only through these rules.

**Evidence.** `src/core/features/notifications/dispatcher.ts`, `src/core/features/notifications/compose.ts`, `tests/runtime/notifications.worker.test.ts`, `tests/e2e/notifications.spec.ts`
**Gap.** Answers, non-operator recipients, rules and Reply-To do not.

#### NOTIFY-007 — Response-email recipient custody

Core · target · **partial** · From NOTIFY-006 · Cites BASE-INPUT-002

**Requirement.** Answer-bearing form messages require verified recipient custody and retain normal exclusion/retry boundaries.

**Acceptance.**
1. A new non-operator mailbox receives one confirmation link before its first answer-bearing message; queued responses deliver once it confirms or expire after seven days with that outcome shown to the Editor.
2. Every message to a non-operator has a one-click unsubscribe that stops that rule for that address.
3. One delivery is queued per rule/recipient/released response, with quarantine admitted only on release and DIST-006 durable attempts/retries.
4. Messages use NOTIFY-004’s sender, link to the authenticated ledger without granting access, and route replies to the respondent rather than Pencil.
5. A confirmed non-operator receives one escaped answer copy with permitted Reply-To and no sensitive value; an equivalent HIPAA message has no answer text, a CRLF Reply-To refuses and unsubscribe prevents the next delivery.

**Evidence.** `src/core/features/notifications/dispatcher.ts`, `src/core/features/notifications/compose.ts`, `tests/runtime/notifications.worker.test.ts`, `tests/e2e/notifications.spec.ts`
**Gap.** Answers, non-operator recipients, rules and Reply-To do not.

### Target: regulated, accessible and retained collection

#### GOV-001 — HIPAA mode

Core · target · **missing** · Cites BASE-DATA-004, BASE-ACCESS-002, BASE-OPS-005 · Register R-10

**Requirement.** Owners can enable HIPAA mode after recording the Business Associate Agreements relied on for Cloudflare, mail and every AI or integration destination receiving PHI.

**Acceptance.**
1. PHI-form answers stay out of emails, alerts, Slack/Teams messages and AI requests unless that destination has a recorded BAA; a connection without one cannot attach to a PHI form.
2. Every PHI response view, export and download is audited, sessions expire after 15 idle minutes, and exports are labelled as containing PHI.
3. A PHI form's alert and digest contain no answers, a Slack connection without a BAA is refused, and AI analysis is refused until its provider BAA is recorded; a ledger view appears in audit.

**Evidence.** None.
**Gap.** No code yet.

#### GOV-002 — Data location

Core · target · **missing**

**Requirement.** Owners choose the response-data and upload location at installation creation, defaulting to the US where Cloudflare's jurisdiction or location controls support it.

**Acceptance.**
1. The location is recorded at creation, shown in settings and exports, and never silently changes.
2. A US-jurisdiction deployment dry run carries that choice into the generated configuration; settings and the export manifest name the same location.

**Evidence.** None.
**Gap.** No code yet.

#### GOV-004 — Sensitive fields

Core · target · **missing** · Cites BASE-ROLE-001, BASE-OPS-005

**Requirement.** A question can be marked sensitive, including tax/identity numbers, dates of birth, bank details and health answers, with encryption and disclosure rules specific to those values.

**Acceptance.**
1. Values are encrypted at rest with an installation key separate from database backups; the raw stored value is ciphertext.
2. Ledger, exports and integrations mask values unless the operator has the identity grant and reveals them; every reveal is audited.
3. Sensitive values never enter AI requests, alerts or confirmation emails.
4. An Analyst sees a mask while an Admin reveal records an audit row; provider requests contain no sensitive value.
5. LEDG-006/LEDG-008 search matches a phrase in a sensitive answer only for an operator permitted to see that answer.

**Evidence.** None.
**Gap.** No code yet.

#### GOV-005 — Audit log viewer

Core · target · **partial** · Cites BASE-AUDIT-001, BASE-DATA-003

**Requirement.** Admins can inspect Pencil's sign-in, role-change, publication, export, reveal, deletion, connection-change and approval events using the shared audit viewer.

**Acceptance.**
1. Filters include actor, form, activity and time; details remain safe and workspace-isolated.
2. An export and a role change can each be found in the viewer and its CSV export.
3. Pagination is bounded and an exported snapshot remains stable across later writes; erasing an actor tombstones its reference without losing the event.

**Evidence.** `src/core/features/audit/`, `src/core/features/audit/events.ts`, `tests/runtime/audit-viewer.worker.test.ts`, `tests/e2e/response-webhooks.spec.ts`
**Gap.** Publish, connection, export and deletion events are recorded; role-change (ROLE-001), reveal (GOV-004) and approval (WORK-002) events are unbuilt.

#### GOV-006 — Respondent privacy requests

Core · target · **partial** · Cites BASE-DATA-003

**Requirement.** Admins can handle a CCPA/CPRA access or deletion request across the data linked to an email address or phone number.

**Acceptance.**
1. The search includes responses, partials, contacts, uploads, signatures and payment references across forms, and exports them as one portable file.
2. One confirmed command applies DATA-002 erasure and requests deletion from supporting connected integrations, listing providers that cannot delete their copy.
3. Data for one email across three forms appears in the bundle; deleting it produces DATA-002 effects and a deletion request at a connected Google Sheet.

**Evidence.** `tests/e2e/answer-results.spec.ts`, `tests/runtime/analysis-safety.worker.test.ts`
**Gap.** Cross-form lookup, access export and integration deletion do not.

#### GOV-007 — Marketing and messaging consent

Core · target · **partial**

**Requirement.** Forms record purpose-specific consent for email marketing, SMS marketing or transactional SMS, including the exact wording and time.

**Acceptance.**
1. Each response records whether consent was given, the wording shown and its time for every bound purpose.
2. For email marketing only, an Editor can make the form itself an opt-in: wording appears immediately above every submitting button, belongs to the published revision and is stored with consent and time on submission, without an extra checkbox.
3. SMS marketing requires its own initially unticked question with the TCPA disclosure, cannot be form-level, and cannot be a condition of submission.
4. Mango/Mailchimp and SMS programs receive a typed or link-supplied address only with matching recorded consent and its time; missing consent appears as a skipped integration delivery with reason no marketing consent.
5. Of two otherwise matching responses, only the consented one reaches the email platform with wording and time; form-level email opt-in works without a checkbox, while publishing form-level SMS-marketing opt-in is refused.

**Evidence.** `src/core/shared/marketingConsent.ts`, `tests/runtime/new-question-types.worker.test.ts`, `src/core/features/results/ui/ConsentRecords.tsx`, `src/core/features/flows/ui/MarketingOptInSettings.tsx`, `tests/runtime/foundation.worker.test.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival”
**Gap.** Mailchimp and Mango delivery and its fixture (INTEG-007) are not built; consent records are not in exports; the TCPA wording is not checked.

### Target: moving in from every incumbent

#### IMPORT-005 — SurveyMonkey migration

Core · target · **partial**

**Requirement.** Operators connect SurveyMonkey by OAuth or upload its survey export, review every element under IMPORT-001 and import historical responses under IMPORT-002 to IMPORT-004.

**Acceptance.**
1. The review covers pages, question types including matrix/ranking, skip/display/advanced branching, collectors and custom variables; AND/OR branches map to LOGIC-006/LOGIC-008, collectors to DIST-017 and custom variables to FIELD-001.
2. Other write-ins retain their selected choice and text under FIELD-010/FIELD-017; descriptive text becomes FIELD-011/FIELD-018 statement steps.
3. FIELD-013 text minimum/maximum, masks, supported patterns and custom messages are retained, as are FIELD-016/FIELD-021 scale start, step count and low/middle/high labels.
4. A documented survey-and-response example retains a two-AND-condition branch as one rule, a matrix outcome, an Other answer, descriptive text, constrained collected text and a labelled scale; every element has a reviewed outcome, and undo removes the import.

**Evidence.** `tests/runtime/form-import.worker.test.ts` — two fresh databases produce equivalent reports, source structures, typed answers and 27 inert completions; `tests/e2e/surveymonkey-import.spec.ts` — SurveyMonkey file-pair upload reviews every supported field and names the omitted elements
**Gap.** Uploaded API v3 survey-details and responses-bulk files use the shared review/commit/undo door. Supported text validation, labeled scales, Other write-ins and declared custom variables retain their values. OAuth account connection with survey choice, skip/display/advanced AND/OR logic, source collector attribution, general matrices/ranking, descriptive text after a leading welcome and other unsupported question types remain unbuilt and explicitly reported; retained questions with unsupported routing require repair before publication.

#### IMPORT-006 — Jotform migration

Core · target · **missing**

**Requirement.** Operators connect a Jotform key or upload a form export and receive reviewed import of its structure and submissions.

**Acceptance.**
1. All/Any conditions and their operators map to LOGIC-006/LOGIC-008 and FIELD-008 show/hide; calculations retain LOGIC-003 meaning.
2. Payment fields map to PAY-006 with a reconnect prompt, uploads copy into FILE-001 storage, and signatures remain images with original submission dates rather than being re-signed.
3. Other answers on radio/checkbox fields retain their write-ins; paragraphs and headers become statements; input masks, text bounds, supported patterns and custom messages retain FIELD-013 settings.
4. Dates preserve FIELD-015/FIELD-020 format and separator, and scales preserve FIELD-016/FIELD-021 start, step count and three labels.
5. A documented example retains an Any-linked contains/empty condition as one rule, a calculation, a copied upload, payment field, radio Other text, paragraph and mask; collected answers obey imported text settings, and scale/date settings match the source.

**Evidence.** None.
**Gap.** No code yet.

#### IMPORT-007 — Typeform and Google Forms by connection

Core · target · **partial** · Register R-5

**Requirement.** Operators retrieve a Typeform definition and responses with a token, or a Google Form and responses through Google sign-in, without first exporting files and under the same review, privacy and undo rules.

**Acceptance.**
1. Typeform hidden fields become declared FIELD-001 fields; mid-flow statements, groups and inline groups, Other choices/write-ins, text maximums and date format/separator map to their corresponding FIELD clauses. Google text items and Other answers become statements and write-ins.
2. Typeform AND/OR jumps over questions, hidden fields and variables, including contains conditions, become one LOGIC-006/LOGIC-008 rule with the same decision.
3. Conditional add, subtract, multiply, divide and set actions retain starting score, price and custom-variable values as LOGIC-003 calculations; adding a constant to score for a choice becomes LOGIC-004 choice points.
4. Opinion scales retain start, steps and low/middle/high labels; a seven-step scale starting at zero remains 0–6 with its labels.
5. Typeform title, description, preview image and indexing choice map to DIST-020; fonts, element colours, background image/brightness and layouts become a reviewed BRAND-002/BRAND-004 theme. A font that cannot be self-hosted is replaced by the nearest bundled font, with the replacement disclosed.
6. A source example adding ten points for a choice and branching at ten or more routes that choice alone, with no unsupported item; a price built with multiplication/division matches the source for three answer sets.
7. Retrieved examples retain the stated theme, metadata, statements, groups and write-ins, and no source credential is retained.

**Evidence.** `src/core/features/importing/typeform-definition.ts`, `tests/runtime/typeform-definition.worker.test.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/form-import.spec.ts`
**Gap.** Typeform calculation actions are reported unsupported (`src/core/features/importing/logic.ts`).

#### IMPORT-008 — Up-and-comer and Microsoft exports

Core · target · **missing**

**Requirement.** Tally, Fillout, Formbricks and Microsoft Forms definitions and responses enter through documented exports or APIs under IMPORT-001 to IMPORT-004.

**Acceptance.**
1. Other choices/write-ins, text/statement blocks and text validation map to FIELD-010/FIELD-017, FIELD-011/FIELD-018 and FIELD-013.
2. A branching form with an Other answer, text block and responses can be imported from each source with those outcomes intact, then undone.

**Evidence.** None.
**Gap.** No code yet.

#### IMPORT-009 — Migration checklist

Core · target · **missing**

**Requirement.** Every import ends with an actionable checklist for restoring the source form's connections, distribution and delivery behavior.

**Acceptance.**
1. Items cover integrations/webhooks with the matching connection preselected, replacement embeds with new snippets, payments and email notifications to re-enable, public links, NOTIFY-006 self-notification, INTEG-017 conversions and RESP-023 identity.
2. HubSpot, Salesforce, Orbit, Mailchimp and Mango items open their mapping with the sole email question preselected as contact/member key and hidden fields listed, leaving property/merge-field confirmation to the operator.
3. Pasting a Typeform snippet preserves its mode, forwarded parameter names and static hidden values in the matching Pencil embed; an undeclared forwarded/hidden name is listed with a one-click declare action. Without a snippet, other sources prefill campaign/click-ID forwarding.
4. Items can be ticked as completed. The checklist identifies old public links, printed QR codes, sent mail and embeds as still pointing at the source, which Pencil cannot redirect, and provides each replacement link/QR plus the source's onward-redirect option.
5. A Typeform example lists webhook and Sheets items unchecked until matching connections exist; its HubSpot item selects the sole email question, and its popup snippet retains campaign/click-ID forwarding and a fixed hidden value while exposing an undeclared ref for declaration.

**Evidence.** None.
**Gap.** No code yet.

### Payments

#### PAY-001 — Payment state and safe replacement

Core · target · **partial** · From PAY-001 · Cites BASE-OPS-003, BASE-DATA-001, BASE-DATA-003 · Register R-6

**Requirement.** Pencil owns the response's verified payment state and the safe replacement of closed Checkout attempts; RL-102 governs replacement custody.

**Acceptance.**
1. Committing a payment response creates pending state; only a signature-verified event for its Checkout Session makes it paid. Later events show failed, expired or refunded state, and each provider event applies once.
2. Only paid responses complete invitations and count toward admission targets, collector limits, response mail/digests and paid-only integrations; unpaid responses trigger none of those effects.
3. Before replacement, the original Checkout must be terminal and unable to complete. Original attempt evidence is preserved, a fresh attempt is atomically bound to the same response and current Checkout preferences, and only derived current billing fields reset.
4. Pending or uncertain attempts block replacement and paid attempts never retry; until the invariant is implemented, replacement is refused, leaving the safe retry door owed.
5. Response/payment state and provider Session/PaymentIntent identities survive DATA-001 restoration without live Checkout links or return keys. DATA-002/GOV-003 erase those references with the response; no card or bank numbers are stored.
6. A correctly signed payment completes once, a forged event has no effect, and abandoned Checkout becomes expired; PAY-002 to PAY-005 and NOTIFY-005 inherit this state.

**Evidence.** `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts`
**Gap.** Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built.

#### PAY-006 — Stripe payment pricing and placement

Core · target · **partial** · From PAY-001 · Cites BASE-SECRET-001 · Register R-6

**Requirement.** Operators connect Stripe through Connect OAuth or a restricted key and configure server-priced payment steps in a form.

**Acceptance.**
1. Prices are in USD and support fixed products, quantities, option prices or a LOGIC-003 calculation bounded by minimum and maximum.
2. A payment step follows every answer setting its amount and leads directly to completion; a path reaches at most one payment step.
3. FLOW-006 refuses, naming the step, payment after completion, non-completion destinations, placement before a price-setting answer, hidden-field or skippable-question price inputs, and amounts that can exceed the bounds.
4. Calculated prices use the published revision and are recomputed on the server; the provider receives that total unchanged, and a respondent-supplied replacement amount is refused.

**Evidence.** `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts`
**Gap.** Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built.

#### PAY-007 — Checkout and respondent return

Core · target · **partial** · From PAY-001 · Cites BASE-PUBLIC-001 · Register R-6

**Requirement.** Payment questions send respondents to Stripe's hosted Checkout and return them to their own form with their answers intact.

**Acceptance.**
1. Success returns to the completion screen reached by that respondent's branch under RESP-011.
2. Cancel returns to the payment step showing every answer and marks the pending response cancelled. Stripe ends the old Checkout before PAY-001 permits its next replacement.
3. RESP-012 keys ensure the invitee's or session's next unpaid attempt replaces its prior response rather than duplicating it; completing a second attempt leaves one response.
4. An embedded form asks its host to open Checkout at top level and returns to the form's own page, without loading an inline third-party card field into the respondent surface.

**Evidence.** `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts`
**Gap.** Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built.

#### PAY-002 — Sales tax, coupons and receipts

Core · target · **partial** · Register R-6

**Requirement.** Stripe payment steps can calculate US sales tax from the respondent's address, accept coupons/promotion codes and send Stripe receipts, using PAY-001's verified state and PAY-006 pricing.

**Acceptance.**
1. The response and exports retain subtotal, discount, tax and total.
2. A taxed order with a coupon retains all four amounts exactly as the provider returns them.

**Evidence.** `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal"; `tests/e2e/calculations.spec.ts` — "authors Checkout tax, coupon and receipt settings and reads the signed totals on the response" (1440/390, CPU throttle 4)
**Gap.** Receipt delivery and per-payment receipt suppression remain unproved; Checkout email collection and Stripe account receipt settings control delivery under the adopted PAY-002 default. Proof is against the loopback Stripe stand-in in CI, and the committed Stripe test-mode receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46) stores subtotal 4000, discount 500, tax 0 and total 3500 for a coupon created through the Stripe API and deleted afterwards, matching Stripe’s Checkout Session. Stripe Tax reads active on that test account, but the run did not enable automatic tax, so the tax amount remains fixture-proved.

#### PAY-003 — Subscriptions and donations

Core · target · **partial** · Register R-6

**Requirement.** A payment step can begin a monthly/yearly Stripe subscription or take suggested/custom donations, optionally recurring, under PAY-001's state and replacement rules.

**Acceptance.**
1. The response displays subscription status changes, including later cancellation, from provider webhooks.
2. Custom donation amounts are accepted alongside subscriptions; closed subscription/donation attempts retain the safe retry scope governed by RL-102 even while replacement is temporarily refused.
3. Ongoing billing management hands off to Stripe's customer portal or Nectar.

**Evidence.** `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (monthly/yearly prices, bounded custom and recurring donations, signed cancellation, refused client amount, archive/erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" (settings and response records at 1440/390, CPU throttle 4)
**Gap.** Custom donation amounts are entered only on Stripe within the operator’s minimum and maximum, as ct approved on 24 October. Gap: pre-Stripe (in-form) amount entry; recurring custom amounts (recurring donations use fixed server-priced amounts); held-key Stripe test-mode proof. Ongoing billing management belongs to Stripe’s customer portal; no portal is built. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed.

#### PAY-004 — ACH and other US payment methods

Core · target · **partial** · Register R-6

**Requirement.** Payment steps offer Stripe ACH Direct Debit, Apple Pay and Google Pay through Checkout, plus PayPal or Square with equivalent payment states.

**Acceptance.**
1. ACH remains visibly processing until its delayed confirmation succeeds or fails; PayPal/Square use pending, paid and failed states under PAY-001.
2. Both ACH success and failure paths retain their response state, and a PayPal order can become paid.
3. Closed ACH attempts retain safe replacement under PAY-001 and RL-102; temporary refusal does not remove the retry door.

**Evidence.** `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (card/ACH Checkout methods, processing to paid/failed, replay, processing excluded from admission, archive/erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" (ACH settings and processing/paid response records at 1440/390, CPU throttle 4)
**Gap.** ACH and Checkout card wallets ship first under ct’s 24 October ruling. Gap: "and PayPal or Square as alternative providers with the same pending/paid/failed states"; "and a PayPal fixture order to paid" remain unmet, with no PayPal or Square sandbox accounts held. Real Apple Pay, Google Pay and ACH test-mode settlement are unproved. Failed ACH checkout retry and a dedicated respondent processing label remain unproved; the existing return says Stripe is confirming and the response record shows processing. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed.  Provider target retained verbatim: Payment steps can offer ACH Direct Debit (Stripe US bank account), Apple Pay and Google Pay through Checkout, and PayPal or Square as alternative providers with the same pending/paid/failed states; ACH's delayed settlement is shown as `processing` until it succeeds or fails. Acceptance retained verbatim: a Worker test drives an ACH payment through processing to succeeded and to failed, and a PayPal fixture order to paid.

#### PAY-005 — Payment ledger and refunds

Core · target · **partial** · Register R-6

**Requirement.** Operators with the identity grant can inspect, reconcile and refund response payments; RL-103 governs period completeness and uncertain/legacy records.

**Acceptance.**
1. Each ledger payment shows provider, ID, amount, method, status and last-four digits only, with status filters and export.
2. Period reconciliation includes every cursor page, or explicitly reports incompleteness and cannot be accepted as reconciled until complete.
3. Full or partial refunds use the provider after amount confirmation; their state returns by webhook. A ten-dollar refund of a forty-dollar payment shows partially refunded, with both amounts in export.
4. Uncertain-refund reservations stay held until provider readback resolves them.
5. Legacy source timestamps remain labelled historical last-change provenance, never asserted as known transaction dates, and closed totals are not silently rewritten.

**Evidence.** `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (owner refusal, over-refund, replay, filters, CSV, reconciliation mismatch, restoration and erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" ($10 of $40, 1440/390, CPU throttle 4); `docs/evidence/pay005-stripe-test-2026-10-26.json` (real Stripe test-mode receipt, `scripts/proof/payments-stripe-test.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `tests/runtime/calculations.worker.test.ts`:569 (pre-upgrade dates and disclosure), `tests/runtime/calculations.worker.test.ts`:634 (unconfirmed refund makes no provider request), `tests/runtime/calculations.worker.test.ts`:644 (provider ID suffix), `tests/runtime/calculations.worker.test.ts`:679 (reservation survives provider failure), `tests/runtime/calculations.worker.test.ts`:699 (complete ledger and CSV at 1,000, explicit refusal at 1,001)
**Gap.** Gap — Identity-granted operator payment access, refunds and reconciliation; ledgers and period reconciliation beyond 1,000 records. Direct Stripe webhook delivery and exact-head provider execution provenance remain unproved provider evidence, separate from the passing fixture Acceptance.

### Files and signatures

#### FILE-001 — File-upload questions

Core · target · **missing** · Cites BASE-INPUT-003

**Requirement.** Respondents can attach multiple files as question answers, with form-specific limits and the same custody as their response.

**Acceptance.**
1. Files remain linked to their response, pass content-signature checks, and download through expiring signed URLs with nosniff.
2. The operator sets file count, size within declared upload limits and allowed types; disguised disallowed content is refused.
3. Uploads follow RESP-010/PART-001 capture, DATA-001 export, DATA-002 erasure and GOV-003/GOV-008 retention, and stay out of AI unless AI-003 applies.
4. Where FILE-003 scanning is configured, files remain quarantined until it passes them.
5. A PDF and JPEG can be uploaded; a renamed executable is refused, the operator's signed PDF download expires, and response erasure removes the objects.

**Evidence.** None.
**Gap.** No code yet.

#### FILE-002 — Storage sync

Core · target · **missing**

**Requirement.** Uploaded files and WORK-005 submission PDFs can be copied into Google Drive, Dropbox, OneDrive/SharePoint, Box or Chest.

**Acceptance.**
1. Operators choose a per-form or per-response folder naming pattern; copies appear in INTEG-015 delivery tracking.
2. Erasure lists copies that their provider cannot delete.
3. Two uploads reach a per-response folder, and retrying a transient failure keeps the same idempotency key.

**Evidence.** None.
**Gap.** No code yet.

#### FILE-003 — Upload scanning

Core · target · **missing**

**Requirement.** A configured malware scanner, including Cloudmersive or a VirusTotal private scanner, checks uploads before operator download or storage sync.

**Acceptance.**
1. An infected file remains quarantined with its verdict and cannot be downloaded or forwarded to storage sync; clean files proceed.
2. An EICAR example remains inaccessible while a clean example is released.
3. Without a scanner, settings explicitly say uploads are unscanned.

**Evidence.** None.
**Gap.** No code yet.

#### SIGN-001 — Signature fields

Core · target · **missing**

**Requirement.** Forms can collect a typed or drawn signature after ESIGN Act and UETA consent, and hand a PDF to Inkwell for multi-party envelopes, signing order, identity verification or certificate signatures.

**Acceptance.**
1. The signed record retains the signature image, exact consent, signer's typed name/email, time, published revision and an integrity hash of the signed answers.
2. WORK-005 renders a signed PDF with its audit page; a drawn-signature example includes consent, signature and matching recomputed answer hash.
3. Later answer changes create a visible new version and cannot alter the signed version.

**Evidence.** None.
**Gap.** No code yet.

#### AI-003 — Document extraction with respondent correction

Core · target · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** A document can prefill later questions with traceable extraction and correction.

**Acceptance.**
1. A form may ask the respondent to upload a document (for example an invoice, a W-9 or a business license) and prefill later questions from fields ai provider adapter extracts; every prefilled value is shown for correction and stored with an extracted/corrected marker.
2. Extraction carries standard, adding sensitive for regulated document fields; the company’s policy decides whether readings fill the fields or wait for confirmation.
3. No identity, credit or eligibility decision is made from the extraction.
4. With the AI receiver fixture, the specialist extracts three fields from a fixture, invoice, the respondent corrects one, and the response stores two `extracted` and one `corrected` values.

**Evidence.** None.
**Gap.** No code yet.

### Feedback programs (NPS, CSAT, CES)

#### PROG-001 — Program setup

Core · target · **partial**

**Requirement.** Operators create recurring relationship or event-driven transactional NPS, CSAT and CES programs with a shared contact fatigue rule.

**Acceptance.**
1. A program chooses a FIELD-003 question set, a segment/CRM/in-product/ticket-event audience, email-embedded/SMS/in-product channels and DIST-016 cadence or PROG-002 triggers.
2. Overlapping contacts in quarterly NPS and transactional CSAT programs receive no second survey inside the fatigue window.

**Evidence.** `src/core/features/flows/templates.ts`, `tests/runtime/new-question-types.worker.test.ts`
**Gap.** Programs do not.

#### PROG-002 — Transactional triggers

Core · target · **missing**

**Requirement.** Programs survey after ticket resolution, order fulfilment, a won deal or a signed API event, after a configured delay.

**Acceptance.**
1. Sources include HappyToHelp, Zendesk, Intercom, Help Scout, Stall, Shopify, Orbit, HubSpot and INTEG-011; each event ID triggers at most one survey.
2. The response retains the triggering ticket/deal/order context, including its actor where provided, for reporting.
3. Repeating a ticket-solved event creates one delayed CSAT invitation, with its ticket ID on the response and in per-agent reporting.

**Evidence.** None.
**Gap.** No code yet.

#### PROG-003 — Score tracking

Core · target · **missing**

**Requirement.** Program dashboards show score trends and comparable respondent segments with ANLY-005 suppression.

**Acceptance.**
1. Metrics include promoter/passive/detractor or satisfied shares, a 95% confidence margin, response rate and breakdowns by account, plan, agent, channel or hidden field.
2. For a seeded quarter, weekly NPS, its margin and per-agent CSAT equal hand-computed values.

**Evidence.** None.
**Gap.** No code yet.

#### PROG-004 — Closed-loop follow-up

Core · target · **missing**

**Requirement.** Detractor, low-CSAT and high-effort responses create owned follow-up work with due time and the respondent's permission state.

**Acceptance.**
1. Owners record outreach and outcome and can send the item to HappyToHelp/Zendesk as a ticket or Orbit/HubSpot as an account task.
2. Reports show the share of detractors followed up inside the target time; anonymous items retain no contact route.
3. An identified detractor creates a follow-up item and a help-desk ticket containing only confirmed fields; closing it contributes to the follow-up rate.

**Evidence.** None.
**Gap.** No code yet.

### Integrations

#### INTEG-001 — Google Sheets

Core · target · **done** · Register R-7

**Requirement.** A form synchronizes its released responses to a chosen Google Sheet, retaining one stable row per response.

**Acceptance.**
1. Connecting backfills existing responses; three existing responses create three rows, and a fourth submission appends one row.
2. Headers identify columns by stable step ID and label; publishing a new question appends its column.
3. RESP-021 edits update the existing row, while DATA-002 erasure deletes or blanks that row.

**Evidence.** `tests/runtime/google-sheets.worker.test.ts` — "Google OAuth seals owner tokens and Sheets backfills, appends stable columns, replays failed rows without duplicates and clears an erased response"
**Gap.** None.

#### INTEG-002 — Microsoft Excel

Core · target · **missing**

**Requirement.** INTEG-001's response synchronization also writes to workbook tables in OneDrive or SharePoint through Microsoft Graph.

**Acceptance.**
1. New responses append rows to the chosen workbook table.
2. DATA-002 erasure removes the corresponding row under the same custody as Sheets.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-003 — HubSpot contact delivery

Core · target · **missing** · From INTEG-003

**Requirement.** Admins connect HubSpot by OAuth under INTEG-016 and Editors attach a form whose published disclosure names it; INTEG-018 defines property mapping and related CRM records.

**Acceptance.**
1. A chosen email question is the primary contact key on an anonymous form: released typed emails are trimmed, validated and matched case-insensitively to create or update one contact, including ordinary public/ad/embed visits without an identity parameter.
2. Identified responses use the link email only when no email question is chosen or its answer is blank. Typed answers create no Pencil contact, participant or link identity, and disclosure names the email and mapped-answer transfer before the first answer.
3. Absent disclosure sends nothing; absent typed/link email produces a skipped delivery naming no contact email. Anonymous deliveries contain no session, invitation, host-page or network identifier, only mapped answers and hidden fields.
4. Retries/replay never duplicate a contact or deal, and RESP-021 edits update mapped values on the same record.
5. Optional PART-001 early upsert sends once the email step is saved, with only answered mapped fields and partial status under the named disclosure; completion updates that contact to completed, and a retained partial's deletion sends nothing further.
6. A second differently cased email updates the first contact; blank email and omitted disclosure send nothing; abandoning an early-upsert response and completing another with the same email shows partial then completed.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-018 — HubSpot property mapping

Core · target · **missing** · From INTEG-003

**Requirement.** Editors map form data to HubSpot's existing contact, company and deal properties, and can associate related CRM work without disclosing unmapped answers.

**Acceptance.**
1. Properties and schema refresh on opening and on demand; sources include answers, FIELD-001 campaign/click-ID fields, LOGIC-003 calculations, LOGIC-004 scores/outcomes, form name, submission time and authenticated response link.
2. Choices map as labels or per-option values, multiple choices as checkbox selections, dates as dates and numbers as numbers; Pencil creates no provider property.
3. Saving refuses missing, read-only, calculated or incompatible properties and unmatched enumeration options, naming the property and reason.
4. A later deleted/changed property produces an INTEG-015 failure with HubSpot's reason and a connection-page notice; the rest of the delivery is not silently dropped.
5. Blank/skipped answers never clear a value; each property chooses overwrite, the default, or fill-only-when-empty.
6. Optional company upsert matches a mapped domain and associates the contact; optional deals use a chosen pipeline/stage, and timeline notes contain the form name and response link, never unmapped answers.
7. A typed-email example delivers mapped company and campaign values, preserves existing values for blanks, refuses missing properties by name and records a later-deleted property's provider error.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-004 — Salesforce

Core · target · **missing**

**Requirement.** Admins connect Salesforce by OAuth under INTEG-016, and Editors attach disclosed forms using INTEG-003's typed/link-email, Pencil privacy, early-upsert and nothing-sent rules.

**Acceptance.**
1. Editors choose Lead or Contact; matching is case-insensitive and prefers an existing Contact, otherwise a Lead. Multiple matches choose the most recently modified and record that choice; absent matches create a Lead with mapped or default company.
2. The selected record schema lists existing fields; Editors map answers, hidden/campaign fields, calculations, scores and response link, with picklists restricted to matching options.
3. Missing, read-only or incompatible fields are refused by name at save; later changes produce INTEG-015 provider errors. Blank answers preserve values and replay never duplicates a record.
4. Optional delivery joins a chosen or campaign-mapped campaign and opens a case.
5. Two differently cased typed emails update one Lead with mapped company/campaign data; a matching Contact creates no Lead. Blank email or omitted disclosure sends nothing, and missing fields or later type mismatches show their named refusal/failure.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-005 — Orbit

Core · target · **missing**

**Requirement.** Orbit natively receives contacts, deal notes and response links using INTEG-003's contact-key, privacy, disclosure and nothing-sent rules.

**Acceptance.**
1. Typed email on an anonymous form, or identified link email where allowed, upserts one case-insensitively matched Orbit contact; Pencil retains RESP-006 separation.
2. Answers, hidden/campaign fields, calculations and scores map to Orbit's listed contact/custom schema; missing or mistyped fields are refused by name at save.
3. Repeated differently cased emails update one contact with mapped company/campaign data; blank email sends nothing.
4. Orbit can launch a Pencil invitation from a contact or deal; a one-contact launch is accepted.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-006 — Slack and Microsoft Teams

Core · target · **partial** · Register R-9

**Requirement.** Forms and NOTIFY-005 alerts can post response summaries to Slack, Teams and Nook, and create Pencil actions from their messages.

**Acceptance.**
1. Messages contain form, time, an allowed non-sensitive-answer summary and an authenticated link; sensitive fields are refused.
2. Slack interaction signatures are checked before a message creates an action.
3. Slack and Teams remind the action owner three calendar days before review, on review day and weekly while unresolved, under ACT-009/ACT-010 and WS-002.
4. Clock advancement shows once-only reminders, sending-window deferral and cancellation after the owner verdict for both platforms.

**Evidence.** `tests/runtime/response-webhooks.worker.test.ts` — signed response events registration with `tests/runtime/chat-integrations-proof.ts` (Slack and Teams loopback posts, sensitive type refusal, signed action, calendar reminders and verdict stop); `tests/e2e/response-webhooks.spec.ts` with `tests/e2e/chat-settings-proof.ts` (Settings and form cards at 1440/390); `src/core/features/chat-integrations/`, `migrations/core/0069_chat_integrations.sql`; `docs/evidence/integ006-slack-live-2026-10-26.json` (live Slack receipt, `scripts/proof/chat-slack-live.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `tests/runtime/chat-integrations-proof.ts`:59 (authored flow and response-time metadata), `tests/runtime/chat-integrations-proof.ts`:75 (signed actor and channel refusals), `tests/runtime/chat-integrations-proof.ts`:89 (authored action fields), `tests/runtime/chat-integrations-proof.ts`:190 (old signed control refused); transport size and signature assertions at `tests/runtime/chat-integrations-proof.ts`:79, `tests/runtime/chat-integrations-proof.ts`:210 and `tests/runtime/chat-integrations-proof.ts`:221; the ten-second timeout remains unasserted
**Gap.** Gap — Nook delivery and its receiving connection; Teams message-action creation; a genuine Teams post through a licensed Microsoft 365 tenant’s incoming webhook; a genuine signed Slack interaction through the owner-configured public Interactivity Request URL; asserting proof of the approved transport boundaries. INTEG-015 retains the unbuilt chat-post replay interface under the existing uip gate.

#### INTEG-007 — Mailchimp and Mango members

Core · target · **missing** · From INTEG-007

**Requirement.** Admins connect Mailchimp by OAuth or Mango under INTEG-016; Editors attach one disclosed audience/list, with field and tag mapping governed by INTEG-019.

**Acceptance.**
1. A released response with GOV-007 consent upserts by the chosen typed email, trimmed, validated and case-insensitively matched; an identified link email is fallback only when no email question is chosen or it is blank.
2. An anonymous form's typed email remains only its answer, with no Pencil contact, participant or link identity; disclosure names email and mapped-answer transfer before the first answer.
3. New members take the chosen subscribed or pending/double-opt-in state, which sends Mailchimp confirmation mail for pending, with consent time and no IP address. Existing subscribed/pending members retain state while mapped fields/tags update.
4. Unsubscribed, cleaned or compliance-held members remain entirely unchanged and are skipped with the provider's reason; they are never resubscribed.
5. Missing disclosure sends nothing; absent consent or email is skipped as no marketing consent or no member email respectively. Partial responses never enter an audience.
6. Replay never duplicates members/tags; edits update mapped fields and add tags. Mango applies the same rules to its own schema.
7. Differently cased emails update one member; explicit-question or form-level email consent works, while no-consent and blank-email cases skip. An unsubscribed member stays unchanged, and choosing pending creates a pending member.

**Evidence.** None.
**Gap.** No Mailchimp or Mango connection exists in `src/` or `tests/`.

#### INTEG-019 — Email-platform fields and tags

Core · target · **missing** · From INTEG-007

**Requirement.** Editors map form data into existing Mailchimp merge fields, tags and interests or Mango list fields/tags, refreshed with schema on opening and on demand.

**Acceptance.**
1. Sources include answers, hidden/campaign fields, calculations, scores/outcomes, form name and submission time; names map to first/last names, choices to matching dropdown/radio options, dates to the audience's format, numbers to numbers and phones to phones.
2. Choice, multiple-choice, yes/no, ranking and quiz outcomes add one label/per-option tag per selected option or set matching interests; fixed form tags are supported, and free text never becomes a tag.
3. Saving refuses absent or incompatible fields/options and required fields left unmapped, naming field and reason. New tags are shown as new and created only after confirmation at save; agent-created changes carry external and the company's policy decides their disposition.
4. Later deleted/changed merge fields produce INTEG-015 provider errors and connection-page notices; blank/skipped answers preserve existing values, and tags are added but never removed.
5. A consented member receives mapped first name, interest tag and fixed newsletter tag; required last-name omission and missing field are refused, and a blank name preserves the prior first name.
6. A replay adds no member; deleting a mapped provider field produces its named failure. The same mapped-field/tag example adds one Mango list member.

**Evidence.** None.
**Gap.** No Mailchimp or Mango connection exists in `src/` or `tests/`.

#### INTEG-008 — Notion, Airtable and Cradle

Core · target · **missing**

**Requirement.** A form creates or updates one record per released response in Notion, Airtable or Cradle, using INTEG-016 custody and INTEG-015 delivery tracking.

**Acceptance.**
1. Destination columns/types refresh on opening and demand; sources include answers, hidden/campaign fields, calculations, scores/outcomes, form name, submission time, response ID and authenticated link.
2. Choices map by option name to single/status selects, multiple choices to multiple selects, yes/no to checkboxes, numeric answers/scales/scores to numbers, dates to dates, email/phone/URL to matching types and text to text. Uploads become authenticated text/URL links, never public attachments.
3. Save refuses absent, computed or incompatible columns by name/reason, and missing select options by name unless add missing options is enabled; then the provider creates options on first use.
4. Columns later deleted, renamed or retyped produce provider errors in the delivery ledger and connection page; blank/skipped answers never clear values.
5. A mapped response ID deduplicates retry/replay and preserves same-record updates on edit; an optional match column updates a pre-existing record instead.
6. Provider rate-limit responses honor the requested retry delay within bounded retries.
7. Each destination receives its typed record; Airtable retains choice/multiple-choice/date/number values and Notion retains title/single/multiple selects. Missing columns/options refuse by name, option creation enables delivery, rate-limited calls retry, edits update the same record and later deleted columns produce their provider error.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-009 — Zapier, Make, n8n and Crank

Core · target · **missing**

**Requirement.** Pencil publishes Zapier, Make and n8n integrations over its webhook/API doors and serves as a native Crank source.

**Acceptance.**
1. Triggers cover new/updated responses, partial saves, paid payments and approval decisions; actions find responses, create contacts and send invitations.
2. DOCS-001 recipes map answers, hidden fields and response identity into create/update actions for ActiveCampaign, Pipedrive, monday.com and Zoho CRM.
3. A REST-hook subscription receives a new-response event and can unsubscribe; the published Zapier definition validates, and each recipe's sample matches the trigger output schema.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-010 — Signed response webhooks

Core · target · **partial** · Cites BASE-OPS-003

**Requirement.** Operators register secure per-form or workspace destinations for response-created/updated/deleted, partial-save, payment-change and approval-decision events.

**Acceptance.**
1. Each delivery has a verifiable body signature, stable event ID and timestamp, with every attempt recorded, backoff retries for 24 hours and manual replay.
2. Sustained failure disables the destination and shows an alert.
3. A receiver can verify an event, fail twice, receive two retries with the same event ID and then a replay; disabled status and its alert are visible.

**Evidence.** `src/core/features/webhooks/`, `migrations/core/0063_response_event_webhooks.sql`, `tests/runtime/response-webhooks.worker.test.ts`, `tests/e2e/notifications.spec.ts`, `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites”, `docs/guide/results.md`, `src/core/features/actions/webhook.ts`, `tests/runtime/actions-task.worker.test.ts`
**Gap.** `response.updated` is now asserted through the single-use edit link in the existing signed-response-event registration. `approval decided` events (WORK-002) cannot be sent yet; bodies carry identifiers only until GOV-004 masking exists.

#### INTEG-011 — Public REST API

Core · target · **partial** · Cites BASE-ACCESS-004, BASE-ROLE-001

**Requirement.** A versioned, documented API gives scoped integration tokens the form, response, contact, invitation and result actions available to their granted role and form access.

**Acceptance.**
1. The API lists/reads forms and creates, updates, duplicates and publishes import-format definitions; validation reports dangling branches by step and publication creates an immutable revision. It also manages hidden fields, themes and webhooks.
2. Responses can be read/deleted with filters and cursor pages; contacts can be created, invitations launched and aggregates read. Admin-created tokens have scopes/expiry, hashed storage, rate limits and audit, with ROLE-002 masking/access.
3. A read-only token can page through 250 responses and is refused deletion; a form-write token creates/publishes a branching form, while invalid definitions are refused. The published OpenAPI description validates.
4. An aggregate-only token follows RSLT-009/RSLT-015 disclosure within a result: complementary figures and refusals equal those doors' aggregate-only cases.

**Evidence.** `src/core/features/reporting/routes.ts`, `tests/runtime/ledger-filters.worker.test.ts`
**Gap.** There are no tokens, versioning or OpenAPI document.

#### INTEG-012 — MCP server for Claude and ChatGPT

Core · target · **missing** · Cites BASE-AGENT-001, BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · Register R-11

**Requirement.** An authenticated MCP client can do Pencil's form and evidence jobs under the company's policy; INTEG-012 adds suppression and draft-to-outreach workflows to the Base agent door.

**Acceptance.**
1. Tools list forms, draft under AI-001, query results/crosstabs with ANLY-005 suppression, read permitted cited excerpts and prepare invitations or actions.
2. Drafting carries standard; publication or invitations carry external, and an action carries its server-computed classes. The company's policy decides each call, including whether a person confirms it in Pencil.
3. Within one result, aggregate-only disclosure follows RSLT-009/RSLT-015: complementary figures receive identical suppression/refusal.
4. Under the held company policy, an OAuth client drafts a form, receives no excerpts for a suppressed cohort and prepares an invitation without sending it until the policy's person confirms the exact action in Pencil.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-013 — Task destinations

Core · target · **partial**

**Requirement.** Pencil actions can create-or-get linked work in Linear, Jira, Asana, GitHub Issues, Vector, Todoist or a generic webhook destination.

**Acceptance.**
1. Each destination receives the confirmed payload with idempotent delivery states; repeat delivery creates no second task.
2. ACT-009/ACT-010 reads the linked task's status back onto the action and refreshes it after changes, including closed state.
3. The external status never sets Pencil's own outcome verdict.

**Evidence.** `src/core/features/actions/todoist.ts`, `src/core/features/actions/webhook.ts`, `tests/runtime/actions-task.worker.test.ts`
**Gap.** Only the behavior named in Evidence ships; the rest of the clause is not built.

#### INTEG-014 — Help-desk and commerce event sources

Core · target · **missing**

**Requirement.** HappyToHelp, Zendesk, Intercom, Help Scout, Stall and Shopify provide PROG-002 event sources, while Buoy receives per-account program scores.

**Acceptance.**
1. Each source's signed webhook is verified and unsigned events are refused.
2. An account score can be delivered to Buoy.

**Evidence.** None.
**Gap.** No code yet.

#### INTEG-015 — Integration delivery ledger

Core · target · **partial** · Cites BASE-OPS-004

**Requirement.** Operators can trace each response's outbound rows, records, contacts, messages, files, webhooks and tasks independently of ongoing collection.

**Acceptance.**
1. Every delivery retains pending, confirmed, unknown or failed state, its idempotency key and every attempt/reason, with bounded retries, replay and an in-app failure alert.
2. Operators see the exact undelivered response IDs; a broken connection never prevents collecting responses.
3. With Sheets unavailable, five responses collect and show five failures plus an alert; repair/replay yields five confirmed rows without duplicates.

**Evidence.** `src/core/features/webhooks/ledger.ts`, `src/core/features/webhooks/deliveries.ts`, `tests/runtime/response-webhooks.worker.test.ts`, `tests/runtime/actions-task.worker.test.ts`, `tests/e2e/response-webhooks.spec.ts`, `src/core/features/actions/deliveries.ts`; `tests/runtime/google-sheets.worker.test.ts` (five failed Sheets rows, alert, repair and replay and no duplicates)
**Gap.** Other row, record, contact, message and file destinations (INTEG-002 to INTEG-009), and email and SMS invitations (DIST-006), are not in the shared ledger. Google Sheets rows, attempts, failure alerts and replay now join webhook and task deliveries. The chat-post replay interface remains unbuilt and subject to the existing uip gate.

#### INTEG-016 — Connection custody

Core · target · **partial** · Cites BASE-SECRET-001, BASE-DATA-004

**Requirement.** Each provider connection has one managed custody page and automatically updates the disclosure of every attached form.

**Acceptance.**
1. Connections use least-privilege OAuth where offered; secrets are encrypted under an installation key bound to the setting's identity and excluded from data exports.
2. Operators can test, rotate and revoke the connection from its page.
3. Connecting, testing, revoking and reconnecting Sheets adds/removes Google Sheets in attached-form disclosure while exports contain no provider token.

**Evidence.** `src/core/platform/config/connections.ts`, `tests/e2e/actions.spec.ts`, `tests/e2e/analysis.spec.ts`
**Gap.** Only the behavior named in Evidence ships; the rest of the clause is not built.

#### INTEG-017 — Server-side ad conversion delivery

Core · target · **partial** · From INTEG-017

**Requirement.** Admins connect Meta Conversions API, GA4 Measurement Protocol and Google Ads click-conversion upload under INTEG-016; Editors enable them per form. Google Ads uses Google sign-in and a chosen conversion action; provider field encodings are in the operating rules.

**Acceptance.**
1. Released responses, including quarantine releases, emit completed events; PAY-001 verified payments emit paid events carrying USD amount. Each destination receives one event per submission with a shared random deduplication ID.
2. Only event/time, public form ID, declared click/campaign fields, eligible GA4 client ID and paid value travel; answer text, response IDs and scores never do. Click IDs may arrive by link or DIST-024 forwarding.
3. Hashed normalized email/phone identifiers reach Meta/Google Ads only for an identified RESP-023 form.
4. A destination receives no event unless named in that revision's RESP-005 disclosure, and Global Privacy Control opts the response out of all conversion sharing.
5. Anonymous click IDs exist only in delivery custody, never on the response, and are purged on confirmation or terminal failure.
6. Without a genuine GA4 client ID from the declared link field, opted-in host cookie or embed hidden input, GA4 is skipped as no GA4 client ID; one is never invented. Meta/Ads attribution for the same response remains unaffected.
7. Declared campaign and platform click IDs yield the matching Meta/GA4/Ads events; verified payment amount survives, missing disclosure/privacy-control refuses sharing, and the same direct ad link sends Ads alone without a client ID or adds GA4 when a declared client ID is present.

**Evidence.** `src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`
**Gap.** There is no `dataLayer` push, event ID or server-side conversion connection.

#### INTEG-020 — Embed conversion events and diagnostics

Core · target · **partial** · From INTEG-017

**Requirement.** Script embeds expose a privacy-preserving completion trigger for host-page analytics, with conversion connection diagnostics tracked alongside server delivery.

**Acceptance.**
1. The host completion event shares INTEG-017's deduplication ID; enabling the data-layer option emits one completed push containing only the event name, public form ID and event ID, never answers or response IDs.
2. DOCS-001 documents the Google Tag Manager Custom Event recipe.
3. An embed forwarding the host's Google/Meta click IDs produces the matching attributed conversions; its opted-in host analytics cookie supplies GA4's existing client ID.
4. Deliveries use INTEG-015 retries/replay and each provider's error reason; connection test actions send to Meta's test code or GA4's validation service.

**Evidence.** `src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`
**Gap.** There is no `dataLayer` push, event ID or server-side conversion connection.

### Mobile and offline

#### MOB-001 — Operator app on a phone

Core · target · **partial** · Cites BASE-ACCESSIBILITY-001

**Requirement.** Pencil's operator workflow remains usable on a narrow touch screen, in addition to the shared accessibility bar.

**Acceptance.**
1. Dashboard, builder, results, ledger, inbox, actions and settings fit 360 CSS pixels with no horizontal scroll and touch targets at least 44 pixels.
2. On a phone, an operator can build/publish a form, review a response and approve a submission.

**Evidence.** `tests/e2e/accessibility-foundation.spec.ts`
**Gap.** The submission inbox ships under WORK-001. Complete 360-pixel journeys over every operator page remain unproved, and WORK-002 approval flows remain unbuilt.

#### MOB-002 — Offline field collection

Core · target · **missing**

**Requirement.** An installable progressive web app collects responses offline on phones/tablets for field visits, events and kiosks.

**Acceptance.**
1. Responses are encrypted on device and uploaded after reconnection using RESP-012 keys, so retries create no duplicate.
2. The device shows pending-upload count; the ledger distinguishes each response's capture time from upload time.
3. Three responses completed offline arrive exactly once after reconnection, each with capture earlier than upload.

**Evidence.** None.
**Gap.** No code yet.

#### MOB-003 — Native iOS and Android apps

Core · target · **missing** · Cites BASE-ACCESS-001, BASE-SIGNIN-001 · Register R-3

**Requirement.** Native operator apps provide response/alert/approval push, results and inbox views, offline kiosk collection and installation-native or SSO sign-in; store publication is field proof.

**Acceptance.**
1. Both iOS and Android receive a new-response push and open it to approve the submission.
2. Push paths include new responses, NOTIFY-005 alerts and WORK-002 approvals; offline kiosk collection follows MOB-002.
3. An iOS simulator and Android emulator against a local installation exercise sign-in, provider-shaped push delivery and approval from the notification.

**Evidence.** None.
**Gap.** No code yet.

### Push further

#### AGENT-001 — Study designer

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist designs a short neutral study from a business question and available context.

**Acceptance.**
1. From a business question ("why are trial users not converting?") and optional context (prior forms, findings, CRM segments), the agent drafts a short study: the decision it informs, hypotheses, questions with neutral wording, a branching plan, the audience and channel, the sample needed for a stated margin of error, and the analysis plan.
2. It flags leading, double-barreled, loaded and unbalanced questions and invalid branches before the operator sees the draft.
3. Editing the draft and plan carries standard; publication and invitations carry external with the recipient and audience facts.
4. The company’s policy decides each call, and the operator can edit the study.
5. Under the held company policy, With the AI receiver fixture, the specialist turns a question into a draft whose graph, validates, whose bias check flags a planted leading question, and which stays a draft until an operator publishes it.

**Evidence.** `tests/runtime/feedback-rewrites.worker.test.ts` — rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution; `tests/e2e/analysis.spec.ts` — an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run; Studio generation runs inside both tagged tests (`tests/runtime/studio-scenario.ts`, `tests/e2e/studio-journey.ts`)
**Gap.** Studio drafts an editable decision, hypotheses, audience/channel and analysis plan with validated questions, deterministic advisory bias flags and finite-population sample sizes. Context includes typed text and prompts of explicitly selected prior forms only; prior findings and CRM segments as context remain unbuilt. Provider semantic quality and neutral wording are not established by fixture proof; advisory flags never rewrite questions.

#### AGENT-002 — Themes and contradictions

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist finds evidence-backed themes and contradictions in a fixed evidence set.

**Acceptance.**
1. Over a fixed evidence set (ANLY-002), the agent codes open text into themes with exact excerpts and also finds contradictions: cohorts whose open text disagrees with their scores, themes that reverse between revisions, collectors or segments, and questions whose answers conflict within one response.
2. Each contradiction cites the response IDs on both sides and is suppressed below the disclosure threshold.
3. Findings are labelled as analysis.
4. Accepting or dismissing an agent finding carries standard; the company’s policy decides the call.
5. Through the public door, the specialist seeds promoters whose open text complains about price and asserts one contradiction citing both cohorts with verified excerpts, and no contradiction in a suppressed cohort.

**Evidence.** `tests/runtime/analysis-output.worker.test.ts` — findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold; `tests/e2e/analysis.spec.ts` — operator analysis and finding review
**Gap.** Strict optional contradiction output validates both sides against this run, verifies exact excerpts, withholds the entire finding if either side is too small, and shares persisted accept/dismiss decisions with themes. Text and explicitly selected numeric scores can support a finding. Cross-revision, collector and segment comparison evidence and systematic question-conflict discovery remain unbuilt; model semantic accuracy is not established by fixture proof.

#### AGENT-003 — Follow-up that settles it

Core · push-further · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist proposes the smallest follow-up that settles a contradiction or evidence gap.

**Acceptance.**
1. For an accepted contradiction or an insufficient-evidence result, the agent proposes the smallest discriminating follow-up: two to five questions, the cohort to ask (only contacts who consented to follow-up, or a new public collector), and the result that would settle each hypothesis.
2. Drafting the follow-up carries standard; publishing and sending carry external with audience facts.
3. The company’s policy decides each call.
4. The follow-up links to the finding it tests.
5. Under the held company policy, the specialist uses the public door, proposes a follow-up for a seeded contradiction, targets only consenting contacts, and launches nothing until approval.

**Evidence.** None.
**Gap.** No code yet.

#### AGENT-004 — Finding into owned work, and the outcome checked

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist carries an accepted finding through an owned task and comparable measurement.

**Acceptance.**
1. After an operator accepts a finding as an action (ACT-001), the agent drafts the task for the owner's tool (INTEG-013), watches its status, proposes a comparable re-measurement (the same questions to a comparable cohort after the change ships), and reports the before/after difference with its margin of error and whether it exceeds noise.
2. Task dispatch and the re-survey carry external; recording a relied-on verdict carries commitment.
3. The company’s policy decides each agent call.
4. After a person sets a verdict, the record attributes that verdict to that person.
5. Under the held company policy, the specialist uses the public door, accepts a finding, sends the confirmed task, reads it closed, proposes and (after approval) launches the re-survey, and reports a difference with its interval while the verdict stays unset.

**Evidence.** `src/core/features/actions/service.ts`, `tests/runtime/actions-measurement.worker.test.ts`
**Gap.** Only the behavior named in Evidence ships; the rest of the clause is not built.

#### AGENT-005 — Feedback-loop sentinel

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist explains broken feedback loops and proposes a bounded repair.

**Acceptance.**
1. The agent watches integration deliveries, mail and SMS bounces, completion and drop-off, quarantine volume and evidence gaps, and explains in plain language what broke ("12 responses since Tuesday never reached the HubSpot list because the token expired"), which response IDs or tasks are affected, and a bounded repair plan.
2. Replays and outside disclosures carry external; credential reconnection carries security and gated where the provider keeps consent for a person; recipient-authority changes carry access.
3. The company’s policy decides each call.
4. The affected IDs are available through the operator’s form access.
5. Under the held company policy, the specialist uses the public door, breaks a connection and a reminder schedule, and the sentinel reports both with the exact affected IDs and a replay that runs only after approval.

**Evidence.** `src/core/features/actions/deliveries.ts`, `src/core/features/responses/completionMetrics.ts`, `src/core/features/analysis/attention.ts`
**Gap.** Only the behavior named in Evidence ships; the rest of the clause is not built.

#### AGENT-006 — Adaptive probe

Core · push-further · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** An enabled open-text question can offer one disclosed, skippable generated follow-up.

**Acceptance.**
1. On an open-text question an operator marks probe-able, the agent may ask one generated follow-up ("You mentioned setup was slow; which step took longest?") based only on that answer, labeled to the respondent as automatically generated, disclosed in RESP-005, skippable, and stored with the exact generated prompt.
2. Per-question configuration keeps the topics probing must not raise.
3. Generating a respondent-facing probe carries external; the company’s policy decides whether it runs or waits for review.
4. Probe content asks for neither identity nor sensitive data.
5. With the AI receiver fixture, the specialist answers a probe-able, question, sees one labeled follow-up, and the ledger stores the generated prompt and answer; a fixture prompt asking for an email is refused before display.

**Evidence.** None.
**Gap.** No code yet.

#### AGENT-007 — Close-the-loop drafter

Core · push-further · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist drafts a response grounded in an identified respondent’s own words.

**Acceptance.**
1. For each PROG-004 follow-up item, the agent drafts a personal reply to the respondent that addresses their actual words, citing the excerpt, and a suggested next step.
2. The owner can edit it.
3. Sending by email or as a HappyToHelp reply carries external with recipient facts, and the company’s policy decides the agent’s call.
4. Anonymous responses supply no recipient for this drafting job.
5. Under the held company policy, the specialist uses the public door, drafts a reply for an identified detractor citing its excerpt, refuses an anonymous one, and nothing is sent until the owner clicks Send.

**Evidence.** None.
**Gap.** No code yet.

#### AGENT-008 — Completion optimizer

Core · push-further · **missing** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist proposes and measures changes to questions losing respondents.

**Acceptance.**
1. From drop-off (RSLT-002), time per step and quality flags, the agent identifies the steps losing respondents, proposes specific edits, and can run them as a randomized experiment between two revisions with a stated stopping rule, reporting completion rates with intervals.
2. Draft changes carry standard and a respondent-facing experiment carries external; selecting a relied-on winner carries commitment.
3. The company’s policy decides each agent step.
4. Under the held company policy, the specialist uses the public door, seeds drop-off on one step, receives a proposal for that step, runs an approved two-revision experiment with balanced assignment, and reports both completion rates with intervals.

**Evidence.** None.
**Gap.** No code yet.

#### AGENT-009 — Migration agent

Core · push-further · **partial** · Cites BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist inventories an incumbent account and follows a reviewed move-in plan.

**Acceptance.**
1. Given a connected Typeform, SurveyMonkey, Jotform or Google account, the agent inventories every form, its responses, logic, integrations, webhooks and embeds, proposes a migration plan (which to import, which to archive, what to reconnect), runs the approved imports through IMPORT-001 to IMPORT-008, and tracks the IMPORT-009 checklist to completion.
2. Import batches carry standard, adding destructive when an operation is irreversible; reconnections carry security and gated when the provider requires a person’s consent.
3. The company’s policy decides each call; undo remains available per IMPORT-004.
4. Under the held company policy, the specialist uses the Typeform fixtures inventories three, forms, imports the two approved, leaves the third, and reports the checklist.

**Evidence.** `src/core/features/importing/typeform-definition.ts`, `tests/runtime/typeform-definition.worker.test.ts`
**Gap.** Only the behavior named in Evidence ships; the rest of the clause is not built.

## Agent surface

### Agent surface

#### SURFACE-001 — Pencil job registry

Agent surface · target · **missing** · From new · Cites BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Pencil exposes pencil job registry for its study and feedback operator.

**Acceptance.**
1. The registry covers every Core clause through the table above or its stated personal-screen, device, connector, import-door or installation reason.
2. Each listed tool binds the Pencil action and Core ids stated in that row; the registry and the table agree.
3. The Base conformance harness runs Pencil’s seeded forms, response cohorts, provider receivers and specialist jobs under both company policies.

**Evidence.** None.
**Gap.** No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented.

#### SURFACE-002 — Pencil records and changes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-003, BASE-AGENT-010

**Requirement.** Pencil exposes pencil records and changes for its study and feedback operator.

**Acceptance.**
1. Every listed form, revision, response, contact, analysis, finding, action, delivery and program resource opens its corresponding Pencil record.
2. Publishing and closing a form, releasing, editing or erasing a response, completing analysis and changing an action or delivery emit the named Pencil event with that record’s resource link.
3. A suppressed cohort does not yield response excerpts through a result tool; raw response access and aggregate-only output keep RSLT-009’s distinct disclosure boundary.

**Evidence.** None.
**Gap.** No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented.

#### SURFACE-003 — Draft, exposure and authority classes

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Pencil exposes draft, exposure and authority classes for its study and feedback operator.

**Acceptance.**
1. An internal draft edit computes standard with the form and item count; making that edit visible to outsiders also computes external with the actual audience.
2. Invitation, connector delivery and report sharing compute external with recipient count and the known, new or public counterparty from current Pencil records.
3. An operator or per-form permission change computes access with people and widening or narrowing direction.
4. A connection credential or protective setting change computes security with its setting and provider.
5. Reading a regulated response or extracting a regulated document field computes sensitive with record count and kind; ordinary feedback does not acquire that class from an agent-supplied label.

**Evidence.** None.
**Gap.** No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented.

#### SURFACE-004 — Payment, decisions and running forms

Agent surface · target · **missing** · From new · Cites BASE-AGENT-006

**Requirement.** Pencil exposes payment, decisions and running forms for its study and feedback operator.

**Acceptance.**
1. A payment, subscription, donation or refund computes money from the saved server-priced attempt, amount, currency and provider counterparty.
2. A signature, relied-on approval or effectiveness verdict computes commitment with the exact submission or action, counterparty and stated value.
3. An irreversible response erasure or retention run computes destructive with the records selected after holds and item count.
4. Publishing or closing a running form, collector or program computes live with its saved revision and affected service.
5. Provider-owned consent, verification and hosted payment steps compute gated with provider and exact step; the provider’s person-required answer adds gated before continuation.

**Evidence.** None.
**Gap.** No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented.

#### SURFACE-005 — Study-to-action specialist week

Agent surface · target · **missing** · From new · Cites BASE-AGENT-007, BASE-AGENT-013

**Requirement.** Pencil exposes study-to-action specialist week for its study and feedback operator.

**Acceptance.**
1. A stranger specialist given only the installation URL inventories seeded forms and responses, designs a branching study and checks the audience and analysis plan through MCP.
2. It publishes the study, sends the selected invitations and reads completion and delivery outcomes from Pencil.
3. It identifies an evidence-backed contradiction with exact excerpts, prepares the smallest consenting follow-up and links it to that finding.
4. It creates an owned action, dispatches the selected task payload, reads the task’s changed status and compares the re-measured outcome.
5. With the all-autonomous company policy the complete week runs without a policy hold or a policy refusal.
6. With the held company policy the same week follows the decisions for each computed class, completes the exact saved steps when the named person acts and reads the resulting records.
7. The two runs retain the same study, response, finding and action linkages; delivery retries create no second invitations or external tasks.
8. Before a complete company policy is supplied, the first specialist step changes no Pencil record and offers the policy setup link.

**Evidence.** None.
**Gap.** No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented.

## Later

None.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader review | A11Y-001 | not run | | |
| R-2 | Accessibility VPAT | A11Y-001 | not run | | |
| R-3 | Native iOS and Android store approval | MOB-003 | not run | | |
| R-4 | Real licensed Okta and Entra tenant certification | ROLE-003 | not run | | |
| R-5 | Real Typeform and Google Forms export confirmation | IMPORT-001, IMPORT-002, IMPORT-007 | not run | | |
| R-6 | Real Stripe, wallet and bank settlement receipts | PAY-001, PAY-006, PAY-007, PAY-002, PAY-003, PAY-004, PAY-005 | not run | | |
| R-7 | Real Google consent and Sheets tenant receipt | INTEG-001 | not run | | |
| R-8 | Carrier registration and genuine handset/callback delivery | DIST-011 | not run | | |
| R-9 | Licensed Microsoft Teams tenant and genuine signed Slack interaction | INTEG-006 | not run | | |
| R-10 | HIPAA business associate agreement and independent certification | GOV-001 | not run | | |
| R-11 | Claude, ChatGPT, Codex and Copilot client receipts | INTEG-012 | not run | | |
