# Mail delivery verification

The maintained mail doctor can inspect a proposed configuration without sending:

```sh
node src/base/mail/doctor.mjs --domain mail.example.com --provider resend --plan --json
```

The plan names MX, SPF, DKIM, DMARC and next actions. Actual provider record values must come from an explicitly supplied configuration; sample names do not establish DNS or mailbox readiness.

Live checks require an authorized test sending domain, verified sender, sending credential, configured receiving mailbox and readback credential. Use the mail doctor configuration and environment variables documented in the parent mail module. Keep input credentials private. Sender acceptance and an offline plan do not prove recipient-side arrival.

The retained live-proof entry point is intended for a protected GitHub Actions workflow. It requires exact source/run metadata, a clean checkout, explicit configuration and a new private receipt path. Pencil's local verification does not dispatch that workflow or perform live delivery. See docs/HOSTING.md for the application's hosted acceptance requirements.
