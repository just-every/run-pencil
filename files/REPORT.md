# sd-pencil-rer-pin-104-fix1

Repository: just-every/run-pencil. Branch: cloud/sd-pencil-rer-pin-104-fix1.

Product head: f591a3e245f1e5fa9f3b5fa63f8b474eecc3cd3d. The named branch was pushed on the first guarded attempt. All local checks pass; exact-SHA Verify is being watched through one REST watcher at intervals of at least 300 seconds. No PR was created and no landing is claimed.

## Plan and scope

The full plan is in PLAN.md. Start from the verified pinned head bd597801ed2d13626ee5898c3bc91cb55cdf1edd in a fresh full-history clone. Current main 0ed9dd1bdfb98836ea8f95feba80c5a32034e9ef is already an ancestor, so no merge is needed. Inspect persisted provenance, repair held Business principals in a forward Pencil migration, reproduce the public-door upgrade, validate touched checks and source provenance, then publish the named product branch and explicit evidence packet. Landing remains with the fleet.

## Change

Migration 0079_agent_door_legacy_principals.sql adds `principal.source: business` to pending approvals with an untagged principal and a nonempty saved Business consent. Business credential admission requires this consent; local credential admission never attaches it. The migration does not infer sponsorship from today's Business pairing. It updates only the saved principal path, preserving approval hashes, revisions, marks, versions, state and results. Existing tagged principals, non-Business principals and completed/erased approvals remain unchanged. Reapplication is idempotent. The existing fail-closed execution guard now sees the correct provenance, including when durable Business state is stopped or missing. No Base-derived source is changed.

The deployment specification appends the migration's exact SQL and SHA-256 to its ordered ledger. The data policy continues to exclude all approval authority from backups. The existing populated upgrade-check file gains one regression case covering preservation, partial marks, explicit source values, invalid/empty consent, terminal states, null principals, repeat application and backup exclusion. No assertion, workload or threshold was removed or weakened. The source lock was regenerated last.

## Public-door probe

PROBE legacy-upgrade: before (bd597801 runtime, migrations through 0078), an approval genuinely created through main's `/mcp` had no persisted source tag. Signed detached:true settings returned 200; posting the original revision and summary hash returned HTTP 200, executed, and opened the form. After migration 0079, the same upgrade pattern returns HTTP 200 with the refusal code sponsor_unavailable and state refused; the form remains draft. The running-Business control executes and opens its form. A new post-upgrade held call is refused after detachment and remains draft. All five pre-repair audit rows are byte-preserved.

The fixed legacy upgrade, running control and new held-call control share one disposable native Miniflare D1 installation. The before-fix control uses a separate disposable installation because signed detachment is intentionally terminal; no private settings were reset. Both use built main/candidate Workers, actual committed migrations and signed public requests. Database access for inspection is SELECT-only. No saved principal or native record was fabricated. Original approval revision and summary hashes are used unchanged.

The probe is retained as evidence rather than committed: switching production Worker builds and replaying a terminal-detachment control requires a temporary extension of the maintained disposable-host helper. The small migration regression stays in the existing deployment-data upgrade check. See legacy-upgrade-probe.mjs, legacy-upgrade-probe.log and legacy-upgrade-receipt.json.

## Local verification and custody

Populated agent-door upgrade checks: 2/2 before, 3/3 after; native predecessor upgrade checks: 3/3. The hosted-data recovery check passes its one parent test and all three internal installer-controller cases, with zero failures, cancellations or skips. Complete hosted-output verification passes, including hydration, all 2675/2675 conformance points, native form resource write/readback, sponsor/evidence authority, running relay, historical approval feed privacy and signed detachment refusals. Typecheck, first-party check, integration spec check, lock/check and source:check pass. The maintained publication scan returns PASS, complete=true, findings=0, reviewed=0. All six candidate commits, including side parents, have fleet author/committer identity and no disallowed trailers. Clause status changes: none; 142 done / 61 partial / 49 missing before and after. BASE-AGENT-011 remains partial. The independently reported blocking finding A is reproduced and fixed by the public-door proof; this is builder evidence, not an independent acceptance or landing claim.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=node scripts/edition-authoring/cli.mjs check exit=0.

The first hosted-data invocation reached its 600-second command bound without failed assertions (one cancelled file); the unchanged test passed on retry at pinned Node 22.20.0 with an 1800-second command bound (489.9 seconds). The first hosted-output invocation timed out on a hydration edit while concurrent builds were running. Its complete diagnostic is retained; the same assertions and thresholds passed on retry with pinned Node and fewer concurrent jobs. Browsers use /usr/bin/chromium with --no-sandbox through the environment-only browser-runtime.mjs launcher shim.


## Exact-SHA CI and return protocol

Product push: `python3 $HOME/rer-consolidation/.tools/cloud-push.py origin cloud/sd-pencil-rer-pin-104-fix1`, success on attempt 1. The guard used the decrypted-bundle helper and a credential-free HTTPS origin. No main/default ref was pushed and no published history was rewritten. CI run identity and terminal status will be appended from the actual REST response before return.

Complete machine-readable results are in validation-receipt.json; the signed native-door observations are in legacy-upgrade-receipt.json. Full check outputs, the exact product diff and source-lock records are selected explicitly for report-only publication on evidence/sd-pencil-rer-pin-104-fix1. No credentials, environment dumps, private gate material or symlinks are selected. Evidence custody is separate from product readiness and landing. The disposable worktrees and their node_modules will be deleted after successful product/evidence preservation, as requested.

Exact-SHA Verify discovered: run 42625108892, https://github.com/just-every/run-pencil/actions/runs/42625108892, head f591a3e245f1e5fa9f3b5fa63f8b474eecc3cd3d, in_progress as observed at 2026-11-09T13:28:53.145763+00:00 (2 of 10 CI API calls used). Initial evidence publication preserves the completed local work while this run continues; it does not signal READY.
