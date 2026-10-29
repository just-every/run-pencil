# Invitations, reminders and consent

Besides a public link, you can email a person their own link to a form. Pencil then knows which person answered. This page covers adding recipients, sending invitations, the automatic reminder, opt-outs, and what to do when an email does not go through.

## What to expect

Read these limits first:

- **Audience is shared across flows.** Add or edit contacts with custom fields, import a reviewed CSV, and save segments. Contacts admit up to 20 custom fields (keys up to 64 characters, values up to 500); names admit 200 characters and addresses 320. CSV imports admit 5,000 rows and 2 MiB. A revision admits up to 25,000 participants. These are enforced limits, not hosted capacity claims.
- **Mail has to work.** Invitations, reminders and sign-in links all go through your mail provider. See [Hosting on Cloudflare](hosting.md#set-up-email) for setting it up.
- **Delivery is shown honestly.** Pencil can tell you the provider accepted a message. It cannot tell you the message reached an inbox.

## Add a recipient

1. Open **Audience** in the operator navigation and choose **Add contact**.
2. Enter **Contact name** and **Contact email**, and add any custom fields.
3. Choose **Save contact**. Saving sends no mail. Use **Edit** beside a saved contact to change details. Email comparisons ignore case; an existing address is refused without changing either contact.

Search contacts by name or email across the whole audience, and use the previous/next controls to page through results. The screen labels the number on the loaded page, not an invented total. For CSV, choose a **Contact CSV file** or paste into **Uploaded CSV**. The header maps `name` and `email`, and an optional `time_zone` column takes an IANA time zone name such as `America/New_York` (leave a cell empty for none); other columns become custom fields. Choose **Preview contact import**, review each numbered row, then **Import reviewed contacts**. The final report distinguishes added, matching, updated, invalid and over-limit rows. Case variants and repeats within the file match instead of creating duplicates. Matches are skipped unless you explicitly select **Update matching contacts' name and fields**. The report never echoes saved values: the CSV visible above it is only what you uploaded. Files are parsed for the request and not retained.

Save a segment in Audience with a name and one or more rules. All rules must match. Name, email domain, and custom-field rules support **is**, **contains**, and **is set**. Consent rules support **is** with **Eligible** or **Opted out**. Email domain means a domain, never a person's exact email. Each segment shows its current contact count; editing contacts changes that count.

## Send invitations

1. Open a published flow in the builder and choose **Share**. The **Invitations** panel appears for an **Open** or **Closed** flow.
2. Choose a saved **Launch segment** and **Queue segment invitations**, or tick people under **Eligible recipients** and choose **Queue selected invitations**.

Each message names your business and the flow, and carries that person's own link and a link to opt out. Invitations are not held for your sending window. Pencil sends up to 50 messages as soon as you queue them. The rest wait as **pending** and go out 50 a minute through the background schedule, with later schedule runs continuing the queue. Pencil records each attempt before it hands the message to your mail provider.

**The launch reports what actually happened:** invited, already invited, opted out, no address, excluded by policy, and pending processing. A zero-invitation launch says zero. The default eligibility policy excludes anyone already invited to the published revision; source configuration may narrow eligibility further, never allow opted-out contacts or missing addresses. Larger selections continue in chunks under one command key without duplicating the launch.

A launch freezes its participant set, each person's name and email, and the evaluated eligibility and reminder policies. Later contact or segment edits cannot rewrite it or reroute mail. Deletion or opt-out before dispatch still prevents invitation and reminder mail. To invite someone again under the default policy, publish a new revision and launch there.

For a hand-picked launch, search and page through contacts; your checked IDs remain selected when the page changes. Segment launch counts cover the full evaluated segment.

An invited person's response is **identified**: it is linked to them, and the first-screen privacy line on the form says so. Responses through your public link stay anonymous. By default, each invitation admits one completed response. Opening the link again after finishing shows the completion screen and creates nothing new.

Below the buttons, each delivery is listed with a line such as **invitation: sent · response: not-started · 1 attempts**. The first status is the email's, and the second is whether the person has started or finished the form.

An invitation stays on the revision you sent it for, even if you publish a newer one afterwards.

## Reminders

Pencil sends one reminder, by default **2 days** after the invitation. A reminder goes only to people whose invitation was sent and who have not finished or opted out. It is not sent for a flow that has closed or been archived. When someone completes the form, their pending reminder is cancelled.

Set **Reminder delay (hours)** in Settings, from 0 to 8,760 hours. The source policy supplies the initial default. A launch keeps the schedule that was in force when you queued it.

Reminders and Daily response digests respect your sending hours. In **Settings**, under **Time and embeds**, set your **Time zone** and the daily window with **Send from** and **Send until**. Until you change them, the window is 09:00 to 17:00 and the time zone is UTC. A reminder that falls due outside the window waits until it opens. It is never dropped. Sign-in links and invitations you queue ignore the window.

## Opt-outs and consent

Every invitation and every reminder has an opt-out link. It opens a page titled **Stop feedback invitations**. The person chooses **Stop future flow mail** and sees **Your opt-out is saved.** From then on Pencil sends them no more flow mail. A response they already gave stays.

You can also record this yourself, for example when someone replies and asks to stop. Beside a contact in **Audience**:

- **Record opt-out** stops all flow mail to that person. They show as opted out and cannot be selected.
- **Record renewed consent** is for someone who has explicitly agreed to hear from you again. Pencil asks where they agreed, and records that source with who recorded it and when. Messages that were cancelled stay cancelled. If they already had an invitation for the current revision, queueing them again sends nothing: publish the flow again and queue them for the new revision.
- **Erase contact and responses** removes the person, revokes their invitation links and erases the identified responses they gave. Pencil first names the contact, fields, consent history, identified responses and answers, local mail copies and invitation links it removes. After confirmation the count-only completion receipt shows elapsed time and affected counts. Delivery facts and audit references remain anonymised. The erased contact no longer matches any segment. It also erases their opt-out record. If you save the same address again later, Pencil treats it as a new recipient who has not opted out.

Replies to your emails are not read. Pencil does not receive inbound mail, so a reply, an out-of-office message or a bounce can never create a response or trigger more mail. Invitations and reminders go out from your configured verified sender and are marked as automatically generated. On Managed hosting, RER's assigned verified sender also sends response notifications and Daily digests automatically. With SendGrid or Resend, choose a plain `noreply@` or `no-reply@` sender to enable them.

## When an email does not go through

A message waits as pending, then becomes sent, failed or unknown. It is cancelled instead if the person has opted out or the flow has closed since you queued it.

- **A rate-limit reply from the provider** is retried automatically, up to five times within an hour of the first attempt. If the provider is still limiting after that, the message is marked failed.
- **A permanent failure** is marked failed with the provider's reason. Choose **Queue retry** to try again.
- **An unclear outcome**, such as a timeout or a server error where Pencil cannot tell whether the provider took the message, is marked unknown. Pencil never resends it on its own, because that could email someone twice. You can resend with **Queue retry (duplicate risk)**, after you confirm you accept that risk.
- **No invitation is shown as sent just because it was queued.**

### If your mail provider stops working

Everything that does not need email keeps running: people already signed in, public links, embeds, collecting responses, results and exports. There is no general warning. This is what you see instead:

- **Invitations and reminders** are still tried one by one. Each one the provider refuses is marked failed, with a short code such as `provider_rejected`. Each one where Pencil cannot tell what happened, for example because the provider did not answer, is marked unknown. Once mail works again, an unknown one needs **Queue retry (duplicate risk)**, even if nothing went out.
- **Sign-in links.** The sign-in page always shows its usual **Check your email** reply, so that it never reveals who is an operator. When the provider fails, the link is cancelled and no email arrives. Pencil records the failure but shows it nowhere in the app. It appears in your Worker's log as `auth.magic_link_failed`, with the provider's outcome code. To watch for it, use the Worker log recipe below and try to sign in. Pencil has no password. The hosted owner can use [rer signin](hosting.md#sign-in-as-the-first-owner) with the deployment's Cloudflare credentials; other operators need mail restored.
- **New-response emails and Daily digests** show each attempt and its result under **Recent notification deliveries** on the results page. With SendGrid or Resend, if `MAIL_FROM` is not a plain `noreply@` or `no-reply@` address, the **Response notifications** panel explains that response notification mail is off; sign-in mail can still work from that verified sender.

### Watch your hosted Worker log

From the checkout that deployed your installation, make the same `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` available in your terminal as for deployment. For the `production` environment, run:

```sh
npx --no-install wrangler tail pencil-production --format pretty
```

For a named environment, replace `pencil-production` with its existing Worker name: for example, the `pencil-check` environment uses `pencil-pencil-check`. Confirm the name in Cloudflare's **Workers & Pages** before running the command. This watches logs only; it does not deploy. With the log running, request a sign-in link and look for `auth.magic_link_failed` and its outcome code. Stop watching with Ctrl-C. Keep logs private; they can contain operational details.

## Emails to you about new responses

Operators can also get immediate or Daily email about new completed responses. That is separate from invitations and is set per flow on the **Results** page. See [Results, review and exports](results.md#get-an-email-for-new-responses).

## Prefill known contact fields

In a question's existing editor, open **Known-data prefill**, enter a stored **Contact field key**, optionally choose **Lock prefilled answer**, then save the mapping and publish. Only that published revision's invitation links receive a prefill. Public links, embeds, previews and other-device resumes do not receive contact values. Invalid or incompatible values are left blank; publication refuses incompatible question mappings.

Respondents see **Prefilled**, may edit an unlocked value, and cannot change a locked value. After submission the answer is ordinary answer text: it can identify someone and can reach the configured analysis service when selected for analysis. The ledger and JSON/CSV answer metadata record whether a prefill was unchanged, edited or locked, without keeping the original contact value. Erasure and archives carry the marker with its answer. Invitations with a prefill mapping must be completed on their invitation path; saving them to another device is unavailable. In-product and CRM prefill are not available.

## Answer the first question from email

If the first question on a published path is NPS, CSAT, a rating scale or a short single choice, invitations and reminders include answer links. Single choices admit up to eight options with labels up to 80 characters. Another first question type, or a locked contact prefill on that question, leaves the ordinary **Open the form** link.

An answer link opens the invitation with that value selected and the next question ready. The page says it is not submitted yet. Continue or submit to confirm; opening or scanning the link with GET or HEAD creates no answer, session, response, view count or participant-state change. The page defers counting until a person interacts. Invalid hints select nothing. Completed, opted-out, expired or closed invitations keep their existing admission rules, and each invitation stays on its original published revision. No contact value, name or email is put in an answer link. Program email is not available.

Respondent confirmations are optional. In the completion step’s **Respondent confirmation email** settings, enable the receipt and choose one email question, or choose the identified invitation participant. Publish to apply. That question is marked **Send my confirmation here**. Other answers never supply recipients. Opted-out participants receive no receipt. Answer copies require a second opt-in and explicit allowed types (none initially); the subject and message support the same earlier-answer, hidden-field and calculated recall. Permitted dates use their published display format. The receipt contains no response-access link or Reply-To. Excluded/quarantined submissions wait for release; restored history never sends. The stored receipt and attempts erase with the response and travel in private backups with sending disabled. Sensitive withholding, quiz results, payment receipt links and signed PDFs inherit these protections before those features ship.
