import { useRef, useState } from 'react'

export function TypeformConnection({ busy, loadedTitle, load }: { busy: boolean; loadedTitle: string; load: (form: string, token: string) => Promise<void> }) {
  const token = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(''), [working, setWorking] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState('')
  const copy = async (value: string, label: string) => {
    setCopied('')
    try { await navigator.clipboard.writeText(value); setCopied(`${label} copied.`) }
    catch { setCopied(`Copy is unavailable in this browser. Select and copy ${value} above.`) }
  }
  const retrieve = async () => {
    const credential = token.current?.value.trim() ?? ''
    if (token.current) token.current.value = ''
    setError(''); setWorking(true)
    try {
      if (!credential) throw new Error('Paste the personal token you generated in Typeform, then try again.')
      await load(form, credential)
    } catch (e) { setError(e instanceof Error ? e.message : 'The Typeform connection could not be checked. Try again.') }
    finally { setWorking(false) }
  }
  return <fieldset className="typeform-connection" disabled={busy || working}>
    <legend>Get your form from Typeform</legend>
    <p>Fetch the questions and paths here. You only need your Typeform account; no terminal or API client is needed.</p>
    <ol>
      <li>Open your form in <a href="https://admin.typeform.com/" target="_blank" rel="noreferrer">Typeform</a> and copy its address from the browser, or its Share link.</li>
      <li>Open <a href="https://admin.typeform.com/user/tokens" target="_blank" rel="noreferrer">Typeform → Account → Personal tokens</a> and choose <strong>Generate a new token</strong>. Name it <strong>Pencil import</strong> <button type="button" className="quiet-button focus-ring" onClick={() => void copy('Pencil import', 'Token name')}>Copy token name</button>. Select only the permission to read forms, <code>forms:read</code> <button type="button" className="quiet-button focus-ring" onClick={() => void copy('forms:read', 'Permission')}>Copy permission</button>, then generate and copy the token. <a href="https://www.typeform.com/developers/get-started/personal-access-token/" target="_blank" rel="noreferrer">Typeform’s token instructions</a>.</li>
      <li>Paste the form link and token below, then choose <strong>Test connection and get form</strong>.</li>
    </ol>
    {copied ? <p role="status">{copied}</p> : null}
    <label className="inspector-field">Typeform form link or ID<input className="text-input" type="text" value={form} maxLength={2048} placeholder="https://example.typeform.com/to/AbCd1234" onChange={e => { setForm(e.target.value); setError('') }} /></label>
    <p className="muted">For a custom domain, use the ID from the Typeform edit link: the part after <code>/form/</code> or <code>/to/</code>.</p>
    <label className="inspector-field">Typeform personal token<input className="text-input" ref={token} type="password" autoComplete="off" maxLength={1024} spellCheck={false} autoCapitalize="none" /></label>
    <p className="muted">Pencil sends this token through your installation to api.typeform.com for this request only. If the form has a share image, Pencil also retrieves that image from images.typeform.com without sending the token. Redirects are refused. The token is cleared when you click the button and is never saved in settings or import history. After loading the form, delete the token on Typeform’s Personal tokens page.</p>
    <button type="button" className="secondary-button focus-ring" disabled={!form.trim() || busy || working} onClick={() => void retrieve()}>{working ? 'Getting your form…' : 'Test connection and get form'}</button>
    {error ? <p role="alert" className="status-note" data-tone="error">{error}</p> : null}
    {loadedTitle ? <p role="status"><strong>Definition ready: {loadedTitle}.</strong> The connection worked. Add a response CSV below if you want historical answers, then choose <strong>Review import</strong>. No form or responses have been created yet.</p> : null}
  </fieldset>
}
