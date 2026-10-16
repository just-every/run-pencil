# Install and run locally

This page takes you from the Pencil source code to a working copy on your own computer, with your first owner signed in and your workspace set up. Nothing here touches Cloudflare or sends real email. When you are ready to go online, continue with [Hosting on Cloudflare](hosting.md).

## What you need

Use macOS, Linux or Windows with WSL2, as on the Run page.

- **Node.js 22 or later, including npm, and Git for the npm installation route below.** Install Node from [nodejs.org](https://nodejs.org/en/download), then check `node --version` and `npm --version` in your terminal. Node and npm must be on your `PATH` before installing and starting rer.
- **rer, the Run Edit Run command.** The one line below installs its global launcher for you; to install it yourself, run `npm install -g @runeditrun/rer` once per computer. In the source folder it runs the exact `@runeditrun/rer` version in Pencil's `package.json` and lockfile. `rer --version` can show the global launcher and checkout versions separately; a difference does not change the checkout pin. Do not change that pin to match your global launcher.
- **The source code.** Get it from https://github.com/just-every/run-pencil and open a terminal in its folder.

With Node available, rer installs Pencil's pinned runtime and pnpm for its own commands. It does not put pnpm on your shell's `PATH`; the commands below use npm or npx when needed. `rer dev` prepares a local owner automatically; choosing your own local owner details with `rer setup` is optional.

## Start Pencil on your computer

```sh
npx -y @runeditrun/rer dev just-every/run-pencil
```

To start it again later, run `cd run-pencil && rer dev`.

`rer dev` installs the exact locked dependencies, applies local migrations and prepares a local owner on first launch. It then prints the app’s address and a `RER_OPEN` link that opens it signed in. Later launches keep your owner, data and private settings, and apply any migration a newer source added before serving. To move to a newer Pencil, follow [Upgrading a local install](#upgrading-a-local-install). To choose local owner details, optionally run `rer setup --owner-email you@example.com --owner-name "Your Name"`; no separate setup command is needed for the normal launch.

Setup writes a private `.dev.vars` file. Keep it private. It holds your local secrets. Stop `dev` with Ctrl-C, or with `rer dev --stop`.

## Sign in and finish setup

1. Open the `RER_OPEN` link that `dev` printed, on the computer that runs it. The link carries a private key for this copy, and it signs you in as the local owner.
2. You arrive at `/setup`. Enter your **Business name** and choose your time zone, then continue.

Local mail is silently suppressed. The nav and title read **Pencil Dev**. Use `rer demo` for a disposable **Pencil Demo** with the Aurora Coffee sample workspace; demo reads are real and effects that reach people return success without sending.

You land in the operator app, at `/app`, with an empty workspace. There are no sample flows and no sample responses. Until you finish `/setup`, every page of the app sends you back to it. Go on to [Build a form](build-a-form.md).

## Find your way around your copy

Your copy serves these addresses, all under the origin that setup printed:

| Address | What is there |
|---|---|
| `/signin` | Operator sign-in. |
| `/setup` | The one-time step after your first sign-in: your business name and time zone. |
| `/app` | The operator app, with **Flows**, **Audience** and **Settings**. You need to be signed in. |
| `/pencil` | Redirects to `/`. |
| `/docs` | This guide. |
| `/` | The Lobby by default: the Pencil installation name and one button, **Finish setup** until `/setup` is done and **Sign in** after. A **Public landing flow** selected in **Settings** explicitly overrides it. |

Without a selected landing flow, `/` shows the Lobby. Selecting a flow in Settings replaces it with that flow's respondent experience, including its normal closed or not-found state. See [A form on your home page](publish-and-share.md#a-form-on-your-home-page).

## Sign in again later

Open the private `RER_OPEN` link from `rer dev` again, or choose **Continue as owner** at `/signin` after opening it once. Hosted production installs use one-time email links; each link expires after 15 minutes and is consumed only when you confirm it.

## Upgrading a local install

A newer Pencil can add database migrations. Take these steps in the source folder to move your copy to the newest source with your data:

1. Stop Pencil: `rer dev --stop` (and `rer preview --stop` if you ran preview).
2. Export your product data: `mkdir -m 700 exports` once, then `rer export --output exports/before-upgrade.rer`. Credentials and private settings are excluded; preserve them separately as described in [Backup and restore](backup.md).
3. Get the new source: `git pull`. If you checked out a release tag, run `git checkout main` first.
4. Install its locked dependencies: `rer install`.
5. Apply the new migrations: `rer setup`. It keeps your owner, data and private settings.
6. Start Pencil again: `rer dev`.

If you skip step 5, `rer dev` applies the pending migrations itself before it serves, and names them in its server log. If they cannot be applied, it refuses to start and tells you to run `rer setup`; your forms never answer respondents from an out-of-date database. Keep the export until you have checked your forms and results.

## Optional local setup

| Option | What it does |
|---|---|
| `--owner-email EMAIL` | The first owner's email address. Setup asks for it if you leave it out. |
| `--owner-name NAME` | The name shown for the first owner. |
| `--port PORT` | Use a different loopback port from the default, 8787. The port must be free. |
| `--host HOST` | Listen on `127.0.0.1`, `localhost` or `::1`. Nothing else is allowed. |
| `--answers FILE` | Read the answers from a private JSON file instead of asking, with `--non-interactive`. `rer describe` lists everything the commands accept. |

To start again from nothing, run `rer reset --yes`. It prints what it will remove and removes only your local data, owner, outbox and private settings. It keeps your source, your dependencies and your exports. Export first if you want to keep the data: see [Backup and restore](backup.md).

## Look at the production build

`rer build` writes the Worker and its assets to `dist`. `rer preview` serves that build on your computer, with the same owner and data as `dev`. Stop it with Ctrl-C or `rer preview --stop`.

## Changing the source

Pencil is the complete product source. You may change the code, the database schema, the interface and the setup. If you do:

- After `rer install` or the first `rer dev`, install the test browser once with `npx --no-install playwright install chromium --only-shell`, then run `rer verify`. It is the full local check: types, unit and Worker tests, the command-line journeys, data export and import round trips, migrations, source boundaries, the build and browser journeys on desktop and mobile. The capacity and load workloads are separate: they run with `npm run verify:release` before a release. These source checks are separate from deploying an unchanged checkout.
- Record your changes before you check them. Stage them with `git add`, run `node scripts/edition-authoring/cli.mjs changes` to inspect what changed, then `node scripts/edition-authoring/cli.mjs lock` to record the new file hashes in `sources.lock.json`. Commit your changes together with `sources.lock.json`, and only then run `npm run source:check`. It checks that the source still matches its recorded provenance, and it fails with "Stale lock" if you skipped `lock`.
- Never edit a migration that has already been applied. Add a new one.

`npm run verify:contract:full` checks the complete product contract. The features listed as [not in this release](overview.md#what-is-not-in-this-release) are outside Pencil's supported scope.

## What local mode is not

A local copy proves that the app works, not that email reaches inboxes or that a deployment will carry your traffic. Local mail is suppressed. Those checks belong to your real deployment: see [Hosting on Cloudflare](hosting.md).
