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
      <p><strong>Start with your response CSV.</strong> Pencil makes an editable draft from its column headings. Add a Google Forms definition JSON to bring across supported question types, options and paths. A definition alone imports the structure without historical answers.</p>
      <p className="muted">CSV alone starts with flat short-text questions. You choose their types during review; missing options and branching cannot be recovered from responses.</p>
      <details>
        <summary className="focus-ring">How to get Google Forms files</summary>
        <ol>
          <li>Open your form and choose <strong>Responses → More (⋮) → Download responses (.csv)</strong>. Or open its linked response Sheet and choose <strong>File → Download → Comma-separated values (.csv)</strong>. <a href="https://support.google.com/docs/answer/139706?hl=en">Google’s response export help</a>.</li>
          <li>Open the linked response Sheet (use <strong>Responses → Link to Sheets</strong> if needed). Note its time zone under <strong>File → Settings → General</strong>. Enter its IANA name below, including when you download directly from Forms.</li>
          <li>For the optional definition, open Google’s <a href="https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get">forms.get method</a> and use <strong>Try it</strong> in your own Google account. Supply the form ID from its edit link, between <code>/d/</code> and <code>/edit</code>. Save the returned JSON as a <code>.json</code> file. Response rows need the separate CSV.</li>
        </ol>
      </details>
    </> : <>
      <p><strong>A Typeform form definition JSON is required.</strong> It describes the questions and paths. Add a response CSV from the same form to include historical answers, or leave it out to import the structure alone.</p>
      <details>
        <summary className="focus-ring">How to get Typeform files</summary>
        <ol>
          <li>Get the definition from Typeform’s <a href="https://www.typeform.com/developers/create/reference/retrieve-form/">Retrieve form API</a>: <code>GET https://api.typeform.com/forms/&#123;form_id&#125;</code>. The form ID is in its Typeform URL. Generate a <a href="https://www.typeform.com/developers/get-started/personal-access-token/">personal token</a> under <strong>Account → Personal tokens</strong> and use it as Bearer authorization in your own API client or command-line tool. Save the returned JSON as a <code>.json</code> file; keep the token out of that file. A results export contains answers, so it cannot replace this definition.</li>
          <li>For optional answers, open the form on desktop and choose <strong>Results → Responses</strong>. Select the responses, choose <strong>Export</strong>, then <strong>CSV</strong>. Keep the <strong>Submit Date (UTC)</strong> column; every imported response needs its original submission time. Keep <strong>Start Date (UTC)</strong> too if available. <a href="https://help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses">Typeform’s export instructions</a>.</li>
        </ol>
      </details>
    </>}
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
