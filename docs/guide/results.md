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

Use **Published revision** at the top to look at an older revision. When a flow has more than one revision, **Compare revisions** shows each question side by side. It never treats a question added later as unanswered by people who answered an earlier revision.

## Starts, completion and drop-off

Below the answers are four cards:

| Card | What it counts |
|---|---|
| **Responses** | Completed responses that have been released into results, split into live and imported. |
| **Starts** | Visits where someone first interacted with the form (**recorded starts**). Just opening the page is not a start. |
| **Completion rate** | Live completed responses divided by starts, with both numbers shown. |
| **Average time** | How long live responses took to complete. |

Imported responses (see [Moving in](moving-in.md)) count in the answers and the ledger. They do not count towards starts, completion rate or average time.

**Starts by device class** splits starts into mobile, tablet and desktop. Under each question, a line such as **3 distinct sessions reached · 1 expired sessions ended here** shows drop-off: how many sessions got that far and how many stopped there.

Pencil counts that a session started and how far it got. It never keeps what someone typed in a form they abandoned, so those partial answers cannot be read, counted or exported.

## The response ledger

**Response ledger** lists every completed, released response. Choose **View answers** on one to see its revision, when it started and was submitted, who it came from (an invited person or an anonymous response), and each answer beside its question. Questions that person skipped are shown as **Not answered · skipped or optional**. Answers stay linked to the question and revision that asked them, even after you edit or delete the question.

Narrow the list with these filters. They apply to the ledger and to exports, not to the cards above:

- **Response revision** and **Source**: **Direct link**, **Embed**, **Invitation** or **Imported**. Responses recorded by an earlier runtime may show **Historical source unavailable**.
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

A response export is a working copy of the answers, not a backup. For a complete backup, see [Backup and restore](backup.md).

## Review suspicious submissions

Pencil protects public forms without a CAPTCHA and without loading anything from outside your installation. It uses a hidden field that real people never see, a minimum time between starting and submitting, a token tied to each session, and per-address rate limits. A person filling in a form at a normal pace stays well inside them, though many people sharing one address, such as an office network, can reach the per-address limits together.

- A submission that **fills the hidden field** is treated as a bot. The sender is shown the normal completion screen, but nothing is saved, and Pencil keeps a private note that it happened. It contains no answers.
- A submission that arrived **faster than a person could fill it in** (under 3 seconds after starting) is saved complete but quarantined. It is kept out of every count, result and export.

Quarantined responses appear in **Quarantined responses**, under **Human review**. Each shows when it arrived, **Defence:** and the reason, and its answers. Choose **Release into results** to make it an ordinary response from that moment, with every figure updated. Choose **Delete quarantined response** and then **Confirm deletion** to remove it for good. You can release one even after the flow has closed, and releasing never reopens the flow. Nothing leaves quarantine until an operator acts on it, and Pencil never deletes one on its own.

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
