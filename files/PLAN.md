# sd-pencil-c-f34 implementation plan

Repository: just-every/run-pencil. Product branch: cloud/sd-pencil-c-f34.

The lease is the native per-action health read in AGENT-005. The full clause remains PARTIAL: this round cannot claim background monitoring, a consolidated interface, other integration delivery monitoring, mail and SMS bounces, completion and drop-off monitoring, quarantine or evidence-gap monitoring, reminder replay, reconnection, recipient changes, or outside-form disclosure. Existing provider and release holds remain.

1. Read the live contract, native action routes, task delivery and reminder readers, operator lifecycle and existing action journeys. Map the leased outcomes to existing registrations without adding a registration.
2. Add an authenticated workspace-bound GET action health route. Resolve the action under current operator authority before reading delivery data. Reuse native task delivery state and reminder schedule state. Read all retained failed and unknown reminder occurrences, including older records beyond detail's recent-history window.
3. Return exact action, task delivery, attempt and reminder occurrence IDs with fixed safe explanations. Distinguish an observed receiver error from ambiguous delivery; do not infer expired tokens or other unobserved causes. Give bounded human repair steps; keep every effect behind existing explicit operator doors.
4. Extend the existing task journey to read failed and unknown task health without outbound effects, combine a failed task with real native owner removal, refuse unauthenticated, foreign and revoked reads, reuse unchanged confirmed payloads on explicit retry, and refuse stale payloads until fresh confirmation.
5. Extend the existing reminder journey to inspect missing-owner and missing-mailbox schedules, real rejected and unknown mail occurrences, older retained failures, repeated no-effect reads and unknown reminders remaining unresent.
6. Run touched Worker journeys, the project typecheck and first-party check. Generate and check contract views, restore generated outputs, refresh main using the permitted unpublished or published-history rule, then regenerate and check the source lock last.
7. Inspect all candidate identities, trailers and changed text before each guarded push. Push only the named branch. Discover exact-SHA CI through REST within the ten-call budget; the guarded Mac lander owns publication scanning and landing. Publish actual non-secret report and receipts separately under the evidence branch.

No UI, new test registration, acceptance rewrite, Status table edit, dependency pin change or migration is planned.
