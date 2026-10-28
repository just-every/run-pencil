# Company agents

Pencil serves its shared MCP door at `/mcp`. Discovery supports MCP 2026-07-28 and 2025-11-25. The canonical resource metadata is `/.well-known/oauth-protected-resource/mcp`. Signed-in operators can open `/agents` to inspect decisions, reviews and local Pause.

The current registry supports private form preparation:

| Tool | Native job | Class |
| --- | --- | --- |
| `pencil.forms.list` | List workspace forms | standard |
| `pencil.forms.read` | Open the current editable draft | standard |
| `pencil.forms.templates` | Read the template gallery | standard |
| `pencil.forms.create` | Create a private draft, optionally from a gallery template | standard |
| `pencil.forms.duplicate` | Copy a form into a new private draft | standard |
| `pencil.forms.edit` | Edit one draft question at the current native version | standard |
| `pencil.forms.preview` | Evaluate a draft path without collecting a response | standard |
| `pencil.workspace.read` | Read the saved form workspace | standard |
| `pencil.events.list` | Read retained visible events | standard |

Form jobs require `pencil:forms`; events require `events:read`. `pencil://forms/{id}` reads the native draft under the same person visibility and company read policy. Form text is untrusted. Missing and inaccessible forms have the same result.

Writes require an `idempotency_key`. Reusing it with different arguments conflicts. `expected_revision` can bind a write to the draft version returned by `pencil.forms.read`. Native version conflicts keep the saved draft unchanged. A duplicate's editable copy has new native record IDs. An omitted slug receives a fresh `study-` address. No draft operation publishes it.

Business sends signed settings to `/api/rer/business-settings` and signed company policy to `/api/rer/agent-policy`. An access token's subject binds through the settings owner's `owner_id` or an existing teammate's Business `id`, then through Pencil's current authentication link to its product operator ID. Token email does not select an account. Removal, inactivity or a missing native link denies access. Existing accounts remain in their native workspace.

Pencil currently has equal native operators. Team reconciliation binds existing accounts and creates no new owners or shadow people. The native setup owner maps to Business owner; an existing signed-roster admin maps to policy editor; a roster member has no policy-editing role. Local promotion does not confer Business policy authority. Existing respondent, import, provider-callback and installation credentials retain their own purposes.

The company chooses the disposition for every declared class. Missing policy, unanswered classes, expiration, blocked policy and Pause refuse agent work. Review and approval use Base's person doors; an agent token cannot act as a person's decision. Draft history identifies the agent for its sponsor, and real approvers remain separate from the preparer. Private reads and refusals are retained in the door audit.

Publication, invitations, analysis/provider requests, payments/refunds, integrations, response changes, authority management and action verdicts are outside this initial registry. They remain available through their existing native doors. The native study-to-action workflow is not yet completely exposed to company agents. Scheduled delivery additionally needs durable consent and scope custody at its final admission; the current shared callback and embedded-invoke API do not carry that consent. No queued agent execution or substitute provider implementation is shipped here.

The registry declares no provider cost and reaches no outbound provider, so its conformance journey needs no network-edge module. The shared door does not enforce provider spend caps. Import preview/apply/undo remains the reviewed import door; respondent, browser and device interactions keep their own native admission.

Backups retain agent audit, event and idempotency history. Signed policy, Business identity bindings, pending approvals/reviews and active agent registration are excluded. After restoration, establish current identity and policy again; restoration cannot execute held work.
