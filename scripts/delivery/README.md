# Pencil managed delivery

`base/packaging.json` is the maintained source policy. Base's delivery producer
was exported from main 947fed73ec5f3018672992a2304296d25694ea96. The export
relocates only setup-manifest.mjs's schema imports; the remaining runtime and
schema bytes match Base. Packaging writes raw schema-2 payloads, SQL migrations,
the shared setup manifest, project descriptor and managed workflow.

Build with `pnpm run build:delivery`, then use `node scripts/build-delivery-artifact.mjs`
with a fresh `delivery-artifact` directory. This prepares source artifacts and
makes no provider call. The generated descriptor and workflow follow this policy;
rerun the producer's package command after changing it and retain its generated
files. The workflow calls trusted-build.yml at
bf7a25abb44bec1457a7bc738ff63921d90fb52e. That trusted builder selects the
project's Node 22.20.0 pin before executing setup-build.sh. The production template supplies artifact configuration; generated local settings never enter the package. Trusted CI runs default functional and high-stakes checks. The separate
release scale command runs before release and is required by the maintained
release producer.

`pnpm integration:sync` builds the deployment and commits its Base-derived spec
to `management/integration/deployment-spec.json`. After the deployment build,
`pnpm source:check` rejects a stale spec in CI. `MAIL_API_KEY` is an optional
deployment secret; the setup manifest requires it for Resend and SendGrid.

`rer-setup.json` names the first owner's SEED_ADMIN_EMAIL, hidden generated
SETUP_TOKEN and SESSION_SECRET, and the selected hosted mail settings. Local
sign-in uses the Base outbox. Hosting requires a configured Resend or SendGrid
sender and entered MAIL_API_KEY. The private hidden setup token is never shown to
the owner. Deployment origin and signed-claim issuer, installation ID, app origin
and public P-256 keys come from trusted installation configuration, never requests.
The claim handler calls native operator-auth and permanently refuses another
claim, including when an installation already has an owner.

Editor grants require an active native owner session. They contain only the
management origin, installation ID and short expiry. Optional management settings
are RER_MANAGEMENT_ORIGIN and RER_INSTALLATION_ID. Missing settings leave the editor
disabled; malformed settings fail closed. Focus/renewal rechecks native authority;
native logout removes the mount immediately. Application CSP retains its other
protections and permits only the configured management origin in frame-src and
frame-ancestors. Compiled data-only edits use the one copied runtime and resume
at each hydrated route leaf.

`pnpm run verify:admission` checks actual package integrity and the emitted owner
editor at 1440 and 390. The issuer and management peer are test-only network edges.
These checks prove source integration; hosted installation, real RER registration,
provider delivery and production editing remain owner work.
