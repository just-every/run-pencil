import { useEffect, useState } from 'react'

type Connection = { saved: boolean; configured: boolean; provider: 'openai' | 'compatible' | 'models'; model: string; baseUrl: string; hasKey: boolean; inputRate?: number; outputRate?: number }
async function call<T>(method = 'GET', body?: unknown, suffix = ''): Promise<T> {
  const response = await fetch(`/api/app/connections/analysis${suffix}`, { method, credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
  const value = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(value.message ?? 'The provider connection could not be updated.')
  return value
}

export function ProviderConnection({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<Connection>(), [key, setKey] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false)
  const [note, setNote] = useState<{ error?: boolean; text: string }>()
  const load = async () => { setData(await call<Connection>()); setDirty(false) }
  useEffect(() => { load().catch(error => setNote({ error: true, text: error.message })) }, [])
  const act = async (operation: () => Promise<{ message: string }>) => {
    setBusy(true); setNote(undefined)
    try { const result = await operation(); setKey(''); await load(); setNote({ text: result.message }); onChanged() }
    catch (error) { setNote({ error: true, text: error instanceof Error ? error.message : 'Connection failed.' }) }
    finally { setBusy(false) }
  }
  const edit = (patch: Partial<Connection>) => { if (data) setData({ ...data, ...patch }); setDirty(true); setNote(undefined) }
  return <section aria-labelledby="connect-provider-title" style={{ marginTop: '1rem' }}>
    <h2 id="connect-provider-title">Connect analysis</h2>
    <p>Choose a provider, get its API key, then paste it here. Pencil saves the connection for this installation; no file editing or restart is needed. Only the installation owner can save or test it.</p>
    <p className="muted">There is no free hosted AI connection included. OpenAI’s API address and GPT-4.1 mini model are filled in as a starting point; your account needs model access and API billing. A ChatGPT subscription does not pay for API calls.</p>
    {data ? <form onSubmit={event => { event.preventDefault(); void act(() => call('PUT', { provider: data.provider, model: data.model, baseUrl: data.baseUrl, apiKey: key, ...(data.inputRate === undefined ? {} : { inputRate: data.inputRate }), ...(data.outputRate === undefined ? {} : { outputRate: data.outputRate }) })) }}>
      <label className="inspector-field">Analysis provider<select className="text-input" value={data.provider} disabled={busy} onChange={event => { const provider = event.target.value as Connection['provider']; edit({ provider, baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : '', model: provider === 'openai' ? 'gpt-4.1-mini' : '' }); setKey('') }}><option value="openai">OpenAI</option><option value="compatible">Other compatible provider</option><option value="models">Linked Models service</option></select></label>
      {data.provider === 'openai' ? <p><a className="analysis-link focus-ring" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Create an OpenAI API key</a> in your project and copy it when shown. Add credit or payment details in <a className="analysis-link focus-ring" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">API billing</a>. Check <a className="analysis-link focus-ring" href="https://developers.openai.com/api/docs/models/gpt-4.1-mini" target="_blank" rel="noreferrer">model access and current prices</a>.</p> : data.provider === 'models' ? <p>A Models service is a gateway operated by you or your organization, with its own billing and model access. Ask its administrator for the service HTTPS address, an app key, and an allowed model identifier. Pencil includes no Models account or public service. Paste those three values below; the service reports call costs.</p> : <p>Use a provider or gateway supporting the OpenAI <strong>Responses API with strict JSON-schema output</strong>. A chat-only API is insufficient. Get its API key from that provider’s account dashboard, and its API base address and model identifier from its API documentation. Anthropic and Google’s native API keys cannot be used directly; they need a compatible gateway. Provider availability and billing are separate from Pencil.</p>}
      <label className="inspector-field">API base address<input className="text-input" type="url" required value={data.baseUrl} readOnly={data.provider === 'openai'} disabled={busy} onChange={event => edit({ baseUrl: event.target.value })} /></label>
      <label className="inspector-field">Model identifier<input className="text-input" required value={data.model} disabled={busy} onChange={event => edit({ model: event.target.value })} /></label>
      <label className="inspector-field">Provider API key<input className="text-input" type="password" autoComplete="new-password" required value={key} disabled={busy} placeholder={data.hasKey ? 'A key is configured. Paste a key to replace it.' : 'Paste your provider key'} onChange={event => { setKey(event.target.value); setDirty(true) }} /></label>
      <details style={{ marginTop: '.8rem' }}><summary>Optional cost reporting for a direct key</summary><p>Copy the provider’s current USD prices per million input and output tokens. Leave both blank if unknown; Pencil reports usage with cost “not reported”. These rates do not set a spending limit; set that in your provider account.</p>
        <label className="inspector-field">Input USD per million tokens<input className="text-input" type="number" min="0" step="any" value={data.inputRate ?? ''} onChange={event => edit({ inputRate: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        <label className="inspector-field">Output USD per million tokens<input className="text-input" type="number" min="0" step="any" value={data.outputRate ?? ''} onChange={event => edit({ outputRate: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
      </details>
      <p>The key is encrypted on this installation and never shown again. Saved connections override deployment settings and are excluded from backups. Reconnect after restoring or changing the installation session secret.</p>
      <p>Saving enables AI for requests, rewrites and automatic analysis when a flow closes, if enabled in the Analysis settings below. Review that setting before connecting.</p>
      <div className="builder-actions"><button className="primary-button focus-ring" disabled={busy || !key.trim()} type="submit">Save provider</button><button className="quiet-button focus-ring" disabled={busy || dirty || !data.configured} type="button" onClick={() => void act(() => call('POST', {}, '/test'))}>Test saved provider</button>{data.saved ? <button className="quiet-button focus-ring" disabled={busy} type="button" onClick={() => void act(() => call('DELETE', {}))}>Use deployment settings</button> : null}</div>
      {dirty ? <p className="muted">Save these values before testing.</p> : null}
    </form> : <button className="quiet-button focus-ring" type="button" disabled={busy} onClick={() => void act(() => call('DELETE', {}))}>Remove saved provider connection</button>}
    <p className="muted">The test sends only “Connection test. Return ready as true.” and a small response schema to the saved model. It can incur a small API charge. No questions or respondent answers are sent. A pass checks key access and structured output; it does not guarantee the quality of an analysis.</p>
    <p className="muted">Analysis sends selected question wording and completed text answers with response IDs. Contact emails, names and network addresses are excluded. Pencil requests no storage, but your provider’s retention policy still applies. Review selected questions before sending; do not select fields that collect identifying details.</p>
    {note ? <p className="status-note" data-tone={note.error ? 'error' : 'success'} role={note.error ? 'alert' : 'status'}>{note.text}</p> : null}
  </section>
}
