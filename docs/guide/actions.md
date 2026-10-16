# Actions and follow-up

An action turns what your results show into owned follow-through: a named person, a metric to move, a date to look again, and later a record of what actually changed. Pencil keeps the record. People decide what to do and whether it worked.

An action starts from a recommendation: one an operator writes by hand, linked to the results it rests on, or the recommendation of an [analysis](analysis.md), which an operator turns into an action and edits as their own. Either way a person owns it and decides whether it worked.

## Create an action

There are two ways in:

- On a flow's **Results** page, choose **Turn this into an action** under a question, or **Turn these results into an action** for the whole revision.
- Open **Actions** in the navigation and choose **New action**, then pick the flow, the published revision and, if you want, one question.

Fill in:

- **Title** and **Rationale**: the recommendation, in your own words.
- **Owner**: one of your workspace's operators.
- **Review date**: the day to look again, in the workspace time zone.
- **Target metric**: its name, its unit (such as `percent`), whether higher or lower is better, the baseline value, where the baseline came from, and when it was observed.

Do not paste respondent answers or names into the rationale. If you later create an external task, the rationale is sent with it.

Saving an action contacts no one. Action content leaves your deployment only after you confirm an external task, described below. The separate connection test sends fixed sample values when you choose **Send test task**.

### What the action keeps as evidence

When you save, Pencil copies the counts the results page showed at that moment: the revision's completed responses and starts, and for a question, how many sessions reached it, how many answered, and the count for each option with the number of answers it is out of. These figures stay as they were, so the action keeps its evidence when later responses change the results.

An action never stores response IDs, answer text or excerpts, typed numbers or dates, or a filter that picks out a small group. That keeps actions out of response and contact erasure entirely: erasing a respondent never needs to touch an action, and an action never points back at a person. Counts are copied only as the whole revision shows them, never for a filtered group.

## The lifecycle

A new action is **Planned**. It moves only along these steps, and Pencil refuses anything else:

| From | To |
|---|---|
| Planned | In progress, Closed |
| In progress | Ready for review, Closed |
| Ready for review | Effective, Ineffective, In progress, Closed |
| Effective | Closed |
| Ineffective | Closed |

Every move records who made it, when, and an optional note. Changes to the title, rationale, owner, metric or review date are recorded in the same history. An action that is Effective, Ineffective or Closed can no longer be edited, so its measured record stays as it was reviewed. A closed action stays closed.

## Measure, then decide

When the review comes round, open the action and record an observed value under **Follow-up measurement**: pick the later flow, and optionally the revision, enter the value and when it was observed. It must use the same unit as the baseline; a different unit is refused so the two stay comparable. Pencil then shows the difference from the baseline and whether it moved in the direction you wanted.

From **Ready for review**, you mark the outcome **Effective** or **Ineffective**. That verdict is yours. Pencil never sets or changes it: no scheduled job, setting or extension writes it, and recording a measurement does not decide it.

When the review date arrives, the action shows **Review due** on the Actions page, on the action itself and on the flow dashboard, until it gets a verdict or is closed. Nothing else happens: Pencil does not move, close or judge the action for you.

## External tasks

You can send an action to your own task system as a task. This is optional. Without it, everything above works.

### Connect your receiver

A webhook is the address Pencil sends a confirmed action to. Pencil includes a custom webhook receiver connection, rather than built-in Jira, Asana or other vendor integrations. You or your developer run the receiver and connect it to your task tool. The tool's website address or ordinary API key alone does not implement this contract.

Open an action and find **External task → Connection**, which is visible even before a connection is configured. Ask your receiver's administrator or developer for its endpoint URL and bearer key. To build a receiver, create an HTTPS route that accepts POST requests, checks a secret bearer key you choose, and implements the request and response contract below. The complete contract is also on the action page, under **Receiver contract and complete request example**, so you can set up the connection without leaving that page.

1. Enter the receiver's **Endpoint URL** and **Bearer key**, then choose **Save connection**. Use HTTPS without credentials, a query or a fragment in the URL. HTTP is allowed only on loopback addresses in local development and tests.
2. Choose **Send test task**. This creates or retrieves a real sample named **Pencil connection test** at the saved connection using fixed example values and a link to your installation's Actions page, with no respondent answers, operator details or content from your action. The page shows the returned task ID or an error. Repeating the test uses the same key and should return the same sample task; delete it in your task tool afterward.
3. Once the test succeeds, use **Create external task** to review your actual action before sending it.

Only the installation owner can save, reset or test the connection. Saving never sends a task. Saved settings override deployment settings for the whole workspace. The key is never displayed again; enter it each time you save, including when changing the URL. Credentials are encrypted in the installation and excluded from backups. After restoring a backup, reconnect the receiver. **Use deployment settings** removes the saved connection and uses the deployment's configuration instead. It does not delete tasks already created in your tool.

Pencil charges no integration fee. Your receiver's hosting and your task tool may have their own costs.

### Deployment settings

As an alternative to saving the connection on the action page, set these on your deployment, all as Worker secrets so a later deploy keeps them:

| Variable | What it is |
|---|---|
| `TASK_PROVIDER` | `webhook`, the only adapter included. |
| `TASK_WEBHOOK_URL` | Your receiver's `https` URL. Plain `http` is accepted only for a loopback receiver in local development and tests. |
| `TASK_API_KEY` | A secret your receiver checks. |

Without either a saved connection or all three deployment settings, **Create external task** is disabled. The visible **Connection** form lets you configure it there.

### What leaves, and when

Choosing **Create external task** shows the confirmation screen: the exact JSON that will be sent, and nothing else. It holds the action's title, rationale, owner name and email, metric with its baseline, review date, and a link to the action in Pencil that needs an operator sign-in to open. Raw answers, excerpts and evidence figures are never included. Only after you choose **Confirm and send** does this action content leave, and only those confirmed values. **Send test task** is a separate explicit request that sends fixed sample content.

If the action changes after you confirmed and before the task is delivered, Pencil refuses to send the old confirmation and asks you to review and confirm again.

### The webhook contract

Pencil sends one `POST` to the saved endpoint URL, or `TASK_WEBHOOK_URL` when using deployment settings:

- `Authorization: Bearer <your bearer key>`. The receiver gets the key only in this header, never in the URL or payload. Saved credentials are encrypted; the plaintext key is never returned to the browser, written to audit entries or logs, or included in an export.
- `Idempotency-Key: pencil-action-<action ID>`. The same key is in the body as `idempotencyKey`. One action has one key for its whole life.
- `Content-Type: application/json` and `Accept: application/json`, with this body (fictional example values):

```json
{
  "idempotencyKey": "pencil-action-example-action-id",
  "action": {
    "title": "Shorten the wait at the counter",
    "rationale": "Most visitors said the wait was too long.",
    "owner": { "name": "Sam Rivera", "email": "sam@example.com" },
    "metric": { "name": "Visitors saying the wait was short", "unit": "percent", "direction": "increase", "baseline": { "value": 33, "source": "Revision 1 results", "observedAt": "2026-10-12T09:00:00.000Z" } },
    "reviewDate": "2026-12-01",
    "reportLink": "https://forms.example.com/app/actions/example-action-id"
  }
}
```

Your receiver must honour this contract:

- **Check the bearer key.** Reject requests that do not present your expected secret.
- **Create or get by key.** The first request with a key creates one task. Every later request with the same key returns that same task and creates nothing. Store the key-to-task mapping atomically, including for simultaneous requests.
- **Answer `2xx` with `{"taskId": "<your task ID>"}`.** The ID is 1 to 200 visible ASCII characters with no spaces. For example, return HTTP 201 with `{"taskId":"TASK-123"}` on creation, then HTTP 200 with `{"taskId":"TASK-123"}` for every request repeating the same key. Pencil reads nothing else from the answer.
- **Do not redirect.** Pencil does not follow redirects; a `3xx` counts as failed.
- **Reply within 10 seconds with at most 16 KiB.** A timeout, lost connection or invalid response leaves the outcome unknown because the task may already exist. Use the same key to retrieve that task on retry.

Test requests use the same payload shape with fixed sample values and the stable key `pencil-connection-test-<workspace ID>`, separate from real action keys. Repeating a test should return the same sample task ID, exercising create-or-get. Tests do not change an action's delivery history or confirm it for sending.

### Delivery states

| State | Meaning | What you can do |
|---|---|---|
| Pending | Confirmed and being sent. | Wait. A second click or tab cannot start another attempt. |
| Confirmed | Your receiver returned a task ID, shown on the action. | Nothing more is sent for this action. |
| Failed | Your receiver answered with an error (`4xx`, `5xx`) or a redirect. | The action stays as it is. **Retry with the same key**. |
| Unknown | The connection ended or timed out after the request was sent, or the answer had no task ID. The task may exist. | **Retry with the same key**. Your receiver returns the task it already has instead of making a second one. |

Pencil records every attempt before it is made: when, by whom, the outcome and its class, the HTTP status, and the remote task ID when there is one. Nothing else from the answer is kept. Pencil never retries on its own, and never sends again under a new key.

## Backup and restore

Actions, their history, evidence figures, measurements, task deliveries and every attempt are part of the deployment export and come back exactly as they were. Saved connection credentials are encrypted and excluded from exports; deployment secrets are not exported either. Set up the connection again after restoration. Delivery idempotency keys are retained so a retry can still return the existing task. Restoring sends nothing: a delivery that was Unknown is still Unknown after restore, and nothing is sent until an operator chooses retry. See [Backup and restore](backup.md).
