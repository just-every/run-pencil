import { editorLeaf } from '../editor/leaf'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
export const Route = createFileRoute('/optout/$token')({ component: editorLeaf(Page) })
function Page() {
  const { token } = Route.useParams()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string>()
  const stop = async () => {
    setState('busy'); setError(undefined)
    try {
      const response = await fetch('/api/public/optout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      if (!response.ok) throw new Error('This opt-out could not be saved. Retry or contact the business.')
      setState('done')
    } catch (e) { setError((e as Error).message); setState('idle') }
  }
  return <main className="pencil-canvas respondent-shell"><article className="respondent-card respondent-note-sheet"><h1>Stop feedback invitations</h1>{state === 'done' ? <p role="status">Your opt-out is saved. Future flow mail to this contact is stopped. Existing feedback is retained.</p> : <><p>Stop future invitations and reminders from this business. This does not delete feedback you already submitted.</p><button className="primary-button focus-ring" disabled={state === 'busy'} onClick={() => void stop()} type="button">{state === 'busy' ? 'Saving…' : 'Stop future flow mail'}</button></>}{error ? <p role="alert">{error}</p> : null}</article></main>
}
