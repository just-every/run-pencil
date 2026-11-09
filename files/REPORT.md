# sd-pencil-rer-pin-105 — Pencil rer 0.2.105 adoption

Pencil now refuses a legacy untagged Business approval after its Business detaches, or when the durable stop state is missing or unreadable, with `sponsor_unavailable` and an unchanged native draft. Running Business approvals and the public embedded invocation control still execute. This is a schema-neutral adoption of rer 0.2.105; migration 0079 remains valid, idempotent and byte-identical.

Product repository: just-every/run-pencil. Branch: `cloud/sd-pencil-rer-pin-105`. Head: `859d55e95c00c585f5cbc0247791adb404638dfb`. Tree: `867fec9bded68df2fc42dc2774968757600730e1`. Base: `f591a3e245f1e5fa9f3b5fa63f8b474eecc3cd3d`. Push custody: pushed. PR: none required or created. CI state: credential_recovery. Landing: not performed; reserved to the fleet Mac.

## Plan and result

1. Establish fleet identity, launcher authentication, credential helper and commit hooks; clone Pencil with complete history and create cloud/sd-pencil-rer-pin-105 from fresh origin/main.
2. Read repository rules and rer 0.2.105 release/help. Upgrade the exact package and lockfile pin, then refresh Base copies to feb76ac8321ff1275168cce10009291721064738 through the supported API route. Preserve all migration bytes, especially 0079; stop if refresh requires a new migration.
3. Exercise production public doors on disposable native Miniflare D1: carry legacy held Business approvals from pre-0.2.104 code through the upgrade, prove refusal after detachment with 0079 and without provenance tagging, retain running Business and local/embedded approval success, and prove unreadable stop state refusal if supported by the disposable fixture.
4. Run touched behavior tests, migration verification, deployment-data agent-door upgrade and hosted checks, typecheck, first-party checks, hosted output and agent-door conformance (at least 2675/2675). Run required publication inspection. No UI change is planned.
5. Stage only leased product files; generate source lock last and run lock/check/source:check. Preserve clause statuses and 142/61/49 counts and generated views.
6. Commit with fleet identity and active hooks; inspect every candidate identity and trailer, push only the named product branch through the fleet guard, and watch exact-SHA Verify within the GitHub budget. Preserve published history.
7. Record complete actual results and receipts in this packet and publish only explicitly selected non-secret files to the separate evidence ref. Return exact product/evidence custody and lane POST line. After successful custody, remove the product clone and dependencies as requested.

Cloud constraints: Base is read only via gh api; use refresh-base --from-api rather than a Base clone. Heavy commands execute directly through cloud_run in this dedicated VM. Product landing is reserved to the fleet Mac. No credentials or private gate material enter this packet.

The fresh product clone used `git clone --filter=blob:none` with no depth; shallow=false. The branch started at fresh origin/main f591a3e245f1e5fa9f3b5fa63f8b474eecc3cd3d; a later fetch confirmed it unchanged. No published history was rewritten. Both author and committer are Run Edit Run fleet <fleet@runeditrun.com>; the commit has no trailers and no skip-CI marker. Complete candidate identity and trailer inspection is in `identity-audit.txt`.

The exact package and lock pin moved 0.2.104 → 0.2.105. The supported refresh command was `pnpm exec rer refresh-base --ref feb76ac8321ff1275168cce10009291721064738 --from-api`. Base was read through gh api, with immutable tarball-derived Git blob caching; the unchanged refresh reader verified every blob against the authenticated commit tree. No Base repository was cloned. The upstream release notes, help, changelog, successful refresh output and cache receipt are included. All 232 copy records identify the target with unchanged membership. Refresh reported editionMigrations=[] and preserved Pencil's own Verify workflow. The three changed Base files are approval-execution.ts, principal.ts and their README explanation.

Nine leased product files changed: package.json, pnpm-lock.yaml, base-copies.json, sources.lock.json, the three Base agent-door files, the new tests/agent-door/legacy-approvals.mjs and its call from tests/agent-door/resources.mjs. No test was deleted, skipped or weakened. No new migration, migration edit, proof directory, contract edit or generated-view edit was committed. All 81 core migration files have identical hashes before and after; 0079 SHA256 is `e02d300e4934ddcbd25019ad9a8e7ef1c9f1cc71390b149d5c685ee41fe9a7d9`. The lock includes the exact staged test and source bytes; source checks report no drift or unrecorded copies.

## Actual public-door probes

The producer was actual historical main ancestor ae8ee162c63e3b970d7ee61eec82614bcf9e2c06 (rer 0.2.94). Immediate pre-0.2.104 code already tags principals; this older ancestor genuinely persists no source. The fixture archives its unchanged native source, creates held approvals through signed public MCP, carries the same native Miniflare D1 through actual 0077–0079, and proves that 0079 changes only saved source provenance. Untagged cases restore the exact historical saved bytes to simulate absent tagging. Every refusal preserves the complete current native draft projection and version. The embedded control calls Base's public invoke API through a test-only adapter around Pencil's actual native services; Pencil does not declare a production embedded HTTP endpoint.

PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + running historical MCP approval -> executed; native form open
PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + tagged-stopped historical MCP approval -> refused sponsor_unavailable; draft unchanged
PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + untagged-stopped historical MCP approval -> refused sponsor_unavailable; draft unchanged
PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + embedded public embedded invoke approval -> executed; native form open
PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + untagged-missing-state historical MCP approval -> refused sponsor_unavailable; draft unchanged
PROBE pencil-0.2.105: POST /agents/api/approvals/:id/approve + untagged-unreadable-state historical MCP approval -> refused sponsor_unavailable; draft unchanged

The before-refresh negative control reproduced the hole: tagged stopped approval refused, but the genuine untagged stopped approval executed. The final standalone probe and the complete production hosted script both pass all six cases. Actual before/after logs and hash-bearing receipts are included.

## Verification

AGENTS.md requires affected local checks and reserves the complete wall for exact-SHA CI. The project verification equivalent from rer-project.json (manifest, boundaries, first-party and source checks) passed, along with the expressly requested migration, hosted recovery, native regression, typecheck, production build and hosted-output checks. Heavy commands ran directly in this dedicated cloud VM through cloud_run, without the Mac slot helper. Actual checks use Node 22.20.0. The browser launcher selects /usr/bin/chromium with --no-sandbox; the successful hosted command's extra fetch preload only logs transport failures. No product assertions, workload sizes or thresholds were changed. There were no UI changes.

| Check | Actual bounded command | Exit | Receipt |
| --- | --- | --- | --- |
| refresh-base | `timeout 1800 python3 /tmp/fleet-command.py pnpm exec rer refresh-base --ref feb76ac8321ff1275168cce10009291721064738 --from-api` | 0 | `refresh-base.receipt.json` |
| migrations | `timeout 300 pnpm verify:migrations` | 0 | `migrations.receipt.json` |
| deployment-data-node22 | `timeout 1200 node --test --test-concurrency=1 scripts/deployment-data-agent-door-upgrade.check.mjs scripts/deployment-data-hosted.check.mjs` | 0 | `deployment-data-node22.receipt.json` |
| legacy-approvals | `source /tmp/rer-cloud-toolchain.sh; export PATH="$HOME/.rer/node/node-v22.20.0-linux-x64/bin:$PATH"; cloud_run timeout 300 node tests/agent-door/legacy-approvals.mjs` | 0 | `legacy-approvals.receipt.json` |
| base-check | `timeout 300 pnpm verify:base` | 0 | `base-check.receipt.json` |
| typecheck | `timeout 600 pnpm typecheck` | 0 | `typecheck.receipt.json` |
| first-party | `timeout 600 bash -c 'pnpm verify:manifest && pnpm verify:boundaries && pnpm verify:cli'` | 0 | `first-party.receipt.json` |
| build | `timeout 900 npx -y @runeditrun/rer build` | 0 | `build.receipt.json` |
| mechanical-lock | `timeout 300 node scripts/edition-authoring/cli.mjs lock` | 0 | `mechanical-lock.receipt.json` |
| mechanical-check | `timeout 300 node scripts/edition-authoring/cli.mjs check` | 0 | `mechanical-check.receipt.json` |
| source-check | `timeout 600 pnpm source:check` | 0 | `source-check.receipt.json` |
| source-check-after-commit | `timeout -k 10 300 pnpm source:check` | 0 | `source-check-after-commit.receipt.json` |
| hosted-output | `timeout 900 node --require /tmp/cloud-browser.cjs --require /tmp/diag-fetch.cjs scripts/verify-hosted-output.mjs` | 0 | `hosted-output.receipt.json` |
| publication | `timeout -k 10 600 pnpm verify:publication` | 0 | `publication.receipt.json` |

Deployment-data upgrade and hosted recovery: 4 tests passed, 0 failed, cancelled, skipped or todo. Migration check: released v0.6.0 predecessor, 51 released migrations, 3 passed/0 failed/0 pending. Conformance before: 2675/2675 (assignment baseline); after: observed 2675/2675 in the complete production hosted script, plus retained native resource/relay checks and all six new probes. Clause counts remain 142 done / 61 partial / 49 missing (252 total); no status changes or promotions.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=node scripts/edition-authoring/cli.mjs check exit=0

pnpm source:check passed before and after commit; drift=[], unrecordedCopies=[].

## Retries and diagnostic limits

An initial immutable API blob read failed without an HTTP status. A subsequent cache-wrapper replacement interrupted the next refresh before any copies were written. The final refresh passed after the prescribed refresh/backoff recovery and a fixed cache wrapper. The original Node24 data-check attempt was cancelled; the complete Node22 retry passed. The first hosted attempt selected the VM global Playwright and a missing bundled browser; the launcher was normalized to the checkout Playwright and system Chromium. A following stylesheet-forwarding fetch failure was transient: the maintained hydration diagnostic passed unchanged, then the entire original hosted script passed. Optional standalone transport/conformance diagnostics were bounded or cancelled after the complete required script passed; their raw non-secret logs and receipts are retained, not represented as product gate successes. Private setup output is excluded because it can contain local development credentials. The setup exit0 receipt is included.

## CI and custody

Verify candidate run ID: 42677374273. Exact head: 859d55e95c00c585f5cbc0247791adb404638dfb.

Actions watcher calls: 5; polling intervals are at least 300 seconds, with one watcher and a ten-call CI budget. Full public metadata and timestamps are in ci-watch.receipt.json. Product branch custody and report-only evidence publication are separate. Evidence conveys no acceptance, READY or landing decision.

Publication scanner: status=PASS, complete=True, findings=0, reviewed=0. No scanner exclusions or allowlists were added.

Packet content inspection: 32 generic-pattern flags were verified as public source archive or migration SHA256 digests; no credential values were selected. See packet-content-review.receipt.json and the actual redacted scan output. This is separate from the product publication scan above.

Blockers: CI completion or result remains pending; see terminal status and CI receipt.

The complete selected non-secret packet is published only to refs/heads/evidence/sd-pencil-rer-pin-105. Product checkout/dependencies are removed after successful report transfer; terminal confirmation follows that cleanup.
