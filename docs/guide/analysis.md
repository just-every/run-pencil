# Analysis

Analysis reads the completed answers to one published revision and groups them into themes. It is built so you can check every part of it: each count is recomputed by Pencil from the responses it names, each quote is an exact excerpt of a stored answer, and a theme with too few responses is never shown.

Analysis uses a language model you configure. The same provider powers the builder's [question rewrites](build-a-form.md#rewrite-a-question). AI is off until you set it up; requests leave only when you request an analysis or rewrite, or a flow closes with analysis turned on.

## What leaves, and where it goes

When an analysis runs, Pencil sends one request to the provider shown on the request screen (its origin, such as `https://api.openai.com`, and the model name). The request holds:

- the prompts of the questions you ticked;
- for each completed response in the analysis, its response ID and its answers to those questions.

Nothing else is sent: no contact names or emails, no answers to email questions or to questions you did not tick, no network addresses, devices or session data, and no workspace or operator details. By default only long text questions are ticked. A short text question is often a name, so it is sent only if you tick it.

For a draft rewrite, the provider receives the saved question text, selected rewrite style and the context you enter. It receives no response evidence. Do not put private respondent details in that context. Pencil shows the source beside the proposal and changes no wording until you choose **Accept and save wording**.

While AI is on, the **How your answers are used** note on your forms adds that, if you analyse feedback, a respondent's written answers may be sent to the AI service you chose, and that their name, email address and network address are never sent. With AI off the note does not mention it.

Pencil asks the provider not to store the request (`store: false`). What the provider keeps or logs under its own terms is outside Pencil's control; read your provider's data policy before you turn analysis on.

Answers are treated only as data. An answer that contains instructions ("ignore your instructions and…") cannot change settings, call your task webhook, create jobs or reveal anything: the provider can only return the analysis format below, and an answer in any other form fails.

## Turn analysis on

Open **Analysis → Provider → Connect analysis**. Choose **OpenAI**, create a key using the direct link on that page, and check API billing there. The OpenAI API address and `gpt-4.1-mini` model are filled in. Paste the key, choose **Save provider**, then **Test saved provider**. Only an installation owner can save or test connections. No restart or file edit is needed.

The test sends a fixed connection question and a small JSON schema, with no respondent data. It can incur a small API charge, checks structured Responses API support, and records its usage as `connection-test` in the table below. A failure explains what to check; it never reveals the provider's error body or your key. Set spending limits with the provider; optional token rates in Pencil only calculate displayed costs.

### Connect OpenRouter or another compatible provider

Choose **Other compatible provider**. OpenRouter is a self-serve service offering models from several providers through one account; its values are filled in when you choose this option.

1. Open [OpenRouter API keys](https://openrouter.ai/settings/keys), sign in or create an account, and create a key named Pencil. Set a spending limit and copy the key when shown.
2. Add credit under [OpenRouter credits](https://openrouter.ai/settings/credits). Check [GPT-4.1 Mini access and current pricing](https://openrouter.ai/openai/gpt-4.1-mini).
3. Use API base address `https://openrouter.ai/api/v1` and model identifier `openai/gpt-4.1-mini`. **Copy API address** and **Copy model** are available on the Pencil page. Paste the OpenRouter key in **Provider API key**.
4. Choose **Save provider**, then **Test saved provider**. Wait for **Connection passed** before sending responses. If it fails, check credit, key permissions and model access.

OpenRouter documents its [Responses API](https://openrouter.ai/docs/api/reference/responses/overview) and [strict JSON-schema output](https://openrouter.ai/docs/guides/features/structured-outputs); the latter means the answer must follow Pencil’s exact format. Other services must support both. A chat-only API or native Anthropic/Google endpoint is insufficient. Pencil tests your actual saved address and model; it never substitutes a different provider. Provider availability, billing and data policies are separate from Pencil.

### Connect an existing Models service

**Linked Models service** refers to the separate Models application your organization runs to share model access, control spending and issue cost receipts. The Models administrator holds the upstream provider keys. Pencil uses a dedicated **Models app key**, not an upstream provider key. There is no public Models signup or hosted Models account included with Pencil. If you do not have a Models service, choose OpenAI or OpenRouter above.

Enter your organization’s **Models service HTTPS address**. Pencil then shows direct **Providers**, **Routes** and **Apps** links to that service. An administrator can complete these steps there:

1. In **Providers**, add a provider key, verify its model catalogue and record its account data policies.
2. In **Routes**, add an exact model with Responses and strict JSON-schema support, confirm its prices, and copy the complete model name including provider prefix.
3. In **Apps**, create a Pencil app, approve that provider and model, set spending and request limits, and allow `analysis`, `draft-rewrite` and `connection-test`. Mint an app key permitting those features and copy it when shown.
4. Back in Pencil, paste the model name and **Models app key**, choose **Save provider**, then **Test saved provider**. Wait for **Connection passed**. Costs come from the service’s receipts; direct-key token-rate fields are hidden.

If someone else administers Models, ask them for the HTTPS address, allowed model name and dedicated app key with those three features enabled. A successful connection test proves key access and the required structured answer; it does not prove analysis quality.

Saved connections override deployment settings. Credentials are encrypted using this installation's session secret, never returned to the browser, and excluded from exports. Reconnect after restoring or changing `SESSION_SECRET`. **Use deployment settings** removes the saved override. Saving a connection enables analysis, including close-time analysis when its existing policy permits it; check the settings below before connecting.

### Configure through deployment settings instead

Set these on your Worker, as secrets or variables in the Cloudflare dashboard, alongside the others in [Hosting on Cloudflare](hosting.md):

| Variable | What it is |
|---|---|
| `AI_ENABLED` | `true` enables analysis and draft rewrites. Without it nothing is sent and requests explain what to set. |
| `AI_MODEL` | The exact model name your provider serves. |
| `AI_API_KEY` | A direct key for an OpenAI-compatible provider. A secret. |
| `AI_BASE_URL` | Optional, with a direct key: the provider's `https` base URL, such as an OpenRouter or Cloudflare AI Gateway address. OpenAI's `https://api.openai.com/v1` when unset. |
| `MODELS_SERVICE` and `MODELS_KEY` | Instead of a direct key: the address of a linked Models service and the app key it issued (a secret). Its receipts report each call's cost. |
| `AI_INPUT_USD_PER_MILLION_TOKENS` and `AI_OUTPUT_USD_PER_MILLION_TOKENS` | Optional, with a direct key: your provider's prices, so Pencil can show a cost per call. Without them the cost shows as not reported; Pencil never guesses it. |

Configure one transport: a direct key, or a Models service, not both. If both are set, or a URL is not `https`, the Analysis page says so and every request fails without being sent.

## Request an analysis

Open **Analysis** in the navigation and choose **Request analysis**. Pick the flow, the published revision and the questions to read. The screen shows where the answers would go before you send anything. Choose **Request analysis**: the run starts at once.

A run fixes its evidence when it starts: the completed, released responses of that revision at that moment. Responses held for review are not read until you release them. A response submitted or released later never changes the run; the run shows **Stale** with how many responses arrived after its evidence cutoff, and you can request a new one. Earlier runs stay in the list.

## Read the findings

A completed run shows:

- **Primary finding**: the theme supported by the most responses, with its count, its share of the responses read, and the provider's summary labelled **Analysis**. A summary is the model's wording, never a quote.
- **Quotes**: text in quotation marks is an exact excerpt of a stored answer. Pencil checks the exact characters against the answer before the run completes. **Response …** opens that response's retained answers; **See the responses** lists every response behind the theme.
- **Other themes**, ranked by how many responses support them.
- **Withheld themes**: a theme supported by fewer responses than the disclosure threshold (5 by default) shows no title, excerpt or breakdown, because a small group can identify people. A theme with exactly the threshold is shown. Withheld themes affect the analysis view; Results crosstabs use the same threshold for small cells. Answer summaries, the ledger and exports are unchanged.
- **Recommendation**: at most one proposed action, from the highest-ranked theme that can be shown, with the provider's rationale (labelled **Analysis**), confidence, expected impact and effort.
- **This run**: the questions read, where they were sent, the provider's reported usage and cost, and the policies the run used.

Pencil fails a run, and shows nothing from it, when the provider's answer is not in the required format, names a response outside the evidence, quotes text that is not exactly in the answer, or states a count that differs from the responses it names.

When the evidence cannot support a finding, the run completes as **Insufficient evidence** with the reason and its cutoff, and shows no theme, quote or recommendation. That happens without a provider call when fewer responses answered the selected questions than the disclosure threshold.

## Turn the recommendation into an action

Choose **Turn this into an action**. The **New action** page opens with the recommendation's title and rationale filled in and the analysed revision as its evidence. You choose the owner, the metric and the review date, edit the words as your own, and save. The action records that it came from this analysis. Saving contacts nobody, and you decide whether it worked; see [Actions and follow-up](actions.md).

## When it fails

If AI is off or misconfigured, a request fails at once with what to set, and nothing is sent. If the provider refuses (for example a wrong key), the run fails with a fixed error and a **Retry** button; the provider's own error text is never shown or stored. Publishing, collecting responses, results and exports keep working either way.

If the provider does not answer or is briefly unavailable, Pencil retries the same request, with the same evidence and policies, at most three times within ten minutes, on its scheduled minute. An answer that fails the checks above is never retried as a transport failure.

## Close-time analysis

With a provider configured, Pencil analyses a revision once when its flow closes, if it has at least 5 completed responses and a long text question. Turn this off, or change the minimum and the disclosure threshold, under **Settings** on the Analysis page. A change applies to new runs only; each run keeps the settings it used.

## Analysis notifications

The Analysis page's **Analysis notifications** lists completed, insufficient-evidence and failed runs for you. Your own requests notify you; automatic close-time runs notify each operator who has not muted them. **Mute automatic analysis notifications** affects only you and leaves your own request notifications on. Choose a run to read it, **Mark read** to acknowledge it, or **Refresh notifications** to update the list. These controls are separate from each flow's [response email preferences](results.md#get-an-email-for-new-responses).

## Cost

Every provider call records the provider, model, input and output tokens, feature (`analysis` or `draft-rewrite`), run or draft, and cost: the Models service's receipt, your rates times the usage, or "not reported". The Analysis page totals calls, tokens and cost by day in the current workspace time zone and by feature.

## Erasure, backups and restore

Erasing a response, or a recipient and their responses, removes it from every analysis: its evidence entry, its theme membership and its quotes. Text the provider wrote for a theme that included it is withheld, because it may describe the erased answer; the run shows that a response was erased afterwards.

Analyses travel in your [backups](backup.md). A restored analysis is never resent by itself: one that had not finished waits for you to choose **Retry**, and a restore makes no provider request.

## Try it locally

`rer dev` answers analysis requests with Base's local double, which cannot produce the structured answer analysis needs. A run there fails with `dev_fake_cannot_answer`; that is expected, not a fault. To make real requests on your computer, save an actual provider from **Connect analysis** on the Analysis page. That explicit connection uses the live provider and can incur charges even in local development. Removing it returns to deployment settings and the ordinary local double. A capped Models dev app can also be connected with its service address, key and allowed model. Set its cap and expiry in your own Models service.

The saved-provider test makes a real, potentially billable call. Local scripted-provider checks do not prove account access or live analysis quality.

Contradictions are analysis for you to review, alongside themes. Each side names its supporting responses and quotes exact retained answers; if either side has fewer responses than the run’s disclosure threshold, Pencil withholds the whole contradiction and shows only a withheld count. You can select numeric score questions explicitly as well as text; unselected answers stay in Pencil. Accept or dismiss a theme or contradiction to record your decision. Erasing a response removes contradictions from every analysis that read it. Comparisons across revisions, collectors and segments are not available yet.
