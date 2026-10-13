# Privacy and security

This page says what Pencil collects from the people who answer your forms, what it protects for you and your team, and where your data goes. It also says what Pencil does not promise. Pencil is software you run yourself, so the safeguards below come with the code, and the rest depends on how you deploy and use it.

## For the people who answer

**Nothing is tracked before they start.** The public pages, which are the form, the closed page, the invitation page and the opt-out page, set no cookies. They load nothing from other websites, so there are no outside fonts, scripts, analytics or trackers. They send no information about the visitor before the visitor first interacts with the form.

**Your address also serves Pencil's own pages.** By default, `/` shows the Lobby, a page with your business name and a **Sign in** button, and `/pencil` redirects to `/`. Selecting a public landing flow in Settings replaces the default root with that flow's respondent experience, including its normal closed or not-found state. This documentation stays at `/docs`. These public pages set no cookies and load nothing from other websites. Like every public page, they count towards the per-address rate limits described below.

**The first interaction starts a short-lived session record.** It holds only:

- a random session ID,
- which revision of the form it was,
- where it came from: direct link, embed or invitation,
- when it started,
- the furthest step reached, and
- the device class: mobile, tablet or desktop.

It holds no answers, no contact details, no IP address and no browser identification string. It expires after 30 days. When a session ends or expires, only counts are kept (that one session started, where it stopped and on what kind of device). Those counts cannot be traced back to a person, a session or a response.

**Anonymous means anonymous.** A response from your public link records no link to a contact, no name or email taken from elsewhere, no raw IP address and nothing from the page it was embedded on. It gets a random ID that cannot be reversed to identify the person. If someone knowingly types their name or email into a question, that is stored as their answer and nothing more. It creates no contact. The note people see before the first answer says so.

**People are told before they share.** The **Before you share** note says why you are asking, whether the response is anonymous or identified through an invitation, who can see individual answers (your operators), and that personal details they type identify them to those operators.

**Abandoned forms leave nothing to read.** Pencil counts that a session started and how far it got. It never stores, shows or exports what someone typed into a form they did not submit.

**Embedding keeps the host page out.** On a page that embeds your form, the form runs in an isolated frame. The host page cannot read answers, response IDs, invitation links or contact details. The script embed tells it only that the form loaded, how tall it is and that someone finished. Only websites on your **Allowed embed hosts** list can embed the form at all.

**Spam protection does not spy on people.** Pencil uses a hidden field, a minimum time to fill a form in, a token tied to the session, and per-address rate limits (by default 120 requests a minute and 30 final submissions a minute per address). It uses no CAPTCHA and no outside reputation service. A submission that fills the hidden field is dropped and nothing from it is saved. One that arrives faster than a person could fill it in is saved but held for review, and is deleted only if you delete it. See [Results, review and exports](results.md#review-suspicious-submissions).

One exception to "nothing from outside" is deliberate. Your business logo is stored in your database and shown from your own installation, to anyone who loads a form. Treat it as a public image.

## For you and your team

**Sign-in is by emailed link.** Operators enter an email address and receive a one-time link that expires after 15 minutes and works once. Opening it only shows a confirmation page, and the person must choose **Confirm** before they are signed in. Pencil stores no passwords. The page gives the same answer for any address, so it does not reveal who is an operator.

**Sessions are short lived and revocable.** After sign-in, Pencil sets a secure, HTTP-only cookie that lasts up to 30 days. **Sign out** ends it. Every private page and every private server call checks the session on its own, so being on one page never grants access to another, and every change is checked on the server. Removing an operator erases their sessions and sign-in credentials.

**Everyone on the team is equal.** Every operator can see and change every flow, response and recipient. There are no roles. In **Settings**, under **Operator access**, any operator can use **Invite an operator** (a name and email address) and can remove any other operator. The setup operator can only be removed by themselves, and the last operator cannot be removed. Because there is no narrower access, invite only people you trust with all your data.

**Secrets stay on the server.** Keys and secrets are never included in what your browser downloads, in logs or in error messages. If a required setting is missing, Pencil refuses to start and names it, rather than running in a weakened state.

**Pages are not framed.** Pencil documents refuse to be placed in another site's frame. The one exception is the embed page, on the websites you have allowed.

## Where your data goes

Your data lives in the D1 database in your Cloudflare account. It leaves that database only in these ways:

- **Email.** Your mail provider (SendGrid or Resend) receives each recipient's address and the message, which includes the sign-in, invitation or opt-out link where one applies. This is the only external Pencil needs.
- **External tasks, only if you turn them on and confirm each one.** Your task receiver gets exactly the JSON shown on the confirmation screen: the action's title, rationale, owner name and email, metric, review date and a link that needs an operator sign-in. Never answers, excerpts or respondent details. See [Actions and follow-up](actions.md).
- **Exports and backups that you make.** They go where you put them. See [Backup and restore](backup.md).

Pencil has an optional connection for AI analysis, but it is not built in this release, so nothing is sent to it. Pencil also has no telemetry, no phone-home, no licence check and no kill switch, and it makes no requests to the people who wrote it.

Saved segment rule values are operator configuration, not subject rows. Rules cannot name a person's exact email address. Erasing a contact removes their custom fields and makes them absent from segment results; it does not remove saved segment configuration.

**Actions keep counts, not people.** An action stores the recommendation you wrote and a copy of the results counts it rests on, taken from the whole revision. It stores no response IDs, answer text, excerpts or filtered groups, because a count for a small group could point to one person. That is why erasing a response or a contact never needs to change an action. What you type into an action's rationale is yours: do not paste respondent answers or names there, because the rationale is sent with an external task if you create one.

## Keeping and erasing data

Pencil never deletes your data automatically. Only three things expire: sign-in sessions, respondent sessions (after 30 days) and rate-limit counters.

You can erase a response, or a recipient and everything they gave, at any time. Erasure also revokes their invitation links. It removes the answers and updates your totals, within five minutes. A count-only erasure audit and anonymised delivery facts remain, with no subject identity or answer values. See [Results, review and exports](results.md#erase-a-response) and [Invitations, reminders and consent](invitations.md#opt-outs-and-consent).

Erasure works on your live database only. Some copies are out of its reach:

- **Backups.** An archive made before the erasure still holds the erased data. Restoring it brings contacts, custom fields, prior consent state and answers back and loses any opt-outs recorded since the archive was made. The import command prints a reminder: erase those people and responses again and record those opt-outs again. Restored invitation links remain inert because their capabilities are omitted. See [Backup and restore](backup.md#restore-into-a-new-database).
- **Response exports** you downloaded before the erasure.
- **Your mail provider's records** of the messages it sent.

Erasing a recipient also erases their opt-out. If you save the same address again later, Pencil treats it as a new recipient who has not opted out.

## What Pencil does not promise

- **No compliance claims.** Pencil does not claim to meet any law, regulation or certification, such as GDPR or SOC 2. What it gives you are the mechanisms above. Whether your use of Pencil meets the rules that apply to you is for you to decide.
- **Accessibility is a goal that is checked, not a certificate.** Pencil's pages are built to work with a keyboard and assistive technology, and its test suite runs automated accessibility checks. They have not been tested against a published standard, and Pencil does not claim conformance with one.
- **No delivery guarantees.** Pencil can tell you a mail provider accepted a message. It cannot promise the message reached an inbox.
- **Hosting is yours.** Pencil's security depends on your Cloudflare account, your secrets, your mail provider and who you invite as an operator. Keep them safe.
