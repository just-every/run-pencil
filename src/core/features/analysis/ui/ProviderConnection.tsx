import { useEffect, useState } from 'react'
import { ProviderSetup, compatibleAddress, compatibleModel } from './ProviderSetup'

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
    <p className="muted">Your selected service needs model access and API billing. Pencil includes no free hosted AI plan. A ChatGPT subscription does not pay for API calls.</p>
    {data ? <form onSubmit={event => { event.preventDefault(); void act(() => call('PUT', { provider: data.provider, model: data.model, baseUrl: data.baseUrl, apiKey: key, ...(data.provider === 'models' || data.inputRate === undefined ? {} : { inputRate: data.inputRate }), ...(data.provider === 'models' || data.outputRate === undefined ? {} : { outputRate: data.outputRate }) })) }}>
      <label className="inspector-field">Analysis provider<select className="text-input" value={data.provider} disabled={busy} onChange={event => { const provider = event.target.value as Connection['provider']; edit({ provider, baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'compatible' ? compatibleAddress : '', model: provider === 'openai' ? 'gpt-4.1-mini' : provider === 'compatible' ? compatibleModel : '', inputRate: undefined, outputRate: undefined }); setKey('') }}><option value="openai">OpenAI</option><option value="compatible">Other compatible provider</option><option value="models">Linked Models service</option></select></label>
      <ProviderSetup provider={data.provider} baseUrl={data.baseUrl} />
      <label className="inspector-field">{data.provider === 'models' ? 'Models service HTTPS address' : 'API base address'}<input className="text-input" type="url" required value={data.baseUrl} readOnly={data.provider === 'openai'} disabled={busy} onChange={event => edit({ baseUrl: event.target.value })} /></label>
      <label className="inspector-field">Model identifier<input className="text-input" required value={data.model} disabled={busy} onChange={event => edit({ model: event.target.value })} /></label>
      <label className="inspector-field">{data.provider === 'models' ? 'Models app key' : 'Provider API key'}<input className="text-input" type="password" autoComplete="new-password" required value={key} disabled={busy} placeholder={data.hasKey ? 'A key is configured. Paste a key to replace it.' : data.provider === 'models' ? 'Paste the app key issued for Pencil' : 'Paste your provider key'} onChange={event => { setKey(event.target.value); setDirty(true) }} /></label>
      {data.provider !== 'models' ? <details style={{ marginTop: '.8rem' }}><summary>Optional cost reporting for a direct key</summary><p>Copy the provider’s current USD prices per million input and output tokens. Leave both blank if unknown; Pencil reports usage with cost “not reported”. These rates do not set a spending limit; set that in your provider account.</p>
        <label className="inspector-field">Input USD per million tokens<input className="text-input" type="number" min="0" step="any" value={data.inputRate ?? ''} onChange={event => edit({ inputRate: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        <label className="inspector-field">Output USD per million tokens<input className="text-input" type="number" min="0" step="any" value={data.outputRate ?? ''} onChange={event => edit({ outputRate: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
      </details> : null}
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
