<p align="center">
  <a href="https://run-pencil.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.webp">
      <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.webp">
      <img src=".github/assets/banner-light.webp" width="100%" alt="Pencil: Ask like you’re listening. 100% free, open source alternative to Typeform, Google Forms and Jotform.">
    </picture>
  </a>
</p>

<p align="center"><a href="https://run-pencil.com">run-pencil.com</a> · <a href="https://justevery.com">Part of Just Every</a> · <a href="LICENSE">MIT licensed</a></p>

# Pencil

Pencil is an editable form builder and feedback workspace with branching questions, published forms, results, branding, response email, embeds, a bounded Typeform JSON/CSV importer and a Google Forms CSV-first importer with an optional `forms.get` definition. To bring existing forms and historical responses into an editable draft, read the [moving-in guide](docs/guide/moving-in.md).

## Run it on your computer

Use Node **22.20.0** and pnpm **10.12.4**. From this checkout:

```sh
rer install
rer setup --owner-email owner@example.com --owner-name Owner
rer dev
```

Install uses the frozen lockfile. Setup builds, migrates and creates one real owner through Base authentication, checks ordinary sign-in in the private outbox, then stops its temporary app. Reruns preserve existing owner, data and exact private settings. Dev prints its health-gated application URL and opens signed in: it prints `RER_SIGNED_IN` (who the browser will be) and `RER_OPEN`, a link for this computer that carries this checkout's private dev key in its fragment. Open it and the app signs you in as the owner you set up and takes you to **`/setup`** to finish your business name and time zone; finished setup enters the app. `RER_OPEN` is the only way in: the local outbox, the dev sign-in and the persona list answer 404 to any request without the key, including one a tunnel or a local proxy forwards to this computer. Use `rer dev --as operator` to start as the **Dev operator** persona (a colleague, `operator@dev.localhost`) or `--as signed-out` to start signed out; the dev badge at the bottom of every page switches between them. Use `rer dev --login` to turn dev identity off and sign in the ordinary way: read the newest sign-in message in the outbox (`RER_SIGN_IN`), open its link and confirm. A link works once; local capture sends no email.

Read the guide at `/docs` on your copy (its source is [docs/guide](docs/guide/overview.md)); `/` is the Lobby (**Finish setup** until first-run setup is confirmed, then **Sign in**), with `/pencil` redirecting there. An explicitly selected public landing flow in Settings keeps its existing respondent experience at `/`; Pencil's product page is the run site, run-pencil.com, built by `rer build --site`; published forms also keep their `/f/<slug>` links.

Keep `.dev.vars` private. Use `--port PORT` for an explicit loopback port. Stop dev with Ctrl-C or `rer dev --stop`.

```sh
rer outbox
pnpm exec playwright install chromium --only-shell
rer verify
rer reset --yes
```

Verify runs the functional and high-stakes wall. After intended source changes, stage them, inspect `node scripts/edition-authoring/cli.mjs changes`, run `node scripts/edition-authoring/cli.mjs lock`, commit with `sources.lock.json`, then run `pnpm source:check`; without `lock` it fails with a stale lock. Reset prints and removes only inventoried local data, settings, owner, outbox and drafts; source, dependencies, exports and deployment receipts survive. Export first to retain data:

```sh
mkdir -m 700 exports
rer export --output exports/installation.rer
rer reset --yes
rer import --input exports/installation.rer --yes
rer setup --owner-email owner@example.com --owner-name Owner
```

Import validates integrity and restores atomically into an empty destination without replaying mail. Archives retain the complete product graph, import custody, delivery history and credential hashes; plaintext credentials, captured mail and private settings are excluded. These rer commands support local state; the separate maintained deployed D1 command is documented in [Backup and restore](docs/guide/backup.md).

```sh
pnpm run deploy -- --dry-run
rer describe
rer check --profile first-party
```

Deployment needs the intended owner account and production inputs. Dry run builds and validates with zero provider calls. Read [OPERATIONS.md](OPERATIONS.md), [RUN-LOCALLY.md](RUN-LOCALLY.md) and [SEED-COMMAND-CONTRACT.md](SEED-COMMAND-CONTRACT.md).

Before **every release**, run `pnpm run verify:release` for unchanged capacity, maximum-size native memory, browser heap and load cases. These run outside CI and default verify. Publication inspection requires Gitleaks 8.30.1; `bash scripts/install-gitleaks.sh` installs the reviewed binary after checksum verification. CI uses the same installer and complete Base scanner. The maintained release dry run runs both commands:

```sh
pnpm run release -- --repo . --ref HEAD --project just-every/pencil --repository https://github.com/just-every/run-pencil --onto https://github.com/just-every/run-pencil#main --tag vVERSION --dry-run --output ../pencil-release
```

Require a complete scan with zero findings and reviews, without exclusions or an allowlist. Hosted installation, real-export validation, tags, public publication and site listing require the owner. Exactly ANLY-009 (builder assistance), NOTIFY-001 and NOTIFY-003 (3 clauses) remain deferred, with explicit TODOs and the unsatisfied full-contract check. CONTRACT.md and BASELINE.md record product guarantees.

Optional managed delivery emits the actual Worker, assets, setup descriptor and ordered migrations. Signed admission creates one native owner in an empty installation; initialized stores reject further claims. The editor requires a current native owner session and revokes on sign-out. Hosted acceptance remains with the owner.
