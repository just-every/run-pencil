# Implementation claims

<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

Acceptance journeys and remaining obligations are recorded in CONTRACT.md and ACCEPTANCE.md.

| Clause | Title | Kind | Status | Evidence paths |
| --- | --- | --- | --- | --- |
| HOME-001 | Public landing | published | done | `tests/e2e/accessibility-foundation.spec.ts`; `tests/e2e/business-brand.spec.ts`; `tests/e2e/installed-home.spec.ts` |
| SITE-001 | Product page | published | done | `tests/e2e/site-page.spec.ts` |
| SITE-002 | Live answer path | published | done | `tests/e2e/site-hero.spec.ts` |
| DOCS-001 | Documentation | published | done | `tests/e2e/docs-site.spec.ts` |
| SHELL-001 | Operator shell | published | done | `tests/e2e/accessibility-foundation.spec.ts`; `tests/e2e/rendering-migration.spec.ts`; `tests/runtime/private-auth-freshness.worker.test.ts` |
| OPER-001 | Equal operators | published | done | `tests/runtime/access-foundation.worker.test.ts` |
| OPER-002 | Management | published | done | `tests/runtime/auth.worker.test.ts`; `tests/runtime/first-owner.worker.test.ts` |
| OPER-003 | Sign-in depends on mail | published | done | `tests/managed-mail.test.ts`; `tests/runtime/base-auth.worker.test.ts`; `tests/runtime/optional-configuration.worker.test.ts` |
| ROLE-001 | Workspace roles | target | missing |  |
| ROLE-002 | Per-form access and folders | target | missing |  |
| ROLE-003 | Single sign-on and provisioning | target | missing |  |
| ROLE-004 | Builder collaboration | target | missing |  |
| WS-001 | Workspace time zone | published | done | `tests/e2e/publication-zone.spec.ts`; `tests/runtime/access-foundation.worker.test.ts`; `tests/runtime/analysis-safety.worker.test.ts` |
| WS-002 | Sending hours | published | done | `tests/runtime/access-foundation.worker.test.ts`; `tests/runtime/distribution.worker.test.ts`; `tests/runtime/feedback-digest.worker.test.ts` |
| WS-003 | Optional externals are configuration, not degradation | published | done | `tests/e2e/review-corrections.spec.ts`; `tests/runtime/optional-configuration.worker.test.ts` |
| BRAND-001 | Saved business identity | published | done | `tests/e2e/business-brand.spec.ts`; `tests/runtime/brand.worker.test.ts` |
| BRAND-002 | Form design themes | target | partial | `src/core/features/brand/brand.ts`; `public/fonts/`; `tests/runtime/brand.worker.test.ts`; `tests/e2e/business-brand.spec.ts` |
| DASH-001 | First flow | published | done | `tests/runtime/first-owner.worker.test.ts` |
| DASH-002 | Flow list | published | done | `tests/runtime/feedback-attention.worker.test.ts`; `tests/runtime/foundation.worker.test.ts`; `tests/runtime/journey.worker.test.ts` |
| TMPL-001 | Template gallery | target | partial | `tests/runtime/first-owner.worker.test.ts`; `tests/e2e/templates.spec.ts` |
| TMPL-002 | Team templates | target | done | `src/core/features/flows/team-templates.ts`; `tests/runtime/team-templates.worker.test.ts`; `tests/e2e/team-templates.spec.ts` |
| AI-001 | Generate a form from a prompt or a document | target | partial | `tests/runtime/feedback-rewrites.worker.test.ts`; `tests/e2e/analysis.spec.ts`; `tests/runtime/studio-scenario.ts`; `tests/e2e/studio-journey.ts` |
| FLOW-001 | Lifecycle | published | done | `tests/runtime/foundation.worker.test.ts` |
| FLOW-002 | Ordered steps | published | done | `tests/e2e/journey.spec.ts` |
| FLOW-003 | Question types | published | done | `tests/e2e/new-question-types.spec.ts`; `tests/runtime/new-question-types.worker.test.ts` |
| FLOW-004 | Saved edits | published | done | `tests/e2e/review-corrections.spec.ts` |
| FLOW-005 | Branching | published | done | `tests/e2e/journey.spec.ts`; `tests/e2e/publication-zone.spec.ts`; `tests/e2e/review-corrections.spec.ts` |
| FLOW-006 | Publish validation | published | done | `tests/runtime/calculations.worker.test.ts`; `tests/runtime/foundation.worker.test.ts`; `tests/runtime/graph-reachability.worker.test.ts` |
| FLOW-007 | Preview isolation | published | done | `tests/runtime/journey.worker.test.ts` |
| FLOW-008 | Published revisions | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/journey.worker.test.ts` |
| FLOW-009 | Live edits | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/journey.worker.test.ts` |
| FLOW-010 | Closure | published | done | `tests/e2e/publication-zone.spec.ts` |
| FLOW-011 | Duplication | published | done | `tests/runtime/foundation.worker.test.ts` |
| FLOW-012 | Valid references | published | done | `src/core/features/flows/graph.contract.test.ts` |
| FLOW-013 | Reachable termination | published | done | `tests/runtime/graph-reachability.worker.test.ts` |
| FLOW-014 | Valid questions | published | done | `tests/e2e/review-corrections.spec.ts` |
| FLOW-015 | Stable structure IDs | published | done | `tests/contract/data-release.contract.test.ts`; `tests/runtime/foundation.worker.test.ts` |
| FLOW-016 | Published policy snapshot | published | done | `tests/runtime/graph-reachability.worker.test.ts`; `tests/runtime/policy-snapshot.worker.test.ts` |
| FLOW-017 | Revision admission | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/journey.worker.test.ts` |
| FLOW-018 | Revision counts | published | done | `tests/runtime/journey.worker.test.ts` |
| FLOW-019 | Answer values by type | published | done | `tests/e2e/ledger-filters.spec.ts`; `tests/runtime/foundation.worker.test.ts`; `tests/runtime/ledger-filters.worker.test.ts` |
| FLOW-020 | Required applies to the path taken | published | done | `tests/runtime/journey.worker.test.ts` |
| FLOW-021 | Deleting a question keeps its answers | published | done | `tests/runtime/journey.worker.test.ts` |
| FIELD-001 | Hidden fields and URL parameters | target | partial | `src/core/shared/hiddenFields.ts`; `tests/runtime/hidden-fields.worker.test.ts`; `tests/e2e/hidden-fields.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| FIELD-002 | Matrix, Likert and scale grids | target | done | `tests/runtime/new-question-types.worker.test.ts`; `tests/runtime/matrix-scenario.ts`; `tests/e2e/new-question-types.spec.ts`; `tests/e2e/matrix-journey.ts` |
| FIELD-003 | CSAT, CES and visual rating questions | target | done | `src/core/shared/scoreQuestions.ts`; `src/core/shared/ui/ScoreQuestionInput.tsx`; `tests/runtime/contact-scores-scenario.ts`; `tests/runtime/new-question-types.worker.test.ts`; `tests/e2e/satisfaction-scores.spec.ts` |
| FIELD-004 | US contact fields | target | done | `src/core/shared/contactAnswers.ts`; `src/core/shared/ui/ContactQuestionInput.tsx`; `src/core/features/reporting/contactExport.ts`; `migrations/core/0040_scores_contact_fields.sql`; `tests/runtime/contact-scores-scenario.ts` |
| FIELD-005 | Media in questions and choices | target | missing |  |
| FIELD-006 | Randomized order | published | done | `src/core/shared/presentationOrder.ts`; `migrations/core/0051_presentation_order.sql`; `tests/runtime/randomized-order.worker.test.ts`; `tests/e2e/randomized-order.spec.ts` |
| FIELD-007 | Scheduling handoff | target | missing |  |
| FIELD-008 | Classic page layout | target | done | `src/core/shared/screenLayout.ts`; `src/core/features/flows/screen-validation.ts`; `tests/runtime/pages.worker.test.ts`; `tests/e2e/pages.spec.ts` |
| FIELD-009 | Video and audio answers | target | missing |  |
| FIELD-010 | "Other (please specify)" and "None of the above" | target | partial | `src/core/shared/otherChoices.ts`; `src/core/shared/ui/ChoiceQuestionInput.tsx`; `src/core/features/importing/choice-response.ts`; `tests/runtime/other-choices.worker.test.ts`; `tests/e2e/other-choices.spec.ts` |
| FIELD-011 | Statement screens anywhere in the flow | target | partial | `src/core/features/importing/fields.ts`; `tests/e2e/journey.spec.ts`; `tests/runtime/form-import.worker.test.ts` |
| FIELD-012 | Question groups | target | partial | `src/core/shared/screenLayout.ts`; `src/core/features/importing/typeform-groups.ts`; `tests/runtime/groups.worker.test.ts`; `tests/e2e/groups.spec.ts` |
| FIELD-013 | Text answer validation | target | done | `src/core/shared/textValidation.ts`; `src/core/features/flows/ui/TextSettings.tsx`; `tests/runtime/new-question-types.worker.test.ts`; `tests/runtime/form-import.worker.test.ts`; `tests/e2e/text-validation.spec.ts` |
| FIELD-014 | Long choice lists and long forms | target | partial | `src/core/shared/formLimits.ts`; `src/core/shared/choiceLists.ts`; `tests/runtime/long-forms.worker.test.ts`; `tests/e2e/long-choices.spec.ts` |
| FIELD-015 | Date entry and display format | target | done | `src/core/shared/dateFormat.ts`; `src/core/shared/ui/CalendarDateInput.tsx`; `src/core/shared/answerRecall.ts`; `src/core/features/reporting/repository.ts`; `tests/runtime/new-question-types.worker.test.ts`; `tests/runtime/form-import.worker.test.ts`; `tests/e2e/date-format.spec.ts` |
| FIELD-016 | Opinion scales with labels | target | done | `src/core/shared/ratingScale.ts`; `src/core/shared/ui/RatingInput.tsx`; `tests/runtime/new-question-types.worker.test.ts`; `tests/runtime/form-import.worker.test.ts`; `tests/e2e/opinion-scale.spec.ts` |
| LOGIC-001 | Answer recall | target | done | `src/core/shared/answerRecall.ts`; `src/core/features/flows/ui/RecallHelp.tsx`; `tests/runtime/answer-recall.worker.test.ts`; `tests/e2e/answer-recall.spec.ts` |
| LOGIC-002 | Known-data prefill | target | partial | `tests/runtime/distribution.worker.test.ts`; `tests/e2e/distribution-foundation.spec.ts`; `scripts/deployment-data.check.mjs` |
| LOGIC-003 | Variables and calculations | target | done | `src/core/shared/calculations.ts`; `src/core/shared/calculationValidation.ts`; `src/core/features/flows/calculation-proof.ts`; `tests/runtime/calculations.worker.test.ts`; `tests/e2e/calculations.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| LOGIC-004 | Quizzes and outcomes | target | missing |  |
| LOGIC-005 | Conditional completion and redirect | published | done | `src/core/shared/completionRedirect.ts`; `tests/runtime/completion-redirects.worker.test.ts`; `tests/e2e/completion-redirects.spec.ts` |
| LOGIC-006 | Conditions across the form | target | partial | `src/core/shared/conditions.ts`; `src/core/features/flows/condition-paths.ts`; `src/core/features/flows/ui/ConditionEditor.tsx`; `tests/runtime/conditions.worker.test.ts`; `tests/e2e/conditions.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| LANG-001 | Multi-language forms | target | missing |  |
| AI-002 | Reviewed AI translation | target | missing |  |
| LANG-002 | Editable closed and system text | target | partial | `src/core/shared/respondentText.ts`; `src/core/shared/closedFlow.ts`; `src/core/features/flows/ui/RespondentTextSettings.tsx`; `tests/runtime/foundation.worker.test.ts`; `tests/e2e/closed-flow.spec.ts` |
| A11Y-001 | WCAG 2.2 AA respondent experience | published | done | `src/core/shared/ui/AnswerFieldset.tsx`; `src/core/shared/ui/useRespondentFocus.ts`; `tests/e2e/respondent-accessibility.spec.ts` |
| A11Y-002 | Accessibility checker before publish | target | partial | `src/core/features/brand/brand.ts`; `tests/runtime/brand.worker.test.ts` |
| AUD-001 | Contacts | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/audience.worker.test.ts`; `tests/runtime/upgrades.worker.test.ts` |
| AUD-002 | Segments | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/audience.worker.test.ts` |
| AUD-003 | Participants | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/distribution.worker.test.ts` |
| AUD-004 | Eligibility | published | done | `tests/runtime/audience.worker.test.ts` |
| AUD-005 | Launch idempotency | published | done | `tests/runtime/audience.worker.test.ts` |
| AUD-006 | Send-time eligibility | published | done | `tests/runtime/audience.worker.test.ts`; `tests/runtime/distribution.worker.test.ts` |
| DIST-001 | Public link | published | done | `tests/e2e/public-flow.spec.ts`; `tests/e2e/review-corrections.spec.ts` |
| DIST-002 | Embed | published | partial | `tests/e2e/public-flow.spec.ts`; `tests/e2e/script-embed.spec.ts`; `tests/e2e/calculations.spec.ts`; `tests/e2e/closed-flow.spec.ts` |
| DIST-003 | Invitations | published | done | `tests/runtime/distribution.worker.test.ts` |
| DIST-004 | Reminders | published | done | `tests/runtime/distribution.worker.test.ts` |
| DIST-005 | Opt-out | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/distribution.worker.test.ts` |
| DIST-006 | Mail retry | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/feedback-digest.worker.test.ts`; `tests/runtime/notifications.worker.test.ts` |
| DIST-007 | Adapter isolation | published | done | `tests/runtime/base-auth.worker.test.ts` |
| DIST-008 | Terminal delivery | published | done | `tests/e2e/mail-recovery.spec.ts`; `tests/runtime/distribution.worker.test.ts` |
| DIST-009 | Embed isolation | published | partial | `tests/e2e/embed-security-foundation.spec.ts`; `tests/e2e/rendering-migration.spec.ts`; `tests/e2e/script-embed.spec.ts`; `tests/e2e/calculations.spec.ts` |
| DIST-010 | Ambiguous mail outcome | published | done | `tests/e2e/mail-recovery.spec.ts`; `tests/runtime/distribution.worker.test.ts`; `tests/runtime/notification-restore.worker.test.ts` |
| DIST-011 | SMS invitations and reminders | target | partial | `tests/runtime/sms.worker.test.ts`; `src/core/features/sms/`; `migrations/core/0065_sms_invitations.sql`; `docs/evidence/dist011-twilio-test-2026-10-26.json`; `scripts/proof/sms-twilio-test.mjs`; `migrations/core/0071_contact_time_zones.sql`; `tests/runtime/sms.worker.test.ts`; `tests/runtime/sms.worker.test.ts`; `tests/runtime/sms.worker.test.ts`; `tests/runtime/sms.worker.test.ts`; `scripts/deployment-data-custody-replay.check.mjs`; `tests/e2e/distribution-foundation.spec.ts` |
| DIST-012 | QR codes and kiosk mode | published | done | `src/core/features/collectors/qr.ts`; `src/core/features/responses/ui/KioskFlow.tsx`; `tests/runtime/qr.worker.test.ts`; `tests/e2e/kiosk.spec.ts` |
| DIST-013 | Embed modes and site plugins | target | partial | `tests/e2e/script-embed.spec.ts` |
| DIST-014 | Email-embedded first question | target | partial | `tests/runtime/distribution.worker.test.ts`; `tests/invitation-links.test.ts`; `tests/e2e/distribution-foundation.spec.ts` |
| DIST-015 | In-product and website surveys | target | missing |  |
| DIST-016 | Recurring surveys | target | missing |  |
| DIST-017 | Collectors and source labels | target | done | `migrations/core/0041_collectors.sql`; `src/core/features/collectors/`; `src/core/features/reporting/scope.ts`; `tests/runtime/collectors-trends.worker.test.ts`; `tests/runtime/calculations.worker.test.ts` |
| DIST-018 | Form addresses | target | partial | `tests/e2e/rendering-migration.spec.ts`; `src/core/features/addresses/`; `migrations/core/0064_form_addresses.sql` |
| DIST-019 | Restricted access | published | done | `src/core/features/restricted-access/`; `migrations/core/0050_restricted_access.sql`; `tests/runtime/restricted-access.worker.test.ts`; `tests/e2e/restricted-access.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| DIST-020 | Link previews and search indexing | target | done | `tests/e2e/rendering-migration.spec.ts`; `tests/e2e/authoring.spec.ts`; `tests/runtime/brand.worker.test.ts`; `tests/e2e/distribution-foundation.spec.ts`; `tests/e2e/save-resume.spec.ts`; `tests/runtime/typeform-definition.worker.test.ts`; `tests/runtime/brand.worker.test.ts`; `tests/e2e/rendering-migration.spec.ts`; `scripts/deployment-data.check.mjs` |
| DIST-021 | Forwarded landing-page parameters | target | missing |  |
| RESP-001 | One question at a time | published | done | `tests/e2e/public-flow.spec.ts` |
| RESP-002 | Truthful progress | published | done | `tests/e2e/question-progress.spec.ts` |
| RESP-003 | Answers | published | done | `tests/e2e/new-question-types.spec.ts`; `tests/e2e/question-accessibility-foundation.spec.ts`; `tests/e2e/question-progress.spec.ts` |
| RESP-004 | Back navigation | published | done | `tests/e2e/journey.spec.ts`; `tests/e2e/question-progress.spec.ts`; `tests/runtime/journey.worker.test.ts` |
| RESP-005 | Privacy disclosure | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/analysis-safety.worker.test.ts` |
| RESP-006 | Anonymous means anonymous | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/foundation.worker.test.ts` |
| RESP-007 | Final submission | published | done | `tests/e2e/journey.spec.ts`; `tests/runtime/distribution.worker.test.ts` |
| RESP-008 | Admission per invitation | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/runtime/distribution.worker.test.ts` |
| RESP-009 | Concurrent closure | published | done | `tests/e2e/closed-flow.spec.ts`; `tests/runtime/journey.worker.test.ts` |
| RESP-010 | No silent partials | published | done | `tests/runtime/foundation.worker.test.ts`; `tests/runtime/journey.worker.test.ts` |
| RESP-011 | Completion | published | done | `tests/e2e/public-flow.spec.ts` |
| RESP-012 | Submission retry | published | done | `tests/runtime/journey.worker.test.ts` |
| RESP-013 | Session metrics | published | done | `tests/runtime/distribution.worker.test.ts`; `tests/runtime/journey.worker.test.ts`; `tests/runtime/transition.worker.test.ts` |
| RESP-014 | Submit failure | published | done | `tests/e2e/journey.spec.ts`; `tests/runtime/journey.worker.test.ts` |
| RESP-015 | Abuse defenses | published | done | `tests/e2e/public-rate.spec.ts`; `tests/runtime/journey.worker.test.ts`; `tests/runtime/transition.worker.test.ts` |
| RESP-016 | Bot submissions are excluded and retained | published | done | `tests/runtime/traffic.worker.test.ts`; `tests/e2e/traffic-review.spec.ts` |
| RESP-017 | Suspected submissions are quarantined, not lost | published | done | `tests/runtime/journey.worker.test.ts` |
| RESP-018 | Quarantine review | published | done | `tests/runtime/journey.worker.test.ts` |
| RESP-019 | Retained flow metrics | published | done | `tests/runtime/journey.worker.test.ts`; `tests/runtime/transition.worker.test.ts` |
| RESP-020 | Respondent confirmation email | target | partial | `tests/runtime/respondent-confirmations.worker.test.ts`; `tests/runtime/notification-restore.worker.test.ts`; `tests/e2e/distribution-foundation.spec.ts`; `scripts/deployment-data.check.mjs` |
| RESP-021 | Edit after submission | target | done | `tests/runtime/response-webhooks.worker.test.ts`; `tests/runtime/respondent-confirmations.worker.test.ts`; `tests/e2e/save-resume.spec.ts`; `scripts/deployment-data.check.mjs`; `src/core/features/responses/edits.ts`; `migrations/core/0067_response_edits.sql` |
| PART-001 | Consented partial-response capture | target | missing |  |
| PART-002 | Save and resume | target | done | `src/core/features/resuming/`; `src/core/features/responses/ui/SaveResponse.tsx`; `src/core/features/responses/ui/ResumeFlowPage.tsx`; `migrations/core/0043_saved_responses.sql`; `tests/runtime/resuming.worker.test.ts`; `tests/e2e/save-resume.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| RESP-022 | Response-quality flags | target | partial | `src/core/features/responses/service.ts`; `tests/runtime/journey.worker.test.ts` |
| RESP-023 | Identified public links | target | partial | `src/core/shared/hiddenFields.ts`; `tests/runtime/hidden-fields.worker.test.ts`; `tests/e2e/hidden-fields.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| RESP-024 | Review before submit | target | done | `src/core/shared/flowPolicies.ts`; `src/core/features/responses/ui/RespondentFlowPage.tsx`; `src/core/features/responses/ui/ReviewAnswers.tsx`; `tests/e2e/date-format.spec.ts`; `tests/e2e/review-journey.ts` |
| LEDG-001 | Ledger | published | done | `tests/e2e/answer-results.spec.ts`; `tests/e2e/distribution-foundation.spec.ts`; `tests/e2e/imported-results.spec.ts` |
| LEDG-002 | Counts | published | done | `tests/runtime/form-import.worker.test.ts`; `tests/runtime/journey.worker.test.ts`; `tests/runtime/reporting-bounded.worker.test.ts` |
| LEDG-003 | Filters | published | done | `tests/e2e/distribution-foundation.spec.ts`; `tests/e2e/ledger-filters.spec.ts`; `tests/e2e/reporting-counts.spec.ts` |
| LEDG-004 | Response export | published | done | `tests/e2e/journey.spec.ts`; `tests/e2e/ledger-filters.spec.ts`; `tests/e2e/new-question-types.spec.ts` |
| LEDG-005 | Spreadsheet and statistics exports | target | done | `src/core/features/reporting/export.ts`; `src/core/features/reporting/xlsxExport.ts`; `src/core/features/reporting/zip.ts`; `src/core/features/reporting/savDictionary.ts`; `src/core/features/reporting/savWriter.ts`; `src/core/features/reporting/exportInventory.ts`; `tests/runtime/ledger-filters.worker.test.ts`; `tests/runtime/collectors-trends.worker.test.ts`; `tests/runtime/export-reader.global.ts`; `tests/e2e/ledger-filters.spec.ts`; `docs/evidence/ledg005-exports-1440.png`; `docs/evidence/ledg005-exports-390.png` |
| LEDG-006 | Response search | target | done | `migrations/core/0053_response_search_values.sql`; `src/core/features/reporting/search.ts`; `tests/runtime/ledger-filters.worker.test.ts`; `tests/runtime/ledger-search-upgrade.worker.test.ts`; `tests/runtime/other-choices.worker.test.ts`; `scripts/deployment-data-custody-replay.check.mjs`; `tests/e2e/response-search.spec.ts`; `tests/release/ledger-search.worker.test.ts`; `docs/evidence/ledger-search-2026-10-20.json`; `scripts/run-contract-lane.mjs`; `tests/release/ledger-search.worker.test.ts` |
| WORK-001 | Submission inbox | target | done | `tests/e2e/response-search.spec.ts`; `tests/e2e/submission-inbox-journey.ts`; `tests/runtime/submissions.worker.test.ts` |
| WORK-002 | Approval flows | target | missing |  |
| WORK-003 | Multi-person forms | target | missing |  |
| WORK-004 | Workflow reminders and escalation | target | missing |  |
| WORK-005 | Submission PDFs and generated documents | target | missing |  |
| RSLT-001 | Response summary | published | done | `tests/runtime/journey.worker.test.ts`; `tests/runtime/ledger-filters.worker.test.ts`; `tests/runtime/reporting-bounded.worker.test.ts`; `tests/e2e/answer-results.spec.ts`; `tests/e2e/distribution-foundation.spec.ts`; `tests/e2e/imported-results.spec.ts`; `tests/e2e/reporting-counts.spec.ts`; `tests/e2e/text-answer-plurals.spec.ts` |
| RSLT-002 | Drop-off by question | published | done | `tests/e2e/answer-results.spec.ts`; `tests/e2e/imported-results.spec.ts`; `tests/e2e/text-answer-plurals.spec.ts` |
| RSLT-003 | Stated denominators | published | partial | `tests/runtime/journey.worker.test.ts`; `tests/runtime/ledger-filters.worker.test.ts`; `tests/runtime/reporting-bounded.worker.test.ts`; `tests/e2e/answer-results.spec.ts`; `tests/e2e/distribution-foundation.spec.ts`; `tests/e2e/imported-results.spec.ts`; `tests/e2e/reporting-counts.spec.ts`; `tests/e2e/text-answer-plurals.spec.ts` |
| RSLT-004 | Device split | published | partial | `tests/runtime/journey.worker.test.ts`; `tests/runtime/distribution.worker.test.ts`; `tests/runtime/retention-schedule.worker.test.ts`; `tests/runtime/upgrades.worker.test.ts`; `scripts/deployment-data.check.mjs`; `tests/e2e/answer-results.spec.ts`; `tests/e2e/ledger-filters.spec.ts` |
| RSLT-005 | Results across revisions | published | done | `tests/e2e/answer-results.spec.ts`; `tests/e2e/reporting-bounded.spec.ts`; `tests/e2e/revision-comparison-http.spec.ts` |
| RSLT-006 | Crosstabs | target | done | `src/core/features/reporting/crosstab.ts`; `src/core/features/reporting/crosstabDimensions.ts`; `src/core/features/reporting/crosstabStats.ts`; `src/core/features/results/ui/CrosstabPanel.tsx`; `tests/runtime/collectors-trends.worker.test.ts`; `tests/e2e/answer-results.spec.ts`; `docs/evidence/rslt006-crosstab-1440.png`; `docs/evidence/rslt006-crosstab-390.png` |
| RSLT-007 | Trends over time | target | partial | `src/core/features/reporting/trends.ts`; `src/core/features/reporting/trendPeriods.ts`; `src/core/features/results/ui/TrendsPanel.tsx`; `tests/runtime/collectors-trends.worker.test.ts` |
| RSLT-008 | Saved views and dashboards | target | done | `tests/runtime/collectors-trends.worker.test.ts`; `tests/e2e/answer-results.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| RSLT-009 | Shared report links | target | partial | `tests/runtime/collectors-trends.worker.test.ts`; `tests/e2e/answer-results.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| RSLT-010 | Report exports | target | missing |  |
| RSLT-011 | Scheduled report email | target | missing |  |
| RSLT-012 | Open-text coding | published | done | `src/core/features/coding/`; `tests/runtime/coding.worker.test.ts`; `tests/e2e/coding.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| RSLT-013 | Views and start rate | target | done | `src/core/features/traffic/`; `src/core/features/results/ui/TrafficPanel.tsx`; `tests/runtime/traffic.worker.test.ts`; `tests/e2e/traffic.spec.ts`; `tests/e2e/traffic-review.spec.ts`; `tests/e2e/save-resume.spec.ts` |
| ANLY-001 | Analysis run | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-run.worker.test.ts` |
| ANLY-002 | Fixed evidence set | published | done | `tests/runtime/analysis-run.worker.test.ts`; `tests/runtime/analysis-safety.worker.test.ts` |
| ANLY-003 | Findings | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-004 | Exact evidence | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-005 | Disclosure threshold | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-006 | Recommendations | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-007 | Staleness | published | done | `tests/runtime/analysis-run.worker.test.ts` |
| ANLY-008 | Provider failure | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-safety.worker.test.ts`; `tests/runtime/feedback-rewrites.worker.test.ts` |
| ANLY-009 | Builder assistance | published | done | `tests/runtime/feedback-rewrites.worker.test.ts` |
| ANLY-010 | Cost | published | done | `tests/runtime/analysis-safety.worker.test.ts`; `tests/runtime/feedback-rewrites.worker.test.ts` |
| ANLY-011 | Evidence provenance | published | done | `tests/e2e/analysis.spec.ts`; `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-012 | Output validation | published | done | `tests/runtime/analysis-output.worker.test.ts` |
| ANLY-013 | Insufficient evidence | published | done | `tests/runtime/analysis-run.worker.test.ts` |
| ANLY-014 | Untrusted evidence | published | done | `tests/runtime/analysis-safety.worker.test.ts` |
| ANLY-015 | Analysis policy snapshot | published | done | `tests/runtime/analysis-run.worker.test.ts` |
| ANLY-016 | Provider retry | published | done | `tests/runtime/analysis-safety.worker.test.ts` |
| ACT-001 | Action record | published | done | `tests/e2e/actions.spec.ts` |
| ACT-002 | Action lifecycle | published | done | `tests/e2e/actions.spec.ts`; `tests/runtime/actions-lifecycle.worker.test.ts` |
| ACT-003 | External task | published | done | `tests/e2e/actions.spec.ts`; `tests/runtime/actions-task.worker.test.ts` |
| ACT-004 | Task failure | published | done | `tests/runtime/actions-task.worker.test.ts` |
| ACT-005 | Follow-up measurement | published | done | `tests/e2e/actions.spec.ts`; `tests/runtime/actions-measurement.worker.test.ts` |
| ACT-006 | Confirmed task payload | published | done | `tests/e2e/actions.spec.ts`; `tests/runtime/actions-task.worker.test.ts` |
| ACT-007 | Task delivery state | published | done | `tests/contract/data-release.contract.test.ts`; `tests/e2e/actions.spec.ts`; `tests/runtime/actions-task.worker.test.ts` |
| ACT-008 | Manual recommendation | published | done | `tests/e2e/actions.spec.ts` |
| ACT-009 | Action owner reminders | target | done | `src/core/features/notifications/action-reminder-dispatcher.ts`; `src/core/features/actions/reminders.ts`; `migrations/core/0054_action_owner_reminders.sql`; `tests/runtime/actions-measurement.worker.test.ts`; `tests/e2e/actions.spec.ts`; `scripts/deployment-data-custody-replay.check.mjs` |
| NOTIFY-001 | Analysis attention | published | done | `tests/runtime/feedback-attention.worker.test.ts` |
| NOTIFY-002 | New-response mail | published | done | `tests/e2e/notifications.spec.ts`; `tests/e2e/request-notifications.spec.ts`; `tests/managed-mail.test.ts` |
| NOTIFY-003 | Digest | published | done | `tests/managed-mail.test.ts`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/feedback-digest.worker.test.ts` |
| NOTIFY-004 | No mail loops | published | done | `tests/e2e/notifications.spec.ts`; `tests/e2e/request-notifications.spec.ts`; `tests/managed-mail.test.ts` |
| NOTIFY-005 | Answer-based alerts | target | partial | `tests/runtime/notifications.worker.test.ts`; `tests/runtime/answer-alert-proof.ts`; `tests/e2e/notifications.spec.ts`; `src/core/features/notifications/answer-alerts.ts`; `migrations/core/0068_answer_alerts.sql` |
| NOTIFY-006 | Response emails with answers | target | partial | `src/core/features/notifications/dispatcher.ts`; `src/core/features/notifications/compose.ts`; `tests/runtime/notifications.worker.test.ts`; `tests/e2e/notifications.spec.ts` |
| DATA-001 | Export contents | published | done | `tests/contract/data-release.contract.test.ts`; `tests/runtime/analysis-safety.worker.test.ts`; `tests/runtime/archive-stream.worker.test.ts` |
| DATA-002 | Response erasure | published | done | `tests/e2e/answer-results.spec.ts`; `tests/runtime/analysis-safety.worker.test.ts`; `tests/runtime/feedback-digest.worker.test.ts` |
| GOV-001 | HIPAA mode | target | missing |  |
| GOV-002 | Data location | target | missing |  |
| GOV-003 | Retention schedules | published | done | `src/core/features/retention/`; `migrations/core/0052_retention.sql`; `tests/runtime/retention-schedule.worker.test.ts`; `tests/e2e/retention.spec.ts`; `tests/runtime/calculations.worker.test.ts` |
| GOV-004 | Sensitive fields | target | missing |  |
| GOV-005 | Audit log viewer | target | partial | `src/core/features/audit/`; `src/core/features/audit/events.ts`; `tests/runtime/audit-viewer.worker.test.ts`; `tests/e2e/response-webhooks.spec.ts` |
| GOV-006 | Respondent privacy requests | target | done | `tests/runtime/resuming.worker.test.ts`; `tests/e2e/retention.spec.ts`; `tests/runtime/analysis-safety.worker.test.ts` |
| GOV-007 | Marketing and messaging consent | target | partial | `src/core/shared/marketingConsent.ts`; `tests/runtime/new-question-types.worker.test.ts`; `src/core/features/results/ui/ConsentRecords.tsx`; `src/core/features/flows/ui/MarketingOptInSettings.tsx`; `tests/runtime/foundation.worker.test.ts`; `tests/e2e/closed-flow.spec.ts` |
| IMPORT-001 | Reviewed definition | published | done | `tests/e2e/form-import.spec.ts`; `tests/e2e/google-forms-import.spec.ts`; `tests/runtime/form-import.worker.test.ts` |
| IMPORT-002 | Reviewed CSV | published | done | `tests/e2e/form-import.spec.ts`; `tests/e2e/google-forms-import.spec.ts`; `tests/e2e/import-acknowledgement.spec.ts` |
| IMPORT-003 | Historical privacy and pinning | published | done | `tests/e2e/form-import.spec.ts`; `tests/e2e/google-forms-import.spec.ts`; `tests/e2e/import-acknowledgement.spec.ts` |
| IMPORT-004 | Durable replay and reversal | published | done | `tests/e2e/form-import.spec.ts`; `tests/e2e/google-forms-import.spec.ts`; `tests/e2e/import-acknowledgement.spec.ts` |
| IMPORT-005 | SurveyMonkey migration | target | partial | `tests/runtime/form-import.worker.test.ts`; `tests/e2e/surveymonkey-import.spec.ts` |
| IMPORT-006 | Jotform migration | target | missing |  |
| IMPORT-007 | Typeform and Google Forms by connection | target | partial | `src/core/features/importing/typeform-definition.ts`; `tests/runtime/typeform-definition.worker.test.ts`; `tests/e2e/google-forms-import.spec.ts`; `tests/e2e/form-import.spec.ts` |
| IMPORT-008 | Up-and-comer and Microsoft exports | target | missing |  |
| IMPORT-009 | Migration checklist | target | missing |  |
| PAY-001 | Stripe payments on a form | target | partial | `src/core/features/payments/`; `src/core/features/responses/payment-responses.ts`; `src/core/features/flows/payment-proof.ts`; `src/core/shared/payments.ts`; `migrations/core/0055_payments.sql`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/archive-stream.worker.test.ts`; `tests/e2e/calculations.spec.ts` |
| PAY-002 | Sales tax, coupons and receipts | target | partial | `tests/runtime/calculations.worker.test.ts`; `tests/e2e/calculations.spec.ts` |
| PAY-003 | Subscriptions and donations | target | partial | `tests/runtime/calculations.worker.test.ts`; `tests/e2e/calculations.spec.ts` |
| PAY-004 | ACH and other US payment methods | target | partial | `tests/runtime/calculations.worker.test.ts`; `tests/e2e/calculations.spec.ts` |
| PAY-005 | Payment ledger and refunds | target | partial | `tests/runtime/calculations.worker.test.ts`; `tests/e2e/calculations.spec.ts`; `docs/evidence/pay005-stripe-test-2026-10-26.json`; `scripts/proof/payments-stripe-test.mjs`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/calculations.worker.test.ts`; `tests/runtime/calculations.worker.test.ts` |
| FILE-001 | File-upload questions | target | missing |  |
| FILE-002 | Storage sync | target | missing |  |
| FILE-003 | Upload scanning | target | missing |  |
| SIGN-001 | Signature fields | target | missing |  |
| AI-003 | Document extraction with respondent correction | target | missing |  |
| PROG-001 | Program setup | target | partial | `src/core/features/flows/templates.ts`; `tests/runtime/new-question-types.worker.test.ts` |
| PROG-002 | Transactional triggers | target | missing |  |
| PROG-003 | Score tracking | target | missing |  |
| PROG-004 | Closed-loop follow-up | target | missing |  |
| INTEG-001 | Google Sheets | target | done | `tests/runtime/google-sheets.worker.test.ts`; `src/core/features/google-sheets/`; `migrations/core/0066_google_sheets.sql` |
| INTEG-002 | Microsoft Excel | target | missing |  |
| INTEG-003 | HubSpot | target | missing |  |
| INTEG-004 | Salesforce | target | missing |  |
| INTEG-005 | Orbit | target | missing |  |
| INTEG-006 | Slack and Microsoft Teams | target | partial | `tests/runtime/response-webhooks.worker.test.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/e2e/response-webhooks.spec.ts`; `tests/e2e/chat-settings-proof.ts`; `src/core/features/chat-integrations/`; `migrations/core/0069_chat_integrations.sql`; `docs/evidence/integ006-slack-live-2026-10-26.json`; `scripts/proof/chat-slack-live.mjs`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts`; `tests/runtime/chat-integrations-proof.ts` |
| INTEG-007 | Mailchimp and Mango | target | missing |  |
| INTEG-008 | Notion, Airtable and Cradle | target | missing |  |
| INTEG-009 | Zapier, Make, n8n and Crank | target | missing |  |
| INTEG-010 | Signed response webhooks | target | partial | `src/core/features/webhooks/`; `migrations/core/0063_response_event_webhooks.sql`; `tests/runtime/response-webhooks.worker.test.ts`; `tests/e2e/notifications.spec.ts`; `scripts/deployment-data.check.mjs`; `docs/guide/results.md`; `src/core/features/actions/webhook.ts`; `tests/runtime/actions-task.worker.test.ts` |
| INTEG-011 | Public REST API | target | partial | `src/core/features/reporting/routes.ts`; `tests/runtime/ledger-filters.worker.test.ts` |
| INTEG-012 | MCP server for Claude and ChatGPT | target | missing |  |
| INTEG-013 | Task destinations | target | partial | `src/core/features/actions/todoist.ts`; `src/core/features/actions/webhook.ts`; `tests/runtime/actions-task.worker.test.ts` |
| INTEG-014 | Help-desk and commerce event sources | target | missing |  |
| INTEG-015 | Integration delivery ledger | target | partial | `src/core/features/webhooks/ledger.ts`; `src/core/features/webhooks/deliveries.ts`; `tests/runtime/response-webhooks.worker.test.ts`; `tests/runtime/actions-task.worker.test.ts`; `tests/e2e/response-webhooks.spec.ts`; `src/core/features/actions/deliveries.ts`; `tests/runtime/google-sheets.worker.test.ts` |
| INTEG-016 | Connection custody | target | partial | `src/core/platform/config/connections.ts`; `tests/e2e/actions.spec.ts`; `tests/e2e/analysis.spec.ts` |
| INTEG-017 | Ad conversion events | target | partial | `src/core/features/embedding/script.ts`; `tests/e2e/script-embed.spec.ts` |
| MOB-001 | Operator app on a phone | target | partial | `tests/e2e/accessibility-foundation.spec.ts` |
| MOB-002 | Offline field collection | target | missing |  |
| MOB-003 | Native iOS and Android apps | target | missing |  |
| AGENT-001 | Study designer | push-further | partial | `tests/runtime/feedback-rewrites.worker.test.ts`; `tests/e2e/analysis.spec.ts`; `tests/runtime/studio-scenario.ts`; `tests/e2e/studio-journey.ts` |
| AGENT-002 | Themes and contradictions | push-further | partial | `tests/runtime/analysis-output.worker.test.ts`; `tests/e2e/analysis.spec.ts` |
| AGENT-003 | Follow-up that settles it | push-further | missing |  |
| AGENT-004 | Finding into owned work, and the outcome checked | push-further | partial | `src/core/features/actions/service.ts`; `tests/runtime/actions-measurement.worker.test.ts` |
| AGENT-005 | Feedback-loop sentinel | push-further | partial | `src/core/features/actions/deliveries.ts`; `src/core/features/responses/completionMetrics.ts`; `src/core/features/analysis/attention.ts` |
| AGENT-006 | Adaptive probe | push-further | missing |  |
| AGENT-007 | Close-the-loop drafter | push-further | missing |  |
| AGENT-008 | Completion optimizer | push-further | missing |  |
| AGENT-009 | Migration agent | push-further | partial | `src/core/features/importing/typeform-definition.ts`; `tests/runtime/typeform-definition.worker.test.ts` |
