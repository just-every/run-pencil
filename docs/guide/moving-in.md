# Moving in

Bring Google Forms response history into an editable Pencil draft from a CSV, with an optional Google Forms definition JSON. You can also bring in a Typeform definition JSON with an optional response CSV. The same review, import, resume and undo process handles both sources.

## Before you start

- **Google Forms is CSV-first.** A response CSV can be imported by itself or with an optional definition JSON. With the CSV alone, Pencil makes a flat draft from the columns and cannot rebuild the form's branching. A definition JSON by itself creates a structure-only draft with no response history.
- **Typeform starts with a form definition JSON.** Add a response CSV if you want to bring the historical answers too.
- **Pencil does not connect to either provider.** You get the files in your own account and choose them on the import page. Never paste a Google token or Typeform API token into Pencil.
- **Pencil keeps the safe import record, not the files.** It retains file names, sizes and digests, the reviewed plan and imported answers; it does not retain the original file bytes.
- **The importer has not been checked against a real account export.** The Google Forms importer was written from published Google documentation and checked only with example files; no real Google account export was supplied. The Typeform importer was also checked only with example files from published documentation; no real Typeform account export has been checked.
- **File admission limits.** One import can be at most 8 MiB of files in total and 100,000 response rows. Larger imports are refused before anything is stored. The usual form limits, such as the number of questions and the length of answers, also apply. Admission does not guarantee that a hosted import will finish; see the execution limit below.

### Hosted execution limit

Large imports within those file limits can exceed the hosted request CPU budget. Review, preparation and the first continuation still process the complete plan in a single request at each stage. Native response creation and undo use batches, but that does not bound those earlier requests. Local HTTP measurements already exceed the Workers Paid default of 30 seconds for an admitted 100,000-row import; local measurements do not establish live hosted capacity. The [hosting guide](hosting.md#costs-limits-and-what-is-not-proven) explains the required plan and budget.

If a request fails, use **Refresh history** to inspect durable progress. A failed review creates nothing. An interrupted private preparation creates no form or responses and can be cancelled; retrying it requires the source files. A complete private preparation and an import that has begun creating native records can be continued from stored custody without the files. Retrying does not remove the CPU limit, so completion at the maximum admitted sizes is not currently guaranteed.

## Get a Google Forms response CSV

Open the form in Google Forms, choose **Responses → More → Download responses (.csv)**. If the form has a linked response Sheet, you can instead open that Sheet and choose **File → Download → Comma-separated values (.csv)**. Google's [response help](https://support.google.com/docs/answer/139706?hl=en) describes the CSV download and linked Sheet.

### Set the source Sheet time zone

Every Google CSV import needs the time zone from the source response Sheet. Open that Sheet, choose **File → Settings**, and note the time zone. In Pencil, choose its corresponding IANA time zone. Do this even when you downloaded the CSV from Forms. Before importing, compare the first and last timestamp preview in Pencil with the response Sheet.

Pencil infers date order from timestamps when their values make it clear, such as a day greater than 12 or a year-first value. If timestamps do not establish one order, choose it explicitly: day/month/year (DMY), month/day/year (MDY) or year/month/day (YMD). Conflicting or invalid dates are listed as errors. Correct daylight-saving gaps or overlaps in the source; Pencil does not shift an ambiguous local time.

With a Google definition, a checkbox CSV cell can hold several selections as whole labels joined by comma and space. Pencil splits on that delimiter only when every label matches one definition option unambiguously. A label containing the separator, or a value with an ambiguous split, is reported for correction. With CSV-only import there is no complete option list; choose only observed whole values. Combined checkbox cells stay opaque whole values because their separate selections cannot be reliably recovered without the definition. Repeated column headings also need an explicit mapping for each column; Pencil does not guess which same-named question you intended.

### Optional Google Forms definition JSON

The read-only Google Forms API method [`forms.get`](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get) returns the form definition as JSON. Use the method page's **Try it** section while signed in to the Google account that can read the form. Enter the form ID (the part of the edit link after `/d/` and before `/edit`) and save the returned JSON privately. This definition does not include response rows; provide the separate CSV when you want response history.

You can also call the Forms REST API from an Apps Script project in your own account using Google's [UrlFetchApp setup guide](https://developers.google.com/workspace/forms/api/guides/apps-script-setup). The Forms REST API is not available as an Apps Script advanced service; Google's [comparison guide](https://developers.google.com/workspace/forms/api/guides/compare-rest-apps-script) documents the `UrlFetchApp` route. The Try it method is the shorter path. Keep all authorization in your account and give Pencil only the saved JSON file.

## Get Typeform files

**The responses (optional).** In your Typeform account, open the form's results, select the responses you need and export them as CSV. Typeform explains this in [Export your responses](https://help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses) and [Working with your responses](https://help.typeform.com/hc/en-us/articles/360029253732-Working-with-your-responses). Keep the **Start Date** and **Submit Date** columns, because every imported response needs its submission time.

**The form definition.** Typeform's results export does not include the form itself. Get it as JSON from Typeform's [Retrieve form API](https://www.typeform.com/developers/create/reference/retrieve-form/), using your own token in your own browser or command-line tool, and save the response as a file. If you use a command-line tool, give the token through an environment variable or credential store, not in a command that ends up in shell history.

## Import and review

1. On **Your flows**, choose **Import a form**.
2. For Google Forms, choose the response CSV and, if you have it, the `forms.get` definition JSON. If you want only an empty structure, choose the definition by itself. For Typeform, choose the definition JSON and, if you want the historical answers, its response CSV.
3. Choose **Review import**. Pencil reads the files and shows a report. Nothing is stored yet; **Cancel** at this point leaves no import job, flow or response.

### If you supplied only a Google CSV

Pencil creates a flat draft from the column headings and starts every question as short text. Observed values help you choose a type, but no type or choice list is applied automatically. Choose and confirm each question type yourself. If you choose Yes/No, confirm exactly two observed labels and which one means Yes and which means No; other values are row errors. Only choices present in the response rows can be seen. Unchosen choices and branching cannot be recovered from the CSV, and missing required settings and descriptions are named in the report. A combined checkbox cell stays an opaque whole value without the definition's complete option list; Pencil cannot reliably recover the separate selections from CSV alone.

### If you supplied a Google definition

Pencil maps text, radio/checkbox/dropdown, scales/ratings and full-year date questions without a time component, plus a bounded set of forward section paths. It carries the supported prompt, description, required state and fixed options. Email conversion and a two-option Yes/No conversion need your explicit choice. Grid items are skipped unless you explicitly map an individual grid-row CSV column as an ordinary question; grid layout, validation and paths are not recreated. Section navigation is supported only for single-choice, dropdown or confirmed Yes/No questions at the end of their section. A routed question with following items, a backward or same-section route, a restart, or a destination that is empty or begins with an omitted item stays incomplete. The report lists each item and path, whether it came across, what changed or was omitted, and why. File upload and time questions, partial dates without a year or dates that include time, quiz answer keys/scoring/feedback, validation rules, option shuffling, images/videos and unsupported restart or looping actions do not move across. Repair each affected path in the draft before publication, then check every path in **Preview**.

If you supplied the definition without a response CSV, the draft has no historical answers. The same supported-type and path omissions still appear in the review report.

### If you supplied a Typeform definition

Every field and logic jump is listed with its Typeform type, whether it was imported, changed or left out, what changed and why. Supported mappings include short/long text, email, single/multiple choice, picture choice (as single or multiple choice, without its pictures), checkbox (as multiple choice), dropdown, yes/no, rating/opinion scale, NPS, number, date, legal consent and complete ranking. Phone and website become short text of up to 200 characters; Typeform's checks on the format are lost. Other statements, grouped questions, file upload, payment, contact info, matrix, media, integrations, redirects, recall, calculations, hidden-variable conditions and unsupported validations are omitted or listed. A path the importer cannot reproduce is left unfinished. A calculation (add, subtract, multiply, divide or set) is listed as omitted and leaves the question's paths as they are. Repair it before publishing and inspect every path in **Preview**.

### Check CSV columns and row errors

Choose a question, timestamp or **Skip** for every CSV column. Repeated headings require an explicit mapping for each column. Google checkbox cells with a supplied definition use the whole-label comma-and-space rule above. Typeform's export splits a multiple-selection question into one column per option, headed by the option's label; when exactly one option of one such question has that label, Pencil suggests the question and option for you to review, and otherwise you choose. Typeform's **Start Date (UTC)** and **Submit Date (UTC)** columns are suggested as the start and submission times; the `#` response id, **Tags**, scores and hidden fields start as **Skip**. Google columns named **Email Address**, **Respondent email**, **Verified**, **Workspace identity** or **username** are **Skip** by default. You may explicitly map an ordinary email question to keep that answer as response data; doing so creates no contact, invitation or mail.

Every value Pencil cannot read is listed by row and column. No row is skipped silently. Correct the source file or mapping and refresh the report. You cannot import until all row errors are resolved. Hidden values, Typeform Network ID and network/IP columns are skipped or removed before durable planning.

The CSV reader preserves quoted commas, doubled quotes, Unicode and multiline cells; blank cells stay unanswered. Google dates accept `YYYY-MM-DD` or the selected source order; Typeform dates use `YYYY-MM-DD`. Numbers are plain finite decimals. Typeform yes/no and consent answers use `1` or `0`, or `true` or `false`. Google Yes/No answers must match the two exact labels you explicitly confirmed. A choice must exactly match one option label or source reference. With a Google definition, checkbox cells containing several selections use comma-space-separated whole labels that must match the source options unambiguously; a label containing the separator or an ambiguous match is rejected. Typeform multiple-choice or ranking cells that hold several values use a JSON list of exact labels, such as `["Coffee","Tea"]`; a comma inside a Typeform label is not a separator. Separate Typeform option columns can be mapped individually. A ranking must include every option once. Submission timestamps are required and never invented; optional start timestamps are retained. A blank historical answer stays unanswered, even if the question is required for future respondents.

Google Sheets scripts and spreadsheet settings are not imported. A Google email answer is data only; an imported response creates no contact, identity grant, respondent session, mail, notification, outbox event or invitation.

## Commit and continue the import

1. Tick the box that begins **I have reviewed every changed or unsupported field**. It confirms that you accept what the report says will be lost and that Pencil will not keep the original files.
2. Choose **Import reviewed form**. Pencil stores a private copy of the reviewed plan; no form or response exists until you continue it.
3. Under **Import history**, choose **Continue import**. Each heading shows progress, such as **applying · 3 / 10**. Choose **Pause after this batch** or close the page to stop. Work already done is kept; **Continue import** later resumes from the saved plan and does not need your source files again.
4. When the heading says **completed**, choose **Open the imported draft**.

If the page loses its connection, choose **Refresh history** to see where the import stands. Only the operator who started it can continue or undo it.

To abandon a preparation before it creates anything, choose **Cancel preparation**.

## What you get

- **An editable draft.** It has new stable Pencil IDs. For Google CSV-only imports, its structure is flat; with a definition, it contains the supported source structure and paths. For Typeform, it uses the reviewed definition. Edit and preview it before publishing.
- **A closed imported revision.** If you supplied a CSV, historical responses stay pinned to the reviewed source structure and retain their timestamps. Editing or publishing the draft does not change their meaning.
- **Results without false starts.** Imported responses appear in answers, the **Responses** card, the ledger and exports. They do not count as starts or change completion rate or average time.
- **No reconstructed identity.** Imported responses are anonymous, and importing sends no email. An ordinary email question you explicitly map is kept only as answer data.

Importing the same exact files again creates nothing new. A different export is a separate import and may overlap responses already brought in; Pencil does not deduplicate across different exports.

## Undo an import

Under **Import history**, choose **Undo import** and confirm. Pencil removes imported responses and the imported draft in batches. Choose **Continue undo** if it stops before finishing. If you edited the draft or its content since the import, Pencil preserves your edits, stops, and shows the conflict. Anything already removed stays removed. An import that stopped halfway can be undone the same way.

Undo does not delete the import's stored safe record, which includes the mapped answers. To erase one person's imported answers, erase that response from the ledger. That also removes it from the import record, in the same step, while everyone else in the same file can still be continued or undone. An erasure journal records how many records and which stores it changed, never the values. A response still waiting in an unfinished import is erased the same way once it has been imported. See [Erase a response](results.md#erase-a-response), and [Backup and restore](backup.md#refuse-an-archive-made-before-an-erasure) to keep an older archive from bringing it back.

## Leaving Pencil

Your data stays yours, and there are two ways to take it out:

- **To another Pencil installation**, back up product data and restore into an empty database. Credentials, sessions and private settings are excluded. The rer commands are local; hosted D1 recovery uses a separate script, all writers must be stopped, and you must separately provision an empty migration-only target. See [Backup and restore](backup.md).
- **For use anywhere else**, download responses from each flow's results page with **Export CSV** or **Export JSON**. See [Export responses](results.md#export-responses).

Pencil cannot export a form in Google Forms, Typeform or another builder's format. Your forms are in the backup archive as Pencil's own records.
