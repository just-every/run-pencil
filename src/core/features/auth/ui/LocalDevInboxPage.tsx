import { ArrowLeft, ExternalLink, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../app/api'
import { BrandMark } from '../../../app/ui/BrandMark'
import type { PublicSeedConfig } from '../../../shared/config'

type Message = { id: string; toEmail: string; magicLinkToken: string; expiresAt: string; createdAt: string }

export function LocalDevInboxPage({ config, email }: { config: PublicSeedConfig; email: string }) {
  const [messages, setMessages] = useState<Message[]>()
  const [error, setError] = useState<string>()
  useEffect(() => { api.localInbox(email).then((response) => setMessages(response.messages)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The local inbox could not load.')) }, [email])
  return <main className="pencil-canvas respondent-shell">
    <section className="panel" style={{ width: 'min(100%, 44rem)', padding: 'clamp(1.5rem, 6vw, 3rem)' }} aria-labelledby="inbox-title">
      <BrandMark name={config.productName} />
      <p className="eyebrow" style={{ marginTop: '2rem' }}>Local development only</p>
      <h1 className="display" id="inbox-title" style={{ margin: '.5rem 0', fontSize: 'clamp(2.4rem, 6vw, 4rem)' }}>Magic-link inbox</h1>
      <p className="muted">Messages for {email || 'the requested address'} are stored in local D1 only when local mail was selected explicitly.</p>
      {error ? <p className="status-note" data-tone="error">{error}</p> : null}
      {!messages && !error ? <p className="status-note">Loading local messages…</p> : null}
      {messages?.length === 0 ? <p className="status-note">No local message is available for this address.</p> : null}
      <div style={{ display: 'grid', gap: '.75rem', marginTop: '1.25rem' }}>
        {messages?.map((message) => <article className="quiet-panel" key={message.id} style={{ padding: '1rem' }}><MailCheck aria-hidden="true" color="var(--violet)" size={19} /><p style={{ margin: '.6rem 0 .25rem' }}>Magic link requested {new Date(message.createdAt).toLocaleString()}</p><p className="muted" style={{ margin: 0, fontSize: '.85rem' }}>Expires {new Date(message.expiresAt).toLocaleString()}</p><a className="secondary-button focus-ring" href={`/auth/confirm?token=${message.magicLinkToken}`} style={{ marginTop: '.8rem' }}>Use this magic link <ExternalLink aria-hidden="true" size={16} /></a></article>)}
      </div>
      <a className="quiet-button focus-ring" href="/signin" style={{ marginTop: '1.25rem' }}><ArrowLeft aria-hidden="true" size={16} /> Back to sign in</a>
    </section>
  </main>
}
