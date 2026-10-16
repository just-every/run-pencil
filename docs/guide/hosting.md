# Hosting on Cloudflare

For Managed hosting through RER, Pencil sends email through the RER relay. You do not need a SendGrid or Resend account or API key. Free and Assisted installations keep the ordinary SendGrid or Resend choices.

For direct hosting, Pencil runs on your own Cloudflare account as one Worker with a D1 database. This page takes you from a working local copy to a deployed one: setting your secrets, deploying, and signing in as the first owner. It also covers setting up email, which Pencil cannot work without.

Deploy acts only on the Cloudflare account you select. No command in Pencil deploys anything on its own, and local setup never creates anything in Cloudflare.

## What you need

- **A Cloudflare account on Workers Paid**, and an API token for it that may edit Workers and D1. You give Pencil the account's ID and the token as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, through your secret manager or the secret environment of your terminal.
- **Node.js 22 or later with npm, Git, the rer launcher and the source**, from [Install and run locally](install.md). Node and npm must be on `PATH` before the npm installation route. Use `npm install -g @runeditrun/rer`, as on the Run page. The global launcher delegates to the exact checkout version in `package.json` and its lockfile. rer installs Pencil's pinned runtime and pnpm for its own commands; local `rer setup` is optional.
- **A mail provider**, SendGrid or Resend, with a verified sender address and an API key. See [Set up email](#set-up-email).
- **Installed dependencies.** Run `rer install` if you have not run Pencil locally yet. Deploy builds and validates the checkout. If you changed the source, follow the [source checks](install.md#changing-the-source); the complete `rer verify` suite is separate from the deployment commands below.

## Choose your address and secrets

Deploy reads everything from environment variables. Find your account's `workers.dev` subdomain in the Cloudflare dashboard under **Workers & Pages**, before the first deploy. Pencil names the Worker `pencil-<environment>`, with `production` as the default environment. Its address is therefore:

```text
https://pencil-production.<workers-subdomain>.workers.dev
```

For `--environment staging`, it is `https://pencil-staging.<workers-subdomain>.workers.dev`. Replace `<workers-subdomain>` with your account's actual subdomain to know the address in advance. On a real deploy, rer looks up that subdomain and sets the Worker's `APP_ORIGIN` to the generated address automatically; you do not need to supply it. The dry run validates locally and does not look up the account's subdomain. Use the same environment for deploy, sign-in and removal. Then set these:

| Variable | What it is |
|---|---|
| `APP_ORIGIN` | Set automatically by rer to the account's generated `workers.dev` HTTPS origin. Sign-in links, reports and public links point here. Do not copy a local `.dev.vars` origin into production. |
| `OWNER_EMAIL` | Set this to the hosted owner’s email. The deploy commands below pass it as `SEED_ADMIN_EMAIL`, the owner input in Pencil’s current declaration. |
| `PENCIL_MAIL_PROVIDER` | `sendgrid` (the default) or `resend`. `rer deploy` binds the choice as the Worker’s `MAIL_PROVIDER`. The earlier `MAIL_PROVIDER` environment setting is also accepted; if both are set, they must agree. |
| `MAIL_FROM` | Your provider-verified sender email. Use a plain `noreply@` or `no-reply@` address, with no display name, to enable response notifications and Daily digests. A different verified sender can send sign-in email, but Results explains that response notification mail is off. |
| `MAIL_API_KEY` | Your mail provider's API key. A secret. |
| `SESSION_SECRET` | A secret used to sign people in. rer generates a fresh hosted value when omitted; you may supply a random string of at least 32 characters. Keep the deployed value stable for the life of the installation. |
| `SETUP_TOKEN` | A one-time secret for the first owner. rer generates it when omitted, uses it to claim the hosted owner and removes it after a successful claim. Do not retain it on the Worker. |
| `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` | The account to deploy into and its token. The token is a secret. |

Analysis and external tasks are optional. Configure a provider from the in-app **Analysis** provider setup, and connect your task receiver from the action's **External task** setup. [Analysis](analysis.md) explains the data sent to a language-model provider; [Actions and follow-up](actions.md) explains the webhook contract your task receiver must honour. Other Pencil features keep working while either connection is off.

Supply the secrets through your secret manager or the secret environment of your terminal. Never put their literal values in a tracked file, in a command argument or in your shell history. The commands below pass the owner's email, not a provider key or token.

Leave the local-only options off: `PENCIL_LOCAL_DEVELOPMENT`, `SEED_SAMPLE_DATA` and the local mail provider must never be enabled on a deployment. A deployment turns local capture and sample data off.

## Check, then deploy

An environment name must have at most **32 characters**, start with a lowercase letter, and use only lowercase letters or digits separated by single hyphens. No trailing, leading or repeated hyphens are allowed. For example, `pencil-check` is valid. An invalid name is refused before upload. Choose your deployment's name once and keep it unchanged for deploy, sign-in, backup receipts and removal; do not shorten or rename an existing deployment identifier to fit.

For an ordinary local validation that creates no deployment:

```sh
SEED_ADMIN_EMAIL="$OWNER_EMAIL" rer deploy --dry-run --environment pencil-check
```

For your intended production environment, validate that same name before deploying it:

```sh
SEED_ADMIN_EMAIL="$OWNER_EMAIL" rer deploy --dry-run --environment production
SEED_ADMIN_EMAIL="$OWNER_EMAIL" rer deploy --environment production
```

The dry run builds the real Worker, its assets and its database migrations, and checks your inputs, without contacting any provider. Use it first. The second command deploys into the Cloudflare account you selected and checks the Worker's health afterwards. If a step fails, it stops and tells you which. The migrations are applied to your database in order. Never edit a migration that has already been applied.

A healthy Worker shows that the code runs. It does not show that email arrives or how much traffic your deployment will carry. See [Check that it works](#check-that-it-works).

## Sign in as the first owner

Deploy claims the hosted owner automatically from `OWNER_EMAIL`, passed to Pencil’s current `SEED_ADMIN_EMAIL` input by the commands above, then removes the one-time `SETUP_TOKEN` and records the new Worker version. Deploy prints the hosted application address on first deploy and updates. The build step reports that the application is built; it does not start a local server. Wait for deploy to confirm the owner claim and token removal. There is no manual setup-token form to complete after a successful deploy.

1. Open `/signin` at the hosted address printed by deploy.
2. Enter the owner's email and choose **Send magic link**. Open the email and choose **Confirm**.
3. Complete your business name and time zone on `/setup`, then choose **Finish setup**. Until you do, the rest of the app sends you back there.

If deploy reports an incomplete health check, owner claim or token retirement, follow its recovery instructions and rerun the same deployment command with the same environment credentials. A printed application URL alone does not mean deployment completed. Do not remove the token by hand before the claim is confirmed.

The owner can also use the deployment's Cloudflare credentials to request a one-time sign-in link without email:

```sh
rer signin --environment production
```

Run it from the checkout that deployed this environment, with its private deployment receipt and the same `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The command prints a private link once, for the recorded owner only, valid for up to 15 minutes and one use. Open it promptly and keep it out of logs and shared output. An older deployment without owner-sign-in support is refused with upgrade guidance. Other operators continue to use email sign-in.

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

Pencil sends sign-in links, invitations and reminders, and new-response notices and Daily digests to operators. Managed hosting through RER supplies the RER mail relay without a separate provider account or API key. The following setup applies to direct Cloudflare hosting, including Free and Assisted installations: SendGrid is the default, or choose Resend by setting `PENCIL_MAIL_PROVIDER=resend` before the first deploy.

- Choose the provider before the first deploy. A fresh installation defaults to SendGrid. Released installations stored `MAIL_PROVIDER=resend` as a plain variable: on their first transition, deploy reads that existing setting and preserves Resend as a secret while inheriting the existing `MAIL_API_KEY`. An explicit conflicting provider is refused before deployment. Once both bindings are secrets, later deployments inherit them; changing your terminal setting does not rotate either one. This preserves provider configuration only; the 0.2.0 database upgrade remains blocked as explained below.
- Verify your sender with the provider, and set `MAIL_FROM` to that address. A plain `noreply@` or `no-reply@` address enables new-response notices and Daily digests. With a different verified sender, sign-in still works and each flow's Results page explains why response notification mail is off.
- The provider receives each recipient's address and the whole message, including the sign-in, invitation or opt-out link. Keep provider keys and these links out of your logs and out of anything public.
- A missing mail setting stops Pencil from starting and names the variable. There is no half-working mode.
- If the provider fails later, there is no general warning. The sign-in page still says **Check your email**, but no link arrives, and the failure shows only in your Worker's log. Invitations and reminders are marked failed or unknown one by one, and response emails show their failures on the results page. People already signed in, public links, embeds, collecting responses, results and exports carry on. Other operators need mail restored before they can sign in; the hosted owner can use `rer signin` where supported, as described above. See [If your mail provider stops working](invitations.md#if-your-mail-provider-stops-working).
- A message that Pencil could not confirm is marked unknown and is never resent on its own. Failed and unknown messages can be retried by an operator. See [Invitations, reminders and consent](invitations.md#when-an-email-does-not-go-through).
- A local copy of Pencil keeps a synthetic outbox instead. It sends nothing and proves nothing about delivery.

The technical notes for maintainers are in [production mail](../production-mail.md) on GitHub.

## What your address serves

Besides your forms and the signed-in workspace, every deployment serves two pages of Pencil's own on your address: the Lobby at `/` by default (`/pencil` redirects there), with one **Sign in** button, and this documentation at `/docs`. They are built into Pencil and there is no setting to turn them off. Like your public forms, they set no cookies and load nothing from other websites. Choosing a **Public landing flow** in **Settings** explicitly overrides the Lobby with that flow's respondent experience. See [A form on your home page](publish-and-share.md#a-form-on-your-home-page).

## What runs in the background

The Worker has a schedule that runs every minute. It sends invitations still waiting in the queue and reminders that have come due, dispatches immediate response notices and Daily digests, advances queued analysis work, and tidies expired session records and rate-limit counters. You do not need to set it up. It comes with the Worker. Cloudflare may take time to propagate a newly deployed Cron trigger; **Immediately** means queued after the response, not delivered inside the respondent's request.

## Upgrading

For installations already on this version’s migration history, back up first using the deployed recovery command in [Backup and restore](backup.md), and verify its archive in a new empty target before changing the running installation. The public `rer export` and `rer import` commands remain local; `node scripts/deployment-data-cli.mjs` handles deployed D1, including the deployment kit's migration ledger. Keep the previous deployment until you have checked the new one. For compatible migration histories, leave `SETUP_TOKEN` unset, retain the deployment receipt and deploy the new source with `rer deploy --environment production`, which applies the new database migrations in order. `RELEASE.json` lists every migration with its steps.

**Released 0.2.0 needs a separately qualified hosted upgrade.** The released `0019_import_custody.sql` hash differs from this source. The recorded rer 0.2.1 attempt refused that history before writing, and the separate name-based Workers D1 proof does not qualify the hosted deployment path. The exact current rer version is pinned in `package.json` and its lockfile; changing a version alone does not establish a safe transition. Retain the existing source and database and obtain backups through a supported path matching that installation's version until a reviewed transition preserves the actual applied history and applies the additive convergence migration. This source's deployed recovery CLI also checks migration hashes and must not be assumed to export the old 0019 history. Do not edit the ledger, migration hashes or receipt, switch migration controllers or assume export/restore qualifies the transition. The [release scope](../FIRST-RELEASE.md) records the earlier result.

Migrations cannot be undone in place. Keep the previous deployment's source and its database until the new one has been checked.

## Remove a deployment

Make and verify a [hosted backup](backup.md#back-up-a-deployed-database) first if you need the data. From the checkout that deployed it, with that environment's receipt and Cloudflare credentials, run:

```sh
rer deploy --remove --yes --environment production
```

This deletes resources recorded as created by rer for that environment, including Pencil's Worker and D1 database, and reads back that they are gone. It does not remove unrelated account resources. `--yes` confirms deletion, including every answer in the database. Preserve `.rer/deploy/production.json` privately; do not alter it to claim resources.

Removal is permanent, so do not use it to pause writers for backup. To pause while keeping the database, follow [Back up a deployed database](backup.md#back-up-a-deployed-database).

## Costs, limits and what is not proven

Pencil’s software is free; Cloudflare’s Workers plan is separate. Use Workers Paid for this hosting path. Pencil's deployment declaration sets no explicit per-Worker CPU limit, so this path uses the provider plan's default. Check your account plan and [Cloudflare’s current limits](https://developers.cloudflare.com/workers/platform/limits/) before deploying.

Cloudflare and your mail provider bill you directly, depending on your plans and your traffic. Check their current pricing. Pencil's declared sizes, such as many flows and responses per revision, are design targets and not proven capacity. Local tests do not establish how a hosted deployment performs, and Pencil makes no claim about how much traffic yours will carry. If you rely on a particular load, measure it on your own deployment.

The technical hosting notes for maintainers are in [the full hosting reference](../HOSTING.md) on GitHub.
