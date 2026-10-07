import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrandMark } from '../../../app/ui/BrandMark'
import { api } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'

export function SignInPage({ config, invalid, notice }: { config: PublicSeedConfig; invalid?: string; notice?: 'access-removed' }) {
  const [email, setEmail] = useState('')
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const [status, setStatus] = useState<'form' | 'sending' | 'sent'>('form')
  const [delivery, setDelivery] = useState<'local' | 'email'>()
  const [error, setError] = useState(invalid)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('sending')
    setError(undefined)
    try {
      const response = await api.requestMagicLink(email)
      setDelivery(response.delivery)
      setStatus('sent')
    } catch (reason) {
      setStatus('form')
      setError(reason instanceof Error ? reason.message : 'The magic link could not be requested.')
    }
  }

  return <main className="pencil-canvas respondent-shell" data-hydrated={hydrated}>
    <section className="panel" style={{ width: 'min(100%, 31rem)', padding: 'clamp(1.5rem, 6vw, 3rem)' }} aria-labelledby="sign-in-title">
      <BrandMark name={config.productName} />
      <p className="eyebrow" style={{ marginTop: '3rem' }}>Operator access</p>
      <h1 id="sign-in-title" className="display" style={{ margin: '.6rem 0 0', fontSize: 'clamp(2.8rem, 8vw, 4.5rem)', lineHeight: '.94' }}>Sign in</h1>
      {notice === 'access-removed' ? <p className="status-note" role="status">Your operator access was removed. Use another operator email to sign in.</p> : null}
      {status === 'sent' ? <>
        <p className="muted" style={{ lineHeight: 1.55 }}>A magic link was requested for <strong style={{ color: 'var(--ink)' }}>{email}</strong>. If this address is an operator, use the one-time link that was delivered.</p>
        <div style={{ display: 'grid', gap: '.75rem', marginTop: '1.5rem' }}>
          {delivery === 'local' ? <a className="primary-button focus-ring" href={`/signin/inbox?email=${encodeURIComponent(email)}`}><MailCheck aria-hidden="true" size={18} /> Open local dev inbox</a> : null}
          <button className="quiet-button focus-ring" onClick={() => setStatus('form')} type="button"><ArrowLeft aria-hidden="true" size={17} /> Use another email</button>
        </div>
      </> : <form onSubmit={submit}>
        <p className="muted" style={{ lineHeight: 1.55 }}>Enter your operator email to receive a one-time sign-in link.</p>
        <label className="inspector-field" style={{ marginTop: '1.5rem' }}>Operator email<input disabled={!hydrated || status === 'sending'} autoComplete="email" className="text-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
        <button className="primary-button focus-ring" disabled={!hydrated || status === 'sending'} style={{ marginTop: '1.25rem', width: '100%' }} type="submit">{status === 'sending' ? 'Requesting…' : 'Send magic link'} <ArrowRight aria-hidden="true" size={17} /></button>
      </form>}
    </section>
  </main>
}
