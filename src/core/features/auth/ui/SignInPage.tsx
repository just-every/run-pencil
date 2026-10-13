import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrandMark } from '../../../app/ui/BrandMark'
import { NoteIllustration } from '../../../app/ui/NoteIllustration'
import { api } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { HydrationUnit } from '../../../../base/hydration/unit'

export function SignInPage({ config, invalid, notice }: { local?: boolean; config: Pick<PublicSeedConfig, 'productName'>; invalid?: string; notice?: 'access-removed' }) {
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
      const response = await api.requestMagicLink(email, '/setup')
      setDelivery(response.delivery)
      setStatus('sent')
    } catch (reason) {
      setStatus('form')
      setError(reason instanceof Error ? reason.message : 'The magic link could not be requested.')
    }
  }

  return <main className="pencil-canvas access-shell" data-hydrated={hydrated}>
    <HydrationUnit><section className="panel access-card" aria-labelledby="sign-in-title">
      <BrandMark name={config.productName} />
      <p className="eyebrow">Operator access</p>
      <h1 id="sign-in-title" className="display">Sign in</h1>
      {notice === 'access-removed' ? <p className="status-note" role="status">Your operator access was removed. Use another operator email to sign in.</p> : null}
      {status === 'sent' ? <>
        <p className="muted">{delivery === 'local' ? 'If this address is an operator, its sign-in link is in the local outbox.' : 'Check your email. If this address is an operator, a sign-in link is on its way.'} The link works once and expires in 15 minutes.</p>
        <div className="access-actions">
          {delivery === 'local' ? <a className="primary-button focus-ring" href="/__dev/outbox"><MailCheck aria-hidden="true" size={18} /> Open the local outbox</a> : null}
          <button className="quiet-button focus-ring" onClick={() => setStatus('form')} type="button"><ArrowLeft aria-hidden="true" size={17} /> Use another email</button>
        </div>
      </> : <form onSubmit={submit}>
        <p className="muted">Enter your operator email to receive a one-time sign-in link.</p>
        <label className="inspector-field">Operator email<input disabled={!hydrated || status === 'sending'} autoComplete="email" className="text-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
        <button className="primary-button focus-ring" disabled={!hydrated || status === 'sending'} type="submit">{status === 'sending' ? 'Requesting…' : 'Send magic link'} <ArrowRight aria-hidden="true" size={17} /></button>
      </form>}
      <p className="access-docs"><a href="/docs">Read the docs</a></p>
    </section></HydrationUnit>
    <NoteIllustration className="access-art" variant="question" />
  </main>
}
