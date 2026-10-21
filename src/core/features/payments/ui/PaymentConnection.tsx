import { CreditCard } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../../app/api'

export type PaymentConnectionStatus = { saved: boolean; mode: 'test' | 'live' | null; restricted: boolean | null; webhookUrl: string }
const path = '/api/app/connections/payment'
export const stripeWebhookEvents = ['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'payment_intent.payment_failed', 'charge.refunded']

async function connectionRequest<T>(method: 'GET' | 'PUT' | 'DELETE' | 'POST', url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const value = await response.json().catch(() => ({})) as T & { error?: string; message?: string }
  if (!response.ok) throw new ApiError(value.error ?? 'REQUEST_FAILED', value.message ?? 'The Stripe connection request failed.', response.status)
  return value
}
export const paymentConnectionStatus = () => connectionRequest<PaymentConnectionStatus>('GET', path)

/** PAY-001: the owner connects Stripe with a restricted key and the signing secret of a webhook endpoint they created.
 * Both are sealed like the Todoist token: never shown again, never in backups, sent only to Stripe or used to verify it. */
export function PaymentConnection() {
  const [status, setStatus] = useState<PaymentConnectionStatus>()
  const [secretKey, setSecretKey] = useState(''), [webhookSecret, setWebhookSecret] = useState('')
  const [busy, setBusy] = useState<string>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>()
  const run = async (name: string, work: () => Promise<void>) => {
    setBusy(name); setError(undefined); setNotice(undefined)
    try { await work() } catch (reason) { setError(reason instanceof Error ? reason.message : 'The Stripe connection request failed.') } finally { setBusy(undefined) }
  }
  useEffect(() => { void run('load', async () => setStatus(await paymentConnectionStatus())) }, [])
  const save = (event: FormEvent) => { event.preventDefault(); void run('save', async () => { setStatus(await connectionRequest('PUT', path, { secretKey: secretKey.trim(), webhookSecret: webhookSecret.trim() })); setSecretKey(''); setWebhookSecret(''); setNotice('Stripe connection saved. Test it before publishing a payment form.') }) }
  return <section className="panel settings-card" aria-labelledby="payment-connection-title">
    <header className="card-title"><CreditCard aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display" id="payment-connection-title">Payments</h2></header>
    <p>Respondents pay on Stripe Checkout, Stripe’s hosted page. Pencil sends Stripe each order’s items and amounts and never receives card or bank details.</p>
    {status ? <p className="muted">{status.saved ? `Stripe is connected in ${status.mode} mode with a ${status.restricted ? 'restricted' : 'secret'} key. The key and signing secret are never shown again.` : 'Stripe is not connected. Payment forms cannot take payments until it is.'}</p> : <p className="muted" role="status">{busy === 'load' ? 'Loading the Stripe connection…' : 'The Stripe connection could not load.'}</p>}
    <details className="payment-setup"><summary className="focus-ring">How to connect Stripe</summary>
      <ol className="muted">
        <li>In the Stripe Dashboard, create a restricted key with write access to Checkout Sessions.</li>
        <li>Add a webhook endpoint at <code>{status?.webhookUrl ?? '/api/public/payments/stripe'}</code> for these events: {stripeWebhookEvents.map(event => <code key={event}>{event} </code>)}</li>
        <li>Paste the restricted key and the endpoint’s signing secret below.</li>
      </ol>
    </details>
    <p className="muted">Only the installation owner can save, test or remove the connection. Saved values are encrypted, excluded from backups, and sent only to Stripe.</p>
    <form onSubmit={save}>
      <fieldset disabled={!!busy || !status} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <label className="inspector-field">Stripe restricted key<input className="text-input" type="password" required maxLength={260} autoComplete="new-password" placeholder="rk_test_…" value={secretKey} onChange={event => setSecretKey(event.target.value)} /></label>
        <label className="inspector-field">Webhook signing secret<input className="text-input" type="password" required maxLength={260} autoComplete="new-password" placeholder="whsec_…" value={webhookSecret} onChange={event => setWebhookSecret(event.target.value)} /></label>
        <div className="builder-actions">
          <button className="secondary-button focus-ring" type="submit" disabled={!secretKey.trim() || !webhookSecret.trim()}>{busy === 'save' ? 'Saving…' : 'Save Stripe connection'}</button>
          {status?.saved ? <button className="quiet-button focus-ring" type="button" onClick={() => void run('test', async () => setNotice((await connectionRequest<{ message: string }>('POST', `${path}/test`, {})).message))}>{busy === 'test' ? 'Testing…' : 'Test connection'}</button> : null}
          {status?.saved ? <button className="quiet-button focus-ring" type="button" onClick={() => { if (window.confirm('Remove the Stripe connection? Payment forms stop taking payments until it is saved again.')) void run('remove', async () => { setStatus(await connectionRequest('DELETE', path)); setNotice('Stripe connection removed.') }) }}>Remove connection</button> : null}
        </div>
      </fieldset>
    </form>
    {notice ? <p className="status-note" role="status">{notice}</p> : null}
    {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
  </section>
}
