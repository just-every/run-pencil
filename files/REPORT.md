# sd-pencil-rer-pin-104 — Pencil rer 0.2.104 adoption

Result at report creation: **READY**. Product head `bd597801ed2d13626ee5898c3bc91cb55cdf1edd` on `cloud/sd-pencil-rer-pin-104` in `just-every/run-pencil`. This is branch custody and verification evidence, never a landing or deployment claim.

## Provenance and scope

- Fresh full-history Pencil clone; `git rev-parse --is-shallow-repository` returned `false`.
- Fetched the required predecessor and printed `git rev-parse HEAD`: `3c51bdf7dd44363933242447e1536a421f6e9e14`, exactly matching the brief.
- Created `cloud/sd-pencil-rer-pin-104` from that predecessor, merged fresh main `0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef`, and retained all newer main code and tests. The final commit is a merge with those two parents.
- Product writes and pushes were only to Pencil. No Base clone, Base push, Base PR, default-branch push, force push, rebase of published history, inbox read/write, provider deployment, or clause promotion occurred.
- Read the rer 0.2.104 release notes and refresh help. The npm lock integrity matches the published release. Base target: `96045612467d5e752c668e8557b4bf6e906edfb1`.

## Full plan

1. Configure fleet identity, launcher credentials, push guard, commit hooks and the repository-pinned toolchain. Fresh full-history clone of just-every/run-pencil; verify the 0.2.103 candidate is 3c51bdf7dd44363933242447e1536a421f6e9e14. Create cloud/sd-pencil-rer-pin-104 and merge fresh origin/main, preserving main's tests and clause judgments.
2. Read rer 0.2.104 release notes and refresh-base help. Pin package.json and pnpm-lock.yaml to 0.2.104. Refresh Base copies to 96045612467d5e752c668e8557b4bf6e906edfb1 using --from-api: only Pencil is declared writable and other repositories may only be read via gh api.
3. Carry the privacy migration into the next forward sequence, retaining applied bytes. Update provenance and deployment data classification, regenerate the deployment spec.
4. Implement Pencil people.businessStopped from durable bs_settings state: exactly false only for a positively running paired Business. Prove signed relay pulls while running, refusal after signed detachment durably records the stop, and both outcomes of an old Business approval after pairing changes, retaining all prior assertions.
5. Run affected tests, native D1 release upgrades, populated migration checks, typecheck, first-party checks and publication scanning. Run contract generator and its check without changing clause statuses; restore generated views from origin/main. Regenerate source lock last and run lock/source/migration ledger checks.
6. Inspect all candidate commit identities, trailers and messages; publish only cloud/sd-pencil-rer-pin-104 through cloud-push.py. Observe exact-SHA Verify through bounded REST calls, report actual outcomes, and preserve work if blocked.
7. Save actual non-secret reports and receipts in this packet, publish explicitly selected files only to evidence/sd-pencil-rer-pin-104, then remove the successfully published product clone and its node_modules. Return product SHA, CI IDs, counts, clause status changes and the SD inbox line without claiming landing.

## Implemented behavior

1. Pinned package.json and pnpm-lock.yaml to `@runeditrun/rer@0.2.104`.
2. Ran `rer refresh-base --ref 96045612467d5e752c668e8557b4bf6e906edfb1 --from-api`. All Base content was acquired through authenticated `gh api`. The first bounded run expired; its retry was stopped before writes to use a verified immutable-archive blob cache. The cache verified all 4,692 GitHub archive files against Git blob object IDs in the authenticated immutable API tree; ancestry and uncached reads still used GitHub. The final refresh completed successfully. See base-api-cache-receipt.json and refresh-base-cached.log.
3. Carried Base `default-seed/migrations/core/0043_agent_door_relay_privacy.sql` as Pencil `migrations/core/0078_agent_door_relay_privacy.sql`, recorded its exact Base provenance, and regenerated the deployment spec with `pnpm integration:sync`. Earlier 0074 and 0077 bytes are unchanged; all earlier applied migration files remain intact. The existing explicit relay-column classification remains authorization-excluded, with a comment tying the privacy migration to that policy.
4. Added `people.businessStopped()` in `src/agent-door/people.ts`. It returns exactly false only for durable `stopped=0` state with a nonempty recorded owner binding. Missing state, absent binding and stopped state return true; Base also fails closed if the adapter throws.
5. Added public-door tests for an adopted policy with unknown durable Business state; a running signed relay; new-feed inclusion of its own decision; old approve and reject outcomes after adopting a newly paired Business; unchanged native draft; and signed detachment refusing both relay and Business-token admission. Retained all existing resource assertions.
6. Added populated-migration proof that repair removes only a provable cross-Business membership, preserves every audit byte and unprovable historical membership, and assigns future done/refused executions to the original parent Business. Reapplying the repair, update triggers, erasure, missing-parent exclusion and authorization export exclusions are asserted.
7. Regenerated the source lock after the final source edit; contract generation/check passed, and generated views were restored from origin/main. No generated view was committed.

## Before and after

| Measure | Before | After |
| --- | --- | --- |
| rer pin | 0.2.103 | 0.2.104 |
| Core migrations | 79 | 80 |
| Base copy records | 231 | 232 |
| Recorded Base files | 773 | 776 |
| Clause status counts | 142 done / 61 partial / 49 missing | 142 done / 61 partial / 49 missing |
| Production-door conformance | 2307/2307 recorded in predecessor CONTRACT | 2675/2675 observed locally |

Clause status changes: **none**. All thirteen BASE-AGENT clauses retain partial status. No tracked Base paths were removed. No existing test was deleted, skipped or weakened. WordPress embed source and fixtures were unchanged.

## Actual public probes

```text
PROBE pencil-0.2.104: populated 0077 -> 0078 relay migration -> one provable leak removed; all audits retained; done/refused executions stay with original Business
PROBE pencil-0.2.104: signed relay pull with adopted policy but missing Business settings -> empty 404
PROBE pencil-0.2.104: POST /api/rer/agent-decisions + signed running Business pull -> 200 with decisions
PROBE pencil-0.2.104: POST old Business approval/approve after pairing new Business -> refused; new signed relay has no old decision or execution
PROBE pencil-0.2.104: POST old Business approval/reject after pairing new Business -> rejected; new signed relay has no old decision or execution
PROBE pencil-0.2.104: POST /api/rer/business-settings + signed detached:true then relay pull / MCP tools/list -> empty 404 / 401
```

## Local checks

All final required local checks below passed through `cloud_run` with bounded commands. Final application builds, typecheck, first-party, ledger, hosted relay and conformance checks used project Node 22.20.0. The earlier native D1 and populated-migration checks used the VM Node 24.19.0 runtime before the explicit project-runtime switch. Native D1 upgrade retained 51 released predecessor migrations and passed all three registered cases; the populated migration suite passed 2/2 tests; production-door conformance passed 2675/2675.

| Check | Command | Exit |
| --- | --- | --- |
| populated-migration | `timeout 120 node --test scripts/deployment-data-agent-door-upgrade.check.mjs` | 0 |
| native-d1-upgrade | `timeout 300 pnpm verify:migrations` | 0 |
| migration-ledger-node22 | `timeout 900 node --test --test-concurrency=1 scripts/deployment-data-hosted.check.mjs` | 0 |
| first-party-final | `timeout 120 pnpm exec rer check --profile first-party` | 0 |
| manifest | `timeout 90 pnpm verify:manifest` | 0 |
| boundaries | `timeout 90 pnpm verify:boundaries` | 0 |
| base-source | `timeout 180 pnpm verify:base` | 0 |
| integration-sync | `timeout 900 pnpm integration:sync` | 0 |
| product-build | `timeout 900 npx -y @runeditrun/rer build` | 0 |
| hosted-relay-privacy-final | `timeout 900 node tests/agent-door/resources.mjs` | 0 |
| agent-door-conformance | `timeout 1200 node node_modules/@runeditrun/rer/cli/agent-door.mjs . deploy.json` | 0 |
| source-lock-final | `timeout 120 node scripts/edition-authoring/cli.mjs lock` | 0 |
| source-lock-check-final | `timeout 120 node scripts/edition-authoring/cli.mjs check` | 0 |
| source-check-final | `timeout 180 pnpm source:check` | 0 |
| publication | `timeout 600 pnpm verify:publication` | 0 |

```text
MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=node scripts/edition-authoring/cli.mjs check exit=0
MECHANICAL source=pnpm source:check exit=0; migration-ledger=node --test --test-concurrency=1 scripts/deployment-data-hosted.check.mjs exit=0
```

The maintained publication scan returned `{"status":"PASS","complete":true,"findings":0,"reviewed":0}`. Gitleaks 8.30.1 was installed with the repository checksum verification. The author/committer and trailer audit covered every one of the five candidate commits, including side parents: all are fleet identity with no co-author trailers.

## Attempts and preserved scope

- Initial refresh hit its 600-second bound; an API-only retry was stopped in favor of the verified cache. No partial refresh writes were committed; final refresh and provenance checks passed.
- Host-runtime typecheck and the initial 240-second ledger test hit their time bounds. Only the task-started timed-out ledger child PIDs were stopped. Exact Node 22 typecheck passed, the longer ledger run passed, and final application builds also passed typecheck.
- The first new hosted probe used `/auth/settings/business`, which Pencil does not register, and got 404. The new test driver was corrected to use the supported signed `POST /api/rer/business-settings` with `detached:true`. Its durable stop assertions and all other assertions passed on the rerun. No production auth route or existing test assertion was changed to accommodate it.
- Refresh reported React 19.3.1 as its Base version while preserving Pencil’s existing React requirement/lock, and preserved the seed-owned Verify workflow. Those unrelated dependencies and workflow were not changed. No local failure remains from those notices.

## Product publication and exact-SHA CI

- Product branch: `cloud/sd-pencil-rer-pin-104`.
- Full head: `bd597801ed2d13626ee5898c3bc91cb55cdf1edd`.
- Product push: first attempt succeeded through the required cloud-push.py guard. One product push; no `[skip ci]` on the final commit.
- PR: none. The existing Verify workflow has a pre-main push entry point for cloud branches, so no PR was required to obtain CI.
- Exact-SHA Verify run: [42612405228](https://github.com/just-every/run-pencil/actions/runs/42612405228).
- Latest observed status: `completed` / `success` on `bd597801ed2d13626ee5898c3bc91cb55cdf1edd`.
- Watcher GitHub reads: 4; one watcher, calls at least 300 seconds apart. Full actual responses and times are in ci-receipt.json.
- Readiness is claimed only if this exact SHA completes successfully, or a documented generated-view-only exemption applies. No exemption has been invoked.

## Evidence custody and cleanup

An additional raw Gitleaks directory scan of the verbose packet logs matched 35 occurrences of seven baseline snapshot cache keys. Every match was verified against the committed `sources.lock.json` `components[].baseline.key` SHA-256 identities; these are source-cache addresses, not credentials. The actual redacted raw findings and structural classification are retained in packet-scan.json and packet-scan-receipt.json. No exclusion or allowlist was applied. This additional directory scan is separate from the required maintained product publication scan, which completed with zero findings and zero reviews.

The packet contains the actual report, plan, check receipts, provenance receipts, complete selected non-secret command logs and exact-SHA CI responses. Evidence is published separately to `refs/heads/evidence/sd-pencil-rer-pin-104`, never to the product branch or a PR. The evidence manifest binds the product head and hashes every selected file; the terminal EVIDENCE line supplies its exact evidence head.

The product checkout and node_modules are retained until the evidence ref is published and fetched back with manifest/hash verification. They are then removed before the final message. The report itself does not pre-claim that later cleanup; the terminal response records its actual result.

## Blockers

None.
