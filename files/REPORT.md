# sd-pencil-rer-pin-103-fix1 · Pencil rer 0.2.103 hosted regression repair

Product repository: `just-every/run-pencil`.
Product branch: `cloud/sd-pencil-rer-pin-103-fix1`.
Product head: `3c51bdf7dd44363933242447e1536a421f6e9e14`.
Adoption parent: `13a9f98aa0ecbb4e0a989a09f69a66196960eeb8`.
Main checked before work and again before push: `191c091413fa30a975150e462f1cc9c4ea869be1`.
Full-history clone: yes (`git rev-parse --is-shallow-repository` returned false). The fetched adoption branch matched the required head exactly; `git rev-parse HEAD` printed it before edits. Main had no commits absent from the candidate; no merge or rebase was needed. No published history was rewritten.

## Plan and scope

PLAN.md records the full execution plan. The implementation is two files: Pencil's native server dispatch and its regenerated source lock. The adoption's rer pin, Base copies, migration 0077, archive classification and integration spec are retained. No migration was changed, so integration regeneration was unnecessary. No contract, acceptance view or claims view was changed. No test was deleted, skipped or weakened. No new provider resource, deployment, PR or main push was created.

## Relay: candidate-caused omission, reproduced and fixed

Original Verify `42542006704`, failed job `128919105290`, reports `FAIL BASE-AGENT-009.relay.route: Signed decision pull must return 200, got 404.` Its aggregate result was 2371/2372 conformance points. The failed-job archive was read once with `gh run view 42542006704 --repo just-every/run-pencil --job 128919105290 --log-failed`.

The adoption adds Base's signed relay handler at `src/base/agent-door/index.ts:42` and its `relay.ts`, but Pencil's explicit pre-application agent dispatch at `src/server.ts:64` omitted `/api/rer/agent-decisions`. The request therefore fell into the ordinary `/api/` router and returned 404. Base's copied `ADOPTING.md:175–184` explicitly requires routing signed decision pulls to the same door before native application authentication.

`git diff origin/main..HEAD -- src/base/agent-door/index.ts src/server.ts` establishes the mismatch: the handler is new while the original seed dispatch was unchanged. The Base comparison `e881e6f6...e82790b601c62e077a1a09380fc787531d9cded5` was read only through `gh api`; BASE-COMPARISON.json preserves its relevant added/modified route and conformance files. No other repository was cloned or written.

The bounded production check in relay-check.mjs reproduced exactly 2371/2372, with only the same 404 assertion failing. The fix admits the exact decision path through the existing agent door. It preserves Base's JWS authentication, shape bounds and error semantics; it adds no public native API exemption. After a fresh production build the identical check passes 2656/2656 points, including route, closed ordered bounded pages, audit equality, unattributed exclusion, byte-identical replay, final cursor and foreign-signature refusal. The larger count reflects the relay checks now reached after the route assertion.

## WordPress: hosted replay failure not reproduced; tests retained

Original failed desktop job `128919105174` reports attempts 1 and 2 at `tests/e2e/wordpress-embed.ts:89` / `script-embed.spec.ts:197`. The exact assertion is `expect(replay.status()).toBe(201)` after a successful WordPress shortcode render, real form submission, native stored-answer checks and archive verification. The failed archive omits the received status/body, so it does not prove a compose startup timeout or a particular refusal code.

The failed-job archive was read once with `gh run view 42542006704 --repo just-every/run-pencil --job 128919105174 --log-failed`. Main run listing confirms Verify `42541318493` completed successfully for `191c091413fa30a975150e462f1cc9c4ea869be1`. Its available archive contains plan/verify only with reuse enabled; it does not supply an independent fresh WordPress job, so no main assertion-level claim is made from that archive.

Docker Compose and the managed local daemon were available. The first desktop attempt failed earlier at `wp plugin activate pencil`: the bind-mounted plugin directory/file modes were 0700/0600, unreadable by the fixture's UID 33. A disposable container reproduced Permission denied. Changing only local directory/file permissions to 0755/0644 made the mount readable; Git records no source or executable-mode change. This local environment issue is different from the hosted replay assertion.

After that repair the full unmodified desktop script-embed journey passed at width 1440 using `/usr/bin/chromium` with `--no-sandbox`, a real WordPress 6.8.3 fixture and MariaDB. It proves replay 201, the same response ID, no duplicate stored response, exact retained answer, allowed/disallowed hosts, opaque frames, public events, resizing and privacy. Browser contexts and fixture containers were closed by the test's existing finally blocks. No UI code changed; the special changed-screen proof at two widths does not apply.

No response/embed implementation, fixture, test helper or relevant third-party runtime dependency changed in the adoption. The missing agent relay route has no path to the public response handler. Shared headerless visitor rate allowance could explain a timing-sensitive replay refusal, but the hosted response status is unavailable and the successful local run does not establish that hypothesis. There is no evidence warranting a candidate-caused WordPress source change; all WordPress files and assertions are left intact. Exact-SHA CI is reported separately below.

## Mechanical checks and actual receipts

RELAY-BEFORE.txt, RELAY-AFTER.txt and MIGRATION-LEDGERS.txt retain the complete actual check output. RECEIPT.json records exact commands, exits and relevant actual output, including the initial local environment failure and a name-filter attempt that matched no behavioral ledger test. The latter is not counted as evidence; the subsequent full registered recovery file did run and pass.

- rer setup and both production builds: exit 0.
- Production agent conformance: before 2371/2372 (exit 1); after 2656/2656 (exit 0).
- `pnpm typecheck`: exit 0.
- `pnpm verify:migrations`: exit 0, three native D1 upgrade cases from v0.6.0 with 51 released migrations.
- `node --test scripts/deployment-data-agent-door-upgrade.check.mjs`: populated upgrade passed, preserving history and excluding restored authority.
- `timeout 240 node --test scripts/deployment-data-hosted.check.mjs`: exit 0, registered owner-recovery test passed, including altered/incomplete/uncertain/mixed migration-ledger refusals and kit/Platform recovery.
- Full desktop script-embed with real WordPress: 1 passed, exit 0 after local permission repair.
- Staged changes inspected; source lock regenerated last; `pnpm source:check`: exit 0 before and after commit.
- Maintained Gitleaks 8.30.1 installed with verified checksum. `pnpm verify:publication`: exit 0, status PASS, complete true, zero findings, zero reviewed. PUBLICATION.json is the actual full scan report. The fleet's independent landing scan remains separate.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=pnpm source:check exit=0

## Clause judgments and custody

Before and after: done 142, partial 61, missing 49; total 252. Clause status changes: none. BASE-AGENT-001 through BASE-AGENT-013 remain partial; DIST-013 and the other embed clauses retain their existing judgments. Passing this repair is not a clause promotion or landing claim.

All four commits in `origin/main..HEAD`, including every reachable side parent, passed the fleet author/committer and trailer audit immediately before push. No OpenAI/Codex co-author line survived. IDENTITY.txt is the exact requested audit output. The new commit has fleet author and committer and no trailers. Product push through cloud-push.py succeeded on attempt 1 to the named cloud branch only, and remote tracking head equals the product head. No force push, main fast-forward or landing was performed.

Exact-SHA Verify run: `42544820495`, https://github.com/just-every/run-pencil/actions/runs/42544820495 . Its discovery returned in_progress for the full product SHA. One watcher is waiting under the minimum 300-second poll interval and ten-call task budget. CI receipt and terminal status will be appended after the watcher returns. Product READY/PUSHED custody and the report-only evidence ref remain separate.
