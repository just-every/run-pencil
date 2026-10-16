# Pencil demo

After the ordinary `rer setup`, run `rer demo` (`rer dev --demo`) and open its
private `RER_OPEN` link. It runs on fresh data in `.rer/demo/<start>/`, which is
deleted when it stops (`rer demo --stop`, Ctrl-C or its end, one hour after it
starts). The checkout's own `.wrangler/state` and private settings are never
written. Restarting starts afresh.

The owner lands signed in on a finished first run: the Aurora Coffee workspace
with its brand, the published post-visit feedback form (also the public landing
at `/`) and its draft, and 44 visits over the last four weeks, 38 of them
finished, so results and reporting have something to show. It is the seed's own
Aurora Coffee sample (`sample-data/auroraCoffee.ts`) placed in the owner's
workspace by `src/demo.ts`, with its dates moved to end today. Response
notifications are on for the owner, so a response submitted on the public form
notifies the owner, with the mail suppressed.

Base's demo module at `src/base/demo` (`withDemo`, the first import of
`src/server.ts`) guards every send that would leave: real public reads go out,
writes that reach people or third-party accounts answer with a provider success
and nothing is sent. The module is a recorded byte-exact copy in
`base-copies.json`.

## What a demo cannot send

| Effect | In a demo |
|---|---|
| Response, invitation and sign-in mail | Silently suppressed; never sent. Invited people sign in with Base's one-click **Sign in as** path. |
| Form-action task webhooks (`TASK_PROVIDER=webhook`) | Answered by `demoEffect` with a provider-shaped `demo-…` task id; nothing leaves, and the action records the task as confirmed. |
| AI analysis and draft rewrites | Mocked in every demo, whatever the private settings hold: `src/core/platform/ai/demo.ts` answers with provider-shaped results built from the submitted responses, so themes, recommendations and accepted drafts work and no provider is called. |
| Published public forms and embeds | Locally on the demo's loopback origin only. Hosted, every path, `/f/…` and `/embed/…` included, answers only a request carrying the visitor's demo cookie; anyone else gets the start page. |

Production configuration does not change when `RER_DEMO` is absent: a hosted
deployment still needs Resend or SendGrid, its explicit owner-claim origin and
its own AI and task settings.

## Hosted demo

`deploy-demo.json` describes the hosted demo at `demo.run-pencil.com` on
Base's native demo host (rer 0.2.30): Turnstile admits each visitor into their
own Worker Loader isolate with a SQLite facet for the `DB` database, the
once-a-minute cron delivered by alarm and the built static files served at the
edge. The visitor lands signed in as the demo owner through the signed owner
claim; the copy and its storage are erased after 60 minutes or 15 idle minutes.
Under `RER_DEMO=1` on its https origin, Pencil keeps mail suppressed
(`MAIL_PROVIDER=local`), takes the demo owner from the front's `OWNER_EMAIL`
and the claim origin from its `APP_ORIGIN`. Its task webhook points at
`tasks.example.com` with a stand-in key, because demo settings never carry
keys; the demo guard answers the send with a provider success and nothing
leaves.

`.github/workflows/run-demo.yml` is Base's `export/run-demo.yml`, recorded in
`base-copies.json`. It runs only when dispatched by hand, in the `run-demo`
environment on the RunEditRun account (`vars.CLOUDFLARE_ACCOUNT_ID`). With
`test_only` it deploys the separate test host `demo.test.run-pencil.com` with
Turnstile's test keys, where starts need the private
`RER_DEMO_MEASUREMENT_TOKEN`; with `remove` it removes that demo.
`rer deploy --demo --dry-run` builds the native host into `.rer/demo-host/`
with no provider request. The start and ended pages are Base's shared pages.
