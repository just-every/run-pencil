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
shows up as captured mail.

Base's demo module at `src/base/demo` (`withDemo`, the first import of
`src/server.ts`) adds the Demo bar and refuses every send that leaves the
machine. Its only adaptation is its imports: `escapeHtml` and `isLoopbackHost`
from Pencil's operator-auth copy, and Base's CSP helper carried beside it as
`src/base/demo/csp.mjs`, so operator-auth keeps its single Base revision. The
other five files are recorded byte-exact copies in `base-copies.json`.

## What a demo cannot send

| Effect | In a demo |
|---|---|
| Response, invitation and sign-in mail | Captured in the development outbox and listed in the Demo bar; never sent. |
| Form-action task webhooks (`TASK_PROVIDER=webhook`) | The call is refused before it leaves and listed under "Blocked sends"; the action records the attempt as unknown, never delivered. |
| AI analysis | Off in every demo, whatever the private settings hold: the Analysis page says so and no provider is called. |
| Published public forms and embeds | Locally on the demo's loopback origin only. Hosted, every path, `/f/…` and `/embed/…` included, answers only a request carrying the visitor's demo cookie; anyone else gets the start page. |

Production configuration does not change when `RER_DEMO` is absent: a hosted
deployment still needs Resend or SendGrid, its explicit owner-claim origin and
its own AI and task settings.

## Hosted demo

`deploy-demo.json` describes the hosted demo at `demo.run-pencil.com`: one
container per visitor (Base's demo host), signed in as the demo owner through
the signed owner claim, with no internet. Under `RER_DEMO=1` on its https
origin, Pencil keeps mail in the outbox (`MAIL_PROVIDER=local`), takes the demo
owner from the front's `OWNER_EMAIL` and the claim origin from its `APP_ORIGIN`.
Its task webhook points at `tasks.example.com` with a stand-in key, because demo
settings never carry keys; the call is refused either way, so a visitor can
try external tasks and see the refusal.

`.github/workflows/run-demo.yml` runs only when dispatched by hand, in the
`run-demo` environment on the RunEditRun account. With `test_only` it deploys
the separate test host `demo.test.run-pencil.com` with Turnstile's test keys;
with `remove` it removes that demo. `rer deploy --demo --dry-run` builds the
front Worker and the workerd image into `.rer/demo-host/` with no provider
request. The start and ended pages are Base's shared pages.
