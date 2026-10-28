# Pencil rulings

### RL-101 — Retired-address ownership and restoration

Date: 2026-10-28 · Ruler: ct · Governs: DIST-018

Question: Must a retired form address be unusable forever even by the form that owns its redirects?

Default adopted/proposed: Every retired slug is permanently reserved, including against its original form; other forms may never claim it.

Outcome: **replace** — Replace the proposed default with the precise policy below.

Normative outcome: Replace the original-form prohibition: a retired slug stays bound to its existing form and may be explicitly restored as that form’s canonical slug in one atomic rename, with every other alias redirecting directly to the resulting canonical address; another form cannot claim an address while it remains an obligated redirect.

Why and incumbent comparison: Typeform explicitly supports resetting/reusing custom links, including across forms. Pencil independently promises old-slug redirects, so copying cross-form reuse would violate its own existing routing promise. No common norm reconciles both policies automatically; preserving ownership and allowing same-form restoration is the safest compatible default, not a claim that Typeform reserves retired links forever.

Placement (one copy): State address ownership/restoration once in DIST-018’s rename point.

Engineering/proof: Custom-hostname provisioning and future ROLE-001 ship authority remain engineering gaps. Test original-form restoration and alias/query/canonical behavior; this ruling does not mark them proved.

Sources:
- [https://help.typeform.com/hc/en-us/articles/50138651685012-How-to-reuse-the-same-custom-URL-for-different-forms-workaround](https://help.typeform.com/hc/en-us/articles/50138651685012-How-to-reuse-the-same-custom-URL-for-different-forms-workaround) — Typeform explicitly permits releasing a custom link from one form and reusing it for another after resetting the first form.

Observed clauses and complete Status Gaps:

- DIST-018: CONTRACT.md:305; Status at line 662. Gap: Cloudflare custom-hostname provisioning is not built (Platform zone path). Current equal operators retain builder access until ROLE-001 grants ship. ADOPTED provisional default (ASK ct): retired addresses remain reserved permanently, including for their original form; no other form may claim them.

### RL-102 — Safe replacement of closed Checkout attempts

Date: 2026-10-28 · Ruler: ct · Governs: PAY-003, PAY-004

Question: May cancelled or expired subscription, donation and ACH Checkouts be held until response-owned atomic billing-state replacement exists?

Default adopted/proposed: No replacement until the response-owned transaction carries Checkout preferences and resets billing fields.

Outcome: **adopt with rider** — Approve the proposed default subject to the precise conditions below.

Normative outcome: Approve refusal while that invariant is unimplemented, and require the completed retry door to verify the original Checkout is terminal and cannot complete, preserve original attempt evidence, atomically bind a fresh attempt to the same response/current preferences and reset only derived current billing fields; pending or uncertain originals block replacement and paid originals never retry.

Why and incumbent comparison: Typeform delegates rejected/cancelled payment diagnosis to Stripe and offers recurring payment collection; its documentation establishes no common norm for Pencil’s internal transaction ownership. The pending question is principally an engineering invariant, not a new donor policy. Temporary refusal is safe but cannot become permanent loss of subscription/donation/ACH retry scope.

Placement (one copy): Place shared replacement custody once in the PAY-001 owning payment-state point and cite it from PAY-003 and PAY-004.

Engineering/proof: False-positive engineering ask: response-owned atomic Checkout preferences/billing resets and repository write ownership are implementation work, not an owner/ct policy choice. The temporary refusal cannot replace the required safe retry door. The original 24 October donation and provider-priority rulings stay in force. In-form/custom recurring amounts, PayPal or Square, ACH respondent processing, wallet/settlement and real provider proof remain owed; moving code between repository modules is engineering, not owner approval.

Sources:
- [https://help.typeform.com/hc/en-us/articles/15212919734036-Stripe-integration-Troubleshooting-and-FAQs](https://help.typeform.com/hc/en-us/articles/15212919734036-Stripe-integration-Troubleshooting-and-FAQs) — Typeform delegates payment handling and refunds to Stripe, excludes entered card data from results and supports one-time and recurring payments.
- [https://docs.stripe.com/payments/ach-direct-debit](https://docs.stripe.com/payments/ach-direct-debit) — Stripe requires customer authorization and bank verification; ACH confirmation is delayed and standard settlement is T+4, with eligible faster-settlement arrangements.

Observed clauses and complete Status Gaps:

- PAY-003: CONTRACT.md:405; Status at line 767. Gap: Custom donation amounts are entered only on Stripe within the operator’s minimum and maximum, as ct approved on 24 October. Gap: pre-Stripe (in-form) amount entry; recurring custom amounts (recurring donations use fixed server-priced amounts); held-key Stripe test-mode proof. Ongoing billing management belongs to Stripe’s customer portal; no portal is built. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed. ADOPTED provisional retry refusal (ASK ct): cancelled or expired subscription and donation checkouts cannot be replaced until the response-owned transaction carries Checkout preferences and resets billing fields; that write is in responses/repository.ts custody.
- PAY-004: CONTRACT.md:407; Status at line 768. Gap: ACH and Checkout card wallets ship first under ct’s 24 October ruling. Gap: "and PayPal or Square as alternative providers with the same pending/paid/failed states"; "and a PayPal fixture order to paid" remain unmet, with no PayPal or Square sandbox accounts held. Real Apple Pay, Google Pay and ACH test-mode settlement are unproved. Failed ACH checkout retry and a dedicated respondent processing label remain unproved; the existing return says Stripe is confirming and the response record shows processing. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed.  Provider target retained verbatim: Payment steps can offer ACH Direct Debit (Stripe US bank account), Apple Pay and Google Pay through Checkout, and PayPal or Square as alternative providers with the same pending/paid/failed states; ACH's delayed settlement is shown as `processing` until it succeeds or fails. Acceptance retained verbatim: a Worker test drives an ACH payment through processing to succeeded and to failed, and a PayPal fixture order to paid. ADOPTED provisional retry refusal (ASK ct): cancelled or expired ACH checkouts cannot be replaced until the response-owned transaction carries Checkout preferences and resets billing fields; that write is in responses/repository.ts custody.

### RL-103 — Complete ledger views and uncertain refund custody

Date: 2026-10-28 · Ruler: ct · Governs: PAY-005

Question: May ledger/reconciliation refuse over 1000 records and may uncertain refunds and legacy date provenance retain the proposed custody?

Default adopted/proposed: Refuse more than 1000 records; hold an uncertain refund reservation; retain pre-upgrade last-change dates as period dates.

Outcome: **replace** — Replace the proposed default with the precise policy below.

Normative outcome: Replace the hard total-record refusal with complete cursor-paged views/exports and complete period reconciliation, or an explicit incomplete result that cannot be accepted as reconciled until all pages are included. Retain uncertain-refund reservations until provider readback resolves them. Preserve legacy source timestamps as labelled historical last-change provenance, never assert them as known transaction dates or silently rewrite closed totals.

Why and incumbent comparison: Typeform directs refunds to Stripe and matches provider payments to responses. No common norm for a 1000-record product ceiling or invented historical payment dates is established. Whole-period ledger completeness and honest unknown timing are safer than excluding a buyer’s larger history; uncertainty holds avoid duplicate refunds.

Placement (one copy): Put refund uncertainty and period provenance once in PAY-005; the reusable pagination requirement may be one ledger door rule cited here.

Engineering/proof: Pagination/reconciliation completeness, legacy-date presentation and real Stripe proof remain engineering work. ROLE-001 identity grants and the owner-only interim refund ruling are preserved.

Sources:
- [https://help.typeform.com/hc/en-us/articles/15212919734036-Stripe-integration-Troubleshooting-and-FAQs](https://help.typeform.com/hc/en-us/articles/15212919734036-Stripe-integration-Troubleshooting-and-FAQs) — Typeform delegates payment handling and refunds to Stripe, excludes entered card data from results and supports one-time and recurring payments.

Observed clauses and complete Status Gaps:

- PAY-005: CONTRACT.md:409; Status at line 769. Gap: Owner-only refunds and reconciliation implement ct’s 24 October ruling. The role-based target stays unchanged: identity grants remain inherited by ROLE-001. Gap: real Stripe test-mode proof; pre-upgrade period dates use the historical last-change date; an uncertain provider refund retains its reservation and requires owner reconciliation in Stripe; ADOPTED provisional defaults (ASK ct): the payment view and reconciliation refuse more than 1,000 records, uncertain refunds retain their reservation, and pre-upgrade periods retain their historical last-change date. Proof is against the loopback Stripe stand-in in CI; no real Stripe test-mode receipt is committed.

### RL-104 — Device class in restore archives only

Date: 2026-10-28 · Ruler: ct · Governs: RSLT-004

Question: May coarse response-linked device class travel in installation restore archives while remaining absent from response exports?

Default adopted/proposed: Archive-only device column, never CSV/JSON response exports; unknown legacy class; filtered native-response and session-start denominators kept separate.

Outcome: **adopt with rider** — Approve the proposed default subject to the precise conditions below.

Normative outcome: Approve that separation: retain only the coarse class, erase it with the response, exclude it from response exports, and allow it only inside the private integrity-checked whole-installation restore archive under DATA-001; restored access uses current authority and preserves erasure fences and honest unknown historical classes.

Why and incumbent comparison: Typeform exposes device insights and separately downloadable individual results; it does not document a common restore-archive device-column convention. The archive exception is a conservative distinction between restoring native state and distributing response data, not permission to add fingerprints or expose individual device metadata.

Placement (one copy): State this single archive exception once in RSLT-004 and cite DATA-001 rather than copying archive custody.

Engineering/proof: Older pre-device archive compatibility remains an engineering/proof gap; summary integration retains RSLT-001/RSLT-003 duties.

Sources:
- [https://help.typeform.com/hc/en-us/articles/31922592797972-Power-your-customer-acquisition-workflow-by-generating-leads-with-Typeform](https://help.typeform.com/hc/en-us/articles/31922592797972-Power-your-customer-acquisition-workflow-by-generating-leads-with-Typeform) — Typeform results insights show starts, completions and devices; individual response downloads are a separate results operation.

Observed clauses and complete Status Gaps:

- RSLT-004: CONTRACT.md:162; Status at line 706. Gap: Coarse session-start class is copied only on admitted commit, preserved under unpaid replacement, filterable through the shared response selection and erased with the response. Historical classes are unknown. Filtered device shares name native-response denominators; imported completions and unlinked open/abandoned sessions are separate. Unfiltered shares name session starts. No class enters CSV/JSON response records; DATA-001 portable archives carry the response column for restoration. Default ADOPTED pending ct: archive only, never a response export. Gap: the current archive importer requires the same committed migration inventory; restoration of an older pre-device archive has not been proved with its original trusted controller. RSLT-001/RSLT-003 summary integration remains their own target.

### RL-1 — Shared Lobby

Date: 2026-10-12 · Ruler: owner · Governs: HOME-001

By the owner's 12 October 2026 decision, `/` serves Base's shared Lobby when no public landing flow is selected (Finish setup until the owner confirms first-run setup, then Sign in; `GET /setup/state` answers the same claim state), and `/pencil` redirects to `/`. An explicitly selected open published flow keeps its canonical respondent experience and admission checks at `/`. A later closed flow shows the standard closed page; an archived or missing flow returns 404, just as its direct link does. Business branding follows BRAND-001.

### RL-2 — Invitation prefill custody

Date: 2026-10-23 · Ruler: ct · Governs: LOGIC-002

Default APPROVED by ct (23 October 2026): revision-frozen explicit mapping, invitation-token-only values and no cross-device save on mapped invitations. No real mail provider call or consent was used.

### RL-3 — Embed mode triggers

Date: 2026-10-24 · Ruler: ct · Governs: DIST-013

Defaults confirmed by ct (24 Oct): click trigger, one opening per host-origin/browser/form/mode, 1 s delay, 50% scroll; unavailable storage keeps modes closed.

### RL-4 — Email-embedded first question

Date: 2026-10-23 · Ruler: ct · Governs: DIST-014

Default APPROVED by ct (23 October 2026): opaque token plus answer hint with inert GET/HEAD; short-choice bounds as above. Program email is unbuilt and inherits before shipping.

### RL-5 — Respondent receipt custody

Date: 2026-10-23 · Ruler: ct · Governs: RESP-020

Default APPROVED by ct (23 October 2026): revision-frozen opt-in, one marked typed mailbox or identified participant, second opt-in/type whitelist for copies, and no resend from restored history.

### RL-6 — Google worksheet custody and limits

Date: 2026-10-24 · Ruler: ct · Governs: INTEG-001

Ruled limits/defaults (ct 24 Oct 19:47Z): one form per reserved worksheet, one fixed destination per form, at most 1,000 worksheet rows, 499 question columns, 100 selectable worksheets and a 2 MiB provider response; restored links stay disarmed until explicitly reattached; cells use RAW canonical values/JSON and erasure blanks the row.

### RL-7 — Donation entry and payment-method priority

Date: 2026-10-24 · Ruler: ct · Governs: PAY-003, PAY-004

Custom donation amounts may be entered on Stripe within the operator’s minimum and maximum. In-form amount entry and recurring custom amounts remain target work. ACH and Checkout card wallets ship first; PayPal or Square and the original provider fixtures remain owed. RL-102 retains the safe retry target.
