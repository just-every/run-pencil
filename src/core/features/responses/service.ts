import { consentRecords } from '../../shared/marketingConsent'
import { closedFlowFor } from '../../shared/closedFlow'
import { issuePrefillProof, readPrefillProof } from './prefillProof'
import { resolvePrefills, prefillMarkers } from '../../shared/knownDataPrefill'
import { presentationOrder, presentFlow, retainedPresentation, type PresentationOrder } from '../../shared/presentationOrder'
import type { RestrictedAccess } from '../restricted-access'
import { completionRedirect } from '../../shared/completionRedirect'
import { formAnswerContext, variableAnswers } from '../../shared/calculationContext'
import { evaluateCalculations } from '../../shared/calculations'
import { formSettings, normalizeHidden, hiddenAnswers, type ResponseContext } from '../../shared/hiddenFields'
import { issueLoadTime, verifyLoadTime } from '../traffic'
import { type CollectorService } from '../collectors'
import { collectorFlowFailure } from './collectorFailure'
import { runtimeAnswerValue, storedAnswerValue } from './answerStorage'
import { revisionReviewEnabled, revisionBranchSelection, type BranchSelection } from '../../shared/flowPolicies'
import manifest from '../../../../seed.json' with { type: 'json' }
import { visibilityCondition } from '../../shared/screenLayout'
import { evaluateCondition } from '../../shared/conditions'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { ulid } from 'ulid'
import { publicSteps, publicChoices, publicRules, questionSettings, resolveNextStep, type FlowRepository, type StoredBranchRule, type StoredChoice, type StoredStep } from '../flows'
import { FlowClosedError, NotFoundError, RateLimitError, SessionUnavailableError, ValidationError } from '../../shared/errors'
import type { ResponseRepository } from './repository'
import { validatePathAnswers } from './path'
import type { PaymentResponses } from './payment-responses'

type DeviceClass = 'mobile' | 'tablet' | 'desktop'
type PublicSource = 'direct' | 'embed'
type AnswerInput = { stepId: string; value: unknown }

const sessionRetentionMilliseconds = manifest.limits.respondentSessions.retentionDays * 24 * 60 * 60 * 1000
const minimumFillMilliseconds = manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit * 1000

export class ResponseService {
  constructor(
    private readonly flowRepository: FlowRepository,
    private readonly repository: ResponseRepository,
    private readonly collectors: CollectorService,
    private readonly loadTimeSecret: string,
    private readonly access:RestrictedAccess,
    readonly payments: PaymentResponses,
  ) {}

  async ensureSampleResponses(input: {
    workspaceId: string
    flowId: string
    revisionId: string
    sessions: Array<{ id: string; source: 'direct' | 'embed' | 'invitation'; deviceClass: DeviceClass; furthestStepId: string | null; completedAt: string | null; expiresAt: string; createdAt: string; updatedAt: string }>
    responses: Array<{ id: string; sessionId: string; idempotencyKey: string; completedAt: string; answers: Array<{ id: string; stepId: string; value: unknown }> }>
    counter: { id: string; starts: number; completions: number; totalCompletionMilliseconds: number; mobileStarts: number; tabletStarts: number; desktopStarts: number; createdAt: string; updatedAt: string }
  }) {
    await this.repository.ensureMetricCounter({ ...input.counter, revisionId: input.revisionId })
    for (const session of input.sessions.filter((entry) => !input.responses.some((response) => response.sessionId === entry.id))) {
      await this.repository.ensureSession({
        ...session,
        revisionId: input.revisionId,
        sessionTokenHash: `sample-${session.id}`,
        metricFoldedAt: null,
        completionOutcome: session.completedAt ? 'released' : null,
      })
    }
    for (const response of input.responses) {
      await this.repository.ensureResponse({
        id: response.id,
        source: input.sessions.find((session) => session.id === response.sessionId)?.source ?? 'unknown',
        startedAt: input.sessions.find((session) => session.id === response.sessionId)?.createdAt ?? null,
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        revisionId: input.revisionId,
        sessionId: response.sessionId,
        sessionTokenHash: `sample-${response.sessionId}`,
        idempotencyKey: response.idempotencyKey,
        state: 'released',
        quarantineReason: null,
        releasedAt: response.completedAt,
        releasedByOperatorId: null,
        completionMilliseconds: 0,
        completedAt: response.completedAt,
        createdAt: response.completedAt,
        updatedAt: response.completedAt,
      })
      for (const answer of response.answers) {
        await this.repository.ensureAnswer({
          id: answer.id,
          responseId: response.id,
          stepId: answer.stepId,
          valueJson: JSON.stringify(answer.value),
          createdAt: response.completedAt,
          updatedAt: response.completedAt,
        })
      }
    }
  }

  async sessionAccessIdentity(sessionId:string,settings:import('../../shared/hiddenFields').FormSettings){return this.access.sessionIdentity(sessionId,settings)}

  async expireSessions(now: string, limit: number) { return this.repository.foldExpiredSessions(now, limit) }

  async expireRateWindows(now: string, limit: number) { return this.repository.purgeExpiredRateWindows(now, limit) }

  async enforcePublicRequestRateLimit(input: { clientAddress: string | undefined; scope: 'request' | 'session' | 'submission' }) {
    const now = new Date()
    const windowStartedAt = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString()
    const expiresAt = new Date(new Date(windowStartedAt).getTime() + 60 * 1000).toISOString()
    const addressHash = await this.hash(`public-rate:${input.clientAddress || 'unknown'}`)
    const limit = input.scope === 'submission' ? manifest.limits.publicRateLimits.finalSubmissionsPerIpPerMinute : manifest.limits.publicRateLimits.requestsPerIpPerMinute
    const admitted = await this.repository.incrementPublicRateLimit({ scope: input.scope, addressHash, windowStartedAt, expiresAt, limit, now: now.toISOString() })
    if (!admitted) throw new RateLimitError(undefined, Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)))
  }

  async invitationFlow(token: string, accessToken?:string) {
    const invitation = await this.repository.findInvitation(token)
    if (!invitation) throw new NotFoundError('This invitation is no longer available.')
    const revision = await this.flowRepository.findRevisionById(invitation.revisionId)
    const flow = revision && await this.flowRepository.findFlow(revision.flowId)
    if (!flow || !revision || flow.status === 'archived') throw new NotFoundError('This invitation is no longer available.')
    const expired = revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()
    if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
    if (flow.status === 'draft' || revision.admissionClosedAt || expired || await this.targetReached(revision)) throw new FlowClosedError(closedFlowFor(revision, flow.slug))
    const collector = await this.collectors.requireInvitationOpen(flow.id, token)
      .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
    await this.access.require(formSettings(revision.formSettingsJson),revision.id,revision.title,flow.slug,accessToken)
    const { steps, choices, rules } = await this.flowRepository.getRevisionGraph(revision.id)
    const prefilledAnswers = invitation.responseStatus === 'completed' ? {} : resolvePrefills(formSettings(revision.formSettingsJson).prefill ?? [], await this.repository.invitationFields(invitation.id), publicSteps(steps), publicChoices(steps,choices))
    const prefillProof = formSettings(revision.formSettingsJson).prefill?.length ? await issuePrefillProof(this.loadTimeSecret,{participantId:invitation.id,revisionId:revision.id,answers:prefilledAnswers}) : undefined
    return { invitation, collector, flow, revision, steps, choices, rules, publicFlow: presentFlow({ formSettings: formSettings(revision.formSettingsJson), reviewBeforeSubmit: revisionReviewEnabled(revision.policySnapshotJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title }, revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules), prefilledAnswers, prefillProof, identity: 'identified' as const, completedStepId: invitation.responseStatus === 'completed' ? invitation.completionStepId : null }) }
  }

  async startPublicSession(input: { slug: string; deviceClass: DeviceClass; source: PublicSource; clientAddress?: string; invitationToken?: string; collectorKey?: string; accessToken?:string; presentation?:PresentationOrder }) {
    if (input.invitationToken && input.collectorKey !== undefined) throw new ValidationError('An invitation uses its original collector; remove the collection-link override.')
    await this.enforcePublicRequestRateLimit({ clientAddress: input.clientAddress, scope: 'session' })
    const invitationContext = input.invitationToken ? await this.invitationFlow(input.invitationToken,input.accessToken) : undefined
    if (invitationContext && invitationContext.flow.slug !== input.slug) throw new NotFoundError('This invitation belongs to another flow.')
    if (invitationContext?.invitation.responseStatus === 'completed') throw new ValidationError('This invitation has already completed its response.')
    const { flow, revision, steps, choices, rules } = invitationContext ?? await this.currentPublicRevision(input.slug)
    const collector = invitationContext?.collector ?? await this.collectors.requireOpen(flow.id, input.source, input.collectorKey)
      .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
    const grant=await this.access.require(formSettings(revision.formSettingsJson),revision.id,revision.title,flow.slug,input.accessToken)
    let presentation:PresentationOrder
    try { presentation=presentationOrder({steps:publicSteps(steps),choices:publicChoices(steps,choices)},input.presentation) } catch(error) { throw new ValidationError((error as Error).message) }
    const firstStep = steps[0]
    if (!firstStep) throw new ValidationError('This published flow has no first screen.')
    const now = new Date()
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
    const session = {
      id: ulid(),
      presentationJson:JSON.stringify(presentation),
      revisionId: revision.id,
      source: invitationContext ? 'invitation' as const : collector.systemSource === 'direct' || collector.systemSource === 'embed' ? collector.systemSource : input.source,
      participantId: invitationContext?.invitation.id ?? null,
      deviceClass: input.deviceClass,
      furthestStepId: firstStep.stableId,
      sessionTokenHash: await this.hash(token),
      completedAt: null,
      metricFoldedAt: null,
      completionOutcome: null,
      expiresAt: new Date(now.getTime() + sessionRetentionMilliseconds).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      deadlineAt: revision.deadlineAt,
      targetCompletedResponses: revision.targetCompletedResponses,
    }
    const created = await this.repository.createSession({ ...session, collectorId: collector.id })
    if (!created) {
      if (revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
      const latest = await this.flowRepository.findFlowWithCurrentPublishedRevision(input.slug)
      if (latest?.flow.status !== 'open' || latest.revision?.admissionClosedAt || (latest.revision?.deadlineAt && Date.parse(latest.revision.deadlineAt) <= Date.now()) || (latest?.revision && await this.targetReached(latest.revision))) throw new FlowClosedError({ title: latest?.revision?.title ?? revision.title, slug: flow.slug })
      await this.collectors.requireByIdOpen(flow.workspaceId, flow.id, collector.id, session.source)
        .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
      throw new ValidationError('This form changed before you began. Please start again using the current version.')
    }
    await this.access.bindSession(session.id,grant)
    return { sessionId: session.id, sessionToken: token, loadTime: await issueLoadTime(this.loadTimeSecret, revision.id), revisionId: revision.id, flowId: flow.id, flow: presentFlow({ ...(invitationContext ? {prefillProof:invitationContext.publicFlow.prefillProof,prefilledAnswers:invitationContext.publicFlow.prefilledAnswers} : {}), formSettings: formSettings(revision.formSettingsJson), reviewBeforeSubmit: revisionReviewEnabled(revision.policySnapshotJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title }, revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules) },presentation) }
  }

  async advancePublicSession(input: { slug: string; sessionId: string; sessionToken: string; stepId: string }) {
    const tokenHash = await this.hash(input.sessionToken)
    const advanced = await this.repository.advanceSession({ slug: input.slug, sessionId: input.sessionId, sessionTokenHash: tokenHash, stepStableId: input.stepId, now: new Date().toISOString() })
    if (!advanced) {
      const context = await this.repository.findSubmissionContext(input.sessionId, tokenHash)
      if (!context || context.session.completedAt || context.session.expiresAt <= new Date().toISOString()) throw new SessionUnavailableError()
      throw new ValidationError('This screen is not part of your response session.')
    }
  }

  async submitPublicResponse(input: { slug: string; sessionId: string; sessionToken: string; idempotencyKey: string; answers: AnswerInput[]; prefillProof?:string; hidden?:Record<string,unknown>; honeypot?: string; loadTime?: string; clientAddress?: string; invitationToken?: string }) {
    await this.enforcePublicRequestRateLimit({ clientAddress: input.clientAddress, scope: 'submission' })
    if (!input.sessionToken) throw new SessionUnavailableError()
    const tokenHash = await this.hash(input.sessionToken)
    // PAY-001: a retry of a payment response resumes its checkout, or replaces a cancelled or expired attempt.
    const settle = (response: NonNullable<Awaited<ReturnType<ResponseRepository['findResponseBySession']>>>) => this.payments.settle(response, input)
    const receipt = async () => {
      const retained = await this.repository.findResponseBySessionToken(input.sessionId, tokenHash)
      if (!retained) return undefined
      const retainedFlow = await this.flowRepository.findFlow(retained.flowId)
      if (!retainedFlow || retainedFlow.slug !== input.slug) throw new NotFoundError('This response does not belong to the requested flow.')
      if (retained.idempotencyKey === input.idempotencyKey) return settle(retained)
      throw new ValidationError('This response session has already been completed.')
    }
    const retained = await receipt()
    if (retained) return retained
    const context = await this.repository.findSubmissionContext(input.sessionId, tokenHash)
    if (!context || context.session.expiresAt <= new Date().toISOString()) {
      const concurrent = await receipt()
      if (concurrent) return concurrent
      throw new SessionUnavailableError()
    }
    const { session, revision, flow } = context
    if (flow.slug !== input.slug) throw new NotFoundError('This flow is not available for responses.')
    const invitation = session.source === 'invitation' && input.invitationToken ? await this.repository.findInvitation(input.invitationToken) : undefined
    if (session.source === 'invitation' && (!invitation || invitation.revisionId !== revision.id)) throw new SessionUnavailableError()
    const existing = await this.repository.findResponseBySession(session.id)
    if (existing) {
      if (existing.idempotencyKey === input.idempotencyKey) return settle(existing)
      throw new ValidationError('This response session has already been completed.')
    }
    // RESP-008 on a payment form: an invitation admits one paid response, so its unpaid response is replaced, not duplicated.
    const invited = invitation && await this.repository.findResponseByParticipant(invitation.id)
    const invitedPayment = invited && await this.payments.payments.forResponse(invited.id)
    if (invited && invitedPayment && invitedPayment.state !== 'paid' && invitedPayment.state !== 'refunded') return this.payments.replace(invited, invitedPayment, input, { sessionId: session.id, sessionTokenHash: tokenHash })

    try {
      const collector = await this.collectors.requireSessionOpen(flow.id, session.id, session.source)
      if (invitation && input.invitationToken) {
        const invitedCollector = await this.collectors.requireInvitationOpen(flow.id, input.invitationToken)
        if (invitedCollector.id !== collector.id) throw new SessionUnavailableError()
      }
    } catch (error) {
      const concurrent = await receipt()
      if (concurrent) return concurrent
      collectorFlowFailure(error, { title: revision.title, slug: flow.slug })
    }

    const loadedAt = await verifyLoadTime(this.loadTimeSecret, revision.id, input.loadTime ?? '')

    const { steps, choices, rules } = await this.flowRepository.getRevisionGraph(revision.id)
    const settings = formSettings(revision.formSettingsJson)
    const hiddenContext = normalizeHidden(settings,input.hidden ?? {})
    const accessIdentity=await this.access.sessionIdentity(session.id,settings)
    if(accessIdentity?.email){hiddenContext.verifiedEmail=accessIdentity.email;hiddenContext.identityMode='identified'}
    if(accessIdentity?.subject){hiddenContext.verifiedSubject=accessIdentity.subject;hiddenContext.identityMode='identified'}
    if(invitation) hiddenContext.identityMode='identified'
    const { accepted: acceptedAnswers, completionStepId, reachedStepIds, paymentStepId } = validatePathAnswers(steps, choices, rules, input.answers, revisionBranchSelection(revision.policySnapshotJson),hiddenAnswers(hiddenContext),settings)
    if(invitation) {
      const prefills = settings.prefill?.length ? await readPrefillProof(this.loadTimeSecret,input.prefillProof ?? '',invitation.id,revision.id) : {}
      const onPath = Object.fromEntries(Object.entries(prefills).filter(([id])=>reachedStepIds.includes(id)))
      const markers = prefillMarkers(onPath,acceptedAnswers)
      if(Object.keys(markers).length) hiddenContext.prefill = markers
    }
    if(settings.calculations?.length) hiddenContext.calculations=evaluateCalculations(settings.calculations ?? [],Object.fromEntries(acceptedAnswers.map(answer=>[answer.stepId,answer.value])),hiddenContext.hidden)
    const order=JSON.parse(session.presentationJson) as Partial<PresentationOrder>
    const presentedOrder=retainedPresentation({choices:order.choices ?? {},blocks:order.blocks ?? {}},reachedStepIds)
    if(Object.keys(presentedOrder.choices).length || Object.keys(presentedOrder.blocks).length) hiddenContext.presentedOrder=presentedOrder
    const now = new Date().toISOString()
    const consents = consentRecords(settings.marketing, steps.map(step => ({ id: step.stableId, questionType: step.questionType, questionSettings: step.questionSettingsJson ? JSON.parse(step.questionSettingsJson) : null })), acceptedAnswers, now)
    if (consents.length) hiddenContext.consents = consents
    const responseId = ulid()
    const payment = paymentStepId ? await this.payments.attempt(responseId, 1, steps, choices, { paymentStepId, completionStepId, accepted: acceptedAnswers }, hiddenContext.calculations ?? {}) : undefined
    const elapsed = Math.max(0, Date.now() - loadedAt)
    const quarantineReason = input.honeypot?.trim() ? 'honeypot' : elapsed < minimumFillMilliseconds ? 'minimum-fill-time' : null
    const state = quarantineReason ? 'quarantined' as const : 'released' as const
    const created = await this.repository.createCompletedResponse({
      response: {
        id: responseId,
        contextJson: JSON.stringify(hiddenContext),
        participantId: invitation ? invitation.id : null,
        workspaceId: flow.workspaceId,
        flowId: flow.id,
        revisionId: revision.id,
        sessionId: session.id,
        sessionTokenHash: tokenHash,
        idempotencyKey: input.idempotencyKey,
        state,
        quarantineReason,
        releasedAt: state === 'released' ? now : null,
        releasedByOperatorId: null,
        completionMilliseconds: elapsed,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      answers: acceptedAnswers.map((answer) => ({ id: ulid(), responseId, stepId: answer.stepId, valueJson: JSON.stringify(storedAnswerValue(steps.find(step => step.stableId === answer.stepId)!, answer.value)), createdAt: now, updatedAt: now })),
      sessionTokenHash: tokenHash,
      completedAt: now,
      completionMilliseconds: elapsed,
      reachedStepIds,
      completionStepId,
      payment,
    })
    if (!created) {
      const concurrent = await this.repository.findResponseBySession(session.id)
      if (concurrent?.idempotencyKey === input.idempotencyKey) return settle(concurrent)
      const [latestFlow, latestRevision] = await Promise.all([this.flowRepository.findFlow(flow.id), this.flowRepository.findRevisionById(revision.id)])
      const expired = latestRevision?.deadlineAt && Date.parse(latestRevision.deadlineAt) <= Date.now()
      if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
      if (!latestFlow || !['open', 'closed'].includes(latestFlow.status) || latestRevision?.admissionClosedAt || expired || (latestRevision && await this.targetReached(latestRevision))) throw new FlowClosedError(closedFlowFor(revision, flow.slug))
      const remaining = await this.repository.findSubmissionContext(session.id, tokenHash)
      if (!remaining || remaining.session.expiresAt <= new Date().toISOString()) throw new SessionUnavailableError()
      await this.collectors.requireSessionOpen(flow.id, session.id, session.source)
        .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
      throw new ValidationError('This response session has already completed or cannot accept this submission.')
    }
    // PAY-001: the response is committed with payment pending; the respondent now pays on Stripe Checkout.
    if (payment) return this.payments.checkoutReceipt({ id: responseId, state }, flow.slug, false)
    const redirectUrl = completionRedirect({steps:publicSteps(steps),choices:publicChoices(steps,choices),branchRules:publicRules(rules),formSettings:settings,hiddenContext},completionStepId,Object.fromEntries(acceptedAnswers.map(answer=>[answer.stepId,answer.value])))
    return { responseId, idempotent: false, disposition: state, completionStepId, redirectUrl: state === 'released' ? redirectUrl : null }
  }

  async releaseQuarantinedResponse(input: { workspaceId: string; responseId: string; operatorId: string }) {
    const released = await this.repository.releaseQuarantinedResponse({ ...input, now: new Date().toISOString() })
    if (!released) throw new NotFoundError('The requested quarantined response does not exist.')
  }

  async deleteQuarantinedResponse(input: { workspaceId: string; responseId: string; operatorId: string }) {
    const deleted = await this.repository.deleteQuarantinedResponse({ ...input, now: new Date().toISOString() })
    if (!deleted) throw new NotFoundError('The requested quarantined response does not exist.')
  }

  async eraseReleasedResponse(input: { workspaceId: string; responseId: string; operatorId: string; sessionId?: string }) {
    const erased = await this.repository.eraseReleasedResponse({ ...input, now: new Date().toISOString() })
    if (!erased) throw new NotFoundError('The requested released response does not exist.')
  }

  async listQuarantinedResponses(input: { workspaceId: string; revisionId: string }) {
    return this.repository.listQuarantined(input.workspaceId, input.revisionId)
  }

  private async targetReached(revision: { id: string; targetCompletedResponses: number | null }) {
    return revision.targetCompletedResponses !== null && await this.repository.countAdmittedResponses(revision.id) >= revision.targetCompletedResponses
  }

  private async currentPublicRevision(slug: string) {
    const resolved = await this.flowRepository.getCurrentPublicSnapshot(slug)
    const flow = resolved?.flow
    if (!flow || flow.status === 'draft' || flow.status === 'archived') throw new NotFoundError('This flow is not available for responses.')
    const revision = resolved?.revision
    if (!revision) throw new NotFoundError('This flow has no published revision.')
    const expired = revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()
    if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
    if (flow.status !== 'open' || revision.admissionClosedAt || expired || (revision.targetCompletedResponses !== null && resolved.completedResponses >= revision.targetCompletedResponses)) throw new FlowClosedError(closedFlowFor(revision, flow.slug))
    return { flow, revision, steps: resolved.steps, choices: resolved.choices, rules: resolved.rules }
  }

  private async hash(value: string) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(bytes), (part) => part.toString(16).padStart(2, '0')).join('')
  }
}
