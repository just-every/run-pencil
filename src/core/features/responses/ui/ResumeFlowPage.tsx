import { useEffect, useState } from 'react'
import { api, ApiError, type ClosedFlow, type SavedResponseState } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'
import { BrandIdentity, brandStyle } from '../../brand'
import { RespondentFlowPage } from './RespondentFlowPage'
import { PublicClosedPage } from './PublicClosedPage'

export function ResumeFlowPage({ config, slug, token }: { config: PublicSeedConfig; slug: string; token: string }) {
  const [saved, setSaved] = useState<SavedResponseState>()
  const [closed, setClosed] = useState<ClosedFlow>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(undefined)
    api.resumeResponse(slug, token).then(value => { if (active) setSaved(value) }).catch(reason => {
      if (!active) return
      if (reason instanceof ApiError && reason.closedFlow) setClosed(reason.closedFlow)
      else setError(reason instanceof Error ? reason.message : 'Your saved answers could not load. Try again.')
    })
    return () => { active = false }
  }, [slug, token, attempt])
  if (closed) return <PublicClosedPage config={config} flow={closed} />
  if (saved?.state === 'open') return <RespondentFlowPage key={saved.sessionId} config={config} slug={slug} initialFlow={saved.flow} invitationToken={saved.invitationToken} resume={saved} />
  if (saved?.state === 'completed') return <RespondentFlowPage config={config} slug={slug} initialFlow={{ ...saved.flow, completedStepId: saved.completionStepId }} />
  return <main className="pencil-canvas respondent-shell brand-surface" style={brandStyle(config)}><article className="respondent-card respondent-note-sheet"><BrandIdentity config={config} />
    <h1 className="display">{saved?.state === 'unavailable' ? 'This resume link is no longer available.' : 'Your saved response'}</h1>
    {saved?.state === 'unavailable' ? <><p>{saved.message}</p><a className="primary-button focus-ring" href={saved.startAgain}>Start again</a></> : error ? <><p className="status-note" data-tone="error" role="alert">{error}</p><button className="primary-button focus-ring" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></> : <p role="status">Loading your saved answers…</p>}
  </article></main>
}
