# Results, review and exports

Every published flow has a results page. It shows what people answered, how many started and finished, every individual response, and the downloads. None of it needs AI. This page also covers the review queue for suspicious submissions, erasing a response, and the email you can get for each new response.

To open it, choose **Results** on a flow's card, or **Results** in the builder once the flow is published.

## Read the answers

Results open on **Answers**, with one block for each question in the order of your flow. What a block shows depends on the question type:

- Every question shows how many answers it got.
- Choice questions show how many people picked each option as a count and a percentage of the answers to that question. A multiple-choice question can add up to more than 100%, because people can pick several, and it says so.
- Ratings show the **Average rating**. NPS shows the **NPS** score with **Promoters**, **Passives** and **Detractors**. Numbers show the minimum, median and maximum. Dates show the earliest and the latest. Priority questions show each option's average position.
- Text answers are listed newest first. Use **Search answers** to find a word, and **Show more answers** to keep reading.

Under each question, **How we count** explains the numbers. Every percentage names the numbers behind it, and it only counts people who answered that question. A question with no answers yet says so instead of showing a blank.

To act on what a question shows, choose **Turn this into an action** under it, or **Turn these results into an action** for the whole revision. The action keeps a copy of these counts. See [Actions and follow-up](actions.md).

Use **Published revision** at the top to look at the current revision, an older revision or **All published revisions**. This selector combines with the response filters below and applies to the summary cards, answer summaries, device split, ledger and exports. Each published question version keeps its own answers and labels. When a flow has more than one revision, **Compare revisions** shows each question side by side. It never treats a question added later as unanswered by people who answered an earlier revision.

## Starts, completion and drop-off

Below the answers are four cards:

| Card | What it counts |
|---|---|
| **Responses** | Completed responses that have been released into results, split into live and imported. |
| **Starts** | Recorded first interactions with the form in the revision and date selection; just opening the page is not a start. With a response-only filter, this counts matching native responses, including retained quarantine, instead. |
| **Completion rate** | Native completed responses divided by views in the revision and date selection. With a response-only filter, this becomes started-to-completed among matching native responses, including retained quarantine in the denominator. Both counts are shown; a zero denominator shows **No rate**. |
| **Average time** | How long live responses took to complete. |

Imported responses (see [Moving in](moving-in.md)) count in the answers and the ledger. They do not count towards starts, completion rate or average time.

**Starts by device class** splits starts into mobile, tablet and desktop. Under each question, a line such as **3 distinct sessions reached · 1 expired sessions ended here** shows drop-off: how many sessions got that far and how many stopped there.

Pencil counts that a session started and how far it got. It never keeps what someone typed in a form they abandoned, so those partial answers cannot be read, counted or exported.

## Views and start rate

**Views to submissions** shows views, starts and accepted submissions by published revision, source and day. Its source and date filters change each numerator and denominator together. A named collector lets you distinguish a QR poster, campaign link or an embed in your website's popup. Start rate is starts divided by views; completion rate is accepted submissions divided by starts.

Views are anonymous aggregate counts, recorded separately from starts and accepted submissions. Reloads and open saved-resume documents count as views; previews, unavailable forms and completed receipts do not. A resume keeps its original revision and source and does not create another start. Earlier traffic cannot be reconstructed.

Bot checks run only when a response is submitted. A signed form-load timestamp measures elapsed time without storing a visitor or view record. Quarantine, release and erasure change accepted submissions; they never revise aggregate views or starts. A newly opened resume page uses its own load time.

## The response ledger

**Response ledger** lists every completed, released response. Choose **View answers** on one to see its revision, when it started and was submitted, who it came from (an invited person or an anonymous response), and each answer beside its question. Questions that person skipped are shown as **Not answered · skipped or optional**. Answers stay linked to the question and revision that asked them, even after you edit or delete the question.

Narrow the list with these filters. They combine with **Published revision** and apply to the summary cards, answer summaries, device split, ledger and exports. Traffic, crosstabs and trends have their own controls:

- **Source**: **Direct link**, **Embed**, **Invitation** or **Imported**. Responses recorded by an earlier runtime may show **Historical source unavailable**.
- **Participant status**: **Eligible** or **Opted out**, for responses from invited people. The list also offers **Bounced**, but it always shows nothing in this release, because Pencil receives no bounce reports from your mail provider.
- **Submitted from** and **Submitted through**, as dates in your workspace time zone.
- **Structured question** with **Answer contains / equals**, to find everyone who gave a particular answer.

## Export responses

Choose **Export JSON** or **Export CSV** to download the responses that match your current filters. Pencil fixes a cutoff time when you start, so the file holds exactly the matching responses committed by then. When it finishes it tells you how many were exported and how many quarantined responses were left out.

- The file is named `pencil-responses-` followed by the cutoff time, ending in `.json` or `.csv`.
- **CSV** has one row per response with these columns: `response_id`, `revision_id`, `revision_number`, `source`, `started_at`, `completed_at`, `released_at`, `participant_json`, `answers_json`, `cutoff`, `excluded_quarantined`, `omitted_questions_json`.
- **JSON** has the cutoff, the filter you used, the number of quarantined responses excluded, and a `responses` list with the same information.
- Answers are keyed by stable question IDs and include the question's label. Open-text answers are kept in full.
- Quarantined responses are never included until you release them.

Downloads stream through your browser's service worker, so they need a modern browser on HTTPS or on `localhost`. If a response changes while a download is running, the download stops with a message instead of giving you a mixed file. Refresh and start again.

A response export is a working copy of the answers, not a backup. For a product-data backup, excluding credentials, sessions and private settings, see [Backup and restore](backup.md). The rer archive commands use local state. Hosted D1 recovery uses a separate script, requires all writers stopped and a separately provisioned empty migration-only target.

## Review suspicious submissions

Pencil protects public forms without a CAPTCHA and without loading anything from outside your installation. It uses a hidden field that real people never see, a minimum time between loading the form and submitting, a token tied to each session, and per-address rate limits. A person filling in a form at a normal pace stays well inside them, though many people sharing one address, such as an office network, can reach the per-address limits together.

- A submission that **fills the hidden field** is saved complete but quarantined with the hidden-field reason. The sender sees the normal completion screen. An operator can release or delete the retained answers.
- A submission that arrived **faster than a person could fill it in** (under the configured minimum time after loading the form) is saved complete but quarantined. It is kept out of accepted-response counts, results and response exports.

Quarantined responses appear in **Quarantined responses**, under **Human review**. Each shows when it arrived, the reason, and its answers. Choose **Release into results** to make it an ordinary response from that moment, with every figure updated. Choose **Delete quarantined response** and then **Confirm deletion** to remove it for good. You can release one even after the flow has closed, and releasing never reopens the flow. Nothing leaves quarantine until an operator acts on it, and Pencil never deletes one on its own.

## Erase a response

Open a response in the ledger with **View answers**, choose **Erase response**, then **Confirm erasure**. Pencil removes the response and all its answers, and updates your totals and answer reports. Anonymous start and device counts remain, because they cannot be traced to anyone. Only an anonymous record that an erasure happened is kept. To remove an invited person and everything they gave, use **Erase contact and responses** in [Invitations, reminders and consent](invitations.md#opt-outs-and-consent).

## Get an email for new responses

At the bottom of the results page, **Response notifications** lets each operator choose whether to be emailed about new completed responses on that flow.

- Under **Email me about completed responses**, choose **Immediately**, **Daily** or **Off**. Your choice applies only to you and only to this flow.
- **Immediately** queues one notice after each new released response. The scheduled Worker dispatches it; it is not sent inside the respondent's request.
- **Daily** starts a new interval when you enable it, without historical mail. At the daily sending window's opening in your workspace time zone, Pencil groups the interval's new released responses into one digest. The panel shows the opening time, time zone and next cutoff. A day without new responses sends nothing.
- When you publish a flow and have not chosen yet, it is set to **Immediately** for you. It starts at **Off** for every other operator, and for flows that were published before this feature existed and have not been published again.
- The email names your business and flow and links to results, which need a sign-in. An immediate notice shows the submission time; a digest shows its day, cutoff and response count. Neither carries answers or respondent details.
- A response in quarantine sends nothing until you release it. Imported and historical responses never send email.
- **Recent notification deliveries** shows each attempt. Use **Refresh delivery status**, and **Retry** on a failed one. For one whose outcome is unknown, **Send again** asks you to confirm, because it might email you twice.
- A failed digest keeps its original day and interval when retried; it is not merged into the next day. Switching away from Daily cancels pending digests. Enabling Daily again starts from that moment, and restored digest history cannot be resent.

On Managed hosting, emails use RER's assigned verified relay sender automatically. With SendGrid or Resend, emails come from your no-reply sender address (`MAIL_FROM`): if it is not a plain `noreply@` or `no-reply@` address, collecting responses and sign-in email carry on but this page says why response notification mail is off. Analysis outcomes have their own [in-app notifications](analysis.md#analysis-notifications), separate from these email choices.

## Organize open text with codes

In Results, **Organize feedback with codes** lets you create a workspace vocabulary and assign several codes to each retained text answer or Other write-in. Remove a code with its × button. Coding history records who assigned it and whether it was manual or an accepted AI suggestion.

Validated analysis themes supply exact quoted suggestions. Choose a workspace code and **Accept**, or **Reject** to leave the answer uncoded. Manual coding needs no AI connection. Withheld or redacted findings never supply visible suggestions; erasure withdraws affected AI coding while unrelated manual assignments remain.

The distribution chart counts coded answers against all nonempty text answers in the current ledger filters, and also names the response count. One answer can have several codes, so shares can total more than 100%. Choose two codes for a crosstab of their presence or absence in each released response. The code filter applies to the ledger, downloads and coding reports together. It does not change the revision summary.

Response exports omit automated bot-check and minimum-time exclusions by default. **Include automated exclusions in exports** adds those retained answers to CSV or JSON with their quarantine state and reason. This does not release them, change results or send notifications. Any change to selected evidence during a download stops it; refresh and start again.

## Send response events to your own system

The installation owner can register HTTPS endpoints in **Settings → Response webhooks**, for one form or for every form in the workspace. Pencil sends a signed message when a response is created (a quarantined response only when you release it), when a response is erased, when a respondent saves a partial response to resume later, and when a payment on a response changes state. The events for an edited response and for an approval decision cannot be sent yet, because Pencil has no edit-after-submission or approval step.

**Messages carry identifiers only.** The body names the event type and ID, the form, the revision and the response, plus the payment state for payment events. It never carries answers, names, email addresses or other contact details. A receiver that needs the answers reads them through Pencil's signed-in results or the authenticated export.

Each delivery is one `POST` with a JSON body and these headers:

- `Pencil-Event-Id`: the event ID, the same on every retry and replay. Keep the IDs you already handled and ignore repeats.
- `Pencil-Event-Type`: `response.created`, `response.deleted`, `response.partial_saved` or `payment.changed` (`webhook.test` for the **Send test event** button).
- `Pencil-Timestamp`: when this attempt was sent, in Unix seconds. The same moment is in the body as `sentAt`. Reject an attempt older than five minutes.
- `Pencil-Signature`: `sha256=` followed by the hexadecimal HMAC-SHA256 of the exact request body bytes, keyed by the endpoint's signing secret (its UTF-8 bytes). Compute it over the raw body before parsing it, and compare in constant time.

Answer with any `2xx` status to confirm the event. Any other answer, a timeout of ten seconds or a connection failure counts as a failed attempt. Pencil follows no redirects and ignores the response body. A failed event is tried again with growing waits (1, 5, 15 and 30 minutes, then 1, 2, 4, 8, 16 and 24 hours after the first attempt) with the same event ID, then marked failed. Every attempt is recorded with its reason under the endpoint's **Deliveries**, and **Replay this event** sends a delivered or failed event again.

The signing secret is generated by Pencil, shown once when you add or rotate the endpoint and never again, and is excluded from backups; a restored endpoint comes back without a secret and sends nothing until you rotate a new one. If no event is confirmed for 24 hours across at least ten failed attempts, Pencil disables the endpoint, shows an alert on every operator page and keeps queueing events until you fix the receiver and resume it. A failing endpoint never blocks or slows collecting responses. A paused endpoint receives nothing; events that happen while it is paused are not queued.
