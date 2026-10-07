# Release notes

## 0.1.0 — 7 October 2026

Pencil’s first public release is a self-hosted form builder and feedback workspace for one business. It includes operator email sign-in, flow building and publishing, adaptive respondent journeys, response collection, invitations and reminders, delivery status, privacy controls, and export and restore commands. Operator and public routes use the native Cloudflare runtime. Optional Run Edit Run credit defaults off.

The first-release profile defers audience management (AUD), AI analysis (ANLY), actions (ACT) and notifications (NOTIFY). Those requirements remain visible and the full-contract gate remains unsatisfied; this release does not claim their acceptance.

Migration `0010_base_operator_auth.sql` deliberately signs existing operators out: it imports their identities and revokes legacy magic links and sessions. Export before migrating, configure the maintained Base mail and session secret, and have operators sign in again. Existing product data and the bytes of migrations 0000–0009 are preserved. Recovery restores a private export into a new database without replaying mail.

Research screenshots, copied design HTML and beacons are excluded from the public tree. Runtime fonts and icons retain their dependency license notices.
