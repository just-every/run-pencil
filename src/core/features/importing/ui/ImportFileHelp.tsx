import type { ImportSource } from '../model'

const typeformDefinition = `{
  "title": "Visit feedback",
  "fields": [
    { "ref": "visit", "type": "short_text", "title": "How was your visit?" }
  ]
}`
const typeformResponses = `Submit Date (UTC),How was your visit?
2026-10-15 09:30:00,Helpful staff`
const googleResponses = `Timestamp,How was your visit?
15/10/2026 09:30:00,Helpful staff`
const googleDefinition = `{
  "info": { "title": "Visit feedback" },
  "items": [{
    "itemId": "visit-item",
    "title": "How was your visit?",
    "questionItem": {
      "question": { "questionId": "visit", "textQuestion": {} }
    }
  }]
}`

export function ImportFileHelp({ source }: { source: ImportSource }) {
  const google = source === 'google-forms'
  return <div className="import-file-help">
    {google ? <>
      <p><strong>Choose a response CSV, or response JSON with its matching form definition.</strong> A CSV makes an editable draft from its column headings. A Google Forms definition brings across supported question types, options and paths. A definition alone imports the structure without historical answers.</p>
      <p className="muted">CSV alone starts with flat short-text questions. You choose their types during review; missing options and branching cannot be recovered from responses.</p>
      <details>
        <summary className="focus-ring">How to get Google Forms files</summary>
        <ol>
          <li>Open your form and choose <strong>Responses → More (⋮) → Download responses (.csv)</strong>. Or open its linked response Sheet and choose <strong>File → Download → Comma-separated values (.csv)</strong>. <a href="https://support.google.com/docs/answer/139706?hl=en">Google’s response export help</a>.</li>
          <li>Open the linked response Sheet (use <strong>Responses → Link to Sheets</strong> if needed). Note its time zone under <strong>File → Settings → General</strong>. Enter its IANA name below, including when you download directly from Forms.</li>
          <li>For the optional definition, open Google’s <a href="https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get">forms.get method</a> and use <strong>Try it</strong> in your own Google account. Supply the form ID from its edit link, between <code>/d/</code> and <code>/edit</code>. Save the returned JSON as a <code>.json</code> file. Response rows use the separate CSV or response JSON.</li>
        </ol>
      </details>
    </> : <>
      <p><strong>Start by getting your Typeform form below.</strong> Pencil loads its questions and paths directly. You can also upload a definition JSON you already saved. Add response CSV or response JSON from the same form to include historical answers, or leave it out to import the structure alone.</p>
      <details>
        <summary className="focus-ring">How to get Typeform files</summary>
        <ol>
          <li>Use <strong>Get your form from Typeform</strong> below: open the linked Personal tokens page, create a token with permission to read forms, and enter it with your form link. <strong>Test connection and get form</strong> loads the definition here. You do not need to save a file or make an API request yourself. A results CSV contains answers and cannot replace the definition.</li>
          <li>For optional answers, open the form on desktop and choose <strong>Results → Responses</strong>. Select the responses, choose <strong>Export</strong>, then <strong>CSV</strong>. Keep the <strong>Submit Date (UTC)</strong> column; every imported response needs its original submission time. Keep <strong>Start Date (UTC)</strong> too if available. <a href="https://help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses">Typeform’s export instructions</a>.</li>
        </ol>
      </details>
    </>}
    <details>
      <summary className="focus-ring">Preserve Other write-ins with response JSON</summary>
      <p>Upload the matching form definition and choose Responses API JSON below. {google ? <>Use Google’s <a href="https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses/list">forms.responses.list</a> in your own account.</> : <>Use Typeform’s <a href="https://www.typeform.com/developers/responses/reference/retrieve-responses/">Retrieve responses</a> endpoint with permission to read your form’s responses.</>} Save a complete JSON resource containing all response pages. A resource that still reports more pages is refused, so omitted pages cannot be mistaken for a complete import.</p>
      <p>Google records each checkbox answer separately in JSON, preserving commas within an Other write-in. A Google checkbox CSV with Other and comma-separated values is refused because it cannot distinguish separate options from that text. Every row still needs its original submission time. Response IDs, collected account email and source authentication identity are discarded.</p>
    </details>
    <details>
      <summary className="focus-ring">See example {google ? 'Google Forms' : 'Typeform'} file contents</summary>
      <p>Illustrative format only, with invented answers. These examples are not exports from a real account.</p>
      <p><strong>{google ? 'responses.csv' : 'form.json'}</strong></p>
      <pre><code>{google ? googleResponses : typeformDefinition}</code></pre>
      <p><strong>{google ? 'form.json (optional forms.get definition)' : 'responses.csv (optional)'}</strong></p>
      <pre><code>{google ? googleDefinition : typeformResponses}</code></pre>
      <p className="muted">{google ? 'The CSV example uses day / month / year. Choose the source Sheet’s zone and compare the timestamp preview with the original Sheet.' : 'The CSV header matches the question’s title; the timestamp is UTC.'} Review every mapping before importing your own files.</p>
    </details>
  </div>
}
