# Company agents

Pencil serves its shared MCP door at `/mcp`. Discovery supports MCP 2026-07-28 and 2025-11-25. The canonical resource metadata is `/.well-known/oauth-protected-resource/mcp`. Signed-in operators can open `/agents` to inspect decisions, reviews and local Pause.

The current registry supports native form preparation, Study Studio and form publication under company policy:

| Tool | Native job | Class |
| --- | --- | --- |
| `pencil.forms.list` | List workspace forms | standard |
| `pencil.forms.read` | Open the current editable draft | standard |
| `pencil.forms.templates` | Read the template gallery | standard |
| `pencil.forms.create` | Create a private draft, optionally from a gallery template | standard |
| `pencil.forms.duplicate` | Copy a form into a new private draft | standard |
| `pencil.forms.edit` | Edit one draft question at the current native version | standard |
| `pencil.forms.add_question` | Add a private draft question or screen | standard |
| `pencil.forms.duplicate_question` | Duplicate a draft question | standard |
| `pencil.forms.remove_question` | Remove a draft question | standard |
| `pencil.forms.reorder` | Reorder the current draft screens | standard |
| `pencil.forms.branches` | Replace the native draft branch graph | standard |
| `pencil.forms.publish` | Publish the current validated draft | external, live |
| `pencil.forms.close` | Close a published form | external, live |
| `pencil.forms.reopen` | Reopen a closed form subject to its native deadline and target | external, live |
| `pencil.forms.archive` | Archive a draft or published form while retaining history | standard for drafts; external, live for published forms |
| `pencil.results.read` | Read the current published results | standard |
| `pencil.studies.list` | Read preparation options and provider readiness | standard |
| `pencil.studies.generate` | Generate and validate an editable private study using the configured provider | standard, external |
| `pencil.studies.read` | Read the saved plan, advisory flags and calculated sample size | standard |
| `pencil.studies.update` | Save the study plan at the native draft version | standard |
| `pencil.forms.preview` | Evaluate a draft path without collecting a response | standard |
| `pencil.forms.settings` | Save private form settings through native validation | standard |
| `pencil.forms.layout` | Save a native private page or group layout | standard |
| `pencil.contacts.list` | Read native contacts | standard |
| `pencil.segments.list` | Read saved segments and current matching counts | standard |
| `pencil.analyses.list` | Read native runs and recorded provider usage | standard |
| `pencil.analyses.options` | Read current published revisions and eligible questions | standard |
| `pencil.actions.list` | Read accountable actions | standard |
| `pencil.responses.list` | Read the filtered native response ledger | standard |
| `pencil.results.questions` | Read native question reports | standard |
| `pencil.results.compare` | Compare native published revisions | standard |
| `pencil.deliveries.list` | Read actual invitation and reminder outcomes | standard |
| `pencil.collectors.list` | Read native collectors | standard |
| `pencil.settings.read` | Read native workspace settings | standard |
| `pencil.operators.list` | Read the native equal-operator roster | standard |
| `pencil.workspace.read` | Read the saved form workspace | standard |
| `pencil.events.list` | Read retained visible events | standard |

Form and result jobs require `pencil:forms`; Studio jobs require `pencil:studies`; events require `events:read`. `pencil://forms/{id}` reads the native draft under the same person visibility and company read policy. Record list tools use their named area scope (`pencil:contacts`, `pencil:segments`, `pencil:analyses`, `pencil:actions`, `pencil:responses`, `pencil:results`, `pencil:deliveries`, `pencil:collectors`, `pencil:settings`, or `pencil:operators`). Resources also expose native revisions, released responses, contacts, analyses, visible findings, actions and deliveries under those same area scopes; revision resources use `pencil:forms`. Form and external record text is untrusted. Missing and inaccessible forms have the same result.

Writes require an `idempotency_key`. Reusing it with different arguments conflicts. `expected_revision` can bind a draft write to the native draft version returned by `pencil.forms.read`. Lifecycle writes accept its opaque `lifecycleRevision`; Study Studio updates accept the version from `pencil.studies.read`. Native version conflicts keep the saved draft unchanged. A duplicate's editable copy has new native record IDs. An omitted slug receives a fresh `study-` address. No draft operation publishes it.

Business sends signed settings to `/api/rer/business-settings` and signed company policy to `/api/rer/agent-policy`. An access token's subject binds through the settings owner's `owner_id` or an existing teammate's Business `id`, then through Pencil's current authentication link to its product operator ID. Token email does not select an account. Removal, inactivity or a missing native link denies access. Existing accounts remain in their native workspace.

Pencil currently has equal native operators. Team reconciliation binds existing accounts and creates no new owners or shadow people. The native setup owner maps to Business owner; an existing signed-roster admin maps to policy editor; a roster member has no policy-editing role. Local promotion does not confer Business policy authority. Existing respondent, import, provider-callback and installation credentials retain their own purposes.

A pending native invitation cannot sponsor work. After the person confirms it, a newer signed roster can establish that account's first native binding. An established binding continues to use its native ID when an email changes.

The company chooses the disposition for every declared class. Missing policy, unanswered classes, expiration, blocked policy and Pause refuse agent work. Review and approval use Base's person doors; an agent token cannot act as a person's decision. Draft history identifies the agent for its sponsor, and real approvers remain separate from the preparer. Private reads and refusals are retained in the door audit.

Invitations, response analysis, payments/refunds, provider connection tests, other connector configuration, response changes, authority management and action verdicts are outside this registry. They remain available through their existing native doors. The native study-to-action workflow is not yet completely exposed to company agents. Scheduled delivery additionally needs durable consent and scope custody at its final native admission. The copied door supports consent on embedded invocation; each native queue must retain and recheck it before agent scheduling can be exposed. No queued agent execution or substitute provider implementation is shipped here.

The registry declares no provider cost. Study generation uses the installation's existing AI connection and native validation; absent or broken configuration remains unavailable. The conformance journey configures that connection through the native person API and uses a declared isolated OpenAI network edge. It proves native request/response handling, not provider quality or live availability. The shared door does not enforce provider spend caps. Import preview/apply/undo remains the reviewed import door; respondent, browser and device interactions keep their own native admission.

Backups retain agent audit, event and idempotency history. Signed policy, Business identity bindings, pending approvals/reviews and active agent registration are excluded. After restoration, establish current identity and policy again; restoration cannot execute held work.

Native provider-setting changes remain on the person API and are not in this registry.

## Provider connection tools

`pencil.connections.read_analysis` and `pencil.connections.read_task` report native readiness without returning keys or contacting a provider. The matching `configure_analysis`, `configure_task`, `remove_analysis` and `remove_task` tools require `pencil:connections` and the current native installation owner. Their class is always `security`, computed by the server. They save or remove an encrypted connection record and change no person's or agent's authority. Approval summaries name the connection, provider origin and model without a credential. Saving a connection does not test it or send respondent data. A later provider operation retains its separate policy and native checks.

Record-bound form changes and connection changes resolve their native target before policy decisions and approval; an argument or resource link cannot establish that identity. The witness also reads connection record identities and update times without reading encrypted contents.

Pencil's equal-operator invitation grants native owner authority. Base's delegated administration currently refuses owner invitations and owner-role changes. The agent registry does not replace that refusal with a lower role, a fabricated person session or a direct database grant. Invitations and authority changes still require the existing person lifecycle.
