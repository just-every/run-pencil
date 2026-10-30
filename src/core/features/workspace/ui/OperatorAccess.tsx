import { LogOut, ShieldCheck, Trash2, UserRoundPlus } from 'lucide-react'
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
  const [needsEmailProof, setNeedsEmailProof] = useState(false)
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
    event.preventDefault(); setInviting(true); setNotice(undefined); setNeedsEmailProof(false)
    try {
      await api.inviteOperator({ email, displayName: name })
      setEmail(''); setName('')
      await refresh({ tone: 'success', message: 'Operator invited. Their sign-in link was sent.' })
    } catch (reason) {
      const needsProof = reason instanceof ApiError && reason.code === 'step_up_required'
      setNeedsEmailProof(needsProof)
      const error: Notice = { tone: 'error', message: needsProof ? 'Before inviting another operator, sign in again using your email link. Then return here and send the invitation.' : reason instanceof Error ? reason.message : 'The operator could not be invited.' }
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
  return <section className="panel settings-card" aria-labelledby="operators-title">
    <header className="card-title"><ShieldCheck aria-hidden="true" size={22} strokeWidth={1.75} /><h2 className="display" id="operators-title">Operator access</h2></header>
    {notice ? <p className="status-note" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
    {needsEmailProof ? <a className="secondary-button focus-ring" href="/signin" target="_blank" rel="noopener">Sign in again in a new tab</a> : null}
    {needsRefresh && !sessionEnded ? <button className="quiet-button focus-ring" type="button" onClick={() => void refresh()}>Reload operators</button> : null}
    {sessionEnded ? <Link className="secondary-button focus-ring" to="/signin">Sign in again</Link> : null}
    <div className="operator-list">
      {operators.map((operator) => <article aria-label={operator.email} className="quiet-panel operator-row" key={operator.id}>
        <div><strong className="operator-name">{operator.displayName}{operator.id === operatorId ? ' · you' : ''}{operator.isSetupOperator ? ' · set up this workspace' : ''}</strong><span className="muted operator-email">{operator.email}</span></div>
        {operators.length > 1 && operator.id === operatorId ? <button className="quiet-button danger-quiet focus-ring" disabled={!!removing || sessionEnded} onClick={() => void remove(operator)} type="button"><LogOut aria-hidden="true" size={15} /> {removing === operator.id ? 'Leaving…' : 'Leave workspace'}</button> : operators.length > 1 && !operator.isSetupOperator ? <button className="quiet-button danger-quiet focus-ring" aria-label={`Remove ${operator.displayName}`} disabled={!!removing || sessionEnded} onClick={() => void remove(operator)} type="button"><Trash2 aria-hidden="true" size={15} /> {removing === operator.id ? 'Removing…' : 'Remove'}</button> : operators.length === 1 ? <span className="muted">Only operator</span> : null}
      </article>)}
    </div>
    <form className="operator-invite" onSubmit={invite}>
      <p className="eyebrow">Invite an operator</p>
      <label className="inspector-field">Name<input disabled={sessionEnded || inviting} autoComplete="name" className="text-input" onChange={(event) => setName(event.target.value)} required value={name} /></label>
      <label className="inspector-field">Email<input disabled={sessionEnded || inviting} autoComplete="email" className="text-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
      <button className="secondary-button operator-invite-button focus-ring" disabled={inviting || sessionEnded} type="submit"><UserRoundPlus aria-hidden="true" size={16} /> {inviting ? 'Sending…' : 'Invite operator'}</button>
    </form>
  </section>
}
