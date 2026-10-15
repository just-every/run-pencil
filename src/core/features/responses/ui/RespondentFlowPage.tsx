import { BrandIdentity } from '../../brand'
import { brandStyle } from '../../brand'
import { useEmbedProtocol } from '../../embedding'
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerIssue, isUnanswered } from '../../../shared/answers'
import { visiblePath } from '../../../shared/flowPath'
import { QuestionInput } from '../../../shared/ui/QuestionInput'
import { PublicClosedPage } from './PublicClosedPage'
import { api, ApiError, type ClosedFlow, type ChoiceOption, type PublicFlow } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'

type AnswerValues = Record<string, unknown>
type PendingFinal = { input: Parameters<typeof api.submitResponse>[1]; completionStepId: string }
type SessionCredentials = { sessionId: string; sessionToken: string; revisionId: string }

function deviceClass(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth < 768) return 'mobile'
  if (window.innerWidth < 1200) return 'tablet'
  return 'desktop'
}

function filled(value: unknown) {
  return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
}

function choicesForStep(choices: ChoiceOption[], stepId: string) {
  return choices.filter((choice) => choice.stepId === stepId).sort((left, right) => left.position - right.position)
}

export function RespondentFlowPage({ config, slug, embedded = false, landing = false, initialFlow, invitationToken }: { config: PublicSeedConfig; slug: string; embedded?: boolean; landing?: boolean; initialFlow: PublicFlow; invitationToken?: string }) {
  const [closedFlow, setClosedFlow] = useState<ClosedFlow>()
  const [unconfirmedClosedFlow, setUnconfirmedClosedFlow] = useState<ClosedFlow>()
  const [closedRestart, setClosedRestart] = useState(false)
  const [flow, setFlow] = useState<PublicFlow>(initialFlow)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const responseContext = useRef(0)
  useEffect(() => {
    responseContext.current += 1
    return () => { responseContext.current += 1 }
  }, [slug, embedded, initialFlow.flow.id])
  const [index, setIndex] = useState(0)
  const [completedStepId, setCompletedStepId] = useState<string | undefined>(initialFlow.completedStepId ?? undefined)
  useEmbedProtocol(embedded, !!completedStepId, config.embedHostOrigin)
  const [pendingFinal, setPendingFinal] = useState<PendingFinal>()
  const [answers, setAnswers] = useState<AnswerValues>({})
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [sessionUnavailable, setSessionUnavailable] = useState(false)
  const [formChanged, setFormChanged] = useState(false)
  const navigating = useRef(false)
  const [honeypot, setHoneypot] = useState('')
  const sessionStart = useRef<Promise<SessionCredentials> | undefined>(undefined)
  const restartCandidate = useRef<Awaited<ReturnType<typeof api.startSession>> | undefined>(undefined)
  const idempotencyKey = useRef(crypto.randomUUID())


  const showFailure = (reason: unknown, fallback: string, recovery?: { finalAttempt?: PendingFinal; restarting?: boolean }) => {
    if (reason instanceof ApiError && reason.code === 'FLOW_CLOSED' && reason.closedFlow) {
      const retainedFinal = pendingFinal ?? recovery?.finalAttempt
      if (retainedFinal || recovery?.restarting) {
        if (retainedFinal) setPendingFinal(retainedFinal)
        setClosedRestart(!retainedFinal)
        setUnconfirmedClosedFlow(reason.closedFlow)
        setError(reason.message)
      } else { setClosedFlow(reason.closedFlow); setError(undefined) }
    } else {
      if (!pendingFinal && reason instanceof ApiError && reason.code === 'SESSION_UNAVAILABLE') setSessionUnavailable(true)
      setError(reason instanceof Error ? reason.message : fallback)
    }
  }

  const ensureSession = async () => {
    if (!sessionStart.current) {
      const context = responseContext.current
      sessionStart.current = (invitationToken ? api.startSession(slug, deviceClass(), 'direct', invitationToken) : api.startSession(slug, deviceClass(), embedded ? 'embed' : 'direct')).then((session) => {
        if (context === responseContext.current && session.revisionId !== flow.revision.id) {
          restartCandidate.current = session
          setFormChanged(true)
          setError('This form has changed. Your unsent answers are kept until you choose the current form.')
        }
        return { sessionId: session.sessionId, sessionToken: session.sessionToken, revisionId: session.revisionId }
      }).catch((error) => { sessionStart.current = undefined; throw error })
    }
    return sessionStart.current
  }

  const changeAnswer = (stepId: string, value: unknown) => {
    if (pendingFinal || sessionUnavailable || formChanged) return
    const reachableSkipped = new Set(visiblePath(flow, { ...answers, [stepId]: value }).map(step => step.id))
    setSkipped(current => new Set([...current].filter(id => id !== stepId && reachableSkipped.has(id))))
    setAnswers((current) => {
      const next = { ...current, [stepId]: value }
      const reachable = new Set(visiblePath(flow, next).map((step) => step.id))
      return Object.fromEntries(Object.entries(next).filter(([id]) => reachable.has(id)))
    })
    void ensureSession().catch((reason: unknown) => showFailure(reason, 'A response session could not start.'))
  }

  const path = useMemo(() => flow ? visiblePath(flow, answers) : [], [flow, answers])
  if (closedFlow) return <PublicClosedPage config={config} flow={closedFlow} landing={landing} embedded={embedded} />
  const current = completedStepId ? flow.steps.find((step) => step.id === completedStepId && step.kind === 'completion') : path[Math.min(index, Math.max(0, path.length - 1))]
  if (!current) return <main className="pencil-canvas respondent-shell"><p className="status-note" data-tone="error">This published flow has no visible steps.</p></main>
  const questionSteps = path.filter((step) => step.kind === 'question')
  const questionPosition = questionSteps.findIndex((step) => step.id === current.id)
  const currentChoices = choicesForStep(flow.choices, current.id)
  const isCompletion = current.kind === 'completion'
  const isWelcome = current.kind === 'welcome'
  const nextCandidate = path[index + 1]
  const answeredQuestions = questionSteps.filter(step => (!step.required && skipped.has(step.id) && isUnanswered(answers[step.id])) || (!isUnanswered(answers[step.id]) && !answerIssue(step, choicesForStep(flow.choices, step.id).map(choice => choice.id), answers[step.id]))).length
  const progress = isCompletion ? 100 : answeredQuestions / Math.max(1, questionSteps.length) * 100
  const configuredTheme = brandStyle(config)

  const confirmFinal = async (attempt: PendingFinal) => {
    const receipt = await api.submitResponse(slug, attempt.input)
    const completionStepId = receipt.disposition === 'dropped' ? attempt.completionStepId : receipt.completionStepId
    const completion = flow.steps.find((step) => step.id === completionStepId && step.kind === 'completion')
    if (!completion) throw new Error('The completion acknowledgement could not be read. Retry your submission.')
    setPendingFinal(undefined)
    setUnconfirmedClosedFlow(undefined)
    setCompletedStepId(completion.id)
  }

  const restart = async () => {
    if (navigating.current || pendingFinal) return
    const context = responseContext.current
    navigating.current = true; setSubmitting(true)
    try {
      const session = restartCandidate.current ?? await (invitationToken ? api.startSession(slug, deviceClass(), 'direct', invitationToken) : api.startSession(slug, deviceClass(), embedded ? 'embed' : 'direct'))
      if (context !== responseContext.current) return
      restartCandidate.current = session
      const changed = session.revisionId !== flow.revision.id
      if (changed && Object.values(answers).some(filled) && !window.confirm('The form has changed. Start a new response and clear your unsent answers?')) return
      sessionStart.current = Promise.resolve({ sessionId: session.sessionId, sessionToken: session.sessionToken, revisionId: session.revisionId })
      restartCandidate.current = undefined
      setFlow(session.flow); setIndex(0)
      if (changed) { setAnswers({}); setSkipped(new Set()); setHoneypot('') }
      setSessionUnavailable(false); setFormChanged(false); setClosedRestart(false); setUnconfirmedClosedFlow(undefined); setError(undefined)
    } catch (reason) {
      if (context === responseContext.current) showFailure(reason, 'The current form could not load. Your unsent answers have been kept.', { restarting: true })
    } finally {
      if (context === responseContext.current) { navigating.current = false; setSubmitting(false) }
    }
  }

  const next = async () => {
    if (navigating.current) return
    setError(undefined)
    if (isCompletion) return
    if (!pendingFinal && current.kind === 'question') {
      const issue = answerIssue(current, currentChoices.map((choice) => choice.id), answers[current.id])
      if (issue) { setError(issue); return }
    }
    if (!pendingFinal && !nextCandidate) {
      setError('This flow has no completion path from this screen.')
      return
    }
    navigating.current = true; setSubmitting(true)
    const context = responseContext.current
    let attemptedFinal: PendingFinal | undefined
    try {
      if (pendingFinal) { await confirmFinal(pendingFinal); return }
      const credentials = await ensureSession()
      if (context !== responseContext.current) return
      if (credentials.revisionId !== flow.revision.id) return
      if (nextCandidate!.kind === 'completion') {
        const submittedAnswers = questionSteps.flatMap((step) => filled(answers[step.id]) ? [{ stepId: step.id, value: answers[step.id] }] : [])
        const attempt = { input: { ...credentials, idempotencyKey: idempotencyKey.current, answers: submittedAnswers, honeypot, ...(invitationToken ? { invitationToken } : {}) }, completionStepId: nextCandidate!.id }
        attemptedFinal = attempt
        setPendingFinal(attempt)
        await confirmFinal(attempt)
        return
      }
      await api.advanceSession(slug, { ...credentials, stepId: nextCandidate!.id })
      if (current.kind === 'question' && !current.required && isUnanswered(answers[current.id])) setSkipped(previous => new Set([...previous, current.id]))
      setIndex((currentIndex) => Math.min(currentIndex + 1, path.length - 1))
    } catch (reason) {
      // A refused first attempt did not commit. A refused retry (for example
      // a rate limit before receipt lookup) cannot resolve the original outcome.
      if (!pendingFinal && reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.code !== 'FLOW_CLOSED') setPendingFinal(undefined)
      showFailure(reason, 'The response could not be saved. Retry with the same answers.', { finalAttempt: attemptedFinal })
    } finally {
      navigating.current = false
      setSubmitting(false)
    }
  }

  if (unconfirmedClosedFlow && (pendingFinal || closedRestart)) return <PublicClosedPage config={config} flow={unconfirmedClosedFlow} landing={landing} embedded={embedded} recovery={{ mode: pendingFinal ? 'submission' : 'session', busy: submitting, error, onRetry: () => void (pendingFinal ? next() : restart()) }} />

  const needsAdmission = sessionUnavailable || formChanged
  const primaryLabel = pendingFinal ? 'Retry submission' : formChanged ? 'Use current form' : sessionUnavailable ? 'Start again' : isWelcome ? 'Begin' : nextCandidate?.kind === 'completion' ? 'Submit response' : 'Continue'

  return (
    <main className="pencil-canvas respondent-shell brand-surface" data-hydrated={hydrated} data-embedded={embedded ? 'true' : undefined} data-landing={landing ? 'true' : undefined} style={configuredTheme}>
      {landing ? <header className="respondent-landing-header"><span className="eyebrow">{config.publicFlowBusinessName}</span><a className="secondary-button focus-ring" href="/signin">Operator sign in</a></header> : null}
      <article className="respondent-card respondent-note-sheet" aria-labelledby="respondent-title">
        <BrandIdentity config={config} />
        {!isCompletion ? <><div className="respondent-top"><span>{isWelcome ? 'Before you begin' : `Question ${questionPosition + 1} of ${questionSteps.length}`}</span><span>{isWelcome ? `${questionSteps.length} question${questionSteps.length === 1 ? '' : 's'} ahead` : `${Math.max(0, questionSteps.length - answeredQuestions)} remaining`}</span></div><div aria-label="Response progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className="progress-track" role="progressbar"><span style={{ width: `${progress}%` }} />{!isWelcome && current.kind === 'question' ? <span className="progress-track__here" style={{ left: `${questionPosition / Math.max(1, questionSteps.length) * 100}%`, width: `${100 / Math.max(1, questionSteps.length)}%` }} /> : null}</div></> : null}
        <h1 className="display" id="respondent-title">{current.prompt}</h1>
        {current.helperText ? <p className="respondent-helper">{current.helperText}</p> : null}
        {isWelcome || (!path.some((step) => step.kind === 'welcome') && current.kind === 'question' && questionPosition === 0) ? <aside className="privacy-card"><LockKeyhole aria-hidden="true" size={22} strokeWidth={1.6} /><span><strong>Before you share</strong><br />{config.publicFlowPurpose} Your response is {initialFlow.identity === 'identified' ? 'identified through your invitation' : 'anonymous'}. At {config.publicFlowBusinessName}, operators can see the answers you submit. Identifying details you choose to type, such as an email address, identify you to those operators. Your answers are received and stored by this feedback service.{config.answersMayReachAi ? <> <span data-disclosure="ai-analysis">If {config.publicFlowBusinessName} analyses feedback, your written answers may be sent to the AI service it chose. Separate contact, invitation and session identity is excluded. Names, emails or other identifying details you type in selected text answers are sent with those answers.</span></> : null}</span></aside> : null}
        {current.kind === 'question' && current.required ? <p className="respondent-required">Required</p> : null}
        {current.kind === 'question' ? <fieldset className="plain-fieldset" disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} aria-labelledby="respondent-title"><QuestionInput key={`${flow.revision.id}-${current.id}`} choices={currentChoices} onChange={(value) => changeAnswer(current.id, value)} step={current} value={answers[current.id]} /></fieldset> : null}
        {isCompletion ? <p className="privacy-card"><Check aria-hidden="true" color="var(--green)" size={22} /><span>Thank you. This public link cannot edit a completed response.</span></p> : null}
        <label className="respondent-honeypot" aria-hidden="true">Company website<input autoComplete="off" name="company-website" onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} value={honeypot} /></label>
        {pendingFinal && !submitting ? <p className="status-note">Retry to confirm the answers already submitted.</p> : null}
        {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
        {!isCompletion ? <footer className="respondent-actions">{index > 0 ? <button className="secondary-button focus-ring" disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} onClick={() => { setError(undefined); const target = Math.max(0, index - 1); const earlier = new Set(path.slice(0, target).map(step => step.id)); setSkipped(previous => new Set([...previous].filter(id => earlier.has(id)))); setIndex(target) }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button> : null}<button className="primary-button focus-ring" disabled={!hydrated || submitting} onClick={needsAdmission && !pendingFinal ? restart : next} type="button">{submitting ? (needsAdmission ? 'Starting again…' : pendingFinal || nextCandidate?.kind === 'completion' ? 'Submitting…' : 'Continuing…') : primaryLabel} <ArrowRight aria-hidden="true" size={17} /></button></footer> : null}
      </article>
      {landing && config.showPoweredByCredit ? <footer className="respondent-landing-credit">Powered by {config.productName} · <a href="https://runeditrun.com">runeditrun.com</a></footer> : null}
    </main>
  )
}
