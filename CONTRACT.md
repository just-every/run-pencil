# Pencil target product contract

Pencil is the owned form and survey platform for a US business switching from Typeform, SurveyMonkey, Jotform or Google Forms. It combines branching collection, audience distribution, response review, payment and integration workflows, and evidence-backed follow-up work, and must also beat Tally, Fillout and Formbricks.

## Product target

| | |
| --- | --- |
| Category | Online forms and surveys |
| Incumbents a buyer switches from | Typeform, SurveyMonkey, Jotform, Google Forms |
| Up-and-comers it must also beat | Tally, Fillout, Formbricks |
| First buyer | A US business, including a regulated one, collecting forms and surveys in USD in its chosen IANA time zone |

The primary journey: Build and preview a branching form, publish and distribute it, collect valid responses, review results and evidence, and close an owned action against a comparable measurement.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later remain visible and are reported separately.
- Done means every acceptance point is proved through a cited public-door journey.
- Field proof is dated separately and does not block done.
- ACCEPTANCE.md, docs/CLAIMS.md and summary counts are generated from this file.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | OPER-003, ROLE-003, MOB-003 | not run |
| BASE-ACCESS-002 | Sessions | SHELL-001, ROLE-003, GOV-001 | not run |
| BASE-ACCESS-003 | Public endpoints | RESP-015 | not run |
| BASE-ACCESS-004 | Server-side authorisation | OPER-001, OPER-002, ROLE-001, ROLE-005, ROLE-002, ROLE-003, ROLE-004, INTEG-011 | not run |
| BASE-INPUT-001 | Validation | FLOW-004, FLOW-006, FLOW-012, FLOW-013, FLOW-014, FLOW-019, AUD-001, DIST-019, RESP-003, ANLY-012, FIELD-004, FIELD-013 | not run |
| BASE-INPUT-002 | HTML | BRAND-001, BRAND-003, FIELD-011, LOGIC-001, RESP-020, RESP-027, NOTIFY-006, NOTIFY-007 | not run |
| BASE-INPUT-003 | Uploads | BRAND-001, BRAND-002, FIELD-009, FILE-001 | not run |
| BASE-SECRET-001 | No leakage | LOGIC-002, PAY-006, INTEG-016 | not run |
| BASE-SECRET-002 | Startup | OPER-003, WS-003 | not run |
| BASE-DATA-001 | Export and import | LEDG-004, DATA-001, BRAND-004, PAY-001 | not run |
| BASE-DATA-002 | Retention | FLOW-021, RESP-013, GOV-003, GOV-008 | not run |
| BASE-DATA-003 | Erasure | AUD-001, RSLT-004, DATA-002, GOV-003, GOV-008, LOGIC-002, GOV-005, GOV-006, PAY-001 | not run |
| BASE-DATA-004 | Outbound flows | LOGIC-005, FIELD-007, FIELD-009, GOV-001, INTEG-016 | not run |
| BASE-DATA-005 | Independence | HOME-001, SITE-001 | not run |
| BASE-PUBLIC-001 | Privacy | HOME-001, SITE-001, DOCS-001, BRAND-001, BRAND-003, FLOW-008, DIST-001, DIST-002, RESP-006, RESP-015, BRAND-002, FIELD-004, FIELD-005, DIST-015, DIST-020, PAY-007 | not run |
| BASE-PUBLIC-002 | Origins | DIST-002, DIST-009, DIST-022, DIST-013 | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | AUD-005, DIST-006, RESP-012, ACT-003, PAY-001, INTEG-010 | not run |
| BASE-OPS-004 | Failure is visible | DIST-006, DIST-007, DIST-008, DIST-010, ACT-004, INTEG-015 | not run |
| BASE-OPS-005 | Audit | RESP-016, DATA-002, WORK-001, WORK-002, GOV-001, GOV-004 | not run |
| BASE-ROLE-001 | Roles through every door | RSLT-004, LEDG-006, GOV-004, INTEG-011 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | RESP-016, ACT-007, GOV-005 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | none | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | none | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | ROLE-003, MOB-003 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | none | not run |
| BASE-INSTALL-001 | Free self-host and removal | none | not run |
| BASE-MAIL-001 | Truthful mail outcomes | AUD-003, DIST-003, DIST-008, DIST-010, NOTIFY-002, DIST-024 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | SITE-002, SHELL-001, BRAND-001, A11Y-001, BRAND-002, FIELD-005, FIELD-011, FIELD-014, FIELD-015, FIELD-016, LOGIC-008, A11Y-002, MOB-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | DOCS-001 | not run |
| BASE-AGENT-001 | One MCP door per seed | INTEG-012 | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-002 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | INTEG-012 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | ANLY-014, INTEG-012 | not run |
| BASE-AGENT-006 | Every action declares its risk class | RESP-018, RSLT-012, ANLY-009, ACT-005, ACT-006, INTEG-012, SURFACE-001, SURFACE-003, SURFACE-004 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | RESP-018, RSLT-012, ANLY-009, ACT-005, ACT-006, AI-001, AI-002, AI-003, INTEG-012, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009, SURFACE-005 | not run |
| BASE-AGENT-008 | Truthful attribution | ACT-005, ACT-006, AI-001, AI-002, AI-003, AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AGENT-008, AGENT-009 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | none | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-002 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | none | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | none | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-005 | not run |

## Published clauses

- `HOME-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-DATA-005
- `SITE-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-DATA-005
- `SITE-002`: *Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001
- `DOCS-001`: *Tier:* Core · *Cites:* BASE-DOCS-001, BASE-PUBLIC-001
- `SHELL-001`: *Tier:* Core · *Cites:* BASE-ACCESS-002, BASE-ACCESSIBILITY-001
- `OPER-001`: *Tier:* Core · *Cites:* BASE-ACCESS-004
- `OPER-002`: *Tier:* Core · *Cites:* BASE-ACCESS-004
- `OPER-003`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-SECRET-002
- `WS-001`: *Tier:* Core
- `WS-002`: *Tier:* Core
- `WS-003`: *Tier:* Core · *Cites:* BASE-SECRET-002
- `BRAND-001`: *Tier:* Core · *From:* BRAND-001 · *Cites:* BASE-INPUT-002, BASE-INPUT-003, BASE-PUBLIC-001, BASE-ACCESSIBILITY-001
- `BRAND-003`: *Tier:* Core · *From:* BRAND-001 · *Cites:* BASE-INPUT-002, BASE-PUBLIC-001
- `DASH-001`: *Tier:* Core
- `DASH-002`: *Tier:* Core
- `FLOW-001`: *Tier:* Core
- `FLOW-002`: *Tier:* Core
- `FLOW-003`: *Tier:* Core
- `FLOW-004`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-005`: *Tier:* Core
- `FLOW-006`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-007`: *Tier:* Core
- `FLOW-008`: *Tier:* Core · *Cites:* BASE-PUBLIC-001
- `FLOW-009`: *Tier:* Core
- `FLOW-010`: *Tier:* Core
- `FLOW-011`: *Tier:* Core
- `FLOW-012`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-013`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-014`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-015`: *Tier:* Core
- `FLOW-016`: *Tier:* Core
- `FLOW-017`: *Tier:* Core
- `FLOW-018`: *Tier:* Core
- `FLOW-019`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `FLOW-020`: *Tier:* Core
- `FLOW-021`: *Tier:* Core · *Cites:* BASE-DATA-002
- `LOGIC-005`: *Tier:* Core · *Cites:* BASE-DATA-004
- `A11Y-001`: *Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001 · *Register:* R-1, R-2
- `FIELD-006`: *Tier:* Core
- `AUD-001`: *Tier:* Core · *Cites:* BASE-INPUT-001, BASE-DATA-003
- `AUD-002`: *Tier:* Core
- `AUD-003`: *Tier:* Core · *Cites:* BASE-MAIL-001
- `AUD-004`: *Tier:* Core
- `AUD-005`: *Tier:* Core · *Cites:* BASE-OPS-003
- `AUD-006`: *Tier:* Core
- `DIST-001`: *Tier:* Core · *Cites:* BASE-PUBLIC-001
- `DIST-002`: *Tier:* Core · *From:* DIST-002 · *Cites:* BASE-PUBLIC-001, BASE-PUBLIC-002
- `DIST-003`: *Tier:* Core · *Cites:* BASE-MAIL-001
- `DIST-004`: *Tier:* Core
- `DIST-005`: *Tier:* Core
- `DIST-006`: *Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004
- `DIST-007`: *Tier:* Core · *Cites:* BASE-OPS-004
- `DIST-008`: *Tier:* Core · *Cites:* BASE-OPS-004, BASE-MAIL-001
- `DIST-009`: *Tier:* Core · *From:* DIST-009 · *Cites:* BASE-PUBLIC-002
- `DIST-022`: *Tier:* Core · *From:* DIST-002, DIST-009 · *Cites:* BASE-PUBLIC-002
- `DIST-010`: *Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-004
- `DIST-012`: *Tier:* Core
- `DIST-019`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `RESP-001`: *Tier:* Core
- `RESP-002`: *Tier:* Core
- `RESP-003`: *Tier:* Core · *From:* RESP-003 · *Cites:* BASE-INPUT-001
- `RESP-025`: *Tier:* Core · *From:* RESP-003
- `RESP-004`: *Tier:* Core
- `RESP-005`: *Tier:* Core
- `RESP-006`: *Tier:* Core · *Cites:* BASE-PUBLIC-001
- `RESP-007`: *Tier:* Core
- `RESP-008`: *Tier:* Core
- `RESP-009`: *Tier:* Core
- `RESP-010`: *Tier:* Core
- `RESP-011`: *Tier:* Core
- `RESP-012`: *Tier:* Core · *Cites:* BASE-OPS-003
- `RESP-013`: *Tier:* Core · *Cites:* BASE-DATA-002
- `RESP-014`: *Tier:* Core
- `RESP-015`: *Tier:* Core · *Cites:* BASE-ACCESS-003, BASE-PUBLIC-001
- `RESP-016`: *Tier:* Core · *From:* RESP-016 · *Cites:* BASE-OPS-005, BASE-AUDIT-001
- `RESP-026`: *Tier:* Core · *From:* RESP-016
- `RESP-017`: *Tier:* Core
- `RESP-018`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007
- `RESP-019`: *Tier:* Core
- `LEDG-001`: *Tier:* Core
- `LEDG-002`: *Tier:* Core
- `LEDG-003`: *Tier:* Core
- `LEDG-004`: *Tier:* Core · *Cites:* BASE-DATA-001
- `RSLT-001`: *Tier:* Core
- `RSLT-002`: *Tier:* Core
- `RSLT-003`: *Tier:* Core
- `RSLT-004`: *Tier:* Core · *Cites:* BASE-DATA-003, BASE-ROLE-001
- `RSLT-005`: *Tier:* Core
- `RSLT-012`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007
- `ANLY-001`: *Tier:* Core
- `ANLY-002`: *Tier:* Core
- `ANLY-003`: *Tier:* Core
- `ANLY-004`: *Tier:* Core
- `ANLY-005`: *Tier:* Core
- `ANLY-006`: *Tier:* Core
- `ANLY-007`: *Tier:* Core
- `ANLY-008`: *Tier:* Core
- `ANLY-009`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007
- `ANLY-010`: *Tier:* Core
- `ANLY-011`: *Tier:* Core
- `ANLY-012`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `ANLY-013`: *Tier:* Core
- `ANLY-014`: *Tier:* Core · *Cites:* BASE-AGENT-005
- `ANLY-015`: *Tier:* Core
- `ANLY-016`: *Tier:* Core
- `ACT-001`: *Tier:* Core
- `ACT-002`: *Tier:* Core
- `ACT-003`: *Tier:* Core · *Cites:* BASE-OPS-003
- `ACT-004`: *Tier:* Core · *Cites:* BASE-OPS-004
- `ACT-005`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008
- `ACT-006`: *Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008
- `ACT-007`: *Tier:* Core · *Cites:* BASE-AUDIT-001
- `ACT-008`: *Tier:* Core
- `NOTIFY-001`: *Tier:* Core
- `NOTIFY-002`: *Tier:* Core · *Cites:* BASE-MAIL-001
- `NOTIFY-003`: *Tier:* Core
- `NOTIFY-004`: *Tier:* Core
- `DATA-001`: *Tier:* Core · *Cites:* BASE-DATA-001
- `DATA-002`: *Tier:* Core · *Cites:* BASE-DATA-003, BASE-OPS-005
- `GOV-003`: *Tier:* Core · *From:* GOV-003 · *Cites:* BASE-DATA-002, BASE-DATA-003
- `GOV-008`: *Tier:* Core · *From:* GOV-003 · *Cites:* BASE-DATA-002, BASE-DATA-003
- `IMPORT-001`: *Tier:* Core · *Register:* R-5
- `IMPORT-002`: *Tier:* Core · *Register:* R-5
- `IMPORT-003`: *Tier:* Core
- `IMPORT-004`: *Tier:* Core
- `DIST-023`: *Tier:* Core · *From:* DIST-012

### Landing

#### HOME-001 — Public landing

**Requirement.** The installed home page opens the owner’s selected form or the shared Lobby. Branding follows BRAND-001 and BRAND-003. Details are in [the operating rules](docs/contract/MECHANISM.md#home-001).

**Acceptance.**
1. With no selected public form, the Lobby offers Finish setup until the owner completes first-run setup, then Sign in; the installation’s claim-state read gives the same answer. The legacy Pencil address redirects to this home page.
2. A selected open published form keeps its canonical respondent experience and admission checks at the home page; closing shows its standard closed state, and an archived or missing selection is unavailable just as its direct link is.
3. An optional, initially disabled static Powered by Pencil credit is available. A selected respondent landing contains no vendor marketing, pricing, invented metrics or testimonials.

### Product site

#### SITE-001 — Product page

**Requirement.** Pencil’s run site explains the software to prospective buyers; HOME-001 governs installed home pages. Details are in [the operating rules](docs/contract/MECHANISM.md#site-001).

**Acceptance.**
1. The product page explains Pencil, offers Run Pencil to its Run page, and links to the source and product documentation.
2. Its links do not open installed-instance routes. Its claims refer only to delivered clauses, without invented metrics, customers, testimonials, pricing or deferred analysis, action and notification features.

#### SITE-002 — Live answer path

**Requirement.** The product page demonstrates an adaptive answer path in its first screen.

**Acceptance.**
1. Choosing an illustrated-card answer shows the corresponding follow-up; the choice works by keyboard, announces the changed follow-up and respects reduced motion.
2. Without JavaScript, the card shows one complete question, answer and follow-up.

#### DOCS-001 — Product documentation

**Requirement.** Strangers can read Pencil’s Markdown guidance through its documentation pages.

**Acceptance.**
1. Documentation pages provide navigation, an on-page contents list and previous/next links; an unknown page returns not found.
2. The analysis guide explains that withholding changes the analysis view, Results crosstabs use the same small-cell threshold, and answer summaries, the ledger and exports remain unchanged.

### Application shell

#### SHELL-001 — Operator navigation

**Requirement.** The private operator shell connects Pencil’s implemented work surfaces.

**Acceptance.**
1. Signed-in operators can navigate between the implemented operator surfaces; the public respondent experience is never an operator-navigation destination.
2. Sign-in is sessionless and is the only entry to operator sign-in; an unauthenticated request never receives the operator shell as a fallback.

### Operators

#### OPER-001 — Equal operators

**Requirement.** Pencil’s equal-operator model gives each operator the same workspace authority.

**Acceptance.**
1. Every operator can see and act on every flow, audience, response, analysis and action; this model has no distinct roles.

#### OPER-002 — Manage equal operators

**Requirement.** Operators invite and remove peers in settings under OPER-001’s equal authority.

**Acceptance.**
1. Any operator may invite another and remove another operator, except that only the setup operator may remove themselves and the last operator cannot be removed.

#### OPER-003 — Sign-in depends on mail

**Requirement.** Magic-link sign-in makes configured mail a required external under WS-003. Details are in [the operating rules](docs/contract/MECHANISM.md#oper-003).

**Acceptance.**
1. Starting with any required mail-provider, credential or sender setting missing refuses startup and names the missing setting, rather than starting where no operator can sign in.

### Workspace

#### WS-001 — Workspace time zone

**Requirement.** The workspace uses one saved IANA time zone for business time.

**Acceptance.**
1. First-run setup offers the browser’s IANA zone as an editable starting value; established workspaces retain their configured zone.
2. Deadlines, sending windows, digest sends and operator-facing dates and times are evaluated and displayed in the saved workspace zone.
3. A published revision records the zone used for its deadline; later workspace-zone changes cannot move that open revision’s deadline.

#### WS-002 — Sending hours

**Requirement.** Scheduled mail respects the workspace’s daily sending window in the WS-001 time zone.

**Acceptance.**
1. Settings hold the daily window, initially 09:00–17:00 every day.
2. Reminders and digests due outside the window are retained and sent when it next opens.
3. Operator-triggered mail and magic links send immediately, regardless of the window.

#### WS-003 — Optional analysis and task connections

**Requirement.** Supersedes `BASE-SECRET-002` for the optional analysis and task connections only. Their absence does not prevent the rest of Pencil from starting and serving. Details are in [the operating rules](docs/contract/MECHANISM.md#ws-003).

**Acceptance.**
1. With either connection absent, every capability that does not depend on it remains available. A dependent feature in the implemented profile shows its unavailable state and page-local connection setup, with deployment configuration retained as an alternative.
2. Features deferred by the declared contract profile are omitted until implemented; an absent connection never silently produces a reduced successful result.

### Business branding

#### BRAND-001 — Saved business identity

**Requirement.** Operators save business identity independently of operator-authentication branding. Supersedes `BASE-INPUT-003` for business logos only: validated business logos are public inline images included in installation exports. Details are in [the operating rules](docs/contract/MECHANISM.md#brand-001).

**Acceptance.**
1. Save a business name, supporting line, hexadecimal RGB accent and optional PNG, JPEG or WebP logo within branding limits. A fresh workspace asks for the name at setup and uses neutral defaults until saved.
2. The saved brand appears in preview, direct/embedded forms, completion/closed states and the selected public landing. Logo removal takes effect everywhere.
3. Uploads validate size, declared type and content signature, refusing SVG. The installation serves the validated image type with content-sniffing disabled.
4. Readable foregrounds are selected for saved-accent buttons and other accent text.

#### BRAND-003 — Branded response email

**Requirement.** New-response mail carries the saved business identity from BRAND-001. Details are in [the operating rules](docs/contract/MECHANISM.md#brand-001).

**Acceptance.**
1. The message includes the saved name/supporting line as literal text and escaped HTML, the saved accent and any validated logo embedded inline rather than loaded remotely.
2. Removing the logo affects the next dispatch.

### Dashboard

#### DASH-001 — First flow

**Requirement.** A fresh workspace guides an operator from an empty dashboard to an ordinary editable form.

**Acceptance.**
1. A new deployment has no sample flows or responses; its empty dashboard explains Ask → Signal → Act.
2. The empty state and New flow offer Customer feedback, NPS, Contact/lead and a blank form. A template creates an editable draft that can be duplicated under FLOW-011.
3. Synthetic sample data is available only as an explicit local-development choice.

#### DASH-002 — Flow list

**Requirement.** Operators see the state and current activity of their flows.

**Acceptance.**
1. List draft, open, closed or archived flows by last activity, with completion count, audience and analysis state visible.
2. Invited flows show completions divided by launched participants who neither bounced nor opted out; zero eligible participants shows 0 / 0 without a percentage.
3. Anonymous public flows show starts and completions without inventing a target denominator.

### Flows

#### FLOW-001 — Flow lifecycle

**Requirement.** A flow moves from draft through publication and closure while retaining collected history.

**Acceptance.**
1. A new flow is draft; publishing opens it, and an open flow may close. A closed flow may reopen the same revision only when no deadline or target remains satisfied, or may archive. Drafts may archive; archived flows cannot reopen.
2. Draft and archived public addresses return not found; closed revisions show their closed page.
3. Archiving removes the flow from default views while preserving revisions, responses, analyses and actions.

#### FLOW-002 — Ordered form steps

**Requirement.** Operators build an ordered form of questions and named completion screens.

**Acceptance.**
1. A draft has at most one optional welcome screen, first when present, at least one question and at least one named completion screen.
2. Operators can add, edit, duplicate, reorder and delete these steps.

#### FLOW-003 — Question types

**Requirement.** The builder provides standard question types using the respondent’s controls.

**Acceptance.**
1. Choose short text, long text, email, single choice, multiple choice, rating, priority, dropdown, yes/no, NPS, number, date or consent. Each has a prompt, optional why-we-ask text, required setting and editable type-specific options within declared limits.
2. The builder canvas uses the same controls respondents see.

#### FLOW-004 — Saved edits

**Requirement.** One Save preserves content, choices and answer paths together without losing another operator’s changes.

**Acceptance.**
1. An edit names the draft version it read. Field-valid drafts may remain incomplete until publication.
2. A Save changes content, choices and paths together; invalid writes change none.
3. A current edit is durably saved before Saved appears. A stale edit returns the latest version without overwriting another edit.
4. Leaving or reloading after Saved preserves the accepted edit.

#### FLOW-005 — Answer branching

**Requirement.** The published form and preview choose the next step from the same ordered answer rules. Details are in [the operating rules](docs/contract/MECHANISM.md#flow-005).

**Acceptance.**
1. Single-choice and dropdown rules compare a stable choice ID; yes/no and consent compare booleans; rating, priority, NPS, number and calendar-date rules support equality and ordered comparison; multiple choice supports any or all selected stable IDs.
2. Priority equality compares the complete ordering; ordered comparison uses a choice’s rank.
3. Preview shows ordered rule evaluations and the chosen next step. The replaceable branch-selection policy starts with the first displayed matching rule, then the required default path.

#### FLOW-006 — Publication validation

**Requirement.** Publication checks references, termination, questions and payment placement before creating a revision.

**Acceptance.**
1. A refusal under FLOW-012, FLOW-013 or FLOW-014 lists every offending stable step ID and reason, creates no revision and leaves the draft editable.
2. Misplaced payment steps under PAY-001 are refused by step ID.

#### FLOW-007 — Preview isolation

**Requirement.** Operators try current draft paths without collecting responses or causing external effects.

**Acceptance.**
1. Preview uses test answers, identifies itself as preview, sends no invitations or other external effects and creates no response or result-count change.

#### FLOW-008 — Published revisions

**Requirement.** Publication creates an immutable numbered revision and makes it current for canonical direct and embedded addresses.

**Acceptance.**
1. Invitations, first-interaction sessions under RESP-013, completed responses, analyses and exports each record their revision.
2. Page load alone creates no session or visitor record; only RSLT-013’s anonymous aggregate view count is recorded, without an identifier, cookie or response link.

#### FLOW-009 — Edits to live forms

**Requirement.** Editing an open form prepares a new draft while its published revision stays stable.

**Acceptance.**
1. Existing invitations and first-interaction sessions stay pinned to their recorded revision. Publishing affects only later direct/embedded sessions and invitation launches.

#### FLOW-010 — Close a form

**Requirement.** Operators may close a form immediately or set a revision deadline or completion target.

**Acceptance.**
1. A deadline records its instant and the WS-001 zone used to set it.
2. Manual close stops admission on every revision. A deadline or completed-response target stops only its own revision’s admission atomically.

#### FLOW-011 — Duplicate a form

**Requirement.** Duplication creates an independent draft from the latest draft or published structure and settings.

**Acceptance.**
1. The copy has no audience, invitations, responses, analyses, actions, delivery history or external identifiers.

#### FLOW-012 — Valid branch references

**Requirement.** Branch rules refer only to questions, choices and destinations in the form being published.

**Acceptance.**
1. Each predicate names an existing structured question and, where applicable, one of its stable choices; its destination is an existing question or completion screen.

#### FLOW-013 — Reachable completion

**Requirement.** Every published path terminates in a completion screen.

**Acceptance.**
1. The first step is the optional welcome screen or first question. Every step is reachable on some path; every possible path reaches a completion screen without a cycle.

#### FLOW-014 — Valid questions

**Requirement.** A published form has at least one valid question.

**Acceptance.**
1. Each question has a nonempty prompt within its text limit; structured questions have valid, distinct options within type limits.

#### FLOW-015 — Stable question and choice identities

**Requirement.** Question and choice identities remain stable as the form evolves.

**Acceptance.**
1. Creating a step or choice gives it a stable ID. Editing, reordering, publishing, exporting and importing preserve it; duplication gives the copy new IDs.
2. Labels generate initial answer values. Renaming a saved label preserves its answer value, editable under Advanced.

#### FLOW-016 — Published policy snapshot

**Requirement.** Each revision retains its evaluated branch-selection, response-identity and response-admission policies. Details are in [the operating rules](docs/contract/MECHANISM.md#flow-016).

**Acceptance.**
1. Policy changes affect only a later publication, never a published revision.

#### FLOW-017 — Revision admission

**Requirement.** Visits, invitations and returning sessions enter their correct revision.

**Acceptance.**
1. New direct/embedded visits start the current revision; invitations start their recorded revision; returning first-interaction sessions resume their recorded revision.
2. Superseded revisions admit no new anonymous sessions; only existing invitations/sessions can reach them until admission closes.

#### FLOW-018 — Revision completion counts

**Requirement.** Deadline and target checks use completed responses from their own revision only.

**Acceptance.**
1. Reaching either condition cannot close another revision; manual close and archive close every revision.

#### FLOW-019 — Typed answer values

**Requirement.** Only these typed values are valid; wire formats and limits are in the answer operating rules. Details are in [the operating rules](docs/contract/MECHANISM.md#flow-019).

**Acceptance.**
1. Short and long text stay within character limits. Email is syntactically valid, stored as typed and compared without case sensitivity.
2. Single choice/dropdown store one stable choice of that question. Multiple choice stores distinct choices within minimum/maximum, except None alone satisfies the minimum.
3. Other contains only selected choice IDs and write-in text: IDs belong to the question and include Other; single choice/dropdown has one ID; text is nonblank within short-text and FIELD-013 limits. None cannot combine with another choice or Other; text without Other is invalid.
4. Rating is an integer within its scale. Priority orders every choice exactly once.
5. Yes/no is boolean; NPS an integer 0–10; number finite within any minimum, maximum and decimal precision.
6. Date is a true calendar YYYY-MM-DD value within any earliest/latest bounds, without time-zone conversion.
7. Consent retains boolean acceptance and its immutable published statement; required consent accepts only true.
8. Scores and contact answers retain typed, normalized values under FIELD-003 and FIELD-004.

#### FLOW-020 — Required questions follow the chosen path

**Requirement.** Required questions apply only to the chosen path.

**Acceptance.**
1. A reached required question blocks progress without an answer. A routed-around question is not asked or recorded as unanswered/missing and cannot block submission; publication need not put every required question on every path.

#### FLOW-021 — Retain answers after question changes

**Requirement.** Draft changes never rewrite previously collected answers.

**Acceptance.**
1. Deleting a step changes only that draft. Collected answers retain stable question ID and revision in the ledger, results, exports and existing analyses after later publication.
2. Earlier responses are never reported as missing answers to a question introduced later.

#### LOGIC-005 — Conditional completion and redirects

**Requirement.** A response ends on the completion screen or approved outside destination selected from its accepted answers and context. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-005).

**Acceptance.**
1. LOGIC-006 conditions over answers, hidden fields, calculations and scores choose the completion screen or an HTTPS redirect on an approved origin with only declared values appended.
2. A compound AND condition over an answer and hidden field can route two response paths to distinct completion targets.
3. Publication refuses a redirect to an unapproved origin; preview displays the selected target without navigating or collecting, and only a committed submission returns the server-derived destination.
4. Retries retain the original revision, accepted values and destination, and a copied form remaps its destination-parameter operands.

#### A11Y-001 — Accessible respondent states and layouts

**Requirement.** Pencil applies Base's shared accessibility bar to its full respondent journey, including error and unavailable states. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#a11y-001).

**Acceptance.**
1. The respondent journey covers every shipped question type and the one-question, classic-page and question-group layouts, including welcome, answer errors, progress, completion, closed-form and unavailable-resume states.
2. Each added question type or layout extends that same respondent coverage before it ships.

#### FIELD-006 — Randomized choice and question order

**Requirement.** Operators randomize choices or question blocks while retaining the exact presentation order for later analysis. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-006).

**Acceptance.**
1. Operators may randomize a question's choices or a block of questions, with Other and None of the above under FIELD-010 always anchored last.
2. Each completed response stores the order the respondent saw, and the export retains that presentation order.
3. Across 200 collected responses every stored permutation contains exactly the permitted members, retains the anchored choices and matches the exported order.

### Audience

#### AUD-001 — Contacts

**Requirement.** Operators manage contacts with names, emails and custom fields.

**Acceptance.**
1. Create, edit, import and delete contacts. Email matching ignores case; imports report matches instead of silently duplicating.

#### AUD-002 — Segments and frozen launches

**Requirement.** Saved segments filter contacts by stored fields. Details are in [the operating rules](docs/contract/MECHANISM.md#aud-002).

**Acceptance.**
1. Invitation launch records participants and evaluated eligibility/reminder policies. Later contact, segment or policy changes cannot rewrite it; AUD-006 applies current consent/existence checks before sending.

#### AUD-003 — Invitation participants

**Requirement.** Each invitee has an opaque capability and independent delivery, consent and response states.

**Acceptance.**
1. Delivery is queued, sent, bounced or failed; consent eligible or opted out; progress not started, started or completed.
2. Attempts are append-only. Public invitation addresses never contain names, emails or other contact values.

#### AUD-004 — Invitation eligibility

**Requirement.** Audience policy may narrow eligibility but cannot admit missing-email or opted-out contacts. Details are in [the operating rules](docs/contract/MECHANISM.md#aud-004).

**Acceptance.**
1. The replaceable policy initially also excludes contacts already invited to that published revision.

#### AUD-005 — Replay a launch

**Requirement.** A launch command for one revision can be retried safely.

**Acceptance.**
1. Repeating it returns its original launch without extra participants, invitation jobs or attempts.

#### AUD-006 — Eligibility at send time

**Requirement.** Invitations/reminders retain recipient snapshots but respect current consent and existence.

**Acceptance.**
1. Before sending, Pencil verifies the contact still exists and has not opted out.
2. Mail uses the email snapshot shown/recorded at launch; later edits never silently reroute an active participant.

### Distribution

#### DIST-001 — Public form link

**Requirement.** Open revisions have canonical direct links for respondents.

**Acceptance.**
1. The link renders the respondent experience without an operator session.

#### DIST-002 — Inline embed

**Requirement.** An asynchronous script or secure iframe places the same respondent experience in a host page. Isolation follows DIST-009; payment handoff follows DIST-022. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-002).

**Acceptance.**
1. Embedding does not block the host page; direct and embedded submissions produce the same response data and validation.
2. The script loads from the installation, mounts a sandboxed isolated frame and resizes to its content. A plain iframe remains available.

#### DIST-003 — Invitations

**Requirement.** An operator sends invitations to eligible participants.

**Acceptance.**
1. Each message names the business and flow, carries that participant’s opaque link, and has a durable attempt recorded before the mail-provider call.

#### DIST-004 — Reminders

**Requirement.** A reminder follows an invitation only while the respondent remains eligible.

**Acceptance.**
1. Send only to a sent participant who has not completed, opted out or bounced, while the flow is neither closed nor archived. Completion cancels pending reminders.
2. The replaceable schedule initially sends one reminder two days after invitation, released within WS-002 sending hours.

#### DIST-005 — Opt-out and renewed consent

**Requirement.** Recipients can stop flow mail without deleting their responses.

**Acceptance.**
1. Every invitation and reminder includes an opt-out link. Opt-out prevents all later flow mail to that contact regardless of policy.
2. Mail resumes only after renewed consent records actor, time and source; existing responses survive opt-out.

#### DIST-006 — Mail retry

**Requirement.** Transient mail failures retry with their original delivery identity.

**Acceptance.**
1. Retry at most five times over one hour, always using the original delivery idempotency key.

#### DIST-007 — Mail failure isolation

**Requirement.** A broken required mail connection affects mail-dependent work without stopping independent Pencil work.

**Acceptance.**
1. Invitations, reminders, notification mail and new magic-link sign-ins become unavailable with a named operator-visible error; existing sessions, direct links, embeds, response collection, results, ledger and exports keep working.
2. Recovery restores the sender; OPER-003 keeps mail required and there is no password or bypass sign-in.

#### DIST-008 — Failed invitation recovery

**Requirement.** Operators can inspect and retry a failed invitation.

**Acceptance.**
1. A permanently failed or retry-exhausted invitation shows its failed state, provider reason and retry action. Queuing alone never presents the invitation as sent.

#### DIST-009 — Embed isolation

**Requirement.** Embedded forms preserve the respondent’s privacy from their host page. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-009).

**Acceptance.**
1. Host communication validates the exact allowed origin, frame source, isolated child identity, challenge and message shape.
2. No answer, response identifier, participant capability, credential or contact value appears in host addresses, page content or messages.
3. Host messages are limited to load, height, completion and the DIST-022 checkout handoff; adding a host event needs a ct ruling.

#### DIST-022 — Embedded payment handoff

**Requirement.** An embedded payment can hand Checkout to its configured host without exposing payer data. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-002).

**Acceptance.**
1. A checkout handoff carries only a secure Stripe-owned Checkout address and its session ID, without payer data.
2. It goes to the exact owner-configured embedding origin, never a wildcard. A host outside the allowed list gets no checkout event and the respondent uses same-tab fallback.
3. Each payment attempt produces one handoff.

#### DIST-010 — Uncertain mail recovery

**Requirement.** An uncertain mail submission never silently becomes another send.

**Acceptance.**
1. Where provider lookup is supported, send-or-get uses the original delivery idempotency key.
2. Without lookup, an ambiguous timeout stays unknown without automatic retry; an operator may reconcile or explicitly resend after seeing the duplicate-delivery risk.

#### DIST-012 — Collector QR codes

**Requirement.** Each public collector has a source-labelled collection address and QR download.

**Acceptance.**
1. Named collectors and default direct/embed links offer SVG and PNG QR codes; scanning either collects a response with that collector’s source.
2. Invitation, imported and unknown buckets retain historical identity semantics but offer neither public collection addresses nor QR codes.

#### DIST-019 — Restricted collection

**Requirement.** A form can require a password, verified email or a signed link before exposing its first step.

**Acceptance.**
1. Email restrictions support allowed domains/lists and one-time codes, with one response per verified email; the business’s own app may instead issue signed links.
2. The server enforces the restriction before rendering and RESP-005 discloses any resulting identification. A respondent without the password is refused; an allowed email can verify and complete once, while its second completion is refused.

#### DIST-023 — Shared-device kiosk

**Requirement.** A shared-device form clears one respondent’s state before another begins.

**Acceptance.**
1. After completion the form restarts empty; two successive completions retain distinct responses with the kiosk collector’s source.
2. A configurable idle timeout clears abandoned browser answers. The next respondent never sees the previous answers.

### Responding

#### RESP-001 — Respondent layouts

**Requirement.** A published form presents its selected layout without builder or operator controls. Layout behavior is shared with FIELD-008 and FIELD-012.

**Acceptance.**
1. A respondent sees one welcome or completion screen at a time.
2. One-question layout presents one question per screen.
3. Classic pages present several questions per page and apply the shared page conditions of LOGIC-006, LOGIC-008 and LOGIC-009.
4. Question groups present several questions under one heading on one screen, with individual required flags and validation.
5. Classic-page progress and validation follow RESP-025; grouped progress counts each grouped question.
6. No respondent layout exposes builder or operator controls.
7. Question groups include the optional media of FIELD-005 and statement blocks of FIELD-011 and FIELD-018.

#### RESP-002 — Truthful progress

**Requirement.** Respondent progress describes the reachable path for the answers already given.

**Acceptance.**
1. The page shows the current question position and remaining reachable questions; classic layout shows the current page and remaining reachable pages instead.
2. Branching recomputes that count, excluding skipped and unreachable questions.

#### RESP-003 — Explicit and validated answers

**Requirement.** Respondents supply explicit values for the published question and its configured limits, following FLOW-019.

**Acceptance.**
1. Every question begins unanswered; false yes/no answers and zero scores or numbers count only after explicit selection or entry.
2. Rating, priority and choice questions begin unselected and require affirmative respondent selection.
3. Required fields show Required and expose required semantics.
4. An unanswered required question or invalid answer stays on screen with a field-specific error and creates no response.
5. Choosing Other requires its text even when the question is optional; empty or whitespace-only text shows “Please specify your Other answer.” and creates no response.
6. Configured Other-text validation applies in the browser and API, and None is exclusive.
7. The server accepts only values permitted by the published question type and configured limits.

#### RESP-025 — Reachable validation and answer progress

**Requirement.** Progress and validation follow the current visible path in each respondent layout.

**Acceptance.**
1. In one-question and grouped layouts, progress is the share of reachable questions answered validly or deliberately skipped when optional; remaining includes every unfinished reachable question.
2. Classic pages count reachable pages, validate only visible questions and never let a hidden required question block progress.
3. Skipping never creates an answer.

#### RESP-004 — Back navigation

**Requirement.** A respondent can revisit earlier screens and change an answer without retaining data from an abandoned branch.

**Acceptance.**
1. Back opens a screen already visited in the current session and permits editing its answer.
2. Changing an answer recomputes the forward path and progress.
3. Answers belonging to newly unreachable steps are discarded before final validation, export or analysis.

#### RESP-005 — Privacy disclosure

**Requirement.** Before answering, respondents can understand the form’s purpose, identity mode and onward use of answers.

**Acceptance.**
1. Before the first answer, the form states why feedback is requested, whether the response is anonymous or identified, who can see individual answers, and every configured external and data category that may receive answers.
2. The selected identity policy cannot suppress or weaken that disclosure; public links default to anonymous and invited responses are identified.
3. An identified publication records the chosen mode on its revision. Identifying hidden values from a public link are typed, link-supplied and unverified, and the disclosure explains the values received and the implications of forwarding the link.
4. Identifying links obey RESP-028’s revision binding and fixed-value rules.

#### RESP-006 — Anonymous means anonymous

**Requirement.** Anonymous collection retains a response without deriving respondent identity from transport or contact records.

**Acceptance.**
1. An anonymous response has no contact or participant link, no name or email copied from an invitation, contact or session, no raw IP address and no host-page identifier.
2. Its random response ID cannot be reversed to identify the respondent and is not linked to expiring rate-limit or session state.
3. A name or email knowingly typed as an answer remains only that answer and creates no contact or participant.
4. Before answering, RESP-005’s disclosure explains that such an identifying answer will identify the respondent to the operator.

#### RESP-007 — Atomic final submission

**Requirement.** Final submission commits the completed response and its required effects as one indivisible admission.

**Acceptance.**
1. The completed response, every answer, count change and durable command for each required downstream effect commit together.
2. No downstream effect is dispatched before that transaction commits.

#### RESP-008 — Admission per invitation

**Requirement.** An invitation follows the response-admission rule recorded for it.

**Acceptance.**
1. An invitation admits only the completions its recorded rule permits.
2. A visit beyond that allowance shows the existing completion state and creates no further response.
3. No rule admits a completion after RESP-009 admission closure.
4. The configurable default is one completion per invitation; anonymous direct links allow independent completions.

#### RESP-009 — Concurrent closure

**Requirement.** Final admission resolves concurrent submissions against the form’s actual remaining capacity.

**Acceptance.**
1. Final submission rechecks deadline, target and manual closure in the same admission transaction.
2. A submission that loses the last available place sees the standard closed page naming the business and form, and creates no response.

#### RESP-010 — No silent partials

**Requirement.** Pencil retains incomplete answers only when the respondent explicitly chooses save and resume under PART-002.

**Acceptance.**
1. Answers in an abandoned or reloaded session are not visible to operators, included in results, exported as responses or counted as completions.
2. A respondent-chosen save retains answers separately for resume and does not expose them to operators, completed results, analysis or default response exports.
3. Only final submission creates completed response data.

#### RESP-011 — Completion

**Requirement.** A successful submission reaches the completion screen published for that response.

**Acceptance.**
1. The respondent sees the published completion screen only after successful submission.
2. The ordinary public form link cannot edit the completed response; optional editing follows RESP-021.

#### RESP-012 — Submission retry

**Requirement.** Retrying one completed submission returns its recorded receipt instead of creating another effect.

**Acceptance.**
1. The submission key is scoped to one respondent session and published revision and retained with the completed response.
2. Retry returns the same response ID and completion screen, without incrementing counts or dispatching downstream effects twice.

#### RESP-013 — Session metrics

**Requirement.** The first respondent interaction creates limited, expiring session state for the form’s collection metrics.

**Acceptance.**
1. Session state contains only an opaque session ID, revision ID, source, start time, furthest-reached stable step ID, coarse mobile/tablet/desktop class and FIELD-006 choice/block presentation identities.
2. It contains no answers, contact identity, raw IP, user-agent string or host identity.
3. The session pins the revision and supplies starts, drop-off, device and completion-time metrics.
4. Abandoned sessions expire after the documented retention period, and RESP-019 preserves only their aggregate metrics.

#### RESP-014 — Submit failure

**Requirement.** A failed final submission keeps the respondent’s work available for a safe retry.

**Acceptance.**
1. A final request that did not commit leaves the respondent off the completion screen and preserves the current in-browser answers.
2. A visible, retryable error lets the respondent retry with the original submission key.

#### RESP-015 — Owned abuse defenses

**Requirement.** Pencil checks public submissions using defenses the installation owns; the operating rules document the limits and signed load-time mechanism.

**Acceptance.**
1. Every submission checks a hidden honeypot, the documented minimum elapsed time from form load, and a submission token bound to the respondent session.
2. Elapsed time comes from the signed, non-identifying form-load timestamp, with no visitor identity or server-side view record linked to it.
3. A missing or unrecognized session token produces a visible retryable error naming the expired session; the response is never silently discarded.
4. Honeypot and minimum-time submissions retain their reasons and answers under RESP-016 and RESP-017 for review and reversal under RESP-018.

#### RESP-016 — Retained bot exclusions

**Requirement.** A honeypot submission remains recoverable in quarantine while staying outside accepted collection.

**Acceptance.**
1. A filled honeypot produces the ordinary completion screen and atomically retains every answer with the honeypot reason in quarantine.
2. An excluded response changes no accepted-response count, admission check, result, analysis evidence set, notification or other downstream effect.
3. Exclusion and reversal leave anonymous view and start counters unchanged.
4. An operator can read the reason and answers and reverse a false positive under RESP-018, after which it counts as an ordinary completed response.
5. The exclusion audit identifies the defense and revision without answer text or respondent identity.
6. Exclusion creates no visitor identity or server-side view record; the retained response follows DATA-002 erasure and its form’s retention rules.

#### RESP-026 — Exporting automated exclusions

**Requirement.** Automated-exclusion exports are an explicit option separate from quarantine review and accepted results.

**Acceptance.**
1. Default exports omit honeypot and minimum-time exclusions.
2. An operator may explicitly include them; each included response is marked quarantined with its exclusion reason.
3. Inclusion keeps the same filter and cutoff, changes no accepted count or downstream effect, and does not release the response.

#### RESP-017 — Retained minimum-time exclusions

**Requirement.** A submission failing only the minimum elapsed-time check is retained for review rather than lost.

**Acceptance.**
1. The signed load-time check commits every answer with the minimum-fill-time reason in quarantine under RESP-007.
2. An excluded response stays outside completed counts, admission checks, results, analysis evidence and notifications.
3. Response exports follow RESP-026’s default omission and explicit-inclusion rules.
4. An operator can read and reverse a false positive under RESP-018, making it an ordinary completed response.
5. Exclusion and reversal leave view/start counters unchanged and create no visitor identity or server-side view record.
6. The retained response follows its form’s retention and DATA-002 erasure rules.

#### RESP-018 — Quarantine review

**Requirement.** Operators can inspect and resolve each quarantined response.

**Acceptance.**
1. The revision’s quarantine list shows every held response’s answers and the defense that held it.
2. An operator can release or delete each response; deletion follows DATA-002.
3. Release makes it an ordinary completed response at that moment and recomputes every affected count, rate and result.
4. Release works after admission closure and records the acting operator and time without reopening admission or retriggering its deadline or target.
5. A response leaves quarantine only through an explicit resolution; when an agent resolves it, the call carries standard for release or destructive for irreversible deletion, and the company’s policy decides the disposition.

#### RESP-019 — Retained flow metrics

**Requirement.** Collection keeps historical aggregate metrics after private session state expires.

**Acceptance.**
1. On completion or expiry, a session’s start, furthest step, device class and completion outcome fold into per-revision counters.
2. Those counters hold only counts, cannot be traced to a session, response or person, and remain with the revision after session expiry.
3. Every historical starts, drop-off and device figure uses those counters, which contain no partial answer.

### Response ledger

#### LEDG-001 — Response ledger

**Requirement.** Operators can list and open the released completed responses of a form.

**Acceptance.**
1. Every row retains its stable response ID, form revision, source, participant when identified, started/submitted times and each answer keyed by stable step ID.
2. A quarantined response appears only in RESP-018 review until release.

#### LEDG-002 — Collection counts

**Requirement.** Collection counts come from retained collection records rather than delivery or preview activity.

**Acceptance.**
1. Completed-response and participant counts derive from stored completed responses and participants.
2. Starts derive only from RESP-013 sessions and RESP-019 counters.
3. Preview, duplicate submission, failed delivery, abandoned session, dropped submission and unreleased quarantine never increment completed responses.

#### LEDG-003 — Response filters

**Requirement.** The ledger and its exports use the same selected response identities.

**Acceptance.**
1. Operators can filter by revision, submission time, source, participant status and structured answer.
2. Filtering preserves the response IDs shown in the ledger, exports and supporting evidence.

#### LEDG-004 — Response export

**Requirement.** An operator can download a fixed selection of responses as lossless CSV or JSON.

**Acceptance.**
1. Starting the export fixes its filter and evidence-cutoff time.
2. Default exports contain exactly the matching released responses committed by that cutoff, including response/revision IDs, source, timestamps, stable step IDs/labels and lossless values for every answer, including open text.
3. Quarantined and excluded responses stay out until release, and the export states how many were excluded.
4. RESP-026’s explicit automated-exclusion option is the sole exception: included responses are marked with their exclusion reasons and obey the same filter/cutoff without release, changed accepted counts or downstream effects.

### Results

#### RSLT-001 — Response summary

**Requirement.** Every published revision has a results view independent of AI analysis.

**Acceptance.**
1. Question-answer summaries appear before session metrics.
2. The current combined revision/response filters govern completed responses, starts, completion rate and average completion time, each shown beside its underlying counts.
3. Imported completions contribute to answer summaries and completed counts but never native starts, completion-rate numerators or duration samples; their count is stated separately.
4. The view is available from publication, shows zeros before the first session and does not wait for analysis.
5. Operators with response access keep complete summaries beside a suppressed crosstab; aggregate-only reports apply RSLT-015/RSLT-016 to crosstabs without suppressing answer summaries.

#### RSLT-002 — Drop-off by question

**Requirement.** Results preserve per-question collection reach and drop-off after session expiry.

**Acceptance.**
1. Every published step shows how many sessions reached it and how many reached no later step.
2. The figures use RESP-019 counters and remain readable after the sessions expire.
3. A never-reached step is shown with zero rather than omitted.

#### RSLT-003 — Stated denominators

**Requirement.** Every results and analysis percentage identifies the population it measures.

**Acceptance.**
1. Each percentage names its numerator, denominator and filtered set; changing a filter changes both together.
2. Single-answer distributions divide by responses that answered the question and their parts sum to that denominator.
3. Multiple-choice distributions use that same denominator, are labeled multiple-select and may exceed one hundred percent in total.
4. A response-only filter shows started-to-completed within filtered responses and states that view-based rates are unfiltered; revision/date-only views use views.
5. Imported history never enters native starts, completion numerators or durations.
6. Completion is kept distinct from per-question answer rates.

#### RSLT-004 — Device split

**Requirement.** Results present only coarse device classes and keep their response-export boundary, including RL-104’s archive exception.

**Acceptance.**
1. Device shares follow the combined revision and response filters, with the numerator and denominator stated under RSLT-003.
2. A coarse mobile, tablet or desktop class is derived at session start and linked to its response for filtering; revision-wide unlinked session counts do not satisfy a filtered split.
3. No fingerprint is retained; the class erases with its response and historical missing classes remain honestly unknown.
4. Device class is excluded from every response export.
5. Under RL-104, its sole archive exception is the private integrity-checked whole-installation restore archive of DATA-001; restoration preserves erasure fences and applies current authority.

#### RSLT-005 — Results across revisions

**Requirement.** Cross-revision reporting compares questions only within the revisions that actually contained them.

**Acceptance.**
1. Each question uses the responses that could have answered it as its denominator.
2. A question added later is never treated as unanswered by earlier responses.
3. Different stable step IDs never merge, even when their labels match.

#### RSLT-012 — Open-text coding

**Requirement.** Operators can organize open text with workspace codes, manual assignments and exact-excerpt AI suggestions.

**Acceptance.**
1. A person can assign codes, accept a suggestion citing the exact retained excerpt or reject it; a rejected suggestion creates no assignment.
2. Code assignments retain who or what made them and drive charts, filters and code crosstabs.
3. Coding twenty answers manually and twenty by accepted suggestions yields the correct counts and filters with no code from rejected suggestions.
4. Agent code-assignment decisions carry standard, adding sensitive for regulated personal data; the company’s policy decides their disposition.
5. Raw-authorized operator panels stay complete; aggregate-only code crosstabs obey RSLT-015/RSLT-016, including the refusal fixture.

### Analysis

#### ANLY-001 — Analysis run

**Requirement.** Operators can request analysis for any published revision with completed responses.

**Acceptance.**
1. The requested run is durably queued and exposes queued, running, completed, insufficient-evidence or failed state.
2. The configurable autorun policy starts analysis when a form closes with at least five completed responses by default.

#### ANLY-002 — Fixed evidence set

**Requirement.** An analysis keeps the exact collection evidence it read.

**Acceptance.**
1. It records the exact response IDs and revision and reads only released responses.
2. Later submissions or quarantine releases are excluded from that run and mark the completed analysis stale instead of changing it in place.

#### ANLY-003 — Findings

**Requirement.** A completed analysis presents ranked findings from its fixed evidence set.

**Acceptance.**
1. It ranks themes and selects one primary finding.
2. Insufficient-evidence runs follow ANLY-013 instead.

#### ANLY-004 — Exact evidence

**Requirement.** Analysis distinguishes retained respondent words from generated interpretation.

**Acceptance.**
1. Every respondent quote is an exact excerpt of a stored answer.
2. Generated paraphrases and summaries are labeled analysis and never quoted or attributed as a respondent’s words.

#### ANLY-005 — Disclosure threshold

**Requirement.** Analysis presentation protects cohorts below its configured disclosure threshold.

**Acceptance.**
1. A theme or filtered segment below threshold reveals no raw excerpt, participant identity, unique field combination or breakdown; exactly the threshold is permitted.
2. The configurable default is five completed responses in the theme or current filter cohort.
3. Suppression affects presentation, not the operator’s raw ledger or export.
4. RSLT-014 crosstabs and RSLT-015/RSLT-016 aggregate reports use the same threshold under their own rules; an authorized operator’s own summaries, ledger and exports remain complete.

#### ANLY-006 — Recommendations

**Requirement.** A sufficient analysis can identify one primary action supported by its findings.

**Acceptance.**
1. The recommendation includes rationale, linked findings, confidence, expected impact and effort.
2. An insufficient-evidence run proposes no action.
3. The configurable selection policy defaults to the action supported by the highest-impact finding with sufficient evidence.

#### ANLY-007 — Staleness

**Requirement.** A stale analysis remains available as an historical record of its original evidence.

**Acceptance.**
1. It stays readable and shows its evidence cutoff.
2. Operators can request a new analysis while prior runs remain in history, except for DATA-002 erasure redaction.

#### ANLY-008 — Provider failure

**Requirement.** Unavailable analysis never fabricates a result or stops ordinary form collection.

**Acceptance.**
1. An unconfigured or failed provider marks the analysis or builder-assistance request failed with its error and retry action.
2. No suggestion, finding or recommendation is invented.
3. Form publication, response collection, ledger and exports continue working.

#### ANLY-009 — Builder assistance

**Requirement.** Operators can request sharper, broader or contextual draft-question wording while preserving the original text. Agent changes carry their class and follow the company’s policy.

**Acceptance.**
1. A suggestion shows the source wording and the proposed rewrite.
2. An operator can accept or reject the proposal; a stale version cannot overwrite a later draft edit and publication remains a separate action.
3. An agent’s application of wording carries standard; a publication that exposes a form outside the business carries external. The company’s policy decides whether either call runs, is reviewed, waits or is refused.

#### ANLY-010 — AI usage and cost

**Requirement.** Operators can inspect the usage and cost of analysis and builder-assistance calls.

**Acceptance.**
1. Each call records provider, model, input/output usage, feature, analysis or draft ID and reported cost.
2. The usage view totals calls and cost by day and feature.

#### ANLY-011 — Evidence provenance

**Requirement.** Operators can follow analysis figures and excerpts back to the retained evidence that supports them.

**Acceptance.**
1. Each displayed theme count, percentage, supporting excerpt and recommendation records its included response IDs.
2. Navigating from displayed evidence opens those retained responses.

#### ANLY-012 — Output validation

**Requirement.** Provider output must agree with the analysis’s fixed evidence before the run can complete.

**Acceptance.**
1. Pencil checks the output schema and that every cited response belongs to the evidence set.
2. Quote ranges match stored answers exactly, and counts/percentages are recomputed from that evidence.
3. Any failed check marks the run failed.

#### ANLY-013 — Insufficient evidence

**Requirement.** Analysis can truthfully report that its evidence cannot support a finding.

**Acceptance.**
1. Insufficient evidence or insufficient disclosure-eligible cohorts produce an insufficient-evidence outcome.
2. The outcome shows the evidence cutoff and reason and emits no theme, quote or recommendation.

#### ANLY-014 — Untrusted evidence

**Requirement.** Respondent text remains evidence rather than instructions to the analysis or its adapters.

**Acceptance.**
1. Respondent text cannot change system instructions/configuration, select tools, call adapters, create jobs or authorize effects.
2. Provider output that violates the required schema fails under ANLY-012.

#### ANLY-015 — Analysis and report policy snapshots

**Requirement.** Historical analysis and saved aggregate reports retain the disclosure policy bound to them.

**Acceptance.**
1. Each analysis stores the evaluated disclosure and recommendation-selection configuration.
2. A later policy change applies to a new analysis and never reveals or reinterprets historical output retroactively.
3. A saved/shared aggregate view records its threshold at save/share and uses a threshold never below that record under RSLT-015/RSLT-016.
4. Lowering the current policy reveals nothing in that saved/shared view; the operator’s current-threshold results page does not require saved-view snapshots.

#### ANLY-016 — Provider retry

**Requirement.** Transient analysis transport errors retry the original request without changing its evidence or policy.

**Acceptance.**
1. A transient provider failure retries at most three times over ten minutes, preserving request, evidence set and policy snapshot.
2. Schema and evidence-validation failures are terminal and never retried as transport failures.

### Actions and measurement

#### ACT-001 — Action record

**Requirement.** An operator can turn an analysis recommendation into owned work.

**Acceptance.**
1. The action retains title, rationale, owner, target metric, review date and links to the analysis and its evidence.
2. Accepting the action does not itself contact an external service.

#### ACT-002 — Action lifecycle

**Requirement.** Actions have an explicit lifecycle with attributed transition history.

**Acceptance.**
1. A new action starts planned.
2. Planned can move to in progress or closed; in progress to ready for review or closed; ready for review to effective, ineffective, in progress or closed; effective/ineffective to closed.
3. Each transition records its operator, time and optional outcome note.

#### ACT-003 — External task

**Requirement.** The configured task destination creates or returns one remote task for a Pencil action.

**Acceptance.**
1. Repeated activation or delivery uses the action’s same key and returns the existing remote task ID.
2. Retry never creates a second remote task for that action.

#### ACT-004 — Task failure

**Requirement.** Task delivery problems remain visible without losing local work.

**Acceptance.**
1. An unconfigured task connection makes external task creation unavailable with setup guidance.
2. A failed call retains the local action, records the attempt/error and offers a same-key retry.

#### ACT-005 — Follow-up measurement

**Requirement.** Actions retain comparable measurements and a separate attributed outcome decision.

**Acceptance.**
1. An action records metric name, unit, desired direction, baseline value, source and observation time.
2. An operator can link a later form or analysis and record the comparable observed value and time.
3. Effective/ineffective is a separate decision: recording a measurement or passing a review date never sets or changes the verdict as a side effect.
4. A past review date is surfaced on the action for resolution.
5. An agent’s verdict call carries commitment and the company’s policy decides its disposition; attribution follows the actor who made the decision.

#### ACT-006 — Exact task payload

**Requirement.** An external task binds the exact action payload being sent, without raw response content.

**Acceptance.**
1. The product shows the action fields and authenticated report link that would leave the installation.
2. A person can confirm that displayed payload; the sent values equal that confirmed revision and changed values require a new decision.
3. Raw answers and excerpts are never included.
4. An agent’s send carries external and the company’s policy decides the disposition, without treating an agent-provided flag as a person’s confirmation.

#### ACT-007 — Task delivery state

**Requirement.** Operators can follow an external task’s recorded delivery attempts.

**Acceptance.**
1. Delivery shows pending, confirmed, unknown or failed, its key, every attempt and the remote task ID when confirmed.
2. An uncertain network result retries with the same key and is never assumed failed or retried with a new one.

#### ACT-008 — Manual recommendation

**Requirement.** An operator can write a recommendation directly from retained results evidence.

**Acceptance.**
1. The resulting ACT-001 action links a form, published revision and optionally one question, with the displayed result counts frozen at that moment.
2. Its evidence contains no response IDs, answer excerpts or cohort filters.
3. A manually written action has no analysis link; an action accepted from analysis requires that link.
4. All other ACT-001 through ACT-007 requirements still apply.

### Notifications

#### NOTIFY-001 — Analysis attention

**Requirement.** The notification center records each terminal analysis outcome for its intended operators.

**Acceptance.**
1. Manual analysis completion/failure records one notification for the requesting operator.
2. Automatic close-time analysis records one for each unmuted operator.
3. Duplicate queue delivery never duplicates the same notification.

#### NOTIFY-002 — New-response mail

**Requirement.** Each operator chooses immediate, daily or off response notifications for each form.

**Acceptance.**
1. Publication selects Immediately for the publisher only when no preference exists; other operators and existing unrepublished forms default Off.
2. A message uses the saved business identity, names the form and submission time in the workspace zone, and links to the authenticated results ledger.
3. It contains no answer text, respondent identity or access-granting link.
4. A committed released response queues one delivery per opted-in operator with durable attempts, bounded retries and explicit confirmation of uncertain outcomes.
5. Daily delivery follows NOTIFY-003 and keeps its recipient snapshot separate from immediate mail.
6. Payment-form notification waits for PAY-001/PAY-006/PAY-007 payment.

#### NOTIFY-003 — Daily digest

**Requirement.** A digest groups one operator’s newly completed responses for one form and local day.

**Acceptance.**
1. It sends at the WS-002 opening hour in the WS-001 zone and covers completions committed since the previous digest.
2. One operator/form/day produces one digest; an empty day sends nothing.
3. A failed digest retries under DIST-006 with its original day rather than merging into the next day.
4. Payment-form digest admission waits for PAY-001/PAY-006/PAY-007 payment.

#### NOTIFY-004 — No mail loops

**Requirement.** Outbound form mail cannot turn replies or operator-mail bounces into respondent activity.

**Acceptance.**
1. Notifications, digests, invitations and reminders use the configured no-reply address, or Managed hosting’s assigned verified sender, and are marked auto-generated.
2. Pencil ingests no inbound mail; a reply or vacation response cannot create a response, participant, notification or further outbound message.
3. Operator notification/digest bounce state belongs only to that operator’s mail setting and never marks a participant bounced.
4. Participant bounce state comes only from DIST-008 invitation/reminder delivery.

### Data

#### DATA-001 — Export contents

**Requirement.** Pencil's portable archive retains its complete product graph as original data, including relationships that connect a response to its collection, evidence and follow-up work.

**Acceptance.**
1. The archive includes every operator, contact, segment, flow, revision, step, branch, participant and delivery attempt; released and quarantined responses and answers retain their state and RESP-019 counters.
2. It includes analyses, evidence links, recommendations, actions, notifications, settings, audit entries and referenced original files.
3. Restoration preserves stable graph, revision, response, evidence, recommendation and action links.

#### DATA-002 — Response erasure

**Requirement.** Erasing a Pencil response, directly or through its owning contact, removes its influence from collection and analysis while preserving honest aggregate and delivery history.

**Acceptance.**
1. Erasure revokes and deletes active invitation tokens, removes contact links or anonymizes retained delivery facts, and removes the response's answers, raw excerpts and evidence links from every analysis.
2. Affected aggregates are recomputed or marked unavailable, and affected analyses become redacted and stale.

#### GOV-003 — Retention schedules

**Requirement.** Supersedes `BASE-DATA-002` only for a form whose owner opts into a retention schedule; other forms retain Base's retention rule. Pencil schedules deletion of form data with advance notice; legal holds and release are governed by GOV-008.

**Acceptance.**
1. An Admin configures a retention period for responses, partials, uploads, signatures and payment references; deletion applies DATA-002's recomputation, redaction and stale-analysis effects. The installation owner manages the setting and notices until ROLE-001 supplies Admins.
2. The period is a whole number of elapsed 24-hour days from completion, or from a private save's creation; private saves retain their original link expiry.
3. Every deletion receives at least seven days of in-app notice, including data already older than a newly enabled period.
4. Released and quarantined completions, imported-response custody and private PART-002 saves receive the same schedule; FILE-001, SIGN-001, PAY-001/PAY-006 and PART-001 inherit it.
5. A 30-day schedule leaves aged data untouched during notice, then removes it with DATA-002 effects. An unconfirmed, unauthorized or stale setting change is refused without changing the schedule.

#### GOV-008 — Legal hold and release

**Requirement.** An Admin can hold a form's scheduled deletion and private-save expiry, then release it into a fresh notice period. The installation owner exercises this authority until ROLE-001 supplies Admins.

**Acceptance.**
1. Legal hold preserves released and quarantined completions and private saved responses past their automatic deletion or save-data expiry; it never revives an expired resume link.
2. Releasing hold starts a fresh seven-day notice window before automatic deletion.
3. Manual DATA-002 erasure remains available during hold.
4. The retention page shows the active hold and the notice created on release; settings survive reload on desktop and phone.

### Form imports

#### IMPORT-001 — Reviewed definition

**Requirement.** Operators review a documented form definition before importing it as an editable Pencil draft.

**Acceptance.**
1. Import creates a new draft with new stable IDs.
2. Before writes, every field, screen and logic action is listed with its source type, imported/changed/unsupported outcome, explicit change and reason.
3. Unsupported logic leaves its affected paths incomplete; native graph validation continues to control publication.

#### IMPORT-002 — Reviewed CSV

**Requirement.** Operators map and acknowledge response-file changes before any public import is published; interrupted preparation remains private and recoverable.

**Acceptance.**
1. Every CSV column can map to a supported question, timestamp or Skip; every row error is reported.
2. Blank answers stay unanswered, and malformed values or configured capacity excess are refused before commit.
3. Commit requires acknowledgement of every reported change or omission; canceling review creates no job, flow or response.
4. Acknowledgement stores owner-private indexed preparation using bounded database transport.
5. Continue verifies the complete stored fingerprint before publishing any job, form or response.
6. Interrupted preparation can be retried or canceled under current authority; erasure removes retained copies and prevents publication or resurrection.

#### IMPORT-003 — Historical privacy and pinning

**Requirement.** Imported completions remain honest historical records, isolated from live collection and later draft changes.

**Acceptance.**
1. Released imported completions retain their original timestamps, remain anonymous, identify their source as imported and retain an immutable revision matching the mapped source.
2. Hidden values and network/IP metadata are discarded before durable planning; original file bytes are not retained, and the omission is disclosed before commit.
3. Import creates no respondent session, contact, mail, outbox event or admission effect.
4. Later draft edits cannot reinterpret historical answers.

#### IMPORT-004 — Durable replay and reversal

**Requirement.** A reviewed Pencil import can resume and reverse from durable custody without losing native edits or requiring the original files. The Base import kit owns source identity, bounded application and undo.

**Acceptance.**
1. Identical files create no duplicate native records; interruption resumes the exact stored safe plan.
2. Undo removes unedited imported records while exact native snapshot guards preserve and report later edits.
3. Completed reversal is idempotent and retains its safe plan and provenance.
4. Published import work resumes and undoes without the original files.

## Target clauses

### Target: roles, sharing and sign-in

#### ROLE-001 — Workspace roles

*Tier:* Core · *From:* ROLE-001 · *Cites:* BASE-ACCESS-004

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

#### ROLE-005 — Workspace roles: For roles without form-response access, it inherits the RSLT-009 aggregate-only fixtu

*Tier:* Core · *From:* ROLE-001 · *Cites:* BASE-ACCESS-004

**Requirement.** This part of ROLE-001 covers for roles without form-response access, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#role-001).

**Acceptance.**
1. For roles without form-response access, it inherits the RSLT-009, RSLT-015, RSLT-016 aggregate-only fixture: the same figures are refused or complemented identically.
2. A Viewer gets the aggregate-only form and is refused the ledger and export.

#### ROLE-002 — Per-form access and folders

*Tier:* Core · *Cites:* BASE-ACCESS-004

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

#### ROLE-003 — Single sign-on and provisioning

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-SIGNIN-001 · *Register:* R-4

**Requirement.** Pencil supports single sign-on and provisioning. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-003).

**Acceptance.**
1. Owners can require SAML 2.0 or OpenID Connect sign-in through the business identity provider (Okta, Microsoft Entra ID, Google Workspace, JumpCloud or the sibling Auth), map IdP groups to ROLE-001, ROLE-005 roles, and accept SCIM 2.0 provisioning so a deprovisioned user loses every session within one minute.
2. Magic-link sign-in remains the break-glass path for Owners only when SSO is enforced.
3. Through the public door, signs in through a test OIDC provider and a signed SAML assertion, maps a group to Analyst, then a SCIM `active:false` PATCH revokes the session and the next request is refused.

#### ROLE-004 — Builder collaboration

*Tier:* Core · *Cites:* BASE-ACCESS-004

**Requirement.** Pencil supports builder collaboration. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#role-004).

**Acceptance.**
1. Operators with edit access can leave comments on a draft step, mention another operator (who receives an in-app notification), resolve the thread, and see who last saved each step.
2. Concurrent edits stay safe under FLOW-004's version check.
3. Through the browser, has two operators comment and resolve on one step; a stale save by the second is refused with the latest version shown.

### Target: form design themes

#### BRAND-002 — Form design themes

*Tier:* Core · *From:* BRAND-002 · *Cites:* BASE-INPUT-003, BASE-PUBLIC-001, BASE-ACCESSIBILITY-001

**Requirement.** Editors choose a named per-form theme; a new form starts from the workspace default, based on BRAND-001 identity. Theme reuse and revision custody follow BRAND-004. Details are in [the operating rules](docs/contract/MECHANISM.md#brand-002).

**Acceptance.**
1. A theme chooses question and answer/button fonts from bundled open-licensed families or owner-licensed uploaded WOFF2, with size/signature validation and installation-local serving.
2. Set separate RGB colors for questions, answers, buttons, button text and background; choose a solid background or PNG/JPEG/WebP image with −100 to 100 brightness and a focal point, and a corner style.
3. Welcome, question and completion screens each choose image/video placement above, beside left/right or full-bleed behind, with a separate phone layout.
4. The theme applies to preview, direct, embedded, popup and kiosk forms and completion/closed states; respondent confirmation and response-notification mail use its colors.
5. Text/background pairs, including the adjusted background image, meet Base accessibility requirements. A11Y-002 refuses publication with the failing pair and screen named.

#### BRAND-004 — Reusable theme custody

*Tier:* Core · *From:* BRAND-002 · *Cites:* BASE-DATA-001

**Requirement.** An Editor’s theme library supports campaigns, clients and reusable team templates. Details are in [the operating rules](docs/contract/MECHANISM.md#brand-002).

**Acceptance.**
1. Duplicate, rename and delete themes; refuse deletion while a draft or published form uses the theme. Installation exports retain the library.
2. A published revision snapshots its theme. Editing a theme lists affected forms and changes each only at its next publication.
3. A TMPL-002 team template retains its chosen theme; a new form made from that template uses it.

### Target: templates and generated forms

#### TMPL-001 — Template gallery

*Tier:* Core

**Requirement.** New form offers a searchable gallery of at least 60 US-business templates that become ordinary editable drafts.

**Acceptance.**
1. Categories include customer feedback, NPS, CSAT, CES, product research, employee engagement/eNPS, event registration, contact/lead capture, orders/payments, job applications, client intake, W-9/vendor onboarding, quizzes and GOV-001 patient intake.
2. Every template previews in the respondent experience and passes FLOW-006 publication; templates using payments, uploads or signatures show required connections before creation.
3. Every gallery template can be created and published without validation errors; a branching template can be found by search, previewed, created and used to collect a response.

#### TMPL-002 — Team templates

*Tier:* Core

**Requirement.** Editors can turn a draft or published form into a reusable workspace template; Admins can retire it. The installation owner exercises Admin retirement until ROLE-001 supplies that role.

**Acceptance.**
1. Templates retain structure, logic, branding choice and question settings, excluding publication deadlines, response targets, responses, audiences, connection credentials and external IDs.
2. A new form receives new stable IDs and correctly remapped logic; its questions and settings match the saved template.
3. New forms use the workspace brand until BRAND-002/BRAND-004 supplies per-form theme carryover; those clauses retain that obligation.
4. Retirement removes the template from reuse without deleting forms already created from it.

#### AI-001 — Generate a form from a prompt or a document

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The configured AI provider drafts an editable form from a goal or source document.

**Acceptance.**
1. An operator describes the goal in words, or pastes or uploads a document (Word, PDF, Google Doc export, an existing paper form or a SurveyMonkey/Typeform question list), and the configured ai provider adapter drafts a form: question types, choices, required flags, branching, hidden fields and a completion screen.
2. The draft opens in the builder with each generated step marked, passes FLOW-012 to FLOW-014 before it can be published, and its agent publication, distribution and connection calls carry external and, for connection credentials, security or gated as the provider step requires; the company’s policy decides each step.
3. Uploaded source documents are used for this request only and are not retained.
4. Using an AI receiver fixture, turn a prompt and a two-page PDF into graph-valid drafts; schema-invalid output writes no draft. In the browser, edit and publish the generated form under the held company policy.

### Target: the complete builder

#### FIELD-001 — Hidden fields and URL parameters

*Tier:* Core

**Requirement.** Operators attach declared, typed context to a response without adding visible questions; identifying context follows the form's identity mode. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-001).

**Acceptance.**
1. Operators declare each hidden field's name, type and identifying status, and classify it as campaign, click identifier, identifying or plain context. Click identifiers are used only by INTEG-017 and INTEG-020.
2. Declared values may come from a direct link, an embed's fixed attributes, its host page's URL parameters, its explicit hidden-value call or analytics cookie, an in-product survey, or an invitation; invalid or undeclared values are discarded and a missing declared value is blank.
3. Accepted values are stored with the response and appear in the ledger, filters, crosstabs under RSLT-006, exports and the named integration consumers, and may drive answer recall and branching, completion, visibility, alert and email conditions.
4. An identifying hidden field is admitted on a direct link or embed only in the identified mode under RESP-023; the disclosure identifies that effect before the first answer, and an anonymous revision refuses identifying parameters at publication.
5. Aggregate-only views neither cross nor summarize identifying hidden fields under RSLT-009.
6. A declared context value routes the response by its condition, omission routes by the blank-value condition, and the CSV export carries only declared values.
7. Script forwarding, fixed values and explicit hidden values under DIST-021 and DIST-024 obey the same declaration filter; DIST-015, DIST-003, INTEG-001 through INTEG-011, INTEG-015, INTEG-017, INTEG-020, LOGIC-005, NOTIFY-005, NOTIFY-006 and NOTIFY-007 retain their stated consumer obligations.

#### FIELD-002 — Matrix, Likert and scale grids

*Tier:* Core

**Requirement.** A matrix collects several stable rows against a shared answer scale and reports each row independently. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-002).

**Acceptance.**
1. A matrix supports single- or multiple-selection rows and five- or seven-point Likert scales, with a stable identity for each row.
2. Each row has a distribution with the denominators under RSLT-003 and is available to the shared condition model under LOGIC-006.
3. Each row is a crosstab dimension under RSLT-006 and RSLT-014, with stated shares, the same chi-square rule and ANLY-005 suppression.
4. A published four-row, five-column matrix accepts responses, reports the hand-counted values, exports a distinct column keyed to each stable row and crosses one row against another.

#### FIELD-003 — CSAT, CES and visual rating questions

*Tier:* Core

**Requirement.** Typed satisfaction, effort, emoji and thumbs questions provide comparable scores independently of survey-program setup under PROG-001. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-003).

**Acceptance.**
1. CSAT uses the fixed one-to-five satisfaction scale and reports the share of four-or-five answers with its denominator.
2. CES uses the fixed one-to-seven effort scale and reports the arithmetic mean with its denominator.
3. Emoji and thumbs answers retain their fixed semantics and report their distributions; score exports retain normalized numeric or boolean values.
4. Collected answer sets produce the hand-computed CSAT percentage and CES mean, independently of PROG-001 program setup.

#### FIELD-004 — US contact fields

*Tier:* Core · *Cites:* BASE-PUBLIC-001, BASE-INPUT-001

**Requirement.** Respondents enter structured contact details and USD amounts with type-specific validation and useful exports. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-004).

**Acceptance.**
1. A phone answer retains an E.164 number and separate optional extension and displays the number in US format; international numbers remain accepted.
2. A postal address retains street, optional unit, city, two-letter state, five- or nine-digit ZIP and country, including the non-US address option.
3. A full name retains its component parts, a website answer is a valid URL, and a USD amount retains exact cents rather than accepting fractional cents.
4. Valid contact values are admitted and invalid phone, ZIP, state, name, URL or amount values show a field-specific error through the form and API.
5. CSV and JSON downloads carry the normalized values and formatted columns, including separate phone extensions and name parts.

#### FIELD-005 — Media in questions and choices

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-PUBLIC-001

**Requirement.** Question steps and choices support accessible visual media without contacting a video provider before play. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-005).

**Acceptance.**
1. A step may carry an image with required alt text or a YouTube or Vimeo video through an approved host's privacy-enhanced embed.
2. An image choice retains its label, and publication refuses an image whose required alt text is empty.
3. The respondent page contacts the video provider only after the respondent chooses play.

#### FIELD-007 — Scheduling handoff

*Tier:* Core · *Cites:* BASE-DATA-004

**Requirement.** A scheduling step hands a respondent to an existing booking service and retains its confirmed appointment. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-007).

**Acceptance.**
1. The step opens the business's booking page in Dial, Calendly or Google Calendar appointment schedules, rather than implementing availability or calendars in Pencil.
2. Name and email are passed only when the respondent entered them and the disclosure names the destination; anonymous collection passes neither.
3. A Dial or Calendly-compatible booking completes through the provider handoff and its confirmation stores the booked time with the response.

#### FIELD-008 — Classic page layout

*Tier:* Core

**Requirement.** Operators build forms with several questions on each page, including conditional questions within that page. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-008).

**Acceptance.**
1. A classic page shows multiple questions together and applies LOGIC-006 conditions to earlier answers, including earlier answers on the same page.
2. Branching and required-on-path under FLOW-020 apply per page; hidden required questions cannot block navigation or submission, and only visible questions are validated.
3. Progress under RESP-002, RESP-003 and RESP-025 counts reachable pages, alongside the one-question and grouped layouts named by RESP-001.
4. A three-page form with in-page conditional questions completes with the correct reachable-page progress and without retaining newly hidden answers.

#### FIELD-009 — Video and audio answers

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-004

**Requirement.** Respondents record media answers and operators review the recording and any configured transcription as response evidence. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-009).

**Acceptance.**
1. A question may accept browser-recorded video or audio up to the operator's chosen length after explicit camera or microphone permission.
2. The recording is retained as an upload under FILE-001; when the AI provider is configured it is transcribed, and analysis uses that transcript while authorized operators may open the clip.
3. A ten-second recording can be played back by the operator through its authorized download, and its transcript appears in the ledger and analysis evidence.

#### FIELD-010 — Other write-ins and exclusive None choices

*Tier:* Core · *From:* FIELD-010

**Requirement.** Choice questions offer an optional write-in and an exclusive none answer without losing their stable choice identity. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-010).

**Acceptance.**
1. Single-choice, multiple-choice and dropdown questions may offer Other; multiple choice may also offer None of the above. Each has a stable choice identity under FLOW-015 and an editable translated label under LANG-001 and LANG-003.
2. Selecting Other reveals a required short-text answer governed by the stated limits and FIELD-013 validation, and deselecting Other discards that text.
3. Selecting None clears all other choices, selecting another choice clears None, and None alone satisfies a multiple-choice minimum; a submission combining None with another choice is refused.
4. Stored answers preserve the chosen stable identities and the Other text beside its choice; an empty or whitespace-only Other answer is refused with a field-specific error and creates no response.
5. Results count Other and None with RSLT-003 denominators and list write-ins as open text available to RSLT-012 coding, LEDG-003 filters, LEDG-006 and LEDG-008 search, and analysis evidence.
6. CSV and JSON exports under LEDG-004 retain Other text in its own column beside the choice column, keyed by stable question identity.
7. FLOW-005 branches on Other or None, LOGIC-001 recalls the write-in, and FIELD-006 keeps Other and None anchored last during randomization; the respondent sees the write-in appear and other selections clear when None is chosen.

#### FIELD-017 — Import Other choices and historical write-ins

*Tier:* Core · *From:* FIELD-010

**Requirement.** Moving a form into Pencil preserves its Other option and every historical write-in without inventing a replacement choice. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-010).

**Acceptance.**
1. Typeform Other-choice definitions and response write-ins, and Google Forms Other options with typed values, map to the stable Other choice and text under IMPORT-007.
2. SurveyMonkey's Other answer and text map under IMPORT-005, and Jotform's Other options on radio and checkbox fields map under IMPORT-006.
3. Typeform and Google Forms imports with historical Other responses retain every write-in on its matching Other choice with the exact text.

#### FIELD-011 — Statement screens between questions

*Tier:* Core · *From:* FIELD-011 · *Cites:* BASE-INPUT-002, BASE-ACCESSIBILITY-001

**Requirement.** Operators insert answerless information screens between questions and route respondents through them. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-011).

**Acceptance.**
1. A statement may appear anywhere between questions, with headings, emphasis, lists and approved HTTPS links, LOGIC-001 recall, optional FIELD-005 media with required alt text and a Continue label editable under LANG-002.
2. A statement asks for no answer and is a valid branch destination, including a quiz's per-question feedback under LOGIC-004.
3. Progress and required checks never count a statement as a question; RSLT-002 counts a reached step rather than an answered question, and the response, ledger and exports contain no statement answer.
4. Inside a classic page under FIELD-008 the statement appears as a text block between questions; FLOW-002 admits statement steps beyond the optional first welcome screen.
5. A form routing through a recalled statement displays its Continue label, counts only the two surrounding questions in progress and leaves no statement answer in the ledger or CSV; publication refuses its image when alt text is missing.

#### FIELD-018 — Import statement screens

*Tier:* Core · *From:* FIELD-011

**Requirement.** Moving a form into Pencil keeps its intervening information items as ordered statement steps. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-011).

**Acceptance.**
1. Typeform Statements after the welcome screen and Google Forms text items map to statement steps under IMPORT-007.
2. Jotform paragraph and header fields map under IMPORT-006, and SurveyMonkey descriptive-text items map under IMPORT-005.
3. A Typeform form with a welcome and two statements between questions retains both statements in their original order in the import review.

#### FIELD-012 — Question groups

*Tier:* Core

**Requirement.** Operators place several individually validated questions together under one heading within a one-question-at-a-time form. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-012).

**Acceptance.**
1. A group has one heading, optional description and optional FIELD-005 media; every member keeps its stable identity, type, required flag and validation.
2. Next validates every visible member and remains on the group with field-specific errors until its required questions are answered; progress counts each grouped question.
3. Conditions after the group may test any member, and the group is one branch destination under FLOW-012 and FLOW-013.
4. A group may contain statement text under FIELD-011 and FIELD-018 but cannot contain a nested group.
5. A published group of three questions with one required shows all three together, reports the required error, routes by a grouped answer and counts three questions in progress.
6. Typeform groups and inline groups map under IMPORT-007 to one group containing their questions in the import review.

#### FIELD-013 — Text length, masks and patterns

*Tier:* Core · *Cites:* BASE-INPUT-001

**Requirement.** Operators constrain text answers and give respondents useful, matching validation in the form and API. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-013).

**Acceptance.**
1. Short and long text support operator-set minimum and maximum character counts within the question-type limits, with a live character counter whenever a maximum is set.
2. Short text may use a digit/letter/alphanumeric input mask or a bounded linear-time pattern without backreferences or lookaround, with a custom error message translated under LANG-001 and LANG-003; publication refuses patterns outside that subset.
3. The form and API apply the same rules: minimum three, maximum ten and a three-digit/four-digit phone mask refuse two characters, eleven characters and a mask mismatch with a field-specific error while admitting 555-0100; the form shows the counter and custom error.
4. Typeform maximum lengths, SurveyMonkey text validation and Jotform input masks retain faithful length, mask, supported-pattern and custom-error settings under IMPORT-005 through IMPORT-007; a Typeform maximum of 150 remains 150.

#### FIELD-014 — Long choice lists

*Tier:* Core · *From:* FIELD-014 · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** Operators create large choice lists and respondents find an answer without losing keyboard or screen-reader access. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-014).

**Acceptance.**
1. A dropdown supports at least 1,000 choices and single- and multiple-choice questions support at least 250 choices.
2. A dropdown filters anywhere in each label, case- and accent-insensitively, and its filtering and selection remain accessible under A11Y-001.
3. The builder accepts one choice per pasted line and names duplicate and blank lines before save; pasting 300 lines with one duplicate identifies that duplicate.
4. Operators insert and edit built-in lists of the 50 US states, District of Columbia and US territories with their USPS codes, and countries with ISO 3166-1 alpha-2 codes.
5. A respondent typing united sees only matching countries and selects United States by keyboard; country and 1,000-choice dropdowns collect stable choice identities.
6. Publication refuses one choice above the configured limit and names the question; an imported list above the limit is reported with its question and count rather than silently truncated.

#### FIELD-019 — Long forms without layout penalties

*Tier:* Core · *From:* FIELD-014

**Requirement.** A form's question capacity remains available when its questions are arranged in pages or groups. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-014).

**Acceptance.**
1. A published revision supports at least 250 questions; each question counts once whether standalone, grouped or on a classic page.
2. Statements, groups and pages consume a separate structure allowance, so choosing those layouts does not shrink the question budget.
3. The declared question, choice and structure limits meet these floors with recorded seeded load measurements, and the public-screen and answer-transition p95 bars continue to hold on the longest permitted form.
4. A 250-question form mixing groups and pages collects a complete response; an imported form over the limit is reported with its count rather than silently truncated.
5. FIELD-008 classic pages, FIELD-011 and FIELD-018 statements, FIELD-012 question groups and A11Y-001 retain their own acceptance obligations at these capacities.

#### FIELD-015 — Locale-independent date entry and display

*Tier:* Core · *From:* FIELD-015 · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** Operators choose a question's calendar format and respondents see that same format throughout their answer journey. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-015).

**Acceptance.**
1. Editors choose MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD and a slash, hyphen or dot separator; the language default follows LANG-001 and LANG-003, including MM/DD/YYYY for US English and US Spanish, with a per-question override.
2. Respondents enter labeled month, day and year fields in that order, or use an accessible date picker, independently of the browser locale; the answer is displayed in the chosen format.
3. The answer, LOGIC-001 recall, review, completion, ledger and response emails use the published format; NOTIFY-006, NOTIFY-007, RESP-020, RESP-027 and WORK-005 carry it into answer-bearing emails, confirmations and submission PDFs.
4. An impossible or out-of-bounds date is refused with a field-specific error naming the expected format.
5. The stored calendar value remains YYYY-MM-DD under FLOW-019, leaving CSV, JSON, API and integration values unchanged.
6. In an en-GB browser, 07/04/2026 entered under MM/DD/YYYY appears that way in recall and review and exports as 2026-07-04; 02/30/2026 is refused, and the same entered date under DD/MM/YYYY is stored as 2026-04-07.

#### FIELD-020 — Import date formats

*Tier:* Core · *From:* FIELD-015

**Requirement.** A moved form keeps its source date-entry format instead of adopting the installation's locale. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-015).

**Acceptance.**
1. Typeform month/day/year, day/month/year and year/month/day structures and separators map under IMPORT-007 to the corresponding question settings.
2. Jotform date formats retain their source format under IMPORT-006.
3. A Typeform day/month/year date with a dot separator arrives in the import review with that same format and separator.

#### FIELD-016 — Labeled opinion scales

*Tier:* Core · *From:* FIELD-016 · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** Operators publish a numeric rating scale with meaningful labels while keeping its answers and reports numeric. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-016).

**Acceptance.**
1. A rating question starts at zero or one, has two to eleven steps and may label its low, middle and high points with up to 100 characters each, translated under LANG-001 and LANG-003.
2. On phone and desktop the low, middle and high labels sit over the corresponding steps, including between the two middle steps for an even count; each step's accessible name joins its number and any label.
3. The stored answer is the number; numeric conditions, LOGIC-003 calculations, recall and results use it, and the results distribution includes every step with endpoint labels on its axis.
4. NPS retains its fixed zero-to-ten scale and two labels. Other scale starts, lengths and labels belong to the published revision, and each revision's results retain that revision's scale.
5. A labeled zero-to-six scale shows Not at all, Neutral and Completely over zero, three and six; answering zero routes through a less-than-two condition and retains zero in the ledger and CSV.
6. Publication refuses one or twelve steps and a 101-character label.

#### FIELD-021 — Import opinion scales and labels

*Tier:* Core · *From:* FIELD-016

**Requirement.** Moving a form preserves its numeric scale and endpoint and midpoint labels. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#field-016).

**Acceptance.**
1. Typeform scale starts, step counts and low/middle/high labels map under IMPORT-007; a seven-step scale starting at zero arrives as zero through six with all three labels.
2. Google Forms scale endpoints and low/high labels map under IMPORT-007 without losing either label.
3. SurveyMonkey and Jotform scale starts, step counts and labels map under IMPORT-005 and IMPORT-006.

#### LOGIC-001 — Answer recall

*Tier:* Core · *Cites:* BASE-INPUT-002

**Requirement.** Forms reuse an earlier accepted answer in respondent-facing text without changing the underlying answer. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-001).

**Acceptance.**
1. Prompts, supporting text, choice labels, completion screens and emails may include an earlier answer, a declared hidden value under FIELD-001 or a calculated value under LOGIC-003.
2. Question references use stable question identities; missing, current, future or impossible off-path question references are refused at publication with the containing question named, and duplication remaps references to the copied identities.
3. Only valid answers on the current path appear in recalled text; skipped or invalid answers insert blank text, and recalled HTML or respondent-supplied reference tokens remain inert.
4. Changing a name by going Back updates the later prompt and recalled choice text, in preview and published collection, while stored answers remain unchanged.
5. NOTIFY-006, NOTIFY-007, RESP-020 and RESP-027 retain answer, hidden-value and calculated-value recall, including escaped output and blank skipped or invalid values, in their answer-bearing emails.

#### LOGIC-002 — Known-data prefill in invitations

*Tier:* Core · *From:* LOGIC-002 · *Cites:* BASE-DATA-003, BASE-SECRET-001

**Requirement.** Known invitation recipients can review and correct explicitly mapped contact data without exposing it to anonymous collection. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-002).

**Acceptance.**
1. A published revision freezes its explicit mapping from stored contact fields to questions; older revisions have no mapping, and anonymous collection never prefills.
2. Only the invitation-token holder receives validated string-compatible stored values, visibly marked and editable unless locked by the operator; invalid values are dropped without coercion.
3. The submitted answer retains an unchanged, edited or locked prefill marker rather than the original contact value; normal erasure, ledger/search, CSV/JSON and archives preserve that answer and marker.
4. Contact-prefill values never appear in a URL, audit row, log or analysis input before submission, and public, embed, collector, preview and resume paths supply no contact prefills.
5. Mapped invitations cannot save across devices, and publication refuses deleted or string-incompatible mappings with their question identities.
6. An invited contact sees a mapped company value, edits it and finds the edited answer with its prefill marker in the ledger.

#### LOGIC-007 — Known-data prefill from connected records

*Tier:* Core · *From:* LOGIC-002

**Requirement.** Identified in-product surveys and CRM-linked collection use explicitly mapped known records under the same custody as invitation prefill. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-002).

**Acceptance.**
1. An identified in-product survey under DIST-015 or a CRM-linked collection under INTEG-003, INTEG-018, INTEG-004 or INTEG-005 may prefill mapped stored fields or connected CRM values.
2. These sources follow LOGIC-002's published mapping, visible marking, edit-or-lock behavior, validation, submitted-answer custody, erasure and exclusion from anonymous collection before their collection door is offered.

#### LOGIC-003 — Variables and calculations

*Tier:* Core

**Requirement.** Operators calculate typed response values and use them consistently to route, explain and report the result. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-003).

**Acceptance.**
1. Numeric and text variables derive from answers and hidden fields through arithmetic, LOGIC-006 conditionals, rounding and calendar-date differences, and are stored with the response.
2. Publication refuses missing references, wrong types and possible division by zero; calculations may drive branching, completion, alerts, recall, PAY-001 amounts and results, with NOTIFY-005 and PAY-001 retaining those consumer obligations.
3. Calculated conditions over bounded integer numbers, ratings, scores, booleans, single choices and text equality classes are proved exactly, and publication refuses an unreachable destination.
4. A calculated condition reading unbounded or decimal numbers, dates, multi-select, masked or patterned text, or numeric hidden context may be true or false for reachability; destinations remain forward-only and feasible cycles are refused.
5. A quantity-and-discount form stores the hand-computed total for ten answer sets and refuses an expression referencing a deleted question.
6. A rounded BMI from decimal weight and height values previews both calculated branches and publishes and routes both answer sets through the form at 1440 and 390.

#### LOGIC-004 — Quiz scores and outcomes

*Tier:* Core

**Requirement.** Forms grade answers or identify an outcome and report both the respondent's result and the aggregate performance. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-004).

**Acceptance.**
1. A quiz supports correct-answer grading, points per choice and personality-outcome mapping, and shows the respondent their score and per-question feedback.
2. A score range or top outcome chooses a completion screen and may be combined with answers or hidden fields through LOGIC-006 conditions.
3. Reports show score distributions, per-question correctness and pass rates for fixed answer sets from graded and personality quizzes.
4. Quiz scores and outcomes are crosstab dimensions under RSLT-006 and RSLT-014 with stated shares, the same chi-square rule and ANLY-005 suppression; an outcome can be crossed against a question.

#### LOGIC-006 — One condition model and typed operands

*Tier:* Core · *From:* LOGIC-006

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

#### LOGIC-008 — Condition authoring, preview and runtime custody

*Tier:* Core · *From:* LOGIC-006 · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** Operators can read the rule they wrote, preview its exact decision and rely on that same decision after publication. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-006).

**Acceptance.**
1. The builder provides only earlier operands, lets an Editor add conditions and groups and choose AND or OR, and displays a plain-language summary beside the path with keyboard access under A11Y-001.
2. Preview displays the tree, each operand's value and result, each group's result and the selected next step exactly as collection evaluates it.
3. Destinations remain forward-only so every path terminates, and branch selection uses the first matching rule in displayed order followed by the default path.
4. Admission re-evaluates conditions from accepted on-path answers; an off-path answer is discarded before validation and never stored, scored or exported under RESP-004.
5. Published rules retain stable references, so renaming a question, choice or hidden field cannot change a rule.
6. A company-size/decision-maker AND rule combined with an enterprise-context OR rule routes all four stated truth cases correctly; uppercase GMAIL.COM matches an ends-with condition while gmail.co does not, single-choice inequality routes other choices, and blank optional answers match blank but not inequality.
7. Publication refuses later-question and deleted-hidden-field operands with the rule named, while a submission containing an off-path answer is admitted when its on-path answers are valid and leaves the off-path value absent from storage, scoring and exports.

#### LOGIC-009 — Import compound conditions faithfully

*Tier:* Core · *From:* LOGIC-006

**Requirement.** A moved form retains its source condition tree or explicitly reports an unsupported path rather than guessing its meaning. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#logic-006).

**Acceptance.**
1. Typeform AND/OR trees retain question, hidden-field, variable, choice and constant operands and equality, inequality, text prefix/suffix/containment, numeric/date ordering and always operators under IMPORT-001 and IMPORT-007.
2. SurveyMonkey advanced branching retains its AND/OR conditions on questions and custom variables under IMPORT-005.
3. Jotform conditions retain All/Any linking and equality, inequality, containment, prefix/suffix, numeric/date ordering and empty/filled terms under IMPORT-006.
4. A source condition without a faithful mapping is listed as unsupported and leaves the path incomplete.
5. A Typeform AND jump over a question, hidden value and text-contains condition, and a Jotform Any-linked condition, arrive intact in the import review.

#### LANG-001 — Multi-language forms

*Tier:* Core · *From:* LANG-001

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

#### LANG-003 — Multi-language forms: The journey also triggers FIELD-013 length and mask errors in each language and check

*Tier:* Core · *From:* LANG-001

**Requirement.** This part of LANG-001 covers the journey also triggers FIELD-013 length and mask errors in each language and checks the translated custom message, and checks a FIELD-016 scale's translated labels over steps 0, 3 and 6 in each language, and crosses language against a question under RSLT-006.. Detailed field, format and door rules remain in [the operating rules](docs/contract/MECHANISM.md#lang-001).

**Acceptance.**
1. The journey also triggers FIELD-013 length and mask errors in each language and checks the translated custom message, and checks a FIELD-016, FIELD-021 scale's translated labels over steps 0, 3 and 6 in each language, and crosses language against a question under RSLT-006, RSLT-014.

#### AI-002 — AI translation

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** An operator can request draft translations beside the source strings.

**Acceptance.**
1. An operator can ask ai provider adapter to draft a translation of every untranslated string; the draft is shown beside the source.
2. Applying an agent translation carries standard, adding external when published to respondents; the company’s policy decides whether it applies alone or waits for the operator.
3. Under the held company policy, With the AI receiver fixture, the specialist drafts Spanish strings, accepts half, and the rest stay untranslated and block publish for Spanish.

#### LANG-002 — Editable closed and system text

*Tier:* Core

**Requirement.** Pencil supports editable closed and system text. Field, format and door details are recorded in [the operating rules](docs/contract/MECHANISM.md#lang-002).

**Acceptance.**
1. An Editor overrides, per form, the closed-form message, the response-limit message (RESP-008, RESP-009), the button labels (Start, OK, Next, Submit), required-answer and validation messages, the progress text and the keyboard hint, with recall (LOGIC-001) in messages and a stated length limit.
2. Overrides are part of the published revision, are translated per language under LANG-001, LANG-003, and an empty override falls back to Pencil's default; A11Y-002 refuses a label that would leave a control without an accessible name.
3. Through the browser, sets a custom Submit label and closed message, sees the label on the published form, closes the form and sees the closed message, and sees the Spanish translation of the label under LANG-001, LANG-003; Through the public door, refuses publish with a whitespace-only button label.

#### A11Y-002 — Accessibility checker before publication

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** The builder identifies fixable form defects before they can reach respondents. Implementation details are in [the operating rules](docs/contract/MECHANISM.md#a11y-002).

**Acceptance.**
1. The checker identifies missing alt text, low-contrast brand choices, unlabeled matrix rows, overly long choice lists, timed elements and ambiguous link text.
2. A defect breaching A11Y-001 prevents publication and offers a fix link to its question or step.
3. A draft containing an image without alt text and a two-to-one contrast accent returns both stable step identities and reasons when publication is attempted.

### Target: every distribution channel

#### DIST-011 — SMS invitations and reminders

*Tier:* Core · *Register:* R-8

**Requirement.** Operators send invitations/reminders through Twilio to consented mobile contacts. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-011).

**Acceptance.**
1. SMS consent records actor, time, source and wording sufficient for TCPA prior express consent.
2. Messages carry the opaque link and a STOP opt-out instruction. Authenticated Twilio inbound STOP immediately stops SMS, and HELP returns the business name.
3. Delivery/retry/failure follow DIST-006, DIST-008 and DIST-010. Quiet hours follow WS-002 in the contact’s zone where known.
4. Settings shows A2P 10DLC registration state from the owner’s connected Twilio account.
5. With a Twilio receiver fixture, a consented contact receives the invitation, an unconsented contact is refused, and a verified STOP prevents the scheduled reminder; invalid webhook signatures are refused.

#### DIST-013 — Embed modes and site plugins

*Tier:* Core · *Cites:* BASE-PUBLIC-002

**Requirement.** Forms can appear inline, full-page or in triggered host-page containers under DIST-009 isolation.

**Acceptance.**
1. Offer popup on click, popover bubble, slider and side-tab modes, with click/delay/scroll-depth/exit-intent triggers and per-browser frequency caps.
2. A WordPress plugin and Webflow/Squarespace snippets install without theme-code edits; the WordPress shortcode renders the form in a WordPress test container.
3. Each mode and shortcode accepts DIST-021’s forwarded/fixed/hidden/GA4 settings. Popup and side-tab collection retain forwarded campaign values.
4. Opening each mode by its trigger and completing its response exposes only load, height and completion events to the host.

#### DIST-014 — Compose an email first question

*Tier:* Core · *From:* DIST-014

**Requirement.** Invitation or program email may present an eligible first question as answer buttons.

**Acceptance.**
1. Offer NPS 0–10, CSAT 1–5, a published rating scale or a single choice with at most eight labels of at most 80 characters each, only when it is the first published-path question.
2. A different first question type or operator-locked contact prefill offers no buttons. Reminders use the same composer.
3. PROG-002 adopts these rules before program email ships. Selecting and confirming an emailed answer follows DIST-024.

#### DIST-024 — Confirm an emailed first answer

*Tier:* Core · *From:* DIST-014 · *Cites:* BASE-MAIL-001

**Requirement.** Email buttons prepare a first answer without letting link scanners record it.

**Acceptance.**
1. Opening a button selects its answer and readies the rest of the form; only explicit confirmation/continuation records it. A respondent selecting 9 lands on the next question with 9 selected and completes.
2. Invitation buttons carry only the opaque invitation capability and a namespaced hint. Fetching or prefetching them, including repeated GET/HEAD requests, writes no answer, session, response, view count or participant state.
3. Selection stays in the page until interaction. Normal completion, closure, opt-out and revision admission still apply; unknown/out-of-range hints select nothing.

#### DIST-015 — In-product surveys

*Tier:* Core · *Cites:* BASE-PUBLIC-001

**Requirement.** An installation-served SDK shows micro-surveys in the business’s site or app.

**Acceptance.**
1. Target by page, event, host-supplied attributes and sampling rate, with both global and per-survey fatigue limits.
2. Identified targeting requires a server-signed host identity and RESP-005 disclosure; unsigned attributes retain anonymous collection.
3. A host-fixture event shows the survey for a matching user but not a nonmatching user. A second trigger inside the fatigue window shows nothing; a forged unsigned identity yields an anonymous response.

#### DIST-016 — Recurring surveys

*Tier:* Core

**Requirement.** Forms repeat on weekly, monthly, quarterly or custom schedules in the WS-001 zone.

**Acceptance.**
1. Each occurrence launches to a segment or a fresh public link, pins the then-current revision and appears as its own RSLT-007 trend period. The distributor is reminded before each and may skip one.
2. Advancing a fixture clock over three monthly occurrences produces three launches/periods; skipping one produces no send for that occurrence.

#### DIST-017 — Named collectors

*Tier:* Core

**Requirement.** Operators distribute one form through independently controlled named collectors.

**Acceptance.**
1. Create web-link, named-site embed, email campaign, SMS, QR, social-post or partner collectors, each with its own link, close date and response limit. Responses retain their collector; results filter and compare by it.
2. Closing one collector by its limit leaves another open. Racing the final place never exceeds the limit; returning sessions keep their collector.
3. Close/reopen collectors independently; collector filters and snapshot exports retain matching source/counts.

#### DIST-018 — Form addresses

*Tier:* Core

**Requirement.** Each form has a readable editable address, mapped custom domains/subdomains and preserved rename redirects. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-018).

**Acceptance.**
1. The installation supports custom hostnames through Cloudflare. Renaming keeps old direct/embed addresses as permanent redirects with their query values and admission checks.
2. Every address shares DIST-020 preview and DIST-026 indexing rules, with the resulting canonical address identified.
3. Under RL-101, a retired slug stays bound to its existing form and may be explicitly restored as that form’s canonical slug in one atomic rename, with every other alias redirecting directly to the resulting canonical address; another form cannot claim an address while it remains an obligated redirect.
4. The renamed form on a mapped test hostname retains its admission checks, preview and canonical identity.

#### DIST-020 — Form link previews

*Tier:* Core · *Cites:* BASE-PUBLIC-001

**Requirement.** Published revisions retain share previews for links pasted into ads, social posts, Slack or text messages. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-020).

**Acceptance.**
1. Set share title (initially the form title), description (initially welcome text, otherwise empty) and image (initially BRAND-001’s logo on the BRAND-002 theme background). Editors may upload size-limited PNG/JPEG/WebP with required alt text; LANG-001 translates title, description and image alt text.
2. Public, embed, collector and DIST-018 addresses show the same title, description, installation-local image with alt text, canonical address and large-image social card. The image is fetchable from the installation.
3. Preview text never contains answers or recalled values. Changing title/image affects the next publication and is visible in the builder Share preview card.
4. IMPORT-007 carries Typeform’s title, description, image and indexing choice into the form.

#### DIST-021 — Forward values from the host page

*Tier:* Core · *From:* DIST-021

**Requirement.** Script embeds, all DIST-013 modes and WordPress shortcode forward declared fields without exposing them in the frame address. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-021).

**Acceptance.**
1. The operator chooses host-URL names to forward. Only selected names declared by FIELD-001 on the published revision enter the form; every other parameter stays on the host.
2. The host can supply fixed values or earlier-visit values through a hidden-value call, before or after snippet loading.
3. Explicit GA4 cookie mode reads the host’s analytics client ID only when the corresponding field is declared. Pencil sets no cookie.
4. Fixed values override hidden-call values, which override forwarded URL values; unprovided declared fields stay blank.
5. The installation script exposes only declared field names. Validated initialization messages carry values into the form, never its frame URL, access logs or referrer.
6. The form accepts its first answer only after initialization; the server rechecks every name/type, discarding and counting invalid or undeclared values.
7. Values follow FIELD-001 and DIST-009; campaign use follows DIST-027. Name count and per-type value lengths stay within declared limits.

#### DIST-025 — Plain iframe forwarding

*Tier:* Core · *From:* DIST-021

**Requirement.** An operator’s page template may pass declared values in a plain iframe source query. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-021).

**Acceptance.**
1. The server uses DIST-021’s published-field/type filter: a declared campaign is stored and an undeclared secret is absent.
2. DOCS-001 gives plain-iframe, hidden first-visit and GA4-cookie recipes.
3. DIST-002 and DIST-013 expose forward/fixed/hidden/GA4 options; DIST-009 recognizes inbound initialization values without exposing answers to the host.

#### DIST-026 — Search indexing choice

*Tier:* Core · *From:* DIST-020

**Requirement.** Search indexing starts disabled on every form and stays disabled on private or identified collection. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-020).

**Acceptance.**
1. Form, embed, invitation, private resume and completion pages all tell crawlers not to index or follow links, through both document and response metadata.
2. An Editor may enable indexing on one public form; only its canonical address loses both restrictions after publication.
3. Invitation-only, DIST-019 restricted, RESP-023 identified and GOV-001 HIPAA-mode forms never permit indexing. Publication refuses an incompatible choice while preserving existing admission.

#### DIST-027 — Forwarded campaign attribution

*Tier:* Core · *From:* DIST-021

**Requirement.** Forwarded values behave as FIELD-001 link values throughout collection. Details are in [the operating rules](docs/contract/MECHANISM.md#dist-021).

**Acceptance.**
1. They drive LOGIC-001 recall and LOGIC-006 conditions, and are stored, filtered, exported and delivered like direct-link values.
2. Identifying values require RESP-023 identified collection; anonymous forms discard/count them. Anonymous click IDs are held only for INTEG-017 conversions, then purged.
3. A browser campaign fixture retains its campaign in response/CSV, follows its conditional branch and sends matching Google Ads/Meta conversions; an undeclared secret is absent from stored data, initialization messages and frame requests.
4. Fixed campaign wins over URL campaign. GA4 mode delivers the host-cookie client ID; a hidden first-visit source is retained; popup mode forwards the same values.
5. The host receives only allowed nonidentifying load, height and completion events.

### Target: respondent follow-through and partial responses

#### RESP-020 — Respondent confirmation content

*Tier:* Core · *From:* RESP-020 · *Cites:* BASE-INPUT-002

**Requirement.** A form can send one branded respondent receipt after release; recipient custody is governed by RESP-027.

**Acceptance.**
1. The receipt may include an opted-in answer copy, quiz result, payment receipt link or signed PDF under LOGIC-004, PAY-001/PAY-006/PAY-007 and SIGN-001.
2. Subjects and bodies can recall earlier answers, declared hidden fields and calculated values under LOGIC-001; skipped or invalid values are blank and values render as escaped text and HTML.
3. Dates use the question’s published FIELD-015/FIELD-020 display format.
4. Sensitive answers under GOV-004 are never included.
5. The receipt uses the saved business brand under BRAND-001/BRAND-003 and DIST-006 retry behavior.
6. It has no Reply-To or response-access link, except the single-use edit link when response editing is explicitly enabled under RESP-021.

#### RESP-027 — Respondent confirmation custody

*Tier:* Core · *From:* RESP-020 · *Cites:* BASE-INPUT-002

**Requirement.** Confirmation delivery is bound to one consented recipient and released response.

**Acceptance.**
1. Confirmation defaults off on each published revision; an answer copy is a separate opt-in whose allowed question types start empty.
2. Only the selected “send my confirmation here” question or the identified invitation participant supplies a recipient. Other typed or link-supplied addresses do not; unchanged or locked contact prefill is eligible only when it is that participant’s own address.
3. Opted-out participants and opted-out or bounced mailboxes receive none. Excluded or quarantined responses receive none until a live response is released.
4. One durable key per released response prevents replay or restored history from resending; existing request rates and one delivery per response bound the mail path.
5. Recipient mailboxes, rendered bodies and attempts remain private archive history, restore with sending disabled and erase with the response.
6. The same custody, escaping and exclusion rules apply to the optional quiz, payment and signature receipt content of RESP-020.
7. A form with the marked mailbox delivers once with escaped recall, blank skipped values and the published date format; an anonymous response without that mailbox delivers none, and a transient failure retries the same delivery.

#### RESP-021 — Edit after submission

*Tier:* Core

**Requirement.** A form may permit a respondent to change a completed submission until a stated deadline.

**Acceptance.**
1. A single-use edit link is delivered with the confirmation and opens the existing answers.
2. A successful edit retains the prior response version, creates the new version, recomputes results and notifies integrations with an updated event.
3. The ledger shows both versions and the updated event reaches the integration; a second use of the same edit link is refused.

#### PART-001 — Consented partial-response capture

*Tier:* Core

**Requirement.** A form can opt into partial capture under RESP-005's advance disclosure; without that opt-in, RESP-010's no-partial rule applies.

**Acceptance.**
1. Before the first answer, disclosure says answers are saved as the respondent goes; each completed step is retained against the RESP-013 session.
2. Operators see partials separately with the last step reached; partials are excluded from completed counts, admission and analysis, and from exports unless explicitly included.
3. Incomplete partials expire after a retention period, defaulting to 30 days; completion ends partial status.
4. Three answered steps of a six-step form appear as one three-answer partial without affecting counts or analysis; the same activity without opt-in stores no partial, and advancing past retention deletes the partial.

#### PART-002 — Save and resume

*Tier:* Core

**Requirement.** Respondents can explicitly email themselves a private link to resume the same answers and revision on another device, separately from partial-response capture.

**Acceptance.**
1. Save and finish later resumes the same revision, answer path, collector and invitation until expiry (30 days by default) or closure; the delivery email is used only for the link unless independently answered in an email question.
2. A completed link shows its completion receipt; erased, expired, closed or otherwise unavailable links offer Start again.
3. Saving creates no completion, contact, operator-visible partial or analysis evidence, and saved answers remain absent from completed results and default exports until submission.
4. Save-mail failure is visible and retryable without duplicating the save.
5. Completion, expiry subject to GOV-003/GOV-008, and erasure scrub private saved state; archive restore removes delivery capabilities.
6. After two answers, a fresh browser context opens the emailed link, reads both answers, completes and sees completion on link reuse; without choosing Save, answering stores no partial.

#### RESP-022 — Response-quality flags

*Tier:* Core

**Requirement.** Per-form checks can flag additional response-quality concerns without discarding the data.

**Acceptance.**
1. Completed responses can be checked for grid straight-lining, completion far faster than the form’s median, duplicated open text and gibberish.
2. Operators choose the checks for a form; a flag quarantines the response with its reasons under RESP-017/RESP-018 rather than deleting it.
3. A straight-lined grid and a three-second completion against a ninety-second median are held with their reasons, and release restores them to results.

#### RESP-023 — Identified public collection

*Tier:* Core · *From:* RESP-023

**Requirement.** Editors choose whether each published form collects anonymous or identified public responses.

**Acceptance.**
1. The builder’s share settings choose anonymous by default or identified collection for links, embeds, popups and QR codes; a change requires republication.
2. Identifying hidden fields declared under FIELD-001 accept typed link, embed or popup values for uses such as Mailchimp, HubSpot, Mango and CRM sequences.
3. Retained values are marked link-supplied and unverified. Unsubstituted merge tags and values failing their declared types are discarded and counted, never stored.
4. Optional contact matching links a supplied email to the matching AUD-001 contact and uses it as the key for the applicable CRM/email-platform deliveries.
5. Before answering, RESP-005 states the identified mode, shows the values received, explains forwarding and offers “This isn’t me” to clear them before storage.
6. Results, filters and exports show the collected identity mode.

#### RESP-028 — Revision-bound public identity

*Tier:* Core · *From:* RESP-023

**Requirement.** Identifying public links bind their values to one published revision, while anonymous collection keeps its identity boundary.

**Acceptance.**
1. An identifying link names exactly one form revision and fixes its identifying values against that revision’s declarations.
2. Values cannot change during collection except by removal through “This isn’t me”.
3. Using a revision-A identifying link on revision B is refused with a reason and creates no response; identity never silently moves to another revision.
4. Anonymous mode keeps RESP-006 and FIELD-001’s refusal of identifying parameters, and changing modes never re-identifies an earlier anonymous response.
5. A published identified form collects a typed email/name supplied by a link, shows the disclosure and retains the email in the response and CSV and as the contact key in the HubSpot delivery.
6. An unsubstituted merge tag stores no email and increments the discarded-value count; “This isn’t me” collects no supplied identity; the same identifying parameter on an anonymous form is refused at publication and discarded at runtime.

#### RESP-024 — Review before submit

*Tier:* Core

**Requirement.** Editors may enable a review screen before final submission.

**Acceptance.**
1. Review lists every reachable answer in published order and display format, including FIELD-015/FIELD-020 dates, FIELD-016/FIELD-021 scale labels and choice labels.
2. Each answer has an edit link through RESP-004 Back navigation, which recomputes the path and removes newly unreachable answers from review.
3. Final submission from review uses RESP-007 and the same RESP-012 submission key.
4. An anonymous respondent sees only their own answers.
5. In a branching form, editing one answer removes the old branch, shows the new branch in the published display format and submits exactly once.

### Target: submission workflow

#### LEDG-005 — Spreadsheet exports

*Tier:* Core · *From:* LEDG-005

**Requirement.** The LEDG-004 selection is available as XLSX with response and question-metadata sheets, using the documented spreadsheet format.

**Acceptance.**
1. The response sheet has the CSV’s columns and values, retaining JSON-valued columns as JSON text.
2. Text is inert rather than a formula, including values beginning with =, +, - or @.
3. An answer beyond the spreadsheet cell limit refuses the whole export rather than being cut.
4. The metadata sheet lists each revision’s stable question ID, position, type and label, and each offered choice’s stable ID, published value and label, including its statistics variable and code.
5. The download is cursor-paged with bounded memory and a cutoff-bearing XLSX filename.
6. An independent spreadsheet reader opens the export and reads back the same response IDs and values as CSV.

#### LEDG-007 — Statistics exports

*Tier:* Core · *From:* LEDG-005

**Requirement.** The LEDG-004 selection is available as an SPSS system file whose exact byte format and limits are documented with the operating rules.

**Acceptance.**
1. One case represents one response, preserving CSV response columns and JSON text for omitted questions and presentation order, with typed hidden-field and calculation variables.
2. Stable question/choice IDs determine codes across revisions: single-choice/dropdown values carry choice labels; multiple choices use one binary variable per option; priorities use ranks; yes/no, thumbs and consent use binary values; scores/numbers remain numeric; open/contact answers and Other write-ins remain text.
3. A question absent from the response’s revision is system-missing.
4. Very long text uses the documented long-string representation; a value beyond the format limit refuses the export without truncation.
5. Format-shortened variable/value labels retain their full text in the XLSX metadata sheet.
6. The UTF-8 compressed download uses bounded cursor pages and a cutoff-bearing statistics filename, under the same filter, cutoff and quarantine rules as CSV.
7. An independent statistics reader opens the file and reads back the same response IDs and coded values as CSV.

#### LEDG-006 — Response search

*Tier:* Core · *From:* LEDG-006 · *Cites:* BASE-ROLE-001

**Requirement.** Operators can search the retained response content they are entitled to see.

**Acceptance.**
1. Search matches open text, FIELD-010/FIELD-017 Other write-ins, choice labels, hidden fields and identified name/email when the ROLE-002 grant permits identity.
2. GOV-004 sensitive answers match only when visible to the operator; quarantined matches appear only in RESP-018 review and erased responses never match.
3. Search composes with every LEDG-003 filter, highlights the original matching answer and fixes the same response IDs into LEDG-004 exports.
4. Count and first-page results complete within one second p95 at the declared response capacity.
5. Matching follows the documented Unicode case-folding and canonical-composition rules; accents remain significant and wildcard/SQL punctuation is literal.
6. Accented, Cyrillic, Greek and mixed-script text, decomposed accents and expanding case folds match correctly, including a two-hundred-letter phrase without query-depth refusal.

#### LEDG-008 — Search custody through change

*Tier:* Core · *From:* LEDG-006

**Requirement.** Searchable content follows answer changes, upgrades and archive custody without changing retained answers.

**Acceptance.**
1. Each answer write updates its searchable value; editing an answer replaces its old searchable text.
2. Upgrading from release 0.7.0 makes existing answers searchable without changing the retained answers.
3. An archive round trip preserves search values and produces an identical re-export.
4. Searching retained open text, hidden values and Other write-ins with revision/source filters exports exactly the matching released IDs, excluding quarantine and erasure.
5. The browser shows the original matching spelling and downloads those same filtered records.
6. Grant-aware identity and sensitive-answer cases remain required under ROLE-002 and GOV-004.

#### WORK-001 — Submission inbox

*Tier:* Core · *Cites:* BASE-OPS-005

**Requirement.** Each form's submissions can be assigned, annotated and moved through a private workflow inbox.

**Acceptance.**
1. Submissions hold a new, in review, approved, rejected, done or custom status, an assignee, tags and internal notes invisible to respondents.
2. Operators filter and bulk-update submissions; assigning, tagging, noting and moving one to done makes it appear in that status filter and records each change.
3. Unauthenticated requests and stale bulk writes are refused without partial changes; private notes are paged and custom statuses are retained.
4. The selected workflow cohort exports, and workflow custody survives import undo, response erasure and operator removal.

#### WORK-002 — Approval flows

*Tier:* Core · *Cites:* BASE-OPS-005

**Requirement.** A submission can follow sequential, parallel or answer-selected approval steps, including a second approver above a configured amount.

**Acceptance.**
1. Approvers are operators or named external people; each external approver receives a single-use signed link restricted to that submission and its permitted fields.
2. Approve, reject and request-changes retain actor, time and comment, can notify the respondent under RESP-020/RESP-027 and can trigger integrations.
3. A $6,000 request passes through two approvers, one external; both decisions appear in the audit, and the external link cannot be reused or opened for another submission.

#### WORK-003 — Multi-person forms

*Tier:* Core

**Requirement.** A response can pass a later section to another person while protecting the earlier person's answers.

**Acceptance.**
1. The first respondent names, or is assigned, the next person, who receives their own link and can complete only their section while seeing only permitted earlier answers.
2. The response becomes complete only after every section is complete.
3. In a two-person form, the second person cannot alter part one, and completion counts increase only after part two.

#### WORK-004 — Workflow reminders and escalation

*Tier:* Core

**Requirement.** Pending approvals and section handoffs remind their assignees and escalate to a named operator after a deadline.

**Acceptance.**
1. Reminders follow the configured schedule within WS-002 sending hours; completion or cancellation stops them.
2. Advancing a pending approval through two reminders and an escalation produces those notices; approving it then leaves no further reminder queued.

#### WORK-005 — Submission PDFs and generated documents

*Tier:* Core

**Requirement.** Operators can render a submission as a PDF using a default or designed layout, including an uploaded fillable PDF.

**Acceptance.**
1. Authorized operators can download PDFs, attach them to respondent or WORK-002 approval emails, and deliver them through FILE-002 storage integrations.
2. Both a recalled-value template and a filled AcroForm retain their expected text content.
3. Dates in documents and submission PDFs retain the question's FIELD-015/FIELD-020 published display format.

### Target: reports buyers share

#### RSLT-006 — Crosstab dimensions and statistics

*Tier:* Core · *From:* RSLT-006

**Requirement.** An operator can cross structured questions, hidden fields, collectors, language, calculations and scores over a stated response cohort.

**Acceptance.**
1. The crosstab uses distinct released responses from one revision under LEDG-003 filters and an evidence cutoff, excluding quarantine and erasure.
2. Cells show counts and RSLT-003 row/column shares; chi-square is flagged only when every expected cell count is at least five.
3. Unanswered is a stated row or column, and the table says when none exists.
4. A multiple-select dimension counts a response in each chosen option, labels shares that may exceed one hundred percent and offers no chi-square.
5. Priority crosses by first-priority choice. Numeric/date/calculated dimensions use distinct finite values, up to fifty stated categories; empty collectors are omitted.
6. Language under LANG-001/LANG-003, quiz scores/outcomes under LOGIC-004 and stable matrix rows under FIELD-002 are included before their respective capabilities ship.
7. A fixed three-choice by two-choice cohort produces the correct cells, row/column shares and statistic; disclosure follows RSLT-014.

#### RSLT-014 — Crosstab disclosure boundaries

*Tier:* Core · *From:* RSLT-006

**Requirement.** A crosstab protects its own table while accurately stating what other figures remain available.

**Acceptance.**
1. A cell below the ANLY-005 threshold, including zero, shows suppressed without a count or share; exactly the threshold is shown.
2. The affected row total, column total, grand total, shares using withheld totals and chi-square are withheld, with the reason stated.
3. A raw-authorized operator retains complete answer summaries, response count, other panels, ledger and exports. The note explains that these can recover withheld values and claims no non-reconstruction guarantee beyond the table.
4. Aggregate-only reports apply the stronger whole-report rule of RSLT-015/RSLT-016, including code crosstabs.
5. In the forty-three-response fixture, the Plan summary states Scale eight of forty-three and Responses forty-three; the table shows Scale × Churn five and suppresses Scale × Renew, while the raw ledger and CSV/XLSX/statistics exports retain its three matching responses.

#### RSLT-007 — Trends over time

*Tier:* Core

**Requirement.** Results chart score and answer-share changes over the workspace calendar.

**Acceptance.**
1. Day, week, month and quarter charts state each period’s denominator, apply its minimum-size rule and mark revision boundaries in the WS-001 zone.
2. DIST-016 recurring occurrences and PROG-003 programs use the same series.
3. Three months of responses produce correct weekly/monthly NPS, denominators and revision markers; a period below the minimum has no value.
4. Collector cohorts, primitive-answer shares and CSV use that series; recurring programs and ranked/structured-contact answer shares remain included.

#### RSLT-008 — Saved views and dashboards

*Tier:* Core

**Requirement.** Operators can save report views and arrange them into form or program dashboards.

**Acceptance.**
1. A named view retains filters, compared cohorts, crosstabs and chosen charts, and records who saved it.
2. Reopening the view yields the same figures for the same cutoff, including when another operator opens it.
3. A saved/shared aggregate view records its disclosure threshold and never applies a lower one later under ANLY-015 and RSLT-015/RSLT-016.
4. Lowering current policy reveals nothing in the saved aggregate view; the operator’s current-threshold results page needs no saved-view snapshot.

#### RSLT-009 — Shared report links

*Tier:* Core · *From:* RSLT-009

**Requirement.** A saved view can be shared as a read-only aggregate link, under the disclosure rules of RSLT-015 and RSLT-016.

**Acceptance.**
1. The link offers an optional password and expiry and can be revoked at any time.
2. Opening needs no operator session and reveals aggregates only, never respondent identity, below-threshold excerpts, uploads or payment details.
3. It uses no cookies beyond its own session.
4. The opened page contains no response ID or identity and returns not found after revocation.

#### RSLT-015 — Aggregate-only report cohorts

*Tier:* Core · *From:* RSLT-009

**Requirement.** Aggregate-only protection covers shared links, report files/emails, tool results, API tokens without response-read scope and roles without response access. Raw-authorized operators retain their ledger and exports.

**Acceptance.**
1. Every figure names one cohort: revision, response filters including hidden-field/code/search filters, released responses and cutoff.
2. The view uses the ANLY-005 disclosure threshold, never below its save/share record; lowering current policy reveals nothing.
3. Answer summaries remain complete, but a cohort below threshold or a nested subset differing by one through threshold-minus-one responses shows no breakdown.
4. Rare observed-value categories of hidden fields, numbers, dates and calculations are not labeled, and identifying hidden fields are neither crossed nor summarized.
5. Protection covers one report/tool result at one cutoff, not differencing across separate links, files, emails, calls, filters or cutoffs; the view states that limit.
6. This is presentation protection, not anonymization, differential privacy or legal protection.

#### RSLT-016 — Whole-report complementary suppression

*Tier:* Core · *From:* RSLT-009

**Requirement.** Aggregate-only crosstabs, including code crosstabs, remain protected against the equations in the same report. Exact matrix mechanics are documented with the operating rules.

**Acceptance.**
1. The check includes the crosstab’s cells/totals, both dimension summaries and answered counts, Unanswered and response count, beyond what the summaries alone determine.
2. Only valid single-select partition sums constrain counts; overlapping and multiple-select incidences are never treated as partitions.
3. The report suppresses further cells until each suppressed cell has at least two feasible non-negative integer values, or withholds cells/totals/chi-square and explains that other reported figures would recover a cell.
4. A cell below threshold, including zero, is suppressed; exactly the threshold is visible.
5. For the forty-three-response Plan/Renewal fixture with Scale eight, a shared report either withholds the crosstab with that explanation or leaves two feasible values for every suppressed cell while summaries stay complete.
6. A nested collector cohort differing by three responses has no breakdown, a multiple-select crossing contributes no partition sum, and identifying hidden fields are absent.
7. Lowering the shared threshold reveals nothing; in the same run the raw-authorized operator’s results and exports still contain the three Scale × Renew responses.

#### RSLT-010 — Report exports

*Tier:* Core

**Requirement.** Operators can export views as PDF, PowerPoint and XLSX reports.

**Acceptance.**
1. Each exported page states its charts, denominators and filters.
2. Every format contains the same selected figures and filter text as the view.
3. Aggregate-only exports apply RSLT-015/RSLT-016 to the same fixture, withholding or complementing its crosstab identically.

#### RSLT-011 — Scheduled report email

*Tier:* Core

**Requirement.** Operators can schedule aggregate reports for named operators.

**Acceptance.**
1. Weekly or monthly report email includes aggregates and an authenticated-view link under NOTIFY-004 and WS-002 sending hours.
2. Two scheduled occurrences produce two deliveries without answer text or respondent identity.
3. Aggregate-only messages apply RSLT-015/RSLT-016 to the same fixture, withholding or complementing its crosstab identically.

#### RSLT-013 — Anonymous traffic and conversion

*Tier:* Core · *From:* RSLT-013

**Requirement.** Results report aggregate traffic without creating visitor identities.

**Acceptance.**
1. Views, starts and submissions are reported by revision, source (link/embed/popup/QR/collector) and day, with start/completion rates beside their numerators and denominators.
2. Loading a published form before interaction increments only a revision/source/day aggregate counter; no visitor or session record is created.
3. The counter has no identifier, cookie, IP, user agent or host-page identifier and cannot join to a response or session.
4. Preview loads are excluded, and later automation signals never adjust view counts.
5. Three real loads, two starts and one completion show three views, two starts and one submission, with preview excluded.
6. Reports state that views and starts are counted separately from accepted responses.

#### RSLT-017 — Submission-time traffic exclusions

*Tier:* Core · *From:* RSLT-013

**Requirement.** Traffic exclusions use the same owned checks as RESP-015 while keeping aggregates independent of response review.

**Acceptance.**
1. Honeypot and minimum-time checks run at submission, using the signed non-identifying form-load timestamp without a joined server-side view record.
2. Either failed check retains all answers with its respective quarantine reason under RESP-018, while a mature human submission with an empty honeypot is accepted.
3. An operator can reverse either exclusion; exclusions and reversals never change anonymous view or start counters.
4. The reported view/start/submission figures distinguish excluded responses from accepted ones.
5. The stored view fields remain only revision, source, day and count with no response linkage.

### Target: actions that are chased

#### ACT-009 — Action owner reminders

*Tier:* Core · *From:* ACT-009

**Requirement.** An action reminds its owner before, on and after review until its outcome is decided.

**Acceptance.**
1. Email and connected Slack/Teams reminders occur three calendar days before review, on the review date and weekly afterward while unresolved, within WS-002 hours.
2. An action created during the lead period gets its before reminder at the next eligible sending opening.
3. Each occurrence delivers once in order; repeated or concurrent scheduling cannot duplicate it, and outside-hours work is deferred rather than lost.
4. A verdict cancels queued retries and future reminders without the reminder setting a verdict itself.
5. Missing/departed owners and missing email receive no mail and show an honest explanation.
6. The action displays its reminder state and stopped state; INTEG-006 connections use the same timing, deferral and cancellation.

#### ACT-010 — Linked task status

*Tier:* Core · *From:* ACT-009

**Requirement.** An action keeps the status of its linked external task visible and refreshed under INTEG-013.

**Acceptance.**
1. The action displays the linked task’s status.
2. Refreshing reads back that task’s current status and updates the action’s displayed status.

### Target: alerts

#### NOTIFY-005 — Answer-based alerts

*Tier:* Core

**Requirement.** Operators can route form alerts using the shared conditions on answers, hidden fields, scores, calculations and payment state.

**Acceptance.**
1. A matching rule notifies its named operators by email, in-app, Slack/Teams and MOB-003 push.
2. Alerts carry the form, rule and authenticated link without answer text; Slack/Teams may include a triggering answer only when the author chose it and the recipient holds the ROLE-002 identity grant.
3. Numeric and text calculations use the shared typed condition evaluator, and payment-state conditions follow PAY-001/PAY-006/PAY-007.
4. A detractor-only rule alerts once per recipient for a detractor and never a promoter; adding enterprise-plan eligibility restricts it to an enterprise detractor.
5. A calculated-total rule alerts only for its matching total.

#### NOTIFY-006 — Conditional response-email content

*Tier:* Core · *From:* NOTIFY-006 · *Cites:* BASE-INPUT-002

**Requirement.** Editors can define answer-bearing email rules for a form, with recipient custody governed by NOTIFY-007.

**Acceptance.**
1. A rule names operator or other recipients within the documented limit and may condition delivery on answers, hidden fields, scores, calculations or payment state through the shared LOGIC-006/LOGIC-008/LOGIC-009 evaluator.
2. Its subject and body recall answers, declared hidden fields and calculated values under LOGIC-001, with skipped/invalid values blank and every value escaped as text and HTML.
3. Dates use the question’s published FIELD-015/FIELD-020 display format and the message uses the form’s BRAND-002/BRAND-004 theme.
4. Optional Reply-To is one validated email from a question on the respondent’s path; carriage returns or newlines are refused.
5. Sensitive answers render “withheld, sign in to view”. HIPAA-mode forms include no answers or respondent identity, only form/time/authenticated link; contact/invitation identity needs the author’s ROLE-002 grant.
6. An enterprise-only condition and an alternative company-size-or-email-domain condition deliver only for their matching responses, while injected markup remains inert.
7. Per-operator answerless mail remains the default; answers leave only through these rules.

#### NOTIFY-007 — Response-email recipient custody

*Tier:* Core · *From:* NOTIFY-006 · *Cites:* BASE-INPUT-002

**Requirement.** Answer-bearing form messages require verified recipient custody and retain normal exclusion/retry boundaries.

**Acceptance.**
1. A new non-operator mailbox receives one confirmation link before its first answer-bearing message; queued responses deliver once it confirms or expire after seven days with that outcome shown to the Editor.
2. Every message to a non-operator has a one-click unsubscribe that stops that rule for that address.
3. One delivery is queued per rule/recipient/released response, with quarantine admitted only on release and DIST-006 durable attempts/retries.
4. Messages use NOTIFY-004’s sender, link to the authenticated ledger without granting access, and route replies to the respondent rather than Pencil.
5. A confirmed non-operator receives one escaped answer copy with permitted Reply-To and no sensitive value; an equivalent HIPAA message has no answer text, a CRLF Reply-To refuses and unsubscribe prevents the next delivery.

### Target: regulated, accessible and retained collection

#### GOV-001 — HIPAA mode

*Tier:* Core · *Cites:* BASE-DATA-004, BASE-ACCESS-002, BASE-OPS-005 · *Register:* R-10

**Requirement.** Owners can enable HIPAA mode after recording the Business Associate Agreements relied on for Cloudflare, mail and every AI or integration destination receiving PHI.

**Acceptance.**
1. PHI-form answers stay out of emails, alerts, Slack/Teams messages and AI requests unless that destination has a recorded BAA; a connection without one cannot attach to a PHI form.
2. Every PHI response view, export and download is audited, sessions expire after 15 idle minutes, and exports are labelled as containing PHI.
3. A PHI form's alert and digest contain no answers, a Slack connection without a BAA is refused, and the AI provider is eligible for PHI only when its BAA is recorded; a ledger view appears in audit. An eligible agent transfer carries sensitive and external; the company’s policy decides the call.

#### GOV-002 — Data location

*Tier:* Core

**Requirement.** Owners choose the response-data and upload location at installation creation, defaulting to the US where Cloudflare's jurisdiction or location controls support it.

**Acceptance.**
1. The location is recorded at creation, shown in settings and exports, and never silently changes.
2. A US-jurisdiction deployment dry run carries that choice into the generated configuration; settings and the export manifest name the same location.

#### GOV-004 — Sensitive fields

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-005

**Requirement.** A question can be marked sensitive, including tax/identity numbers, dates of birth, bank details and health answers, with encryption and disclosure rules specific to those values.

**Acceptance.**
1. Values are encrypted at rest with an installation key separate from database backups; the raw stored value is ciphertext.
2. Ledger, exports and integrations mask values unless the operator has the identity grant and reveals them; every reveal is audited.
3. Operator alerts and confirmation emails omit sensitive values. An agent’s regulated read carries sensitive and an outside provider transfer also carries external; the company’s policy decides those calls.
4. An Analyst sees a mask while an Admin reveal records an audit row; provider requests contain no sensitive value.
5. LEDG-006/LEDG-008 search matches a phrase in a sensitive answer only for an operator permitted to see that answer.

#### GOV-005 — Audit log viewer

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-DATA-003

**Requirement.** Admins can inspect Pencil's sign-in, role-change, publication, export, reveal, deletion, connection-change and approval events using the shared audit viewer.

**Acceptance.**
1. Filters include actor, form, activity and time; details remain safe and workspace-isolated.
2. An export and a role change can each be found in the viewer and its CSV export.
3. Pagination is bounded and an exported snapshot remains stable across later writes; erasing an actor tombstones its reference without losing the event.

#### GOV-006 — Respondent privacy requests

*Tier:* Core · *Cites:* BASE-DATA-003

**Requirement.** Admins can handle a CCPA/CPRA access or deletion request across the data linked to an email address or phone number.

**Acceptance.**
1. The search includes responses, partials, contacts, uploads, signatures and payment references across forms, and exports them as one portable file.
2. One confirmed command applies DATA-002 erasure and requests deletion from supporting connected integrations, listing providers that cannot delete their copy.
3. Data for one email across three forms appears in the bundle; deleting it produces DATA-002 effects and a deletion request at a connected Google Sheet.

#### GOV-007 — Marketing and messaging consent

*Tier:* Core

**Requirement.** Forms record purpose-specific consent for email marketing, SMS marketing or transactional SMS, including the exact wording and time.

**Acceptance.**
1. Each response records whether consent was given, the wording shown and its time for every bound purpose.
2. For email marketing only, an Editor can make the form itself an opt-in: wording appears immediately above every submitting button, belongs to the published revision and is stored with consent and time on submission, without an extra checkbox.
3. SMS marketing requires its own initially unticked question with the TCPA disclosure, cannot be form-level, and cannot be a condition of submission.
4. Mango/Mailchimp and SMS programs receive a typed or link-supplied address only with matching recorded consent and its time; missing consent appears as a skipped integration delivery with reason no marketing consent.
5. Of two otherwise matching responses, only the consented one reaches the email platform with wording and time; form-level email opt-in works without a checkbox, while publishing form-level SMS-marketing opt-in is refused.

### Target: moving in from every incumbent

#### IMPORT-005 — SurveyMonkey migration

*Tier:* Core

**Requirement.** Operators connect SurveyMonkey by OAuth or upload its survey export, review every element under IMPORT-001 and import historical responses under IMPORT-002 to IMPORT-004.

**Acceptance.**
1. The review covers pages, question types including matrix/ranking, skip/display/advanced branching, collectors and custom variables; AND/OR branches map to LOGIC-006/LOGIC-008, collectors to DIST-017 and custom variables to FIELD-001.
2. Other write-ins retain their selected choice and text under FIELD-010/FIELD-017; descriptive text becomes FIELD-011/FIELD-018 statement steps.
3. FIELD-013 text minimum/maximum, masks, supported patterns and custom messages are retained, as are FIELD-016/FIELD-021 scale start, step count and low/middle/high labels.
4. A documented survey-and-response example retains a two-AND-condition branch as one rule, a matrix outcome, an Other answer, descriptive text, constrained collected text and a labelled scale; every element has a reviewed outcome, and undo removes the import.

#### IMPORT-006 — Jotform migration

*Tier:* Core

**Requirement.** Operators connect a Jotform key or upload a form export and receive reviewed import of its structure and submissions.

**Acceptance.**
1. All/Any conditions and their operators map to LOGIC-006/LOGIC-008 and FIELD-008 show/hide; calculations retain LOGIC-003 meaning.
2. Payment fields map to PAY-006 with a reconnect prompt, uploads copy into FILE-001 storage, and signatures remain images with original submission dates rather than being re-signed.
3. Other answers on radio/checkbox fields retain their write-ins; paragraphs and headers become statements; input masks, text bounds, supported patterns and custom messages retain FIELD-013 settings.
4. Dates preserve FIELD-015/FIELD-020 format and separator, and scales preserve FIELD-016/FIELD-021 start, step count and three labels.
5. A documented example retains an Any-linked contains/empty condition as one rule, a calculation, a copied upload, payment field, radio Other text, paragraph and mask; collected answers obey imported text settings, and scale/date settings match the source.

#### IMPORT-007 — Typeform and Google Forms by connection

*Tier:* Core · *Register:* R-5

**Requirement.** Operators retrieve a Typeform definition and responses with a token, or a Google Form and responses through Google sign-in, without first exporting files and under the same review, privacy and undo rules.

**Acceptance.**
1. Typeform hidden fields become declared FIELD-001 fields; mid-flow statements, groups and inline groups, Other choices/write-ins, text maximums and date format/separator map to their corresponding FIELD clauses. Google text items and Other answers become statements and write-ins.
2. Typeform AND/OR jumps over questions, hidden fields and variables, including contains conditions, become one LOGIC-006/LOGIC-008 rule with the same decision.
3. Conditional add, subtract, multiply, divide and set actions retain starting score, price and custom-variable values as LOGIC-003 calculations; adding a constant to score for a choice becomes LOGIC-004 choice points.
4. Opinion scales retain start, steps and low/middle/high labels; a seven-step scale starting at zero remains 0–6 with its labels.
5. Typeform title, description, preview image and indexing choice map to DIST-020; fonts, element colours, background image/brightness and layouts become a reviewed BRAND-002/BRAND-004 theme. A font that cannot be self-hosted is replaced by the nearest bundled font, with the replacement disclosed.
6. A source example adding ten points for a choice and branching at ten or more routes that choice alone, with no unsupported item; a price built with multiplication/division matches the source for three answer sets.
7. Retrieved examples retain the stated theme, metadata, statements, groups and write-ins, and no source credential is retained.

#### IMPORT-008 — Up-and-comer and Microsoft exports

*Tier:* Core

**Requirement.** Tally, Fillout, Formbricks and Microsoft Forms definitions and responses enter through documented exports or APIs under IMPORT-001 to IMPORT-004.

**Acceptance.**
1. Other choices/write-ins, text/statement blocks and text validation map to FIELD-010/FIELD-017, FIELD-011/FIELD-018 and FIELD-013.
2. A branching form with an Other answer, text block and responses can be imported from each source with those outcomes intact, then undone.

#### IMPORT-009 — Migration checklist

*Tier:* Core

**Requirement.** Every import ends with an actionable checklist for restoring the source form's connections, distribution and delivery behavior.

**Acceptance.**
1. Items cover integrations/webhooks with the matching connection preselected, replacement embeds with new snippets, payments and email notifications to re-enable, public links, NOTIFY-006 self-notification, INTEG-017 conversions and RESP-023 identity.
2. HubSpot, Salesforce, Orbit, Mailchimp and Mango items open their mapping with the sole email question preselected as contact/member key and hidden fields listed, leaving property/merge-field confirmation to the operator.
3. Pasting a Typeform snippet preserves its mode, forwarded parameter names and static hidden values in the matching Pencil embed; an undeclared forwarded/hidden name is listed with a one-click declare action. Without a snippet, other sources prefill campaign/click-ID forwarding.
4. Items can be ticked as completed. The checklist identifies old public links, printed QR codes, sent mail and embeds as still pointing at the source, which Pencil cannot redirect, and provides each replacement link/QR plus the source's onward-redirect option.
5. A Typeform example lists webhook and Sheets items unchecked until matching connections exist; its HubSpot item selects the sole email question, and its popup snippet retains campaign/click-ID forwarding and a fixed hidden value while exposing an undeclared ref for declaration.

### Payments

#### PAY-001 — Payment state and safe replacement

*Tier:* Core · *From:* PAY-001 · *Cites:* BASE-OPS-003, BASE-DATA-001, BASE-DATA-003 · *Register:* R-6

**Requirement.** Pencil owns the response's verified payment state and the safe replacement of closed Checkout attempts; RL-102 governs replacement custody.

**Acceptance.**
1. Committing a payment response creates pending state; only a signature-verified event for its Checkout Session makes it paid. Later events show failed, expired or refunded state, and each provider event applies once.
2. Only paid responses complete invitations and count toward admission targets, collector limits, response mail/digests and paid-only integrations; unpaid responses trigger none of those effects.
3. Before replacement, the original Checkout must be terminal and unable to complete. Original attempt evidence is preserved, a fresh attempt is atomically bound to the same response and current Checkout preferences, and only derived current billing fields reset.
4. Pending or uncertain attempts block replacement and paid attempts never retry; until the invariant is implemented, replacement is refused, leaving the safe retry door owed.
5. Response/payment state and provider Session/PaymentIntent identities survive DATA-001 restoration without live Checkout links or return keys. DATA-002/GOV-003 erase those references with the response; no card or bank numbers are stored.
6. A correctly signed payment completes once, a forged event has no effect, and abandoned Checkout becomes expired; PAY-002 to PAY-005 and NOTIFY-005 inherit this state.

#### PAY-006 — Stripe payment pricing and placement

*Tier:* Core · *From:* PAY-001 · *Cites:* BASE-SECRET-001 · *Register:* R-6

**Requirement.** Operators connect Stripe through Connect OAuth or a restricted key and configure server-priced payment steps in a form.

**Acceptance.**
1. Prices are in USD and support fixed products, quantities, option prices or a LOGIC-003 calculation bounded by minimum and maximum.
2. A payment step follows every answer setting its amount and leads directly to completion; a path reaches at most one payment step.
3. FLOW-006 refuses, naming the step, payment after completion, non-completion destinations, placement before a price-setting answer, hidden-field or skippable-question price inputs, and amounts that can exceed the bounds.
4. Calculated prices use the published revision and are recomputed on the server; the provider receives that total unchanged, and a respondent-supplied replacement amount is refused.

#### PAY-007 — Checkout and respondent return

*Tier:* Core · *From:* PAY-001 · *Cites:* BASE-PUBLIC-001 · *Register:* R-6

**Requirement.** Payment questions send respondents to Stripe's hosted Checkout and return them to their own form with their answers intact.

**Acceptance.**
1. Success returns to the completion screen reached by that respondent's branch under RESP-011.
2. Cancel returns to the payment step showing every answer and marks the pending response cancelled. Stripe ends the old Checkout before PAY-001 permits its next replacement.
3. RESP-012 keys ensure the invitee's or session's next unpaid attempt replaces its prior response rather than duplicating it; completing a second attempt leaves one response.
4. An embedded form asks its host to open Checkout at top level and returns to the form's own page, without loading an inline third-party card field into the respondent surface.

#### PAY-002 — Sales tax, coupons and receipts

*Tier:* Core · *Register:* R-6

**Requirement.** Stripe payment steps can calculate US sales tax from the respondent's address, accept coupons/promotion codes and send Stripe receipts, using PAY-001's verified state and PAY-006 pricing.

**Acceptance.**
1. The response and exports retain subtotal, discount, tax and total.
2. A taxed order with a coupon retains all four amounts exactly as the provider returns them.

#### PAY-003 — Subscriptions and donations

*Tier:* Core · *Register:* R-6

**Requirement.** A payment step can begin a monthly/yearly Stripe subscription or take suggested/custom donations, optionally recurring, under PAY-001's state and replacement rules.

**Acceptance.**
1. The response displays subscription status changes, including later cancellation, from provider webhooks.
2. Custom donation amounts are accepted alongside subscriptions; closed subscription/donation attempts retain the safe retry scope governed by RL-102 even while replacement is temporarily refused.
3. Ongoing billing management hands off to Stripe's customer portal or Nectar.

#### PAY-004 — ACH and other US payment methods

*Tier:* Core · *Register:* R-6

**Requirement.** Payment steps offer Stripe ACH Direct Debit, Apple Pay and Google Pay through Checkout, plus PayPal or Square with equivalent payment states.

**Acceptance.**
1. ACH remains visibly processing until its delayed confirmation succeeds or fails; PayPal/Square use pending, paid and failed states under PAY-001.
2. Both ACH success and failure paths retain their response state, and a PayPal order can become paid.
3. Closed ACH attempts retain safe replacement under PAY-001 and RL-102; temporary refusal does not remove the retry door.

#### PAY-005 — Payment ledger and refunds

*Tier:* Core · *Register:* R-6

**Requirement.** Operators with the identity grant can inspect, reconcile and refund response payments; RL-103 governs period completeness and uncertain/legacy records.

**Acceptance.**
1. Each ledger payment shows provider, ID, amount, method, status and last-four digits only, with status filters and export.
2. Period reconciliation includes every cursor page, or explicitly reports incompleteness and cannot be accepted as reconciled until complete.
3. Full or partial refunds use the provider after amount confirmation; their state returns by webhook. A ten-dollar refund of a forty-dollar payment shows partially refunded, with both amounts in export.
4. Uncertain-refund reservations stay held until provider readback resolves them.
5. Legacy source timestamps remain labelled historical last-change provenance, never asserted as known transaction dates, and closed totals are not silently rewritten.

### Files and signatures

#### FILE-001 — File-upload questions

*Tier:* Core · *Cites:* BASE-INPUT-003

**Requirement.** Respondents can attach multiple files as question answers, with form-specific limits and the same custody as their response.

**Acceptance.**
1. Files remain linked to their response, pass content-signature checks, and download through expiring signed URLs with nosniff.
2. The operator sets file count, size within declared upload limits and allowed types; disguised disallowed content is refused.
3. Uploads follow RESP-010/PART-001 capture, DATA-001 export, DATA-002 erasure and GOV-003/GOV-008 retention, and stay out of AI unless AI-003 applies.
4. Where FILE-003 scanning is configured, files remain quarantined until it passes them.
5. A PDF and JPEG can be uploaded; a renamed executable is refused, the operator's signed PDF download expires, and response erasure removes the objects.

#### FILE-002 — Storage sync

*Tier:* Core

**Requirement.** Uploaded files and WORK-005 submission PDFs can be copied into Google Drive, Dropbox, OneDrive/SharePoint, Box or Chest.

**Acceptance.**
1. Operators choose a per-form or per-response folder naming pattern; copies appear in INTEG-015 delivery tracking.
2. Erasure lists copies that their provider cannot delete.
3. Two uploads reach a per-response folder, and retrying a transient failure keeps the same idempotency key.

#### FILE-003 — Upload scanning

*Tier:* Core

**Requirement.** A configured malware scanner, including Cloudmersive or a VirusTotal private scanner, checks uploads before operator download or storage sync.

**Acceptance.**
1. An infected file remains quarantined with its verdict and cannot be downloaded or forwarded to storage sync; clean files proceed.
2. An EICAR example remains inaccessible while a clean example is released.
3. Without a scanner, settings explicitly say uploads are unscanned.

#### SIGN-001 — Signature fields

*Tier:* Core

**Requirement.** Forms can collect a typed or drawn signature after ESIGN Act and UETA consent, and hand a PDF to Inkwell for multi-party envelopes, signing order, identity verification or certificate signatures.

**Acceptance.**
1. The signed record retains the signature image, exact consent, signer's typed name/email, time, published revision and an integrity hash of the signed answers.
2. WORK-005 renders a signed PDF with its audit page; a drawn-signature example includes consent, signature and matching recomputed answer hash.
3. Later answer changes create a visible new version and cannot alter the signed version.

#### AI-003 — Document extraction with respondent correction

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** A document can prefill later questions with traceable extraction and correction.

**Acceptance.**
1. A form may ask the respondent to upload a document (for example an invoice, a W-9 or a business license) and prefill later questions from fields ai provider adapter extracts; every prefilled value is shown for correction and stored with an extracted/corrected marker.
2. Extraction carries standard, adding sensitive for regulated document fields; the company’s policy decides whether readings fill the fields or wait for confirmation.
3. No identity, credit or eligibility decision is made from the extraction.
4. With the AI receiver fixture, the specialist extracts three fields from a fixture, invoice, the respondent corrects one, and the response stores two `extracted` and one `corrected` values.

### Feedback programs (NPS, CSAT, CES)

#### PROG-001 — Program setup

*Tier:* Core

**Requirement.** Operators create recurring relationship or event-driven transactional NPS, CSAT and CES programs with a shared contact fatigue rule.

**Acceptance.**
1. A program chooses a FIELD-003 question set, a segment/CRM/in-product/ticket-event audience, email-embedded/SMS/in-product channels and DIST-016 cadence or PROG-002 triggers.
2. Overlapping contacts in quarterly NPS and transactional CSAT programs receive no second survey inside the fatigue window.

#### PROG-002 — Transactional triggers

*Tier:* Core

**Requirement.** Programs survey after ticket resolution, order fulfilment, a won deal or a signed API event, after a configured delay.

**Acceptance.**
1. Sources include HappyToHelp, Zendesk, Intercom, Help Scout, Stall, Shopify, Orbit, HubSpot and INTEG-011; each event ID triggers at most one survey.
2. The response retains the triggering ticket/deal/order context, including its actor where provided, for reporting.
3. Repeating a ticket-solved event creates one delayed CSAT invitation, with its ticket ID on the response and in per-agent reporting.

#### PROG-003 — Score tracking

*Tier:* Core

**Requirement.** Program dashboards show score trends and comparable respondent segments with ANLY-005 suppression.

**Acceptance.**
1. Metrics include promoter/passive/detractor or satisfied shares, a 95% confidence margin, response rate and breakdowns by account, plan, agent, channel or hidden field.
2. For a seeded quarter, weekly NPS, its margin and per-agent CSAT equal hand-computed values.

#### PROG-004 — Closed-loop follow-up

*Tier:* Core

**Requirement.** Detractor, low-CSAT and high-effort responses create owned follow-up work with due time and the respondent's permission state.

**Acceptance.**
1. Owners record outreach and outcome and can send the item to HappyToHelp/Zendesk as a ticket or Orbit/HubSpot as an account task.
2. Reports show the share of detractors followed up inside the target time; anonymous items retain no contact route.
3. An identified detractor creates a follow-up item and a help-desk ticket containing only confirmed fields; closing it contributes to the follow-up rate.

### Integrations

#### INTEG-001 — Google Sheets

*Tier:* Core · *Register:* R-7

**Requirement.** A form synchronizes its released responses to a chosen Google Sheet, retaining one stable row per response.

**Acceptance.**
1. Connecting backfills existing responses; three existing responses create three rows, and a fourth submission appends one row.
2. Headers identify columns by stable step ID and label; publishing a new question appends its column.
3. RESP-021 edits update the existing row, while DATA-002 erasure deletes or blanks that row.

#### INTEG-002 — Microsoft Excel

*Tier:* Core

**Requirement.** INTEG-001's response synchronization also writes to workbook tables in OneDrive or SharePoint through Microsoft Graph.

**Acceptance.**
1. New responses append rows to the chosen workbook table.
2. DATA-002 erasure removes the corresponding row under the same custody as Sheets.

#### INTEG-003 — HubSpot contact delivery

*Tier:* Core · *From:* INTEG-003

**Requirement.** Admins connect HubSpot by OAuth under INTEG-016 and Editors attach a form whose published disclosure names it; INTEG-018 defines property mapping and related CRM records.

**Acceptance.**
1. A chosen email question is the primary contact key on an anonymous form: released typed emails are trimmed, validated and matched case-insensitively to create or update one contact, including ordinary public/ad/embed visits without an identity parameter.
2. Identified responses use the link email only when no email question is chosen or its answer is blank. Typed answers create no Pencil contact, participant or link identity, and disclosure names the email and mapped-answer transfer before the first answer.
3. Absent disclosure sends nothing; absent typed/link email produces a skipped delivery naming no contact email. Anonymous deliveries contain no session, invitation, host-page or network identifier, only mapped answers and hidden fields.
4. Retries/replay never duplicate a contact or deal, and RESP-021 edits update mapped values on the same record.
5. Optional PART-001 early upsert sends once the email step is saved, with only answered mapped fields and partial status under the named disclosure; completion updates that contact to completed, and a retained partial's deletion sends nothing further.
6. A second differently cased email updates the first contact; blank email and omitted disclosure send nothing; abandoning an early-upsert response and completing another with the same email shows partial then completed.

#### INTEG-018 — HubSpot property mapping

*Tier:* Core · *From:* INTEG-003

**Requirement.** Editors map form data to HubSpot's existing contact, company and deal properties, and can associate related CRM work without disclosing unmapped answers.

**Acceptance.**
1. Properties and schema refresh on opening and on demand; sources include answers, FIELD-001 campaign/click-ID fields, LOGIC-003 calculations, LOGIC-004 scores/outcomes, form name, submission time and authenticated response link.
2. Choices map as labels or per-option values, multiple choices as checkbox selections, dates as dates and numbers as numbers; Pencil creates no provider property.
3. Saving refuses missing, read-only, calculated or incompatible properties and unmatched enumeration options, naming the property and reason.
4. A later deleted/changed property produces an INTEG-015 failure with HubSpot's reason and a connection-page notice; the rest of the delivery is not silently dropped.
5. Blank/skipped answers never clear a value; each property chooses overwrite, the default, or fill-only-when-empty.
6. Optional company upsert matches a mapped domain and associates the contact; optional deals use a chosen pipeline/stage, and timeline notes contain the form name and response link, never unmapped answers.
7. A typed-email example delivers mapped company and campaign values, preserves existing values for blanks, refuses missing properties by name and records a later-deleted property's provider error.

#### INTEG-004 — Salesforce

*Tier:* Core

**Requirement.** Admins connect Salesforce by OAuth under INTEG-016, and Editors attach disclosed forms using INTEG-003's typed/link-email, Pencil privacy, early-upsert and nothing-sent rules.

**Acceptance.**
1. Editors choose Lead or Contact; matching is case-insensitive and prefers an existing Contact, otherwise a Lead. Multiple matches choose the most recently modified and record that choice; absent matches create a Lead with mapped or default company.
2. The selected record schema lists existing fields; Editors map answers, hidden/campaign fields, calculations, scores and response link, with picklists restricted to matching options.
3. Missing, read-only or incompatible fields are refused by name at save; later changes produce INTEG-015 provider errors. Blank answers preserve values and replay never duplicates a record.
4. Optional delivery joins a chosen or campaign-mapped campaign and opens a case.
5. Two differently cased typed emails update one Lead with mapped company/campaign data; a matching Contact creates no Lead. Blank email or omitted disclosure sends nothing, and missing fields or later type mismatches show their named refusal/failure.

#### INTEG-005 — Orbit

*Tier:* Core

**Requirement.** Orbit natively receives contacts, deal notes and response links using INTEG-003's contact-key, privacy, disclosure and nothing-sent rules.

**Acceptance.**
1. Typed email on an anonymous form, or identified link email where allowed, upserts one case-insensitively matched Orbit contact; Pencil retains RESP-006 separation.
2. Answers, hidden/campaign fields, calculations and scores map to Orbit's listed contact/custom schema; missing or mistyped fields are refused by name at save.
3. Repeated differently cased emails update one contact with mapped company/campaign data; blank email sends nothing.
4. Orbit can launch a Pencil invitation from a contact or deal; a one-contact launch is accepted.

#### INTEG-006 — Slack and Microsoft Teams

*Tier:* Core · *Register:* R-9

**Requirement.** Forms and NOTIFY-005 alerts can post response summaries to Slack, Teams and Nook, and create Pencil actions from their messages.

**Acceptance.**
1. Messages contain form, time, an allowed non-sensitive-answer summary and an authenticated link; sensitive fields are refused.
2. Slack interaction signatures are checked before a message creates an action.
3. Slack and Teams remind the action owner three calendar days before review, on review day and weekly while unresolved, under ACT-009/ACT-010 and WS-002.
4. Clock advancement shows once-only reminders, sending-window deferral and cancellation after the owner verdict for both platforms.

#### INTEG-007 — Mailchimp and Mango members

*Tier:* Core · *From:* INTEG-007

**Requirement.** Admins connect Mailchimp by OAuth or Mango under INTEG-016; Editors attach one disclosed audience/list, with field and tag mapping governed by INTEG-019.

**Acceptance.**
1. A released response with GOV-007 consent upserts by the chosen typed email, trimmed, validated and case-insensitively matched; an identified link email is fallback only when no email question is chosen or it is blank.
2. An anonymous form's typed email remains only its answer, with no Pencil contact, participant or link identity; disclosure names email and mapped-answer transfer before the first answer.
3. New members take the chosen subscribed or pending/double-opt-in state, which sends Mailchimp confirmation mail for pending, with consent time and no IP address. Existing subscribed/pending members retain state while mapped fields/tags update.
4. Unsubscribed, cleaned or compliance-held members remain entirely unchanged and are skipped with the provider's reason; they are never resubscribed.
5. Missing disclosure sends nothing; absent consent or email is skipped as no marketing consent or no member email respectively. Partial responses never enter an audience.
6. Replay never duplicates members/tags; edits update mapped fields and add tags. Mango applies the same rules to its own schema.
7. Differently cased emails update one member; explicit-question or form-level email consent works, while no-consent and blank-email cases skip. An unsubscribed member stays unchanged, and choosing pending creates a pending member.

#### INTEG-019 — Email-platform fields and tags

*Tier:* Core · *From:* INTEG-007

**Requirement.** Editors map form data into existing Mailchimp merge fields, tags and interests or Mango list fields/tags, refreshed with schema on opening and on demand.

**Acceptance.**
1. Sources include answers, hidden/campaign fields, calculations, scores/outcomes, form name and submission time; names map to first/last names, choices to matching dropdown/radio options, dates to the audience's format, numbers to numbers and phones to phones.
2. Choice, multiple-choice, yes/no, ranking and quiz outcomes add one label/per-option tag per selected option or set matching interests; fixed form tags are supported, and free text never becomes a tag.
3. Saving refuses absent or incompatible fields/options and required fields left unmapped, naming field and reason. New tags are shown as new and created only after confirmation at save; agent-created changes carry external and the company's policy decides their disposition.
4. Later deleted/changed merge fields produce INTEG-015 provider errors and connection-page notices; blank/skipped answers preserve existing values, and tags are added but never removed.
5. A consented member receives mapped first name, interest tag and fixed newsletter tag; required last-name omission and missing field are refused, and a blank name preserves the prior first name.
6. A replay adds no member; deleting a mapped provider field produces its named failure. The same mapped-field/tag example adds one Mango list member.

#### INTEG-008 — Notion, Airtable and Cradle

*Tier:* Core

**Requirement.** A form creates or updates one record per released response in Notion, Airtable or Cradle, using INTEG-016 custody and INTEG-015 delivery tracking.

**Acceptance.**
1. Destination columns/types refresh on opening and demand; sources include answers, hidden/campaign fields, calculations, scores/outcomes, form name, submission time, response ID and authenticated link.
2. Choices map by option name to single/status selects, multiple choices to multiple selects, yes/no to checkboxes, numeric answers/scales/scores to numbers, dates to dates, email/phone/URL to matching types and text to text. Uploads become authenticated text/URL links, never public attachments.
3. Save refuses absent, computed or incompatible columns by name/reason, and missing select options by name unless add missing options is enabled; then the provider creates options on first use.
4. Columns later deleted, renamed or retyped produce provider errors in the delivery ledger and connection page; blank/skipped answers never clear values.
5. A mapped response ID deduplicates retry/replay and preserves same-record updates on edit; an optional match column updates a pre-existing record instead.
6. Provider rate-limit responses honor the requested retry delay within bounded retries.
7. Each destination receives its typed record; Airtable retains choice/multiple-choice/date/number values and Notion retains title/single/multiple selects. Missing columns/options refuse by name, option creation enables delivery, rate-limited calls retry, edits update the same record and later deleted columns produce their provider error.

#### INTEG-009 — Zapier, Make, n8n and Crank

*Tier:* Core

**Requirement.** Pencil publishes Zapier, Make and n8n integrations over its webhook/API doors and serves as a native Crank source.

**Acceptance.**
1. Triggers cover new/updated responses, partial saves, paid payments and approval decisions; actions find responses, create contacts and send invitations.
2. DOCS-001 recipes map answers, hidden fields and response identity into create/update actions for ActiveCampaign, Pipedrive, monday.com and Zoho CRM.
3. A REST-hook subscription receives a new-response event and can unsubscribe; the published Zapier definition validates, and each recipe's sample matches the trigger output schema.

#### INTEG-010 — Signed response webhooks

*Tier:* Core · *Cites:* BASE-OPS-003

**Requirement.** Operators register secure per-form or workspace destinations for response-created/updated/deleted, partial-save, payment-change and approval-decision events.

**Acceptance.**
1. Each delivery has a verifiable body signature, stable event ID and timestamp, with every attempt recorded, backoff retries for 24 hours and manual replay.
2. Sustained failure disables the destination and shows an alert.
3. A receiver can verify an event, fail twice, receive two retries with the same event ID and then a replay; disabled status and its alert are visible.

#### INTEG-011 — Public REST API

*Tier:* Core · *Cites:* BASE-ACCESS-004, BASE-ROLE-001

**Requirement.** A versioned, documented API gives scoped integration tokens the form, response, contact, invitation and result actions available to their granted role and form access.

**Acceptance.**
1. The API lists/reads forms and creates, updates, duplicates and publishes import-format definitions; validation reports dangling branches by step and publication creates an immutable revision. It also manages hidden fields, themes and webhooks.
2. Responses can be read/deleted with filters and cursor pages; contacts can be created, invitations launched and aggregates read. Admin-created tokens have scopes/expiry, hashed storage, rate limits and audit, with ROLE-002 masking/access.
3. A read-only token can page through 250 responses and is refused deletion; a form-write token creates/publishes a branching form, while invalid definitions are refused. The published OpenAPI description validates.
4. An aggregate-only token follows RSLT-009/RSLT-015 disclosure within a result: complementary figures and refusals equal those doors' aggregate-only cases.

#### INTEG-012 — MCP server for Claude and ChatGPT

*Tier:* Core · *Cites:* BASE-AGENT-001, BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Register:* R-11

**Requirement.** An authenticated MCP client can do Pencil's form and evidence jobs under the company's policy; INTEG-012 adds suppression and draft-to-outreach workflows to the Base agent door.

**Acceptance.**
1. Tools list forms, draft under AI-001, query results/crosstabs with ANLY-005 suppression, read permitted cited excerpts and prepare invitations or actions.
2. Drafting carries standard; publication or invitations carry external, and an action carries its server-computed classes. The company's policy decides each call, including whether a person confirms it in Pencil.
3. Within one result, aggregate-only disclosure follows RSLT-009/RSLT-015: complementary figures receive identical suppression/refusal.
4. Under the held company policy, an OAuth client drafts a form, receives no excerpts for a suppressed cohort and prepares an invitation without sending it until the policy's person confirms the exact action in Pencil.

#### INTEG-013 — Task destinations

*Tier:* Core

**Requirement.** Pencil actions can create-or-get linked work in Linear, Jira, Asana, GitHub Issues, Vector, Todoist or a generic webhook destination.

**Acceptance.**
1. Each destination receives the confirmed payload with idempotent delivery states; repeat delivery creates no second task.
2. ACT-009/ACT-010 reads the linked task's status back onto the action and refreshes it after changes, including closed state.
3. The external status never sets Pencil's own outcome verdict.

#### INTEG-014 — Help-desk and commerce event sources

*Tier:* Core

**Requirement.** HappyToHelp, Zendesk, Intercom, Help Scout, Stall and Shopify provide PROG-002 event sources, while Buoy receives per-account program scores.

**Acceptance.**
1. Each source's signed webhook is verified and unsigned events are refused.
2. An account score can be delivered to Buoy.

#### INTEG-015 — Integration delivery ledger

*Tier:* Core · *Cites:* BASE-OPS-004

**Requirement.** Operators can trace each response's outbound rows, records, contacts, messages, files, webhooks and tasks independently of ongoing collection.

**Acceptance.**
1. Every delivery retains pending, confirmed, unknown or failed state, its idempotency key and every attempt/reason, with bounded retries, replay and an in-app failure alert.
2. Operators see the exact undelivered response IDs; a broken connection never prevents collecting responses.
3. With Sheets unavailable, five responses collect and show five failures plus an alert; repair/replay yields five confirmed rows without duplicates.

#### INTEG-016 — Connection custody

*Tier:* Core · *Cites:* BASE-SECRET-001, BASE-DATA-004

**Requirement.** Each provider connection has one managed custody page and automatically updates the disclosure of every attached form.

**Acceptance.**
1. Connections use least-privilege OAuth where offered; secrets are encrypted under an installation key bound to the setting's identity and excluded from data exports.
2. Operators can test, rotate and revoke the connection from its page.
3. Connecting, testing, revoking and reconnecting Sheets adds/removes Google Sheets in attached-form disclosure while exports contain no provider token.

#### INTEG-017 — Server-side ad conversion delivery

*Tier:* Core · *From:* INTEG-017

**Requirement.** Admins connect Meta Conversions API, GA4 Measurement Protocol and Google Ads click-conversion upload under INTEG-016; Editors enable them per form. Google Ads uses Google sign-in and a chosen conversion action; provider field encodings are in the operating rules.

**Acceptance.**
1. Released responses, including quarantine releases, emit completed events; PAY-001 verified payments emit paid events carrying USD amount. Each destination receives one event per submission with a shared random deduplication ID.
2. Only event/time, public form ID, declared click/campaign fields, eligible GA4 client ID and paid value travel; answer text, response IDs and scores never do. Click IDs may arrive by link or DIST-024 forwarding.
3. Hashed normalized email/phone identifiers reach Meta/Google Ads only for an identified RESP-023 form.
4. A destination receives no event unless named in that revision's RESP-005 disclosure, and Global Privacy Control opts the response out of all conversion sharing.
5. Anonymous click IDs exist only in delivery custody, never on the response, and are purged on confirmation or terminal failure.
6. Without a genuine GA4 client ID from the declared link field, opted-in host cookie or embed hidden input, GA4 is skipped as no GA4 client ID; one is never invented. Meta/Ads attribution for the same response remains unaffected.
7. Declared campaign and platform click IDs yield the matching Meta/GA4/Ads events; verified payment amount survives, missing disclosure/privacy-control refuses sharing, and the same direct ad link sends Ads alone without a client ID or adds GA4 when a declared client ID is present.

#### INTEG-020 — Embed conversion events and diagnostics

*Tier:* Core · *From:* INTEG-017

**Requirement.** Script embeds expose a privacy-preserving completion trigger for host-page analytics, with conversion connection diagnostics tracked alongside server delivery.

**Acceptance.**
1. The host completion event shares INTEG-017's deduplication ID; enabling the data-layer option emits one completed push containing only the event name, public form ID and event ID, never answers or response IDs.
2. DOCS-001 documents the Google Tag Manager Custom Event recipe.
3. An embed forwarding the host's Google/Meta click IDs produces the matching attributed conversions; its opted-in host analytics cookie supplies GA4's existing client ID.
4. Deliveries use INTEG-015 retries/replay and each provider's error reason; connection test actions send to Meta's test code or GA4's validation service.

### Mobile and offline

#### MOB-001 — Operator app on a phone

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001

**Requirement.** Pencil's operator workflow remains usable on a narrow touch screen, in addition to the shared accessibility bar.

**Acceptance.**
1. Dashboard, builder, results, ledger, inbox, actions and settings fit 360 CSS pixels with no horizontal scroll and touch targets at least 44 pixels.
2. On a phone, an operator can build/publish a form, review a response and approve a submission.

#### MOB-002 — Offline field collection

*Tier:* Core

**Requirement.** An installable progressive web app collects responses offline on phones/tablets for field visits, events and kiosks.

**Acceptance.**
1. Responses are encrypted on device and uploaded after reconnection using RESP-012 keys, so retries create no duplicate.
2. The device shows pending-upload count; the ledger distinguishes each response's capture time from upload time.
3. Three responses completed offline arrive exactly once after reconnection, each with capture earlier than upload.

#### MOB-003 — Native iOS and Android apps

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-SIGNIN-001 · *Register:* R-3

**Requirement.** Native operator apps provide response/alert/approval push, results and inbox views, offline kiosk collection and installation-native or SSO sign-in; store publication is field proof.

**Acceptance.**
1. Both iOS and Android receive a new-response push and open it to approve the submission.
2. Push paths include new responses, NOTIFY-005 alerts and WORK-002 approvals; offline kiosk collection follows MOB-002.
3. An iOS simulator and Android emulator against a local installation exercise sign-in, provider-shaped push delivery and approval from the notification.

### Agent surface

**Specialist: study and feedback operator.** It designs a study, collects the appropriate audience, checks response evidence and carries measured findings into owned follow-up work.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call.

**How Pencil computes each class.**

- **access.** An operator, role, per-form folder or grant change alters continuing authority. Facts name people, forms and widening or narrowing direction.

- **commitment.** A signature, submission approval or relied-on effectiveness verdict binds the business. Facts name the submission or action, counterparty and stated value.

- **destructive.** Erasing response-linked data or executing irreversible retention cannot be undone in Pencil. Facts name the record types and item count after the current hold and erasure selection.

- **external.** A publish, invitation, notification, model-provider request, export to a connected service or shared report newly reaches an outside recipient. Facts name recipients, count, and known, new or public counterparty from saved contacts, domains and public visibility; changing a form or record already visible outside counts too.

- **gated.** The provider keeps OAuth consent, account verification or hosted payment entry for a person, or returns a person-required step. Facts name the provider and exact step; an API or broker route uses the company’s policy for its classes.

- **live.** Publishing, closing, changing a live collector or changing a running program affects current respondents. Facts name the installation, form revision or program and active audience.

- **money.** A Checkout amount, subscription, donation or refund changes money collected or returned. Facts name the provider, counterparty, amount and currency computed from the saved payment attempt.

- **security.** A connection credential, scanning rule or regulated-data protective setting is handled or changed. Facts name the setting and provider without secret values.

- **sensitive.** A document or response reads or writes regulated health, identity, bank, card or payroll values. Facts come from the published question/data classification and record fields, with record count and data kind.

- **standard.** An internal draft, reversible edit or result query stays within the business; facts name its forms, responses and item count.

| Tool | Does | Core clauses | Risk class | Today |

| --- | --- | --- | --- | --- |

| `pencil.oper.equal_operators` | Equal operators | OPER-001 | standard or access | not built |

| `pencil.oper.manage_equal_operators` | Manage equal operators | OPER-002 | standard or access | not built |

| `pencil.oper.sign_in_depends_on_mail` | Sign-in depends on mail | OPER-003 | standard or access | not built |

| `pencil.ws.workspace_time_zone` | Workspace time zone | WS-001 | standard | not built |

| `pencil.ws.sending_hours` | Sending hours | WS-002 | standard | not built |

| `pencil.ws.optional_analysis_and_task_connections` | Optional analysis and task connections | WS-003 | standard | not built |

| `pencil.brand.saved_business_identity` | Saved business identity | BRAND-001 | standard | not built |

| `pencil.brand.branded_response_email` | Branded response email | BRAND-003 | standard | not built |

| `pencil.dash.first_flow` | First flow | DASH-001 | standard | not built |

| `pencil.dash.flow_list` | Flow list | DASH-002 | standard | not built |

| `pencil.flow.flow_lifecycle` | Flow lifecycle | FLOW-001 | standard or external or live | not built |

| `pencil.flow.ordered_form_steps` | Ordered form steps | FLOW-002 | standard | not built |

| `pencil.flow.question_types` | Question types | FLOW-003 | standard | not built |

| `pencil.flow.saved_edits` | Saved edits | FLOW-004 | standard | not built |

| `pencil.flow.answer_branching` | Answer branching | FLOW-005 | standard | not built |

| `pencil.flow.publication_validation` | Publication validation | FLOW-006 | standard | not built |

| `pencil.flow.preview_isolation` | Preview isolation | FLOW-007 | standard | not built |

| `pencil.flow.published_revisions` | Published revisions | FLOW-008 | standard or external or live | not built |

| `pencil.flow.edits_to_live_forms` | Edits to live forms | FLOW-009 | standard | not built |

| `pencil.flow.close_a_form` | Close a form | FLOW-010 | standard or live | not built |

| `pencil.flow.duplicate_a_form` | Duplicate a form | FLOW-011 | standard | not built |

| `pencil.flow.valid_branch_references` | Valid branch references | FLOW-012 | standard | not built |

| `pencil.flow.reachable_completion` | Reachable completion | FLOW-013 | standard | not built |

| `pencil.flow.valid_questions` | Valid questions | FLOW-014 | standard | not built |

| `pencil.flow.stable_question_and_choice_identities` | Stable question and choice identities | FLOW-015 | standard | not built |

| `pencil.flow.published_policy_snapshot` | Published policy snapshot | FLOW-016 | standard | not built |

| `pencil.flow.revision_admission` | Revision admission | FLOW-017 | standard | not built |

| `pencil.flow.revision_completion_counts` | Revision completion counts | FLOW-018 | standard | not built |

| `pencil.flow.typed_answer_values` | Typed answer values | FLOW-019 | standard | not built |

| `pencil.flow.required_questions_follow_the_chosen_path` | Required questions follow the chosen path | FLOW-020 | standard | not built |

| `pencil.flow.retain_answers_after_question_changes` | Retain answers after question changes | FLOW-021 | standard | not built |

| `pencil.logic.conditional_completion_and_redirects` | Conditional completion and redirects | LOGIC-005 | standard or external | not built |

| `pencil.field.randomized_choice_and_question_order` | Randomized choice and question order | FIELD-006 | standard | not built |

| `pencil.aud.contacts` | Contacts | AUD-001 | standard | not built |

| `pencil.aud.segments_and_frozen_launches` | Segments and frozen launches | AUD-002 | standard | not built |

| `pencil.aud.invitation_participants` | Invitation participants | AUD-003 | standard | not built |

| `pencil.aud.invitation_eligibility` | Invitation eligibility | AUD-004 | standard | not built |

| `pencil.aud.replay_a_launch` | Replay a launch | AUD-005 | standard | not built |

| `pencil.aud.eligibility_at_send_time` | Eligibility at send time | AUD-006 | standard | not built |

| `pencil.dist.public_form_link` | Public form link | DIST-001 | standard or external | not built |

| `pencil.dist.inline_embed` | Inline embed | DIST-002 | standard or external | not built |

| `pencil.dist.invitations` | Invitations | DIST-003 | standard or external | not built |

| `pencil.dist.reminders` | Reminders | DIST-004 | standard or external | not built |

| `pencil.dist.opt_out_and_renewed_consent` | Opt-out and renewed consent | DIST-005 | standard or external | not built |

| `pencil.dist.mail_retry` | Mail retry | DIST-006 | standard or external | not built |

| `pencil.dist.mail_failure_isolation` | Mail failure isolation | DIST-007 | standard or external | not built |

| `pencil.dist.failed_invitation_recovery` | Failed invitation recovery | DIST-008 | standard or external | not built |

| `pencil.dist.embed_isolation` | Embed isolation | DIST-009 | standard or external | not built |

| `pencil.dist.embedded_payment_handoff` | Embedded payment handoff | DIST-022 | standard or external | not built |

| `pencil.dist.uncertain_mail_recovery` | Uncertain mail recovery | DIST-010 | standard or external | not built |

| `pencil.dist.collector_qr_codes` | Collector QR codes | DIST-012 | standard or external | not built |

| `pencil.dist.restricted_collection` | Restricted collection | DIST-019 | standard or external or access | not built |

| `pencil.resp.anonymous_means_anonymous` | Anonymous means anonymous | RESP-006 | standard | not built |

| `pencil.resp.admission_per_invitation` | Admission per invitation | RESP-008 | standard | not built |

| `pencil.resp.concurrent_closure` | Concurrent closure | RESP-009 | standard | not built |

| `pencil.resp.session_metrics` | Session metrics | RESP-013 | standard | not built |

| `pencil.resp.owned_abuse_defenses` | Owned abuse defenses | RESP-015 | standard | not built |

| `pencil.resp.retained_bot_exclusions` | Retained bot exclusions | RESP-016 | standard | not built |

| `pencil.resp.exporting_automated_exclusions` | Exporting automated exclusions | RESP-026 | standard | not built |

| `pencil.resp.retained_minimum_time_exclusions` | Retained minimum-time exclusions | RESP-017 | standard | not built |

| `pencil.resp.quarantine_review` | Quarantine review | RESP-018 | standard | not built |

| `pencil.resp.retained_flow_metrics` | Retained flow metrics | RESP-019 | standard | not built |

| `pencil.ledg.response_ledger` | Response ledger | LEDG-001 | standard or sensitive | not built |

| `pencil.ledg.collection_counts` | Collection counts | LEDG-002 | standard or sensitive | not built |

| `pencil.ledg.response_filters` | Response filters | LEDG-003 | standard or sensitive | not built |

| `pencil.ledg.response_export` | Response export | LEDG-004 | standard or sensitive | not built |

| `pencil.rslt.response_summary` | Response summary | RSLT-001 | standard or sensitive | not built |

| `pencil.rslt.drop_off_by_question` | Drop-off by question | RSLT-002 | standard or sensitive | not built |

| `pencil.rslt.stated_denominators` | Stated denominators | RSLT-003 | standard or sensitive | not built |

| `pencil.rslt.device_split` | Device split | RSLT-004 | standard or sensitive | not built |

| `pencil.rslt.results_across_revisions` | Results across revisions | RSLT-005 | standard or sensitive | not built |

| `pencil.rslt.open_text_coding` | Open-text coding | RSLT-012 | standard or sensitive | not built |

| `pencil.anly.analysis_run` | Analysis run | ANLY-001 | standard or external or sensitive | not built |

| `pencil.anly.fixed_evidence_set` | Fixed evidence set | ANLY-002 | standard or external or sensitive | not built |

| `pencil.anly.findings` | Findings | ANLY-003 | standard or external or sensitive | not built |

| `pencil.anly.exact_evidence` | Exact evidence | ANLY-004 | standard or external or sensitive | not built |

| `pencil.anly.disclosure_threshold` | Disclosure threshold | ANLY-005 | standard or external or sensitive | not built |

| `pencil.anly.recommendations` | Recommendations | ANLY-006 | standard or external or sensitive | not built |

| `pencil.anly.staleness` | Staleness | ANLY-007 | standard or external or sensitive | not built |

| `pencil.anly.provider_failure` | Provider failure | ANLY-008 | standard or external or sensitive | not built |

| `pencil.anly.builder_assistance` | Builder assistance | ANLY-009 | standard or external or sensitive | not built |

| `pencil.anly.ai_usage_and_cost` | AI usage and cost | ANLY-010 | standard or external or sensitive | not built |

| `pencil.anly.evidence_provenance` | Evidence provenance | ANLY-011 | standard or external or sensitive | not built |

| `pencil.anly.output_validation` | Output validation | ANLY-012 | standard or external or sensitive | not built |

| `pencil.anly.insufficient_evidence` | Insufficient evidence | ANLY-013 | standard or external or sensitive | not built |

| `pencil.anly.untrusted_evidence` | Untrusted evidence | ANLY-014 | standard or external or sensitive | not built |

| `pencil.anly.analysis_and_report_policy_snapshots` | Analysis and report policy snapshots | ANLY-015 | standard or external or sensitive | not built |

| `pencil.anly.provider_retry` | Provider retry | ANLY-016 | standard or external or sensitive | not built |

| `pencil.act.action_record` | Action record | ACT-001 | standard | not built |

| `pencil.act.action_lifecycle` | Action lifecycle | ACT-002 | standard | not built |

| `pencil.act.external_task` | External task | ACT-003 | standard | not built |

| `pencil.act.task_failure` | Task failure | ACT-004 | standard | not built |

| `pencil.act.follow_up_measurement` | Follow-up measurement | ACT-005 | standard or commitment | not built |

| `pencil.act.exact_task_payload` | Exact task payload | ACT-006 | standard | not built |

| `pencil.act.task_delivery_state` | Task delivery state | ACT-007 | standard | not built |

| `pencil.act.manual_recommendation` | Manual recommendation | ACT-008 | standard | not built |

| `pencil.notify.analysis_attention` | Analysis attention | NOTIFY-001 | standard or external | not built |

| `pencil.notify.new_response_mail` | New-response mail | NOTIFY-002 | standard or external | not built |

| `pencil.notify.daily_digest` | Daily digest | NOTIFY-003 | standard or external | not built |

| `pencil.notify.no_mail_loops` | No mail loops | NOTIFY-004 | standard or external | not built |

| `pencil.data.export_contents` | Export contents | DATA-001 | standard or destructive | not built |

| `pencil.data.response_erasure` | Response erasure | DATA-002 | standard or destructive | not built |

| `pencil.gov.retention_schedules` | Retention schedules | GOV-003 | standard or destructive | not built |

| `pencil.gov.legal_hold_and_release` | Legal hold and release | GOV-008 | standard or destructive | not built |

| `pencil.role.workspace_roles` | Workspace roles | ROLE-001 | standard or access | not built |

| `pencil.role.workspace_roles_005` | Workspace roles: For roles without form-response access, it inherits the RSLT-009 aggregate-only fixtu | ROLE-005 | standard or access | not built |

| `pencil.role.per_form_access_and_folders` | Per-form access and folders | ROLE-002 | standard or access | not built |

| `pencil.role.single_sign_on_and_provisioning` | Single sign-on and provisioning | ROLE-003 | standard or access | not built |

| `pencil.role.builder_collaboration` | Builder collaboration | ROLE-004 | standard or access | not built |

| `pencil.brand.form_design_themes` | Form design themes | BRAND-002 | standard | not built |

| `pencil.brand.reusable_theme_custody` | Reusable theme custody | BRAND-004 | standard | not built |

| `pencil.tmpl.template_gallery` | Template gallery | TMPL-001 | standard | not built |

| `pencil.tmpl.team_templates` | Team templates | TMPL-002 | standard | not built |

| `pencil.ai.generate_a_form_from_a_prompt_or_a_document` | Generate a form from a prompt or a document | AI-001 | standard or external | not built |

| `pencil.field.hidden_fields_and_url_parameters` | Hidden fields and URL parameters | FIELD-001 | standard | not built |

| `pencil.field.matrix_likert_and_scale_grids` | Matrix, Likert and scale grids | FIELD-002 | standard | not built |

| `pencil.field.csat_ces_and_visual_rating_questions` | CSAT, CES and visual rating questions | FIELD-003 | standard | not built |

| `pencil.field.us_contact_fields` | US contact fields | FIELD-004 | standard | not built |

| `pencil.field.media_in_questions_and_choices` | Media in questions and choices | FIELD-005 | standard | not built |

| `pencil.field.scheduling_handoff` | Scheduling handoff | FIELD-007 | standard | not built |

| `pencil.field.classic_page_layout` | Classic page layout | FIELD-008 | standard | not built |

| `pencil.field.video_and_audio_answers` | Video and audio answers | FIELD-009 | standard | not built |

| `pencil.field.other_write_ins_and_exclusive_none_choices` | Other write-ins and exclusive None choices | FIELD-010 | standard | not built |

| `pencil.field.import_other_choices_and_historical_write_ins` | Import Other choices and historical write-ins | FIELD-017 | standard | not built |

| `pencil.field.statement_screens_between_questions` | Statement screens between questions | FIELD-011 | standard | not built |

| `pencil.field.import_statement_screens` | Import statement screens | FIELD-018 | standard | not built |

| `pencil.field.question_groups` | Question groups | FIELD-012 | standard | not built |

| `pencil.field.text_length_masks_and_patterns` | Text length, masks and patterns | FIELD-013 | standard | not built |

| `pencil.field.long_choice_lists` | Long choice lists | FIELD-014 | standard | not built |

| `pencil.field.long_forms_without_layout_penalties` | Long forms without layout penalties | FIELD-019 | standard | not built |

| `pencil.field.locale_independent_date_entry_and_display` | Locale-independent date entry and display | FIELD-015 | standard | not built |

| `pencil.field.import_date_formats` | Import date formats | FIELD-020 | standard | not built |

| `pencil.field.labeled_opinion_scales` | Labeled opinion scales | FIELD-016 | standard | not built |

| `pencil.field.import_opinion_scales_and_labels` | Import opinion scales and labels | FIELD-021 | standard | not built |

| `pencil.logic.answer_recall` | Answer recall | LOGIC-001 | standard | not built |

| `pencil.logic.known_data_prefill_in_invitations` | Known-data prefill in invitations | LOGIC-002 | standard | not built |

| `pencil.logic.known_data_prefill_from_connected_records` | Known-data prefill from connected records | LOGIC-007 | standard | not built |

| `pencil.logic.variables_and_calculations` | Variables and calculations | LOGIC-003 | standard | not built |

| `pencil.logic.quiz_scores_and_outcomes` | Quiz scores and outcomes | LOGIC-004 | standard | not built |

| `pencil.logic.one_condition_model_and_typed_operands` | One condition model and typed operands | LOGIC-006 | standard | not built |

| `pencil.logic.condition_authoring_preview_and_runtime_custody` | Condition authoring, preview and runtime custody | LOGIC-008 | standard | not built |

| `pencil.logic.import_compound_conditions_faithfully` | Import compound conditions faithfully | LOGIC-009 | standard | not built |

| `pencil.lang.multi_language_forms` | Multi-language forms | LANG-001 | standard | not built |

| `pencil.lang.multi_language_forms_003` | Multi-language forms: The journey also triggers FIELD-013 length and mask errors in each language and check | LANG-003 | standard | not built |

| `pencil.ai.ai_translation` | AI translation | AI-002 | standard or external | not built |

| `pencil.lang.editable_closed_and_system_text` | Editable closed and system text | LANG-002 | standard | not built |

| `pencil.dist.sms_invitations_and_reminders` | SMS invitations and reminders | DIST-011 | standard or external or gated | not built |

| `pencil.dist.embed_modes_and_site_plugins` | Embed modes and site plugins | DIST-013 | standard or external | not built |

| `pencil.dist.compose_an_email_first_question` | Compose an email first question | DIST-014 | standard or external | not built |

| `pencil.dist.confirm_an_emailed_first_answer` | Confirm an emailed first answer | DIST-024 | standard or external | not built |

| `pencil.dist.in_product_surveys` | In-product surveys | DIST-015 | standard or external | not built |

| `pencil.dist.recurring_surveys` | Recurring surveys | DIST-016 | standard or external | not built |

| `pencil.dist.named_collectors` | Named collectors | DIST-017 | standard or external | not built |

| `pencil.dist.form_addresses` | Form addresses | DIST-018 | standard or external or live | not built |

| `pencil.dist.form_link_previews` | Form link previews | DIST-020 | standard or external | not built |

| `pencil.dist.forward_values_from_the_host_page` | Forward values from the host page | DIST-021 | standard or external | not built |

| `pencil.dist.plain_iframe_forwarding` | Plain iframe forwarding | DIST-025 | standard or external | not built |

| `pencil.resp.respondent_confirmation_content` | Respondent confirmation content | RESP-020 | standard or external | not built |

| `pencil.resp.respondent_confirmation_custody` | Respondent confirmation custody | RESP-027 | standard or external | not built |

| `pencil.resp.edit_after_submission` | Edit after submission | RESP-021 | standard | not built |

| `pencil.part.consented_partial_response_capture` | Consented partial-response capture | PART-001 | standard | not built |

| `pencil.part.save_and_resume` | Save and resume | PART-002 | standard | not built |

| `pencil.resp.response_quality_flags` | Response-quality flags | RESP-022 | standard | not built |

| `pencil.resp.identified_public_collection` | Identified public collection | RESP-023 | standard | not built |

| `pencil.resp.revision_bound_public_identity` | Revision-bound public identity | RESP-028 | standard | not built |

| `pencil.ledg.spreadsheet_exports` | Spreadsheet exports | LEDG-005 | standard or sensitive | not built |

| `pencil.ledg.statistics_exports` | Statistics exports | LEDG-007 | standard or sensitive | not built |

| `pencil.ledg.response_search` | Response search | LEDG-006 | standard or sensitive | not built |

| `pencil.ledg.search_custody_through_change` | Search custody through change | LEDG-008 | standard or sensitive | not built |

| `pencil.work.submission_inbox` | Submission inbox | WORK-001 | standard or sensitive | not built |

| `pencil.work.approval_flows` | Approval flows | WORK-002 | standard or external or commitment or sensitive | not built |

| `pencil.work.multi_person_forms` | Multi-person forms | WORK-003 | standard or external or sensitive | not built |

| `pencil.work.workflow_reminders_and_escalation` | Workflow reminders and escalation | WORK-004 | standard or external or sensitive | not built |

| `pencil.work.submission_pdfs_and_generated_documents` | Submission PDFs and generated documents | WORK-005 | standard or sensitive | not built |

| `pencil.rslt.crosstab_dimensions_and_statistics` | Crosstab dimensions and statistics | RSLT-006 | standard or sensitive | not built |

| `pencil.rslt.crosstab_disclosure_boundaries` | Crosstab disclosure boundaries | RSLT-014 | standard or sensitive | not built |

| `pencil.rslt.trends_over_time` | Trends over time | RSLT-007 | standard or sensitive | not built |

| `pencil.rslt.saved_views_and_dashboards` | Saved views and dashboards | RSLT-008 | standard or sensitive | not built |

| `pencil.rslt.shared_report_links` | Shared report links | RSLT-009 | standard or external or sensitive | not built |

| `pencil.rslt.aggregate_only_report_cohorts` | Aggregate-only report cohorts | RSLT-015 | standard or external or sensitive | not built |

| `pencil.rslt.whole_report_complementary_suppression` | Whole-report complementary suppression | RSLT-016 | standard or external or sensitive | not built |

| `pencil.rslt.report_exports` | Report exports | RSLT-010 | standard or sensitive | not built |

| `pencil.rslt.scheduled_report_email` | Scheduled report email | RSLT-011 | standard or sensitive | not built |

| `pencil.rslt.anonymous_traffic_and_conversion` | Anonymous traffic and conversion | RSLT-013 | standard or sensitive | not built |

| `pencil.rslt.submission_time_traffic_exclusions` | Submission-time traffic exclusions | RSLT-017 | standard or sensitive | not built |

| `pencil.act.action_owner_reminders` | Action owner reminders | ACT-009 | standard | not built |

| `pencil.act.linked_task_status` | Linked task status | ACT-010 | standard | not built |

| `pencil.notify.answer_based_alerts` | Answer-based alerts | NOTIFY-005 | standard or external | not built |

| `pencil.notify.conditional_response_email_content` | Conditional response-email content | NOTIFY-006 | standard or external | not built |

| `pencil.notify.response_email_recipient_custody` | Response-email recipient custody | NOTIFY-007 | standard or external | not built |

| `pencil.gov.hipaa_mode` | HIPAA mode | GOV-001 | standard or security | not built |

| `pencil.gov.data_location` | Data location | GOV-002 | standard or security | not built |

| `pencil.gov.sensitive_fields` | Sensitive fields | GOV-004 | standard or sensitive | not built |

| `pencil.gov.audit_log_viewer` | Audit log viewer | GOV-005 | standard | not built |

| `pencil.gov.respondent_privacy_requests` | Respondent privacy requests | GOV-006 | standard or sensitive | not built |

| `pencil.gov.marketing_and_messaging_consent` | Marketing and messaging consent | GOV-007 | standard | not built |

| `pencil.pay.payment_state_and_safe_replacement` | Payment state and safe replacement | PAY-001 | standard or external or money or gated | not built |

| `pencil.pay.stripe_payment_pricing_and_placement` | Stripe payment pricing and placement | PAY-006 | standard or external or money | not built |

| `pencil.pay.checkout_and_respondent_return` | Checkout and respondent return | PAY-007 | standard or external or money | not built |

| `pencil.pay.sales_tax_coupons_and_receipts` | Sales tax, coupons and receipts | PAY-002 | standard or external or money | not built |

| `pencil.pay.subscriptions_and_donations` | Subscriptions and donations | PAY-003 | standard or external or money | not built |

| `pencil.pay.ach_and_other_us_payment_methods` | ACH and other US payment methods | PAY-004 | standard or external or money | not built |

| `pencil.pay.payment_ledger_and_refunds` | Payment ledger and refunds | PAY-005 | standard or external or money | not built |

| `pencil.file.file_upload_questions` | File-upload questions | FILE-001 | standard or sensitive | not built |

| `pencil.file.storage_sync` | Storage sync | FILE-002 | standard or external | not built |

| `pencil.file.upload_scanning` | Upload scanning | FILE-003 | standard or security | not built |

| `pencil.sign.signature_fields` | Signature fields | SIGN-001 | standard or external or commitment | not built |

| `pencil.ai.document_extraction_with_respondent_correction` | Document extraction with respondent correction | AI-003 | standard or external or sensitive | not built |

| `pencil.prog.program_setup` | Program setup | PROG-001 | standard or external or live | not built |

| `pencil.prog.transactional_triggers` | Transactional triggers | PROG-002 | standard or external or live | not built |

| `pencil.prog.score_tracking` | Score tracking | PROG-003 | standard or external | not built |

| `pencil.prog.closed_loop_follow_up` | Closed-loop follow-up | PROG-004 | standard or external | not built |

| `pencil.integ.google_sheets` | Google Sheets | INTEG-001 | standard or external | not built |

| `pencil.integ.microsoft_excel` | Microsoft Excel | INTEG-002 | standard or external | not built |

| `pencil.integ.hubspot_contact_delivery` | HubSpot contact delivery | INTEG-003 | standard or external | not built |

| `pencil.integ.hubspot_property_mapping` | HubSpot property mapping | INTEG-018 | standard or external | not built |

| `pencil.integ.salesforce` | Salesforce | INTEG-004 | standard or external | not built |

| `pencil.integ.orbit` | Orbit | INTEG-005 | standard or external | not built |

| `pencil.integ.slack_and_microsoft_teams` | Slack and Microsoft Teams | INTEG-006 | standard or external | not built |

| `pencil.integ.mailchimp_and_mango_members` | Mailchimp and Mango members | INTEG-007 | standard or external | not built |

| `pencil.integ.email_platform_fields_and_tags` | Email-platform fields and tags | INTEG-019 | standard or external | not built |

| `pencil.integ.notion_airtable_and_cradle` | Notion, Airtable and Cradle | INTEG-008 | standard or external | not built |

| `pencil.integ.zapier_make_n8n_and_crank` | Zapier, Make, n8n and Crank | INTEG-009 | standard or external | not built |

| `pencil.integ.signed_response_webhooks` | Signed response webhooks | INTEG-010 | standard or external | not built |

| `pencil.integ.task_destinations` | Task destinations | INTEG-013 | standard or external | not built |

| `pencil.integ.help_desk_and_commerce_event_sources` | Help-desk and commerce event sources | INTEG-014 | standard or external | not built |

| `pencil.integ.integration_delivery_ledger` | Integration delivery ledger | INTEG-015 | standard or external | not built |

| `pencil.integ.connection_custody` | Connection custody | INTEG-016 | standard or external or security or gated | not built |

| `pencil.integ.server_side_ad_conversion_delivery` | Server-side ad conversion delivery | INTEG-017 | standard or external | not built |

| `pencil.integ.embed_conversion_events_and_diagnostics` | Embed conversion events and diagnostics | INTEG-020 | standard or external | not built |

| `pencil.agent.study_designer` | Study designer | AGENT-001 | standard or external | not built |

| `pencil.agent.themes_and_contradictions` | Themes and contradictions | AGENT-002 | standard or external | not built |

| `pencil.agent.follow_up_that_settles_it` | Follow-up that settles it | AGENT-003 | standard or external | not built |

| `pencil.agent.finding_into_owned_work_and_the_outcome_checked` | Finding into owned work, and the outcome checked | AGENT-004 | standard or external or commitment | not built |

| `pencil.agent.feedback_loop_sentinel` | Feedback-loop sentinel | AGENT-005 | standard or external or security or gated | not built |

| `pencil.agent.adaptive_probe` | Adaptive probe | AGENT-006 | standard or external | not built |

| `pencil.agent.close_the_loop_drafter` | Close-the-loop drafter | AGENT-007 | standard or external | not built |

| `pencil.agent.completion_optimizer` | Completion optimizer | AGENT-008 | standard or external or commitment or live | not built |

| `pencil.agent.migration_agent` | Migration agent | AGENT-009 | standard or external or security or gated | not built |

| `pencil.dist.shared_device_kiosk` | Shared-device kiosk | DIST-023 | standard or external | not built |

| `pencil.dist.search_indexing_choice` | Search indexing choice | DIST-026 | standard or external | not built |

| `pencil.dist.forwarded_campaign_attribution` | Forwarded campaign attribution | DIST-027 | standard or external | not built |

**Resources.** `pencil://forms/{id}`, `pencil://revisions/{id}`, `pencil://responses/{id}`, `pencil://contacts/{id}`, `pencil://analyses/{id}`, `pencil://findings/{id}`, `pencil://actions/{id}`, `pencil://deliveries/{id}` and `pencil://programs/{id}`. **Events.** Form published/closed, response released/updated/erased, analysis completed, finding decided, action changed, delivery changed and program triggered. **Prompts.** Design a study (AGENT-001), explain themes and contradictions (AGENT-002), settle an evidence gap (AGENT-003), close a measured action (AGENT-004), repair feedback delivery (AGENT-005) and plan a migration (AGENT-009).

**Not tools, and why.** HOME-001: a person’s public landing screen; SITE-001: the published product site is an installation fact; SITE-002: a person’s interactive demonstration; DOCS-001: a person’s documentation navigation screen; SHELL-001: a person’s navigation screen; A11Y-001: the browser and device accessibility experience; A11Y-002: the builder’s interactive publish checker; MOB-001: a person’s phone screen; MOB-002: device-only offline capture; MOB-003: device-only native clients; INTEG-011: the integration transport exposes its jobs through the tool registry; INTEG-012: the MCP door is the transport for the listed tools; RESP-001: a person’s interactive respondent screen; RESP-002: a person’s interactive respondent screen; RESP-003: a person’s interactive respondent screen; RESP-025: a person’s interactive respondent screen; RESP-004: a person’s interactive respondent screen; RESP-005: a person’s interactive respondent screen; RESP-007: a person’s interactive respondent screen; RESP-010: a person’s interactive respondent screen; RESP-011: a person’s interactive respondent screen; RESP-012: a person’s interactive respondent screen; RESP-014: a person’s interactive respondent screen; IMPORT-001: the reviewed import door, including its preview and undo actions; IMPORT-002: the reviewed import door, including its preview and undo actions; IMPORT-003: the reviewed import door, including its preview and undo actions; IMPORT-004: the reviewed import door, including its preview and undo actions; RESP-024: a person’s interactive respondent screen; IMPORT-005: the reviewed import door, including its preview and undo actions; IMPORT-006: the reviewed import door, including its preview and undo actions; IMPORT-007: the reviewed import door, including its preview and undo actions; IMPORT-008: the reviewed import door, including its preview and undo actions; IMPORT-009: the reviewed import door, including its preview and undo actions.

**Limits.** Request, body, field and byte capacities are the installation limits documented in seed.json and the operating rules. Business volume limits and provider spend caps come from the company’s policy.

**Handoffs.** Listens for ticket solved, order fulfilled, deal won and task status events from INTEG-014; emits response, finding, action and delivery events for the CRM, help-desk, task and records specialists.

#### SURFACE-001 — Pencil job registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Pencil exposes pencil job registry for its study and feedback operator.

**Acceptance.**
1. The registry covers every Core clause through the table above or its stated personal-screen, device, connector, import-door or installation reason.
2. Each listed tool binds the Pencil action and Core ids stated in that row; the registry and the table agree.
3. The Base conformance harness runs Pencil’s seeded forms, response cohorts, provider receivers and specialist jobs under both company policies.

#### SURFACE-002 — Pencil records and changes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-010

**Requirement.** Pencil exposes pencil records and changes for its study and feedback operator.

**Acceptance.**
1. Every listed form, revision, response, contact, analysis, finding, action, delivery and program resource opens its corresponding Pencil record.
2. Publishing and closing a form, releasing, editing or erasing a response, completing analysis and changing an action or delivery emit the named Pencil event with that record’s resource link.
3. A suppressed cohort does not yield response excerpts through a result tool; raw response access and aggregate-only output keep RSLT-009’s distinct disclosure boundary.

#### SURFACE-003 — Draft, exposure and authority classes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Pencil exposes draft, exposure and authority classes for its study and feedback operator.

**Acceptance.**
1. An internal draft edit computes standard with the form and item count; making that edit visible to outsiders also computes external with the actual audience.
2. Invitation, connector delivery and report sharing compute external with recipient count and the known, new or public counterparty from current Pencil records.
3. An operator or per-form permission change computes access with people and widening or narrowing direction.
4. A connection credential or protective setting change computes security with its setting and provider.
5. Reading a regulated response or extracting a regulated document field computes sensitive with record count and kind; ordinary feedback does not acquire that class from an agent-supplied label.

#### SURFACE-004 — Payment, decisions and running forms

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Pencil exposes payment, decisions and running forms for its study and feedback operator.

**Acceptance.**
1. A payment, subscription, donation or refund computes money from the saved server-priced attempt, amount, currency and provider counterparty.
2. A signature, relied-on approval or effectiveness verdict computes commitment with the exact submission or action, counterparty and stated value.
3. An irreversible response erasure or retention run computes destructive with the records selected after holds and item count.
4. Publishing or closing a running form, collector or program computes live with its saved revision and affected service.
5. Provider-owned consent, verification and hosted payment steps compute gated with provider and exact step; the provider’s person-required answer adds gated before continuation.

#### SURFACE-005 — Study-to-action specialist week

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-013

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

## Push further

### Push further

#### AGENT-001 — Study designer

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist designs a short neutral study from a business question and available context.

**Acceptance.**
1. From a business question ("why are trial users not converting?") and optional context (prior forms, findings, CRM segments), the agent drafts a short study: the decision it informs, hypotheses, questions with neutral wording, a branching plan, the audience and channel, the sample needed for a stated margin of error, and the analysis plan.
2. It flags leading, double-barreled, loaded and unbalanced questions and invalid branches before the operator sees the draft.
3. Editing the draft and plan carries standard; publication and invitations carry external with the recipient and audience facts.
4. The company’s policy decides each call, and the operator can edit the study.
5. Under the held company policy, With the AI receiver fixture, the specialist turns a question into a draft whose graph, validates, whose bias check flags a planted leading question, and which stays a draft until an operator publishes it.

#### AGENT-002 — Themes and contradictions

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist finds evidence-backed themes and contradictions in a fixed evidence set.

**Acceptance.**
1. Over a fixed evidence set (ANLY-002), the agent codes open text into themes with exact excerpts and also finds contradictions: cohorts whose open text disagrees with their scores, themes that reverse between revisions, collectors or segments, and questions whose answers conflict within one response.
2. Each contradiction cites the response IDs on both sides and is suppressed below the disclosure threshold.
3. Findings are labelled as analysis.
4. Accepting or dismissing an agent finding carries standard; the company’s policy decides the call.
5. Through the public door, the specialist seeds promoters whose open text complains about price and asserts one contradiction citing both cohorts with verified excerpts, and no contradiction in a suppressed cohort.

#### AGENT-003 — Follow-up that settles it

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist proposes the smallest follow-up that settles a contradiction or evidence gap.

**Acceptance.**
1. For an accepted contradiction or an insufficient-evidence result, the agent proposes the smallest discriminating follow-up: two to five questions, the cohort to ask (only contacts who consented to follow-up, or a new public collector), and the result that would settle each hypothesis.
2. Drafting the follow-up carries standard; publishing and sending carry external with audience facts.
3. The company’s policy decides each call.
4. The follow-up links to the finding it tests.
5. Under the held company policy, the specialist uses the public door, proposes a follow-up for a seeded contradiction, targets only consenting contacts, and launches nothing until approval.

#### AGENT-004 — Finding into owned work, and the outcome checked

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist carries an accepted finding through an owned task and comparable measurement.

**Acceptance.**
1. After an operator accepts a finding as an action (ACT-001), the agent drafts the task for the owner's tool (INTEG-013), watches its status, proposes a comparable re-measurement (the same questions to a comparable cohort after the change ships), and reports the before/after difference with its margin of error and whether it exceeds noise.
2. Task dispatch and the re-survey carry external; recording a relied-on verdict carries commitment.
3. The company’s policy decides each agent call.
4. After a person sets a verdict, the record attributes that verdict to that person.
5. Under the held company policy, the specialist uses the public door, accepts a finding, sends the confirmed task, reads it closed, proposes and (after approval) launches the re-survey, and reports a difference with its interval while the verdict stays unset.

#### AGENT-005 — Feedback-loop sentinel

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist explains broken feedback loops and proposes a bounded repair.

**Acceptance.**
1. The agent watches integration deliveries, mail and SMS bounces, completion and drop-off, quarantine volume and evidence gaps, and explains in plain language what broke ("12 responses since Tuesday never reached the HubSpot list because the token expired"), which response IDs or tasks are affected, and a bounded repair plan.
2. Replays and outside disclosures carry external; credential reconnection carries security and gated where the provider keeps consent for a person; recipient-authority changes carry access.
3. The company’s policy decides each call.
4. The affected IDs are available through the operator’s form access.
5. Under the held company policy, the specialist uses the public door, breaks a connection and a reminder schedule, and the sentinel reports both with the exact affected IDs and a replay that runs only after approval.

#### AGENT-006 — Adaptive probe

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** An enabled open-text question can offer one disclosed, skippable generated follow-up.

**Acceptance.**
1. On an open-text question an operator marks probe-able, the agent may ask one generated follow-up ("You mentioned setup was slow; which step took longest?") based only on that answer, labeled to the respondent as automatically generated, disclosed in RESP-005, skippable, and stored with the exact generated prompt.
2. Per-question configuration keeps the topics probing must not raise.
3. Generating a respondent-facing probe carries external; the company’s policy decides whether it runs or waits for review.
4. Probe content asks for neither identity nor sensitive data.
5. With the AI receiver fixture, the specialist answers a probe-able question, sees one labeled follow-up, and the ledger stores the generated prompt and answer; a fixture prompt asking for an email is refused before display.

#### AGENT-007 — Close-the-loop drafter

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist drafts a response grounded in an identified respondent’s own words.

**Acceptance.**
1. For each PROG-004 follow-up item, the agent drafts a personal reply to the respondent that addresses their actual words, citing the excerpt, and a suggested next step.
2. The owner can edit it.
3. Sending by email or as a HappyToHelp reply carries external with recipient facts, and the company’s policy decides the agent’s call.
4. Anonymous responses supply no recipient for this drafting job.
5. Under the held company policy, the specialist uses the public door, drafts a reply for an identified detractor citing its excerpt, refuses an anonymous one, and nothing is sent until the owner clicks Send.

#### AGENT-008 — Completion optimizer

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist proposes and measures changes to questions losing respondents.

**Acceptance.**
1. From drop-off (RSLT-002), time per step and quality flags, the agent identifies the steps losing respondents, proposes specific edits, and can run them as a randomized experiment between two revisions with a stated stopping rule, reporting completion rates with intervals.
2. Draft changes carry standard and a respondent-facing experiment carries external; selecting a relied-on winner carries commitment.
3. The company’s policy decides each agent step.
4. Under the held company policy, the specialist uses the public door, seeds drop-off on one step, receives a proposal for that step, runs an approved two-revision experiment with balanced assignment, and reports both completion rates with intervals.

#### AGENT-009 — Migration agent

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008

**Requirement.** The specialist inventories an incumbent account and follows a reviewed move-in plan.

**Acceptance.**
1. Given a connected Typeform, SurveyMonkey, Jotform or Google account, the agent inventories every form, its responses, logic, integrations, webhooks and embeds, proposes a migration plan (which to import, which to archive, what to reconnect), runs the approved imports through IMPORT-001 to IMPORT-008, and tracks the IMPORT-009 checklist to completion.
2. Import batches carry standard, adding destructive when an operation is irreversible; reconnections carry security and gated when the provider requires a person’s consent.
3. The company’s policy decides each call; undo remains available per IMPORT-004.
4. Under the held company policy, the specialist uses the Typeform fixtures inventories three, forms, imports the two approved, leaves the third, and reports the checklist.

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

## Boundaries

- Pencil is MIT licensed and owned by its installation; it does not promise a provider tenant, certification, live delivery or a store receipt without the corresponding register receipt.
- Orbit owns CRM, Mango email marketing, HappyToHelp help desk, Penny public feedback and roadmap, Inkwell multi-party signing, Dial appointment booking, Crank general automation, Cradle relational data, Chest file storage, Nook chat, Vector issues, Buoy customer-success health, Stall storefront, Nectar ongoing billing, Envelope payroll, Pegboard project management and Porthole observability. Pencil keeps its own collection fields and hands off where those jobs begin.
- Ordinary anonymous collection stores no typed partial answers; explicit save/resume and consented partial capture have their stated exceptions.
- A proof against a provider fixture is not a real provider receipt. Claims based on not-run field proof are not proven.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | Pencil is an open-source form builder that asks each person only what fits their last answer, so feedback feels like a conversation. | FLOW-005, RESP-001 |
| 2 | 100% free, open source alternative to Typeform, Google Forms and Jotform | SITE-001 |
| 3 | Free and open source | SITE-001 |
| 4 | No cookies on your forms | RESP-006, RESP-013 |
| 5 | People see one question, a count that includes only the questions on their path, and a way back. | RESP-001, RESP-002, RESP-004 |
| 6 | Add rules to a question and each person follows the path their answer chose. Everyone else takes the default. | FLOW-005 |
| 7 | Preview runs your draft with test answers and shows which rule matched. Publishing checks that every path ends in a thank-you. | FLOW-005, FLOW-006, FLOW-007, FLOW-013 |
| 8 | Every publish is a numbered revision. People already answering finish the version they started. | FLOW-008, FLOW-009, FLOW-017 |
| 9 | Share a link, embed it on your site, or email invitations. One reminder follows two days later, inside your sending hours. | DIST-001, DIST-002, DIST-022, DIST-003, DIST-004, WS-002 |
| 10 | an opt-out in every message | DIST-005 |
| 11 | No cookies, no trackers, no third-party requests. | RESP-006, DIST-009, DIST-022 |
| 12 | Before the first answer, people are told who will see it. | RESP-005 |
| 13 | If someone stops halfway, Pencil keeps how far they got, never what they typed. | RESP-010, RESP-013 |
| 14 | Answers to every question, where people stopped, and starts and completions for each revision, with exports of exactly what you filtered. | RSLT-001, RSLT-002, RSLT-003, RSLT-005, LEDG-004 |
| 15 | Import a Typeform form definition and its responses from CSV, review how every field maps, then keep working in Pencil. | IMPORT-001, IMPORT-002, IMPORT-003, IMPORT-004 |
| 16 | Pencil is MIT licensed. Export everything, any time. | DATA-001 |
| 17 | Your response is anonymous. At your business, operators can see the answers you submit. Identifying details you choose to type, such as an email address, identify you to those operators. Your answers are received and stored by this feedback service. | RESP-005, RESP-006, OPER-001 |
| 18 | Bring a Typeform form definition JSON and an optional response CSV into Pencil as an editable draft. | IMPORT-001, IMPORT-002 |
| 19 | Run a deploy check, deploy on your account, and export every record in one private file. | DATA-001 |

## Status

Judged from the code and tests at commit `712c770c14264668f9380c1b67190cefbaf4820a` (23 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 51 | 75 | 0 | 126 |
| Target and push further | 10 | 79 | 65 | 154 |
| All | 61 | 154 | 65 | 280 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `HOME-001` | Public landing | published | partial | `tests/e2e/accessibility-foundation.spec.ts`, `tests/e2e/business-brand.spec.ts`, `tests/e2e/installed-home.spec.ts` | Missing a cited browser journey that follows the legacy Pencil redirect and enables then reads the optional public credit. Cited journeys show Lobby and selected-form lifecycle with the credit absent by default. |
| `SITE-001` | Product page | published | partial | `tests/e2e/site-page.spec.ts` | Missing a cited reader journey that follows the source link and reads claim content for the contract-only publication boundary. Cited journey reads headings, Run/Docs links and privacy, but never source link or claim content. |
| `SITE-002` | Live answer path | published | done | `tests/e2e/site-hero.spec.ts` — "the note card retains its complete question and answer follow-ups without JavaScript, by pointer and keyboard, and with reduced motion" |  |
| `DOCS-001` | Product documentation | published | partial | `tests/e2e/docs-site.spec.ts` | Missing a cited docs journey that reads analysis-guide withholding, crosstab threshold and unchanged summary/ledger/export statements. Cited journey visits overview/build/branch/results guides and checks shell/navigation/404, not analysis-guide content. |
| `SHELL-001` | Operator navigation | published | done | `tests/e2e/accessibility-foundation.spec.ts` — "keyboard and axe cover the landing, sign-in, operator navigation, builder and reports at declared viewports"; `tests/e2e/rendering-migration.spec.ts` — "native document/API/generated transport session matrix preserves private data boundaries"; `tests/runtime/private-auth-freshness.worker.test.ts` — "a warmed private route denies native session revocation" |  |
| `OPER-001` | Equal operators | published | done | `tests/runtime/access-foundation.worker.test.ts` — "a second equal operator edits another operators flow while foreign workspace IDs never become ownership authority" |  |
| `OPER-002` | Manage equal operators | published | partial | `tests/runtime/auth.worker.test.ts`, `tests/runtime/first-owner.worker.test.ts` | Missing a cited settings or HTTP journey that refuses another operator removing the setup operator with credentials unchanged, then permits setup self-removal. Cited public journeys show invitation and peer-removal races; setup/last guards run directly on the repository. |
| `OPER-003` | Sign-in depends on mail | published | done | `tests/runtime/optional-configuration.worker.test.ts` — "native startup still names every missing required variable while absent deferred adapters do not block health"; `tests/runtime/base-auth.worker.test.ts` — "Base bootstraps once, signs in only existing operators and confirms with a read-only GET before a single-use POST"; `tests/managed-mail.test.ts` — "Managed mail uses its assigned sender for sign-in, response notifications and digests, queues rate limits and shows rejected mail to its owner" |  |
| `WS-001` | Workspace time zone | published | partial | `tests/e2e/publication-zone.spec.ts`, `tests/runtime/access-foundation.worker.test.ts`, `tests/runtime/analysis-safety.worker.test.ts` | Missing a cited public journey that changes workspace zone after publication and reads unchanged open-revision deadline/zone. Cited journeys show settings, publication conversion and historical usage. The deadline-retention service journey is in uncited foundation.worker.test.ts. |
| `WS-002` | Sending hours | published | partial | `tests/runtime/access-foundation.worker.test.ts`, `tests/runtime/distribution.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts` | Missing a cited public scheduling journey that holds reminders/digests outside the window, releases at opening, and sends operator-triggered mail and magic links immediately outside it. Cited files show settings through HTTP and scheduling through direct services/maintenance; the immediate exception is never exercised under an out-of-window clock. |
| `WS-003` | Optional analysis and task connections | published | partial | `tests/e2e/review-corrections.spec.ts`, `tests/runtime/optional-configuration.worker.test.ts` | Missing a cited browser journey with absent AI/task adapters that reads unavailable feature states and page-local connection setup while independent collection/results work. Startup proves optional absence permits health; cited browser does not configure absent-adapter cases. |
| `BRAND-001` | Saved business identity | published | partial | `tests/e2e/business-brand.spec.ts`, `tests/runtime/brand.worker.test.ts` | Missing a cited fresh-workspace browser journey that reads neutral branding, completes the requested business name and then reads saved identity. The cited journeys cover existing-workspace branding across screens and public states, invalid uploads and complete removal; the neutral default is read only through a configuration helper. |
| `BRAND-003` | Branded response email | published | partial | `tests/e2e/business-brand.spec.ts`, `tests/runtime/brand.worker.test.ts` | Missing a cited mail journey dispatching and opening the saved name, line, accent and inline logo, then removing the logo and reading the next dispatch. Existing cited journeys show screen/logo behavior but never open new-response email. |
| `DASH-001` | First flow | published | partial | `tests/runtime/first-owner.worker.test.ts` | Missing a cited dashboard browser journey that reads empty Ask → Signal → Act and chooses Customer feedback/NPS/Contact-lead or blank drafts. First-owner journey checks zero flows and creates templates through API, never the empty dashboard or its choices. |
| `DASH-002` | Flow list | published | partial | `tests/runtime/feedback-attention.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/journey.worker.test.ts` | Missing a cited dashboard journey that reads last-activity ordering and invited-audience completion denominators, including zero eligible participants, across state filters. Cited HTTP journeys show counts/analysis; archive filter is service-level. |
| `FLOW-001` | Flow lifecycle | published | partial | `tests/runtime/foundation.worker.test.ts` | Missing a cited public lifecycle journey that completes allowed close/reopen/archive, refuses archived reopen and reads unchanged history. The cited test calls services directly; foundation-fixture methods are not HTTP proxies. |
| `FLOW-002` | Ordered form steps | published | partial | `tests/e2e/journey.spec.ts` | Missing a cited builder journey that duplicates, reorders and deletes steps and reads the resulting order while preserving welcome/completion constraints. Cited journey adds/edits, but never performs those three operations. |
| `FLOW-003` | Question types | published | partial | `tests/e2e/new-question-types.spec.ts`, `tests/runtime/new-question-types.worker.test.ts` | Missing a cited builder/respondent journey covering original short/long text, email, single/multiple choice, rating and priority alongside the six added types. Cited browser covers dropdown/yes-no/NPS/number/date/consent; wider type work in runtime file is largely direct services. |
| `FLOW-004` | Saved edits | published | partial | `tests/e2e/review-corrections.spec.ts` | Missing a cited save journey that commits content/choices/paths, reloads after Saved, and attempts a stale competing edit without overwriting. Cited journey shows invalid-label refusal and editing controls, without stale-write or accepted-save reload readback. |
| `FLOW-005` | Answer branching | published | partial | `tests/e2e/journey.spec.ts`, `tests/e2e/publication-zone.spec.ts`, `tests/e2e/review-corrections.spec.ts` | Missing a cited branching journey that exercises boolean, numeric/date comparisons, priority ranking and multiple-choice any/all predicates through builder, preview and collection. Cited browser set demonstrates single-choice branching only. |
| `FLOW-006` | Publication validation | published | partial | `tests/runtime/calculations.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/graph-reachability.worker.test.ts` | Missing a cited HTTP publication journey refusing invalid graph references, unreachable/cyclic screens and invalid questions, reading stable IDs/reasons, then editing/publishing same draft. Cited HTTP journey proves payment/calculation refusal; general graph paths use services. |
| `FLOW-007` | Preview isolation | published | done | `tests/runtime/journey.worker.test.ts` — "previews the current draft and incomplete branches with test answers while preserving every product record and effect" |  |
| `FLOW-008` | Published revisions | published | partial | `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts` | Missing a cited public revision journey that reads launched-invitation and analysis revisions and verifies load creates no session before interaction. Cited native journey proves anonymous revisions/exported answers; invitation pinning is service-level and load-only/analysis revision are not read. |
| `FLOW-009` | Edits to live forms | published | done | `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers" |  |
| `FLOW-010` | Close a form | published | partial | `tests/e2e/publication-zone.spec.ts` | Missing a cited closure journey that reaches deadline/target and manually closes a flow, then reads admission across revisions. Cited browser sets/publishes values and stops before either closure condition or manual close. |
| `FLOW-011` | Duplicate a form | published | partial | `tests/runtime/foundation.worker.test.ts` | Missing a cited public duplication journey that duplicates populated data and opens the independent draft and empty audience/response/analysis/action/delivery views. Cited lifecycle test duplicates/reads directly through services. |
| `FLOW-012` | Valid branch references | published | partial | `src/core/features/flows/graph.contract.test.ts` | Missing a cited publication-door journey accepting valid references and refusing missing/incompatible branch references without revision writes. Only cited file directly calls the graph validator. |
| `FLOW-013` | Reachable completion | published | partial | `tests/runtime/graph-reachability.worker.test.ts` | Missing a cited publication-door journey refusing unreachable/cyclic graphs without writes, then publishing/completing reachable paths. Cited fixture calls services; cycle outcome is not exercised in this file. |
| `FLOW-014` | Valid questions | published | partial | `tests/e2e/review-corrections.spec.ts` | Missing a cited builder/publication journey refusing empty/over-limit prompts, invalid type options and a form with no question, then publishing a valid question. Cited browser proves duplicate-label refusal, not these missing conditions. |
| `FLOW-015` | Stable question and choice identities | published | partial | `tests/contract/data-release.contract.test.ts`, `tests/runtime/foundation.worker.test.ts` | Missing a cited authoring journey reading stable IDs through saved label rename/reorder/publication, then public duplication with new IDs and editable Advanced values. Cited archive command preserves recovery IDs; lifecycle services prove duplication without authoring door. |
| `FLOW-016` | Published policy snapshot | published | partial | `tests/runtime/graph-reachability.worker.test.ts`, `tests/runtime/policy-snapshot.worker.test.ts` | Missing a cited public publish/session journey that changes policy and reads old identity/admission/branch settings on existing invitations/sessions while later publication adopts new policy. Both cited files test policy changes through direct services. |
| `FLOW-017` | Revision admission | published | partial | `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts` | Missing a cited public admission journey that refuses a fresh anonymous start on a superseded revision, resumes a returning first-interaction session and opens an old invitation until closure. Native journey shows old submission/new current session; invitation/resume admission is service-level. |
| `FLOW-018` | Revision completion counts | published | partial | `tests/runtime/journey.worker.test.ts` | Missing a cited two-revision count journey reaching deadline/target on one while the other stays open, then manually closing/archiving both and reading refusals. Cited native target-race journey has only one revision. |
| `FLOW-019` | Typed answer values | published | partial | `tests/e2e/ledger-filters.spec.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts` | Missing a cited answer-submission journey for configured Other/None objects and their exclusive selection/text refusal rules with accepted-value readback. Cited typed-filter fixture has ordinary typed answers only; Other/None objects and normalized contact/score cases never occur. |
| `FLOW-020` | Required questions follow the chosen path | published | done | `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers" |  |
| `FLOW-021` | Retain answers after question changes | published | partial | `tests/runtime/journey.worker.test.ts` | Missing a cited question-deletion journey collecting answers/analysis, deleting draft step, republishing and opening retained ledger/results/export/analysis. Cited comparison journey adds a question and renames labels, but never deletes a draft question. |
| `LOGIC-005` | Conditional completion and redirects | published | done | `tests/runtime/completion-redirects.worker.test.ts` — "chooses screen or approved redirect from accepted answer, hidden, calculation and score conditions; replay and copies preserve revision custody"; `tests/runtime/completion-redirects.worker.test.ts` — "refuses unapproved, insecure, credential-bearing and invalid operand redirects at publish without changing the live revision"; `tests/e2e/completion-redirects.spec.ts` — "authors an approved redirect, previews without leaving and collects both conditional completion targets" |  |
| `A11Y-001` | Accessible respondent states and layouts | published | done | `tests/e2e/respondent-accessibility.spec.ts` — "completes every shipped type across standalone, classic and grouped screens with keyboard, associated errors, focus, contrast and 320px reflow" |  |
| `FIELD-006` | Randomized choice and question order | published | done | `tests/runtime/randomized-order.worker.test.ts` — "200 respondents retain valid varied choice and block orders through sessions, resume, immutable revisions, copies and ledger exports"; `tests/e2e/randomized-order.spec.ts` — "a workshop organiser randomizes a question group and choices, previews it and retains the respondent’s displayed order in results and exports" |  |
| `AUD-001` | Contacts | published | done | `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey"; `tests/runtime/audience.worker.test.ts` — "audience CSV public preview and commit report case matches, repeats, invalid rows and explicit updates without retaining raw CSV" |  |
| `AUD-002` | Segments and frozen launches | published | done | `tests/runtime/audience.worker.test.ts` — "saved segments launch a frozen evaluated audience and concurrent command replay creates no extra participants, jobs or attempts"; `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey" |  |
| `AUD-003` | Invitation participants | published | partial | `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts` | Missing a cited public delivery journey that records a second attempt and reads append-only attempt history plus independent bounced/failed/consent states. Browser journey reads sent/pending/completed participants; attempt and consent transitions in distribution.worker.test.ts run through services. |
| `AUD-004` | Invitation eligibility | published | partial | `tests/runtime/audience.worker.test.ts` | Missing a cited public eligibility journey that tries a new launch command for already-invited and missing-email contacts, reads exclusions and unchanged participants, then completes eligible launch. Cited public journey excludes opted-out contacts and replays same command; broader policy exclusions are direct services. |
| `AUD-005` | Replay a launch | published | done | `tests/runtime/audience.worker.test.ts` — "saved segments launch a frozen evaluated audience and concurrent command replay creates no extra participants, jobs or attempts" |  |
| `AUD-006` | Eligibility at send time | published | partial | `tests/runtime/audience.worker.test.ts`, `tests/runtime/distribution.worker.test.ts` | Missing a cited public/scheduled delivery journey that attempts invitations and reminders after contact opt-out/deletion, observes no send/no new attempt and then observes allowed snapshot-address send. Cited file mutates contacts through HTTP but invokes each send-time guard directly on delivery services. |
| `DIST-001` | Public form link | published | done | `tests/e2e/public-flow.spec.ts` — "direct and embedded respondents complete the same accessible flow without an operator session" |  |
| `DIST-002` | Inline embed | published | partial | `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “the accessible embedded route completes the same flow inside a real iframe”, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” (1440/390) | Opaque script/iframe collection and exact host/frame admission have local browser proof. Checkout carries only its Stripe HTTPS URL and Checkout Session ID plus the transport challenge, targets the configured allowed origin, and is consumed once in child and host. The four permitted events include loaded acknowledgements; other message shapes are refused. An allowed script frame without acknowledgement offers an explicit user-activated same-tab continuation. Gap: a disallowed embedding host is refused with 403 before any payment can start, so its checkout same-tab fallback is not implemented; child rejection of an application receipt with extra payer fields is not asserted through a public door. Payment in a plain iframe remains PAY-001's named gap. |
| `DIST-003` | Invitations | published | partial | `tests/runtime/distribution.worker.test.ts` | Missing a cited operator launch/mail transport journey that sends eligible invitation, opens business/form/opaque-link content and observes durable attempt before provider call. Only cited file prepares and records delivery through services. |
| `DIST-004` | Reminders | published | partial | `tests/runtime/distribution.worker.test.ts` | Missing a cited public scheduled reminder journey that delivers to eligible sent/noncompleted recipient and refuses unsafe completed/opted-out/bounced/closed/archived sends without changes. Cited Evidence file exercises reminder eligibility and cancellation only through direct services. |
| `DIST-005` | Opt-out and renewed consent | published | partial | `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts` | Missing a cited public consent-renewal journey that records actor/time/source and then reads resumed mail without deleting existing response. Browser journey saves opt-out; renewal/readback and no-later-send checks in distribution.worker.test.ts use services. |
| `DIST-006` | Mail retry | published | partial | `tests/runtime/distribution.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts`, `tests/runtime/notifications.worker.test.ts` | Missing a cited public scheduled delivery journey driving transient failure through five retries over one hour and reading original-key attempt history plus terminal refusal. All cited retry loops invoke delivery/dispatcher services directly, not the native scheduled Worker transport. |
| `DIST-007` | Mail failure isolation | published | partial | `tests/runtime/base-auth.worker.test.ts` | Missing a cited sender-failure journey that reads operator-visible named failure for invitations/reminders/notifications and successfully collects via direct/embed, opens results/ledger/exports with existing session. Cited journey fails sign-in send and checks dashboard/health only. |
| `DIST-008` | Failed invitation recovery | published | partial | `tests/e2e/mail-recovery.spec.ts`, `tests/runtime/distribution.worker.test.ts` | Missing a cited public permanent/exhausted delivery journey that reads failed status with provider reason and retry action, with queued never shown sent. Browser journey covers unknown outcome; permanent/exhausted failed states in distribution.worker.test.ts are service-only. |
| `DIST-009` | Embed isolation | published | partial | `tests/e2e/embed-security-foundation.spec.ts`, `tests/e2e/rendering-migration.spec.ts`, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts` (1440/390) | Opaque child isolation, exact origin/source/challenge admission, strict four-event messages, Stripe HTTPS URL/Checkout Session ID projection, exact outbound target and handoff replay refusal have local assertions through the script/payment journeys. Non-HTTPS and non-Stripe provider URLs produce no checkout message or navigation. Missing acknowledgement on an allowed script frame exposes a user-activated same-tab continuation. Gap: disallowed-host checkout fallback cannot occur after the existing pre-render 403; extra payer fields on an application payment receipt have no public-door child rejection proof. Plain iframe payments remain outside this handoff proof. |
| `DIST-022` | Embedded payment handoff | published | partial | `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “the accessible embedded route completes the same flow inside a real iframe”, `tests/e2e/script-embed.spec.ts`, `tests/e2e/calculations.spec.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” (1440/390) | Opaque script/iframe collection and exact host/frame admission have local browser proof. Checkout carries only its Stripe HTTPS URL and Checkout Session ID plus the transport challenge, targets the configured allowed origin, and is consumed once in child and host. The four permitted events include loaded acknowledgements; other message shapes are refused. An allowed script frame without acknowledgement offers an explicit user-activated same-tab continuation. Gap: a disallowed embedding host is refused with 403 before any payment can start, so its checkout same-tab fallback is not implemented; child rejection of an application receipt with extra payer fields is not asserted through a public door. Payment in a plain iframe remains PAY-001's named gap. |
| `DIST-010` | Uncertain mail recovery | published | done | `tests/e2e/mail-recovery.spec.ts` — "a real sender failure is visible and an explicit duplicate-risk retry retains its durable key and history" |  |
| `DIST-012` | Collector QR codes | published | done | `tests/e2e/kiosk.spec.ts` — "download labelled QR codes and collect isolated shared-device responses with idle clearing"; `tests/runtime/qr.worker.test.ts` — "QR downloads require operator authority, retain the exact collection link and reject unrelated collectors and formats" |  |
| `DIST-019` | Restricted collection | published | done | `tests/e2e/restricted-access.spec.ts` — "build password, verified-email and app-signed forms, with server-first gating and one completion per verified email"; `tests/runtime/restricted-access.worker.test.ts` — "restricted collection gates graph and session doors, verifies identity, serializes email uniqueness and binds app signatures to their revision"; `scripts/deployment-data-custody-replay.check.mjs` — "[DATA-001,BASE-DATA-001,IMPORT-004,BASE-OPS-003,LEDG-006,PAY-001] whole-data delivery recovery retains exact product custody and never replays restored capabilities" |  |
| `RESP-001` | Respondent layouts | published | partial | `tests/e2e/public-flow.spec.ts` — “direct and embedded respondents complete the same accessible flow without an operator session” — “a sessionless direct flow presents one accessible screen at a time and reaches immutable completion” | Missing a cited journey through classic pages and grouped questions that checks each layout, shared conditions, validation and progress. Cited public-flow journey covers one-question screens only. |
| `RESP-002` | Truthful progress | published | partial | `tests/e2e/question-progress.spec.ts` | Missing a cited classic-page journey that checks current and remaining reachable pages. The cited progress journey covers question counts only. |
| `RESP-003` | Explicit and validated answers | published | partial | `tests/e2e/new-question-types.spec.ts`, `tests/e2e/question-accessibility-foundation.spec.ts`, `tests/e2e/question-progress.spec.ts` | Missing a journey in the old cited evidence that exercises Other-text validation in browser and API and exclusive None choices. Cited one-question journeys prove ordinary types, explicit selection and required refusals; the covering Other journey is outside this old Evidence set. |
| `RESP-025` | Reachable validation and answer progress | published | partial | `tests/e2e/new-question-types.spec.ts`, `tests/e2e/question-accessibility-foundation.spec.ts`, `tests/e2e/question-progress.spec.ts` | Missing a cited journey for grouped-question progress and classic-page hidden-required validation and page progress. The cited progress journey covers one-question progress only. |
| `RESP-004` | Back navigation | published | done | `tests/e2e/journey.spec.ts` — "an operator builds and previews an adaptive form, a respondent changes branches, and the report retains only final reachable answers"; `tests/runtime/journey.worker.test.ts` — "builds, previews, publishes and reports a branching form without preview effects; pins live revisions and exact answers" |  |
| `RESP-005` | Privacy disclosure | published | partial | `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/analysis-safety.worker.test.ts` | Missing a cited disclosure journey that reads the stated purpose, viewers and each configured external/data category before answering. The cited journey checks invitation identification; the analysis-safety journey checks provider payload minimization rather than the respondent disclosure. |
| `RESP-006` | Anonymous means anonymous | published | partial | `tests/runtime/distribution.worker.test.ts`, `tests/runtime/foundation.worker.test.ts` | Missing an anonymous-collection journey through the public HTTP or browser door that reads the retained anonymous identity and the disclosure for a typed identifying answer. Both cited Worker files use foundationFixture service calls for this behavior; their data assertions remain useful lower-level evidence. |
| `RESP-007` | Atomic final submission | published | partial | `tests/e2e/journey.spec.ts`, `tests/runtime/distribution.worker.test.ts` | Missing a cited final-submit rollback journey that fails the transaction and proves no response, answer, count or effect remains. The cited browser journey covers normal commit and retry; the covering failure journey is in tests/runtime/journey.worker.test.ts, which this old Evidence cell does not cite. |
| `RESP-008` | Admission per invitation | published | partial | `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/runtime/distribution.worker.test.ts` | Missing a cited public-door journey that attempts an over-quota or closed invitation completion and confirms no additional response. The cited distribution Worker journey covers concurrency through services; the browser journey checks invitation receipt and reload. |
| `RESP-009` | Concurrent closure | published | done | `tests/runtime/journey.worker.test.ts` — "rechecks manual closure and deadline inside final admission; losers receive a named closed outcome with no saved response"; `tests/runtime/journey.worker.test.ts` — "admits only one released completion at a target of one, while retaining its replay after automatic closure" |  |
| `RESP-010` | No silent partials | published | partial | `tests/runtime/foundation.worker.test.ts`, `tests/runtime/journey.worker.test.ts` | Missing a cited explicit-save journey that checks saved partial answers stay unavailable to operators, completed results, analysis and default exports. The cited files prove ordinary abandoned-session isolation, not the PART-002 saved exception. |
| `RESP-011` | Completion | published | done | `tests/e2e/public-flow.spec.ts` — "direct and embedded respondents complete the same accessible flow without an operator session" |  |
| `RESP-012` | Submission retry | published | done | `tests/runtime/journey.worker.test.ts` — "retains the committed completion across changed-answer retries, pinned revisions and removal of the session" |  |
| `RESP-013` | Session metrics | published | partial | `tests/runtime/distribution.worker.test.ts`, `tests/runtime/journey.worker.test.ts`, `tests/runtime/transition.worker.test.ts` | Missing a cited journey that reads FIELD-006 stable choice/block presentation identities and the complete session-only field boundary through the public door. Cited HTTP journeys prove pinning, expiry and metrics; the session-privacy assertions use services and the presentation-order outcome is not exercised. |
| `RESP-014` | Submit failure | published | done | `tests/e2e/journey.spec.ts` — "an operator builds and previews an adaptive form, a respondent changes branches, and the report retains only final reachable answers"; `tests/runtime/journey.worker.test.ts` — "rolls a failed final transaction back completely and commits one original-key retry without partial answers or effects" |  |
| `RESP-015` | Owned abuse defenses | published | partial | `tests/e2e/public-rate.spec.ts` — “public request and final submission limits refuse excess traffic without retaining invalid answers and recover after expiry”, `tests/runtime/journey.worker.test.ts`, `tests/runtime/transition.worker.test.ts` | Missing a cited journey exercising signed load timing and honeypot admission, retention and reversal through the public door. The cited journey and transition files cover session credential failures and minimum-time quarantine, not the honeypot/load-time matrix; tests/runtime/traffic.worker.test.ts has that journey but is absent from this old Evidence cell. |
| `RESP-016` | Retained bot exclusions | published | done | `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"; `tests/e2e/traffic-review.spec.ts` — "an operator reviews and releases a retained bot exclusion without changing views or starts" |  |
| `RESP-026` | Exporting automated exclusions | published | done | `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review"; `tests/e2e/traffic-review.spec.ts` — "an operator reviews and releases a retained bot exclusion without changing views or starts" |  |
| `RESP-017` | Retained minimum-time exclusions | published | partial | `tests/runtime/journey.worker.test.ts` | Missing a cited journey that reads the minimum-fill-time reason and all retained answers before release and checks the full exclusion boundary, including unchanged view/start counters. The cited journey covers held completion, export omission, release and deletion; the fuller traffic journey is not in the old Evidence cell. |
| `RESP-018` | Quarantine review | published | partial | `tests/runtime/journey.worker.test.ts` | Missing a cited quarantine-list journey that reads each held answer and defense and observes every affected rate/results value after release while admission remains closed. The cited journey does not read the quarantine list; it proves release/delete persistence and counts. |
| `RESP-019` | Retained flow metrics | published | done | `tests/runtime/journey.worker.test.ts` — "scheduled retention folds abandoned sessions once, preserves active auth and every current persistent entity, and logs counts only" |  |
| `LEDG-001` | Response ledger | published | partial | `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts` | Missing a cited ledger journey that reads the complete retained response record, including stable response ID and started/submitted times, and checks quarantine exclusion with real held data. Cited browser journeys inspect answers, participant and cohort counts, but do not read the complete listed record. |
| `LEDG-002` | Collection counts | published | done | `tests/runtime/journey.worker.test.ts` — "quarantines fast submissions, excludes them from reporting, releases exactly once after closure, and erases rejected answers" |  |
| `LEDG-003` | Response filters | published | done | `tests/e2e/ledger-filters.spec.ts` — "native and imported typed filters download exact JSON, CSV, LEDG-005 XLSX and SPSS response snapshots with readable decisions and compact rows at both widths"; `tests/e2e/distribution-foundation.spec.ts` — "invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey" |  |
| `LEDG-004` | Response export | published | partial | `tests/e2e/journey.spec.ts`, `tests/e2e/ledger-filters.spec.ts`, `tests/e2e/new-question-types.spec.ts` | Missing a cited journey for the explicit automated-exclusion inclusion option, marked reasons and unchanged accepted counts/effects. The cited browser journeys prove ordinary exports; tests/e2e/traffic-review.spec.ts covers the option but this old Evidence cell does not cite it. |
| `RSLT-001` | Response summary | published | partial | `tests/runtime/journey.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/reporting-bounded.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts`, `tests/e2e/reporting-counts.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts` (line 10) | The published-revision selector and response filters share one response scope across summary, answer summaries, device split, ledger and exports. Native starts, rate numerator/denominator, duration total/sample count, completed and imported counts are stated beside the values. All-revision answers retain their published question versions. Zero, quarantine/release, erasure and imported exclusions remain factual; no AI run is required. Gap: all-published-revision average completion time with unequal per-revision durations has no independently computed public-door assertion. |
| `RSLT-002` | Drop-off by question | published | partial | `tests/e2e/answer-results.spec.ts`, `tests/e2e/imported-results.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts` | Missing a cited journey that expires a real abandoned session and reads the retained per-step reached/drop-off report afterward, including zero-reached steps. Cited browser reports show ordinary native answers and historical zero telemetry; tests/runtime/transition.worker.test.ts exercises expiry but is absent from this old Evidence cell. |
| `RSLT-003` | Stated denominators | published | partial | `tests/runtime/journey.worker.test.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/reporting-bounded.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey”, `tests/e2e/imported-results.spec.ts`, `tests/e2e/reporting-counts.spec.ts`, `tests/e2e/text-answer-plurals.spec.ts` (line 10) | Response filters use matching native released and quarantined response starts for started-to-completed; the screen states that view-based rates are unfiltered by response filters. Revision/date-only selections use the matching view counters. Numerator and denominator, duration total and samples, imported exclusions and per-question answered denominators are named; clearing a response filter restores the view basis. Gap: CSAT and thumbs-up score-trend percentages have no public-door assertion of their displayed numerator and denominator labels. The answer-share trend, zero-denominator states, unequal started-to-completed rate, date-only scope, multiple-select label and single-answer bucket sums are asserted by the existing results journeys. |
| `RSLT-004` | Device split | published | partial | `tests/runtime/journey.worker.test.ts` — "retains factual zero, quarantine, release and erasure summaries and matching dashboard counts"; `tests/runtime/distribution.worker.test.ts`; `tests/runtime/retention-schedule.worker.test.ts`; `tests/runtime/upgrades.worker.test.ts` — "retains the representative legacy rows, graph relationships, and idempotency behavior declared by the predecessor fixture"; `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64"; `tests/e2e/answer-results.spec.ts`; `tests/e2e/ledger-filters.spec.ts` (1440/390) | Coarse session-start class is copied only on admitted commit, preserved under unpaid replacement, filterable through the shared response selection and erased with the response. Historical classes are unknown. Filtered device shares name native-response denominators; imported completions and unlinked open/abandoned sessions are separate. Unfiltered shares name session starts. No class enters CSV/JSON response records; DATA-001 portable archives carry the response column for restoration.  Gap: the current archive importer requires the same committed migration inventory; restoration of an older pre-device archive has not been proved with its original trusted controller. RSLT-001/RSLT-003 summary integration remains their own target. |
| `RSLT-005` | Results across revisions | published | done | `tests/e2e/revision-comparison-http.spec.ts` — "native revision comparison keeps absent questions, containing-revision cohorts and historical labels distinct" |  |
| `RSLT-012` | Open-text coding | published | partial | `src/core/features/coding/`, `tests/runtime/coding.worker.test.ts`, `tests/e2e/coding.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Missing the aggregate-only code-crosstab disclosure/refusal journey and the company-policy journey for standard/sensitive agent coding decisions. Cited old journeys prove the raw-authorized operator’s manual and accepted/rejected AI suggestion workflows, chart/filter/export and unsafe refusals. |
| `ANLY-001` | Analysis run | published | partial | `tests/e2e/analysis.spec.ts`, `tests/runtime/analysis-run.worker.test.ts` | Missing a cited close-time autorun journey and a running-state observation for the full queued/running lifecycle. Cited analysis-run and browser journeys cover requested completed/insufficient/failed runs; feedback-attention has queued/running observations but is absent from this old Evidence cell. |
| `ANLY-002` | Fixed evidence set | published | done | `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing"; `tests/runtime/analysis-safety.worker.test.ts` — "only the selected answers and stable response IDs leave, to the configured origin with the key as a bearer value, and every call records its usage and cost" |  |
| `ANLY-003` | Findings | published | done | `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run" |  |
| `ANLY-004` | Exact evidence | published | done | `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run" |  |
| `ANLY-005` | Disclosure threshold | published | done | `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run" |  |
| `ANLY-006` | Recommendations | published | done | `tests/runtime/analysis-output.worker.test.ts` — "a sufficient run proposes one primary action, and turning it into an action records the analysis without contacting anyone"; `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold" |  |
| `ANLY-007` | Staleness | published | done | `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing" |  |
| `ANLY-008` | Provider failure | published | done | `tests/runtime/analysis-safety.worker.test.ts` — "an unconfigured or failing provider fails the request with its error and a retry action while collection keeps working; a transient transport failure is retried at most three times within ten minutes with the same request and a schema failure is never retried"; `tests/runtime/feedback-rewrites.worker.test.ts` — "rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run" |  |
| `ANLY-009` | Builder assistance | published | partial | `tests/runtime/feedback-rewrites.worker.test.ts` | Missing the class-and-company-policy journey for agent wording application and external publication. Old cited evidence proves the held human workflow only; it does not compute the standard/external classes or run the all-autonomous company policy. |
| `ANLY-010` | AI usage and cost | published | done | `tests/runtime/analysis-safety.worker.test.ts` — "only the selected answers and stable response IDs leave, to the configured origin with the key as a bearer value, and every call records its usage and cost"; `tests/runtime/feedback-rewrites.worker.test.ts` — "rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution" |  |
| `ANLY-011` | Evidence provenance | published | done | `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold"; `tests/e2e/analysis.spec.ts` — "an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run" |  |
| `ANLY-012` | Output validation | published | done | `tests/runtime/analysis-output.worker.test.ts` — "findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold" |  |
| `ANLY-013` | Insufficient evidence | published | done | `tests/runtime/analysis-run.worker.test.ts` — "a requested run fixes the released responses it read and its policies and completes without a cron tick, later evidence or policy only marks or changes new runs, and too little evidence completes as insufficient-evidence with its reason and sends nothing" |  |
| `ANLY-014` | Untrusted evidence | published | done | `tests/runtime/analysis-safety.worker.test.ts` — "instructions planted in answers change nothing: a tool call or webhook-shaped answer fails, and no task, job, policy or setting changes" |  |
| `ANLY-015` | Analysis and report policy snapshots | published | partial | `tests/runtime/analysis-run.worker.test.ts` | Missing the saved/shared aggregate-view snapshot journey retained by RSLT-009. Cited analysis-run journey proves analysis snapshots only; it does not create a saved/shared aggregate view or lower policy and read that view. |
| `ANLY-016` | Provider retry | published | done | `tests/runtime/analysis-safety.worker.test.ts` — "an unconfigured or failing provider fails the request with its error and a retry action while collection keeps working; a transient transport failure is retried at most three times within ten minutes with the same request and a schema failure is never retried" |  |
| `ACT-001` | Action record | published | partial | `tests/e2e/actions.spec.ts` | Missing a journey in the cited evidence that accepts an analysis recommendation and reads the resulting analysis/evidence links and action fields. The cited actions browser journey creates a manual action; tests/e2e/analysis.spec.ts covers recommendation acceptance but is absent from this old Evidence cell. |
| `ACT-002` | Action lifecycle | published | done | `tests/runtime/actions-lifecycle.worker.test.ts` — "the server enforces the lifecycle: every legal move is recorded, every illegal move answers 409 and changes nothing"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due" |  |
| `ACT-003` | External task | published | done | `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due" |  |
| `ACT-004` | Task failure | published | done | `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/runtime/actions-task.worker.test.ts` — "with no adapter configured the external task is unavailable and the action works; redirects are not followed and a plain http URL is refused outside the dev and test runtimes" |  |
| `ACT-005` | Follow-up measurement | published | partial | `tests/e2e/actions.spec.ts`, `tests/runtime/actions-measurement.worker.test.ts` | Missing a cited class-and-company-policy journey for an agent’s commitment-class verdict decision. Existing cited journeys prove the separate human decision and no verdict from measurement or overdue date, not policy-driven agent decisions. |
| `ACT-006` | Exact task payload | published | partial | `tests/e2e/actions.spec.ts`, `tests/runtime/actions-task.worker.test.ts` | Missing a cited external-class agent-send journey under company policy, including the autonomous policy without a person confirmation and truthful handling of person-confirmation flags. Existing cited journeys prove the human-confirmed task payload only. |
| `ACT-007` | Task delivery state | published | done | `tests/runtime/actions-task.worker.test.ts` — "a 500 fails visibly and a dropped connection is unknown; both keep the local action and a retry on the same key creates one task"; `tests/runtime/actions-task.worker.test.ts` — "with no adapter configured the external task is unavailable and the action works; redirects are not followed and a plain http URL is refused outside the dev and test runtimes"; `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due" |  |
| `ACT-008` | Manual recommendation | published | done | `tests/e2e/actions.spec.ts` — "ACT-009 shows honest email-only owner reminders that stop at the verdict; an operator turns a question into an action, confirms its task, measures it, marks it effective and closes it; a past review date only shows review due" |  |
| `NOTIFY-001` | Analysis attention | published | done | `tests/runtime/feedback-attention.worker.test.ts` — "terminal attention is scoped and duplicate-safe across manual retries, autoruns, insufficient evidence and interruption; cards retain the latest actual revision and state" |  |
| `NOTIFY-002` | New-response mail | published | partial | `tests/e2e/notifications.spec.ts`, `tests/e2e/request-notifications.spec.ts`, `tests/managed-mail.test.ts` | Missing a cited mail journey that reads saved business identity, workspace-zone submission time and the complete operator cohort/default boundary; the cited journeys cover preference controls, request-time once-only delivery and managed-relay retries. PAY-001 gating is also retained but not exercised by this old Evidence set. |
| `NOTIFY-003` | Daily digest | published | done | `tests/runtime/feedback-digest.worker.test.ts` — "Daily freezes independent local-day cohorts, catches missed openings without empty mail, preserves commit recipients and releases, and crosses DST, zone edits and overnight windows once"; `tests/runtime/feedback-digest.worker.test.ts` — "digest retries retain their frozen day and key, unknown requires consent, erasure stops sends and retains anonymous audit facts, and local capture requires a live durable claim"; `tests/managed-mail.test.ts` — "Managed mail uses its assigned sender for sign-in, response notifications and digests, queues rate limits and shows rejected mail to its owner" |  |
| `NOTIFY-004` | No mail loops | published | partial | `tests/e2e/notifications.spec.ts`, `tests/e2e/request-notifications.spec.ts`, `tests/managed-mail.test.ts` | Missing a cited no-inbound-loop journey that tries a reply/autoresponder and proves zero response/participant/notification/further-mail effects, plus an operator-notification bounce that preserves participant delivery state. Current cited journeys exercise outbound deliveries and preferences, not those unsafe cases. |
| `DATA-001` | Export contents | published | done | `tests/contract/data-release.contract.test.ts` — "whole-data archives preserve stable revisions, quarantine, receipts, effects and exact values and refuse unsafe targets"; `tests/contract/data-release.contract.test.ts` — "whole-data owner recovery round-trips a hosted installation and refuses altered migration ledgers"; `tests/contract/data-release.contract.test.ts` — "whole-data recovery preserves import custody, delivery facts, actions, analyses and reporting scope without replay"; `tests/runtime/archive-stream.worker.test.ts` — "native D1 stages bounded writes and atomically publishes all tables, payment states and Stripe IDs included, with exact constraints and concurrent-writer refusal" |  |
| `DATA-002` | Response erasure | published | partial | `tests/e2e/answer-results.spec.ts`, `tests/runtime/analysis-safety.worker.test.ts`, `tests/runtime/feedback-digest.worker.test.ts` | A cited journey must attempt response/contact erasure through its protected door with an inadmissible actor or state, see refusal, and read that populated records remain unchanged. Cited journeys prove successful response/contact erasure, recomputation/redaction and stopped sends; the browser Keep response cancellation does not execute a refused destructive request. |
| `GOV-003` | Retention schedules | published | done | `tests/runtime/retention-schedule.worker.test.ts` — "owner opt-in gives old responses and private saves seven days of notice, hold preserves expiry, and release erases with DATA-002 effects"; `tests/e2e/retention.spec.ts` — "an owner opts into retention, sees advance notice, pauses deletion and releases legal hold" |  |
| `GOV-008` | Legal hold and release | published | partial | `src/core/features/retention/`, `migrations/core/0052_retention.sql`, `tests/runtime/retention-schedule.worker.test.ts`, `tests/e2e/retention.spec.ts`, `tests/runtime/calculations.worker.test.ts` | A cited journey must open an expired private resume link while legal hold preserves its saved state and observe that the link remains unavailable. The retention journey proves hold preserves expired rows, manual erasure remains available and release creates a fresh seven-day grace before deletion, but never opens the expired link. |
| `IMPORT-001` | Reviewed definition | published | partial | `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/runtime/form-import.worker.test.ts` | A cited journey must import unsupported logic, inspect that its affected path remains incomplete, then try publication and observe native validation refusal with no revision created. Cited journeys review unsupported items and preview a valid imported branch, but do not exercise that promised incomplete-path publish refusal. |
| `IMPORT-002` | Reviewed CSV | published | partial | `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts` | A cited journey must submit malformed or over-capacity CSV and read every row error/refusal before writes, then interrupt private preparation and exercise changed-authority/erasure refusal without publication or resurrection. Cited browser journeys cover valid review/acknowledgement, untouched native inventory before Continue, reload and completed typed export, but not those promised refusal/custody cases. |
| `IMPORT-003` | Historical privacy and pinning | published | partial | `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts` | A cited journey must edit the imported form after completion and reopen its historical answers to verify they retain the original revision interpretation; it must inspect retained planning/original custody for the promised hidden/network/file-byte discard. Cited browsers show anonymous historical results and source timestamps, but the edited Google journey ends at an undo-conflict alert without reading historical results again. |
| `IMPORT-004` | Durable replay and reversal | published | partial | `tests/e2e/form-import.spec.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/import-acknowledgement.spec.ts` | A cited journey must read the edited native form/answers after an unsafe undo is refused, and verify safe plan/provenance remain with idempotent completed reversal. Cited browsers show successful undo and a later-native-edit conflict alert but do not read retained native state after that refusal. tests/runtime/form-import.worker.test.ts has a readback journey outside the old Evidence set. |
| `ROLE-001` | Workspace roles | target | missing |  | No code yet. |
| `ROLE-005` | Workspace roles: For roles without form-response access, it inherits the RSLT-009 aggregate-only fixtu | target | missing |  | No code yet. |
| `ROLE-002` | Per-form access and folders | target | missing |  | No code yet. |
| `ROLE-003` | Single sign-on and provisioning | target | missing |  | No code yet. |
| `ROLE-004` | Builder collaboration | target | missing |  | No code yet. |
| `BRAND-002` | Form design themes | target | partial | `src/core/features/brand/brand.ts`, `public/fonts/`, `tests/runtime/brand.worker.test.ts`, `tests/e2e/business-brand.spec.ts` | Named themes, per-form choice, font choice, element colors, backgrounds and layouts do not. |
| `BRAND-004` | Reusable theme custody | target | missing | `src/core/features/brand/brand.ts`, `public/fonts/`, `tests/runtime/brand.worker.test.ts`, `tests/e2e/business-brand.spec.ts` | No reusable-theme create, duplicate, choose-per-form and publish workflow is implemented; the old evidence covers workspace branding only. |
| `TMPL-001` | Template gallery | target | partial | `tests/runtime/first-owner.worker.test.ts` — local first-owner setup preserves identity and requires email proof before inviting an equal operator; `tests/e2e/templates.spec.ts` — “built-in templates each progress from an empty dashboard to publication, response and counted result” — empty dashboard to publication, response and counted result (1440/390) | 75 editable templates in 12 named business categories; native CSAT/CES and 29 branched templates. W-9, quizzes (LOGIC-004), HIPAA intake (GOV-001) and actual payment templates remain unbuilt. Order templates collect requests only; vendor onboarding has no upload or signature. Gallery previews show the first question and a path summary; full respondent previews for every template remain unproved. |
| `TMPL-002` | Team templates | target | done | `tests/runtime/team-templates.worker.test.ts` — "workspace templates preserve branching and settings without copying private source history"; `tests/e2e/team-templates.spec.ts` — "save and reuse a team form, then retire its template" |  |
| `AI-001` | Generate a form from a prompt or a document | target | partial | `tests/runtime/feedback-rewrites.worker.test.ts` — rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution; `tests/e2e/analysis.spec.ts` — an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run; Studio generation runs inside both tagged tests (`tests/runtime/studio-scenario.ts`, `tests/e2e/studio-journey.ts`) | Explicit provider-origin requests generate validated drafts from a goal and bounded text, Markdown, CSV or HTML, with all native question types, typed hidden fields and forward branching. Invalid output writes no draft or answered usage row; source text and goals are not retained. Generated marks appear in Studio review, not the builder. PDF/Word readers, generated marks in the builder, compound conditions, hidden-field branch operands and recall generation remain unbuilt. |
| `FIELD-001` | Hidden fields and URL parameters | target | partial | `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Revision-bound typed declarations, direct-link query values, identifying-field publication checks, blank/value branching and page visibility, preview, escaped recall, private save/resume, ledger search/typed filters, CSV/JSON and copy/archive custody ship. Undeclared, invalid and unsubstituted merge values are discarded and counted; anonymous click IDs are discarded. Remaining: script fixed/forwarded/hidden/GA values (DIST-021), SDK (DIST-015) and invitation-supplied values (DIST-003), integration consumers (INTEG-001 to INTEG-011, INTEG-015 and INTEG-017), alerts (NOTIFY-005), email (NOTIFY-006) and anonymous click-ID delivery custody (INTEG-017). |
| `FIELD-002` | Matrix, Likert and scale grids | target | missing |  | No code yet. |
| `FIELD-003` | CSAT, CES and visual rating questions | target | done | `tests/runtime/contact-scores-scenario.ts` — "contactScoresScenario"; `tests/e2e/satisfaction-scores.spec.ts` — "builds and collects satisfaction, effort, emoji and thumbs scores with stated results and numeric exports" |  |
| `FIELD-004` | US contact fields | target | partial | `src/core/shared/contactAnswers.ts`, `src/core/shared/ui/ContactQuestionInput.tsx`, `src/core/features/reporting/contactExport.ts`, `migrations/core/0040_scores_contact_fields.sql`, `tests/runtime/contact-scores-scenario.ts` | A cited browser journey must enter valid and invalid US contact values and read field-specific errors and the normalized download. The cited native contactScoresScenario proves API validation, international values and normalized exports, but the old Evidence set names no contact-field browser journey. |
| `FIELD-005` | Media in questions and choices | target | missing |  | No code yet. |
| `FIELD-007` | Scheduling handoff | target | missing |  | No code yet. |
| `FIELD-008` | Classic page layout | target | done | `tests/e2e/pages.spec.ts` — "builds three classic pages, edits in-page visibility and completes with hidden required answers discarded" |  |
| `FIELD-009` | Video and audio answers | target | missing |  | No code yet. |
| `FIELD-010` | Other write-ins and exclusive None choices | target | partial | `src/core/shared/otherChoices.ts`, `src/core/shared/ui/ChoiceQuestionInput.tsx`, `src/core/features/importing/choice-response.ts`, `tests/runtime/other-choices.worker.test.ts`, `tests/e2e/other-choices.spec.ts` — “Other write-ins survive native collection, results export and explicit import column review” | Stable Other IDs and required validated write-ins, exclusive None (including selection-minimum exemption), builder controls, branching, distributions/open text, search/filters, analysis evidence, lossless JSON and a separate stable-step CSV text column ship. Typeform/Google definition and reviewed CSV imports retain unambiguous write-ins. Source response API retrieval, SurveyMonkey/Jotform imports, and translation await their target features; ambiguous Google checkbox cells require explicit reviewed columns. |
| `FIELD-017` | Import Other choices and historical write-ins | target | partial | `src/core/shared/otherChoices.ts`, `src/core/shared/ui/ChoiceQuestionInput.tsx`, `src/core/features/importing/choice-response.ts`, `tests/runtime/other-choices.worker.test.ts`, `tests/e2e/other-choices.spec.ts` — “Other write-ins survive native collection, results export and explicit import column review” | Stable Other IDs and required validated write-ins, exclusive None (including selection-minimum exemption), builder controls, branching, distributions/open text, search/filters, analysis evidence, lossless JSON and a separate stable-step CSV text column ship. Typeform/Google definition and reviewed CSV imports retain unambiguous write-ins. Source response API retrieval, SurveyMonkey/Jotform imports, and translation await their target features; ambiguous Google checkbox cells require explicit reviewed columns. |
| `FIELD-011` | Statement screens between questions | target | partial | `src/core/features/importing/fields.ts`, `tests/e2e/journey.spec.ts`, `tests/runtime/form-import.worker.test.ts` | A no-answer screen ships only as the optional first welcome screen, and the Typeform importer maps only a leading Statement while later Statements are reported unsupported; the SurveyMonkey file importer likewise maps only a leading descriptive-text item to the welcome screen and reports later items unsupported (IMPORT-005). |
| `FIELD-018` | Import statement screens | target | partial | `src/core/features/importing/fields.ts`, `tests/e2e/journey.spec.ts`, `tests/runtime/form-import.worker.test.ts` | A no-answer screen ships only as the optional first welcome screen, and the Typeform importer maps only a leading Statement while later Statements are reported unsupported; the SurveyMonkey file importer likewise maps only a leading descriptive-text item to the welcome screen and reports later items unsupported (IMPORT-005). |
| `FIELD-012` | Question groups | target | partial | `src/core/shared/screenLayout.ts`, `src/core/features/importing/typeform-groups.ts`, `tests/runtime/groups.worker.test.ts`, `tests/e2e/groups.spec.ts` | Group builder, per-question validation/progress, grouped-answer branching, Typeform group/inline_group import and hierarchical review ship at 1440 and 390. Optional media and statement blocks remain unbuilt under FIELD-005/FIELD-011. |
| `FIELD-013` | Text length, masks and patterns | target | partial | `src/core/shared/textValidation.ts`, `src/core/features/flows/ui/TextSettings.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/text-validation.spec.ts` | A cited public-door journey must refuse an unsupported pattern at publication and verify browser/API parity for the named invalid lengths and mask. The cited browser journey covers counters, custom errors, correction, submission and export; native precision checks reject these values and patterns through direct service calls, while the HTTP importer exercises only its supported imported pattern. |
| `FIELD-014` | Long choice lists | target | partial | `src/core/shared/formLimits.ts`, `src/core/shared/choiceLists.ts`, `tests/runtime/long-forms.worker.test.ts`, `tests/e2e/long-choices.spec.ts` | Remaining: Optional group media and statement items under FIELD-005/FIELD-011 remain dependencies; mixed-layout capacity alone does not complete this clause. 250 questions across pages, groups and standalone screens; country and 1,000-choice dropdowns; over-limit publication refusal, stable IDs, exports and original 20-sample p95 limits. Browser builder/keyboard/export proof at 1440 and 390. Hosted capacity is not claimed. |
| `FIELD-019` | Long forms without layout penalties | target | partial | `src/core/shared/formLimits.ts`, `src/core/shared/choiceLists.ts`, `tests/runtime/long-forms.worker.test.ts`, `tests/e2e/long-choices.spec.ts` | Remaining: Optional group media and statement items under FIELD-005/FIELD-011 remain dependencies; mixed-layout capacity alone does not complete this clause. 250 questions across pages, groups and standalone screens; country and 1,000-choice dropdowns; over-limit publication refusal, stable IDs, exports and original 20-sample p95 limits. Browser builder/keyboard/export proof at 1440 and 390. Hosted capacity is not claimed. |
| `FIELD-015` | Locale-independent date entry and display | target | partial | `src/core/shared/dateFormat.ts`, `src/core/shared/ui/CalendarDateInput.tsx`, `src/core/shared/answerRecall.ts`, `src/core/features/reporting/repository.ts`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/date-format.spec.ts` | A cited journey must read the date in an answer-bearing response email using the published display format. The cited browser journey covers locale-independent entry, invalid-date refusal, recall, review/completion, ledger display and ISO export; source-import proof belongs separately to FIELD-020. |
| `FIELD-020` | Import date formats | target | partial | `src/core/shared/dateFormat.ts`, `src/core/shared/ui/CalendarDateInput.tsx`, `src/core/shared/answerRecall.ts`, `src/core/features/reporting/repository.ts`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/date-format.spec.ts` | A cited public import journey must retain Typeform structures/separators and Jotform date formats and read the resulting settings. The cited Typeform date-format assertion reads service-imported state, and the old Evidence set contains no Jotform date-format import journey. |
| `FIELD-016` | Labeled opinion scales | target | partial | `src/core/shared/ratingScale.ts`, `src/core/shared/ui/RatingInput.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/opinion-scale.spec.ts` | A cited public-door journey must refuse invalid scale lengths and overlong labels at publication. The cited browser journey covers the labeled zero-to-six scale, numeric zero, routing, ledger, result labels and CSV; the invalid-scale settings are refused only through direct service-level saves. Import mapping proof belongs separately to FIELD-021. |
| `FIELD-021` | Import opinion scales and labels | target | partial | `src/core/shared/ratingScale.ts`, `src/core/shared/ui/RatingInput.tsx`, `tests/runtime/new-question-types.worker.test.ts`, `tests/runtime/form-import.worker.test.ts`, `tests/e2e/opinion-scale.spec.ts` | A cited import journey must retain Typeform, Google Forms, SurveyMonkey and Jotform scale starts, steps and labels. The cited file checks Typeform through services and SurveyMonkey through HTTP, but the old Evidence set contains no Google Forms or Jotform scale-label import journey. |
| `LOGIC-001` | Answer recall | target | partial | `src/core/shared/answerRecall.ts`, `src/core/features/flows/ui/RecallHelp.tsx`, `tests/runtime/answer-recall.worker.test.ts`, `tests/e2e/answer-recall.spec.ts` | A cited public-door journey must exercise publication refusals for invalid recall references and duplicate/remap a recalled form, including blank skipped or invalid values. The browser journey proves preview, updated prompt/choice/completion recall and inert script text, while the remaining cited outcomes are direct service or interpolation checks. |
| `LOGIC-002` | Known-data prefill in invitations | target | partial | `tests/runtime/distribution.worker.test.ts` — "invitation prefill stays pinned, is editable and marked in the ledger, locks are enforced and one completion cancels reminders"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64" | Prefill obligations are complete for editable and locked invitation prefills and marker custody. The in-product and CRM halves remain inherited by DIST-015 and INTEG-003 to INTEG-005 before shipping and are unbuilt. Default APPROVED by ct (23 October 2026): revision-frozen explicit mapping, invitation-token-only values and no cross-device save on mapped invitations. No real mail provider call or consent was used. |
| `LOGIC-007` | Known-data prefill from connected records | target | partial | `tests/runtime/distribution.worker.test.ts` — "invitation prefill stays pinned, is editable and marked in the ledger, locks are enforced and one completion cancels reminders"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64" | Prefill obligations are complete for editable and locked invitation prefills and marker custody. The in-product and CRM halves remain inherited by DIST-015 and INTEG-003 to INTEG-005 before shipping and are unbuilt. Default APPROVED by ct (23 October 2026): revision-frozen explicit mapping, invitation-token-only values and no cross-device save on mapped invitations. No real mail provider call or consent was used. |
| `LOGIC-003` | Variables and calculations | target | done | `tests/runtime/calculations.worker.test.ts` — "agrees across preview, collection, recall and exports for ten quotes and preserves committed values on replay"; `tests/runtime/calculations.worker.test.ts` — "refuses cyclic, deleted, mistyped and zero-denominator calculations, and misplaced or out-of-range payment steps, without publishing the draft"; `tests/runtime/calculations.worker.test.ts` — "calculates typed hidden inputs, arithmetic, calendar differences and dependent blanks after duplication"; `tests/runtime/calculations.worker.test.ts` — "a BMI from two decimal answers gates a branch and publishes"; `tests/e2e/calculations.spec.ts` — "a BMI from two decimal answers gates a branch and publishes" |  |
| `LOGIC-004` | Quiz scores and outcomes | target | missing |  | No code yet. |
| `LOGIC-006` | One condition model and typed operands | target | partial | `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request. |
| `LOGIC-008` | Condition authoring, preview and runtime custody | target | partial | `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request. |
| `LOGIC-009` | Import compound conditions faithfully | target | partial | `src/core/shared/conditions.ts`, `src/core/features/flows/condition-paths.ts`, `src/core/features/flows/ui/ConditionEditor.tsx`, `tests/runtime/conditions.worker.test.ts`, `tests/e2e/conditions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Bounded AND/OR trees over current and earlier on-path structured, numeric, date and boolean questions, negative/set comparisons and blank/answered tests ship. The builder offers earlier operands and readable summaries; preview displays every operand value and group result; preview, published collection and Worker admission share the evaluator. Exact path-correlated publication validation rejects unreachable destinations and feasible cycles. Published revision pinning, duplicated/team-template IDs, 20 conditions across three group levels and archive custody are exercised. Remaining: Text prefix/suffix/contains operators, Other-text operands, grids, quiz/payment operands, quiz, alert/email consumers and compound-condition import mappings remain unbuilt. Declared hidden fields, normalized text equality/inequality and supported calculated operands now share branching, preview and page/group visibility evaluation. Calculated conditions are proved exactly over finite inputs; over unbounded inputs they may be true or false for reachability (LOGIC-003). Classic-page and group visibility share the evaluator under FIELD-008/FIELD-012. Exact feasibility for required text or necessary Other answers with a pattern/mask is explicitly refused; proof-budget exhaustion refuses publication. Existing submission semantics discard off-path answers rather than rejecting the entire request. |
| `LANG-001` | Multi-language forms | target | missing |  | No code yet. |
| `LANG-003` | Multi-language forms: The journey also triggers FIELD-013 length and mask errors in each language and check | target | missing |  | No code yet. |
| `AI-002` | AI translation | target | missing |  | No code yet. |
| `LANG-002` | Editable closed and system text | target | partial | `src/core/shared/respondentText.ts`, `src/core/shared/closedFlow.ts`, `src/core/features/flows/ui/RespondentTextSettings.tsx`, `tests/runtime/foundation.worker.test.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” | Translation (LANG-001), the OK label, required and validation messages, the keyboard hint and recall in messages are not built. |
| `A11Y-002` | Accessibility checker before publication | target | partial | `src/core/features/brand/brand.ts`, `tests/runtime/brand.worker.test.ts` | There is no per-step checker. |
| `DIST-011` | SMS invitations and reminders | target | partial | `tests/runtime/sms.worker.test.ts` — “SMS invitations require recorded consent, use sealed owner custody, and signed STOP cancels the reminder while HELP names the business”; `src/core/features/sms/`, `migrations/core/0065_sms_invitations.sql`; Twilio test-credential receipt `docs/evidence/dist011-twilio-test-2026-10-26.json` (`scripts/proof/sms-twilio-test.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `migrations/core/0071_contact_time_zones.sql`, `tests/runtime/sms.worker.test.ts`:248 (known-zone deferral and workspace fallback on one launch, once-only opening), `tests/runtime/sms.worker.test.ts`:40 (unapproved A2P state makes no provider request), `tests/runtime/sms.worker.test.ts`:240 (invalid save and import), `tests/runtime/sms.worker.test.ts`:255 (erasure), `scripts/deployment-data-custody-replay.check.mjs`:269 (archive restoration), `tests/e2e/distribution-foundation.spec.ts`:11 (SMS Settings, recorded consent and invitation channel at 1440 and 390) | Gap — genuine handset delivery after the owner’s carrier-registration step and genuine provider callback evidence. The shared integration-ledger join remains in INTEG-015; automatic carrier-state lookup is an unclaimed boundary, not completed evidence. |
| `DIST-013` | Embed modes and site plugins | target | partial | `tests/e2e/script-embed.spec.ts` — copied async script mounts an opaque allowed-host iframe, resizes, emits only permitted events and rejects malicious messages (1440/390) | Inline, full-page, popup, popover, slider and side-tab modes with click/delay/scroll/exit triggers and per-browser opening caps ship. Campaign parameters are forwarded subject to declared hidden-field rules. WordPress plugin/container proof, Webflow/Squarespace-specific installation and DIST-021 forward/fixed-value/hidden/_ga options remain unbuilt. Defaults confirmed by ct (24 Oct): click trigger, one opening per host-origin/browser/form/mode, 1 s delay, 50% scroll; unavailable storage keeps modes closed. |
| `DIST-014` | Compose an email first question | target | partial | `tests/runtime/distribution.worker.test.ts` — "invitation score buttons preserve the recipient snapshot, consent blocks sending and renewal records actor and source"; `tests/invitation-links.test.ts` — "emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390) | Default APPROVED by ct (23 October 2026): invitation-token link plus a namespaced answer hint, GET/HEAD with no response/session/answer/view/participant mutation, and short-choice bounds of eight options/80-character labels. Program email (PROG-002) inherits before shipping and remains unbuilt. No real mail provider call or consent was used. |
| `DIST-024` | Confirm an emailed first answer | target | partial | `tests/runtime/distribution.worker.test.ts` — "invitation score buttons preserve the recipient snapshot, consent blocks sending and renewal records actor and source"; `tests/invitation-links.test.ts` — "emitted invitation answer links are inert for repeated GET and HEAD scanners, pinned to their revision and cannot reopen completed or closed responses"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390) | Default APPROVED by ct (23 October 2026): invitation-token link plus a namespaced answer hint, GET/HEAD with no response/session/answer/view/participant mutation, and short-choice bounds of eight options/80-character labels. Program email (PROG-002) inherits before shipping and remains unbuilt. No real mail provider call or consent was used. |
| `DIST-015` | In-product surveys | target | missing |  | No code yet. |
| `DIST-016` | Recurring surveys | target | missing |  | No code yet. |
| `DIST-017` | Named collectors | target | done | `tests/runtime/collectors-trends.worker.test.ts` — "named collectors enforce independent atomic limits and retain attribution in zoned, revision-marked score trends, exports, RSLT-006 crosstabs with stated shares, chi-square and suppression, and multi-part LEDG-005 XLSX and SAV exports" |  |
| `DIST-018` | Form addresses | target | partial | `tests/e2e/rendering-migration.spec.ts` — “emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission” (rename through builder; direct/embed 301 with query; retired-slug refusal; second hostname admission and canonical preview; owner archive restoration and exact re-export; 1440/390, CPU throttle 4); `src/core/features/addresses/`, `migrations/core/0064_form_addresses.sql` | Cloudflare custom-hostname provisioning is not built (Platform zone path). Current equal operators retain builder access until ROLE-001 grants ship. |
| `DIST-020` | Form link previews | target | partial | Published tags, fetchable same-origin image, defaults, canonical-only opt-in, collector/embed/selected-home and completion privacy, restricted refusal and no outbound requests: `tests/e2e/rendering-migration.spec.ts` — “emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission”. Editor card, upload/alt, save/reload/publish at 1440/390: `tests/e2e/authoring.spec.ts` — “labels, one Save, real controls, reorder, branching, Share and a current dashboard”. Revision/default custody and bounded upload validation: `tests/runtime/brand.worker.test.ts` — “settings API preserves preview overrides and publication freezes defaults and images across later edits”; “settings API rejects recalled preview text and invalid, oversized or unlabelled image uploads without mutating the draft”; “upgrading existing publications freezes their logo preview without changing admission policy”. Valid invitation and private resume meta/header: `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — “Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible”; `tests/e2e/save-resume.spec.ts` — “a respondent saves two answers, resumes privately on another device and sees completion on reuse”. Typeform metadata and bounded image retrieval/commit/publication: `tests/runtime/typeform-definition.worker.test.ts` — “the authenticated Typeform retrieval feeds the real reviewed import without retaining the credential or creating records early”. Image archive custody: `tests/runtime/brand.worker.test.ts` — “owner backup carries immutable R2 share images, checks their bytes and refuses missing attachment custody”; `tests/e2e/rendering-migration.spec.ts` — “owner browser backup restores preview image bytes with the same archive checksum”; `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — “complete archive restores R2 bytes and ownership metadata with D1, re-exports identically, and standalone proof keeps actual attachment custody”. | Missing cited public preview journeys for translated title/description/image alt and logo compositing on the form theme background. Existing journeys prove current preview editing, published metadata, same-origin image, imports and archive custody; they never perform those two retained capabilities. |
| `DIST-021` | Forward values from the host page | target | missing |  | The script embed (`src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`) mounts the frame with only its challenge and forwards no host parameter, and `/embed.js` accepts no option but `flow`. |
| `DIST-025` | Plain iframe forwarding | target | missing |  | The script embed (`src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`) mounts the frame with only its challenge and forwards no host parameter, and `/embed.js` accepts no option but `flow`. |
| `RESP-020` | Respondent confirmation content | target | partial | `tests/runtime/respondent-confirmations.worker.test.ts` — "released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy"; `tests/runtime/notification-restore.worker.test.ts` — "restored failed and unknown mail can be explicitly retried with their original key while every other restored delivery remains unarmed"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64" | Receipt wording APPROVED by ct (25 October 2026). Default-off receipts have no link; enabled receipts carry exactly one single-use edit link, consumed through the public edit door with reuse refused. The receipt has no Reply-To or other response-access link. Default APPROVED by ct (23 October 2026): revision-frozen opt-in, one marked typed mailbox or identified participant, second opt-in/type whitelist for copies, and no resend from restored history. GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt and inherit before shipping. No real mail provider call or consent was used. |
| `RESP-027` | Respondent confirmation custody | target | partial | `tests/runtime/respondent-confirmations.worker.test.ts` — "released confirmations use only the marked mailbox or participant, escape permitted recall and dates, retry once and erase their retained copy"; `tests/runtime/notification-restore.worker.test.ts` — "restored failed and unknown mail can be explicitly retried with their original key while every other restored delivery remains unarmed"; `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — "Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible" (1440/390); `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — "full current-data roundtrip preserves prefill markers and disabled confirmation history, stable revisions, quarantine, receipts, historical actors, auth, effects, exact text and int64" | Receipt wording APPROVED by ct (25 October 2026). Default-off receipts have no link; enabled receipts carry exactly one single-use edit link, consumed through the public edit door with reuse refused. The receipt has no Reply-To or other response-access link. Default APPROVED by ct (23 October 2026): revision-frozen opt-in, one marked typed mailbox or identified participant, second opt-in/type whitelist for copies, and no resend from restored history. GOV-004 sensitive withholding, LOGIC-004 quiz results, PAY-001 payment receipt links and SIGN-001 signed PDFs remain unbuilt and inherit before shipping. No real mail provider call or consent was used. |
| `RESP-021` | Edit after submission | target | done | `tests/runtime/response-webhooks.worker.test.ts` — "signed response events verify, retry on one event ID, replay, disable with an alert and list undelivered responses without ever blocking collection"; `tests/e2e/save-resume.spec.ts` — "a respondent saves two answers, resumes privately on another device and sees completion on reuse" |  |
| `PART-001` | Consented partial-response capture | target | missing |  | No code yet. |
| `PART-002` | Save and resume | target | partial | `src/core/features/resuming/`, `src/core/features/responses/ui/SaveResponse.tsx`, `src/core/features/responses/ui/ResumeFlowPage.tsx`, `migrations/core/0043_saved_responses.sql`, `tests/runtime/resuming.worker.test.ts`, `tests/e2e/save-resume.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | A cited journey must leave after answering without choosing Save and inspect that no partial answer state was stored; it must also exercise legal hold/notice custody before automatic private-save expiry. The cited save/resume journeys prove explicit saves, revision pinning, email separation, retries, expiry/closure/erasure and restored credential removal. The legal-hold journey is in tests/runtime/retention-schedule.worker.test.ts, outside the old PART-002 Evidence set. |
| `RESP-022` | Response-quality flags | target | partial | `src/core/features/responses/service.ts`, `tests/runtime/journey.worker.test.ts` | Only the behaviour named in Evidence ships; the rest of the clause is not built. |
| `RESP-023` | Identified public collection | target | partial | `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Per-revision anonymous/identified public-link mode, typed link-supplied unverified identity, pre-answer disclosure, This isn’t me, merge-tag rejection/counting and ledger/export identity mode ship. Remaining: public-link revision binding, fixed identifying values and reasoned cross-revision refusal; contact matching, CRM/email-platform identity deliveries, popup and QR tooling. The current runtime validates submitted hidden values against the admitted session's revision. It does not yet bind the public URL itself to a revision or freeze identifying values: direct links resolve the current revision, and hidden values arrive with the submitted answers. Cross-revision identified-link refusal and fixed identifying values therefore remain obligations of this partial clause. |
| `RESP-028` | Revision-bound public identity | target | partial | `src/core/shared/hiddenFields.ts`, `tests/runtime/hidden-fields.worker.test.ts`, `tests/e2e/hidden-fields.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Per-revision anonymous/identified public-link mode, typed link-supplied unverified identity, pre-answer disclosure, This isn’t me, merge-tag rejection/counting and ledger/export identity mode ship. Remaining: public-link revision binding, fixed identifying values and reasoned cross-revision refusal; contact matching, CRM/email-platform identity deliveries, popup and QR tooling. The current runtime validates submitted hidden values against the admitted session's revision. It does not yet bind the public URL itself to a revision or freeze identifying values: direct links resolve the current revision, and hidden values arrive with the submitted answers. Cross-revision identified-link refusal and fixed identifying values therefore remain obligations of this partial clause. |
| `RESP-024` | Review before submit | target | done | `tests/e2e/date-format.spec.ts` — "RESP-024 reviews display formats, edits a branch and submits once; FIELD-015 keeps locale-independent entry, recall and ISO exports" |  |
| `LEDG-005` | Spreadsheet exports | target | partial | `src/core/features/reporting/export.ts`, `src/core/features/reporting/xlsxExport.ts`, `src/core/features/reporting/zip.ts`, `src/core/features/reporting/savDictionary.ts`, `src/core/features/reporting/savWriter.ts`, `src/core/features/reporting/exportInventory.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/runtime/export-reader.global.ts`, `tests/e2e/ledger-filters.spec.ts`, `docs/evidence/ledg005-exports-1440.png`, `docs/evidence/ledg005-exports-390.png` | Missing an over-limit spreadsheet-cell journey that attempts export and observes complete refusal rather than truncation with no partial success. Cited journeys read ordinary text and formula-like values and two-page exports, not this dangerous boundary. |
| `LEDG-007` | Statistics exports | target | partial | `src/core/features/reporting/export.ts`, `src/core/features/reporting/xlsxExport.ts`, `src/core/features/reporting/zip.ts`, `src/core/features/reporting/savDictionary.ts`, `src/core/features/reporting/savWriter.ts`, `src/core/features/reporting/exportInventory.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/runtime/export-reader.global.ts`, `tests/e2e/ledger-filters.spec.ts`, `docs/evidence/ledg005-exports-1440.png`, `docs/evidence/ledg005-exports-390.png` | Missing a cited statistics-export journey for system-missing absent-revision questions, very-long strings, over-limit refusal without truncation and full metadata labels after format limits. Existing readers inspect ordinary coded values and cursor continuity only. |
| `LEDG-006` | Response search | target | partial | `migrations/core/0053_response_search_values.sql`, `src/core/features/reporting/search.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/ledger-search-upgrade.worker.test.ts`, `tests/runtime/other-choices.worker.test.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”, `tests/e2e/response-search.spec.ts`, `tests/release/ledger-search.worker.test.ts`, `docs/evidence/ledger-search-2026-10-20.json`; Verify runtime (worker-2) via `scripts/run-contract-lane.mjs`: `tests/release/ledger-search.worker.test.ts` — “[LEDG-006] returns count and first page under one second p95 across 100,000 responses”. | Missing the ROLE-002/GOV-004 identity/sensitive-grant search journey in the old evidence. Current cited journeys cover all-equal-operator Unicode/literal search, filters, highlighting, erasure and capacity; the retained grant-aware query scope is unbuilt. |
| `LEDG-008` | Search custody through change | target | partial | `migrations/core/0053_response_search_values.sql`, `src/core/features/reporting/search.ts`, `tests/runtime/ledger-filters.worker.test.ts`, `tests/runtime/ledger-search-upgrade.worker.test.ts`, `tests/runtime/other-choices.worker.test.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities”, `tests/e2e/response-search.spec.ts`, `tests/release/ledger-search.worker.test.ts`, `docs/evidence/ledger-search-2026-10-20.json`; Verify runtime (worker-2) via `scripts/run-contract-lane.mjs`: `tests/release/ledger-search.worker.test.ts` — “[LEDG-006] returns count and first page under one second p95 across 100,000 responses”. | Missing the retained ROLE-002/GOV-004 identity/sensitive-grant custody cases in the old evidence. Current all-equal-operator search/upgrade/archive journeys cover the other retained outcomes; this part cannot be done before its grant-aware cases are shown. |
| `WORK-001` | Submission inbox | target | partial | `src/core/features/submissions/`, `src/core/features/reporting/scope.ts`, `tests/runtime/submissions.worker.test.ts` | Native-route triage, private notes, bulk version guards, filters, audit and custody are proved. Gap: the browser journey at 1440 and 390 assigning, tagging, noting and moving a submission to done is absent; done only when that journey exists. |
| `WORK-002` | Approval flows | target | missing |  | No code yet. |
| `WORK-003` | Multi-person forms | target | missing |  | No code yet. |
| `WORK-004` | Workflow reminders and escalation | target | missing |  | No code yet. |
| `WORK-005` | Submission PDFs and generated documents | target | missing |  | No code yet. |
| `RSLT-006` | Crosstab dimensions and statistics | target | partial | `src/core/features/reporting/crosstab.ts`, `src/core/features/reporting/crosstabDimensions.ts`, `src/core/features/reporting/crosstabStats.ts`, `src/core/features/results/ui/CrosstabPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `docs/evidence/rslt006-crosstab-1440.png`, `docs/evidence/rslt006-crosstab-390.png` | Missing cited language, quiz-score/outcome, stable matrix-row and remaining promised dimension journeys. Existing cited journeys prove question, hidden-field and collector matrices, shares and chi-square, but the retained LANG-001/LANG-003/LOGIC-004/FIELD-002 dimensions are unbuilt. |
| `RSLT-014` | Crosstab disclosure boundaries | target | partial | `src/core/features/reporting/crosstab.ts`, `src/core/features/reporting/crosstabDimensions.ts`, `src/core/features/reporting/crosstabStats.ts`, `src/core/features/results/ui/CrosstabPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts`, `tests/e2e/answer-results.spec.ts`, `docs/evidence/rslt006-crosstab-1440.png`, `docs/evidence/rslt006-crosstab-390.png` | Missing the retained aggregate-only whole-report crosstab/refusal fixture through a shared report/tool result. Old evidence proves the raw-authorized operator boundary only; RSLT-015/RSLT-016 aggregate protection remains unbuilt. |
| `RSLT-007` | Trends over time | target | partial | `src/core/features/reporting/trends.ts`, `src/core/features/reporting/trendPeriods.ts`, `src/core/features/results/ui/TrendsPanel.tsx`, `tests/runtime/collectors-trends.worker.test.ts` | Zoned day/week/month/quarter score and primitive-answer-share charts, answered denominators, minimum-size gaps, revision markers, collector cohorts and CSV ship. DIST-016 recurring occurrences, PROG-003 program dashboards, and shares of ranked/structured contact answers remain unbuilt. |
| `RSLT-008` | Saved views and dashboards | target | partial | `src/core/features/reporting/answerFilter.ts`, `tests/runtime/ledger-filters.worker.test.ts` | Saved views do not. |
| `RSLT-009` | Shared report links | target | missing |  | No code yet. Today that is every operator. |
| `RSLT-015` | Aggregate-only report cohorts | target | missing |  | No code yet. Today that is every operator. |
| `RSLT-016` | Whole-report complementary suppression | target | missing |  | No code yet. Today that is every operator. |
| `RSLT-010` | Report exports | target | missing |  | No code yet. |
| `RSLT-011` | Scheduled report email | target | missing |  | No code yet. |
| `RSLT-013` | Anonymous traffic and conversion | target | done | `tests/e2e/traffic.spec.ts` — "three real form loads yield two starts and one submission, while preview remains isolated"; `tests/runtime/traffic.worker.test.ts` — "anonymous view and durable start buckets report native conversion cohorts without retaining visitor metadata"; `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review" |  |
| `RSLT-017` | Submission-time traffic exclusions | target | done | `tests/e2e/traffic.spec.ts` — "three real form loads yield two starts and one submission, while preview remains isolated"; `tests/runtime/traffic.worker.test.ts` — "anonymous view and durable start buckets report native conversion cohorts without retaining visitor metadata"; `tests/runtime/traffic.worker.test.ts` — "signed form-load timing and retained bot exclusions leave anonymous view and start counters unchanged on review" |  |
| `ACT-009` | Action owner reminders | target | partial | `src/core/features/notifications/action-reminder-dispatcher.ts`, `src/core/features/actions/reminders.ts`, `migrations/core/0054_action_owner_reminders.sql`, `tests/runtime/actions-measurement.worker.test.ts`, `tests/e2e/actions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Missing a cited connected Slack/Teams owner-reminder journey for the same before/on/weekly timing, sending-hour deferral and verdict cancellation. Existing cited journeys show email only; linked-task readback moved to ACT-010. |
| `ACT-010` | Linked task status | target | partial | `src/core/features/notifications/action-reminder-dispatcher.ts`, `src/core/features/actions/reminders.ts`, `migrations/core/0054_action_owner_reminders.sql`, `tests/runtime/actions-measurement.worker.test.ts`, `tests/e2e/actions.spec.ts`, `scripts/deployment-data-custody-replay.check.mjs` — “whole-data delivery recovery retains exact product custody and never replays restored capabilities” | Missing a journey through the action detail and refresh door that reads linked external task status, changes it at the provider and reads the refreshed state. Existing cited evidence shows task delivery identity, not status display/readback. |
| `NOTIFY-005` | Answer-based alerts | target | partial | `tests/runtime/notifications.worker.test.ts` — “publisher defaults Immediately only if unset, others Off; committed private mail has a durable attempt and replay cannot double send” with `tests/runtime/answer-alert-proof.ts`; `tests/e2e/notifications.spec.ts` — “notification preference and failed delivery controls are accessible on desktop and mobile with authenticated results” (rule editor and attention at 1440/390); `src/core/features/notifications/answer-alerts.ts`, `migrations/core/0068_answer_alerts.sql` | Named operators receive durable email and in-app attention once per matching rule/recipient/released response. Typed LOGIC-006 conditions cover question answers, hidden fields, numeric/text calculations and payment state; proof covers detractor/promoter, enterprise conjunction, calculated total/text, pending/paid gating, no answer text, retries, unknown outcomes and erasure. Restored alert deliveries are disarmed. Configured Slack/Teams rule targets now receive one durable, identifier-only post per matching rule/released response, with failures in the integration ledger and public erasure custody; the existing notification registration includes `tests/runtime/answer-alert-chat-proof.ts`. Remaining: mobile push (MOB-003, no Apple/Google developer accounts), answer inclusion (ROLE-002), and derived quiz/outcome score operands (LOGIC-004). Ruled defaults (ct 24 Oct 19:47Z): at most 20 rules per form and 100 named recipients per rule; the recipient cohort freezes at first eligible evaluation, and later response edits do not generate another alert. |
| `NOTIFY-006` | Conditional response-email content | target | partial | `src/core/features/notifications/dispatcher.ts`, `src/core/features/notifications/compose.ts`, `tests/runtime/notifications.worker.test.ts`, `tests/e2e/notifications.spec.ts` | Answers, non-operator recipients, rules and Reply-To do not. |
| `NOTIFY-007` | Response-email recipient custody | target | partial | `src/core/features/notifications/dispatcher.ts`, `src/core/features/notifications/compose.ts`, `tests/runtime/notifications.worker.test.ts`, `tests/e2e/notifications.spec.ts` | Answers, non-operator recipients, rules and Reply-To do not. |
| `GOV-001` | HIPAA mode | target | missing |  | No code yet. |
| `GOV-002` | Data location | target | missing |  | No code yet. |
| `GOV-004` | Sensitive fields | target | missing |  | No code yet. |
| `GOV-005` | Audit log viewer | target | partial | `src/core/features/audit/`, `src/core/features/audit/events.ts`, `tests/runtime/audit-viewer.worker.test.ts`, `tests/e2e/response-webhooks.spec.ts` | Publish, connection, export and deletion events are recorded; role-change (ROLE-001), reveal (GOV-004) and approval (WORK-002) events are unbuilt. |
| `GOV-006` | Respondent privacy requests | target | partial | `tests/e2e/answer-results.spec.ts`, `tests/runtime/analysis-safety.worker.test.ts` | Cross-form lookup, access export and integration deletion do not. |
| `GOV-007` | Marketing and messaging consent | target | partial | `src/core/shared/marketingConsent.ts`, `tests/runtime/new-question-types.worker.test.ts`, `src/core/features/results/ui/ConsentRecords.tsx`, `src/core/features/flows/ui/MarketingOptInSettings.tsx`, `tests/runtime/foundation.worker.test.ts`, `tests/e2e/closed-flow.spec.ts` — “closed flows refuse late submissions, retain their named document and embed boundaries, and disappear after archival” | Mailchimp and Mango delivery and its fixture (INTEG-007) are not built; consent records are not in exports; the TCPA wording is not checked. |
| `IMPORT-005` | SurveyMonkey migration | target | partial | `tests/runtime/form-import.worker.test.ts` — two fresh databases produce equivalent reports, source structures, typed answers and 27 inert completions; `tests/e2e/surveymonkey-import.spec.ts` — SurveyMonkey file-pair upload reviews every supported field and names the omitted elements | Uploaded API v3 survey-details and responses-bulk files use the shared review/commit/undo door. Supported text validation, labeled scales, Other write-ins and declared custom variables retain their values. OAuth account connection with survey choice, skip/display/advanced AND/OR logic, source collector attribution, general matrices/ranking, descriptive text after a leading welcome and other unsupported question types remain unbuilt and explicitly reported; retained questions with unsupported routing require repair before publication. |
| `IMPORT-006` | Jotform migration | target | missing |  | No code yet. |
| `IMPORT-007` | Typeform and Google Forms by connection | target | partial | `src/core/features/importing/typeform-definition.ts`, `tests/runtime/typeform-definition.worker.test.ts`, `tests/e2e/google-forms-import.spec.ts` — “Google CSV-only and definition imports preserve reviewed locale, omissions and historical answers without identity”, `tests/e2e/form-import.spec.ts` | Typeform calculation actions are reported unsupported (`src/core/features/importing/logic.ts`). |
| `IMPORT-008` | Up-and-comer and Microsoft exports | target | missing |  | No code yet. |
| `IMPORT-009` | Migration checklist | target | missing |  | No code yet. |
| `PAY-001` | Payment state and safe replacement | target | partial | `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts` | Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built. |
| `PAY-006` | Stripe payment pricing and placement | target | partial | `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts` | Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built. |
| `PAY-007` | Checkout and respondent return | target | partial | `src/core/features/payments/`, `src/core/features/responses/payment-responses.ts`, `src/core/features/flows/payment-proof.ts`, `src/core/shared/payments.ts`, `migrations/core/0055_payments.sql`, `tests/runtime/calculations.worker.test.ts`, `tests/runtime/archive-stream.worker.test.ts`, `tests/e2e/calculations.spec.ts` | Proved against a loopback Stripe stand-in in CI and, in Stripe test mode, by the committed receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46: a $40 Checkout Session created at the server total, paid with test card 4242 on checkout.stripe.com, marked paid only on the signed event, its amount_total read back from Stripe equal to Pencil’s total, and refunded in full; real Stripe event payloads were delivered re-signed with the app-saved secret because the Stripe CLI cannot run on that host); no live charge, tax or legal acceptance is claimed. CI proves the owner-only, sealed restricted-key connection; the exact server-computed total sent and a submitted amount refused; forged and stale signatures ignored and a duplicate delivery changing nothing; expired and cancelled Checkouts, cancel replacing the response under the same key; one response per invitation; a completion target counting only paid responses; immediate mail only after payment; archive and erasure custody; five publication refusals by payment step ID; the 1440/390 journey. CI-run public-door tests also prove (a) a calculated amount that reads a question a path to the payment step can skip and (b) one that can fall below the minimum, each refused by payment step ID with no revision created and the repaired draft published; (c) `failed` and (d) `refunded` from signed webhooks, a replay changing nothing; (e) Daily digests that leave out unpaid responses and send a response paid after an opening it predates, once, at the next opening; (f) a collector's response limit counting only paid responses; (g) the script embed opening Checkout at top level and returning to the form's own page at 1440 and 390; and (h) GOV-003 retention deleting a response's payment state, Stripe IDs and events from storage, the ledger, exports and later archives while an in-period response stays. Remaining: payment forms in the plain iframe embed, which has no host script to open Checkout. Archives exported before a deletion keep their copies. PAY-001 was audited by ct audit80 at 015185c6 on 21 Oct: partial. Connect OAuth, a named target step of this clause, is not built; today's door is the owner-only restricted key. NOTIFY-005 and PAY-002 to PAY-005 inherit payment state before they ship. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built. |
| `PAY-002` | Sales tax, coupons and receipts | target | partial | `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal"; `tests/e2e/calculations.spec.ts` — "authors Checkout tax, coupon and receipt settings and reads the signed totals on the response" (1440/390, CPU throttle 4) | Receipt delivery and per-payment receipt suppression remain unproved; Checkout email collection and Stripe account receipt settings control delivery under the adopted PAY-002 default. Proof is against the loopback Stripe stand-in in CI, and the committed Stripe test-mode receipt `docs/evidence/pay005-stripe-test-2026-10-26.json` (sd-pencil-c46) stores subtotal 4000, discount 500, tax 0 and total 3500 for a coupon created through the Stripe API and deleted afterwards, matching Stripe’s Checkout Session. Stripe Tax reads active on that test account, but the run did not enable automatic tax, so the tax amount remains fixture-proved. |
| `PAY-003` | Subscriptions and donations | target | partial | `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (monthly/yearly prices, bounded custom and recurring donations, signed cancellation, refused client amount, archive/erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" (settings and response records at 1440/390, CPU throttle 4) | Custom donation amounts are entered only on Stripe within the operator’s minimum and maximum. Gap: pre-Stripe (in-form) amount entry; recurring custom amounts (recurring donations use fixed server-priced amounts); held-key Stripe test-mode proof. Ongoing billing management belongs to Stripe’s customer portal; no portal is built. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed. |
| `PAY-004` | ACH and other US payment methods | target | partial | `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (card/ACH Checkout methods, processing to paid/failed, replay, processing excluded from admission, archive/erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" (ACH settings and processing/paid response records at 1440/390, CPU throttle 4) | ACH and Checkout card wallets ship first. Gap: "and PayPal or Square as alternative providers with the same pending/paid/failed states"; "and a PayPal fixture order to paid" remain unmet, with no PayPal or Square sandbox accounts held. Real Apple Pay, Google Pay and ACH test-mode settlement are unproved. Failed ACH checkout retry and a dedicated respondent processing label remain unproved; the existing return says Stripe is confirming and the response record shows processing. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed.  Provider target retained verbatim: Payment steps can offer ACH Direct Debit (Stripe US bank account), Apple Pay and Google Pay through Checkout, and PayPal or Square as alternative providers with the same pending/paid/failed states; ACH's delayed settlement is shown as `processing` until it succeeds or fails. Acceptance retained verbatim: a Worker test drives an ACH payment through processing to succeeded and to failed, and a PayPal fixture order to paid. |
| `PAY-005` | Payment ledger and refunds | target | partial | `tests/runtime/calculations.worker.test.ts` — "preserves signed tax and discount totals in the ledger, exports, archives and erasure while refusing a changed subtotal" (owner refusal, over-refund, replay, filters, CSV, reconciliation mismatch, restoration and erasure); `tests/e2e/calculations.spec.ts` — "builds a conditional total, previews calculated routing, pays each branch on Stripe Checkout and retains both published totals" ($10 of $40, 1440/390, CPU throttle 4); `docs/evidence/pay005-stripe-test-2026-10-26.json` (real Stripe test-mode receipt, `scripts/proof/payments-stripe-test.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `tests/runtime/calculations.worker.test.ts`:569 (pre-upgrade dates and disclosure), `tests/runtime/calculations.worker.test.ts`:634 (unconfirmed refund makes no provider request), `tests/runtime/calculations.worker.test.ts`:644 (provider ID suffix), `tests/runtime/calculations.worker.test.ts`:679 (reservation survives provider failure), `tests/runtime/calculations.worker.test.ts`:699 (complete ledger and CSV at 1,000, explicit refusal at 1,001) | Gap — Identity-granted operator payment access, refunds and reconciliation; ledgers and period reconciliation beyond 1,000 records. Direct Stripe webhook delivery and exact-head provider execution provenance remain unproved provider evidence, separate from the passing fixture Acceptance. |
| `FILE-001` | File-upload questions | target | missing |  | No code yet. |
| `FILE-002` | Storage sync | target | missing |  | No code yet. |
| `FILE-003` | Upload scanning | target | missing |  | No code yet. |
| `SIGN-001` | Signature fields | target | missing |  | No code yet. |
| `AI-003` | Document extraction with respondent correction | target | missing |  | No code yet. |
| `PROG-001` | Program setup | target | partial | `src/core/features/flows/templates.ts`, `tests/runtime/new-question-types.worker.test.ts` | Programs do not. |
| `PROG-002` | Transactional triggers | target | missing |  | No code yet. |
| `PROG-003` | Score tracking | target | missing |  | No code yet. |
| `PROG-004` | Closed-loop follow-up | target | missing |  | No code yet. |
| `INTEG-001` | Google Sheets | target | done | `tests/runtime/google-sheets.worker.test.ts` — "Google OAuth seals owner tokens and Sheets backfills, appends stable columns, replays failed rows without duplicates and clears an erased response" |  |
| `INTEG-002` | Microsoft Excel | target | missing |  | No code yet. |
| `INTEG-003` | HubSpot contact delivery | target | missing |  | No code yet. |
| `INTEG-018` | HubSpot property mapping | target | missing |  | No code yet. |
| `INTEG-004` | Salesforce | target | missing |  | No code yet. |
| `INTEG-005` | Orbit | target | missing |  | No code yet. |
| `INTEG-006` | Slack and Microsoft Teams | target | partial | `tests/runtime/response-webhooks.worker.test.ts` — signed response events registration with `tests/runtime/chat-integrations-proof.ts` (Slack and Teams loopback posts, sensitive type refusal, signed action, calendar reminders and verdict stop); `tests/e2e/response-webhooks.spec.ts` with `tests/e2e/chat-settings-proof.ts` (Settings and form cards at 1440/390); `src/core/features/chat-integrations/`, `migrations/core/0069_chat_integrations.sql`; `docs/evidence/integ006-slack-live-2026-10-26.json` (live Slack receipt, `scripts/proof/chat-slack-live.mjs`, local only); the provider receipt was recorded locally before dd639754 and binds no runtime SHA; `tests/runtime/chat-integrations-proof.ts`:59 (authored flow and response-time metadata), `tests/runtime/chat-integrations-proof.ts`:75 (signed actor and channel refusals), `tests/runtime/chat-integrations-proof.ts`:89 (authored action fields), `tests/runtime/chat-integrations-proof.ts`:190 (old signed control refused); transport size and signature assertions at `tests/runtime/chat-integrations-proof.ts`:79, `tests/runtime/chat-integrations-proof.ts`:210 and `tests/runtime/chat-integrations-proof.ts`:221; the ten-second timeout remains unasserted | Gap — Nook delivery and its receiving connection; Teams message-action creation; a genuine Teams post through a licensed Microsoft 365 tenant’s incoming webhook; a genuine signed Slack interaction through the owner-configured public Interactivity Request URL; asserting proof of the approved transport boundaries. INTEG-015 retains the unbuilt chat-post replay interface under the existing uip gate. |
| `INTEG-007` | Mailchimp and Mango members | target | missing |  | No Mailchimp or Mango connection exists in `src/` or `tests/`. |
| `INTEG-019` | Email-platform fields and tags | target | missing |  | No Mailchimp or Mango connection exists in `src/` or `tests/`. |
| `INTEG-008` | Notion, Airtable and Cradle | target | missing |  | No code yet. |
| `INTEG-009` | Zapier, Make, n8n and Crank | target | missing |  | No code yet. |
| `INTEG-010` | Signed response webhooks | target | partial | `src/core/features/webhooks/`, `migrations/core/0063_response_event_webhooks.sql`, `tests/runtime/response-webhooks.worker.test.ts`, `tests/e2e/notifications.spec.ts`, `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites”, `docs/guide/results.md`, `src/core/features/actions/webhook.ts`, `tests/runtime/actions-task.worker.test.ts` | `response.updated` is now asserted through the single-use edit link in the existing signed-response-event registration. `approval decided` events (WORK-002) cannot be sent yet; bodies carry identifiers only until GOV-004 masking exists. |
| `INTEG-011` | Public REST API | target | partial | `src/core/features/reporting/routes.ts`, `tests/runtime/ledger-filters.worker.test.ts` | There are no tokens, versioning or OpenAPI document. |
| `INTEG-012` | MCP server for Claude and ChatGPT | target | missing |  | No code yet. |
| `INTEG-013` | Task destinations | target | partial | `src/core/features/actions/todoist.ts`, `src/core/features/actions/webhook.ts`, `tests/runtime/actions-task.worker.test.ts` | Only the behavior named in Evidence ships; the rest of the clause is not built. |
| `INTEG-014` | Help-desk and commerce event sources | target | missing |  | No code yet. |
| `INTEG-015` | Integration delivery ledger | target | partial | `src/core/features/webhooks/ledger.ts`, `src/core/features/webhooks/deliveries.ts`, `tests/runtime/response-webhooks.worker.test.ts`, `tests/runtime/actions-task.worker.test.ts`, `tests/e2e/response-webhooks.spec.ts`, `src/core/features/actions/deliveries.ts`; `tests/runtime/google-sheets.worker.test.ts` (five failed Sheets rows, alert, repair and replay and no duplicates) | Other row, record, contact, message and file destinations (INTEG-002 to INTEG-009), and email and SMS invitations (DIST-006), are not in the shared ledger. Google Sheets rows, attempts, failure alerts and replay now join webhook and task deliveries. The chat-post replay interface remains unbuilt and subject to the existing uip gate. |
| `INTEG-016` | Connection custody | target | partial | `src/core/platform/config/connections.ts`, `tests/e2e/actions.spec.ts`, `tests/e2e/analysis.spec.ts` | Only the behavior named in Evidence ships; the rest of the clause is not built. |
| `INTEG-017` | Server-side ad conversion delivery | target | partial | `src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts` | There is no `dataLayer` push, event ID or server-side conversion connection. |
| `INTEG-020` | Embed conversion events and diagnostics | target | partial | `src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts` | There is no `dataLayer` push, event ID or server-side conversion connection. |
| `MOB-001` | Operator app on a phone | target | partial | `tests/e2e/accessibility-foundation.spec.ts` | The submission inbox ships under WORK-001. Complete 360-pixel journeys over every operator page remain unproved, and WORK-002 approval flows remain unbuilt. |
| `MOB-002` | Offline field collection | target | missing |  | No code yet. |
| `MOB-003` | Native iOS and Android apps | target | missing |  | No code yet. |
| `AGENT-001` | Study designer | push-further | partial | `tests/runtime/feedback-rewrites.worker.test.ts` — rewrite requests preserve the source and draft until explicit guarded acceptance, with real provider calls, failure and usage attribution; `tests/e2e/analysis.spec.ts` — an operator requests analysis, reads a quoted finding back to its response, sees a small theme withheld, turns the recommendation into an action and retries a failed run; Studio generation runs inside both tagged tests (`tests/runtime/studio-scenario.ts`, `tests/e2e/studio-journey.ts`) | Studio drafts an editable decision, hypotheses, audience/channel and analysis plan with validated questions, deterministic advisory bias flags and finite-population sample sizes. Context includes typed text and prompts of explicitly selected prior forms only; prior findings and CRM segments as context remain unbuilt. Provider semantic quality and neutral wording are not established by fixture proof; advisory flags never rewrite questions. |
| `AGENT-002` | Themes and contradictions | push-further | partial | `tests/runtime/analysis-output.worker.test.ts` — findings rank themes by recomputed support, quote exact stored excerpts, link every figure to its responses and withhold a theme below the disclosure threshold; `tests/e2e/analysis.spec.ts` — operator analysis and finding review | Strict optional contradiction output validates both sides against this run, verifies exact excerpts, withholds the entire finding if either side is too small, and shares persisted accept/dismiss decisions with themes. Text and explicitly selected numeric scores can support a finding. Cross-revision, collector and segment comparison evidence and systematic question-conflict discovery remain unbuilt; model semantic accuracy is not established by fixture proof. |
| `AGENT-003` | Follow-up that settles it | push-further | missing |  | No code yet. |
| `AGENT-004` | Finding into owned work, and the outcome checked | push-further | partial | `src/core/features/actions/service.ts`, `tests/runtime/actions-measurement.worker.test.ts` | Only the behavior named in Evidence ships; the rest of the clause is not built. |
| `AGENT-005` | Feedback-loop sentinel | push-further | partial | `src/core/features/actions/deliveries.ts`, `src/core/features/responses/completionMetrics.ts`, `src/core/features/analysis/attention.ts` | Only the behavior named in Evidence ships; the rest of the clause is not built. |
| `AGENT-006` | Adaptive probe | push-further | missing |  | No code yet. |
| `AGENT-007` | Close-the-loop drafter | push-further | missing |  | No code yet. |
| `AGENT-008` | Completion optimizer | push-further | missing |  | No code yet. |
| `AGENT-009` | Migration agent | push-further | partial | `src/core/features/importing/typeform-definition.ts`, `tests/runtime/typeform-definition.worker.test.ts` | Only the behavior named in Evidence ships; the rest of the clause is not built. |
| `DIST-023` | Shared-device kiosk | published | done | `tests/e2e/kiosk.spec.ts` — "download labelled QR codes and collect isolated shared-device responses with idle clearing"; `tests/runtime/qr.worker.test.ts` — "QR downloads require operator authority, retain the exact collection link and reject unrelated collectors and formats" |  |
| `DIST-026` | Search indexing choice | target | partial | Published tags, fetchable same-origin image, defaults, canonical-only opt-in, collector/embed/selected-home and completion privacy, restricted refusal and no outbound requests: `tests/e2e/rendering-migration.spec.ts` — “emitted Worker serves revision previews and canonical-only indexing without weakening respondent admission”. Editor card, upload/alt, save/reload/publish at 1440/390: `tests/e2e/authoring.spec.ts` — “labels, one Save, real controls, reorder, branching, Share and a current dashboard”. Revision/default custody and bounded upload validation: `tests/runtime/brand.worker.test.ts` — “settings API preserves preview overrides and publication freezes defaults and images across later edits”; “settings API rejects recalled preview text and invalid, oversized or unlabelled image uploads without mutating the draft”; “upgrading existing publications freezes their logo preview without changing admission policy”. Valid invitation and private resume meta/header: `tests/e2e/distribution-foundation.spec.ts` — “invitation capabilities reject invalid tokens before the accessible audience delivery, completion, opt-out and erasure journey” — “Audience CSV review, saved segment, email score 9, editable invitation prefill, confirmation receipt, identified ledger, cancellation, opt-out and erasure are keyboard accessible”; `tests/e2e/save-resume.spec.ts` — “a respondent saves two answers, resumes privately on another device and sees completion on reuse”. Typeform metadata and bounded image retrieval/commit/publication: `tests/runtime/typeform-definition.worker.test.ts` — “the authenticated Typeform retrieval feeds the real reviewed import without retaining the credential or creating records early”. Image archive custody: `tests/runtime/brand.worker.test.ts` — “owner backup carries immutable R2 share images, checks their bytes and refuses missing attachment custody”; `tests/e2e/rendering-migration.spec.ts` — “owner browser backup restores preview image bytes with the same archive checksum”; `scripts/deployment-data.check.mjs` — “complete archive recovery retains exact data and attachment custody and refuses unsafe sources, archives and destinations without overwrites” — “complete archive restores R2 bytes and ownership metadata with D1, re-exports identically, and standalone proof keeps actual attachment custody”. | Missing a cited publication journey that refuses indexing on HIPAA-mode and invitation-only forms while preserving their crawler restrictions and admission. Existing preview/brand journeys prove public canonical opt-in and restricted/identified refusal but never these two retained modes. |
| `DIST-027` | Forwarded campaign attribution | target | missing |  | The script embed (`src/core/features/embedding/script.ts`, `tests/e2e/script-embed.spec.ts`) mounts the frame with only its challenge and forwards no host parameter, and `/embed.js` accepts no option but `flow`. |
| `SURFACE-001` | Pencil job registry | target | missing |  | No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented. |
| `SURFACE-002` | Pencil records and changes | target | missing |  | No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented. |
| `SURFACE-003` | Draft, exposure and authority classes | target | missing |  | No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented. |
| `SURFACE-004` | Payment, decisions and running forms | target | missing |  | No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented. |
| `SURFACE-005` | Study-to-action specialist week | target | missing |  | No Pencil MCP registry, class fixtures or two-policy conformance journey is implemented. |
