# Build a form

In Pencil a form is called a flow. A flow is a short run of screens that people move through one at a time. This page covers creating a flow, adding questions, choosing question types and checking your work in a preview. To send people down different routes, see [Answer paths](branching.md).

## Start a new flow

1. Sign in and open **Flows**. The page is titled **Your flows**.
2. Choose **New flow**. On a fresh install the form is already open under **Create your first flow**.
3. The first time, enter your **Business name**. Pencil asks for it once, because your name appears on every public form. You can change it later in **Settings**.
4. Pick a template or **Blank flow**.
5. Enter a **Flow name** (for example "Post-visit feedback") and a **Public link**. The public link is the last part of the form's web address, `/f/` followed by the link, written in lowercase letters, numbers and hyphens. When you type a name, Pencil suggests a link made from it. Picking a template fills in the template's name and a link that ends in eight random letters and numbers, such as `customer-feedback-25e5a2da`. Edit the link to something short and readable before you create the draft, because it is the address people see.
6. Choose **Create draft flow**. The builder opens.

### Templates

A template is only a starting point. It creates an ordinary draft that you can edit freely before you publish.

| Template | What it asks |
|---|---|
| **Customer feedback** | "How was your visit?" (single choice: Great, Good, Could be better), then "What could we do better?" (long text). |
| **NPS** | "How likely are you to recommend us to a friend?" (a 0 to 10 scale), then "What is the main reason for your score?" (long text). |
| **Contact/lead** | "What is your name?", "What is your email address?" and "How can we help?". |

Each template ends with the completion screen "Thank you. Your response has been received."

## The builder

The builder has three parts side by side:

- **Steps** on the left lists every screen in order.
- The middle shows the **Current draft step** as a respondent will see it, using the same controls.
- The panel on the right holds the settings for the selected step.

A flow is made of three kinds of step:

- A **Welcome** screen. It is optional and can only come first. **Add welcome screen** appears until you have one.
- **Questions**. A flow needs at least one.
- **Completion** screens. A flow needs at least one, and you can have several. Each has its own wording, so different answer paths can end in different messages.

Use **Add question**, **Add completion screen** and **Add welcome screen** to add steps. A new question goes in just before your completion screen, and it leads on to that screen. Earlier questions keep their answer paths, so nobody reaches the new question until you connect it: set an earlier question's **Default next screen**, or one of its rules, to the new question. **Publish** refuses a question that no path reaches. To rearrange, select a step and use **Move up** or **Move down**. **Duplicate** copies a step, and **Delete** removes it.

Deleting a question from a draft never removes answers you have already collected. Those answers stay in your results, ledger and exports with the question that asked them.

## Edit a step

Select a step, then change it in the right-hand panel:

- **Prompt** is the question or message people read.
- **Extra wording**, then **Why ask this?**, adds a line of explanation under the prompt. It is a good place to say how you will use the answer.
- **Question type** sets what people can answer (see below).
- **Required response** makes the question mandatory. A required question only blocks people who actually reach it. If an answer sends someone around it, it is never asked and never counted as missing.
- **Default next screen** says where people go after this step when no answer path applies. Every step except a completion screen needs one before you can publish.

When you are done, choose **Save**. One **Save** stores everything on that step together: its wording, choices, settings and answer paths. If anything is invalid, nothing is saved. Once Pencil says **Saved.**, the edit is kept even if you reload.

While a step has unsaved changes you cannot switch steps, add or move steps, preview or publish. Save, or choose **Discard changes**.

If two operators edit the same flow, the first to save wins. The second sees **Another operator saved first. The latest draft has been reloaded.** and nothing is overwritten.

## Rewrite a question

With an [AI provider configured](analysis.md#turn-analysis-on), open **Rewrite this question** on a question step:

1. Save current edits first.
2. Choose **Sharper**, **Broader** or **Contextual**, and optionally enter **Context**.
3. Choose **Request rewrite**. The saved question, style and context go to your configured provider; respondent answers are not included.
4. Compare **Source** with **Proposal**. Choose **Accept and save wording** to save only the proposed question wording to the current draft, or **Reject** to leave it alone.

Accepting does not change choices or answer paths and never publishes. If the draft changed while you reviewed the proposal, Pencil refuses to overwrite it; reload and request a new rewrite. An unavailable provider or failed request shows an error and leaves the saved question unchanged. **Retry rewrite** makes a new request.

## Question types

Pick the type that matches how people should answer. The types are:

| Type | People answer with | Settings |
|---|---|---|
| **Short text** | A line of text, up to 200 characters. | None. |
| **Long text** | A longer comment, up to 5,000 characters. | None. |
| **Email** | An email address, checked for a valid shape. | None. |
| **Single choice** | One option from a list. | **Choices** |
| **Multiple choice** | Any number of options. | **Choices**, **Minimum selections**, **Maximum selections** |
| **Rating** | A number on a scale. | **Lowest rating** and **Highest rating**, anywhere from 0 to 10. |
| **Priority** | Every option, put in order of preference. | **Choices** |
| **Dropdown** | One option picked from a searchable list. | **Choices** |
| **Yes / No** | Yes or No. | None. |
| **NPS** | A whole number from 0 to 10. | **Zero label** and **Ten label**, the words at each end. |
| **Number** | A number. | **Minimum**, **Maximum**, **Decimal places**. |
| **Date** | A calendar date, with no time zone. | **Earliest date**, **Latest date**. |
| **Consent** | A tick box next to a statement you write. | **Consent statement** |

Nobody starts with an answer picked. A **No**, a **0** or a rating only counts once the person has chosen it. A required **Consent** question can only be answered by accepting.

### Choices

For choice types, use **Choice** to add options and **Remove** to take one away. Type each option's label into its own field, which is numbered **Choice 1**, **Choice 2** and so on.

Behind each label sits an **Answer value** that Pencil makes from the label. CSV and JSON exports use this value from the published revision the respondent answered, with the label alongside it. Multiple-choice and priority answers export a list of these values; priority keeps the respondent’s order. Rename a label later and the value stays the same, so your exports stay consistent. If you need to change it, open **Advanced** on that choice.

## Calculations

Open **Publication options**, then **Calculations** in the builder and choose **Add numeric calculation** for a total or **Add text calculation** for a text value. Give it a name, then build its **Expression** from literal values, question answers, hidden fields or other calculated variables. Choose **Add**, **Subtract**, **Multiply**, **Divide**, **Round** or **Date difference** for numbers, or **Conditional** to choose between two values using answer conditions. For example, multiply a quantity answer by a literal price, or return different text for different choices. Choose **Save calculations** when finished.

Missing inputs produce a blank calculated value. Pencil refuses invalid types, missing or deleted references and cycles between variables. Division must have a denominator whose bounds prove it cannot reach zero; unknown or unbounded denominators are refused too. These checks apply before publication, including both arms of a conditional.

Try the values in **Preview draft**. Use a calculation in an answer-path condition, or insert it into a prompt or completion with **Insert an earlier answer**. Recalled values use the answers available at that point, so an unavailable input stays blank. Results show the response's calculated values, and CSV and JSON exports include them. Publishing snapshots the calculation definitions with the revision; later draft edits do not change the calculations for earlier responses.

Calculated answer paths require Pencil to prove the possible routes. Numeric question inputs to that proof need explicit **Minimum** and **Maximum** values that are safe whole numbers, **Decimal places** set to `0`, and no more than 1,000 possible values. The proof also supports rating scales, boolean answers, single-choice and dropdown answers, and text equality, inequality and blank/answered checks. Unsupported input domains, including unbounded hidden numbers, text masks or patterns and possible Other answers, refuse publication when needed for a calculated path. These restrictions apply to calculated answer paths; general calculated values can use unbounded inputs, subject to the division check above.

Calculated values are not yet available to alerts. A payment step can charge a numeric calculation; see [Take a payment](#take-a-payment).

## Take a payment

A payment step collects money through Stripe Checkout, Stripe’s own page. Your form never loads a card field, and Pencil never receives card or bank numbers.

**Connect Stripe first.** The installation owner opens **Settings** and fills in **Payments**:

1. In the Stripe Dashboard, create a restricted key with write access to Checkout Sessions. A key that starts `rk_test_` works in test mode; `rk_live_` takes real money.
2. Add a webhook endpoint at `https://YOUR-PENCIL/api/public/payments/stripe` for the events `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed` and `charge.refunded`.
3. Paste the restricted key and the endpoint’s signing secret (`whsec_…`) and choose **Save Stripe connection**, then **Test connection**.

Both values are encrypted, never shown again and excluded from backups. Only the owner can save, test or remove them.

**Add the step.** Choose **Add payment step** in the builder. Price the order one of two ways, always in US dollars:

- **Products and option prices**: fixed products with a price and either a fixed quantity or the answer to an earlier whole-number question, plus prices on the choices of earlier single-choice, multiple-choice or dropdown questions. A blank quantity or option adds nothing.
- **Calculated amount**: a numeric calculation, read as dollars and rounded to the cent. Every question it reads must be required and asked on every path to the payment step, and it cannot read a hidden field, because a link value is something the respondent could change.

Set a **Minimum charge** and **Maximum charge**. Publishing refuses a payment step, naming it, when it comes after a completion screen, when it does not lead straight to a completion screen, when a question that sets its amount comes after it, or when any possible total falls outside its limits. A path can reach only one payment step, so give each branch its own step if branches charge differently.

**What respondents see.** The payment step shows the order and its total, recomputed by Pencil from the published form; an amount sent by the browser is refused. **Pay with Stripe** saves the response with its payment pending and opens Checkout. After paying, the respondent returns to the completion screen their path reached. **Back** on Checkout returns them to the payment step with every answer kept; Pencil cancels that checkout, and their next attempt replaces the cancelled one, so one respondent session keeps one response.

**Payment states.** A response is **Paid** only after Stripe’s signed webhook says so for that checkout. **Payment failed**, **Checkout expired** (an abandoned checkout, after Stripe’s 24 hours) and **Refunded** also come from Stripe’s events; **Checkout cancelled** comes from the respondent. Each event is applied once. Results show every response with its payment; on a payment form only paid responses count toward a completion target, a collector’s response limit or an invitation’s one completion, and only paid responses send response emails and join daily digests.

An embedded payment form asks your page to open Checkout in the whole window; the respondent returns to the form’s own page.

## Preview your flow

Choose **Preview draft** to try the draft as a respondent. You answer with test data, and Pencil shows the route it would take. A preview never creates a response, sends nothing and does not change any counts.

- **Continue preview** and **Back in preview** move through the screens.
- **Inspect answer path** opens **Evaluated path**, which lists each rule on each screen as matching or not matching and shows which one was chosen.

The preview uses the same rules as the live form, so what you see is what people will get. Preview is unavailable while a step has unsaved changes.

## Copy, edit and archive

- **Duplicate flow** on a flow's card makes an independent draft with the same questions and paths. Give it a **Copy name** and **Copy public link**, then choose **Create independent copy**. The copy has no responses, invitations or history. The original keeps all of its responses.
- Editing a flow that is already published changes only a new draft. The live form does not change until you publish again. The dashboard shows **Unpublished changes** on any flow whose draft differs from what is live.
- An archived flow cannot be published or reopened, and Pencil refuses to save, add or duplicate its steps. Deleting or moving a step is not refused yet, and either one changes the draft that **Duplicate flow** copies, so leave an archived flow's steps as they are. To work on it again, duplicate it and edit the copy.

Next: [Answer paths](branching.md), or go straight to [Publish and share](publish-and-share.md).

## Hidden fields from a link

Open **Publication options**, then **Hidden fields and identity** in the builder. Add a parameter name, its type and purpose, then choose **Save hidden fields**. For example, declare `utm_campaign` as campaign text and use `/f/your-form?utm_campaign=spring`. Only declared, valid values are retained; missing fields stay blank. Parameters are unverified input from whoever holds the link.

Use **Add condition rule** to choose a hidden field for an answer path, or **Insert an earlier answer** to insert a declared hidden field into a prompt or completion. Preview offers separate test link values. Results show the retained values with each response, offer hidden-field filtering and search, and include them in CSV and JSON exports.

A field containing a name, email or other identity must have the identifying purpose and the form must use **Identified** public links. Before answering, people see the supplied identity and can choose **This isn’t me** to clear it. An unexpanded mail merge tag is discarded. Anonymous forms discard click IDs until conversion delivery is available. Script-embed forwarding and fixed hidden attributes are not available yet; direct links accept query parameters. Publishing snapshots these settings; editing the draft leaves the live version unchanged.

To draft from a goal or document, choose **Generate with AI** in **New flow**. Text, Markdown, CSV and HTML are supported; PDF and Word are not available yet. The generation button names the provider that receives your goal, source text and prompts from prior forms you explicitly select. Pencil does not retain the original goal or source document. Review the generated questions, edit them in the builder and publish only when ready. **A study** also drafts a decision, hypotheses, audience, channel and analysis plan, with a conservative finite-population sample at 95% confidence. Save your plan before leaving; reopen it through **Continue generated draft** in the same Studio entry. Wording checks and provider suggestions are advisory and never rewrite or block questions. Generation supports up to 30 steps and simple forward choice, score and Yes/No branches; generated markers are currently shown in Studio review, not in the builder.

Payment step Settings can enable Stripe Tax, allow promotion codes or apply a Stripe coupon ID. Checkout collects the billing address for tax; Pencil stores no address. Enabling receipt email collection creates a Checkout customer; Stripe sends receipts only when receipt emails are enabled in the Stripe account. Pencil forwards no respondent answer as an email address. The response payment record and CSV/JSON exports show the signed subtotal, discount, tax and total.

Open **View payments and refunds** on a response’s payment record to filter by payment status and export the payment ledger. The installation owner can confirm a full or partial refund and reconcile a UTC day or month with Stripe; other operators can read the ledger. Refund requests wait for Stripe’s signed webhook before the balance changes. A provider error retains the refund reservation: check Stripe before retrying. Reconciliation covers up to 1,000 payments; historical payments from before this ledger upgrade retain their recorded last-change date, so verify earlier periods in Stripe reporting. Pencil stores only the method type and last four digits received in signed events.

Payment mode Settings also supports monthly or yearly subscriptions with an active Stripe USD price ID matching the fixed amount, and donations. Suggested donations use the same server-priced products or choice prices; a custom donation uses one fixed preset and lets the donor choose an amount only on Stripe within the charge limits. Custom donations are one-time; recurring donations use a fixed amount. Signed subscription events show active or canceled status on the response. Manage ongoing billing in Stripe’s customer portal.

Enable **Offer ACH bank payments** in payment step Settings to add US bank accounts to Checkout. Apple Pay and Google Pay use Checkout’s card wallets on supported devices and Stripe accounts. ACH responses show **Payment processing** until a signed success or failure event arrives; only **Paid** consumes an admission place. The return page says Stripe is confirming while settlement is pending. PayPal and Square are not connected, and failed ACH retries require checking the payment in Stripe.

A cancelled or expired subscription, donation or ACH checkout keeps its saved answers but cannot replace that checkout yet. Ask the business to check the payment in Stripe before starting a new response; the app refuses replacement instead of reusing stale billing settings. Ordinary one-time Checkout cancellation and retry remain supported.


### Script embed modes

On an approved host, add attributes to the copied script snippet: `data-pencil-mode="full-page"`, `"popup"`, `"popover"`, `"slider"` or `"side-tab"`. Omit it for inline embedding. Each floating mode includes Open form and Close form controls. `data-pencil-label` names the opener; `data-pencil-target="#contact-button"` also opens from an existing host control.

Choose `data-pencil-trigger="click"`, `"delay"`, `"scroll"` or `"exit"`. Delay uses `data-pencil-delay` milliseconds (default 1000, at most one hour); scroll uses `data-pencil-scroll` percent (default 50). Exit intent uses a pointer leaving the top of the document. Click remains available on touch devices. `data-pencil-cap` limits openings per browser and form/mode (default one, at most 100); unavailable browser storage keeps the mode closed. Campaign parameters named `utm_*` are forwarded to the form, where declared hidden-field and identity rules apply. Respondent answers stay inside the opaque frame; the host receives only the existing layout/completion events, with the existing payment navigation behavior unchanged.

WordPress shortcodes/plugins and DIST-021 integrations remain unavailable.
