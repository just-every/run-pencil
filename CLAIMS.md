# Pencil implementation claims

CONTRACT.md is the complete status inventory. This file records the clauses changed by the current build round.

| Clause | Status | Evidence | Remaining scope |
| --- | --- | --- | --- |
| TMPL-002 | partial | `tests/runtime/team-templates.worker.test.ts`, `tests/e2e/team-templates.spec.ts` | Saved draft/published templates, remapped logic, reuse and retirement ship. Publication limits are not copied. Per-form theme choice awaits BRAND-002; retirement uses current equal operators pending ROLE-001. |
| RSLT-013 | done | `tests/runtime/traffic.worker.test.ts`, `tests/runtime/foundation.worker.test.ts`, `tests/e2e/traffic.spec.ts`, `tests/e2e/traffic-review.spec.ts`, `tests/e2e/save-resume.spec.ts` | None for reporting and submission-time exclusion. Revision-bound signed load times, reversible honeypot/minimum-time quarantine, pinned resume views, QR collector links and business-owned popup embed attribution are proved at 1440 and 390. Earlier traffic is unavailable; QR generation and popup tooling are separate targets. |
| FIELD-003 | done | `tests/runtime/contact-scores-scenario.ts`, `tests/runtime/new-question-types.worker.test.ts`, `tests/e2e/satisfaction-scores.spec.ts` | None for typed fixed-score questions, results and normalized exports. PROG-001 program setup remains a separate clause. |
| RESP-016 | done | `tests/runtime/foundation.worker.test.ts`, `tests/runtime/traffic.worker.test.ts`, `tests/e2e/traffic-review.spec.ts` | None. Explicit default-off inclusion of retained automated exclusions in filtered CSV/JSON exports, with state/reason and snapshot invalidation, is proved at 1440 and 390. Inclusion changes no accepted count or downstream effect. |
