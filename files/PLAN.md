# sd-pencil-rer-pin-103 plan

1. Refresh the fleet launcher; install credential helper, push guard and commit cleanup hook. Use the fleet identity for all commits. Keep product and evidence refs separate.
2. Clone just-every/run-pencil with full history and blob filtering. Start cloud/sd-pencil-rer-pin-103 at origin/main. Read repository rules and retain CONTRACT.md and its generated views unchanged.
3. Change only the exact @runeditrun/rer pin to 0.2.103 and use pnpm install to update its lock entries. Resolve rer-v0.2.103 through gh api, acquire its immutable Base archive through gh api (no Base clone), and invoke the pinned rer refresh-base with the full resolved commit and archive. Inspect the rewrite scope; no manual product, test, UI or contract edits.
4. Run the requested new-CLI rer verify. The task's explicit verification requirement overrides the repository's general instruction against a full local rer verify. Stop without a product push if refresh or verification needs edits outside the lease.
5. Probe bounded setup/production preview startup with .dev.vars present, then project typecheck. Use cloud_run for long-lived commands, keep generated private values out of logs/evidence, and stop only task-owned processes.
6. Stage intentional leased changes, inspect source changes, regenerate sources.lock.json last with pnpm source:lock, and run pnpm source:check. Keep generated ACCEPTANCE.md/docs/CLAIMS.md from origin/main.
7. Review diff, identity, all candidate messages and trailers. Commit with fleet environment overrides and active hooks; immediately push only cloud/sd-pencil-rer-pin-103 through cloud-push.py.
8. Discover and poll exact-SHA Verify through REST within the ten-call API budget, with at most one call per run per 300 seconds. Diagnose completed failed jobs once each if budget permits. Require exact-SHA success, except the documented generated-view exemption.
9. Save complete non-secret report and actual receipts here. Publish explicitly selected files only to evidence/sd-pencil-rer-pin-103 using cloud_evidence.py. Return exact provenance and the lane POST line. After successful preservation, delete the product clone and its node_modules as requested; preserve packet and transport provenance.

No clause, status or count changes are planned. No landing or deployment is authorized.
