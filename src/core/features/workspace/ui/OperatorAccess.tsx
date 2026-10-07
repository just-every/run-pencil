import { ShieldCheck, Trash2, UserRoundPlus } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, ApiError, type Operator } from '../../../app/api'
import { useProtectUnsavedChanges, useUnsavedChanges } from '../../../shared/ui/UnsavedChanges'

type Notice = { tone: 'error' | 'success'; message: string }

export function OperatorAccess({ initialOperators, operatorId }: { initialOperators: Operator[]; operatorId: string }) {
  const navigate = useNavigate()
  const [operators, setOperators] = useState(initialOperators)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<Notice>()
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string>()
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  useProtectUnsavedChanges(!!email || !!name)
  const { dirty } = useUnsavedChanges()
  const refresh = async (outcome?: Notice) => {
    try { setOperators(await api.operators()); setNeedsRefresh(false); setNotice(outcome) }
    catch (reason) {
      setNeedsRefresh(true)
      setSessionEnded(reason instanceof ApiError && reason.status === 401)
      setNotice({ tone: 'error', message: `${outcome?.message ?? ''} Access list could not refresh. ${reason instanceof Error ? reason.message : 'Try again.'}`.trim() })
    }
  }
  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setInviting(true); setNotice(undefined)
    try {
      await api.inviteOperator({ email, displayName: name })
      setEmail(''); setName('')
      await refresh({ tone: 'success', message: 'Operator invited. Their sign-in link was sent.' })
    } catch (reason) {
      const error: Notice = { tone: 'error', message: reason instanceof Error ? reason.message : 'The operator could not be invited.' }
      setNotice(error)
      if (reason instanceof ApiError && reason.code === 'INVITATION_RECOVERY_REQUIRED') await refresh(error)
    } finally { setInviting(false) }
  }
  const remove = async (operator: Operator) => {
    const self = operator.id === operatorId
    const message = self ? `Remove your operator access? Your session will end.${dirty ? ' Unsaved changes will be discarded.' : ''}` : `Remove ${operator.displayName}? Their sessions and sign-in credentials will be erased.`
    if (!window.confirm(message)) return
    setRemoving(operator.id); setNotice(undefined)
    try {
      await api.removeOperator(operator.id)
      if (self) await navigate({ to: '/signin', search: { notice: 'access-removed' }, ignoreBlocker: true })
      else await refresh({ tone: 'success', message: `${operator.displayName} was removed.` })
    } catch (reason) { setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : 'The operator could not be removed.' }) }
    finally { setRemoving(undefined) }
  }
  return <section className="panel" style={{ padding: '1.25rem' }} aria-labelledby="operators-title">
    <header style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}><ShieldCheck aria-hidden="true" color="var(--green)" size={20} /><h2 className="display" id="operators-title" style={{ fontSize: '2rem', margin: 0 }}>Operator access</h2></header>
    {notice ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
    {needsRefresh && !sessionEnded ? <button className="quiet-button focus-ring" type="button" onClick={() => void refresh()}>Reload operators</button> : null}
    {sessionEnded ? <Link className="secondary-button focus-ring" to="/signin">Sign in again</Link> : null}
    <div style={{ display: 'grid', gap: '.65rem', marginTop: '1.1rem' }}>
      {operators.map((operator) => <article aria-label={operator.email} className="quiet-panel" key={operator.id} style={{ alignItems: 'center', display: 'flex', gap: '.75rem', justifyContent: 'space-between', padding: '.8rem' }}>
        <div><strong style={{ display: 'block', fontSize: '.9rem' }}>{operator.displayName}{operator.id === operatorId ? ' · you' : ''}{operator.isSetupOperator ? ' · setup operator' : ''}</strong><span className="muted" style={{ fontSize: '.82rem' }}>{operator.email}</span></div>
        {operators.length > 1 && (!operator.isSetupOperator || operator.id === operatorId) ? <button className="quiet-button focus-ring" aria-label={`Remove ${operator.displayName}`} disabled={!!removing || sessionEnded} onClick={() => void remove(operator)} style={{ color: 'var(--danger, #d86262)' }} type="button"><Trash2 aria-hidden="true" size={15} /> {removing === operator.id ? 'Removing…' : 'Remove'}</button> : operators.length === 1 ? <span className="muted">Only operator</span> : null}
      </article>)}
    </div>
    <form onSubmit={invite} style={{ borderTop: '1px solid var(--line)', display: 'grid', gap: '.75rem', marginTop: '1rem', paddingTop: '1rem' }}>
      <p className="eyebrow" style={{ margin: 0 }}>Invite an operator</p>
      <label className="inspector-field">Name<input disabled={sessionEnded || inviting} autoComplete="name" className="text-input" onChange={(event) => setName(event.target.value)} required value={name} /></label>
      <label className="inspector-field">Email<input disabled={sessionEnded || inviting} autoComplete="email" className="text-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <button className="secondary-button focus-ring" disabled={inviting || sessionEnded} type="submit"><UserRoundPlus aria-hidden="true" size={16} /> {inviting ? 'Sending…' : 'Invite operator'}</button>
    </form>
  </section>
}
