# sd-pencil-rer-pin-103 result

BLOCKED before a product commit or push. The chosen immutable API archive does not provide the Git ancestry required by rer refresh-base. This is an acquisition limitation of the attempted invocation, not evidence that the released rer or Pencil product is defective. The brief's blocked-exit rule was applied when refresh returned exit 4. No product, contract, test, UI, migration, generated-view or Base-derived file was manually edited.

## Provenance and completed work

- Repository: just-every/run-pencil.
- Branch: cloud/sd-pencil-rer-pin-103.
- Starting and terminal product HEAD: ae8ee162c63e3b970d7ee61eec82614bcf9e2c06; identical to origin/main at clone time.
- Fresh full-history clone: `git clone --filter=blob:none`; `git rev-parse --is-shallow-repository` returned `false`.
- Fleet global/local identity and commit cleanup hooks installed; no product commit was created.
- Exact package pin changed from 0.2.94 to 0.2.103. `pnpm install` exited 0; pnpm-lock.yaml changes only the rer importer, integrity and snapshot entries.
- The release tag was resolved using `gh api repos/runeditrun/base/commits/rer-v0.2.103 --jq .sha`: e82790b601c62e077a1a09380fc787531d9cded5. Its source archive was acquired using `gh api repos/runeditrun/base/tarball/rer-v0.2.103`. No other repository was cloned or written.
- The CLI requires a full immutable commit rather than a tag. The resolved release commit and `--base-archive /tmp/pencil-base-103 --offline` were used to respect the API-only read constraint.

## Actual command receipts

BASE refresh=`pnpm exec rer refresh-base --ref e82790b601c62e077a1a09380fc787531d9cded5 --base-archive /tmp/pencil-base-103 --offline` exit=4; verify=`pnpm exec rer verify` exit=NOT_RUN.

Exact refresh error:

```text
Base archive has no Git history. Repeat with --base <checkout> containing the recorded and target commits; no files were refreshed.
refresh-base: failed (exit 4)
```

The command ran through `cloud_run timeout 600`. `base-refresh.log` is the complete non-secret command output. The CLI changed no Base files or copy records.

MECHANICAL lock=`pnpm source:lock` exit=NOT_RUN; check=`pnpm source:check` exit=NOT_RUN.

PROBE preview start with .dev.vars: NOT_RUN after refresh failure. `pnpm typecheck` was also not run. No setup, preview, application-health, fixed-banner, publication-scan or full-verification result is claimed.

## Worktree diff

```text
package.json   |  2 +-
 pnpm-lock.yaml | 10 +++++-----
 2 files changed, 6 insertions(+), 6 deletions(-)
```

The uncommitted work is retained byte-for-byte in `uncommitted-pin.patch` (SHA-256 67334a7a5f9955f783a1670ce44402316c4468540e6e4b8df9deb478a81e3a1e). No source lock was regenerated because refresh failed before a candidate existed.

## Clause status and counts

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain unchanged. No clause status changes.

| Scope | Before done/partial/missing/total | After done/partial/missing/total |
| --- | --- | --- |
| Published | 117/3/0/120 | 117/3/0/120 |
| Target and push further | 25/58/49/132 | 25/58/49/132 |
| All | 142/61/49/252 | 142/61/49/252 |

## Custody and remaining work

Product commits: none. Product pushes: none. PR: none. CI run IDs: none; no candidate was pushed. No READY, PUSHED, acceptance, deployment or landing claim.

The pin adoption, source refresh, verification, setup/preview probe, typecheck, source lock/check and exact-SHA CI are unfinished. The supported `--from-api` refresh route was identified but not attempted after the brief's required blocked stop. It reads the entire Base tree and blob set (the API archive contains 4,681 regular files), which also cannot fit the stated ten-call GitHub budget as a direct uncached acquisition. A future run needs an agreed source-acquisition route that supplies real ancestry within its allowed budget; it must not weaken ancestry checks or clone Base against this task's scope rules.

`PLAN.md` contains the full plan. `receipt.json` contains actual machine-readable results. Only explicitly selected non-secret files are sent to the separate evidence ref. Evidence publication is independent of product custody. The product clone and node_modules will be removed after the report is safely transferred, as the brief requests; the patch and packet remain outside the clone.
