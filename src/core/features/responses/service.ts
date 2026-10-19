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
import { revisionBranchSelection, type BranchSelection } from '../../shared/flowPolicies'
import manifest from '../../../../seed.json'
import { visibilityCondition } from '../../shared/screenLayout'
import { evaluateCondition } from '../../shared/conditions'
import { answerIssue, isUnanswered } from '../../shared/answers'
import { ulid } from 'ulid'
import { publicSteps, publicChoices, publicRules, questionSettings, resolveNextStep, type FlowRepository, type StoredBranchRule, type StoredChoice, type StoredStep } from '../flows'
import { FlowClosedError, NotFoundError, RateLimitError, SessionUnavailableError, ValidationError } from '../../shared/errors'
import type { ResponseRepository } from './repository'

type DeviceClass = 'mobile' | 'tablet' | 'desktop'
type PublicSource = 'direct' | 'embed'
type AnswerInput = { stepId: string; value: unknown }

const sessionRetentionMilliseconds = manifest.limits.respondentSessions.retentionDays * 24 * 60 * 60 * 1000
const minimumFillMilliseconds = manifest.limits.abuse.minimumSecondsFromFormLoadToSubmit * 1000
function normalizeOptional(value: unknown) { return isUnanswered(value) ? undefined : value }

export class ResponseService {
  constructor(
    private readonly flowRepository: FlowRepository,
    private readonly repository: ResponseRepository,
    private readonly collectors: CollectorService,
    private readonly loadTimeSecret: string,
    private readonly access:RestrictedAccess,
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
    if (!admitted) throw new RateLimitError()
  }

  async invitationFlow(token: string, accessToken?:string) {
    const invitation = await this.repository.findInvitation(token)
    if (!invitation) throw new NotFoundError('This invitation is no longer available.')
    const revision = await this.flowRepository.findRevisionById(invitation.revisionId)
    const flow = revision && await this.flowRepository.findFlow(revision.flowId)
    if (!flow || !revision || flow.status === 'archived') throw new NotFoundError('This invitation is no longer available.')
    const expired = revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()
    if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
    if (flow.status === 'draft' || revision.admissionClosedAt || expired || await this.targetReached(revision)) throw new FlowClosedError({ title: revision.title, slug: flow.slug })
    const collector = await this.collectors.requireInvitationOpen(flow.id, token)
      .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
    await this.access.require(formSettings(revision.formSettingsJson),revision.id,revision.title,flow.slug,accessToken)
    const { steps, choices, rules } = await this.flowRepository.getRevisionGraph(revision.id)
    return { invitation, collector, flow, revision, steps, choices, rules, publicFlow: presentFlow({ formSettings: formSettings(revision.formSettingsJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title }, revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules), identity: 'identified' as const, completedStepId: invitation.responseStatus === 'completed' ? invitation.completionStepId : null }) }
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
    return { sessionId: session.id, sessionToken: token, loadTime: await issueLoadTime(this.loadTimeSecret, revision.id), revisionId: revision.id, flowId: flow.id, flow: presentFlow({ formSettings: formSettings(revision.formSettingsJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title }, revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules) },presentation) }
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

  async submitPublicResponse(input: { slug: string; sessionId: string; sessionToken: string; idempotencyKey: string; answers: AnswerInput[]; hidden?:Record<string,unknown>; honeypot?: string; loadTime?: string; clientAddress?: string; invitationToken?: string }) {
    await this.enforcePublicRequestRateLimit({ clientAddress: input.clientAddress, scope: 'submission' })
    if (!input.sessionToken) throw new SessionUnavailableError()
    const tokenHash = await this.hash(input.sessionToken)
    const replay = async (response: { id: string; revisionId: string; state: 'released' | 'quarantined'; contextJson?:string }) => {
      const [{ steps, choices, rules }, answers, revision] = await Promise.all([
        this.flowRepository.getRevisionGraph(response.revisionId),
        this.repository.getRetainedResponseAnswers(response.id),
        this.flowRepository.findRevisionById(response.revisionId),
      ])
      if (!answers || !revision) throw new NotFoundError('This completed response is no longer available.')
      // A retry is the original committed path, regardless of newer submitted
      // values. The immutable graph and retained answers also cover old rows.
      const completionStepId = this.retainedCompletion(steps, rules, {...hiddenAnswers(JSON.parse(response.contextJson ?? '{}') as ResponseContext),...variableAnswers((JSON.parse(response.contextJson ?? '{}') as ResponseContext).calculations),...Object.fromEntries(answers.map((answer) => [answer.stepId, runtimeAnswerValue(steps.find(step => step.stableId === answer.stepId), JSON.parse(answer.valueJson))]))}, revisionBranchSelection(revision.policySnapshotJson))
      const retainedContext = JSON.parse(response.contextJson ?? '{}') as ResponseContext
      const redirectUrl = completionRedirect({steps:publicSteps(steps),choices:publicChoices(steps,choices),branchRules:publicRules(rules),formSettings:formSettings(revision.formSettingsJson),hiddenContext:retainedContext},completionStepId,Object.fromEntries(answers.map(answer=>[answer.stepId,runtimeAnswerValue(steps.find(step=>step.stableId===answer.stepId),JSON.parse(answer.valueJson))])))
      return { responseId: response.id, idempotent: true, disposition: response.state, completionStepId, redirectUrl: response.state === 'released' ? redirectUrl : null }
    }
    const receipt = async () => {
      const retained = await this.repository.findResponseBySessionToken(input.sessionId, tokenHash)
      if (!retained) return undefined
      const retainedFlow = await this.flowRepository.findFlow(retained.flowId)
      if (!retainedFlow || retainedFlow.slug !== input.slug) throw new NotFoundError('This response does not belong to the requested flow.')
      if (retained.idempotencyKey === input.idempotencyKey) return replay(retained)
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
      if (existing.idempotencyKey === input.idempotencyKey) return replay(existing)
      throw new ValidationError('This response session has already been completed.')
    }

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
    const { accepted: acceptedAnswers, completionStepId, reachedStepIds } = this.validatePathAnswers(steps, choices, rules, input.answers, revisionBranchSelection(revision.policySnapshotJson),hiddenAnswers(hiddenContext),settings)
    if(settings.calculations?.length) hiddenContext.calculations=evaluateCalculations(settings.calculations ?? [],Object.fromEntries(acceptedAnswers.map(answer=>[answer.stepId,answer.value])),hiddenContext.hidden)
    const order=JSON.parse(session.presentationJson) as Partial<PresentationOrder>
    hiddenContext.presentedOrder=retainedPresentation({choices:order.choices ?? {},blocks:order.blocks ?? {}},reachedStepIds)
    const now = new Date().toISOString()
    const responseId = ulid()
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
    })
    if (!created) {
      const concurrent = await this.repository.findResponseBySession(session.id)
      if (concurrent?.idempotencyKey === input.idempotencyKey) return replay(concurrent)
      const [latestFlow, latestRevision] = await Promise.all([this.flowRepository.findFlow(flow.id), this.flowRepository.findRevisionById(revision.id)])
      const expired = latestRevision?.deadlineAt && Date.parse(latestRevision.deadlineAt) <= Date.now()
      if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
      if (!latestFlow || !['open', 'closed'].includes(latestFlow.status) || latestRevision?.admissionClosedAt || expired || (latestRevision && await this.targetReached(latestRevision))) throw new FlowClosedError({ title: revision.title, slug: flow.slug })
      const remaining = await this.repository.findSubmissionContext(session.id, tokenHash)
      if (!remaining || remaining.session.expiresAt <= new Date().toISOString()) throw new SessionUnavailableError()
      await this.collectors.requireSessionOpen(flow.id, session.id, session.source)
        .catch(error => collectorFlowFailure(error, { title: revision.title, slug: flow.slug }))
      throw new ValidationError('This response session has already completed or cannot accept this submission.')
    }
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
    return revision.targetCompletedResponses !== null && await this.repository.countReleasedResponses(revision.id) >= revision.targetCompletedResponses
  }

  private async currentPublicRevision(slug: string) {
    const resolved = await this.flowRepository.getCurrentPublicSnapshot(slug)
    const flow = resolved?.flow
    if (!flow || flow.status === 'draft' || flow.status === 'archived') throw new NotFoundError('This flow is not available for responses.')
    const revision = resolved?.revision
    if (!revision) throw new NotFoundError('This flow has no published revision.')
    const expired = revision.deadlineAt && Date.parse(revision.deadlineAt) <= Date.now()
    if (expired) await this.flowRepository.closeExpiredRevision(revision.id, new Date().toISOString())
    if (flow.status !== 'open' || revision.admissionClosedAt || expired || (revision.targetCompletedResponses !== null && resolved.completedResponses >= revision.targetCompletedResponses)) throw new FlowClosedError({ title: revision.title, slug: flow.slug })
    return { flow, revision, steps: resolved.steps, choices: resolved.choices, rules: resolved.rules }
  }

  private retainedCompletion(steps: StoredStep[], rules: StoredBranchRule[], answers: Record<string, unknown>, selection: BranchSelection) {
    // This evidence already passed the admission rules in force at commitment.
    // Trace its pinned graph; never reject or rewrite it under newer validation.
    const byStableId = new Map(steps.map((step) => [step.stableId, step]))
    const visited = new Set<string>()
    let current: StoredStep | undefined = steps[0]
    while (current && !visited.has(current.stableId)) {
      visited.add(current.stableId)
      if (current.kind === 'completion') return current.stableId
      const step: StoredStep = current
      const next = resolveNextStep({ selection, step, rules: rules.filter((rule) => rule.sourceStepStableId === step.stableId), answers })
      current = next.nextStepId ? byStableId.get(next.nextStepId) : undefined
    }
    throw new ValidationError('The retained completion could not be read. This response has not been resubmitted.')
  }

  private validatePathAnswers(steps: StoredStep[], choices: StoredChoice[], rules: StoredBranchRule[], answers: AnswerInput[], selection: BranchSelection, context:Record<string,unknown> = {}, settings?:import('../../shared/hiddenFields').FormSettings) {
    const submitted = new Map<string, unknown>()
    for (const answer of answers) {
      if (submitted.has(answer.stepId)) throw new ValidationError('Each question can be answered once per submission.')
      submitted.set(answer.stepId, answer.value)
    }
    const choicesByStep = new Map<string, StoredChoice[]>()
    for (const choice of choices) choicesByStep.set(choice.stepId, [...(choicesByStep.get(choice.stepId) ?? []), choice])
    const byStableId = new Map(steps.map((step) => [step.stableId, step]))
    const first = steps[0]
    if (!first) throw new ValidationError('This published flow has no first screen.')
    const accepted: AnswerInput[] = []
    const values=()=>formAnswerContext(settings,Object.fromEntries(accepted.map(answer=>[answer.stepId,answer.value])),{hidden:Object.fromEntries(Object.entries(context).filter(([id])=>id.startsWith('hidden:')).map(([id,value])=>[id.slice(7),value])) as ResponseContext['hidden']})
    const reached = new Set<string>()
    const visited = new Set<string>()
    let current: StoredStep | undefined = first
    while (current && !visited.has(current.stableId)) {
      visited.add(current.stableId)
      const visible: boolean = !visibilityCondition(publicSteps([current])[0]) || evaluateCondition(visibilityCondition(publicSteps([current])[0])!, values()).matched
      if(visible) reached.add(current.stableId)
      if (current.kind === 'question' && visible) {
        const value = normalizeOptional(submitted.get(current.stableId))
        if (value === undefined) {
          if (current.required) throw new ValidationError(`A response is required for “${current.prompt}”.`)
        } else {
          this.validateQuestionValue(current, choicesByStep.get(current.id) ?? [], value)
          accepted.push({ stepId: current.stableId, value })
        }
      }
      if (current.kind === 'completion') break
      const answerRecord = values()
      const next: {nextStepId:string|null} = resolveNextStep({ selection, step: current, rules: rules.filter((rule) => rule.sourceStepStableId === current!.stableId), answers: answerRecord })
      current = next.nextStepId ? byStableId.get(next.nextStepId) : undefined
    }
    if (!current || current.kind !== 'completion') throw new ValidationError('The selected respondent path does not reach a completion screen.')
    const unknown = [...submitted.keys()].filter((stepId) => !byStableId.has(stepId))
    if (unknown.length > 0) throw new ValidationError('A submitted answer does not belong to this published flow.')
    return { accepted, completionStepId: current.stableId, reachedStepIds: [...reached] }
  }

  private validateQuestionValue(step: StoredStep, choices: StoredChoice[], value: unknown) {
    const issue = answerIssue({ ...step, questionSettings: questionSettings(step, choices).value }, choices.map((choice) => choice.stableId), value)
    if (issue) throw new ValidationError(`“${step.prompt}”: ${issue}`, [{ stepId: step.stableId, reason: issue }])
  }

  private async hash(value: string) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(bytes), (part) => part.toString(16).padStart(2, '0')).join('')
  }
}
