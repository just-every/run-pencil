# sd-pencil-c-f23 plan

Scope: implement only uploaded SurveyMonkey API v3 single-selection matrices and historical row answers under IMPORT-005. Preserve all existing text, rating, Other, privacy, workload and undo assertions. Add no test registration; retain a genuinely unsupported matrix-menu question. IMPORT-005 remains PARTIAL; FIELD-002 and all contract judgments remain unchanged.

1. Read the importer, matrix model, contract, existing native and browser journeys, and shipped fleet rules. Establish main CI and counts.
2. Map distinct source row and shared-choice IDs into native matrix settings and choices. Normalize historical answers using these IDs, preserving unequal values and optional omissions. Refuse unknown references and repeated selections before writes.
3. Extend existing native journey through authenticated review, commit, ledger, publication, public collection and undo. Keep the 27-completion fixture and every existing assertion.
4. Extend the existing browser journey, inspect review at 1440 and 390, and preserve accessibility and layout checks. Use system Chromium with no sandbox.
5. Run touched Worker tests, typecheck, first-party checks, generator write and check, restore generated views, regenerate source lock last and verify it. Commit with fleet identity and hooks. Publish branch saves and a final candidate through the guarded push entrypoint.
6. Merge updated main after any published save. Keep main's contract judgments. Discover exact-SHA Verify through REST within budget. Publish selected non-secret reports and receipts separately to the evidence ref. Hand over product custody to the maintained lander; never push main.

Held remainder: OAuth and survey selection, source collector attribution, ranking, source skip and display routing including advanced conditions, later descriptive text pending FIELD-011, and other matrix modes. No new policy default is required.
