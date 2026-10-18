import { CompletionDisclosure } from './CompletionDisclosure'
import { contactQuestionTypes } from '../../../shared/contactAnswers'
import { normalizeHidden } from '../../../shared/hiddenFields'
import { responseScreens } from '../../../shared/screenLayout'
import { ScreenQuestions } from '../../../shared/ui/ScreenQuestions'
import { useViewCounter } from './useViewCounter'
import { interpolateAnswerRecall } from '../../../shared/answerRecall'
import { SaveResponse } from './SaveResponse'
import { BrandIdentity } from '../../brand'
import { brandStyle } from '../../brand'
import { useEmbedProtocol } from '../../embedding'
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { answerIssue, isUnanswered } from '../../../shared/answers'
import { visiblePath } from '../../../shared/flowPath'
import { QuestionInput } from '../../../shared/ui/QuestionInput'
import { PublicClosedPage } from './PublicClosedPage'
import { api, ApiError, type ClosedFlow, type ChoiceOption, type PublicFlow, type SavedResponseState } from '../../../app/api'
import type { PublicSeedConfig } from '../../../shared/config'

type AnswerValues = Record<string, unknown>
type PendingFinal = { input: Parameters<typeof api.submitResponse>[1] }
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

export function RespondentFlowPage({ config, slug, embedded = false, landing = false, initialFlow, invitationToken, collectorKey, resume }: { config: PublicSeedConfig; slug: string; embedded?: boolean; landing?: boolean; initialFlow: PublicFlow; invitationToken?: string; collectorKey?:string; resume?: Extract<SavedResponseState, { state: 'open' }> }) {
  const [closedFlow, setClosedFlow] = useState<ClosedFlow>()
  const [unconfirmedClosedFlow, setUnconfirmedClosedFlow] = useState<ClosedFlow>()
  const [closedRestart, setClosedRestart] = useState(false)
  const [baseFlow, setFlow] = useState<PublicFlow>(initialFlow)
  const [hidden, setHidden] = useState<Record<string,unknown>>(() => Object.fromEntries((initialFlow.formSettings?.hiddenFields ?? []).flatMap(field => initialFlow.hiddenContext?.hidden[field.id] === undefined ? [] : [[field.name,initialFlow.hiddenContext.hidden[field.id]]])))
  useEffect(() => { if (!resume) setHidden(Object.fromEntries([...new URLSearchParams(window.location.search)].filter(([name])=>!['collector','resume','source','challenge'].includes(name)))) }, [])
  const hiddenContext = normalizeHidden(baseFlow.formSettings ?? {hiddenFields:[],identityMode:'anonymous'},hidden)
  const flow = {...baseFlow,hiddenContext}
  const view = useViewCounter({slug,revisionId:flow.revision.id,source:embedded?'embed':'direct',collectorKey,invitationToken},!resume&&!initialFlow.completedStepId, resume?.loadTime)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const responseContext = useRef(0)
  useEffect(() => {
    responseContext.current += 1
    return () => { responseContext.current += 1 }
  }, [slug, embedded, initialFlow.flow.id])
  const initialAnswers = Object.fromEntries((resume?.answers ?? []).map(answer => [answer.stepId, answer.value]))
  const initialPath = visiblePath({...initialFlow,hiddenContext}, initialAnswers)
  const initialIndex = resume ? Math.max(0, responseScreens(initialFlow.steps,initialPath).findIndex(screen => screen.id === resume.currentStepId || screen.steps.some(step=>step.id===resume.currentStepId))) : 0
  const [index, setIndex] = useState(initialIndex)
  const [completedStepId, setCompletedStepId] = useState<string | undefined>(initialFlow.completedStepId ?? undefined)
  useEmbedProtocol(embedded, !!completedStepId, config.embedHostOrigin)
  const [pendingFinal, setPendingFinal] = useState<PendingFinal>()
  const [answers, setAnswers] = useState<AnswerValues>(initialAnswers)
  const [skipped, setSkipped] = useState<Set<string>>(new Set(initialPath.slice(0,resume?initialPath.findIndex(step=>step.id===resume.currentStepId):0).filter(step => step.kind === 'question' && !step.required && isUnanswered(initialAnswers[step.id])).map(step => step.id)))
  const [error, setError] = useState<string>()
  const [fieldErrors,setFieldErrors] = useState<Record<string,string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [sessionUnavailable, setSessionUnavailable] = useState(false)
  const [formChanged, setFormChanged] = useState(false)
  const navigating = useRef(false)
  const [honeypot, setHoneypot] = useState('')
  const sessionStart = useRef<Promise<SessionCredentials> | undefined>(resume ? Promise.resolve({ sessionId: resume.sessionId, sessionToken: resume.sessionToken, revisionId: resume.revisionId }) : undefined)
  const restartCandidate = useRef<Awaited<ReturnType<typeof api.startSession>> | undefined>(undefined)
  const idempotencyKey = useRef(crypto.randomUUID())
  const saveAttempt = useRef<{ fingerprint: string; commandKey: string } | undefined>(undefined)


  const showFailure = (reason: unknown, fallback: string, recovery?: { finalAttempt?: PendingFinal; restarting?: boolean }) => {
    if (reason instanceof ApiError && ((reason.code === 'FLOW_CLOSED' && reason.closedFlow) || reason.code==='COLLECTOR_CLOSED')) {
      const closed=reason.closedFlow ?? {title:flow.flow.title,slug:flow.flow.slug,collectionClosed:true}
      const retainedFinal = pendingFinal ?? recovery?.finalAttempt
      if (retainedFinal || recovery?.restarting) {
        if (retainedFinal) setPendingFinal(retainedFinal)
        setClosedRestart(!retainedFinal)
        setUnconfirmedClosedFlow(closed)
        setError(reason.message)
      } else { setClosedFlow(closed); setError(undefined) }
    } else {
      if (!pendingFinal && reason instanceof ApiError && reason.code === 'SESSION_UNAVAILABLE') setSessionUnavailable(true)
      setError(reason instanceof Error ? reason.message : fallback)
    }
  }

  const ensureSession = async () => {
    if (!sessionStart.current) {
      const context = responseContext.current
      sessionStart.current = (invitationToken ? api.startSession(slug, deviceClass(), 'direct', invitationToken) : api.startSession(slug, deviceClass(), embedded ? 'embed' : 'direct', undefined, collectorKey)).then((session) => {
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
    setError(undefined)
    setFieldErrors({})
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
  const screens = responseScreens(flow.steps,path)
  const screen = screens[Math.min(index,Math.max(0,screens.length-1))]
  if (closedFlow) return <PublicClosedPage config={config} flow={closedFlow} landing={landing} embedded={embedded} />
  const current = completedStepId ? flow.steps.find((step) => step.id === completedStepId && step.kind === 'completion') : screen?.steps[0]
  if (!current) return <main className="pencil-canvas respondent-shell"><p className="status-note" data-tone="error">This published flow has no visible steps.</p></main>
  const questionSteps = path.filter((step) => step.kind === 'question')
  const questionPosition = questionSteps.findIndex((step) => step.id === current.id)
  const recall = (text: string) => interpolateAnswerRecall(text, flow, answers, current.id)
  const displayedStep = { ...current, prompt: recall(current.prompt), helperText: current.helperText ? recall(current.helperText) : current.helperText }
  const currentChoices = choicesForStep(flow.choices, current.id).map(choice => ({ ...choice, label: recall(choice.label) }))
  const isCompletion = current.kind === 'completion'
  const isWelcome = current.kind === 'welcome'
  const nextCandidate = screens[index + 1]?.steps[0]
  const questionScreens = screens.filter(entry => entry.steps[0]?.kind === 'question')
  const answered = (step: typeof questionSteps[number]) => (!step.required && skipped.has(step.id) && isUnanswered(answers[step.id])) || (!isUnanswered(answers[step.id]) && !answerIssue(step, choicesForStep(flow.choices, step.id).map(choice => choice.id), answers[step.id]))
  const units = (entry: typeof screens[number]) => entry.layout?.kind === 'page' ? 1 : entry.steps.filter(step => step.kind === 'question').length
  const progressTotal = questionScreens.reduce((total, entry) => total + units(entry), 0)
  const progressDone = questionScreens.reduce((total, entry) => total + (entry.layout?.kind === 'page' ? (entry.steps.every(answered) ? 1 : 0) : entry.steps.filter(answered).length), 0)
  const progressPosition = questionScreens.slice(0, questionScreens.findIndex(entry => entry.id === screen?.id)).reduce((total, entry) => total + units(entry), 0)
  const progress = isCompletion ? 100 : progressDone / Math.max(1, progressTotal) * 100
  const configuredTheme = brandStyle(config)

  const confirmFinal = async (attempt: PendingFinal) => {
    const receipt = await api.submitResponse(slug, attempt.input)
    const completionStepId = receipt.completionStepId
    const completion = flow.steps.find((step) => step.id === completionStepId && step.kind === 'completion')
    if (!completion) throw new Error('The completion acknowledgement could not be read. Retry your submission.')
    setPendingFinal(undefined)
    setUnconfirmedClosedFlow(undefined)
    setCompletedStepId(completion.id)
    if (receipt.redirectUrl) window.location.assign(receipt.redirectUrl)
  }

  const restart = async () => {
    if (navigating.current || pendingFinal) return
    const context = responseContext.current
    navigating.current = true; setSubmitting(true)
    try {
      const session = restartCandidate.current ?? await (invitationToken ? api.startSession(slug, deviceClass(), 'direct', invitationToken) : api.startSession(slug, deviceClass(), embedded ? 'embed' : 'direct', undefined, collectorKey))
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
      const issues = Object.fromEntries((screen?.steps ?? [current]).filter(step=>step.kind==='question').flatMap(step=>{
        const issue=answerIssue({...step,prompt:interpolateAnswerRecall(step.prompt,flow,answers,step.id)},choicesForStep(flow.choices,step.id).map(choice=>choice.id),answers[step.id])
        return issue?[[step.id,issue]]:[]
      }))
      setFieldErrors(issues)
      if(Object.keys(issues).length) {if(!screen?.layout && (!(contactQuestionTypes as readonly string[]).includes(current.questionType??'') || isUnanswered(answers[current.id])))setError(Object.values(issues)[0]);return}
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
        const attempt = { input: { ...credentials, idempotencyKey: idempotencyKey.current, answers: submittedAnswers, hidden, honeypot, loadTime: await view.token(), ...(invitationToken ? { invitationToken } : {}) } }
        attemptedFinal = attempt
        setPendingFinal(attempt)
        await confirmFinal(attempt)
        return
      }
      await api.advanceSession(slug, { ...credentials, stepId: nextCandidate!.id })
      setSkipped(previous=>new Set([...previous,...(screen?.steps??[current]).filter(step=>step.kind==='question'&&!step.required&&isUnanswered(answers[step.id])).map(step=>step.id)]))
      setIndex((currentIndex) => Math.min(currentIndex + 1, screens.length - 1))
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

  const saveForLater = async (email: string) => {
    if (navigating.current) throw new Error('Wait for the current step to finish, then save again.')
    navigating.current = true; setSubmitting(true)
    try {
      const credentials = await ensureSession()
      if (credentials.revisionId !== flow.revision.id) throw new Error('This form has changed. Choose the current form before saving.')
      const input = { ...credentials, hidden, email, currentStepId: current.id, answers: questionSteps.flatMap(step => filled(answers[step.id]) ? [{ stepId: step.id, value: answers[step.id] }] : []), ...(invitationToken ? { invitationToken } : {}) }
      const fingerprint = JSON.stringify(input)
      if (saveAttempt.current?.fingerprint !== fingerprint) saveAttempt.current = { fingerprint, commandKey: crypto.randomUUID() }
      return await api.saveResponse(slug, { ...input, commandKey: saveAttempt.current.commandKey })
    } finally { navigating.current = false; setSubmitting(false) }
  }

  if (unconfirmedClosedFlow && (pendingFinal || closedRestart)) return <PublicClosedPage config={config} flow={unconfirmedClosedFlow} landing={landing} embedded={embedded} recovery={{ mode: pendingFinal ? 'submission' : 'session', busy: submitting, error, onRetry: () => void (pendingFinal ? next() : restart()) }} />

  const needsAdmission = sessionUnavailable || formChanged
  const primaryLabel = pendingFinal ? 'Retry submission' : formChanged ? 'Use current form' : sessionUnavailable ? 'Start again' : isWelcome ? 'Begin' : nextCandidate?.kind === 'completion' ? 'Submit response' : 'Continue'

  return (
    <main className="pencil-canvas respondent-shell brand-surface" data-hydrated={hydrated} data-embedded={embedded ? 'true' : undefined} data-landing={landing ? 'true' : undefined} style={configuredTheme}>
      {landing ? <header className="respondent-landing-header"><span className="eyebrow">{config.publicFlowBusinessName}</span><a className="secondary-button focus-ring" href="/signin">Operator sign in</a></header> : null}
      <article className="respondent-card respondent-note-sheet" aria-labelledby="respondent-title">
        <BrandIdentity config={config} />
        {!isCompletion ? <><div className="respondent-top"><span>{isWelcome ? 'Before you begin' : screen?.layout ? `${screen.layout.kind === 'page' ? 'Page' : 'Group'} ${screens.filter(entry=>entry.steps[0]?.kind==='question').findIndex(entry=>entry.id===screen.id)+1} of ${screens.filter(entry=>entry.steps[0]?.kind==='question').length} · ${screen.steps.length} question${screen.steps.length===1?'':'s'}` : `Question ${questionPosition + 1} of ${questionSteps.length}`}</span><span>{isWelcome ? `${questionSteps.length} question${questionSteps.length === 1 ? '' : 's'} ahead` : `${Math.max(0, progressTotal - progressDone)} remaining`}</span></div><div aria-label="Response progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className="progress-track" role="progressbar"><span style={{ width: `${progress}%` }} />{!isWelcome && current.kind === 'question' ? <span className="progress-track__here" style={{ left: `${progressPosition / Math.max(1, progressTotal) * 100}%`, width: `${(screen ? units(screen) : 1)*100 / Math.max(1, progressTotal)}%` }} /> : null}</div></> : null}
        <h1 className="display" id="respondent-title">{screen?.layout && !isCompletion ? screen.layout.title : displayedStep.prompt}</h1>
        {screen?.layout && !isCompletion ? screen.layout.description ? <p className="respondent-helper">{screen.layout.description}</p> : null : current.helperText ? <p className="respondent-helper">{displayedStep.helperText}</p> : null}
        {isWelcome || (!path.some((step) => step.kind === 'welcome') && current.kind === 'question' && questionPosition === 0) ? <aside className="privacy-card"><LockKeyhole aria-hidden="true" size={22} strokeWidth={1.6} /><span><strong>Before you share</strong><br />{config.publicFlowPurpose} Your response is {initialFlow.identity === 'identified' ? 'identified through your invitation' : hiddenContext.identityMode === 'identified' ? 'identified; values supplied by this link are unverified, and forwarding the link forwards those values' : 'anonymous'}. At {config.publicFlowBusinessName}, operators can see the answers you submit. Identifying details you choose to type, such as an email address, identify you to those operators. Your answers are received and stored by this feedback service.{config.answersMayReachAi ? <> <span data-disclosure="ai-analysis">If {config.publicFlowBusinessName} analyses feedback, your written answers may be sent to the AI service it chose. Separate contact, invitation and session identity is excluded. Names, emails or other identifying details you type in selected text answers are sent with those answers.</span></> : null}<CompletionDisclosure flow={flow}/></span></aside> : null}
        {!isCompletion && hiddenContext.identityMode === 'identified' && Object.entries(hiddenContext.hidden).some(([id])=>flow.formSettings?.hiddenFields.some(field=>field.id===id&&field.category==='identifying')) ? <aside className="privacy-card"><span>Answering as {flow.formSettings?.hiddenFields.filter(field=>field.category==='identifying'&&hiddenContext.hidden[field.id]!==undefined).map(field=>String(hiddenContext.hidden[field.id])).join(', ')}. These link-supplied values are unverified. <button type="button" className="quiet-button" disabled={submitting||!!pendingFinal} onClick={()=>setHidden(previous=>Object.fromEntries(Object.entries(previous).filter(([name])=>!flow.formSettings?.hiddenFields.some(field=>field.name===name&&field.category==='identifying'))))}>This isn’t me</button></span></aside> : null}
        {!screen?.layout && current.kind === 'question' && current.required ? <p className="respondent-required">Required</p> : null}
        {current.kind === 'question' && screen?.layout ? <ScreenQuestions steps={screen.steps} choices={flow.choices} answers={answers} errors={fieldErrors} disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} recall={(text,id)=>interpolateAnswerRecall(text,flow,answers,id)} onChange={changeAnswer}/> : current.kind === 'question' ? <fieldset className="plain-fieldset" disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} aria-labelledby="respondent-title"><QuestionInput key={`${flow.revision.id}-${current.id}`} choices={currentChoices} onChange={(value) => changeAnswer(current.id, value)} step={displayedStep} value={answers[current.id]} /></fieldset> : null}
        {isCompletion ? <p className="privacy-card"><Check aria-hidden="true" color="var(--green)" size={22} /><span>Thank you. {invitationToken ? 'This invitation link' : 'This public link'} cannot edit a completed response.</span></p> : null}
        <label className="respondent-honeypot" aria-hidden="true">Company website<input autoComplete="off" name="company-website" onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} value={honeypot} /></label>
        {pendingFinal && !submitting ? <p className="status-note">Retry to confirm the answers already submitted.</p> : null}
        {error ? <p className="status-note" data-tone="error" role="alert">{error}</p> : null}
        {!isCompletion ? <footer className="respondent-actions">{index > 0 ? <button className="secondary-button focus-ring" disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} onClick={() => { setError(undefined); const target = Math.max(0, index - 1); const earlier = new Set(screens.slice(0,target).flatMap(screen=>screen.steps.map(step=>step.id))); setSkipped(previous => new Set([...previous].filter(id => earlier.has(id)))); setIndex(target) }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button> : null}<button className="primary-button focus-ring" disabled={!hydrated || submitting} onClick={needsAdmission && !pendingFinal ? restart : next} type="button">{submitting ? (needsAdmission ? 'Starting again…' : pendingFinal || nextCandidate?.kind === 'completion' ? 'Submitting…' : 'Continuing…') : primaryLabel} <ArrowRight aria-hidden="true" size={17} /></button></footer> : null}
        {!isCompletion ? <SaveResponse disabled={!hydrated || submitting || !!pendingFinal || needsAdmission} onSave={saveForLater} /> : null}
      </article>
      {landing && config.showPoweredByCredit ? <footer className="respondent-landing-credit">Powered by {config.productName} · <a href="https://runeditrun.com">runeditrun.com</a></footer> : null}
    </main>
  )
}
