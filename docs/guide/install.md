# Install and run locally

This page takes you from the Pencil source code to a working copy on your own computer, with your first owner signed in and your workspace set up. Nothing here touches Cloudflare or sends real email. When you are ready to go online, continue with [Hosting on Cloudflare](hosting.md).

## What you need

- **rer, the Run Edit Run command.** Install it once per computer with `npm install -g @runeditrun/rer`. In the source folder it runs the exact version Pencil pins.
- **The source code.** Get it from https://github.com/just-every/run-pencil and open a terminal in its folder.
rer installs the pinned Node and pnpm itself. You do not need to install either version separately. `rer dev` prepares a local owner automatically; choosing your own local owner details with `rer setup` is optional.

## Start Pencil on your computer

```sh
npm install -g @runeditrun/rer
git clone https://github.com/just-every/run-pencil.git pencil && cd pencil
rer dev
```

`rer dev` installs the exact locked dependencies, applies local migrations and prepares a local owner on first launch. It then prints the app’s address and a `RER_OPEN` link that opens it signed in. Later launches keep your owner, data and private settings. To choose local owner details, optionally run `rer setup --owner-email you@example.com --owner-name "Your Name"`; no separate setup command is needed for the normal launch.

Setup writes a private `.dev.vars` file. Keep it private. It holds your local secrets. Stop `dev` with Ctrl-C, or with `rer dev --stop`.

## Sign in and finish setup

1. Open the `RER_OPEN` link that `dev` printed, on the computer that runs it. The link carries a private key for this copy, and it signs you in as the local owner.
2. You arrive at `/setup`. Enter your **Business name** and choose your time zone, then continue.

To try the ordinary email sign-in instead, run `rer dev --login`. A local copy sends no real email, so your sign-in link waits in the local outbox: open the outbox address that `dev` printed, choose the newest message, choose **Open this link**, then **Confirm**. The outbox opens only with the same key, so a request that is forwarded to your computer finds nothing.

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
| `/` | The Lobby by default: your business name and one button, **Finish setup** until `/setup` is done and **Sign in** after. A **Public landing flow** selected in **Settings** explicitly overrides it. |

Without a selected landing flow, `/` shows the Lobby. Selecting a flow in Settings replaces it with that flow's respondent experience, including its normal closed or not-found state. See [A form on your home page](publish-and-share.md#a-form-on-your-home-page).

## Sign in again later

Pencil has no passwords. To sign in after you have signed out, enter your email at `/signin` and choose **Send magic link**. A local copy sends no real email, so the link waits in a local outbox instead. Run `rer outbox` to print its address and a key link that opens it, or choose **Open the local outbox** on the sign-in page (after opening `RER_OPEN` once in this browser):

1. Choose **Read message**.
2. Choose **Open this link**, then **Confirm**.

A sign-in link works once and expires after 15 minutes. Opening it only shows a confirmation page, and nothing happens until you choose **Confirm**.

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

- Install the test browser once with `pnpm exec playwright install chromium --only-shell`, then run `rer verify`. It is the full local check: types, unit and Worker tests, the command-line journeys, data export and import round trips, migrations, source boundaries, the build and browser journeys on desktop and mobile. The capacity and load workloads are separate: they run with `pnpm run verify:release` before a release.
- Record your changes before you check them. Stage them with `git add`, run `node scripts/edition-authoring/cli.mjs changes` to inspect what changed, then `node scripts/edition-authoring/cli.mjs lock` to record the new file hashes in `sources.lock.json`. Commit your changes together with `sources.lock.json`, and only then run `pnpm source:check`. It checks that the source still matches its recorded provenance, and it fails with "Stale lock" if you skipped `lock`.
- Never edit a migration that has already been applied. Add a new one.

`pnpm verify:contract:full` is expected to fail in this release. It keeps the features that are [not in this release](overview.md#what-is-not-in-this-release) as open items on purpose.

## What local mode is not

A local copy proves that the app works, not that email reaches inboxes or that a deployment will carry your traffic. Local mail is a synthetic outbox, not delivery. Those checks belong to your real deployment: see [Hosting on Cloudflare](hosting.md).
