import { useState, type FormEvent } from 'react'

type Counts = { responses: number; partials: number; contacts: number; paymentReferences: number }
type Integration = { name: string; flowId: string | null; supportsDeletion: boolean; detail: string }
type Lookup = { counts: Counts; forms: Array<{ id: string; title: string }>; integrations: Integration[] }
type Receipt = { completed: true; counts: Counts; integrations: Integration[] }
type Operation = 'lookup' | 'export' | 'erase'

async function request(operation: Operation, identifier: string): Promise<Response> {
  const response = await fetch(`/api/app/privacy/${operation}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation === 'erase' ? { identifier, confirm: true } : { identifier }),
  })
  if (!response.ok) {
    const failure = await response.json() as { message?: string }
    throw new Error(failure.message || 'The privacy request could not be completed.')
  }
  return response
}

function DataCounts({ counts }: { counts: Counts }) {
  return <ul>
    <li>{counts.responses} responses</li>
    <li>{counts.partials} partial responses</li>
    <li>{counts.contacts} contacts</li>
    <li>{counts.paymentReferences} payment references</li>
  </ul>
}

function IntegrationList({ integrations }: { integrations: Integration[] }) {
  return <ul>{integrations.map((integration, index) => <li key={`${integration.name}-${integration.flowId}-${index}`}>
    <strong>{integration.name}</strong>: {integration.supportsDeletion ? 'Deletion supported.' : 'External deletion needs follow-up.'} {integration.detail}
  </li>)}</ul>
}

export function PrivacyRequests() {
  const [identifier, setIdentifier] = useState('')
  const [result, setResult] = useState<Lookup>()
  const [receipt, setReceipt] = useState<Receipt>()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<Operation>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const run = async (operation: Operation) => {
    if (busy || !identifier.trim() || (operation === 'erase' && (!result || !confirmed))) return
    setBusy(operation)
    setError(undefined)
    setNotice(undefined)
    if (operation === 'lookup') { setResult(undefined); setReceipt(undefined); setConfirmed(false) }
    try {
      const response = await request(operation, identifier.trim())
      if (operation === 'lookup') {
        setResult(await response.json() as Lookup)
      } else if (operation === 'export') {
        const url = URL.createObjectURL(await response.blob())
        const link = document.createElement('a')
        link.href = url
        link.download = 'privacy-request.json'
        document.body.appendChild(link)
        try { link.click() } finally { link.remove(); URL.revokeObjectURL(url) }
        setNotice('Portable JSON download prepared.')
      } else {
        const completed = await response.json() as Receipt
        if (completed.completed !== true) throw new Error('Erasure was not confirmed by the server. Find linked data again before continuing.')
        setIdentifier('')
        setResult(undefined)
        setConfirmed(false)
        setReceipt(completed)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The privacy request could not be completed.')
    } finally { setBusy(undefined) }
  }

  const lookup = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run('lookup') }
  return <section className="panel settings-card" aria-labelledby="privacy-requests-title" aria-busy={!!busy}>
    <h2 className="display" id="privacy-requests-title">Privacy requests</h2>
    <details>
      <summary className="focus-ring">Find, export or erase linked data</summary>
      <p>Search across forms using the person’s email or phone number.</p>
      <form onSubmit={lookup}>
        <label className="inspector-field">Email or phone
          <input className="text-input" type="text" autoComplete="off" required disabled={!!busy} value={identifier} onChange={event => {
            setIdentifier(event.target.value)
            setResult(undefined)
            setReceipt(undefined)
            setConfirmed(false)
            setError(undefined)
            setNotice(undefined)
          }} />
        </label>
        <div className="builder-actions">
          <button className="secondary-button focus-ring" type="submit" disabled={!!busy || !identifier.trim()}>{busy === 'lookup' ? 'Finding linked data…' : 'Find linked data'}</button>
        </div>
      </form>
      {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
      {notice ? <p className="status-note" role="status">{notice}</p> : null}
      {result ? <div>
        <h3>Linked data</h3>
        <DataCounts counts={result.counts} />
        <h3>Forms</h3>
        {result.forms.length ? <ul>{result.forms.map(form => <li key={form.id}>{form.title}</li>)}</ul> : <p>No linked forms found.</p>}
        <h3>Integrations</h3>
        {result.integrations.length ? <IntegrationList integrations={result.integrations} /> : <p>No linked integrations found.</p>}
        <button className="secondary-button focus-ring" type="button" disabled={!!busy} onClick={() => void run('export')}>{busy === 'export' ? 'Preparing download…' : 'Download portable JSON'}</button>
        <h3>Erase linked data</h3>
        <p>Erasure permanently removes linked responses, partial responses, contacts and local payment references. It cannot be undone. External copies need follow-up where an integration cannot delete them; deleting local payment references does not erase provider records.</p>
        <label className="inspector-field">
          <span><input type="checkbox" checked={confirmed} disabled={!!busy} onChange={event => setConfirmed(event.target.checked)} /> I confirm erasure of all linked data</span>
        </label>
        <div className="builder-actions">
          <button className="secondary-button danger-quiet focus-ring" type="button" disabled={!!busy || !confirmed} onClick={() => void run('erase')}>{busy === 'erase' ? 'Erasing linked data…' : 'Confirm privacy erasure'}</button>
        </div>
      </div> : null}
      {receipt ? <div role="status">
        <h3>Privacy erasure completed</h3>
        <p>Removed linked data:</p>
        <DataCounts counts={receipt.counts} />
        {receipt.integrations.some(integration => !integration.supportsDeletion) ? <>
          <h3>External follow-up required</h3>
          <IntegrationList integrations={receipt.integrations.filter(integration => !integration.supportsDeletion)} />
        </> : <p>No unsupported integrations were reported.</p>}
      </div> : null}
    </details>
  </section>
}
