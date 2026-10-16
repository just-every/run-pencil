# Pencil

Pencil is a self-hosted form builder for one business. You build short forms that ask one question at a time and change the next question based on what people answer. Then you share a link, send invitations, and read the results. It runs on your own Cloudflare account, so the answers stay with you. It is free and MIT licensed, and the source is at https://github.com/just-every/run-pencil.

## What you get

- **Short, adaptive forms.** A form is an optional welcome screen, a handful of questions, and a named completion screen. There are 13 question types, from short text and email to ratings, NPS, dates and consent. See [Build a form](build-a-form.md).
- **Answer paths.** Send people to different questions depending on what they said, and check the whole route in a preview before anyone sees it. See [Answer paths](branching.md).
- **Numbered revisions.** Publishing makes an immutable revision. You can keep editing a new draft while the live form stays exactly as it was. See [Publish and share](publish-and-share.md).
- **A public link, a script or an iframe.** Put the form on its own page or inside your website. See [Publish and share](publish-and-share.md).
- **A shared audience.** Add and edit contacts with custom fields, review CSV imports before committing, choose whether matching contacts are updated, and save rule-based segments with current counts. See [Invitations, reminders and consent](invitations.md).
- **Invitations and reminders.** Email a personal link to selected contacts or a saved segment, send one reminder, and honour opt-outs. Each launch freezes its audience, contact names and addresses, and evaluated eligibility and reminder policies. See [Invitations, reminders and consent](invitations.md).
- **Results you can read without any AI.** Answers for each question, completion and drop-off, a ledger of every response, and JSON or CSV downloads. See [Results, review and exports](results.md).
- **Analysis you can check.** Optionally connect a language model to group a revision's text answers into ranked themes. Every count is recomputed by Pencil, every quote is an exact excerpt you can open, small themes are withheld, and the one recommendation becomes an action only when you choose. Off until you configure a provider. See [Analysis](analysis.md).
- **Question rewrites you review.** With AI configured, request a sharper, broader or contextual rewrite of a saved draft question. Compare source and proposal, then accept or reject it. Accepting saves only that question's wording to the draft; publishing is separate. See [Rewrite a question](build-a-form.md#rewrite-a-question).
- **Response email and analysis notifications.** Choose Immediately, Daily or Off for each flow's response email. Daily starts when enabled, without historical mail. Completed or failed analyses appear in your personal list on the Analysis page. See [Results](results.md#get-an-email-for-new-responses) and [Analysis notifications](analysis.md#analysis-notifications).
- **Actions with an owner and a review date.** Turn what results show, or an analysis recommendation you accept, into an action with an owner, a target metric and a review date, record what changed, and mark it effective or ineffective yourself. Optionally send it to your own task system through a webhook, after you confirm exactly what leaves. See [Actions and follow-up](actions.md).
- **Your own branding.** Your business name, supporting line, accent colour and logo on your public forms.
- **A way in from another form builder.** Import a Typeform form and its responses, or start with a Google Forms response CSV and an optional form-definition JSON, into an editable draft. See [Moving in](moving-in.md).
- **Backup and restore.** Export product data, excluding credentials, sessions and private settings, and restore into an empty database. `rer export`/`rer import` are local; hosted D1 recovery uses a separate script, requires all writers stopped and an independently provisioned migration-only target. See [Backup and restore](backup.md).

## Who it is for

Pencil is built for one business with one shared workspace. Everyone who signs in is an operator, and every operator can see and change everything. There are no roles and no separate workspaces. If that fits you, you get a feedback and lead-capture tool you fully own and can change, because the whole product is the source code in the repository.

## What is not in this release

Check this list before you plan around Pencil. These things are not built yet, so you will not find them hidden in a setting.

- **Named task-system integrations.** External tasks go to a webhook you run; there is no built-in Jira, Linear, Asana or similar connection.
- **Roles, several workspaces, payments, scheduling, file-upload questions, native mobile apps and single sign-on.** These are out of scope.
- **Other kinds of embed.** The Share panel offers the public link, a script embed and a plain iframe, and nothing else.

The dashboard line **Ask → Signal → Act** describes the whole loop: build a form, read results or request an analysis, then accept or write an action and decide whether it worked.

## Start here

1. [Install and run locally](install.md) takes you from the source code to a working copy on your own computer.
2. [Build a form](build-a-form.md) makes your first form from a template or from scratch.
3. [Publish and share](publish-and-share.md) puts it in front of people.

## Run it for real

- [Hosting on Cloudflare](hosting.md) covers deploying the Worker and database, choosing a mail provider and signing in as the first owner.
- [Backup and restore](backup.md) explains the product-data archive, credential exclusions and separate local and hosted recovery requirements.
- [Privacy and security](privacy.md) says what Pencil collects, what it does not, and what stays your responsibility.

## About this release

The source in this repository is version 0.5.0. Nothing in these pages claims a live service, a measured hosting capacity, or proof that email reaches an inbox. Those depend on your own deployment and your own mail provider. The [changelog on GitHub](../../CHANGELOG.md) lists what each version changed, and the product requirements are in [CONTRACT.md](../../CONTRACT.md). Pencil is MIT licensed, and the licence is in [LICENSE](../../LICENSE).
