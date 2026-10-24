import { QrKioskControls } from '../../collectors'
import { Copy } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { BuilderDraft } from '../../../app/api'
import type { FormSettings } from '../../../shared/hiddenFields'
import { FlowLinkPreview } from './FlowLinkPreview'

export function flowShareLinks(origin: string, slug: string) {
  return {
    scriptCode: `<script async src="${new URL(`/embed.js?flow=${encodeURIComponent(slug)}`, origin).href}" referrerpolicy="origin"></script>`,
    publicUrl: new URL(`/f/${encodeURIComponent(slug)}`, origin).href,
    embedCode: `<iframe src="${new URL(`/embed/${encodeURIComponent(slug)}`, origin).href}" title="Feedback form" width="100%" height="700" sandbox="allow-scripts allow-forms" referrerpolicy="origin" style="border:0"></iframe>`,
  }
}

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const id = useId()
  const field = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [copying, setCopying] = useState(false)
  const [message, setMessage] = useState<string>()
  const [failed, setFailed] = useState(false)
  const copy = async () => {
    if (copying) return
    setCopying(true); setMessage(undefined)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setFailed(false); setMessage(`${label} copied.`)
    } catch {
      field.current?.focus(); field.current?.select()
      setFailed(true); setMessage(`Could not copy automatically. Select and copy the ${label.toLowerCase()} manually.`)
    } finally { setCopying(false) }
  }
  const props = { value, readOnly: true, onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => event.currentTarget.select() }
  return <div className="flow-share-field">
    <div className="inspector-field"><label htmlFor={id}>{label}</label>{multiline
      ? <textarea {...props} id={id} ref={element => { field.current = element }} className="text-area" rows={4} spellCheck={false} />
      : <input {...props} id={id} ref={element => { field.current = element }} className="text-input" type="url" />}</div>
    <button className="quiet-button focus-ring" disabled={copying} onClick={() => void copy()} type="button"><Copy aria-hidden="true" size={16} />{copying ? 'Copying…' : `Copy ${label.toLowerCase()}`}</button>
    {message ? <p className="status-note" data-tone={failed ? 'error' : 'success'} role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </div>
}

export function FlowSharePanel({ draft, disabled, onDirtyChange, onSave }: { draft: BuilderDraft; disabled: boolean; onDirtyChange: (dirty: boolean) => void; onSave: (settings: FormSettings) => Promise<void> }) {
  const { flow } = draft
  const [origin, setOrigin] = useState<string>()
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const available = flow.status === 'open' || flow.status === 'closed'
  const links = available && origin ? flowShareLinks(origin, flow.slug) : undefined
  return <section id="flow-share-panel" className="panel flow-share-panel" aria-labelledby="flow-share-title">
    <h2 id="flow-share-title">Share this flow</h2>
    {!available ? <p className="muted">{flow.status === 'archived' ? 'This flow is archived. Its public link is unavailable.' : 'Publish this flow before sharing it. An unpublished flow has no public form.'}</p> : <>
      <p className="muted">{flow.status === 'closed' ? 'This flow is closed. Visitors will see the closed page until the flow accepts responses again.' : 'These links open the current published form. Unpublished draft changes are not included.'}</p>
      {links ? <><CopyField key={links.publicUrl} label="Public link" value={links.publicUrl} /><QrKioskControls flowId={flow.id} publicPath={new URL(links.publicUrl).pathname} label="Public link" /><CopyField key={links.scriptCode} label="Script embed" value={links.scriptCode} multiline /><CopyField key={links.embedCode} label="Embed code" value={links.embedCode} multiline /></> : <p className="muted" aria-busy="true">Loading sharing links…</p>}
      <p className="muted">Embedding works only on hosts allowed in <Link className="focus-ring" to="/app/settings">Settings</Link>. An empty host list blocks embedding.</p>
    </>}
    <FlowLinkPreview key={flow.draftVersion} draft={draft} publicUrl={origin ? flowShareLinks(origin, flow.slug).publicUrl : undefined} disabled={disabled} onDirtyChange={onDirtyChange} onSave={onSave} />
  </section>
}
