# Pencil operating details

The field names, formats, adapter identifiers and door spellings below preserve the contract’s technical requirements. Capability outcomes remain in CONTRACT.md.

## HOME-001

By the owner's 12 October 2026 decision, `/` serves Base's shared Lobby when no public landing flow is selected (Finish setup until the owner confirms first-run setup, then Sign in; `GET /setup/state` answers the same claim state), and `/pencil` redirects to `/`. An explicitly selected open published flow keeps its canonical respondent experience and admission checks at `/`. A later closed flow shows the standard closed page; an archived or missing flow returns 404, just as its direct link does. Business branding follows BRAND-001. The optional default-off static `Powered by Pencil · runeditrun.com` credit remains available. A selected respondent landing contains no vendor marketing, pricing, invented metrics, testimonials, or third-party requests.



## SITE-001

The run site's `/` (run-pencil.com, written by `rer build --site`) renders Pencil's own product page for people evaluating the software: what Pencil does, its Run Pencil action to `/run`, and links to the source repository and the documentation.  The installed `/` is governed by HOME-001. The product page links no installed-instance route and makes claims only about delivered clauses: no invented metrics, customers, testimonials or pricing.



## SITE-002

The product page's first screen demonstrates an answer path: choosing an answer on the illustrated card shows the follow-up question that answer leads to, works by keyboard, announces the change to assistive technology, and respects reduced motion. Without JavaScript the card shows one complete question, answer and follow-up.



## DOCS-001

`/docs` and `/docs/<slug>` render the product documentation from Markdown in this repository at build time, with navigation, an on-page table of contents and previous/next links. Unknown slugs return 404.  The analysis guide states that withheld themes affect the analysis view, Results crosstabs use the same small-cell threshold, and answer summaries, the ledger and exports are unchanged.



## SHELL-001

 A valid session receives labeled, keyboard-operable navigation to the implemented operator surfaces; the public respondent experience is never an operator navigation destination. `/signin` remains sessionless and is the only entry point to the operator session flow, so an unauthenticated request never receives the operator shell as a fallback.



## OPER-001

Every operator can see and act on every flow, audience, response, analysis, and action. There are no roles.



## OPER-002

Operators are invited and removed in settings. Any operator may invite another and may remove any other operator, except that the setup operator can be removed only by themselves and the last operator cannot be removed. There are no roles (OPER-001), so there is no seam that narrows who may do this.



## OPER-003

`BASE-ACCESS-001` magic links are delivered through `mail.sender.v1`, so mail is a required external, not an optional one: startup fails under WS-003 naming the missing variable when `MAIL_PROVIDER`, `MAIL_API_KEY`, or `MAIL_FROM` is absent. No deployment starts in a state where no operator can sign in.



## WS-001

Settings hold one IANA time zone for the workspace. First-run setup offers the browser's IANA time zone as an editable default; existing configured workspaces retain their saved zone. Every deadline, sending window, digest send time, and operator-facing date and time is evaluated and displayed in it. A revision records the zone in force when its deadline was set, so changing the workspace zone later cannot move a deadline on an open revision.



## WS-002

Settings hold a daily sending window in the WS-001 zone, defaulting to 09:00–17:00 every day. Scheduled mail — reminders and digests — that falls due outside the window is held and sent when the window next opens; nothing is dropped for falling outside it. Mail an operator triggers directly, and every magic link, is sent immediately regardless of the window.



## WS-003

*Supersedes `BASE-SECRET-002`.* Pencil starts only when every variable marked required in `seed.json → env` is present, and fails at startup naming the first missing one. `ai.provider.v1` and `task.destination.v1` are declared optional: with either absent the deployment starts and serves, every clause that does not name that adapter holds in full, and each feature offered by the implemented profile that does name it is shown as unavailable alongside page-local connection setup, with deployment variables retained as an alternative. Features deferred by the declared contract profile are omitted from the interface until implemented. No feature silently produces a reduced result instead.



## BRAND-001

*Supersedes `BASE-INPUT-003` for business logos only.* Operators save the business name, one supporting line, an accent in #rrggbb format, and an optional PNG, JPEG or WebP logo within `seed.json → limits.brand`. A fresh workspace asks its owner for the business name at `/setup` and uses neutral defaults until saved. The same saved brand appears in preview, direct and embedded forms, completion and closed states, the selected public landing, and new-response email. Email includes the saved name and supporting line as literal text and escaped HTML, the saved accent, and any validated logo as inline CID bytes with no remote resources; removing the logo affects the next dispatch run. The accent's button text has at least 4.5:1 contrast; a readable foreground is selected for other accent text. Logo removal takes effect everywhere. Authenticated server uploads check size, declared MIME and content signatures, refusing SVG. Logos are served from this installation with the validated Content-Type and nosniff, with no third-party request. This clause supersedes BASE-INPUT-003 for business logos only: their bytes live in D1 and are deliberately public inline images, included in deployment exports, rather than private R2 downloads. Business identity is independent of Pencil's operator authentication branding.



## DASH-001

A fresh deployment has no sample flows or responses. A workspace with no flows shows an empty state that explains Ask → Signal → Act. The empty dashboard and New flow offer Customer feedback, NPS and Contact/lead templates alongside a blank flow. Templates create ordinary editable drafts and can be duplicated under FLOW-011. Synthetic sample data is an explicit local development option.



## DASH-002

Operators can list flows by draft, open, closed, or archived state, sorted by last activity, with completed-response count, audience, and analysis status visible. An invited flow also shows completions divided by launched participants not bounced or opted out; zero eligible participants shows `0 / 0` with no percentage. An anonymous public flow shows starts and completions without inventing a target denominator.



## FLOW-001

A new flow is draft; publishing makes it open; an open flow can close; a closed flow can reopen the same published revision only after no deadline or target condition remains satisfied, or it can archive; a draft can archive; and an archived flow cannot reopen. Draft public URLs return 404, closed revisions show the standard closed page, and archived public URLs return 404. Archiving removes the flow from default operator views without deleting its revisions, responses, analyses, or actions.



## FLOW-002

A draft contains an ordered list of steps: at most one welcome screen, which is optional and can only be first; one or more questions; and one or more named completion screens. Operators can add, edit, duplicate, reorder, and delete them.



## FLOW-003

A question is short text, long text, email, single choice, multiple choice, rating, priority, dropdown, yes/no, NPS, number, date, or consent; it has a prompt, optional why-we-ask text, required flag, and applicable editable type-specific options within the limits in `seed.json`. The builder canvas uses the same respondent controls.



## FLOW-004

A field-valid builder write includes the draft version it read and may leave the graph incomplete until publication. One Save per step acknowledges a single version-checked transaction containing its content, choices and answer paths. Invalid writes change none of those fields. A current-version edit is persisted before the builder shows it as saved; a stale edit is rejected with the latest version and cannot overwrite another operator's edit. Leaving or reloading after the saved indicator cannot lose the accepted edit.



## FLOW-005

A single-choice or dropdown answer can match equality against a stable choice ID; yes/no and consent answers can match boolean equality; rating, priority, NPS, number and calendar-date answers can match equality or ordered comparison; and a multiple-choice answer can match any or all selected stable choice IDs. Priority equality compares the complete ordering and ordered comparisons use a choice's rank. Preview shows the ordered rule evaluations and chosen next step used by the published runtime, using the same predicates. *Policy: `flow.branch-selection.v1`; default: first matching rule in displayed order, then the required default path.*



## FLOW-006

Publishing runs every FLOW-012 through FLOW-014 validation and is rejected with all offending stable step IDs and reasons; rejection creates no revision and leaves the draft editable. This clause inherits PAY-001: publishing refuses misplaced PAY-001 payment steps by step ID.



## FLOW-007

Preview runs the current draft with test answers, identifies itself as preview, sends no invitations or external effects, and never creates a response or changes result counts.



## FLOW-008

Publishing creates an immutable numbered revision and makes it the current revision resolved by the flow's canonical direct and embed URL. Every invitation, first-interaction session permitted by RESP-013, completed response, analysis, and export records the revision it used; merely loading the page creates no session or visitor record. The only load-time recording is RSLT-013’s anonymous aggregate counter increment, with no identifier or cookie and no link to a response.



## FLOW-009

Editing an open flow changes a new draft only. Existing invitations and first-interaction sessions stay pinned to their recorded revision; publishing the draft affects only later direct or embedded sessions and later invitation launches.



## FLOW-010

An operator may close a flow immediately or configure a revision-specific deadline or completed-response target. A deadline is an instant in the WS-001 zone recorded with that revision. A manual flow close closes every revision's admission; a deadline or target closes only that revision's admission atomically.



## FLOW-011

Duplicating a flow creates an unlinked draft containing its latest draft or published structure and settings, but no audience members, invitations, responses, analyses, actions, delivery history, or external IDs.



## FLOW-012

Every branch predicate references an existing structured question and stable choice when applicable, and every branch destination references an existing question or completion screen.



## FLOW-013

The flow's first step is its welcome screen or its first question, every step is reachable from it on at least one path, and every possible path reaches one completion screen without a cycle.



## FLOW-014

Every question has a non-empty prompt within the text limit, every structured question has valid distinct options within its type limits, and the flow contains at least one question.



## FLOW-015

A step and each of its choices receive stable IDs when created; editing, reordering, publishing, exporting, and importing preserve them, while duplication creates new IDs. Operators enter choice labels; answer values are generated from them, remain unchanged when a saved label is renamed, and can be edited under Advanced.



## FLOW-016

A published revision stores the evaluated configuration for `flow.branch-selection.v1`, `response.identity.v1`, and `flow.response-admission.v1`; later policy changes affect only a newly published revision.



## FLOW-017

A new direct or embedded visit starts the current revision; an invitation starts its recorded revision; and a returning first-interaction session resumes its recorded revision. A superseded revision cannot start a new anonymous session and remains reachable only through an existing invitation or session until its admission closes.



## FLOW-018

Deadline and target admission checks use completed responses for that revision only. Reaching either condition cannot close another revision, while manual close and archive close all revisions.



## FLOW-019

A stored answer is exactly one of: for short text and long text, a string within that type's character limit in `seed.json → limits`; for email, a syntactically valid address stored as the respondent typed it and compared case-insensitively; for single choice and dropdown without Other selected, one stable choice ID belonging to that question; for multiple choice without Other selected, a set of distinct stable choice IDs belonging to that question, within its configured minimum and maximum selections, except that the configured None option alone satisfies the minimum; when Other is selected on any of these types, exactly `{choiceIds: string[], otherText: string}`, with distinct IDs belonging to the question and including its configured Other ID, exactly one ID for single choice or dropdown, and non-blank Other text within the short-text limit and configured FIELD-013 validation. None cannot be combined with another choice or an Other-answer object, and Other text without the Other selection is invalid; for rating, an integer within the question's configured scale; for priority, a complete ordering of that question's stable choice IDs with no repetition and no omission; for yes/no, a boolean; for NPS, an integer from 0 through 10; for number, a finite number within optional minimum, maximum and decimal precision; for date, a true calendar YYYY-MM-DD value within optional earliest/latest bounds without timezone conversion; for consent, `{accepted: boolean, statement: string}` retaining the immutable published statement, with required consent accepting only true. For FIELD-003 score and FIELD-004 contact questions, the stored values are the typed, normalized values those clauses define. Nothing else is a valid answer.



## FLOW-020

A required question blocks progress only on a path that reaches it. A question that the respondent's answers route around is never asked, never recorded as unanswered or missing, and never blocks final submission; publish validation does not require a required question to appear on every path.



## FLOW-021

Deleting a step in a draft changes only that draft. Answers already collected keep their stable step ID and the revision that asked them, stay in the ledger, results, exports, and existing analyses, and are never rewritten or removed by a later publication. A question first added in a later revision is never reported as unanswered by responses to an earlier revision that did not contain it.



## LOGIC-005

A flow may choose its completion screen, or redirect to an HTTPS URL on an approved origin with declared values appended, chosen by LOGIC-006 rules over answers, hidden fields, calculations or scores.

a browser journey takes two paths and lands on two different completion targets, one chosen by a compound AND rule over an answer and a hidden field; a redirect to an unapproved origin is refused at publish.

## A11Y-001

The shared accessibility duty applies to every respondent question type and all one-question, classic-page and question-group layouts, including welcome, completion, closed and unavailable-resume states. Each later type or layout extends the same respondent journey before shipping.

Complete every shipped question type and layout, including errors and state changes, through the shared Base accessibility journey at 1440 and 390.

## FIELD-006

An operator may randomize the order of a question's choices (keeping FIELD-010's Other and None of the above anchored last) or of a block of questions; the order each respondent saw is stored with the response and exported, so order effects can be analyzed.

a Worker test collects 200 responses and asserts every permutation stored is valid, Other and None of the above are last in every one, and the presented order is in the export.

## AUD-001

Operators can create, edit, import, and delete contacts with name, email, and custom fields. Email addresses compare case-insensitively and an import reports, rather than silently duplicating, matching contacts.



## AUD-002

A segment filters contacts by stored fields. Launching invitations records the participant set plus evaluated `flow.audience-eligibility.v1` and `flow.reminder-schedule.v1` configuration, so later contact, segment, or policy changes do not rewrite the launch; AUD-006 still enforces current hard consent and existence checks at send time.



## AUD-003

Each invited contact becomes one participant with an opaque invitation token, independent queued/sent/bounced/failed delivery status, eligible/opted-out consent status, and not-started/started/completed response status. Delivery attempts are append-only, and names, emails, and other contact values never appear in the public URL.



## AUD-004

Invitations are created only for contacts allowed by the audience policy; that policy may narrow but never admit a missing-email or opted-out contact. *Policy: `flow.audience-eligibility.v1`; default: also exclude contacts already invited to that published revision.*



## AUD-005

Repeating the same audience-launch command for one revision returns the original launch and cannot create duplicate participants, invitation jobs, or delivery attempts.



## AUD-006

Immediately before each invitation or reminder, Pencil verifies that the contact still exists and has not opted out. Mail uses the participant email snapshot displayed and recorded at launch; editing the contact later never silently reroutes an active participant.



## DIST-001

Every open revision has a canonical direct link that renders the respondent experience without an operator session.



## DIST-002

One asynchronous script or HTTPS iframe embeds the same respondent experience. It does not block the host page, and direct and embedded submissions produce the same response data and validation. Script embeds use an asynchronously loaded installation-origin script that mounts a sandboxed iframe without allow-same-origin, resizes to its content and emits only loaded, height, completed and checkout events. Exact allowed host origin, exact frame source, opaque child origin, challenge and field shape are checked. No answers, response identifiers, credentials or contact details enter the host URL, DOM or messages. The plain iframe option remains available. The checkout message carries only the HTTPS Checkout URL on a Stripe-owned origin and the session ID, with no payer data. It is posted to the exact owner-configured embedding origin, never `*`; the host must be on the form's allowed-origin list or no checkout event is sent and the respondent gets the same-tab fallback. There is one handoff per payment attempt. No other new host event is permitted without ct's ruling.



## DIST-003

An operator can send an invitation to eligible participants. Each message names the business and flow, contains that participant's opaque link, and records a durable delivery attempt before calling `mail.sender.v1`.



## DIST-004

Reminders are sent only to sent participants who have not completed, opted out, bounced, or reached a closed or archived flow. Completion cancels pending reminders. *Policy: `flow.reminder-schedule.v1`; default: one reminder 2 days after the invitation, released within the WS-002 sending hours.*



## DIST-005

Every invitation and reminder includes an opt-out link. Opting out prevents future flow mail to that contact regardless of policy. Renewed consent records its actor, time, and source before mail can resume; opt-out does not delete an existing response.



## DIST-006

A transient `mail.sender.v1` failure is retried at most 5 times over 1 hour using the original delivery idempotency key.



## DIST-007

Mail cannot be unconfigured (OPER-003). A failing `mail.sender.v1` disables invitations, reminders, notification mail, and new magic-link sign-ins with a named error visible to operators, while existing operator sessions, direct links, embeds, response collection, results, the ledger, and exports keep working. Recovery is restoring the sender; Pencil offers no password or bypass sign-in.



## DIST-008

A permanent mail failure or exhausted retry is marked failed with the provider reason and retry action visible to operators; no invitation is recorded as sent merely because it was queued.



## DIST-009

The embed rejects a host origin not allowed by BASE-PUBLIC-002 before rendering the flow. It exposes no answer, response ID, participant token, or contact value to the host URL, DOM, or `postMessage`; host communication is limited to non-identifying loaded, height, completed and checkout events. The checkout message carries only the HTTPS Checkout URL on a Stripe-owned origin and the session ID, with no payer data. It is posted to the exact owner-configured embedding origin, never `*`; the host must be on the form's allowed-origin list or no checkout event is sent and the respondent gets the same-tab fallback. There is one handoff per payment attempt. No other new host event is permitted without ct's ruling.



## DIST-010

`mail.sender.v1` implements send-or-get by delivery idempotency key when its provider supports lookup. An ambiguous timeout without lookup is marked unknown and is not automatically retried; an operator may reconcile or explicitly resend it with the duplicate-delivery risk shown.



## DIST-012

Every public collector, including each named collector and the default direct and embed links, has its own public URL and a downloadable QR code (SVG and PNG) carrying its source label. Invitation, imported and unknown system-source buckets are historical attribution, not public collectors: they have no public collection URL, receive no QR code, and retain their existing identity semantics; kiosk mode restarts the form after completion on a shared device, clears all answers from the browser after a configurable idle time, and never shows the previous respondent's answers.

a browser journey checks the public URL and SVG/PNG QR downloads for each named public collector and the default direct and embed links, scans each QR to collect a response with the matching source, and verifies that invitation, imported and unknown system-source buckets offer neither a public collection URL nor a QR download and retain their identity semantics; it completes a kiosk form twice and proves the second session starts empty and the first response's source is the kiosk collector, then waits through the configured idle time and verifies that all browser answers are cleared and the previous respondent's answers are never shown.

## DIST-019

A form can require a password, a verified email in an allowed domain or list (by one-time code, one response per verified email), or a signed link from the business's own app; the restriction is checked on the server before the first step renders and is stated in RESP-005's disclosure when it makes the response identified.

a browser journey is refused without the password, verifies an allowed-domain email by code and completes once, and a second completion by the same email is refused.

## RESP-001

A respondent sees one welcome or completion screen at a time. Questions use the flow's selected layout: one question per screen; classic pages (FIELD-008), with several questions per page, shared LOGIC-006 page conditions, validation of visible questions only and progress by page; or question groups (FIELD-012), with several questions under one heading on one screen, individual required flags and validation, and progress counting each grouped question. No layout exposes builder or operator controls. One-question screens, classic pages (FIELD-008) and grouped questions ship. FIELD-012 remains partial for optional group media (FIELD-005) and statement blocks (FIELD-011).



## RESP-002

The page shows the respondent's current position and remaining reachable questions for the answers already given; classic layouts under FIELD-008 show the current page and remaining reachable pages instead. Branching can change that count, and skipped or unreachable questions are never counted.



## RESP-003

The respondent can submit only the values FLOW-019 defines for the published question's type and configured limits. Every question begins unanswered. False yes/no answers and zero scores or numbers count only after explicit selection or entry. Rating, priority, and choice questions begin unselected and require affirmative respondent selection. Required fields show Required and expose required semantics; a required unanswered or invalid question stays on screen with a field-specific error and creates no response. Choosing Other makes its text box required even on an otherwise optional question: empty or whitespace-only text shows the field-specific “Please specify your Other answer.” error and cannot create a response. Configured Other-text validation applies in both browser and API, and None is exclusive. In one-question and question-group layouts, progress is the share of currently reachable questions answered validly or deliberately skipped when optional; remaining includes every unfinished reachable question. Classic pages under FIELD-008 count reachable pages, validate only visible questions and do not let a hidden required question block progress. Skipping never creates an answer.



## RESP-004

A respondent can move back through screens already visited in the current session and edit an answer. Pencil recomputes the forward path and progress and discards answers belonging to steps that become unreachable before final validation, export, or analysis.



## RESP-005

Before the first answer, the flow states why feedback is requested, whether the response is anonymous or identified, who can see individual answers, and each configured external and data category declared in `seed.json → externals` that may receive the answers. The policy decides which identity mode applies; it can never suppress or weaken the disclosure of the mode it chose. *Policy: `response.identity.v1`; default: `anonymous-public-link`, with invited responses identified. Publishing a form in identified mode records `identified-public-link` on that revision; declared identifying hidden fields supplied by the public link are typed, link-supplied and unverified, and their values and forwarding implications are disclosed before answering. RESP-023 requires the identifying link to bind one revision and fix those identifying values, with a reasoned refusal on another revision; its partial status records the remaining link-binding work.*



## RESP-006

An anonymous response records no contact link, no participant, no name or email taken from an invitation, contact record, or session, no raw IP address, and no host-page identifier. It receives a random response ID that cannot be reversed to identify the respondent; expiring rate-limit and session state is not linked to that ID. An email or name the respondent knowingly types into a question is stored as that answer and nothing else: it creates no contact and no participant, and RESP-005's disclosure states before the flow starts that answering such a question identifies the respondent to the operator.



## RESP-007

A completed response, all its answers, count change, and durable outbox commands for required downstream effects are committed in one transaction before any effect is dispatched.



## RESP-008

An invitation admits only the completions its recorded admission rule allows. A visit beyond that shows the existing completion state and creates no further response, and no rule can admit a completion after the flow's admission has closed (RESP-009). *Policy: `flow.response-admission.v1`; default: one completion per invitation; anonymous direct links allow multiple independent completions.*



## RESP-009

Final submission rechecks deadline, target, and manual closure in the same admission transaction. A submission that loses the final available place sees the standard closed page naming the business and flow and creates no response.



## RESP-010

Pencil never captures partial answers silently. Unless a respondent explicitly chooses to save a partial response under PART-002, answers from an abandoned or reloaded session are not visible to operators, included in results, exported as responses, or counted as completions. A respondent-chosen save is the explicit exception: it may retain answers only for save and resume, without counting them as a completion or including them in completed results or default response exports. Only final submission creates completed response data; PART-002 stores an explicitly requested save separately and never makes its answers available to operators, completed results, analysis or default response exports.



## RESP-011

After a successful submission the respondent sees the published completion screen and cannot edit the completed response through the public link.



## RESP-012

A submission idempotency key is scoped to one respondent session and published revision and retained with the completed response. Retrying that key returns the same response ID and completion screen and cannot increment counts or dispatch downstream effects twice.



## RESP-013

The first respondent interaction creates an expiring session record containing only an opaque session ID, revision ID, source, start time, the stable ID of the furthest step reached, a device class of mobile, tablet, or desktop, and FIELD-006’s stable choice and block presentation IDs—never answers, contact identity, raw IP, user-agent string, or host identity. It pins the revision and supplies starts, drop-off, device, and completion-time metrics; an abandoned session expires under BASE-DATA-002 after the retention period in `seed.json → limits`.



## RESP-014

A final-submit request that is not durably committed leaves the respondent off the completion screen, preserves current in-browser answers, shows a retryable error, and retries with the original submission idempotency key.



## RESP-015

Every public submission is checked by defenses the deployment owns entirely: a hidden honeypot field, a minimum elapsed time from form load to final submission taken from `seed.json → limits`, a submission token bound to the RESP-013 session, and the public rate limits enforced under BASE-ACCESS-003. Elapsed time uses the signed, non-identifying load timestamp carried by the form and returned with its submission under RSLT-013; it creates no visitor identity or server-side view record. Pencil loads no third-party challenge, script, or reputation service on a public surface, so BASE-PUBLIC-001 continues to hold. A submission whose session token is missing or unrecognized is refused under RESP-014 with a visible, retryable error naming the expired session, never silently discarded. A filled honeypot or a submission under the minimum time is retained with its reason and answers under RESP-016 and RESP-017 for owner review and reversal under RESP-018. Scoring a respondent's trustworthiness beyond these checks is out of scope.



## RESP-016

A submission that fills the honeypot is shown the ordinary completion screen and committed under RESP-007 as an excluded, quarantined response with its honeypot reason and all its answers retained. While excluded it changes no accepted-response count, admission check, result, analysis evidence set, notification or other downstream effect; exclusion and reversal leave anonymous view and start counters unchanged. Response exports omit automatically excluded responses by default. An owner may explicitly choose to include automatically excluded responses (honeypot or minimum-time); each included response is marked with its exclusion reason. An owner can review its reason and answers and reverse a false positive under RESP-018, after which it counts as an ordinary completed response. The exclusion records an audit entry under BASE-OPS-005 naming the defense that fired, the revision, and the time, and containing no answer text or respondent identity. It creates no visitor identity or server-side view record, and is erased under the form's normal retention and DATA-002 erasure rules.

a honeypot hit retains its reason and answers in quarantine, an owner reviews and reverses it and it then counts.
A default export omits automatically excluded responses; an explicit include adds them, each marked with its exclusion reason.

## RESP-017

A submission that fails only the minimum-elapsed-time check, measured from the signed, non-identifying load timestamp under RESP-015, is committed under RESP-007 as an excluded, quarantined response with its minimum-fill-time reason and all its answers retained. While excluded it is omitted from completed-response counts, admission checks, results, analysis evidence sets and notifications. Response exports omit it by default; RESP-016 governs the explicit include option for automated exclusions. An owner can review and reverse a false positive under RESP-018, after which it counts as an ordinary completed response. Exclusion and reversal leave anonymous view and start counters unchanged and create no visitor identity or server-side view record. It is erased under the form's normal retention and DATA-002 erasure rules.



## RESP-018

Operators can list quarantined responses for a revision with their answers and the defense that quarantined them, and can release or delete each one. Releasing makes the response an ordinary completed response from that moment, and every affected count, rate, and results figure is recomputed; deleting follows DATA-002. A release is allowed after the revision's admission has closed, is recorded with its operator and time, and never reopens admission or re-triggers a deadline or target check. Nothing leaves quarantine without an operator acting.



## RESP-019

When a session completes or expires, its start, furthest-reached step ID, device class, and completion outcome are folded into per-revision counters that hold counts only, cannot be traced to a session, response, or respondent, and are retained with the revision after the session record has expired. These counters are the source of every historical starts, drop-off, and device figure; no partial answer is retained with them.



## LEDG-001

Operators can list and open every released completed response with stable response ID, flow revision, source, participant when identified, started and submitted times, and each answer keyed by stable step ID. A quarantined response appears only in the RESP-018 review list until it is released.



## LEDG-002

Completed-response and participant counts are derived from stored participants and completed responses. Starts come only from RESP-013 session records and the RESP-019 counters they fold into; preview sessions, duplicate submissions, failed deliveries, abandoned sessions, dropped submissions, and unreleased quarantined responses never increment completed responses.



## LEDG-003

Operators can filter the ledger by revision, submission time, source, participant status, and structured answer, while preserving the same response IDs shown in exports and evidence.



## LEDG-004

Starting an export fixes its filter and evidence-cutoff time. By default, CSV and JSON contain exactly the matching released responses committed by that cutoff, including response and revision IDs, source, timestamps, stable step IDs and labels, and lossless values for every answer including open text. Quarantined and excluded responses stay out until released, and the export names how many were excluded. An owner may explicitly choose to include automatically excluded responses (honeypot or minimum-time); each included response is marked with its exclusion reason. This RESP-016 option is the only exception: included exclusions obey the same filter and cutoff and remain quarantined, without changing accepted-response counts or downstream effects.

A default export omits automatically excluded responses; an explicit include adds them, each marked with its exclusion reason.

## RSLT-001

Every published revision has a results view that needs no `ai.provider.v1`: question answer summaries appear before session metrics. It shows completed responses, starts, completion rate, and average time to complete for the current combined filter bar (published-revision selector plus the response filters), each beside the counts it was computed from. Imported completions remain in answer summaries and completed counts but are excluded from native starts, completion-rate numerators and duration samples, with the imported count stated separately. It is available from publication, shows zeros rather than an error before the first session, and never blocks on an analysis run. Answer summaries are never suppressed for operators who may read the form's responses and stay complete beside a suppressed RSLT-006 crosstab; in aggregate-only views RSLT-009's rule governs the crosstab, not the summaries.



## RSLT-002

Results show, for each step on the published revision, how many sessions reached it and how many of those reached no later step, computed from RESP-019 counters and therefore still available after the underlying sessions have expired. A step no session reached is shown as reached by zero, not omitted.



## RSLT-003

Every percentage Pencil displays in results or analysis names the numerator and denominator it was computed from. A single-answer distribution divides by the responses that answered that question and its parts sum to that denominator. A multiple-choice distribution divides by the same denominator, may therefore total more than 100%, and is labeled as multiple-select. With a response-only filter active, completion shows started-to-completed among the filtered responses and states that view-based rates are unfiltered; with revision or date only, completion uses views. Imported historical responses are excluded from native starts, completion-rate numerators and duration calculations. Completion is never mixed with a per-question answer rate. Numerator and denominator always come from the same filtered set, which is named; changing a filter changes both together.



## RSLT-004

Results show the device split following the combined filter bar (published-revision selector plus the response filters), with its numerator and denominator named as RSLT-003 requires. A coarse RESP-013 device class is derived at session start and stored on the response at start so it can be filtered: class only, no fingerprint, erased with the response. Revision-wide session counts without that response link do not satisfy the filtered split. Device class never appears in an export of responses. Under RL-104, the coarse class is erased with its response and excluded from response exports. Its single archive exception is the private integrity-checked whole-installation restore archive under DATA-001: restored access uses current authority and preserves erasure fences and honest unknown historical classes.



## RSLT-005

A results view spanning more than one revision reports each question only for the revisions that contained it, using the responses that could have answered it as the denominator. It never treats a question added later as unanswered by earlier responses, and it never merges two questions that have different stable step IDs.



## RSLT-012

Operators can tag open-text answers with workspace codes by hand, accept or reject AI-suggested codes (each suggestion citing the exact excerpt), and chart, filter and crosstab by code; every code assignment records who or what made it. Aggregate-only code crosstabs inherit RSLT-009's aggregate-only disclosure rule and refusal fixture before they ship; today's raw-authorized operator code panel stays complete.

a Worker test codes 20 answers by hand and 20 by accepted suggestion, asserts code counts and filters, and proves rejected suggestions leave no code.

## ANLY-001

An operator can request analysis for any revision with completed responses. A run is queued durably and shows queued, running, completed, insufficient-evidence, or failed status. *Policy: `analysis.autorun.v1`; default: run when a flow closes and has at least 5 completed responses.*



## ANLY-002

An analysis records the exact response IDs and revision it read, and reads only released responses. Responses submitted, or released from quarantine, after it started are excluded and make the completed analysis stale rather than changing it in place.



## ANLY-003

A run that reaches completed status ranks themes and selects one primary finding from its fixed evidence set; an insufficient-evidence run follows ANLY-013 instead.



## ANLY-004

Text presented as a respondent quote is an exact excerpt of a stored answer. Generated paraphrases and summaries are labeled as analysis and never presented in quotation marks or attributed to a respondent.



## ANLY-005

In every analysis view, a theme or filtered segment with fewer included responses than the threshold shows no raw excerpt, participant identity, unique field combination, or breakdown; exactly the threshold is permitted. Suppression changes presentation, not the raw ledger or operator export. *Policy: `analysis.disclosure.v1`; default threshold: 5 completed responses in that theme or current filter cohort.* The same threshold governs crosstab cells (RSLT-006) and aggregate-only views (RSLT-009) under their own rules; an operator's own results summaries, the raw ledger and operator exports stay unsuppressed.



## ANLY-006

A completed analysis with sufficient evidence may propose one primary action with rationale, linked findings, confidence, expected impact, and effort; an insufficient-evidence run proposes none. *Policy: `recommendation.selection.v1`; default: the action supported by the highest-impact finding with sufficient evidence.*



## ANLY-007

A stale analysis remains readable and labeled with its evidence cutoff. Operators can run a new analysis; prior runs remain in history except for the erasure redaction required by DATA-002.



## ANLY-008

If `ai.provider.v1` is unconfigured or fails an analysis or builder-assistance request, the request is marked failed with the error and retry action, no suggestion, finding, or recommendation is fabricated, and flow publishing, response collection, the ledger, and exports continue to work.



## ANLY-009

An operator may request a sharper, broader, or contextual rewrite of a draft question. Suggestions show their source text. Applying a rewrite carries standard; publishing carries external when it exposes the form outside the business. The company’s policy decides whether either agent step runs or waits for an operator.



## ANLY-010

Every AI call records provider, model, input and output usage, feature, analysis or draft ID, and reported cost. Operators can view totals by day and feature.



## ANLY-011

Each displayed theme count, percentage, supporting excerpt, and recommendation records the included response IDs from which it was derived; an operator can navigate from displayed evidence to those retained responses.



## ANLY-012

Before a run completes, Pencil validates its schema, verifies that cited response IDs belong to the run's evidence set, verifies quote ranges exactly against stored answers, and recomputes counts and percentages over that evidence set; any failure marks the run failed.



## ANLY-013

A run whose evidence or disclosure-eligible cohorts cannot support a finding completes as `insufficient-evidence`, shows the evidence cutoff and reason, and emits no theme, quote, or recommendation.



## ANLY-014

Respondent text is treated only as data: it cannot change system instructions or configuration, select tools, call adapters, create jobs, or authorize effects; schema-invalid provider output fails under ANLY-012.



## ANLY-015

Each run stores the evaluated `analysis.disclosure.v1` and `recommendation.selection.v1` configuration; later policy changes affect only a new run and never retroactively reveal or reinterpret historical output. Saved/shared aggregate-only views record the disclosure threshold at save/share and use a threshold never lower than that record under RSLT-009 and ANLY-015; lowering the current policy reveals nothing in those views. This future obligation adds no snapshot machinery to the operator's current-threshold results page.



## ANLY-016

A transient `ai.provider.v1` transport failure is retried at most 3 times over 10 minutes with the same request, evidence set, and policy snapshot; schema or evidence-validation failures are terminal and never retried as transport failures.



## ACT-001

An operator can accept a recommendation as an action with title, rationale, owner, target metric, review date, and links to its analysis and evidence. Accepting does not itself contact an external service.



## ACT-002

A new action is planned. Legal transitions are planned → in progress or closed, in progress → ready for review or closed, ready for review → effective, ineffective, in progress, or closed, and effective or ineffective → closed; every transition records the operator, time, and optional outcome note.



## ACT-003

`task.destination.v1` must implement create-or-get by Pencil's idempotency key and return the existing remote task ID for a repeated key; repeated activation or delivery of one action therefore cannot create more than one external task.



## ACT-004

An unconfigured adapter disables external task creation with setup guidance. A failed call keeps the local action, records the attempt and error, and offers a retry that reuses the same idempotency key.



## ACT-005

An action records a metric name, unit, desired direction, baseline value, source, and observation time. An operator can link a later flow or analysis, record the comparable observed value and time, and mark the outcome effective or ineffective. Pencil never sets or changes that verdict itself, and no extension point can; a review date that has passed is surfaced on the action, never resolved on the operator's behalf.



## ACT-006

Before calling `task.destination.v1`, Pencil shows the action fields and operator-authenticated report link that will leave the deployment and sends only those confirmed values; raw answers and excerpts are never included.



## ACT-007

External task delivery records pending, confirmed, unknown, or failed status, the idempotency key, every attempt, and the remote task ID when confirmed. An unknown network outcome is retried with the same key rather than assumed failed or sent again with a new key.



## ACT-008

An operator may write a recommendation by hand and accept it as an action under ACT-001, linked to the results evidence it rests on: a flow, a published revision and optionally one question, with the RSLT counts shown at that moment kept as they were, never response identifiers, answer excerpts or cohort filters. An action written by hand has no analysis link. The analysis link of ACT-001 is required for every action accepted from an analysis; nothing else in ACT-001 to ACT-007 is relaxed.



## NOTIFY-001

The in-app notification center records one notification for the requesting operator when an analysis completes or fails; an automatic close-time analysis records one for every unmuted operator. Duplicate queue delivery cannot create the same notification twice.



## NOTIFY-002

Each operator sets, per flow, whether completed responses are mailed to them immediately, grouped daily under NOTIFY-003, or not mailed. Publication starts its publisher on Immediately only when no preference exists; every other operator defaults Off. Existing unrepublished flows default Off. A message uses the saved business identity under BRAND-001, names the flow and submission time in the workspace zone, and links to the authenticated results ledger; it never carries answer text, respondent identity, or a link that grants access without signing in. A committed, released response queues one delivery per opted-in operator, with durable attempts, bounded retries and explicit unknown-outcome confirmation. Daily uses NOTIFY-003 and keeps its recipient snapshot separate from immediate mail. This clause inherits PAY-001: on payment forms it waits for PAY-001 payment.



## NOTIFY-003

A digest is one message per operator per flow per day, sent at the WS-002 window's opening hour in the WS-001 zone, covering the completed responses committed since the previous digest. A day with no new completed responses sends no message, and a digest that fails to send is retried under DIST-006 rather than merging into the next day's. This clause inherits PAY-001: on payment forms it waits for PAY-001 payment.



## NOTIFY-004

Every notification, digest, invitation, and reminder is sent from the configured no-reply address (RER's assigned verified sender on Managed hosting) and marked auto-generated. Pencil ingests no inbound mail, so a reply or vacation auto-responder can never create a response, participant, notification, or further outbound mail. A bounce of operator notification or digest mail is recorded against that operator's mail setting only and never marks a participant bounced; participant bounce status comes only from invitation and reminder delivery (DIST-008).



## DATA-001

The deployment export contains every operator, contact, segment, flow and revision, step and branch, participant and delivery attempt, response and answer including quarantined ones with their state, RESP-019 revision counters, analysis and evidence link, recommendation, action, notification, setting, audit entry, and referenced file as original data. Import preserves Pencil's stable graph, revision, response, evidence, recommendation, and action linkages.



## DATA-002

Deleting a response, or a contact that owns it, revokes and deletes active invitation tokens, removes contact links or anonymizes retained delivery facts, and removes its answers, raw excerpts, and evidence links from every analysis within 5 minutes. Affected aggregates are recomputed or marked unavailable, affected analyses are labeled redacted and stale, and only the anonymized audit tombstone required by BASE-DATA-003 remains.



## GOV-003

*Supersedes `BASE-DATA-002` only for a form whose owner explicitly opts into a retention schedule; all other forms keep the baseline.* Each form can set a retention period after which responses, partials, uploads, signatures and payment references are deleted under DATA-002 (aggregates recomputed, analyses redacted and stale), with an advance in-app notice to Admins and a legal-hold switch that pauses all automatic deletion. Until ROLE-001 supplies Admins, the installation owner manages this setting and receives its notices. Completion covers every existing response class: released and quarantined completions and private PART-002 saves. FILE-001 uploads, SIGN-001 signatures, PAY-001 payment references and PART-001 partial capture must inherit these retention and hold rules before they ship. A period is a whole number of elapsed 24-hour days from completion, or from a private save's creation; private saves also retain their original link expiry. Every scheduled deletion has at least seven days of in-app notice, including data already older than a newly enabled period. Legal hold also pauses PART-002's automatic save-data expiry, without reviving an expired resume link. Releasing hold starts a fresh seven-day notice window. Manual DATA-002 erasure remains available.

a Worker test sets 30-day retention, advances a fake clock and asserts advance notice then deletion with DATA-002 effects; a form on legal hold keeps its released, quarantined and private saved responses past expiry, and release provides a new notice window before deletion.
It also proves owner-only settings, stale-write refusal and imported-response custody erasure; desktop and phone browser journeys configure the period, inspect notice and activate/release hold.

## IMPORT-001

Operators can import a documented form-definition JSON into a new editable draft with new stable IDs. Every field, screen and logic action is listed before writes with source type, imported/changed/unsupported outcome, explicit change and reason. Unsupported logic leaves affected paths incomplete; native graph validation still controls publication.



## IMPORT-002

Operators can map every response CSV column to a supported question, timestamp or Skip. Every row error is reported. Blank answers stay unanswered; malformed values and configured capacity excess are refused before commit. Commit requires acknowledgment of every reported change or omission; canceling review creates no job, flow or response. Acknowledgment first stores owner-private, indexed preparation with bounded database transport. Continue import verifies its complete stored fingerprint before any public job, form or response is published. Interrupted preparation remains private and can be retried or canceled under current authority; erasure removes retained copies and prevents publication or resurrection.



## IMPORT-003

Imported released completions retain their original timestamps and remain anonymous, with source imported and an immutable revision matching the mapped source. Hidden values and network/IP metadata are discarded before durable planning; original file bytes are not retained, and this omission is disclosed before commit. Imported data creates no session, contact, mail, outbox event or admission effect. Later draft edits cannot reinterpret historical answers.



## IMPORT-004

The unchanged Base D1 import kit owns reviewed commit, source identity, bounded resume and undo. Identical files create no duplicate native records; interruption resumes the exact stored safe plan. Undo removes unedited imported data while exact native snapshot guards preserve and report later edits. Completed reversal is idempotent; retained safe plan and provenance survive. Published work resumes and undoes from durable custody without the original files.



## ROLE-001

Each operator holds one role: Owner, Admin, Editor, Analyst or Viewer. Owners and Admins manage operators, installation settings, connections and retention; Editors build, publish and distribute the forms they can access; Analysts read results, run analysis and create actions but cannot edit or publish; Viewers read reports only. Every API route and page checks the role on the server; a refused request names the missing permission and writes nothing. On activation this replaces OPER-001 and the no-roles sentence of OPER-002; the last Owner cannot be removed or demoted. This clause inherits TMPL-002's Admin-only team-template retirement; only Owners and Admins may retire templates. For roles without form-response access, this clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker suite signs in as each role and calls every operator route family (flows, publish, audience, responses, export, analysis, actions, settings, connections), asserting allowed and refused outcomes from one role matrix; a browser journey shows an Analyst the results but no Publish control.
The role matrix includes template retirement, refusing Editors, Analysts and Viewers without changing the template.
For roles without form-response access, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.
A Viewer gets the aggregate-only form and is refused the ledger and export.

## ROLE-002

Forms live in folders; an Admin can restrict a folder or form to named operators, and an operator sees, searches, exports and receives notifications only for forms they can access. Access to respondent identity (identified participants, typed email and phone answers, uploads, signatures, payment details) is a separate grant; without it the ledger, exports and integrations show those values masked. This clause inherits LEDG-006: ledger search matches identity values (identified names and emails, typed email and phone answers) only for operators with the identity grant. For grants without form-response access, this clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker test restricts a form to one Editor and proves a second Editor gets 404 from its page, results, export and API, and an operator without the identity grant receives masked values in the ledger and CSV.
The acceptance also proves: search by an identified email and a typed phone answer returns the response only for an operator with the identity grant.
For grants without form-response access, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.
A Viewer gets the aggregate-only form and is refused the ledger and export.

## ROLE-003

Owners can require SAML 2.0 or OpenID Connect sign-in through the business identity provider (Okta, Microsoft Entra ID, Google Workspace, JumpCloud or the sibling Auth), map IdP groups to ROLE-001 roles, and accept SCIM 2.0 provisioning so a deprovisioned user loses every session within one minute. Magic-link sign-in remains the break-glass path for Owners only when SSO is enforced.

a Worker test signs in through a test OIDC provider and a signed SAML assertion, maps a group to Analyst, then a SCIM `active:false` PATCH revokes the session and the next request is refused.

## ROLE-004

Operators with edit access can leave comments on a draft step, mention another operator (who receives an in-app notification), resolve the thread, and see who last saved each step. Concurrent edits stay safe under FLOW-004's version check.

a browser journey has two operators comment and resolve on one step; a stale save by the second is refused with the latest version shown.

## BRAND-002

An Editor keeps a library of named themes (for example one per campaign or client) and chooses one per form; a new form uses the workspace default theme, which starts from BRAND-001's accent and logo. A theme sets: a question font and an answer-and-button font, chosen from a bundled set of open-licensed families or an uploaded WOFF2 the owner is licensed to use (size- and signature-checked like BRAND-001 logos), always served from this installation so BASE-PUBLIC-001 holds; separate #rrggbb colors for questions, answers, buttons, button text and background; a background color or a PNG, JPEG or WebP background image with brightness from −100 to 100 and a focal point; corner style; and, per welcome, question and completion screen, an image or video layout (above the question, beside it on the left or right, or behind it as a full-bleed backdrop) with its own phone layout. The theme applies to preview, direct, embedded, popup and kiosk forms and their completion and closed states, and RESP-020 and NOTIFY-006 emails take its colors. Every text and background pair, measured against the background color and against the background image at its brightness, must reach A11Y-001's 4.5:1 (3:1 for large text, focus indicators and button borders); A11Y-002 refuses publish and names the failing pair and screen. A published revision snapshots its theme under FLOW-008, so editing a theme lists the forms that use it and changes each one only at its next publish. Themes are duplicated, renamed and deleted (deletion is refused while a draft or published form uses the theme), and are carried in deployment exports. This clause inherits TMPL-002: a saved team template retains its chosen per-form theme, and a new form made from it uses that theme.

a browser journey publishes two forms on two themes and asserts, at phone and desktop widths, that each renders its own computed font families, question, answer, button and background colors, background image and brightness, and screen layout, and that every request the respondent page makes is to the installation origin; a Worker test refuses publish of a theme whose button text is 2:1 against the button and names that pair; editing a theme leaves a published form's revision unchanged until it is republished.
The journey also saves a themed form as a team template and proves a new form from it keeps that theme.

## TMPL-001

New form offers a searchable gallery of at least 60 US-business templates in named categories: customer feedback, NPS, CSAT, CES, product research, employee engagement and eNPS, event registration, contact and lead capture, order and payment forms, job applications, client intake, W-9 and vendor onboarding, quizzes, and patient intake for HIPAA mode (GOV-001). Each template previews in the respondent experience, passes FLOW-006 publish validation, and creates an ordinary editable draft; templates that use payment, upload or signature fields show what connection they need before creation.

a Worker test creates and publishes every gallery template with no validation error; a browser journey searches the gallery, previews one with branching, creates it and collects a response.

## TMPL-002

An Editor can save any draft or published form as a workspace template with its structure, logic, branding choice and question settings but no revision publication deadlines or response targets, responses, audience, connections' credentials or external IDs; Admins can retire one. Until per-form themes ship, new forms use the workspace brand; BRAND-002 inherits carrying a template's per-form theme into each new form. Until ROLE-001 ships, the owner acts for Admin under the current equal-operator authority; ROLE-001 inherits Admin-only template retirement.

a Worker test saves a form with logic as a template, creates a new form from it and proves new stable IDs, identical logic and no copied responses or credentials.

## AI-001

An operator describes the goal in words, or pastes or uploads a document (Word, PDF, Google Doc export, an existing paper form or a SurveyMonkey/Typeform question list), and the configured `ai.provider.v1` drafts a form: question types, choices, required flags, branching, hidden fields and a completion screen. The draft opens in the builder with each generated step marked, passes FLOW-012 to FLOW-014 before it can be published, and its agent publication, distribution and connection calls carry external and, for connection credentials, security or gated as the provider step requires; the company’s policy decides each step. Uploaded source documents are used for this request only and are not retained.

a Worker test with the AI receiver fixture turns a prompt and a two-page PDF into drafts whose graph validates; schema-invalid provider output fails under ANLY-012 rules with no draft written; a browser journey edits and publishes the generated draft.

## FIELD-001

An operator declares named hidden fields (for example `utm_source`, `plan`, `order_id`) with a type and whether each is identifying. Values arrive from the link's query string, an embed's fixed `data-pencil-<field>` attributes, the landing page a script embed sits on (its URL parameters, a `hidden` call or its `_ga` cookie, under DIST-021), the in-product SDK (DIST-015) or an invitation, are validated against the declared type, are stored with the response, appear in the ledger, filters, crosstabs (RSLT-006), exports and integrations (INTEG-001 to INTEG-011, INTEG-015 and INTEG-017), and can drive recall (LOGIC-001) and every LOGIC-006 condition (branching, completion, page show/hide, alerts and email rules); a declared field absent from the link is blank, never an error. Undeclared parameters are discarded. Each field is declared as campaign (for example `utm_*`), click ID (`fbclid`, `gclid`, `gbraid`, `wbraid`, `ga_client_id`, used only by INTEG-017), identifying, or plain. Completion also depends on DIST-021 (script-supplied fields), DIST-015 (SDK), DIST-003 (invitation-supplied values), the named INTEG consumers, LOGIC-005 (completion redirects), NOTIFY-005 (alerts) and NOTIFY-006 (answer-bearing email); naming these consumers does not claim they ship. An identifying hidden field makes the response identified and RESP-005's disclosure says so before the first answer; it is accepted on public links and embeds only when the form is in RESP-023's identified mode, and an anonymous flow refuses identifying parameters. In aggregate-only views, identifying hidden fields are neither crossed nor summarised under RSLT-009.

a browser journey opens a link with declared and undeclared parameters, is routed by a LOGIC-006 rule on one, is routed by an `is blank` rule when the link omits it, and the CSV export carries only the declared values; a Worker test proves an identifying parameter on an anonymous revision is refused at publish and accepted on an identified one (RESP-023); DIST-021's embedded journey stores forwarded, fixed and `hidden` values under the same declared-field filter.

## FIELD-002

A matrix question asks several rows on one shared scale (single- or multi-select per row, or a 5- or 7-point Likert), each row with a stable ID; results show a per-row distribution with RSLT-003 denominators, and any LOGIC-006 condition can test any row. This clause inherits RSLT-006: each matrix row is a crosstab dimension keyed by its stable row ID, with the same stated shares, chi-square rule and ANLY-005 suppression.

a Worker test publishes a 4×5 matrix, collects responses, and asserts per-row counts and an export column per row keyed by stable row ID, and crosses one row against another under RSLT-006.

## FIELD-003

CSAT (1–5 satisfaction), CES (1–7 effort) and emoji or thumbs ratings are typed questions with fixed semantics, with native fixed-score calculations available independently of program setup (PROG-001): CSAT as the share of 4–5 answers, CES as the mean, both with stated denominators.

a Worker test collects each type and asserts the computed CSAT percentage and CES mean against hand-computed values.
The same native-route journey verifies emoji and thumbs distributions and normalized exports; PROG-001 acceptance separately proves program setup.

## FIELD-004

Phone (stored E.164, displayed in US format, extension allowed), postal address (street, unit, city, two-letter state, five- or nine-digit ZIP, with non-US country as an option), full name split into parts, URL and currency amount in USD are typed questions with validation and formatted export columns. No third-party autocomplete script is loaded on the respondent page (BASE-PUBLIC-001).

a browser journey enters valid and invalid US phone, ZIP and state values and sees field-specific errors; the export carries normalized columns.
The native-route check also rejects invalid names, URLs and fractional cents, retains an international number and address, keeps the phone extension separate, and checks normalized and display columns in CSV and JSON.

## FIELD-005

Steps may carry an image with required alt text or a video from an approved host (YouTube or Vimeo via a privacy-enhanced embed only after the respondent clicks to play), and choices may be images with labels.

a browser journey builds an image-choice question, publish is refused while alt text is empty, and the respondent page makes no third-party request until play is pressed.

## FIELD-007

A scheduling step hands the respondent to the business's booking page in the sibling Dial, Calendly or Google Calendar appointment schedules, passing name and email only when the respondent typed them and the disclosure names the destination; the booked time returned by the provider's webhook is stored with the response. Pencil does not run availability or calendars itself.

a Worker test with a Dial/Calendly receiver fixture completes a booking handoff and stores the confirmed time on the response; an anonymous flow passes nothing.

## FIELD-008

Besides one question at a time (RESP-001), a flow may use pages that show several questions together with conditional show/hide inside the page (written as LOGIC-006 conditions on earlier answers, including answers on the same page), the layout Jotform and Google Forms buyers use. Branching and required-on-path (FLOW-020) apply per page. Validation checks only visible questions, so hidden required questions never block navigation or submission; progress (RESP-002, RESP-003) counts reachable pages. RESP-001 names this layout alongside one question per screen and question groups.

a browser journey builds a three-page classic form with in-page conditional questions, and a hidden required question never blocks navigation or submission, only visible questions are validated, and progress counts reachable pages.

## FIELD-009

A question may accept a recorded video or audio answer (up to an operator-set length) captured in the browser with explicit camera or microphone permission, stored like an upload (FILE-001), transcribed by `ai.provider.v1` when configured, and analyzed through its transcript with the clip available to authorized operators.

a browser journey with a fake media device records a 10-second answer, the operator plays it back through a signed URL, and the transcript appears in the ledger and analysis evidence.

## FIELD-010

A single-choice, multiple-choice or dropdown question may enable an **Other** option and, on multiple choice, a **None of the above** option. Each is a choice with its own stable ID (FLOW-015) and an editable label that LANG-001 translates. Choosing Other shows a text box that is required once Other is chosen, holds a short-text answer within `seed.json → limits` and any FIELD-013 validation the operator set, and is discarded when the respondent deselects Other. None of the above is exclusive: choosing it clears every other selection, choosing any other option clears it, and None alone satisfies a multiple-choice minimum. The stored answer keeps the chosen stable IDs and, for Other, the typed text beside the Other choice ID; FLOW-019 admits exactly the `{choiceIds: string[], otherText: string}` shape and RESP-003 names the empty-Other error. Results count Other and None in the RSLT-003 distribution with their denominators and list the Other write-ins as open text that RSLT-012 coding, LEDG-003 filters, LEDG-006 search and analysis evidence read. CSV and JSON exports (LEDG-004) carry the Other text in its own column beside the choice column, keyed by stable step ID. Branching (FLOW-005) tests Other and None like any stable choice ID, recall (LOGIC-001) inserts the typed Other text, and FIELD-006 randomization keeps Other and None anchored last. Imports carry each source's Other option and its historical write-in text: Typeform `allow_other_choice` with response `choice.other` and Google Forms `isOther` with its typed value (IMPORT-007), SurveyMonkey's "Other (please specify)" answer and its text (IMPORT-005), and Jotform's "Other" option on radio and checkbox fields (IMPORT-006), so no write-in is lost.

a Worker test publishes a multiple-choice question with Other and None and a single-choice question with Other; a response choosing Other with text stores the Other choice ID and the text, and the CSV carries the text in its own column; Other with empty or whitespace-only text is refused with a field-specific error and creates no response; None together with another option is refused; the results distribution counts Other and lists its text as open text; a branch on Other routes to its destination.
A browser journey sees the text box appear when Other is chosen and the other selections clear when None is chosen.
A Worker test imports a Typeform definition and responses fixture whose `allow_other_choice` answers arrive as `choice.other` write-ins, and a Google Forms fixture with an `isOther` option, and asserts every write-in lands on the Other choice with its text.

## FIELD-011

A statement step can sit anywhere between questions: rich text (headings, bold, italic, lists and links to approved HTTPS origins) with LOGIC-001 recall, optional media under FIELD-005 with required alt text, and a Continue label the operator can change under LANG-002. It asks for no answer. It is a valid branch destination and can be reached by branching (FLOW-012, FLOW-013), including the per-question feedback screens a LOGIC-004 quiz routes to. It is never counted as a question by progress (RESP-002), drop-off (RSLT-002 reports it as a step reached, not a question answered) or required checks (FLOW-020), and nothing is stored for it in the response, the ledger or exports. Inside a FIELD-008 classic page it is a text block between questions. On activation FLOW-002 is rewritten to allow statement steps at any position besides the optional first welcome screen. Imports map Typeform Statements after the first (IMPORT-007), Google Forms text items (IMPORT-007), Jotform paragraph and header fields (IMPORT-006) and SurveyMonkey descriptive-text items (IMPORT-005) to statement steps in the review.

a browser journey publishes a flow of question, branch, statement and question, answers so the branch reaches the statement, sees its recalled text and Continue label, continues, and sees progress count only the two questions; the ledger and CSV hold no answer for the statement step.
A Worker test refuses publish for a statement whose image lacks alt text and accepts a branch whose destination is a statement.
A Worker test imports a Typeform fixture with a welcome screen and two Statements between questions and asserts both become statement steps in the review in their original order.

## FIELD-012

Inside a one-question-at-a-time flow (RESP-001), an operator can group several questions under one heading, with optional description and media, so they show together on one screen, as Typeform's Question Group does. Each grouped question keeps its stable ID, type, required flag and validation. Next validates every visible question in the group and keeps the screen with field-specific errors; progress (RESP-002) counts each grouped question; LOGIC-006 conditions after the group may test any of its questions, and the group is one branch destination (FLOW-012, FLOW-013). A group may contain statement text (FIELD-011) but no nested group. Typeform `group` and `inline_group` fields import as groups (IMPORT-007). FIELD-012 is done only when every requirement and acceptance step in this clause and its dependencies FIELD-005 (optional media) and FIELD-011 (statement items) are done.

a browser journey builds a group of three questions with one required, sees all three on one screen, is held by a field-specific error until the required one is answered, and is routed by a branch that tests a grouped answer; progress counts three questions.
A Worker test imports a Typeform fixture with a group and asserts the review shows one group containing its questions.

## FIELD-013

Short-text and long-text questions take an operator-set minimum and maximum character count within the type limit in `seed.json → limits`, with a live character counter when a maximum is set. Short text may also take an input mask (`#` digit, `@` letter, `*` letter or digit, any other character literal, for example `###-##-####` or `@@-####`) or a pattern written in a linear-time regular-expression subset (no backreferences or lookaround, bounded length), each with a custom error message that LANG-001 translates; publish refuses a pattern outside that subset. The browser and the Worker apply the same rules, so a value refused on screen is refused by the API. Typeform `max_length`, SurveyMonkey text validation and Jotform input masks map to these settings on import (IMPORT-005 to IMPORT-007). LANG-001 inherits translation of FIELD-013 validation errors; IMPORT-005 and IMPORT-006 inherit faithful mappings of text lengths, masks, supported patterns and custom errors before their importers ship.

a Worker test publishes a short-text question with minimum 3, maximum 10 and mask `###-####` and refuses 2-character, 11-character and mask-mismatched submissions with field-specific errors while accepting `555-0100`; publish refuses a pattern with a backreference; a browser journey shows the counter and the custom error; a Typeform fixture with `max_length: 150` imports as maximum 150.

## FIELD-014

A dropdown holds at least 1,000 choices and a single- or multiple-choice question at least 250. A dropdown filters as the respondent types, matching anywhere in the label, case- and accent-insensitively, and stays keyboard-operable and announced to screen readers under A11Y-001. In the builder an Editor can paste one choice per line, with duplicates and blank lines named before save, and can insert and then edit built-in lists: the 50 US states, the District of Columbia and the US territories with their USPS codes, and countries with their ISO 3166-1 alpha-2 codes. A revision holds at least 250 questions; each question counts once toward that limit whether it stands alone, sits in a FIELD-012 group or sits on a FIELD-008 page, and statements (FIELD-011), groups and pages count toward a separate structure limit, so neither layout shrinks the question budget. Activation raises `seed.json → limits.questions.dropdownChoices`, `limits.steps.choiceOptionsPerStep` and `limits.steps.perRevision` to load-tested values that meet these floors, records the load test, and keeps `p95Milliseconds.publicScreen` and `answerTransition` on the longest permitted form. An import with a list or form over the limit is never truncated silently: the review names the step and the count (IMPORT-001). FIELD-014 is done only when every requirement and acceptance step in this clause and its target dependencies FIELD-008 (classic pages), FIELD-011 (statement screens), FIELD-012 (question groups) and A11Y-001 (accessible collection) are done.

a Worker test publishes a dropdown built from the country list, a dropdown with 1,000 choices and a 250-question flow that mixes groups and pages, collects a response to each and asserts the stored stable choice IDs; publish refuses a question with one choice over the configured limit and names its step.
A browser journey types "united" in the country dropdown, sees only matching countries, and picks "United States" with the keyboard alone.
A builder journey pastes 300 lines containing one duplicate and sees the duplicate named before save.

## FIELD-015

An Editor sets a date question's display format (MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD) and separator (`/`, `-` or `.`). The default follows the form language under LANG-001, MM/DD/YYYY for `en-US` and `es-US`, and an Editor may override it per question. The respondent enters the date in labeled month, day and year fields in that order, or through an accessible date picker, independent of the browser's locale, and sees it in that format on the answer, in recall (LOGIC-001), on the review and completion screens, in the confirmation email (RESP-020) and in the submission PDF (WORK-005). An impossible date (for example 02/30/2026) or one outside the question's bounds is refused with a field-specific error that names the expected format. The stored value stays the FLOW-019 YYYY-MM-DD calendar date, so CSV, JSON, the API and integrations are unchanged; the ledger and response emails show dates in the form's display format. Imports keep the source format: Typeform date `structure` (`MMDDYYYY`, `DDMMYYYY`, `YYYYMMDD`) and `separator` (IMPORT-007) and Jotform date format (IMPORT-006). The RESP-024 respondent review screen now shows dates in the FIELD-015 published display format. NOTIFY-006 and RESP-020 inherit the display format in answer-bearing and confirmation emails, WORK-005 in the submission PDF, LANG-001 the per-language default and IMPORT-006 the Jotform date format, each before that capability ships.

a browser journey with the browser locale set to `en-GB` answers an MM/DD/YYYY question by typing 07/04/2026, sees "07/04/2026" in the recalled next prompt and the review, and the CSV holds `2026-07-04`; 02/30/2026 is refused with an error naming MM/DD/YYYY; the same question set to DD/MM/YYYY stores `2026-04-07` for 07/04/2026.
A Worker test imports a Typeform date field with `structure: DDMMYYYY` and `separator: '.'` and asserts the question's format setting.

## FIELD-016

A rating question (FLOW-003) sets its start (0 or 1), its number of steps (2 to 11, so 0–10 and 1–11 are the longest scales) and optional labels for the low end, the middle and the high end, each up to 100 characters and translatable under LANG-001. The labels sit over the first step, the middle step (between the two middle steps when the count is even) and the last step, on phones as on desktop, and each step's accessible name joins its number and any label (A11Y-001). The stored answer is the number, whatever the labels; LOGIC-006 numeric operators, LOGIC-003 calculations, recall and results use it, and results show the distribution across every step with the end labels on the axis. NPS keeps its fixed 0–10 and its two existing labels. Start, steps and labels belong to the published revision, so changing them makes a new revision (FLOW-001) and results keep each revision's own scale. Imports map Typeform opinion-scale `start_at_one`, `steps` and `labels.left`, `labels.center` and `labels.right`, Google Forms scale `low`, `high`, `lowLabel` and `highLabel`, and SurveyMonkey and Jotform scale labels (IMPORT-005 to IMPORT-007). When this clause activates, FLOW-003's rating options are rewritten to name these settings. LANG-001 inherits translation of the low, middle and high labels; IMPORT-005 and IMPORT-006 inherit SurveyMonkey and Jotform scale start, step and label mappings, each before that capability ships.

a browser journey publishes a 0–6 scale labeled "Not at all", "Neutral" and "Completely", sees the labels over steps 0, 3 and 6 and accessible names that join each number and label, answers 0, finds 0 in the ledger and the CSV, and is routed by a LOGIC-006 `less than 2` rule; a Worker test refuses 1 or 12 steps and a 101-character label at publish; the IMPORT-007 Typeform fixture's opinion scale with `start_at_one: false`, 7 steps and three labels arrives as a 0–6 scale with those labels, and a Google Forms scale keeps its `lowLabel` and `highLabel`.

## LOGIC-001

A prompt, supporting text, choice label, completion screen or email may insert an earlier answer, hidden field or calculated value. Question-answer references use the stable question ID (`{{<step-id>}}`); hidden-field and calculated references belong to FIELD-001 and LOGIC-003. Recall shows only valid values on the respondent's current path and renders them as escaped text; skipped or invalid answers insert blank text. Publish refuses missing, current, future or impossible off-path question references with the containing step ID, and duplication remaps references to the new question IDs. NOTIFY-006 and RESP-020 inherit LOGIC-001 answer, hidden-field and calculated-value recall in answer-bearing emails, including escaped output and blank skipped or invalid values, before shipping those consumers.

a browser journey answers a name question and sees it in the next prompt; going back and changing it updates the later prompt; an injected `<script>` answer renders inert.
Worker checks also reject invalid references at publish, keep respondent-supplied tokens inert, leave stored answers unchanged and remap duplicate references; the phone and desktop browser journey checks preview, Back edits and recalled choice text.

## LOGIC-002

An invitation, identified in-product survey or CRM-linked link may prefill questions from the contact's stored fields (AUD-001) or a connected CRM record (INTEG-003 to INTEG-005); prefilled answers are visibly marked, editable by the respondent unless locked by the operator, and recorded as prefilled in the response. Anonymous collection never prefills. Known-data mapping is explicit per question in the draft and frozen in its published revision; old revisions have no mapping. Only the invitation-token holder receives validated string-compatible stored contact values, never in a URL, audit row, log or analysis input before submission. Invalid values are dropped without coercion. The response retains the submitted answer and an unchanged, edited or locked prefill marker, not the original contact value; normal erasure, ledger/search, CSV/JSON and archives carry that answer and marker. Mapped invitations cannot save to another device; no public, embed, collector, preview or resume path supplies contact prefills. Publish refuses deleted or string-incompatible mappings by step ID. DIST-015 and INTEG-003 to INTEG-005 inherit these rules before their in-product/CRM doors ship.

a Worker test launches invitations to contacts with a company field, the respondent sees it prefilled, edits it, and the ledger shows the edited value with a prefill marker.

## LOGIC-003

Operators define numeric and text variables computed from answers and hidden fields with arithmetic, conditionals (whose tests are LOGIC-006 conditions), rounding and date differences (for example a price total, a lead score or a BMI); calculations are typed, validated at publish for missing references and division by zero, usable as LOGIC-006 operands in branching, completion and alerts, in recall, payments (PAY-001) and results, and stored with the response. Publication proves calculated branch conditions exactly over finite inputs (bounded integer numbers, ratings, scores, booleans, single choices and text equality classes) and refuses a destination they show unreachable; a calculated condition whose variable reads an unbounded or decimal number, a date, a multi-select, masked or patterned text or a numeric hidden field may be true or false, so its destinations count as reachable. Destinations stay forward-only and feasible cycles are refused, so every path still ends; stored values, preview and the runtime evaluator are unchanged. NOTIFY-005 inherits LOGIC-003 calculation operands in alert conditions; PAY-001 inherits calculated payment amounts, each before that capability ships.

a Worker test publishes a form whose total depends on quantity and a conditional discount and asserts the stored total for ten answer sets; publish refuses an expression referencing a deleted question; a BMI rounded from two decimal answers (weight and height) gates a branch, preview shows the computed value on both branches, and the form publishes and routes both answer sets at 1440 and 390.

## LOGIC-004

A flow may score answers (correct answers, points per choice or personality outcome mapping), show the respondent their score, per-question feedback and an outcome screen chosen by score range or top outcome (the score and outcome are LOGIC-006 operands, so an outcome rule may also combine them with answers or hidden fields), and report score distributions, per-question correctness and pass rates. This clause inherits RSLT-006: a quiz score and an outcome are crosstab dimensions with the same stated shares, chi-square rule and ANLY-005 suppression.

a Worker test publishes a graded quiz and a personality quiz and asserts scores, chosen outcome screens and the score report for fixed answer sets, and crosses the outcome against a question under RSLT-006.

## LOGIC-006

One condition model serves every rule that decides something from a response: a branch rule (FLOW-005), the choice of completion screen or redirect (LOGIC-005), show/hide inside a classic page (FIELD-008), the conditional terms of a calculation (LOGIC-003), a quiz outcome (LOGIC-004), a response-email rule (NOTIFY-006) and an alert rule (NOTIFY-005). A rule therefore means the same thing in the builder, in preview, in the published runtime and in the Worker, which all use one shared evaluator. A rule is a tree of conditions joined by AND and OR groups, up to `seed.json → limits.logic.conditionsPerRule` conditions and `limits.logic.groupDepth` levels of nesting; activation adds both keys with load-tested values against a design target of 20 conditions and 3 levels. The existing "always" default path stays. Each condition tests one operand that lies earlier on the respondent's path: any question (including the step being left and any question in a FIELD-012 group or FIELD-008 page), a FIELD-002 matrix row, the typed text of a FIELD-010 Other choice, a FIELD-001 hidden field, a LOGIC-003 variable, or a LOGIC-004 score or outcome; rules evaluated after submission (NOTIFY-005, NOTIFY-006) may also test the PAY-001 payment state. Operators by operand type: single choice, dropdown and matrix row take is, is not, is any of and is none of; multiple choice takes includes any of, includes all of, includes none of and is exactly; short text, long text, email, URL, phone, Other text and text hidden fields or variables take equals, does not equal, begins with, ends with, contains and does not contain, compared case-insensitively after trimming and Unicode NFC normalization; number, rating, NPS, CSAT, CES, currency, score, and numeric hidden fields or variables take equals, does not equal, less than, at most, greater than and at least; date takes before, on, not on, after, on or before and on or after, compared as calendar dates without timezone conversion (FLOW-019); yes/no and consent take is yes and is no; priority compares a choice's rank numerically (FLOW-005); and every operand takes is answered and is blank. An operand the respondent's path skipped, an optional question left empty and a hidden field absent from the link are all blank: a blank operand satisfies only "is blank", fails every other operator including the negative ones, and never raises an error or blocks progress (FLOW-020). FLOW-012 and FLOW-013 validation extends to every operand: publish (FLOW-006) is refused, naming the source step, the rule and the condition, for an operand that is a deleted question, row, choice, hidden field or variable; an operand that cannot precede the rule's step on any path (for example a later step); an operator that does not fit the operand's type; a choice ID that does not belong to the operand's question; or a tree beyond the limits. Destinations stay forward-only, so every path still terminates. The `flow.branch-selection.v1` policy is unchanged: the first matching rule in displayed order, then the default path. The Worker re-evaluates the same rules from accepted on-path answers when it accepts each answer and the final submission. Under RESP-004, an answer to a question off the respondent's path is discarded before final validation, never stored, scored or exported; final submission is validated only on its on-path answers, and new condition-tree paths are evaluated from accepted on-path answers. In the builder, an Editor adds conditions and groups, sets AND or OR per group, picks operands from a list of only the earlier questions, rows, hidden fields, variables and scores, and reads a plain-English summary of each rule beside the path (for example "Company size at least 50 and Role is Decision maker, or plan equals enterprise → Book a demo"); the editor is keyboard-operable under A11Y-001. Preview (FLOW-007) shows each rule's tree with every condition's operand value and true or false result, each group's result and the chosen next step, exactly as the published runtime evaluates them. Rules are part of the published revision (FLOW-008) and reference stable IDs (FLOW-015), so renaming a question, choice or hidden field never changes a rule. Imports map conditions faithfully: Typeform logic `condition` trees with `and` and `or`, `field`, `hidden`, `variable`, `choice` and `constant` operands and the operators `is`, `is_not`, `equal`, `not_equal`, `begins_with`, `ends_with`, `contains`, `not_contains`, `lower_than`, `lower_equal_than`, `greater_than`, `greater_equal_than`, `earlier_than`, `earlier_than_or_on`, `later_than`, `later_than_or_on`, `on`, `not_on` and `always`, from a definition file (IMPORT-001) or by connection (IMPORT-007); SurveyMonkey advanced branching with its AND/OR conditions on questions and custom variables (IMPORT-005); and Jotform conditions with their All/Any linking and equals, not equals, contains, does not contain, starts with, ends with, less than, greater than, before, after, is empty and is filled terms (IMPORT-006). A source condition with no faithful mapping is listed as unsupported and leaves its path incomplete, never guessed (IMPORT-001). On activation FLOW-005 and FLOW-012 are rewritten to this model. LOGIC-006 is done only when every requirement and acceptance step in this clause and its target dependencies FIELD-001 (hidden fields), FIELD-002 (matrix rows), FIELD-008 (classic pages), FIELD-010 (Other text), FIELD-012 (question groups), LOGIC-003 (calculations), LOGIC-004 (quizzes and outcomes), LOGIC-005 (completion and redirects), NOTIFY-005 (alerts), NOTIFY-006 (response emails), PAY-001 (payment state), IMPORT-005, IMPORT-006 and IMPORT-007 (condition imports), and A11Y-001 (keyboard access) are done.

a browser journey publishes a lead form whose rule is (company size at least 50 AND role is "Decision maker") OR hidden field `plan` equals `enterprise`, drives four answer sets through the published form (both conditions true; size true and role false; both false with `plan=enterprise` on the link; all false) and asserts each lands on the expected step; an email `ends with gmail.com` rule routes an address whose domain is typed `GMAIL.COM` (case-insensitive) and not one whose domain is `gmail.co`; `is not` on a single choice routes every other choice; an `is blank` rule on an optional question the respondent skipped routes, and the same question's `does not equal` rule does not match it; preview shows each condition's value and result for one answer set.
Worker tests refuse publish for a condition that references a later step and for one that references a deleted hidden field, each naming the rule; a submission carrying an off-path answer is accepted when its on-path answers are valid, with the off-path answer absent from stored answers, scoring and exports under RESP-004, and condition-tree routing computed from accepted on-path answers.
A Worker test imports a Typeform fixture with an `and` jump over a field, a hidden field and a `contains` text condition, and a Jotform fixture with an Any-linked condition, and asserts both arrive intact as LOGIC-006 rules in the review.

## LANG-001

A form may have several languages (English and Spanish first-class for US buyers, any BCP 47 language allowed); the respondent sees the language matching their browser with a visible switcher, all steps, choices, errors, disclosures and emails are translated, and stable IDs are shared across languages so results merge with language as a filter. Each language carries its own default date display format for FIELD-015 (MM/DD/YYYY for `en-US` and `es-US`). Missing translations block publish for that language. Operators export and import translations as CSV or XLIFF, and may request an AI draft translation that is applied only after review (AI-002). This clause inherits FIELD-013: translated custom and default text-validation errors use the same published length, mask and pattern rules. This clause inherits FIELD-016: an opinion scale's low, middle and high labels are translated per language and stay over the same steps. This clause inherits RSLT-006: response language is a crosstab dimension with the same stated shares, chi-square rule and ANLY-005 suppression.

a browser journey answers the same form in English and Spanish, and a date question shows MM/DD/YYYY in both under `en-US` and `es-US`; results show one distribution with a language filter; publish is refused while one Spanish choice is untranslated.
The journey also triggers FIELD-013 length and mask errors in each language and checks the translated custom message, and checks a FIELD-016 scale's translated labels over steps 0, 3 and 6 in each language, and crosses language against a question under RSLT-006.

## AI-002

An operator can ask `ai.provider.v1` to draft a translation of every untranslated string; the draft is shown beside the source. Applying an agent translation carries standard, adding external when published to respondents; the company’s policy decides whether it applies alone or waits for the operator.

Under the held company policy, a Worker test with the AI receiver fixture drafts Spanish strings, accepts half, and the rest stay untranslated and block publish for Spanish.

## LANG-002

An Editor overrides, per form, the closed-form message, the response-limit message (RESP-008, RESP-009), the button labels (Start, OK, Next, Submit), required-answer and validation messages, the progress text and the keyboard hint, with recall (LOGIC-001) in messages and a stated length limit. Overrides are part of the published revision, are translated per language under LANG-001, and an empty override falls back to Pencil's default; A11Y-002 refuses a label that would leave a control without an accessible name.

a browser journey sets a custom Submit label and closed message, sees the label on the published form, closes the form and sees the closed message, and sees the Spanish translation of the label under LANG-001; a Worker test refuses publish with a whitespace-only button label.

## A11Y-002

The builder flags missing alt text, low-contrast brand choices, unlabeled matrix rows, overly long choice lists, timed elements and ambiguous link text, and blocks publish for failures that would breach A11Y-001 with a fix link to each step.

a Worker test publishes a draft with an image lacking alt text and a 2:1 contrast accent and receives both stable step IDs and reasons.

## DIST-011

Operators send invitations and reminders by text message through Twilio to contacts with a mobile number and recorded SMS consent (TCPA prior express consent: actor, time, source and wording). Messages carry the opaque link and "Reply STOP to opt out"; an inbound STOP, sent to a signed Twilio status and inbound webhook, opts the contact out of SMS immediately (DIST-005 for SMS), and HELP returns the business name. Delivery attempts, retries and terminal failures follow DIST-006, DIST-008 and DIST-010; quiet hours follow WS-002 in the contact's time zone where known. A2P 10DLC registration is the owner's Twilio account step and the settings page shows its state.

a Worker test with a Twilio receiver fixture sends to a consented contact, refuses an unconsented one, records a STOP that blocks the scheduled reminder, and verifies the inbound webhook signature.

## DIST-013

Besides the inline script and iframe (DIST-002), the embed offers full-page, popup on click, popover bubble, slider and side tab modes, with open triggers on click, delay, scroll depth or exit intent, frequency capping per browser, and the same isolation as DIST-009. A WordPress plugin and a Webflow/Squarespace snippet install the embed without editing theme code. Every mode and the WordPress shortcode take DIST-021's forward, fixed-value, `hidden` and `_ga` options, so a popup on a paid-ad landing page carries the campaign like an inline embed.

a browser journey on a host fixture opens each mode by its trigger, completes a response, and proves the host receives only loaded, height and completed events; the popup and side-tab modes on `/landing?utm_campaign=spring` store the forwarded `utm_campaign`; the WordPress plugin renders a form via shortcode in a WordPress test container.

## DIST-014

An invitation or program email may carry the first question (NPS 0–10, CSAT 1–5, or a short single choice) as buttons. Clicking opens the form with that answer selected and the rest of the flow ready; the click itself is a GET that records nothing, so mail-security link scanners cannot create answers, and the answer is saved only when the respondent confirms or continues. Invitation buttons use only the invitation's opaque token and a namespaced answer hint; their GET and HEAD perform no answer, session, response, view-counter or participant-state write. Selection remains in the page until explicit interaction, and normal completion, closure, opt-out and revision admission still apply. Unknown or out-of-range hints select nothing. Only an eligible first published-path question renders buttons: NPS, CSAT, a published rating scale, or a single choice with at most eight short labels (80 characters each); a different first type or an operator-locked contact prefill renders no buttons. Reminders share this same composer. PROG-002 inherits these rules before program email ships.

a Worker test fetches every embedded answer link as a scanner would and finds no answer or session recorded; a browser journey clicks "9", lands on question 2 with 9 selected and completes.

## DIST-015

A JavaScript SDK served from the installation (no third-party origin) shows micro-surveys inside the business's web app or site, targeted by page, event, user attributes the host passes and a sampling rate, with global and per-survey fatigue limits (for example no more than one survey per user per 14 days). Identified targeting requires a server-signed user identity from the host, and RESP-005 discloses the identification; unsigned attributes keep the response anonymous.

a browser journey on a host fixture fires an event, the survey appears for a matching user and not for a non-matching one, a second trigger inside the fatigue window shows nothing, and a forged unsigned identity yields an anonymous response.

## DIST-016

A form can repeat on a schedule (weekly, monthly, quarterly, or a cron in the WS-001 zone) to a segment or by a fresh public link per occurrence, each occurrence pinned to the then-current revision and reported as its own period in trends (RSLT-007); the distributor is reminded before each occurrence and can skip one.

a Worker test advances a fake clock through three monthly occurrences and asserts three launches, three periods in the trend report and one skipped occurrence that sent nothing.

## DIST-017

An operator can create several named collectors per form (web link, embed on a named site, email campaign, SMS, QR, social post, partner), each with its own link, close date and response limit; every response records its collector, and results filter and compare by collector.

a Worker test collects through two collectors, closes one by limit while the other stays open, and the results comparison shows each collector's counts.
The native-route journey also races the last collector place without exceeding its limit, pins a returning session to its collector, and checks independent close/reopen, collector filters and snapshot exports.

## DIST-018

Each form has an editable readable slug on the installation's own domain (for example `/f/customer-survey`), additional custom domains or subdomains can be mapped to the installation through Cloudflare custom hostnames, and old slugs keep redirecting after a rename. Every address serves the form's DIST-020 link preview with its canonical `og:url` and robots setting. Under RL-101, a retired slug stays bound to its existing form and may be explicitly restored as that form’s canonical slug in one atomic rename, with every other alias redirecting directly to the resulting canonical address; another form cannot claim an address while it remains an obligated redirect.

a Worker test renames a slug, the old one redirects with 301 to the new one, and a form served on a mapped test hostname renders with the same admission checks and the same DIST-020 preview tags, with `og:url` naming the canonical address.

## DIST-020

Each form has a share title (default: the form title), description (default: the welcome screen's text, otherwise empty) and share image (default: the BRAND-001 business logo on the BRAND-002 theme background; an Editor may upload a PNG, JPEG or WebP within a stated size limit, with required alt text), which are part of the published revision and translated under LANG-001. The public form page, the embed page and every DIST-018 address serve them as `<title>`, `og:title`, `og:description`, `og:image` (an absolute URL on the installation's own origin), `og:image:alt`, `og:url` (the canonical DIST-018 address) and `twitter:card` set to `summary_large_image`, so a link pasted into an ad, a Facebook, LinkedIn or X post, Slack, or a text message shows that preview. Preview text never contains answers or recalled values (LOGIC-001), and rendering it makes no third-party request. Search indexing is off by default: every form, embed, invitation, save-and-resume (PART-002) and completion page sends `<meta name="robots" content="noindex, nofollow">` and `X-Robots-Tag: noindex`. An Editor may allow indexing for one public form, which removes both only from that form's canonical address; invitation-only, restricted (DIST-019), identified (RESP-023) and HIPAA-mode (GOV-001) forms can never be indexed. DIST-017 collectors and DIST-018 addresses share the form's preview. Typeform's meta title, description, image and `allow_indexing` setting import with the form (IMPORT-007).

a Worker test fetches a published form's page and asserts its `og:title`, `og:description`, `og:image` (same origin and fetchable), `og:url` and `twitter:card` tags and the `noindex` meta tag and header; after an Editor sets a custom title and image and allows indexing, the republished form serves them without `noindex`; publish refuses the indexing setting on a DIST-019 restricted form, which keeps `noindex`; a browser journey sees the preview card in the builder's share panel.

## DIST-021

A script embed (DIST-002), every DIST-013 mode (full-page, popup, popover, slider and side tab) and the WordPress plugin's shortcode take a list of parameter names to forward from the URL of the page the form sits on: `data-pencil-forward="utm_source,utm_medium,utm_campaign,gclid,fbclid"` on the snippet, `forward="…"` in the shortcode. The installation-origin script reads the host page's `location.search`, keeps only names that are both listed and declared as FIELD-001 fields on the published revision (the script `/embed.js` serves carries the revision's declared field names and nothing else about the form), and hands those values to the form in the `pencil:init` message it already sends after the frame loads, never in the frame's URL, so they reach no access log or Referer; every other parameter, listed or not, stays on the host page. The landing page can also supply values itself: `data-pencil-<field>="…"` sets a fixed value, and a documented `hidden` call, made before or after the snippet loads (`(window.pencil = window.pencil || []).push(['hidden', {utm_source: '…'}])`), hands over values the page holds from earlier in the visit, for example the first-visit UTMs it kept in its own first-party cookie. For GA4, `data-pencil-ga4="cookie"` makes the script read the host's own `_ga` cookie and pass its client ID (the last two dot-separated parts of `GA1.1.123456789.1700000000`, here `123456789.1700000000`) as `ga_client_id`, only when the form declares that field; Pencil sets no cookie of its own. One precedence holds: a fixed `data-pencil-<field>` value beats a `hidden` value, which beats a forwarded URL value; a declared field with none of them is blank (FIELD-001). The respondent page accepts the first answer only after `pencil:init` is processed, so no response loses a forwarded value to timing, and the Worker re-checks every received value against the revision's declared names and types, discarding and counting anything else whatever the script sent. Forwarded values follow every FIELD-001 rule: they drive LOGIC-001 recall and LOGIC-006 conditions, and are stored, filtered, exported and delivered like link values; an identifying field is accepted only on a RESP-023 identified form; on an anonymous form click IDs are held only for INTEG-017 delivery and purged once it ends. Values flow from the host page into the form only: DIST-002 and DIST-009 isolation are unchanged, and nothing about the response flows back beyond the loaded, height and completed events. The plain iframe takes the same values in its `src` query string (`/embed/<slug>?utm_campaign=spring`), written by the operator's page template, under the same declared-field filter at the Worker; DOCS-001 gives that recipe, the `hidden` first-visit cookie recipe and the `_ga` recipe. Forwarded names per snippet are capped by `seed.json → limits.embed.forwardedParameters` (design target 20, added with a load-tested value on activation) and each value by its declared type's FIELD-001 length. When this clause activates, DIST-002 is rewritten to name the forward, fixed-value, `hidden` and `_ga` options, and DIST-009's host-communication sentence to name the inbound `pencil:init` values.

a browser journey loads a host fixture at `/landing?utm_campaign=spring&gclid=G1&fbclid=F1&secret=x` with the script embed forwarding `utm_campaign,gclid,fbclid,secret` on a form that declares `utm_campaign`, `gclid` and `fbclid`, is routed by a LOGIC-006 rule on `utm_campaign`, completes the response, and asserts that the stored response and the CSV hold `utm_campaign=spring`, that `secret` is in neither the stored response, the `pencil:init` message nor any request the frame makes, and that the INTEG-017 receiver fixtures get one Google Ads click conversion carrying `G1` and one Meta event whose `fbc` is built from `F1`; the same journey with `data-pencil-utm_campaign="fixed"` stores `fixed`; a host fixture with a `_ga` cookie and `data-pencil-ga4="cookie"` produces one GA4 event carrying that client ID, and one whose page calls `hidden` with a first-visit `utm_source` stores that value; the popup mode forwards the same values; a plain iframe whose `src` carries `?utm_campaign=spring&secret=x` stores only `utm_campaign`; on an anonymous form a forwarded `email` is not stored and is counted as discarded; and throughout, the host page receives only loaded, height and completed events.

## RESP-020

A form may send the respondent a branded confirmation (BRAND-001) after completion, optionally with a copy of their answers, their quiz result (LOGIC-004), their payment receipt link (PAY-001) or the signed PDF (SIGN-001), using recall (LOGIC-001). It goes only to an email the respondent typed into a question marked "send my confirmation here" or to an identified participant, is delivered through `mail.sender.v1` with DIST-006 retries, and never contains answers the operator marked sensitive (GOV-004). This clause inherits LOGIC-001 recall in email subjects and bodies: earlier answers, declared hidden fields and calculated values render as escaped text and HTML, with skipped or invalid values blank. This clause inherits FIELD-015: answer dates in the confirmation email render in the question's published display format. Confirmation is off by default per published revision, and an answer copy is a second opt-in with allowed question types defaulting to none. Only the one selected email question or the invitation participant supplies a recipient; no other typed or link-supplied address does. An unchanged/locked contact prefill supplies a recipient only when it is that identified participant’s own address. Opted-out participants, opted-out or bounced mailboxes, and excluded or quarantined responses receive none; release admits a live response. One durable delivery key per released response prevents submission replay and restored history from resending. Existing RESP-015 request rates and one delivery per response bound this mail path. The branded receipt has no Reply-To and no response-access link, except the single-use edit link when the workspace has explicitly enabled response editing (RESP-021). Delivery mailboxes, rendered bodies and attempts travel as private archive/export history, restore disabled and erase with their response. GOV-004 inherits withheld rendering before sensitive marking ships; LOGIC-004 quiz results, PAY-001 receipt links and SIGN-001 signed PDFs inherit this receipt’s recipient, escaping, exclusion and custody rules before those optional parts ship.

a Worker test completes a form with a confirmation question and asserts one delivery with the escaped answer copy, none for an anonymous response without the question, and a retry on transient failure.
Its mail receiver acceptance also proves those three recall sources, blank skipped values and inert injected markup.
Its mail receiver acceptance also shows a FIELD-015 date in the published display format.

## RESP-021

A form may allow a respondent to edit their submission until a deadline through a single-use edit link sent with the confirmation; an edit creates a new version of the response with the prior version retained, recomputes results and notifies integrations with an `updated` event.

a Worker test edits a submission through its link, sees both versions in the ledger and an `updated` webhook, and a second use of the same link is refused.

## PART-001

A form may opt in to keeping partial responses. The disclosure (RESP-005) states before the first answer that answers are saved as you go; each completed step is then stored against the RESP-013 session, shown to operators in a separate Partial view with the last step reached, excluded from completed counts, admission checks, analysis evidence and default exports unless an operator includes them, and deleted after a retention period (default 30 days) unless completed. Without the opt-in RESP-010 holds unchanged; on activation RESP-010 and the abandoned-session non-goal are amended to name this exception.

a Worker test answers three of six steps on an opted-in form and finds one partial with three answers that is absent from counts and analysis; the same journey on a form without the opt-in stores nothing; a fake clock past retention deletes the partial.

## PART-002

A respondent may choose "Save and finish later" and receive a resume link by email; the link resumes the same revision and answers on any device until it expires (default 30 days) or the form closes, the email is used only for that link unless the respondent also answers an email question, and a completed link shows the completion receipt while an erased, expired, closed or otherwise unavailable link offers where to start again. The explicit save exception in RESP-010 retains the original revision, answer path, collector and invitation across devices without creating a completion, contact, operator-visible partial or analysis evidence. Save mail failure is visible and retryable without duplicating the save. Completion, expiry (subject to GOV-003’s notice and legal hold) and erasure scrub the private saved state, and archive restoration removes delivery capabilities.

a browser journey saves after two steps, opens the emailed link in a new context, sees both answers, completes, and the link then shows the completed state.
The same journey without choosing Save stores no partial; saved answers stay out of completed counts, results, analysis and default response exports until final submission.
Worker journeys also prove revision pinning, separate delivery email, visible mail failure and idempotent retry, expiry, closure, erasure, collector/invitation custody and archive restoration without delivery capabilities.

## RESP-022

Beyond RESP-015's defenses, each completed response is checked for straight-lining on grids, completion far faster than the form's median, duplicate open text across responses and gibberish text. A flagged response is quarantined with the reasons (RESP-017, RESP-018) and nothing is discarded; operators set which checks apply per form. On activation the trust-scoring exclusion in RESP-015 is amended to name these checks.

a Worker test submits a straight-lined grid and a 3-second completion against a 90-second median, both land in quarantine with their reasons, and release restores them to results.

## RESP-023

An Editor chooses per form, in the builder's share settings, whether public links, embeds, popups and QR codes collect *anonymous* responses (the default) or *identified* ones; the choice is part of the published revision and changes only by republishing. In identified mode, hidden fields declared identifying under FIELD-001 (for example `email`, `name`, `contact_id`) are accepted from the link, embed or popup, so a link pasted into Mailchimp, HubSpot, Mango or a CRM sequence as `?email=*|EMAIL|*&name=…` names the respondent without asking again. A public link carrying identifying hidden fields must bind exactly one form revision; its identifying values are fixed by that link and validated against that revision's declarations. A link built for one revision must be refused on another with a reason, without silently moving the identity to the new revision. Each value is validated against its declared type and stored on the response marked link-supplied and unverified; an unsubstituted merge tag (`*|EMAIL|*`, `{{contact.email}}`, `%%emailaddress%%`, `{email}`) or a value that fails its type is discarded and counted, never stored. When the Editor turns on contact matching, a supplied email links the response to the matching contact (AUD-001) and becomes the record key in CRM and email-platform deliveries (INTEG-003 to INTEG-009). Before the first answer, RESP-005's disclosure says the response is identified, shows the identifying values received ("Answering as jo@example.com") and that a forwarded link carries them, and offers "This isn't me", which clears them before anything is stored. Results, filters and exports show each response's identity mode. Anonymous mode keeps RESP-006 and FIELD-001's refusal of identifying parameters unchanged, and a response collected anonymously is never re-identified by switching modes. Publication already snapshots `response.identity.v1` as `anonymous-public-link` or `identified-public-link` from the form's chosen mode; RESP-005 states that policy. The current runtime validates submitted hidden values against the admitted session's revision. It does not yet bind the public URL itself to a revision or freeze identifying values: direct links resolve the current revision, and hidden values arrive with the submitted answers. Cross-revision identified-link refusal and fixed identifying values therefore remain obligations of this partial clause.

a browser journey publishes an identified form, opens it with `?email=jo@example.com&name=Jo&utm_source=mailchimp`, sees the disclosure name the email, completes it, and finds the email on the response, in the CSV export and as the contact key in the HubSpot receiver fixture's delivery; the same link with `?email=*|EMAIL|*` stores no email and counts one discarded value; "This isn't me" yields a response with no supplied identity; on an anonymous form the same `email` parameter is refused at publish and discarded at runtime, with the RESP-006 assertions unchanged.
A browser and Worker journey builds an identifying link for revision A, proves its identifying values cannot change during collection (except removal through This isn't me), publishes revision B, and proves that using A's link on B is refused with a reason and creates no response.

## RESP-024

An Editor may turn on a review screen per flow. Before final submission the respondent sees every reachable answer in published order and display format (FIELD-015 dates, scale labels under FIELD-016, choice labels), with an edit link per answer that returns through RESP-004 back navigation and recomputes the path; submitting from the review is RESP-007's final submission with the same RESP-012 idempotency key; unreachable answers never appear; anonymous flows show nothing beyond the respondent's own answers.

a 1440/390 journey answers a branching flow, opens the review, edits one answer that changes the branch, sees the dropped answer gone and the new one in display format, and submits once.

## LEDG-005

Besides CSV and JSON (LEDG-004), exports are available as XLSX (one sheet of responses, one of question metadata) and SPSS `.sav` with variable labels and value labels from stable choice IDs, under the same filter, cutoff and quarantine rules. Both stream through LEDG-004's cursor-paged download with bounded memory and are named `pencil-responses-<cutoff>.xlsx` or `.sav`. XLSX sheet one holds the CSV's columns and values, with JSON-valued columns kept as JSON text; every text cell is an inline string, never a formula, so a value starting with = + - or @ is never evaluated, and a value longer than Excel's 32,767-character cell limit refuses that export rather than being cut. Sheet two lists, per revision, each question's stable step ID, position, type and label and each offered choice's stable ID, published value and label, with its SPSS variable and code. The `.sav` file is a UTF-8, bytecode-compressed SPSS system file with one case per response: the CSV's response columns (the omitted-question and presented-order JSON stay JSON text), typed variables for hidden fields and calculations, and variables coded from stable IDs for each question: a single-choice or dropdown code whose value label is the choice label and which keeps one code per stable choice ID in every revision, a 0/1 variable per multiple-choice option, a rank per priority option, 1/0 for yes/no, thumbs and consent, the number for scores and numbers, text for open and contact answers, and an Other write-in in its own variable. An answer the response's revision did not ask is system-missing. Text wider than 255 bytes uses SPSS very-long-string segments; a value over the 32,767-byte SPSS string limit refuses that export, never truncated. The format cuts variable labels at 255 bytes and value labels at 120 bytes; sheet two keeps the full text.

a Worker test exports XLSX and SAV and reads them back with an independent reader, asserting the same response IDs and coded values as the CSV.

## LEDG-006

The ledger has a free-text search box that matches open-text answers, Other write-ins (FIELD-010), choice labels, hidden-field values (FIELD-001) and, for operators whose ROLE-002 grant shows identity, an identified respondent's name and email. Search combines with every LEDG-003 filter, highlights the matching answer, keeps the same response IDs and fixes into an export (LEDG-004) like any filter. GOV-004 sensitive answers match only for operators allowed to see them, quarantined responses only in the RESP-018 review list, and responses erased under DATA-002 never. It answers within one second p95 at the response capacity in `seed.json → limits`. Matching uses Unicode 16.0 full case folding and NFC composition on stored search values, maintained on every answer write and backfilled for existing answers by migration `0053_response_search_values.sql`; search matches those values directly. Accents stay significant, so cafe does not match café; %, _, * and SQL punctuation are literal. A 200-letter mixed-script phrase matches without an expression-depth refusal. ROLE-002 and GOV-004 inherit grant-aware matching: identity values and sensitive answers match only for operators whose grant shows them, each before that grant ships; until then every operator sees identity in the ledger, so search reveals nothing more.

A Worker test finds responses by retained open text, a hidden-field value and an Other write-in, combines search with revision/source filters, and exports exactly the matching released response IDs while excluding quarantine and erasure.
Accented, Cyrillic and Greek phrases match other-case answers and published choice labels; decomposed accents and expanding case folds match canonically, wildcards stay literal, a 200-letter mixed-script phrase returns its response, and an answer edit replaces its searchable text.
An upgrade from release 0.7.0 makes existing answers searchable without changing retained answers; an archive round trip retains search values and proves exact re-export equality.
A 1440/390 browser journey searches, highlights the original answer spelling and downloads the same filtered records.
ROLE-002 and GOV-004 must extend these journeys with their grant-aware cases before those grants ship.

## WORK-001

Each form has an inbox where submissions carry a status (new, in review, approved, rejected, done or custom), an assignee, tags and internal notes that respondents never see; operators filter and bulk-update them and every change is audited.

a browser journey assigns, tags, notes and moves a submission to done; the ledger filter by status returns it and the audit log names each change.
A native-route test also refuses an unauthenticated request and a stale bulk write without partial changes, checks private paged notes and custom statuses, exports the selected workflow cohort, and preserves custody through import undo, erasure and operator removal.

## WORK-002

A form may route each submission through one or more approval steps (sequential, parallel or chosen by answers, for example amounts over $5,000 to a second approver). Approvers are operators, or named external approvers who act through a single-use signed link scoped to that submission that shows only the fields the operator allowed. Approve, reject and request-changes are recorded with actor, time and comment, and can notify the respondent (RESP-020) and trigger integrations.

a Worker test routes a $6,000 request through two approvers, one by external link, asserts the decisions and audit, and proves the link cannot be reused or opened for another submission.

## WORK-003

A form may hand a later section to another person (for example an employee fills part one, their manager part two): the first respondent names or is assigned the next person, who receives their own link to complete only their section with the earlier answers they are allowed to see; the response completes when every section does.

a Worker test completes a two-person form, proves the second person cannot alter part one, and the response counts as completed only after part two.

## WORK-004

Pending approvals and handoffs remind their assignee on a schedule within WS-002 hours and escalate to a named operator after a deadline; completing or canceling stops reminders.

a Worker test advances a fake clock past two reminders and an escalation for a pending approval, then approves and proves no further reminder is queued.

## WORK-005

Each submission can be rendered to a PDF from a default layout or an operator-designed template (Jotform-style PDF editor, including filled versions of an uploaded fillable PDF), downloadable by authorized operators, attachable to RESP-020 and WORK-002 emails, and deliverable to storage integrations (FILE-002). This clause inherits FIELD-015: dates in generated documents and submission PDFs render in the question's published display format.

a Worker test renders a submission into a template with recalled values and a filled AcroForm PDF and asserts the text content of both.
The rendered text also shows a FIELD-015 date in the published display format.

## RSLT-006

An operator can cross any structured question, hidden field, collector, language, calculated value or score against another, with counts, row and column percentages named under RSLT-003, a chi-square test flagged only when every expected cell count is at least 5, and ANLY-005 suppression for cells below the disclosure threshold. A crosstab reads the released responses of one revision (RSLT-005, stable step IDs, never merged across revisions) under the LEDG-003 filter and an evidence cutoff, so quarantined and erased responses stay out; every count is distinct responses. Unanswered is its own stated row or column, and the table says when there is none. A multiple-choice dimension is labelled multiple-select: a response counts in each option it chose, shares may total more than 100%, and no chi-square is offered. A priority question crosses by its first-priority choice; numeric questions, dates and calculated values (LOGIC-003) cross by their distinct finite values, at most 50 categories, stated in the table; collectors with no response in the selection are not listed. Suppression (`analysis.disclosure.v1`, default 5): a cell with fewer included responses than the threshold, including zero, shows "suppressed" with no count and no percentage, and exactly the threshold is shown; so that the table alone cannot be subtracted back, the row total, column total and grand total of a suppressed cell, every share divided by a withheld total, and the chi-square are withheld and the table says so. This protects the table's presentation only: in an operator's results view the RSLT-001 answer summaries and response count, the other results panels, the raw ledger and operator exports stay complete for operators who may read the form's responses, and the table's note says withheld figures can be derived from them. Pencil makes no non-reconstruction guarantee beyond the table there. Aggregate-only views follow RSLT-009's aggregate-only disclosure rule. This clause inherits LANG-001: response language is a crosstab dimension, before multi-language forms ship. This clause inherits LOGIC-004: quiz scores and outcomes are crosstab dimensions, before quizzes ship. This clause inherits FIELD-002: each matrix row is a crosstab dimension keyed by its stable row ID, before grids ship.

a Worker test crosses a 3-choice question with a 2-choice question over a fixed dataset and asserts every cell, percentage, the chi-square statistic and a suppressed small cell.
LANG-001, LOGIC-004 and FIELD-002 each extend this proof with their own dimension.
The results journey states the page boundary: over the 43-response fixture with no filter the Plan summary shows Scale 8 of 43 answered and Responses 43 while the crosstab shows Scale × Churn 5 and Scale × Renew suppressed; the crosstab note says its withheld figures can be derived from the answer summaries, ledger and exports, which stay complete for operators who may read responses; the ledger filtered to Plan = Scale and Renewal = Renew lists exactly 3 responses and the CSV/XLSX/SAV export holds them.
No acceptance text claims suppression cannot be undone outside the table.

## RSLT-007

Results chart any score or answer share by day, week, month or quarter in the WS-001 zone, with the per-period denominator, a minimum-period-size rule, and revision boundaries marked; recurring occurrences (DIST-016) and programs (PROG-003) use the same series.

a Worker test seeds responses across three months and asserts weekly and monthly NPS, denominators and a revision marker; a period below the minimum shows no value.
The native-route journey also checks collector cohorts, primitive-answer shares and CSV; recurring occurrences, program dashboards and ranked/structured-contact shares remain acceptance obligations for the full clause.

## RSLT-008

An operator can save a named view (filters, compared cohorts, crosstabs, chosen charts) and arrange several into a form or program dashboard; views reopen with the same numbers for the same cutoff and record who saved them. Saved/shared aggregate-only views record the disclosure threshold at save/share and use a threshold never lower than that record under RSLT-009 and ANLY-015; lowering the current policy reveals nothing in those views. This future obligation adds no snapshot machinery to the operator's current-threshold results page.

a browser journey saves a filtered crosstab view, reloads it as another operator, and sees identical figures.

## RSLT-009

A saved view can be shared as a read-only link with optional password and expiry, revocable at any time; it shows aggregates only, applies ANLY-005 suppression, never shows respondent identity, excerpts below the threshold, uploads or payment details, and sets no cookies beyond its own session. *Raw-authorized operator*: an operator whose grant opens that form's ledger (LEDG-001) and response exports (LEDG-004/005). Today that is every operator. *Aggregate-only view*: RSLT-009 shared links, RSLT-010 report files, RSLT-011 report emails, INTEG-012 tool results, INTEG-011 tokens without a response-read scope, and any ROLE-001/ROLE-002 role without response access to the form. *Aggregate-only disclosure rule:* Every figure is computed for one stated cohort: revision, LEDG-003 filter including hidden-field, code and search filters, released responses, and evidence cutoff. It uses `analysis.disclosure.v1`, never lower than the threshold recorded when the view was saved or shared (as ANLY-015). Answer summaries stay complete. A crosstab, including an RSLT-012 code crosstab, is shown only when no suppressed cell is determined exactly by the figures that same report or tool result publishes for that cohort beyond what the answer summaries alone determine: its cells and totals, both dimensions' summaries and answered counts, Unanswered, and the response count. The check uses only sums that actually hold: a single-select dimension partitions its responses; a multiple-select one does not. Otherwise the view suppresses further cells until no cell is determined, or withholds that crosstab's cells, totals and chi-square and states that a suppressed cell would be recoverable from the report's other figures. A cell with fewer than the threshold, including zero, is suppressed; exactly the threshold is shown. A cohort with fewer included responses than the threshold, or a subset cohort differing from another cohort in the same report by 1 to threshold−1 responses, shows no breakdown. Observed-value categories (hidden-field, number, date and calculated values) with fewer responses than the threshold are not labelled. Identifying hidden fields (FIELD-001) are neither crossed nor summarised. Protection covers one report or tool result at one cutoff. It is not protection against differencing between separate links, files, emails, tool calls, filters or cutoffs, and the view says so. It is presentation protection, not anonymisation; raw-authorized operators keep the ledger and exports. Complementary suppression is a whole-report matrix/incidence feasibility check over non-negative integer response counts: every suppressed cell retains at least two feasible values, using only valid single-select partition equations; overlapping/multiple-select incidences are not partitions. This makes no differential-privacy or legal-protection claim.

a browser journey opens a shared link without an operator session, sees the aggregates, finds no response ID or identity in the page, and gets 404 after revocation.
A Worker and browser test shares a saved view of the same fixture with both summaries and the Plan × Renewal crosstab and opens it without an operator session: the summaries show Scale 8 and 43 responses; the crosstab is either withheld with the stated recovery reason, or shown with complementary suppression where solving the page's published sums over non-negative integers leaves every suppressed cell at least two feasible values; a nested collector cohort differing by 3 responses shows no breakdown; a multiple-select crossing applies no partition sum; an identifying hidden field is absent; lowering the threshold after sharing reveals nothing; and in the same run the operator's own results view and exports still show and contain the 3 Scale × Renew responses.
This is future acceptance, not a runtime claim.

## RSLT-010

Any view exports to PDF, PowerPoint (PPTX) and XLSX with its charts, denominators and filters stated on each page. This clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker test exports a view to each format and asserts each contains the stated filter text and the same counts as the view.
It inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.

## RSLT-011

An operator can schedule a view to be emailed weekly or monthly to named operators as aggregates with a link to the authenticated view, under NOTIFY-004's no-reply rules and WS-002 hours. This clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker test advances a fake clock to two scheduled sends and asserts two deliveries with aggregates and no answer text or respondent identity.
It inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.

## RSLT-013

Results show views, starts and submissions per revision, per source (link, embed, popup, QR, collector) and per day, with start rate (starts ÷ views) and completion rate under RSLT-003's stated denominators. A view of a published form increments an anonymous aggregate counter keyed only by revision, source and day before interaction; no session or visitor record is created at load. The counter stores no identifier, cookie, IP address, user agent or host-page identifier and cannot be joined to a session or response. Preview loads are excluded. Automated exclusion runs at submission time only, using the honeypot field value and elapsed time from form load to submit, calculated from a signed, non-identifying load timestamp carried by the form and returned with its response; there is no server-side view record joined to it. RESP-015 uses this same elapsed-time rule. A filled honeypot or a submission under the minimum time in `seed.json → limits` excludes the submission from accepted responses, retains it with its reason under RESP-018 and allows an owner to reverse the exclusion. A human submission over the minimum time with an empty honeypot is not excluded by these checks. No later automation signal adjusts aggregate view counts. Reports state that views and starts are counted separately from accepted responses.

a browser journey loads a published form three times, starts it twice and completes it once, and results show 3 views, 2 starts and 1 submission with each rate beside its numerator and denominator; a preview load is not counted; a Worker test proves the stored view data holds only revision, source, day and count, with no stored record linking a view to a response; a bot filling the honeypot and a submission under the minimum time are both retained and excluded with their respective reasons, an owner can reverse each exclusion, and a human over the minimum with an empty honeypot is not excluded; elapsed time uses the signed, non-identifying load timestamp returned with the submission, and exclusions and reversals leave view and start counters unchanged while reports distinguish them from accepted responses.

## ACT-009

An action's owner is reminded by email and, when connected, Slack or Teams (INTEG-006) before its review date, on the date and weekly after it while unresolved, within WS-002 hours; a linked external task's status (INTEG-013) is shown on the action and refreshed. Pencil still never sets the verdict (ACT-005). Before means three calendar days before review; an action created during that lead period receives its before reminder at the next eligible sending opening. Existing delivery is email only. INTEG-006 inherits the same owner reminder timing, WS-002 deferral and verdict cancellation for Slack/Teams, and INTEG-013 inherits linked task status display and refresh on the action, each before that capability ships. No Slack/Teams connection or external status read-back ships today.

A Worker test advances a fake clock across the review date and asserts the before, on-date and weekly overdue emails arrive once in order, outside-hours mail is deferred rather than lost, repeated and concurrent cron ticks do not duplicate a reminder, and an owner verdict cancels queued retries and stops future reminders.
Missing/departed owners and owners without an email address receive no mail and have an honest action state.
The 1440/390 action journey inspects the email-only reminder state and its stopped state after the verdict.
INTEG-006 must extend this proof to connected Slack and Teams owner reminders with the same timing and cancellation before those ship; INTEG-013 must prove linked task status display and refresh on the action before its read-back ships.

## NOTIFY-005

An operator can define alert rules as LOGIC-006 conditions on answers, hidden fields, scores, calculations or payment state (for example NPS at or below 6, CSAT of 1 or 2, an order over $1,000) that notify named operators by email, in-app, Slack or Teams, and mobile push (MOB-003). Alerts carry the flow, the rule and an authenticated link, never answer text, unless the recipient has the identity grant (ROLE-002) and the operator chose to include the triggering answer in Slack or Teams. This clause inherits LOGIC-003: alert conditions accept stored numeric and text calculation operands under the same typed LOGIC-006 evaluator. This clause inherits PAY-001's payment state before it ships.

a Worker test submits a detractor and a promoter and asserts one alert per rule recipient for the detractor only, with no answer text in the email; a second rule (NPS at most 6 AND hidden field `plan` equals `enterprise`) alerts only for the enterprise detractor.
The Worker acceptance also proves an alert conditioned on a calculated total fires only for the matching total.

## NOTIFY-006

An Editor adds one or more response-email rules to a form. Each rule names its recipients, which may be operators or any other address (for example `sales@` or an office manager who never signs in), up to `seed.json → limits`; an optional LOGIC-006 condition on answers, hidden fields, scores, calculations or payment state, so enterprise inquiries go to sales and support requests to support; a subject and body that recall answers, hidden fields and calculated values with LOGIC-001; and an optional Reply-To taken from an email question on the respondent's path, so the recipient answers the lead straight from the inbox. A new non-operator address is sent one confirmation link before its first answer-bearing message, and responses that arrive meanwhile are delivered once it confirms (or dropped after 7 days, shown to the Editor); every message to a non-operator carries a one-click unsubscribe (RFC 8058 `List-Unsubscribe`) that stops that rule for that address. Messages are sent through `mail.sender.v1` from NOTIFY-004's no-reply address with the form's theme (BRAND-002), render every value as escaped text and escaped HTML, queue one delivery per rule recipient per released response (quarantined responses only on release, RESP-018) with DIST-006's durable attempts and retries, and link to the authenticated ledger without granting access. A Reply-To is set only from a value that passed the email question's validation, as one address; a value containing CR or LF is refused. Masking still holds: an answer marked sensitive (GOV-004) appears as "withheld, sign in to view"; a HIPAA-mode form (GOV-001) sends no answers and no respondent identity, only the form, time and authenticated link; invitation or contact identity is included only when the rule's author holds the ROLE-002 identity grant. Replies go to the respondent and never to Pencil, so NOTIFY-004 is unchanged. When this clause is activated, NOTIFY-002 is rewritten: per-operator answerless mail stays the default, and answers leave only through these rules. This clause inherits LOGIC-001 recall in email subjects and bodies: earlier answers, declared hidden fields and calculated values render as escaped text and HTML, with skipped or invalid values blank. This clause inherits FIELD-015: answer dates in subjects and bodies render in the question's published display format.

a Worker test with the mail receiver fixture adds a rule with a non-operator recipient, recall in subject and body, and Reply-To from an email question; the address confirms; a response with an `<b>bold</b>` answer and a sensitive answer yields one delivery to that address with the escaped answers, Reply-To equal to the respondent's typed address and the sensitive value absent; a second rule conditioned on "Enterprise" delivers only for that answer, and a third whose condition is (company size at least 50 OR email ends with `example.com`) delivers only when either holds; a Reply-To value containing CRLF is refused; the same rule on a HIPAA-mode form delivers no answer text; an unsubscribe stops the next delivery.
Its mail receiver acceptance also proves those three recall sources, blank skipped values and inert injected markup.
Its mail receiver acceptance also shows a FIELD-015 date in the published display format.

## GOV-001

An Owner can enable HIPAA mode after recording the Business Associate Agreements the installation relies on (Cloudflare, the mail provider, and any AI provider or integration that will receive PHI). In HIPAA mode forms marked PHI keep answers out of every email, alert, Slack or Teams message and AI request unless that destination has a recorded BAA; integrations without a recorded BAA cannot be connected to PHI forms; every view, export and download of a PHI response is written to the audit log; operator sessions time out after 15 idle minutes; and exports are labeled as containing PHI.

a Worker test enables HIPAA mode, proves a PHI form's alert and digest contain no answers, a Slack connection without a recorded BAA is refused, an AI analysis is refused until the AI provider BAA is recorded, and a ledger view writes an audit entry.

## GOV-002

The Owner chooses where response data and uploads live (US by default, using D1 and R2 jurisdiction or location settings where Cloudflare offers them); the chosen location is recorded at creation, shown in settings and in exports, and cannot silently change.

a deployment dry run with a US jurisdiction writes it into the generated Worker configuration, and the settings page and export manifest name it.

## GOV-004

A question can be marked sensitive (for example SSN, taxpayer ID, date of birth, bank details, health answers): its values are encrypted at rest with an installation key separate from database backups, masked in the ledger, exports and integrations unless the operator has the identity grant and reveals them, and every reveal is audited. Sensitive values never enter AI requests, alerts or confirmation emails. This clause inherits LEDG-006: ledger search matches a sensitive answer only for an operator allowed to see it.

a Worker test reads the raw D1 row and finds ciphertext only; an Analyst sees a mask; an Admin reveal writes an audit entry; an analysis run's provider request contains no sensitive value.
The acceptance also proves: a phrase from a sensitive answer finds the response only for an operator allowed to see it.

## GOV-005

Admins can search and export the audit log (sign-ins, role changes, publishes, exports, reveals, deletions, connection changes, approvals) by actor, form and time, with entries that cannot be edited or deleted except by the erasure tombstoning BASE-DATA-003 allows.

a browser journey performs an export and a role change and finds both in the audit viewer and its CSV export.
The existing native-route journey separately proves actor/form/activity/time filters, bounded pagination, safe details, snapshot CSV stability across later writes, workspace isolation and actor tombstoning; the role-change and missing event-family journey remains required.

## GOV-006

An Admin can find every response, partial, contact, upload, signature and payment reference linked to an email address or phone number, export them as a portable file for a CCPA/CPRA access request, and delete them under DATA-002 with one confirmed command that also requests deletion in connected integrations that support it and lists those that do not.

a Worker test seeds data across three forms for one email, exports the bundle, deletes it, and asserts DATA-002 effects plus a deletion call to a connected Google Sheet fixture.

## GOV-007

Consent questions can be bound to a purpose (email marketing, SMS marketing, transactional SMS) with the exact wording stored, and each response records per purpose whether consent was given, the wording shown and the time. For email marketing only, an Editor may instead mark the form itself as the opt-in, as a Typeform-style sign-up form does: the opt-in wording (for example "By subscribing you agree to receive our newsletter; unsubscribe any time") is shown directly above the submit button on every step that submits, is part of the published revision, and submitting the form stores it as that response's email-marketing consent record with its wording and time, so a rebuilt sign-up form needs no extra checkbox. SMS marketing consent is never form-level: it needs its own unticked consent question with the TCPA disclosure, and is never a condition of submitting. Pencil passes a typed or link-supplied email to Mango, Mailchimp (INTEG-007) or a contact to an SMS program only with the matching recorded consent, as CAN-SPAM and TCPA expect, and sends the consent time with it; a response without it is recorded in INTEG-015 as skipped with the reason "no marketing consent".

a Worker test submits one response with marketing consent and one without and asserts only the first reaches the Mailchimp receiver fixture with its consent wording and time; a form marked as the email-marketing opt-in shows its wording above the submit button, a submitted response stores a consent record with that wording and time and reaches the Mailchimp fixture, and publishing a form that marks itself as the SMS-marketing opt-in is refused.

## IMPORT-005

An operator connects a SurveyMonkey account (OAuth) or uploads its survey export, chooses surveys, and receives the IMPORT-001 review for pages, question types (including matrix and ranking), skip and display logic and advanced branching with its AND/OR conditions (mapped to LOGIC-006), collectors and custom variables, then imports responses through IMPORT-002 to IMPORT-004 with collectors mapped to DIST-017 collectors and custom variables to hidden fields, "Other (please specify)" answers and their text to FIELD-010 Other write-ins, descriptive text to FIELD-011 statement steps and text validation to FIELD-013. This clause inherits FIELD-013: map the source's text minimum/maximum lengths, input masks, supported patterns and custom validation messages to the published text settings. This clause inherits FIELD-016: map the source's rating or scale start, step count and low, middle and high labels to the published scale settings.

a Worker test imports a documented SurveyMonkey API v3 survey and response fixture with logic, a matrix, an "Other (please specify)" answer and a descriptive-text item, asserts the write-in lands on the Other choice and the text becomes a statement step, asserts an advanced-branching rule with two AND conditions arrives as one LOGIC-006 rule, asserts the review lists every element's outcome, and undo removes it all.
The importer acceptance includes a source fixture with those settings and a collected answer that obeys them, and a labeled scale that arrives with its start, steps and labels.

## IMPORT-006

An operator connects a Jotform API key or uploads its form export and receives the reviewed import for fields, conditions (with their All/Any linking and operators, mapped to LOGIC-006 rules and FIELD-008 show/hide), calculations, payment fields (mapped to PAY-001 with a reconnect prompt), upload fields (files copied into FILE-001 storage), signatures (kept as images with their submission dates, not re-signed), "Other" options on radio and checkbox fields with their write-in text (FIELD-010), paragraph and header fields as statement steps (FIELD-011), input masks (FIELD-013), date formats (FIELD-015) and submissions. This clause inherits FIELD-013: map the source's text minimum/maximum lengths, input masks, supported patterns and custom validation messages to the published text settings. This clause inherits FIELD-016: map the source's rating or scale start, step count and low, middle and high labels to the published scale settings. This clause inherits FIELD-015: map the Jotform date format and separator to the published date display settings.

a Worker test imports a Jotform API fixture with an Any-linked condition using `contains` and `isEmpty`, a calculation, an upload, a payment field, a radio field answered with Other text, a paragraph field and an input mask, and asserts each outcome, the condition as one LOGIC-006 rule, the copied file, the write-in on the Other choice, the statement step and the mask.
The importer acceptance includes a source fixture with those settings and a collected answer that obeys them, and a labeled scale that arrives with its start, steps and labels.
The fixture also carries a Jotform date format that arrives as the question's display format and separator.

## IMPORT-007

An operator retrieves a Typeform definition and its responses (including hidden fields, mapped to FIELD-001) with a Typeform token, with every Statement after the first as a FIELD-011 statement step, `group` and `inline_group` fields as FIELD-012 groups, `allow_other_choice` and its `choice.other` answers as FIELD-010 Other write-ins, `max_length` as a FIELD-013 maximum, date `structure` and `separator` as a FIELD-015 format, logic jumps with `and`/`or` conditions on fields, hidden fields and variables as LOGIC-006 rules, the `add`, `subtract`, `multiply`, `divide` and `set` actions that compute `score`, `price` and custom variables (with the definition's starting `variables` values and each action's condition) as LOGIC-003 calculations, where adding a constant to `score` when a choice is picked becomes that choice's LOGIC-004 points, opinion-scale `start_at_one`, `steps` and `labels` as FIELD-016 scales, and the meta title, description, image and `allow_indexing` setting as DIST-020 link-preview settings, together with its theme (fonts, element colors, background image and brightness, and screen layouts) as a BRAND-002 theme shown in the import review, where a font that cannot be self-hosted is replaced by the nearest bundled one and the review says so, and a Google Form and its responses through Google sign-in, with text items as statement steps and `isOther` options with their typed values as Other write-ins, without exporting files, under the same review, privacy and undo rules.

Worker tests retrieve definition and responses from Typeform and Google Forms API fixtures, assert hidden fields map to declared fields, assert a Typeform theme fixture becomes a BRAND-002 theme in the review with its colors, background and brightness, assert a Typeform `and` jump over a field, a hidden field and a `contains` condition arrives as one LOGIC-006 rule, assert the Typeform meta settings arrive as DIST-020 settings, assert a fixture that adds 10 to `score` when one choice is picked and jumps when `score` is greater than or equal to 10 imports as LOGIC-004 points and a LOGIC-006 rule that routes that choice and no other, with no unsupported item, assert a `price` built by `multiply` and `divide` actions arrives as one LOGIC-003 expression whose stored total matches Typeform's for three answer sets, assert an opinion scale with `start_at_one: false`, 7 steps and three labels arrives as a FIELD-016 0–6 scale with those labels, assert a mid-flow Typeform Statement, a group and an Other write-in and a Google Forms text item and `isOther` answer arrive as statement steps, a group and Other write-ins, and assert no credential is retained.

## IMPORT-008

Tally, Fillout, Formbricks and Microsoft Forms definitions and responses import through their documented exports or APIs under IMPORT-001 to IMPORT-004, with their Other options and write-ins, text or statement blocks and text validation mapped to FIELD-010, FIELD-011 and FIELD-013.

one Worker fixture per source imports a form with branching, an Other write-in and a text block and its responses, asserts the write-in and the statement step, and undoes it.

## IMPORT-009

Every import ends with a checklist of what the source form did that Pencil must be told to do again: webhooks and integrations to reconnect (with the matching INTEG connection pre-selected), embeds to replace (with the new snippet), payment and email notifications to re-enable, and public links to update, with self-notification rules (NOTIFY-006), ad conversion connections (INTEG-017) and identified links (RESP-023) carried as items of their own. A HubSpot, Salesforce, Orbit, Mailchimp or Mango item opens that connection's mapping (INTEG-003 to INTEG-005, INTEG-007) with the imported form's email question pre-chosen as the contact or member key when it has exactly one, and its hidden fields listed for mapping, so the operator only confirms the properties or merge fields. Each embed item writes the replacement snippet with the old embed's behavior: the operator pastes the old embed code into the item, and Pencil reads Typeform's `data-tf-transitive-search-params` and `data-tf-hidden` attributes (or the Embed SDK's `transitiveSearchParams` and `hidden` options) and its mode (`data-tf-widget`, `data-tf-popup`, `data-tf-slider`, `data-tf-popover`, `data-tf-sidetab`), and writes the forwarded names as DIST-021 `data-pencil-forward`, each static `hidden` value as a fixed `data-pencil-<field>` attribute and the mode as the matching DIST-013 mode; a forwarded or hidden name the imported form does not declare is listed with a one-click action that declares it under FIELD-001. Without pasted code, and for other sources, the forward list is pre-filled with the imported form's campaign and click-ID fields; each item is ticked when done. The checklist says plainly that Pencil cannot redirect the old provider's URLs, so printed QR codes, sent emails and old embeds keep pointing at the source form, and lists each with the new link and QR code and the source's own way to send respondents on (for example a Typeform ending that redirects to the new link).

a Worker test imports a Typeform fixture with a webhook and a Google Sheets integration and asserts both appear as unchecked items that close when the matching connections exist, and that the checklist names the old public link as one Pencil cannot redirect; a pasted Typeform popup snippet with `data-tf-transitive-search-params="utm_source,gclid,ref"` and `data-tf-hidden="source=site"` yields a popup Pencil snippet with `data-pencil-forward="utm_source,gclid"` and `data-pencil-source="site"`, and lists `ref` as undeclared with its declare action; the Typeform fixture's HubSpot integration item opens the INTEG-003 mapping with its one email question pre-chosen as the contact key.

## PAY-001

Stripe is connected through Connect OAuth or with a restricted key, and an operator adds a payment step: fixed products with prices in USD, quantities, option prices, or an amount from a calculation (LOGIC-003), with a minimum and maximum. The payment step may sit anywhere after every question whose answer sets its amount and before a completion screen; FLOW-006 refuses a payment step that a later answer could change. At the payment step the respondent is sent to Stripe Checkout, Stripe's hosted page, because an inline card field would load a third-party origin onto the respondent page (BASE-PUBLIC-001); success returns the respondent to the completion screen their path reached (RESP-011), and canceling returns them to the payment step with every answer kept, the pending response marked `cancelled` and replaced by their next attempt under RESP-012's key, so one session yields one response. The response is committed under RESP-007 with payment `pending`, becomes `paid` only on a signature-verified Stripe webhook for that Checkout Session, and shows `failed`, `expired` or `refunded` from later events. Admission limits (RESP-008, RESP-009) count only paid responses on payment forms, and an unpaid response never triggers a paid-only integration. This clause inherits LOGIC-003: payment amounts may use validated numeric calculations from the published revision, recomputed on the server. Today's door is the restricted key, and only the installation owner uses it: the owner connects Stripe with a restricted key and the signing secret of the webhook endpoint the owner creates; both are sealed under INTEG-016's custody, never returned, logged or exported, and only the owner saves, tests or removes them. Connect OAuth stays a named target step of this clause and is not built. FLOW-006 refuses, naming the payment step, a payment step after a completion screen, one that does not lead straight to a completion screen, one placed before a question that sets its amount, a calculated amount that reads a hidden field (a link value the respondent controls) or a question that a path to the step can skip, and any amount that can fall outside its minimum and maximum; a path therefore reaches at most one payment step. The amount sent to Stripe is the server's, and a submitted amount is refused. A webhook counts only with a valid Stripe v1 HMAC-SHA256 signature over the raw body within a five-minute timestamp tolerance, and each event ID applies once; canceling ends the old Checkout at Stripe before the next attempt replaces it, and an invitation's unpaid response is replaced by the invitee's next attempt rather than duplicated. On payment forms only paid responses complete an invitation and count toward a completion target or a collector's response limit, and operator response emails and daily digests (NOTIFY-002, NOTIFY-003), the paid-only integrations that exist today, wait for payment. Response state, payment state and Stripe Checkout Session and PaymentIntent IDs travel through DATA-001 export and import, without the live checkout link or return key, and DATA-002 erasure, and therefore GOV-003 retention, removes them with the response; card or bank numbers are never stored. An embedded payment form asks its host page to open Checkout at top level and returns to the form's own page. NOTIFY-005 alert conditions and PAY-002 to PAY-005 inherit this payment state, each before it ships. Under RL-102, replacement verifies the original Checkout is terminal and cannot complete, preserves its attempt evidence, and atomically binds a fresh attempt to the same response and current Checkout preferences while resetting only derived current billing fields. Pending or uncertain originals block replacement; paid originals never retry. Until that invariant is implemented, replacement is refused.

a Worker test with a Stripe receiver fixture completes a paid order, asserts the amount sent equals the calculated total, marks paid only on a correctly signed webhook, ignores a forged one, and leaves an abandoned Checkout as expired; a browser journey with the Stripe fixture returns from success to the branched completion screen, and returns from cancel to the payment step with every answer shown and one response after a second attempt.
The payment acceptance also proves a calculated total reaches the provider unchanged and a client-supplied replacement amount is refused.

## PAY-002

Payment steps can apply Stripe Tax for US sales tax by the respondent's address, Stripe coupons and promotion codes, and Stripe's receipt email; the response and exports carry subtotal, discount, tax and total. This clause inherits PAY-001's payment state before it ships.

a Worker test with fixture tax and coupon responses asserts the stored subtotal, discount, tax and total columns.

## PAY-003

A payment step can start a Stripe subscription (monthly or yearly price) or take a donation with suggested and custom amounts, optionally recurring; subscription status changes arrive by webhook and appear on the response. Ongoing billing management belongs to Stripe's customer portal or the sibling Nectar. This clause inherits PAY-001's payment state before it ships. Closed-attempt replacement follows PAY-001 and RL-102; temporary refusal leaves the safe subscription and donation retry door owed.

a Worker test starts a subscription and a custom donation and asserts both statuses and a later cancellation event on the response.

## PAY-004

Payment steps can offer ACH Direct Debit (Stripe US bank account), Apple Pay and Google Pay through Checkout, and PayPal or Square as alternative providers with the same pending/paid/failed states; ACH's delayed settlement is shown as `processing` until it succeeds or fails. This clause inherits PAY-001's payment state before it ships. Closed-attempt replacement follows PAY-001 and RL-102; temporary refusal leaves the safe ACH retry door owed.

a Worker test drives an ACH payment through processing to succeeded and to failed, and a PayPal fixture order to paid.

## PAY-005

Operators with the identity grant see each response's payment (provider, ID, amount, method type, status, last-4 only), filter and export by payment status, reconcile totals by period against the provider, and issue a full or partial refund through the provider after confirming the amount; the refund's status comes back by webhook. This clause inherits PAY-001's payment state before it ships. Under RL-103, cursor-paged views and exports cover the complete period, or explicitly report an incomplete result that cannot be accepted as reconciled until all pages are included. Uncertain-refund reservations remain held until provider readback resolves them. Legacy source timestamps remain labelled historical last-change provenance, never known transaction dates, and closed totals are not silently rewritten.

a browser journey refunds $10 of a $40 payment, sees `partially refunded` after the webhook, and the payments export shows both amounts.

## FILE-001

A question accepts one or more files with operator-set limits on count, size (up to `seed.json → limits.upload`) and type; uploads are part of the response: they follow RESP-010 or PART-001, DATA-001 export, DATA-002 erasure and GOV-003 retention, and are excluded from AI requests unless AI-003 applies. Files wait in quarantine until a configured malware scanner (FILE-003) passes them where one is configured.

a browser journey uploads a PDF and a JPEG, a renamed executable is refused, the operator downloads the PDF through a signed URL that expires, and deleting the response deletes the R2 objects.

## FILE-002

Uploaded files and submission PDFs (WORK-005) can be copied to Google Drive, Dropbox, OneDrive/SharePoint, Box or the sibling Chest, in a folder per form or per response named by a pattern; copies are tracked as integration deliveries (INTEG-015) and erasure lists copies the provider cannot delete.

a Worker test with a Google Drive receiver fixture copies two uploads into a per-response folder and retries a transient failure with the same idempotency key.

## FILE-003

When a malware-scanning connection is configured (for example Cloudmersive or a VirusTotal private scanning key), every upload is scanned before operators can download it; infected files are kept in quarantine with the verdict and never forwarded to storage sync. Without a scanner, settings state that uploads are unscanned.

a Worker test with a scanner receiver fixture marks one EICAR test file infected and keeps it from download and sync while a clean file proceeds.

## SIGN-001

A form can ask for a typed or drawn signature after an ESIGN Act and UETA consent statement. Pencil stores the signature image, the consent wording, the signer's typed name and email, time, the published revision, and a SHA-256 hash of the signed answers, renders a signed PDF with an audit page (WORK-005), and makes any later change to the answers visible as a new version rather than altering the signed one. Multi-party envelopes, signing order, identity verification and certificate-based signatures belong to the sibling Inkwell, to which a submission can hand off its PDF.

a browser journey signs a form by drawing, the signed PDF contains the consent text, signature and hash, and a recomputed hash over the stored answers matches.

## AI-003

A form may ask the respondent to upload a document (for example an invoice, a W-9 or a business license) and prefill later questions from fields `ai.provider.v1` extracts; every prefilled value is shown for correction and stored with an extracted/corrected marker. Extraction carries standard, adding sensitive for regulated document fields; the company’s policy decides whether readings fill the fields or wait for confirmation. No identity, credit or eligibility decision is made from the extraction.

a Worker test with the AI receiver fixture extracts three fields from a fixture invoice, the respondent corrects one, and the response stores two `extracted` and one `corrected` values.

## PROG-001

An operator creates an NPS, CSAT or CES program with a question set (FIELD-003), audience (segment, CRM list, in-product users or ticket events), channels (email-embedded question DIST-014, SMS DIST-011, in-product DIST-015) and cadence (relationship surveys on DIST-016, or transactional triggers PROG-002), with a contact-level fatigue rule shared across programs.

a Worker test creates a quarterly NPS program and a transactional CSAT program for overlapping contacts and asserts the fatigue rule suppresses the second survey inside the window.

## PROG-002

A program sends its survey after an event: a ticket solved in HappyToHelp, Zendesk, Intercom or Help Scout; an order fulfilled in Stall or Shopify; a deal won in Orbit or HubSpot; or any signed API call (INTEG-011), after a configured delay and only once per event ID. The response records the triggering event (for example the ticket ID and agent) for reporting.

a Worker test posts a HappyToHelp "ticket solved" event twice and asserts one CSAT invitation after the delay, with the ticket ID on the response and in the per-agent CSAT report.

## PROG-003

Program dashboards show the score over time (RSLT-007) with promoter/passive/detractor or satisfied shares, margin of error at 95% confidence, response rate, and breakdowns by account, plan, agent, channel or any hidden field, with ANLY-005 suppression.

a Worker test seeds a quarter of responses and asserts weekly NPS, its margin of error and the per-agent CSAT table against hand-computed values.

## PROG-004

A detractor, low CSAT or high-effort response opens a follow-up item with an owner, a due time and the respondent's permission state; the owner records the outreach and outcome, and the item can be sent as a ticket to HappyToHelp or Zendesk or as a task on the account in Orbit or HubSpot. Program reports show the share of detractors followed up within the target time. Anonymous responses open follow-up items with no contact route.

a Worker test submits an identified detractor and asserts a follow-up item, a ticket created at the help-desk receiver fixture with the confirmed fields only, and a closed item counted in the follow-up rate.

## INTEG-001

A form syncs each released response to a chosen Google Sheet as a row with columns keyed by stable step ID (labels in the header, new columns appended when questions are added), backfills existing responses on connection, updates rows on edit (RESP-021) and deletes or blanks them on erasure (DATA-002).

a Worker test with a Sheets receiver fixture backfills three responses, appends a fourth, adds a column after a republish, and deletes a row on erasure.

## INTEG-002

The same sync as INTEG-001 writes to an Excel workbook table in OneDrive or SharePoint through Microsoft Graph.

a Worker test with a Graph receiver fixture appends rows to a workbook table and deletes one on erasure.

## INTEG-003

An Admin connects a HubSpot account by OAuth under INTEG-016's custody (contacts, companies, deals, notes and property-schema read scopes), and an Editor attaches it to a form whose published RESP-005 disclosure names HubSpot. **The typed-email lead is the primary path:** on a form in the default anonymous mode (RESP-005, RESP-023), the Editor chooses one email question as the contact key, and a released response (RESP-007) that answered it creates the HubSpot contact, or updates the existing one, matched by that email (trimmed, validated as an email and compared case-insensitively, as HubSpot matches it), so a lead who reaches an ordinary public link, ad link or embed and types a work email reaches sales with no `?email=` on the link. A RESP-023 identified response uses its link-supplied email when no email question is chosen or the chosen one is left blank. Inside Pencil RESP-006 still holds: the typed email is stored only as that answer, the response gets no Pencil contact, participant or link-supplied identity, and RESP-005's disclosure says before the first answer that the email and mapped answers are sent to the business's HubSpot. **The mapping is defined:** the connection lists the account's existing contact, company and deal properties from HubSpot's properties API (refreshed on open and on demand), and the Editor maps to them any answer (a choice as its label or a per-option value; a multi-select as HubSpot's semicolon-separated checkbox value; a date as a HubSpot date; a number as a number), the FIELD-001 hidden fields including `utm_*` and click IDs, LOGIC-003 calculations and LOGIC-004 scores and outcomes, the form name, the submission time and the authenticated response link. Pencil creates no HubSpot property of its own. A mapping to a property that does not exist, is read-only or calculated, or whose type does not fit the source (text into a number, a free answer into an enumeration whose options it does not match) is refused when it is saved, and the refusal names the property and the reason; a property deleted or changed in HubSpot after saving is reported at delivery in INTEG-015 with HubSpot's error reason and named on the form's connection page, and the rest of the delivery is not silently dropped. A blank or skipped answer (FLOW-020) never clears an existing HubSpot value, and each mapped property is set to overwrite (default) or fill only when empty. Optionally the delivery creates or updates a company matched by a mapped domain property and associates the contact to it, creates a deal in a chosen pipeline and stage associated to the contact, and adds a note on the contact timeline carrying the form name and the response link, never answers outside the mapping. One delivery per released response carries an idempotency key, so a retry or replay never creates a second contact or deal; an edit (RESP-021) re-sends the mapped properties as an update. **Nothing is sent** for a response whose published revision's disclosure does not name HubSpot, and for a response with neither a typed nor a link-supplied email: Pencil never creates a contact keyed by anything else, and INTEG-015 records that delivery as skipped with the reason "no contact email". From an anonymous form no session, invitation, host-page or network identifier is ever sent (RESP-006, DIST-021); only the mapped answers and hidden fields go. **Partial leads:** on a form that also opts in to PART-001, the Editor may turn on early upsert, which sends the contact once the contact-key question's step is saved, under PART-001's disclosure naming HubSpot, with the mapped answers given so far and a mapped status property set to `partial`; the completed response updates the same contact and sets it to `completed`, and a partial deleted at PART-001 retention sends nothing further. When this clause activates, RESP-006's typed-answer sentence is amended to name delivery of a typed email as the contact key to a CRM connection the disclosure names.

a Worker test with a HubSpot receiver fixture publishes a form in the default anonymous mode whose disclosure names HubSpot, with an email question chosen as the contact key, a company question mapped to `company` and a `utm_campaign` hidden field mapped to a contact property, and asserts that (1) a response opened with `?utm_campaign=spring` that types `lead@example.com` produces one contact upsert by that email carrying the mapped company and `utm_campaign=spring`, and Pencil's stored response has no contact link or participant (RESP-006); (2) a second response typing the same email in a different case updates that contact and creates no new one; (3) a response that leaves the optional email blank sends nothing and records a skipped delivery naming "no contact email"; (4) the same form republished with a disclosure that omits HubSpot sends nothing; (5) a mapping to a property the fixture account lacks is refused at save, and the refusal names the property; a blank answer leaves the fixture's existing value in place; a replayed delivery creates no second contact; a property deleted in the fixture after saving yields a failed INTEG-015 delivery carrying HubSpot's error reason; a RESP-023 identified response with `?email=` and no chosen email question upserts by the link-supplied email; and on a PART-001 form with early upsert, answering the email step and abandoning sends one contact marked `partial`, and completing a second session with the same email updates it to `completed`.

## INTEG-004

An Admin connects a Salesforce org by OAuth under INTEG-016's custody, and an Editor attaches it to a form whose disclosure names Salesforce. INTEG-003's contact-key rules hold unchanged: the chosen email question's typed answer on a default anonymous form (or, when none is chosen or it is blank, a RESP-023 link-supplied email) is the key, RESP-006 holds inside Pencil, and a response with no email, or whose disclosure omits Salesforce, sends nothing and is recorded as skipped with its reason. The Editor chooses Lead or Contact as the record type: Pencil looks the email up case-insensitively, updates the matching Contact (if any) or else the matching Lead, choosing the most recently modified when several match and recording that choice on the delivery, and otherwise creates a Lead (with a mapped or default `Company`, which Salesforce requires). INTEG-003's mapping rules hold against Salesforce's own schema: the connection lists the record type's existing fields from the describe API, the Editor maps answers, FIELD-001 hidden fields including `utm_*`, LOGIC-003 calculations, LOGIC-004 scores and the response link to them (picklist answers only to matching picklist values), a missing, read-only or type-incompatible field is refused at save with its name, a field changed later is reported at delivery in INTEG-015 with Salesforce's error, blank answers never clear values, and deliveries are idempotent. Optionally the delivery adds the record as a member of a chosen campaign (or of the campaign named by a mapped `utm_campaign`) and opens a case. PART-001 early upsert works as in INTEG-003.

the INTEG-003 journey against a Salesforce receiver fixture: a default anonymous form typing `lead@example.com` upserts one Lead carrying the mapped company and `utm_campaign=spring`, a second response in a different case updates that Lead, a blank email sends nothing, a disclosure omitting Salesforce sends nothing, a mapping to a field the fixture org lacks is refused at save naming the field, an email matching an existing Contact updates the Contact and creates no Lead, and a field-type mismatch introduced after saving is reported as a failed delivery with its reason.

## INTEG-005

The sibling CRM Orbit receives contacts, deal notes and response links natively under INTEG-003's contact-key, mapping and nothing-sent rules: the chosen email question's typed answer on a default anonymous form, or a RESP-023 link-supplied email, creates or updates the Orbit contact by that email (case-insensitively), answers, FIELD-001 hidden fields including `utm_*`, calculations and scores are mapped to Orbit's existing contact and custom fields as listed from Orbit's API and refused at save when missing or mistyped, a response with no email or whose disclosure omits Orbit sends nothing, and RESP-006 holds inside Pencil; Orbit can launch a Pencil invitation from a contact or deal.

a Worker test with an Orbit receiver fixture sends a default anonymous response typing `lead@example.com` and finds one Orbit contact carrying the mapped company and `utm_campaign`, a second response in a different case updates it, a blank email sends nothing, a mapping to a missing custom field is refused at save naming it, and an Orbit-initiated invitation is accepted for one contact.

## INTEG-006

A form or alert rule (NOTIFY-005) posts to a Slack or Teams channel (and the sibling Nook) with the flow, time, a summary of non-sensitive answers when allowed, and an authenticated link; actions can be created from the message. This clause inherits ACT-009: connected Slack and Teams remind the action owner three calendar days before review, on the review date and weekly while unresolved, within WS-002 hours, deferring outside-hours work and stopping on the owner verdict, before those connections ship.

a Worker test with Slack and Teams receiver fixtures posts a new response, refuses sensitive fields, and creates an action from the Slack interaction payload after verifying its signature.
The receiver proof also advances the review clock and verifies ACT-009 owner reminder timing, once-only delivery, sending-window deferral and cancellation after the owner verdict for both Slack and Teams.

## INTEG-007

An Admin connects a Mailchimp account by OAuth (or a sibling Mango workspace) under INTEG-016's custody, and an Editor attaches one Mailchimp audience or Mango list to a form whose published RESP-005 disclosure names that platform. **The typed email is the primary path:** on a form in the default anonymous mode (RESP-005, RESP-023), the Editor chooses one email question as the member key, and a released response (RESP-007) that answered it and holds GOV-007 email-marketing consent adds the audience member, or updates the existing one, by that email (trimmed, validated as an email and matched case-insensitively, as Mailchimp's subscriber hash of the lower-cased address matches it), so a visitor who types their email into an ordinary public link, a blog embed or a popup joins the audience with no `?email=` on the link. A RESP-023 identified response uses its link-supplied email only when no email question is chosen or the chosen one is left blank. Inside Pencil RESP-006 still holds: the typed email is stored only as that answer, the response gets no Pencil contact, participant or link-supplied identity, and RESP-005's disclosure says before the first answer that the email and mapped answers are sent to the business's Mailchimp (or Mango). When this clause activates, RESP-006's typed-answer amendment (INTEG-003) names email-platform connections as well as CRM connections. **The mapping is defined:** the connection lists the audience's existing merge fields (with their types, options and required flag), tags and interest groups from Mailchimp's API, or the list's fields and tags from Mango's API, refreshed on open and on demand; the Editor maps to merge fields any answer (a name question to `FNAME` and `LNAME`; a choice to a dropdown or radio merge field only through matching options; a date in the audience's date format; a number to a number; a phone to a phone), FIELD-001 hidden fields including `utm_*`, LOGIC-003 calculations, LOGIC-004 scores and outcomes, the form name and the submission time. A choice, multiple-choice, yes/no or ranking answer, or a LOGIC-004 quiz outcome, becomes one tag per selected option (its label or a per-option tag name) or sets the matching Mailchimp interest group, and the Editor can set fixed tags added to every delivery from that form (for example `newsletter-form`); a free-text answer never becomes a tag. A mapping to a merge field that does not exist or whose type or options do not fit the source, and an audience merge field marked required that no mapping fills, is refused when it is saved, and the refusal names the merge field and the reason; a tag the audience does not have yet is shown as new and is created only when the Editor confirms it at save. A merge field deleted or changed in Mailchimp after saving is reported at delivery in INTEG-015 with Mailchimp's error reason and named on the form's connection page. A blank or skipped answer (FLOW-020) never clears an existing merge field, and tags are only ever added, never removed. **Status and consent are precise:** a new member gets the status the Editor chose for the connection, subscribed or pending (Mailchimp's double opt-in, which sends Mailchimp's confirmation email), with GOV-007's consent time sent as the opt-in time and no IP address ever sent; an existing subscribed or pending member keeps that status and has its merge fields and tags updated; an existing member who unsubscribed or was cleaned, or that Mailchimp holds in a compliance state, is never resubscribed and is not changed, and INTEG-015 records that delivery as skipped with the reason ("unsubscribed", "cleaned" or Mailchimp's compliance reason). **Nothing is sent** for a response whose published revision's disclosure does not name the platform, for a response without matching GOV-007 email-marketing consent (reason "no marketing consent"), and for a response with neither a typed nor a link-supplied email (reason "no member email"), each recorded in INTEG-015 as skipped. Partial responses (PART-001) are never sent to an audience. One delivery per released response carries an idempotency key, so a retry or replay never adds a second member or repeats a tag; an edit (RESP-021) re-sends the mapped merge fields and adds any new tags. Mango lists take the same rules against Mango's own list fields and tags.

a Worker test with a Mailchimp receiver fixture publishes a form in the default anonymous mode whose disclosure names Mailchimp, with an email question chosen as the member key, a name question mapped to `FNAME`, an interest choice mapped to tags, a fixed tag `newsletter-form` and a consent question bound to email marketing, and asserts that (1) a response typing `Reader@Example.com` with consent produces one member upsert by that email (the fixture receives the lower-case subscriber hash) carrying `FNAME`, the interest tag and `newsletter-form`, with status `subscribed`, and Pencil's stored response has no contact link or participant (RESP-006); (2) a second response typing the same email in a different case updates that member and adds no new one; (3) a response without consent and one that leaves the email blank each send nothing and record a skipped delivery naming "no marketing consent" and "no member email"; (4) a fixture member already unsubscribed stays unsubscribed with its merge fields unchanged, and that delivery is recorded as skipped naming "unsubscribed"; (5) a mapping to a merge field the fixture audience lacks is refused at save naming the field, and so is a form that leaves the fixture's required `LNAME` unmapped; (6) with pending status chosen, a new member arrives as `pending`; a blank name answer leaves the fixture's existing `FNAME` in place; a replayed delivery adds no second member; a merge field deleted in the fixture after saving yields a failed INTEG-015 delivery carrying Mailchimp's error reason; a RESP-023 identified response with `?email=` and no chosen email question upserts by the link-supplied email; a form using GOV-007's form-level opt-in, with no consent checkbox, delivers its typed email; and the same journey against a Mango receiver fixture adds one list member with the mapped field and tags.

## INTEG-008

A form creates or updates a record per released response in a Notion database, an Airtable table or a sibling Cradle base, under INTEG-016's custody and with the same delivery tracking (INTEG-015). **The mapping is defined:** the connection lists the destination's existing columns and their types from Notion's database API, Airtable's base-schema API or Cradle's schema, refreshed on open and on demand, and the Editor maps to them any answer, FIELD-001 hidden fields including `utm_*`, LOGIC-003 calculations, LOGIC-004 scores and outcomes, the form name, the submission time, the response ID and the authenticated response link. Types are converted, never guessed: a choice goes to a single select (Notion `select` or `status`, Airtable single select) by option name, a multiple-choice answer to a multi-select (Notion `multi_select`, Airtable multiple selects), a yes/no to a checkbox, a number, rating, opinion scale or score to a number, a date to a date, an email, phone or URL answer to the matching typed column, text to text, and a FILE-001 upload to a text or URL column as authenticated links, never as a public attachment. A mapping to a column that does not exist, is computed (formula, rollup, lookup, created time) or whose type does not fit the source is refused when it is saved, and the refusal names the column and the reason; a choice whose options are not all present on the mapped select column is refused at save naming the missing options, unless the Editor turns on "add missing options" for that column, in which case Notion or Airtable (with `typecast`) creates them on first use. A column deleted, renamed or retyped after saving is reported at delivery in INTEG-015 with the platform's error reason and named on the form's connection page. Each record is keyed by a mapped Pencil response ID column, so a retry or replay never creates a second record and an edit (RESP-021) updates the same record; optionally the Editor chooses a match column (for example an email answer) to update an existing record instead of creating one. A blank or skipped answer never clears an existing value. Rate limits are honored: a 429 from Notion or Airtable is retried after the platform's `Retry-After` within INTEG-015's bounded retries.

a Worker test creates one record in each receiver fixture and retries a rate-limited Airtable call after its `Retry-After`; against the Airtable fixture, a form maps a choice to a single select, a multiple-choice answer to a multiple-selects column, a date and a number, and the created record carries those values; a choice with an option the select column lacks is refused at save naming the option, and is accepted and delivered with `typecast` once "add missing options" is on; a mapping to a column the fixture table lacks is refused at save naming it; an edited response updates the same record; a column deleted in the fixture after saving yields a failed INTEG-015 delivery carrying Airtable's error reason; and against the Notion fixture the record is a page whose title, `select` and `multi_select` properties carry the mapped answers.

## INTEG-009

Pencil publishes a Zapier app and Make and n8n modules with triggers (new response, updated response, partial saved, payment paid, approval decided) and actions (find response, create contact and send invitation), built on INTEG-010 and INTEG-011, and is a native source in the sibling Crank. DOCS-001 gives a tested recipe for each CRM in Typeform's catalog that Pencil does not connect natively (ActiveCampaign, Pipedrive, monday.com and Zoho CRM), mapping answers, hidden fields and the RESP-023 identity to that app's create-or-update action.

a Worker test subscribes a REST-hook trigger the way Zapier does, receives a new-response event, and unsubscribes; the published app definition validates with the Zapier CLI in CI; each documented recipe's sample payload validates against the trigger's published output schema.

## INTEG-010

An operator registers HTTPS endpoints per form or workspace for response created, updated, deleted, partial saved, payment changed and approval decided events. Each delivery carries an event ID, timestamp and HMAC-SHA256 signature over the body, is retried with backoff for 24 hours on failure, records every attempt, can be replayed, and is disabled with an alert after sustained failure.

a Worker test receives a signed event, verifies the signature, returns 500 twice and sees two retries with the same event ID, then replays it; a disabled endpoint shows its alert.

## INTEG-011

A versioned REST API (`/api/v1`) with an OpenAPI document lets scoped API tokens list and read forms; create, update, duplicate and publish forms (`forms:write`: definitions in the same JSON as the import format, refused unless they pass FLOW-006 and FLOW-012 to FLOW-014, with publish creating an immutable FLOW-008 revision); manage hidden fields, themes (BRAND-002) and webhooks (INTEG-010); read and delete responses with filters and cursor pagination, create contacts and launch invitations, and fetch results aggregates; tokens are created by Admins with scopes and expiry, are hashed at rest, rate-limited, audited, and respect ROLE-002 form access and masking. For results-aggregate tokens without a response-read scope, this clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker test creates a read-only token, pages through 250 responses, is refused a delete, and the OpenAPI document validates; a `forms:write` token creates a branching form and publishes it, and a definition with a dangling branch is refused with the step ID.
For results-aggregate tokens without a response-read scope, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.

## INTEG-012

An authenticated MCP endpoint lets an operator's Claude or ChatGPT client list forms, draft a form (AI-001 rules: never published by the tool), query results and crosstabs with ANLY-005 suppression, read cited excerpts, and propose an invitation or action that the operator confirms in Pencil. Tool calls carry the operator's identity and role. Within one tool result, this clause inherits RSLT-009's aggregate-only disclosure rule, before it ships.

a Worker test connects an MCP client over OAuth, drafts a form, queries a suppressed cohort and receives no excerpts, and a proposed invitation stays unsent until confirmed in the app.
Within one tool result, it inherits the RSLT-009 aggregate-only fixture: the same figures are refused or complemented identically.

## INTEG-013

Actions (ACT-003) can be sent to Linear, Jira, Asana, GitHub Issues and the sibling Vector as well as Todoist and a generic webhook, with the same create-or-get idempotency, confirmed payload and delivery states, and the linked task's status is read back for ACT-009. This clause inherits ACT-009: the linked external task status is shown on the action and refreshed, before status read-back ships; task status never sets the Pencil verdict.

a Worker test sends one action to each receiver fixture, repeats delivery without creating a second task, and reads back a closed status.
The receiver proof also refreshes a changed external status on the action page for ACT-009 while leaving the Pencil verdict unset.

## INTEG-014

HappyToHelp, Zendesk, Intercom, Help Scout, Stall and Shopify connect as event sources for PROG-002 through their signed webhooks, and Buoy receives program scores per account.

a Worker test verifies each source's webhook signature, refuses an unsigned event, and sends an account score to a Buoy receiver fixture.

## INTEG-015

Every outbound integration delivery (rows, records, contacts, messages, files, webhooks, tasks) has a durable state (pending, confirmed, unknown, failed), an idempotency key, every attempt with its reason, bounded retries, a replay action and an in-app alert on failure; a broken connection never blocks collection, and operators see exactly which response IDs were not delivered.

a Worker test breaks a Sheets connection, collects five responses, sees five failed deliveries and an alert, repairs the connection, replays, and asserts five confirmed rows with no duplicates.

## INTEG-016

Connections use OAuth with least-privilege scopes where the provider offers it, store secrets encrypted with an installation key bound to the setting's identity, can be tested, rotated and revoked from their page, are excluded from data exports, and update the disclosure (RESP-005) of every attached form automatically.

a Worker test connects, tests, revokes and reconnects a Sheets connection, proves the export excludes the token, and the attached form's disclosure gains and loses Google Sheets.

## INTEG-017

An Admin connects Meta (Conversions API: dataset or pixel ID and a system-user token), Google Analytics 4 (Measurement Protocol: measurement ID and API secret) and Google Ads (click-conversion upload through the Google Ads API with Google sign-in and a chosen conversion action) under INTEG-016's custody, and an Editor turns conversion events on per form. Pencil sends `completed` when a response is released (RESP-007, or RESP-018 on quarantine release) and `paid` when PAY-001 records a verified payment, with its amount in USD. Each event carries only the event name and time, the form's public ID, a random event ID for platform deduplication (also passed to the embed's host-page event), the click-ID fields the form declared under FIELD-001 (`fbclid` as Meta's `fbc`; `gclid`, `gbraid`, `wbraid` for Google), whether they arrived on the link or were forwarded from the landing page by a script embed (DIST-021), the declared campaign fields (`utm_*`), the GA4 client ID when a script embed reads it from the host's `_ga` cookie (`data-pencil-ga4="cookie"`) or receives it in a `hidden` call (DIST-021), or the link carries it in a declared `ga_client_id` field (FIELD-001), and for `paid` the value; it never carries answer text, response IDs or scores. Hashed identifiers (SHA-256 of normalized email and phone, as Meta `em`/`ph` and Google Ads enhanced conversions) are sent only from an identified form (RESP-023). On every form an event is sent only when the published revision's RESP-005 disclosure names that destination, and a respondent whose browser sends Global Privacy Control (`Sec-GPC: 1`) is treated as opting out of that sharing under CCPA/CPRA, so no event is sent for that response. On an anonymous form, click IDs are held only in the delivery record and purged once the delivery is confirmed or terminally failed, never stored on the response (RESP-006). A response with no GA4 client ID (a direct link, QR code, email or SMS visit, or an embed whose snippet neither reads `_ga` nor receives a client ID in a `hidden` call) sends no GA4 event: Pencil never invents a client ID, because a random one adds a GA4 user with no attribution. The delivery list records that GA4 delivery as skipped with the reason "no GA4 client ID", and Meta and Google Ads events for the same response, attributed through `fbclid`, `gclid`, `gbraid` or `wbraid`, are unaffected. Deliveries are tracked under INTEG-015 with retries, replay and each platform's error reason, and each connection's test action sends to Meta's test event code or the GA4 validation endpoint. For embeds, the script embed's `pencil:completed` host-page event (DIST-002) is documented as a Google Tag Manager trigger: when the snippet sets `data-pencil-datalayer`, it also pushes `{event: 'pencil_completed', pencil_form, pencil_event_id}` to `window.dataLayer`, and DOCS-001 gives the GTM Custom Event recipe. No answer or response ID ever reaches the host page.

a Worker test with Meta Conversions API, GA4 Measurement Protocol and Google Ads receiver fixtures submits a response opened with `?fbclid=…&gclid=…&utm_campaign=spring` on a form whose disclosure names all three, and asserts exactly one Meta event, one GA4 event and one Google Ads click conversion per submission, with the declared click IDs, one shared event ID and no answer text; a `paid` event carries the verified amount; a response sent with `Sec-GPC: 1` produces no event; an anonymous form whose disclosure does not name Meta produces no event, and its stored response holds no click ID; a hashed email appears only for an identified form; a direct-link response opened with `?gclid=…` and no client ID produces one Google Ads click conversion, no GA4 event and a skipped GA4 delivery naming the reason, while the same link with `&ga_client_id=…` produces one GA4 event carrying that client ID; a browser journey on a host fixture at `/landing?gclid=G1&fbclid=F1` whose script embed forwards both produces one Google Ads click conversion carrying `G1` and one Meta event whose `fbc` is built from `F1`, and the same host page with a `_ga` cookie and `data-pencil-ga4="cookie"` produces one GA4 event carrying that cookie's client ID; a browser journey on a host fixture with a `dataLayer` sees one `pencil_completed` push carrying no answer or response ID.

## MOB-001

Every operator page (dashboard, builder, results, ledger, inbox, actions, settings) works at 360 CSS pixels wide with touch targets of at least 44 pixels and no horizontal scroll.

browser journeys at phone width build and publish a form, review a response and approve a submission.

## MOB-002

An installable progressive web app collects responses on a phone or tablet with no connection (events, field visits, kiosks), stores them encrypted on the device, and submits them with their RESP-012 idempotency keys when back online so retries never duplicate; the device shows how many responses await upload and the operator sees each response's capture time and upload time.

a browser journey goes offline, completes three responses, comes back online, and the ledger shows exactly three with capture times earlier than upload times.

## MOB-003

Native apps for operators offer push notifications for new responses, alerts (NOTIFY-005) and approvals (WORK-002), results and inbox views, offline kiosk collection (MOB-002), and sign-in through the installation's own authentication or SSO, published in the App Store and Google Play under the owner's account.

a Maestro flow runs in CI on an iOS Simulator and an Android Emulator against a local installation: it signs in, receives the push the installation sends for a new response (through APNs and FCM receiver fixtures, delivered to the devices with `xcrun simctl push` and `adb`), and approves a submission from the notification.

## AGENT-001

From a business question ("why are trial users not converting?") and optional context (prior forms, findings, CRM segments), the agent drafts a short study: the decision it informs, hypotheses, questions with neutral wording, a branching plan, the audience and channel, the sample needed for a stated margin of error, and the analysis plan. It flags leading, double-barreled, loaded and unbalanced questions and invalid branches before the operator sees the draft. Editing the draft and plan carries standard; publication and invitations carry external with the recipient and audience facts. The company’s policy decides each call, and the operator can edit the study.

Under the held company policy, a Worker test with the AI receiver fixture turns a question into a draft whose graph validates, whose bias check flags a planted leading question, and which stays a draft until an operator publishes it.

## AGENT-002

Over a fixed evidence set (ANLY-002), the agent codes open text into themes with exact excerpts and also finds contradictions: cohorts whose open text disagrees with their scores, themes that reverse between revisions, collectors or segments, and questions whose answers conflict within one response. Each contradiction cites the response IDs on both sides and is suppressed below the disclosure threshold. Findings are labelled as analysis. Accepting or dismissing an agent finding carries standard; the company’s policy decides the call.

a Worker test seeds promoters whose open text complains about price and asserts one contradiction citing both cohorts with verified excerpts, and no contradiction in a suppressed cohort.

## AGENT-003

For an accepted contradiction or an insufficient-evidence result, the agent proposes the smallest discriminating follow-up: two to five questions, the cohort to ask (only contacts who consented to follow-up, or a new public collector), and the result that would settle each hypothesis. Drafting the follow-up carries standard; publishing and sending carry external with audience facts. The company’s policy decides each call. The follow-up links to the finding it tests.

Under the held company policy, a Worker test proposes a follow-up for a seeded contradiction, targets only consenting contacts, and launches nothing until approval.

## AGENT-004

After an operator accepts a finding as an action (ACT-001), the agent drafts the task for the owner's tool (INTEG-013), watches its status, proposes a comparable re-measurement (the same questions to a comparable cohort after the change ships), and reports the before/after difference with its margin of error and whether it exceeds noise. Task dispatch and the re-survey carry external; recording a relied-on verdict carries commitment. The company’s policy decides each agent call. After a person sets a verdict, the record attributes that verdict to that person.

Under the held company policy, a Worker test accepts a finding, sends the confirmed task, reads it closed, proposes and (after approval) launches the re-survey, and reports a difference with its interval while the verdict stays unset.

## AGENT-005

The agent watches integration deliveries, mail and SMS bounces, completion and drop-off, quarantine volume and evidence gaps, and explains in plain language what broke ("12 responses since Tuesday never reached the HubSpot list because the token expired"), which response IDs or tasks are affected, and a bounded repair plan. Replays and outside disclosures carry external; credential reconnection carries security and gated where the provider keeps consent for a person; recipient-authority changes carry access. The company’s policy decides each call. The affected IDs are available through the operator’s form access.

Under the held company policy, a Worker test breaks a connection and a reminder schedule, and the sentinel reports both with the exact affected IDs and a replay that runs only after approval.

## AGENT-006

On an open-text question an operator marks probe-able, the agent may ask one generated follow-up ("You mentioned setup was slow; which step took longest?") based only on that answer, labeled to the respondent as automatically generated, disclosed in RESP-005, skippable, and stored with the exact generated prompt. Per-question configuration keeps the topics probing must not raise. Generating a respondent-facing probe carries external; the company’s policy decides whether it runs or waits for review. Probe content asks for neither identity nor sensitive data.

a browser journey with the AI receiver fixture answers a probe-able question, sees one labeled follow-up, and the ledger stores the generated prompt and answer; a fixture prompt asking for an email is refused before display.

## AGENT-007

For each PROG-004 follow-up item, the agent drafts a personal reply to the respondent that addresses their actual words, citing the excerpt, and a suggested next step. The owner can edit it. Sending by email or as a HappyToHelp reply carries external with recipient facts, and the company’s policy decides the agent’s call. Anonymous responses supply no recipient for this drafting job.

Under the held company policy, a Worker test drafts a reply for an identified detractor citing its excerpt, refuses an anonymous one, and nothing is sent until the owner clicks Send.

## AGENT-008

From drop-off (RSLT-002), time per step and quality flags, the agent identifies the steps losing respondents, proposes specific edits, and can run them as a randomized experiment between two revisions with a stated stopping rule, reporting completion rates with intervals. Draft changes carry standard and a respondent-facing experiment carries external; selecting a relied-on winner carries commitment. The company’s policy decides each agent step.

Under the held company policy, a Worker test seeds drop-off on one step, receives a proposal for that step, runs an approved two-revision experiment with balanced assignment, and reports both completion rates with intervals.

## AGENT-009

Given a connected Typeform, SurveyMonkey, Jotform or Google account, the agent inventories every form, its responses, logic, integrations, webhooks and embeds, proposes a migration plan (which to import, which to archive, what to reconnect), runs the approved imports through IMPORT-001 to IMPORT-008, and tracks the IMPORT-009 checklist to completion. Import batches carry standard, adding destructive when an operation is irreversible; reconnections carry security and gated when the provider requires a person’s consent. The company’s policy decides each call; undo remains available per IMPORT-004.

Under the held company policy, a Worker test with Typeform fixtures inventories three forms, imports the two approved, leaves the third, and reports the checklist.
