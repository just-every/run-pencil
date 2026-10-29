# Company agents

Pencil serves one company-policy door at `/mcp`. MCP 2026-07-28 and 2025-11-25 expose the same native registry. Unsupported 2025-03-26 negotiation returns `UnsupportedProtocolVersion` (-32022). Canonical metadata is at `/.well-known/oauth-protected-resource/mcp`; signed-in people open `/agents` for activity, named approvals and local Pause.

The declared core set for this adoption is **tools, policy, pause, audit and idempotency**. Principal authorization and owner-bound tokens always apply. The pinned 0.2.87 surface validator tolerates a `capabilities` array, but its typed `createAgentDoor` options reject it. This guide therefore records the declaration; no unsupported key is added to the runtime or manifest. The installed verifier still runs its unscoped checks.

Agents can prepare forms and studies, inspect retained responses and analysis, triage native response metadata, prepare and measure accountable work, maintain audiences, collectors, templates and coding, inspect reports and delivery truth, and save supported native business settings. Every call uses the sponsor's current native account and the same services as the person interface. Imported form, response, contact and provider text is untrusted.

## Native registry

Discovery publishes each tool's complete input/output schema, scope and contract references. Classes come from the exact proposed effect and native records. The table lists all possible classes; it does not mean every call has every listed class.

| Tool | Scope | Possible classes | Clauses |
| --- | --- | --- | --- |
| `pencil.forms.list` | `pencil:forms` | standard | DASH-002 |
| `pencil.forms.read` | `pencil:forms` | standard | FLOW-004, FLOW-008 |
| `pencil.forms.templates` | `pencil:forms` | standard | TMPL-001 |
| `pencil.forms.create` | `pencil:forms` | standard | FLOW-001, TMPL-001 |
| `pencil.forms.duplicate` | `pencil:forms` | standard | FLOW-011 |
| `pencil.forms.edit` | `pencil:forms` | standard | FLOW-004, FLOW-009 |
| `pencil.forms.preview` | `pencil:forms` | standard | FLOW-007 |
| `pencil.forms.add_question` | `pencil:forms` | standard | FLOW-002, FLOW-004 |
| `pencil.forms.duplicate_question` | `pencil:forms` | standard | FLOW-004 |
| `pencil.forms.remove_question` | `pencil:forms` | standard | FLOW-004 |
| `pencil.forms.reorder` | `pencil:forms` | standard | FLOW-004 |
| `pencil.forms.branches` | `pencil:forms` | standard | FLOW-006, LOGIC-006 |
| `pencil.forms.publish` | `pencil:forms` | external, live | FLOW-008 |
| `pencil.forms.close` | `pencil:forms` | external, live | FLOW-010 |
| `pencil.forms.reopen` | `pencil:forms` | external, live | FLOW-010 |
| `pencil.forms.archive` | `pencil:forms` | standard, external, live | FLOW-010 |
| `pencil.results.read` | `pencil:forms` | standard | RSLT-001 |
| `pencil.studies.list` | `pencil:studies` | standard | AGENT-001, AI-001 |
| `pencil.studies.read` | `pencil:studies` | standard | AGENT-001, AI-001 |
| `pencil.studies.generate` | `pencil:studies` | standard, external | AGENT-001, AI-001 |
| `pencil.studies.update` | `pencil:studies` | standard | AGENT-001, AI-001 |
| `pencil.contacts.list` | `pencil:contacts` | standard | DIST-003 |
| `pencil.segments.list` | `pencil:segments` | standard | DIST-003 |
| `pencil.analyses.list` | `pencil:analyses` | standard | ANLY-001, ANLY-010 |
| `pencil.analyses.options` | `pencil:analyses` | standard | ANLY-002 |
| `pencil.actions.list` | `pencil:actions` | standard | ACT-001, ACT-002 |
| `pencil.responses.list` | `pencil:responses` | standard | LEDG-001, LEDG-006 |
| `pencil.results.questions` | `pencil:results` | standard | RSLT-001 |
| `pencil.results.compare` | `pencil:results` | standard | RSLT-005 |
| `pencil.deliveries.list` | `pencil:deliveries` | standard | DIST-004, DIST-008 |
| `pencil.collectors.list` | `pencil:collectors` | standard | DIST-017 |
| `pencil.settings.read` | `pencil:settings` | standard | WS-001, WS-002 |
| `pencil.operators.list` | `pencil:operators` | standard | OPER-001 |
| `pencil.forms.settings` | `pencil:forms` | standard | FLOW-004, FIELD-001, LOGIC-003 |
| `pencil.forms.layout` | `pencil:forms` | standard | FIELD-008, FIELD-012 |
| `pencil.workspace.read` | `pencil:workspace` | standard | DASH-002, FLOW-004 |
| `pencil.events.list` | `events:read` | standard | BASE-AGENT-010 |
| `pencil.connections.read_analysis` | `pencil:connections` | standard | WS-003 |
| `pencil.connections.configure_analysis` | `pencil:connections` | security | WS-003, GOV-005 |
| `pencil.connections.remove_analysis` | `pencil:connections` | security | WS-003, GOV-005 |
| `pencil.connections.read_task` | `pencil:connections` | standard | WS-003 |
| `pencil.connections.configure_task` | `pencil:connections` | security | WS-003, GOV-005 |
| `pencil.connections.remove_task` | `pencil:connections` | security | WS-003, GOV-005 |
| `pencil.actions.read` | `pencil:actions` | standard | ACT-001, ACT-002, ACT-007 |
| `pencil.actions.create` | `pencil:actions` | standard | ACT-001, ACT-003, ACT-008 |
| `pencil.actions.edit` | `pencil:actions` | standard | ACT-001, ACT-003 |
| `pencil.actions.transition` | `pencil:actions` | standard | ACT-002, ACT-005 |
| `pencil.actions.measure` | `pencil:actions` | standard | ACT-006, ACT-007 |
| `pencil.responses.options` | `pencil:responses` | standard | WORK-001 |
| `pencil.responses.read` | `pencil:responses` | standard | WORK-001 |
| `pencil.responses.create_status` | `pencil:responses` | standard | WORK-001 |
| `pencil.responses.triage` | `pencil:responses` | standard | WORK-001 |
| `pencil.integrations.deliveries` | `pencil:integrations` | standard | INTEG-015 |
| `pencil.integrations.webhooks` | `pencil:integrations` | standard | INTEG-010 |
| `pencil.integrations.alerts` | `pencil:integrations` | standard | INTEG-015 |
| `pencil.rewrites.request` | `pencil:rewrites` | standard, external | ANLY-009, AGENT-001 |
| `pencil.rewrites.read` | `pencil:rewrites` | standard | ANLY-009, AGENT-001 |
| `pencil.rewrites.decide` | `pencil:rewrites` | standard | ANLY-009, AGENT-001 |
| `pencil.settings.update` | `pencil:settings` | standard | WS-001, WS-002, DIST-005 |
| `pencil.settings.embedding` | `pencil:settings` | standard, external, access, live | DIST-002 |
| `pencil.retention.read` | `pencil:retention` | standard | GOV-003 |
| `pencil.retention.configure` | `pencil:retention` | standard, destructive | GOV-003 |
| `pencil.contacts.read` | `pencil:contacts` | standard | AUD-001 |
| `pencil.contacts.create` | `pencil:contacts` | standard | AUD-001 |
| `pencil.contacts.edit` | `pencil:contacts` | standard | AUD-001 |
| `pencil.contacts.opt_out` | `pencil:contacts` | standard | AUD-001 |
| `pencil.segments.read` | `pencil:segments` | standard | AUD-002 |
| `pencil.segments.create` | `pencil:segments` | standard | AUD-002 |
| `pencil.segments.edit` | `pencil:segments` | standard | AUD-002 |
| `pencil.segments.erase` | `pencil:segments` | destructive | AUD-002 |
| `pencil.collectors.read` | `pencil:collectors` | standard | DIST-017 |
| `pencil.collectors.create` | `pencil:collectors` | standard, external, live | DIST-017 |
| `pencil.collectors.edit` | `pencil:collectors` | standard, external, live | DIST-017 |
| `pencil.collectors.close` | `pencil:collectors` | standard, external, live | DIST-017 |
| `pencil.collectors.reopen` | `pencil:collectors` | standard, external, live | DIST-017 |
| `pencil.collectors.erase` | `pencil:collectors` | destructive, external, live | DIST-017 |
| `pencil.analyses.read` | `pencil:analyses` | standard | ANLY-003, ANLY-004, ANLY-007, ANLY-010 |
| `pencil.analyses.theme_responses` | `pencil:analyses` | standard | ANLY-004, ANLY-005, ANLY-011 |
| `pencil.analyses.policies` | `pencil:analyses` | standard | ANLY-005, ANLY-015 |
| `pencil.analyses.configure` | `pencil:analyses` | standard | ANLY-005, ANLY-015 |
| `pencil.analyses.attention` | `pencil:analyses` | standard | NOTIFY-001 |
| `pencil.analyses.configure_attention` | `pencil:analyses` | standard | NOTIFY-001 |
| `pencil.notifications.read` | `pencil:notifications` | standard | NOTIFY-002, NOTIFY-003 |
| `pencil.notifications.configure` | `pencil:notifications` | standard | NOTIFY-002, NOTIFY-003 |
| `pencil.notifications.alerts` | `pencil:notifications` | standard | NOTIFY-005 |
| `pencil.coding.list` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.create` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.answers` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.assign` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.remove` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.suggestions` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.decide` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.counts` | `pencil:coding` | standard | RSLT-012 |
| `pencil.coding.crosstab` | `pencil:coding` | standard | RSLT-012 |
| `pencil.templates.list` | `pencil:templates` | standard | TMPL-002 |
| `pencil.templates.save` | `pencil:templates` | standard | TMPL-002 |
| `pencil.templates.create_form` | `pencil:templates` | standard | TMPL-002 |
| `pencil.templates.retire` | `pencil:templates` | standard | TMPL-002 |
| `pencil.results.devices` | `pencil:results` | standard | RSLT-004 |
| `pencil.results.trends` | `pencil:results` | standard | RSLT-007 |
| `pencil.results.crosstab` | `pencil:results` | standard | RSLT-006 |
| `pencil.results.views` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.view` | `pencil:results` | standard | RSLT-008, RSLT-009 |
| `pencil.results.save_view` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.dashboards` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.dashboard` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.create_dashboard` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.update_dashboard` | `pencil:results` | standard | RSLT-008 |
| `pencil.results.shares` | `pencil:results` | standard | RSLT-009 |
| `pencil.responses.versions` | `pencil:responses` | standard | RESP-021 |
| `pencil.responses.quarantine` | `pencil:responses` | standard | RESP-016, RESP-017, RESP-018 |

Form draft changes retain native version checks. Writes require an `idempotency_key`; reusing one with different arguments conflicts. `expected_revision` binds the effect to the native revision returned by a read. Approvals retain the exact server summary and revision. A replay rechecks current authority, consent, scope, policy and Pause before returning a retained result; it executes no second effect. Native conflicts leave the record unchanged.

`pencil:workspace` authorizes the broad workspace witness separately from the narrower area scopes. A forms-only credential cannot read audience, workflow or action data through that witness. Provider connection writes also require the current native installation owner and `pencil:connections`.

## Native record readers

The door retains eight native resource readers:

- `pencil://forms/{id}`
- `pencil://revisions/{id}`
- `pencil://responses/{id}`
- `pencil://contacts/{id}`
- `pencil://analyses/{id}`
- `pencil://findings/{id}`
- `pencil://actions/{id}`
- `pencil://deliveries/{id}`

Each reader enforces current native visibility and its own scope, computes its classes from the record, treats external text as untrusted, and routes through policy, approval and audit. Missing and restricted records return the same `resource_unavailable` code. Connection secrets and bearer values are never returned. The optional **resources** capability remains undeclared: this core adoption does not claim every point for every reader, resource refresh or subscriptions. No program resource is registered because Pencil has no native program entity.

## Company identity and native people

Business sends signed settings to `/api/rer/business-settings` and signed policy to `/api/rer/agent-policy`. A token subject binds through the signed owner's `owner_id` or a teammate's Business `id`, then through Pencil's retained authentication link to its current product operator ID. Token email never selects an account. Unknown, inactive, pending or removed people cannot sponsor work. An email change cannot move an established binding, pending approval or historical attribution.

Pencil has equal native operators. Reconciliation binds existing confirmed accounts and creates no shadow accounts. The native setup owner maps to Business owner, a signed-roster admin to policy editor, and a member to no policy-editing role. Local promotion does not confer Business approval authority. Pencil has no separate native allow-list setting; admission uses its active account status and authentication link. Existing respondent, saved-session, import, provider-callback, connector and installation credentials keep their own purposes.

A recognizable Business credential that fails verification cannot fall through to a local credential. Business tokens require consent. Revocation stops the next agent effect. Local credentials resolve a current native person by ID and retain their original narrow scope.

## Policy and attribution

The company chooses the disposition for each class. Missing, unanswered, expired or blocked policy, and Business or local Pause, refuse work. A fully autonomous policy adds no preset human approval. A native person decision remains separate from agent preparation: agent credentials cannot approve their own requests or impersonate a person's confirmation.

Native history and provider content name the agent for its sponsor. Approval records retain the real approver separately. Mutating tool summaries describe the exact target, proposed settings, selected records or recipients. Security connection changes declare `authority: "none"` because they change encrypted native configuration records, not a person's or agent's standing authority. Their closed schemas, record effect and ordinary policy/audit checks still apply; no authority subject is invented. Changes with a real subject retain self-widening refusal.

## Families outside this declaration

| Undeclared family | Boundary |
| --- | --- |
| queuedLifecycle | Invitation launch and per-recipient dispatch, reminders, scheduled sends, mail/digest replay, queued analysis requests/retries and other deferred agent effects remain unregistered. Native queue code is unchanged. |
| mailEdges | Invitation and confirmation mail beyond Base's built-in sending adapters is not offered as an agent action. |
| events/subscriptions | The built-in `pencil.events.list` reads retained visible events. No additional seed-event/subscription family is declared. |
| multi-sponsor | No second-sponsor agent admission or escalation family is declared. Current Business membership still governs all principals and named human approvals. |
| resource refresh | Existing readers keep their native visibility; refresh/subscription lifecycle is not declared. |
| timedLifecycle | No agent scheduling, delayed expiry or time-driven continuation family is declared. |
| dualHost | No second host or separate agent dispatcher is offered. |
| ownerNativeAdministration | Operator invitation/provisioning, role and authority changes stay in the existing native person lifecycle. Pencil's equal-owner invitation cannot be replaced with a fabricated lower role. |

Native business settings such as retention, sending windows, notification preferences and analysis policy are saved synchronously. Later ordinary business automation uses those settings under its own native lifecycle; these tools do not dispatch queued agent work. Retention preserves owner authorization, native revision checks, legal hold and the complete seven-day notice/grace period.

Personal effectiveness verdicts, task-payload confirmation, finding review decisions, contact consent renewal, personal notes and read acknowledgements remain native person acts. The agent never records them as if its sponsor had personally made them. Provider task confirmation is synchronous, but it writes a human confirmer before sending; it is excluded for that native confirmation boundary, not mislabeled as a queued operation or a Base network-hook gap. Cookie-bound downloads, bearer report sharing, device/session capabilities, connector proof and import/apply/undo retain their supported native doors. Owner-reviewed public pages, branding and navigation are outside this adoption's source changes.

The partial Agent clauses remain partial. Queued, mail, event, timed and owner-administration obligations are not completed by exposing the synchronous subset.

## Provider connections and verification

Connection readers report readiness without returning keys or contacting a provider. `configure_analysis`, `configure_task`, `remove_analysis` and `remove_task` have the server-computed security class and require the native owner. Summaries identify provider origin/model and the native connection without a credential. Saving configuration sends no respondent data and performs no connection test.

Study generation and requested draft rewrites use the installation's real AI connection, native validation and attribution. The registry declares no provider cost; the journey declares `spend: {none: true}`. Shared spend caps are not enforced. A missing or broken provider remains unavailable. The isolated verification edge is the exact OpenAI origin; it validates native payloads and returns realistic receipts. Fixture evidence proves application/protocol behavior, not provider quality or live delivery.

Verification establishes the owner through the real signed `/auth/owner-claim` lifecycle and prepares records through native person/public APIs. It never writes fixture records directly to the database or installs a verification-only production route. Every declared tool/class pair has a journey call, a native read-only witness, replay and injection checks. Native person calls prepare independent phase data; they grant no authority to agent calls.

Backups retain agent audit, event and idempotency history. Signed policy, Business identity bindings, pending approvals/reviews and active agent registration are excluded. Restoring data cannot execute held work; establish current identity and policy again.
