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
      <details>
        <summary className="focus-ring">How to get Google Forms files</summary>
        <ol>
          <li>Open your form and choose <strong>Responses → More (⋮) → Download responses (.csv)</strong>. Or open its linked response Sheet and choose <strong>File → Download → Comma-separated values (.csv)</strong>. <a href="https://support.google.com/docs/answer/139706?hl=en">Google’s response export help</a>.</li>
          <li>Open the linked response Sheet (use <strong>Responses → Link to Sheets</strong> if needed). Note its time zone under <strong>File → Settings → General</strong>. Enter its IANA name below, including when you download directly from Forms.</li>
          <li>For the optional definition, open Google’s <a href="https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/get">forms.get method</a> and use <strong>Try it</strong> in your own Google account. Supply the form ID from its edit link, between <code>/d/</code> and <code>/edit</code>. Save the returned JSON as a <code>.json</code> file. Response rows need the separate CSV.</li>
        </ol>
        <p>A CSV alone makes flat short-text questions to retype in review; a definition adds types, options and paths. <a href="/docs/moving-in">Read the moving-in guide</a>.</p>
      </details>
    </> : <>
      <details>
        <summary className="focus-ring">How to get Typeform files</summary>
        <ol>
          <li>Use <strong>Get your form from Typeform</strong> below: open the linked Personal tokens page, create a token with permission to read forms, and enter it with your form link. <strong>Test connection and get form</strong> loads the definition here. You do not need to save a file or make an API request yourself. A results CSV contains answers and cannot replace the definition.</li>
          <li>For optional answers, open the form on desktop and choose <strong>Results → Responses</strong>. Select the responses, choose <strong>Export</strong>, then <strong>CSV</strong>. Keep the <strong>Submit Date (UTC)</strong> column; every imported response needs its original submission time. Keep <strong>Start Date (UTC)</strong> too if available. <a href="https://help.typeform.com/hc/en-us/articles/360029253572-Export-your-responses">Typeform’s export instructions</a>.</li>
        </ol>
        <p><a href="/docs/moving-in">Read the moving-in guide</a>.</p>
      </details>
    </>}
    <details>
      <summary className="focus-ring">See example {google ? 'Google Forms' : 'Typeform'} file contents</summary>
      <p><strong>{google ? 'responses.csv' : 'form.json'}</strong></p>
      <pre><code>{google ? googleResponses : typeformDefinition}</code></pre>
      <p><strong>{google ? 'form.json (optional forms.get definition)' : 'responses.csv (optional)'}</strong></p>
      <pre><code>{google ? googleDefinition : typeformResponses}</code></pre>
    </details>
  </div>
}
