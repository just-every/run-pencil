import { useEffect, useState, type FormEvent } from 'react'
import type { SavedReportShare } from '../../reporting/savedModel'
import { savedReportApi } from './savedReportApi'

export function ReportSharing({ viewId }: { viewId: string }) {
  const [shares, setShares] = useState<SavedReportShare[]>([]), [password, setPassword] = useState(''), [expiresAt, setExpiresAt] = useState('')
  const [link, setLink] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { void savedReportApi.shares(viewId).then(setShares).catch(reason => setError(reason.message)) }, [viewId])
  const create = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const share = await savedReportApi.share(viewId, { ...(password ? { password } : {}), ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) })
      setLink(new URL(share.url || `/reports/${share.token}`, location.origin).href); setPassword(''); setShares(await savedReportApi.shares(viewId))
    } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    setError('')
    try { await savedReportApi.revoke(id); setShares(await savedReportApi.shares(viewId)); setLink('') } catch (reason) { setError((reason as Error).message) }
  }
  return <details className="report-sharing"><summary>Share this report</summary>
    <p>Anyone with the link can read its protected aggregates. Written answers and respondent details are excluded.</p>
    <form className="report-form" onSubmit={create}>
      <label className="inspector-field">Report password (optional)<input className="text-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="inspector-field">Link expiry (optional)<input className="text-input" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
      <button className="secondary-button focus-ring" type="submit" disabled={busy}>Create report link</button>
    </form>
    {link ? <p className="report-link" role="status"><a href={link} target="_blank" rel="noreferrer">{link}</a></p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <ul className="report-list">{shares.map(share => <li key={share.id}><span>{share.revokedAt ? 'Revoked' : share.passwordRequired ? 'Password protected' : 'Link access'}<br />{share.expiresAt ? `Expires ${share.expiresAt}` : 'No expiry'}</span>{!share.revokedAt ? <button type="button" className="quiet-button focus-ring" onClick={() => void revoke(share.id)}>Revoke link</button> : null}</li>)}</ul>
  </details>
}
