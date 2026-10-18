# Publish and share

Publishing turns your draft into a live form. Sharing gives you the link or the code to put it in front of people. This page also covers closing a form, putting it on your website, and branding it as your own.

## Publish a flow

1. Open the flow in the builder and make sure every step is saved.
2. Choose **Publish**.
3. Pencil checks the whole flow (see [Answer paths](branching.md#what-publishing-checks)). If everything is fine you see **Published. New visitors see this version.** If not, you get a list of the steps to fix and nothing is published.

Publishing creates a numbered revision. A revision never changes once it exists, so you always know exactly what people saw. The flow's public link always opens the current revision.

### Close automatically

Before you publish, open **Publication options** to set limits on this revision:

- **Close at**, a date and time in your workspace time zone. The label shows which zone. The zone is recorded with the revision, so changing the workspace time zone later does not move this deadline.
- **Completed response target**, a number of completed responses. The form closes when it has that many.

A deadline or target closes only the revision it was set on. A target counts completed responses for that revision alone.

### Edit after publishing

Changing a published flow edits a new draft only. The card shows **Unpublished changes** until you publish again, and visitors keep seeing the last published revision.

Publishing a new revision affects only people who start afterwards. Someone partway through the older revision finishes that one, and an invitation keeps the revision it was sent for.

## The life of a flow

A flow is always in one of four states, shown with a capital letter: **Draft**, **Open**, **Closed** or **Archived**. The dashboard has filter buttons for each, plus **All flows**.

- A new flow is a **Draft**. Its public link returns a not-found page.
- **Publish** makes it **Open**.
- **Close responses** closes it by hand. Everyone who opens the link now sees a standard page saying **This feedback flow is closed.**
- A deadline or target closes a revision automatically.
- **Reopen current revision** opens a closed flow again, unless that revision's deadline has passed or its completed response target has been reached. A deadline still in the future, or a target not yet reached, does not stop it. If the deadline has passed or the target was reached, publish again to collect more.
- **Archive flow** retires it. An archived flow's public link stops working, and it disappears from your default list. Its responses and results are kept, and an archived flow cannot be opened again.

Closing a flow never deletes anything, and a submission that arrives just as a flow closes sees the closed page and is not saved.

## Share it

After you publish, **Share** opens inside the builder. (**Share** and **Edit steps** switch between the two views.) The panel **Share this flow** has three copyable fields:

- **Public link**: the form's own page, at `/f/` followed by your public link name. Anyone with the link can answer. Use **Copy public link**.
- **Script embed**: one line of code that adds the form to your website.
- **Embed code**: a plain iframe.

The panel always opens the **current published** form. Draft changes are not included until you publish. Use **View public flow** at the top of the builder to look at it yourself.

### Put the form on your website

Embedding works only on websites you have approved:

1. Open **Settings**.
2. Under **Time and embeds**, add your website to **Allowed embed hosts**. Write one exact HTTPS origin per line, such as `https://www.your-business.example`.
3. Choose **Save workspace settings**.

An empty list blocks all embedding, and your direct links keep working. Pencil checks the host before it shows any of the form. A page on a different host, or on plain HTTP, is refused.

Then copy either code from **Share this flow** into your page. They look like these, with your own address and link name:

```html
<script async src="https://your-pencil-address/embed.js?flow=your-flow-link" referrerpolicy="origin"></script>
```

```html
<iframe src="https://your-pencil-address/embed/your-flow-link" title="Feedback form" width="100%" height="700" sandbox="allow-scripts allow-forms" referrerpolicy="origin" style="border:0"></iframe>
```

Copy the code from **Share this flow** rather than typing it, so the address is exact. Keep `sandbox` and `referrerpolicy="origin"` as they are. Pencil uses the referrer to confirm the host is allowed.

The **script embed** adds the form and resizes it to fit its content. The **iframe** keeps a fixed height that you can change. Both show the same form with the same checks. Responses from either are labelled **Embed** in your results.

The embedded form runs in an isolated frame. The page around it cannot read answers, response IDs, invitation links or contact details. With the script embed, the page gets only three signals. Each is an event fired on the iframe element that bubbles up the page:

- `pencil:loaded` when the form is ready.
- `pencil:height`, with the new height in `detail.height`, when it resizes.
- `pencil:completed` when someone finishes.

```html
<script>
  document.addEventListener('pencil:completed', () => {
    // Thank the visitor, close a dialog, or track a finished form.
  })
</script>
```

## A form on your home page

You can show one open flow at your Pencil address itself, at `/`. In **Settings**, under **Business branding**, choose it as the **Public landing flow**. Only open flows are listed. With **No public landing**, `/` shows the Pencil Lobby: **Finish setup** until the owner has completed first-run setup, then **Sign in**. The Lobby uses the installation’s Pencil name; your saved business branding appears on respondent forms. If the chosen flow later closes, visitors see the closed page, and if it is archived or missing, `/` is not found, exactly like its own link.

The landing page shows a small **Operator sign in** link for you and your team. It shows a "Powered by Pencil" credit only if you switch that on in the source (`showPoweredByCredit` in `src/ext/config.ts`). It is off by default.

## Make it look like yours

In **Settings**, **Business branding** holds:

- **Business name** and **Supporting line**. The supporting line is the short reason people see for why you are asking.
- **Accent colour**, as `#rrggbb`. Button text switches to black or white so it stays readable.
- **Business logo**: a PNG, JPEG or WebP up to 256 KB. SVG is not accepted.

Choose **Save business branding** to store the name, supporting line, accent colour and public landing flow. The logo does not wait for that button: it is saved as soon as you choose the file, and Pencil says **Business logo saved.** **Remove business logo** also acts at once and takes it away everywhere. Your branding appears in previews, direct and embedded forms, the completion and closed pages, the selected landing form, invitations, reminders and new-response emails. Pencil serves your logo from your own installation and loads nothing from other sites. Logos are public images by design, so anyone can fetch your logo.

## What respondents see

Respondents need no account and no cookie. They see one screen at a time:

- A progress line, for example **Question 2 of 3** and **1 remaining**, which only counts questions they can still reach.
- A **Required** note on required questions.
- **Begin**, **Continue** or **Submit response**, and **Back** to change an earlier answer.
- A **Before you share** note before the first answer. It gives your supporting line, says whether the response is anonymous or identified through an invitation, who can see answers, and that anything personal they type, such as an email address, identifies them to your operators.
- If sending fails, an error and **Retry submission**. A retry never creates a second response.
- On finishing, your completion screen and the note that the link cannot edit a completed response.

Next: [Invitations, reminders and consent](invitations.md), or read what comes back in [Results, review and exports](results.md).

## QR codes and shared devices

In **Share this flow**, download the public link as an SVG or PNG QR code. **Manage named collectors** gives each campaign or counter its own labelled QR downloads; responses retain that collector in the ledger and exports.

Open **Kiosk** for a public link or named collector, choose how long idle answers may remain, then open its kiosk link on the shared device. Submission clears the form before the next person begins. An idle timeout or leaving the tab clears unsent answers. Kiosks do not offer Save and finish later. Keep this tab visible while collecting.

## Restricted forms

Open **Publication options → Form access** in the builder. Choose a password, verified email, or a signed link from your own app. Save, then publish: each revision keeps its own access rule. The server withholds the question graph and refuses new sessions until the check succeeds. Password access can remain anonymous; email and app access disclose the verified identity before answers and retain it in the ledger and CSV/JSON.

For email access, list exact allowed domains or individual addresses. A six-digit code expires after ten minutes and permits at most five attempts. Codes are single-use; the verified email may complete the form once across its revisions. An expired code or failed delivery can be requested again. Local development suppresses email, so email verification requires a configured production sender to receive the code. There is no development inbox.

For app access, save your app's raw 32-byte Ed25519 public key in base64url. Keep its private key in your app. Sign the exact base64url JSON payload below with Ed25519; append a dot and the signature in base64url. `expiresAt` is epoch milliseconds, at most 24 hours ahead. Use the published revision ID returned in the restricted form's access descriptor (`GET /api/public/flows/<slug>`). The app opens `/f/<slug>#access=<payload>.<signature>`; Pencil removes the token from the address bar, verifies it on the server, and opens the form only after the respondent confirms. A token for another revision or a past expiry is refused.

```json
{"revisionId":"PUBLISHED_REVISION_ID","expiresAt":1792440000000,"subject":"your-app-account-id"}
```

Access grants stay in browser memory for up to one hour and never enter anonymous view counters. Kiosks require each next respondent to verify again. Private saves retain the already verified identity on their original session. Backups exclude passwords and live access grants, codes and session authorizations. After restoration, publish a replacement password before password-protected forms can admit new respondents; email allowlists and app public keys remain configured. Duplicated forms require their own access configuration before collection.
