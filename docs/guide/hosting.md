# Hosting on Cloudflare

Pencil runs on your own Cloudflare account as one Worker with a D1 database. This page takes you from a working local copy to a deployed one: setting your secrets, deploying, and signing in as the first owner. It also covers setting up email, which Pencil cannot work without.

Deploy acts only on the Cloudflare account you select. No command in Pencil deploys anything on its own, and local setup never creates anything in Cloudflare.

## What you need

- **A Cloudflare account on Workers Paid**, and an API token for it that may edit Workers and D1. You give Pencil the account's ID and the token as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, through your secret manager or the secret environment of your terminal.
- **Node 22.20.0 and pnpm 10.12.4**, and the installed dependencies from [Install and run locally](install.md).
- **A mail provider**, SendGrid or Resend, with a verified sender address and an API key. See [Set up email](#set-up-email).
- **A passing local check of the exact source you will deploy.** Run `rer verify` first. It includes browser journeys, so install the test browser once:

  ```sh
  pnpm exec playwright install chromium --only-shell
  ```

## Choose your address and secrets

Deploy reads everything from environment variables. Start with the address you will use. Cloudflare's own address for a Worker is on your account's `workers.dev` subdomain, which the dashboard shows under **Workers & Pages**. Then set these:

| Variable | What it is |
|---|---|
| `APP_ORIGIN` | The exact HTTPS origin of your deployment, with no path. Sign-in links, reports and public links point here. If it differs from the address people open, every page there, `/health` included, answers **Not found**. |
| `SEED_ADMIN_EMAIL` | The email address of the first owner. If omitted, rer uses the owner email from this checkout’s local setup. |
| `PENCIL_MAIL_PROVIDER` | `sendgrid` (the default) or `resend`. `rer deploy` binds the choice as the Worker’s `MAIL_PROVIDER`. The earlier `MAIL_PROVIDER` environment setting is also accepted; if both are set, they must agree. |
| `MAIL_FROM` | Your verified sender. It must be a plain `noreply@` or `no-reply@` address, with no display name. |
| `MAIL_API_KEY` | Your mail provider's API key. A secret. |
| `SESSION_SECRET` | A secret used to sign people in. rer generates a fresh hosted value when omitted; you may supply a random string of at least 32 characters. Keep the deployed value stable for the life of the installation. |
| `SETUP_TOKEN` | A one-time secret for the first owner. rer generates it when omitted, uses it to claim the hosted owner and removes it after a successful claim. Do not retain it on the Worker. |
| `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` | The account to deploy into and its token. The token is a secret. |

External tasks are optional. To send actions to your own task system, also set `TASK_PROVIDER`, `TASK_WEBHOOK_URL` and `TASK_API_KEY` as Worker secrets; [Actions and follow-up](actions.md) explains the webhook your receiver must honour. Without them, everything else works and the action page says what to set.

Analysis is optional. To turn it on, set `AI_ENABLED` to `true` and `AI_MODEL`, then either `AI_API_KEY` (with `AI_BASE_URL` for a provider other than OpenAI) or `MODELS_SERVICE` and `MODELS_KEY` for a linked Models service; the keys are Worker secrets. Optional `AI_INPUT_USD_PER_MILLION_TOKENS` and `AI_OUTPUT_USD_PER_MILLION_TOKENS` let Pencil show a direct key's cost. Without them, nothing is sent and the Analysis page says what to set. [Analysis](analysis.md) explains what leaves and to where.

Supply the secrets through your secret manager or the secret environment of your terminal. Never put them in a tracked file, in a command line or in your shell history. In examples on these pages a secret appears only as a placeholder such as `<your-api-key>`.

Leave the local-only options off: `PENCIL_LOCAL_DEVELOPMENT`, `SEED_SAMPLE_DATA` and the local mail provider must never be enabled on a deployment. A deployment turns local capture and sample data off.

## Check, then deploy

```sh
pnpm run deploy -- --dry-run
pnpm run deploy -- --environment production
```

The dry run builds the real Worker, its assets and its database migrations, and checks your inputs, without contacting any provider. Use it first. The second command deploys into the Cloudflare account you selected and checks the Worker's health afterwards. If a step fails, it stops and tells you which. The migrations are applied to your database in order. Never edit a migration that has already been applied.

A healthy Worker shows that the code runs. It does not show that email arrives or how much traffic your deployment will carry. See [Check that it works](#check-that-it-works).

## Sign in as the first owner

With the pinned rer 0.2.5, deploy claims the hosted owner automatically using `SEED_ADMIN_EMAIL` (or the owner email from your local setup), then removes the one-time `SETUP_TOKEN` and records the new Worker version. Deploy prints the hosted application address on first deploy and updates. The build step reports that the application is built; it does not start a local server. Wait for deploy to confirm the owner claim and token removal. There is no manual setup-token form to complete after a successful deploy.

1. Open `/signin` at the hosted address printed by deploy.
2. Enter the owner's email and choose **Send magic link**. Open the email and choose **Confirm**.
3. Complete your business name and time zone on `/setup`, then choose **Finish setup**. Until you do, the rest of the app sends you back there.

If deploy reports that the application is deployed but owner claim or token retirement failed, follow its recovery instructions and rerun the same deployment command with the same environment credentials. Do not assume setup completed from health alone, and do not remove the token by hand before the claim is confirmed.

After success, unset `SETUP_TOKEN` in your terminal or secret environment. Updates preserve the existing owner and deployed secrets, and do not upload the retired token again. Keep `SESSION_SECRET` stable. An initialized installation refuses another owner claim.

Do not delete or change Worker secrets in the dashboard between deployments. Those changes create a Worker version outside the saved deployment receipt; the next deploy refuses it as `owned-resource-replaced`. Preserve `.rer/deploy/production.json` (or the file for your chosen environment) privately and back it up after each successful deploy. Do not edit the receipt or bypass an ownership refusal. A deployment whose Worker version has already changed outside rer needs the deploy kit's supported ownership recovery.

## Check that it works

1. Open `/health` at your address. It returns a short status naming the deployment that answered (the commit, fingerprint and Worker version `rer deploy` recorded) and the code 200 when the database is reachable, and 503 when it is not.
2. Sign in as the owner with a real mailbox you control, as described just below.
3. Build a flow, publish it, answer it from a second browser and check the results and an export.
4. Send an invitation to a mailbox you control, and look in that inbox.

Only the last step shows that email really arrives. A successful response from your mail provider, or a message in a local outbox, does not. Do not trust email until you have seen a real message in a real inbox. Pencil publishes design targets for speed and size, not measured hosted capacity, so test with a realistic amount of traffic if that matters to you.

### Signing in after setup

Enter your email at `/signin` and choose **Send magic link**. The link in the email opens a confirmation page, and nothing happens until you choose **Confirm**. A link works once and expires after 15 minutes. Sign-in sessions last up to 30 days, and **Sign out** ends yours immediately. Pencil keeps no passwords.

## Set up email

Pencil sends email for three things: sign-in links, invitations and reminders, and new-response notices to operators. It uses SendGrid by default, or Resend when you set `PENCIL_MAIL_PROVIDER=resend` before the first deploy.

- Choose the provider before the first deploy. A fresh installation defaults to SendGrid. Released installations stored `MAIL_PROVIDER=resend` as a plain variable: on their first transition, deploy reads that existing setting and preserves Resend as a secret while inheriting the existing `MAIL_API_KEY`. An explicit conflicting provider is refused before deployment. Once both bindings are secrets, later deployments inherit them; changing your terminal setting does not rotate either one. This preserves provider configuration only; the 0.2.0 database upgrade remains blocked as explained below.
- Verify your sender with the provider, and set `MAIL_FROM` to that address, in the `noreply@` or `no-reply@` form.
- The provider receives each recipient's address and the whole message, including the sign-in, invitation or opt-out link. Keep provider keys and these links out of your logs and out of anything public.
- A missing mail setting stops Pencil from starting and names the variable. There is no half-working mode.
- If the provider fails later, there is no general warning. The sign-in page still says **Check your email**, but no link arrives, and the failure shows only in your Worker's log. Invitations and reminders are marked failed or unknown one by one, and new-response emails show their failures on the results page. People already signed in, public links, embeds, collecting responses, results and exports carry on. There is no password and no other way to sign in, so the sender must work again before anyone can sign in. See [If your mail provider stops working](invitations.md#if-your-mail-provider-stops-working).
- A message that Pencil could not confirm is marked unknown and is never resent on its own. Failed and unknown messages can be retried by an operator. See [Invitations, reminders and consent](invitations.md#when-an-email-does-not-go-through).
- A local copy of Pencil keeps a synthetic outbox instead. It sends nothing and proves nothing about delivery.

The technical notes for maintainers are in [production mail](../production-mail.md) on GitHub.

## What your address serves

Besides your forms and the signed-in workspace, every deployment serves two pages of Pencil's own on your address: the Lobby at `/` by default (`/pencil` redirects there), with one **Sign in** button, and this documentation at `/docs`. They are built into Pencil and there is no setting to turn them off. Like your public forms, they set no cookies and load nothing from other websites. Choosing a **Public landing flow** in **Settings** explicitly overrides the Lobby with that flow's respondent experience. See [A form on your home page](publish-and-share.md#a-form-on-your-home-page).

## What runs in the background

The Worker has a schedule that runs every minute. It sends invitations still waiting in the queue and reminders that have come due, sends the new-response emails operators asked for, and tidies expired session records and rate-limit counters. You do not need to set it up. It comes with the Worker.

## Upgrading

For installations already on this version’s migration history, back up first using the deployed recovery command in [Backup and restore](backup.md), and verify its archive in a new empty target before changing the running installation. The public `rer export` and `rer import` commands remain local; `node scripts/deployment-data-cli.mjs` handles deployed D1, including the deployment kit's migration ledger. Keep the previous deployment until you have checked the new one. For compatible migration histories, leave `SETUP_TOKEN` unset, retain the deployment receipt and deploy the new source with `pnpm run deploy -- --environment production`, which applies the new database migrations in order. `RELEASE.json` lists every migration with its steps.

**Hosted upgrades from released 0.2.0 are blocked with rer 0.2.1.** The deployment kit checks every applied migration hash before writing. The released `0019_import_custody.sql` hash differs from the current file, so it refuses `changed-or-uncertain-migration-history` before applying 0027–0034. It does not consume Pencil’s released-rewrite declaration. The separate name-based Workers D1 upgrade test reaches 0034; it does not qualify this hosted deployment path. Retain the existing source and database, keep that installation running, and obtain and verify backups only through a supported path matching its version. This source’s deployed recovery CLI also checks migration hashes and must not be assumed to export the old 0019 history. Keep that backup intact until a maintained deploy-kit upgrade contract supports that exact released hash and the additive convergence migration. Do not edit the ledger, migration hashes or receipt, and do not switch migration controllers or restore into a fresh installation as an assumed workaround. The [release scope](../FIRST-RELEASE.md) records this limit.

Migrations cannot be undone in place. Keep the previous deployment's source and its database until the new one has been checked.

Pencil has no command that takes a deployed Worker offline. If you need to stop one, for example a first deployment that went wrong, use the Cloudflare dashboard: in your Worker's settings, turn off its `workers.dev` address and remove its Cron trigger. Your database is kept. The next deploy turns both on again.

## Costs, limits and what is not proven

Pencil’s software is free; Cloudflare’s Workers plan is separate. Use Workers Paid for this hosting path: its default request CPU budget is 30 seconds (30,000 ms), while Workers Free permits only 10 ms. The published rer 0.2.1 deploy kit does not accept a `limits.cpu_ms` declaration or upload that setting; this path relies on the provider’s plan default, not an explicit per-Worker limit. Check your account plan and [Cloudflare’s current limits](https://developers.cloudflare.com/workers/platform/limits/) before deploying.

Cloudflare and your mail provider bill you directly, depending on your plans and your traffic. Check their current pricing. Pencil's declared sizes, such as many flows and responses per revision, are design targets and not proven capacity. Local tests do not establish how a hosted deployment performs, and Pencil makes no claim about how much traffic yours will carry. If you rely on a particular load, measure it on your own deployment.

The technical hosting notes for maintainers are in [the full hosting reference](../HOSTING.md) on GitHub.
