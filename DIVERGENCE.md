# DIVERGENCE.md — where Pencil left the planted documents

One entry per deviation from the documents planted at bootstrap — `AGENTS.md`, `BASELINE.md`, and the now-deleted `CONTRACT.example.md` and `BOOTSTRAP.md`: what did not fit, why, and what Pencil did instead. This file is input to a later pass that decides what the shared documents missed. Entries marked **Deviation** changed something in this repo; entries marked **Friction** are gaps the shared documents should close, where Pencil stayed inside the rule.

## 1 — `BASE-SECRET-002` has no account of an optional external — **Deviation**

`BASE-SECRET-002` ends "The product never runs in a degraded mode." Pencil declares `ai.provider.v1` and `task.destination.v1` optional: a deployment with neither still builds flows, collects responses, and reports results, which a strict reading calls a degraded mode. Rather than force both adapters to be required — which would make the product unusable for a buyer who wants collection without AI — `WS-003` supersedes `BASE-SECRET-002`, names it, and carries the replacement guarantee: required variables still fail at startup, an absent optional adapter makes its features visibly unavailable, and no feature silently returns a reduced result.

Every seed with an optional external will hit this. The baseline clause needs a sentence distinguishing "missing required configuration" from "a declared-optional capability that is switched off", so seeds stop superseding it one at a time.

## 2 — `BASE-ACCESS-003` gives no syntax for exact path versus prefix — **Deviation**

`BASE-ACCESS-003` says entries in `seed.json → deploy.publicPaths` "are exact paths or prefixes" without saying which is which. The drafted manifest listed `"/"`, and `"/"` read as a prefix makes every path in the deployment public — the whole operator app included. Pencil split the field into `{ "exact": [...], "prefix": [...] }` so the owner landing at `/` is public while the operator SPA at `/app` remains session-gated.

This is a manifest-shape change made before any schema exists, and seed-spec should adopt the split (or an explicit marker) rather than leave the ambiguity in a security clause.

## 3 — An external required by a baseline clause was declared optional — **Deviation**

The draft manifest marked `mail` `"optional": true` while `BASE-ACCESS-001` requires magic-link sign-in. That combination produces a deployment nobody can sign in to. Pencil made mail required (`OPER-003`, `optional: false`, `MAIL_*` required) and rewrote `DIST-007` to describe a *failing* sender rather than an unconfigured one.

Nothing in the shared documents catches this class of error. seed-spec should reject any external whose `requiredFor` names a `BASE-` clause while `optional` is true.

## 4 — No baseline position on abuse defence for public write endpoints — **Friction**

`BASE-PUBLIC-001` forbids loading anything from a third-party domain on a public surface, which structurally rules out reCAPTCHA, Turnstile, and every hosted challenge. `BASE-ACCESS-003` supplies rate limits and nothing else. Any seed with a public POST — a form, a booking page, a review widget — has to invent its own defences. Pencil wrote `RESP-015` through `RESP-018`: deployment-owned checks only, a silent drop for submissions no human produces, and quarantine-with-operator-review for everything else, so a real respondent's answers can never disappear.

That shape is not Pencil-specific. It belongs in the baseline as a clause every seed with a public write endpoint inherits.

## 5 — `BASE-PUBLIC-001` has no position on multi-screen public flows — **Friction**

A one-question-at-a-time flow needs server-side continuity across screens: which revision the respondent started, which step they are on, whether their submission token is valid. `BASE-PUBLIC-001` says public surfaces "set no cookies" and "send no visitor data before the visitor's first interaction". Pencil stays inside both — the `RESP-013` session record is created at the first interaction and holds no cookie, no raw IP, no user-agent string, and no host identity — but the clause reads as though public surfaces are always stateless, and the next seed with a multi-step public flow will have to make the same argument from scratch.

## 6 — `BASE-DATA-002` makes every session-derived historical metric uncomputable — **Friction**

"No user data is deleted automatically. Only sessions and rate-limit state expire." Drop-off by question, device split, and historical completion rate are all derived from sessions, so under a literal reading they evaporate on the retention boundary while the responses they contextualise are kept forever. Pencil folds each session's outcome into non-identifying per-revision counters (`RESP-019`) before the session expires. The baseline should say explicitly that aggregating expiring session facts into counters that cannot be traced back to a session is permitted, because the alternative is either keeping sessions forever or shipping metrics that silently reset.

## 7 — `BASE-INPUT-003` assumes uploads are respondent-facing — **Friction**

The clause is written for products where a visitor uploads a file: size and type limits, R2 storage, download disposition, "readable only by an authorised session or through a delivery channel the product contract names". Pencil has no respondent upload at all — file-upload questions are an explicit non-goal — and its only uploads are operator-side CSV contact import and deployment import. The clause still applies, but its "delivery channel" half is dead text here, and a seed reading it as a requirement could conclude it must offer respondent uploads.

## 8 — `BASE-DATA-003` has no rule for derived artifacts that cite erased records — **Friction**

Erasure cascades to "dependent records and attachments", which does not obviously reach an AI analysis that quotes a respondent verbatim, a recommendation built on that quote, or an aggregate computed over it. Pencil wrote its own rule in `DATA-002`: excerpts and evidence links are removed from every analysis within 5 minutes, aggregates are recomputed or marked unavailable, and affected analyses are labelled redacted and stale. Every seed that derives artifacts from personal data needs the same rule, so it should be catalog-wide rather than per-seed.

## 9 — The policy guidance is missing two rules Pencil needed — **Friction**

`AGENTS.md` sets the budget ("About eight per seed") but not the tests for whether a seam belongs. The draft carried eleven, and the three that had to go each failed a rule the documents do not state:

- `action.measurement.v1` sat on `ACT-005`'s absolute guarantee — "Pencil never changes that verdict automatically" — which a buyer could have replaced with an automatic verdict. **Never attach a policy seam to an absolute guarantee.**
- `operator.management.v1` decided who may invite or remove an operator, in a product whose first clause says there are no roles. **No "who may do X" policy where the product has no roles**; it is a permissions system arriving through the back door.
- `flow.closure.v1` defaulted to "manual closure only" while `FLOW-010`'s own text grants operators deadlines and targets — the default contradicted the clause it was attached to. **A policy default may narrow a configurable behaviour, never contradict the clause's plain reading.**

Pencil now carries exactly eight. The three rules above are cheap to state and would have prevented all three.

## 10 — Clause formatting differs from the `AGENTS.md` example — **Friction**

`AGENTS.md` shows clauses as `## CHAN-001 — Inbound email` headings. Both `CONTRACT.example.md` and every seed contract written so far use `- **CHAN-001 — Inbound email.**` bullets grouped under an area heading. Pencil followed the exemplar, not the guide. Whichever is intended, the two should agree, because a future harness that parses clause IDs will pick one.

## 11 — Owner-approved product page at the default root — **Deviation**

The owner's 11 October 2026 instruction replaces HOME-001's unconfigured root 404 with the existing approved Pencil product page, without changing its visible content or styling. `/pencil` redirects to `/`. Explicitly configured respondent root landings and direct `/f/<slug>` links retain their existing admission, closed and missing states. Pencil accepts only its configured APP_ORIGIN; it has no separate form-host mapping. This records the owner override in HOME-001 and SITE-001.

## Owner sign-in (15 October 2026)

Pencil's owner-signin.server.mjs imports rer 0.2.19's owner grant consumer and confirmation page in place, through its pinned package exports. Its thin route adapter uses the native keyed IP/token rate-limit policy and existing session configuration. The copied operator-auth foundation remains byte-exact at Base 8981bc2c4d9e61feca5787c83b4ed44056659dd9; no unrelated provider, settings or dev UI is adopted. Additive migration 0036 comes from Base e17843562355e1b6e5068289c8e037951fbc8d3d, independently pinned as historical SQL. Owner grant rows never travel in archives.
