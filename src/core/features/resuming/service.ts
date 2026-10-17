import type { MailSender } from '../../../base/operator-auth/index.mjs'
import manifest from '../../../../seed.json'
import type { FlowRepository } from '../flows'
import type { ResponseRepository, ResponseService } from '../responses'
import { CollectorClosedError, type CollectorService } from '../collectors'
import { FlowClosedError, PencilError, SessionUnavailableError, ValidationError } from '../../shared/errors'
import { validateSavedAnswers, resumedPublicFlow } from './answers'
import { hashResumeValue, resumeBearer, resumedSessionToken } from './credentials'
import { resumeMessage } from './message'
import { ResumeRepository } from './repository'

type SaveInput = { slug: string; sessionId: string; sessionToken: string; commandKey: string; email: string; currentStepId: string; answers: Array<{ stepId: string; value: unknown }>; invitationToken?: string; clientAddress?: string }

export class ResumeService {
  constructor(private readonly repository: ResumeRepository, private readonly responses: ResponseRepository,
    private readonly flows: FlowRepository, private readonly collectors: CollectorService, private readonly responseService: ResponseService,
    private readonly sender: MailSender, private readonly mail: { origin: string; from: string; secret: string; local: boolean }) {}

  private async admission(context: NonNullable<Awaited<ReturnType<ResponseRepository['findSubmissionContext']>>>) {
    const { session, revision, flow } = context, now = new Date().toISOString()
    if (session.expiresAt<=now || session.completedAt) throw new SessionUnavailableError()
    if (!['open','closed'].includes(flow.status) || revision.admissionClosedAt || revision.deadlineAt && revision.deadlineAt<=now || revision.targetCompletedResponses!==null && await this.responses.countReleasedResponses(revision.id)>=revision.targetCompletedResponses) throw new FlowClosedError({ slug: flow.slug, title: revision.title })
    try { await this.collectors.requireSessionOpen(flow.id,session.id,session.source) }
    catch (error) { if (error instanceof CollectorClosedError) throw new FlowClosedError({ slug: flow.slug, title: revision.title, collectionClosed: true }); throw error }
  }

  async save(input: SaveInput) {
    await this.responseService.enforcePublicRequestRateLimit({clientAddress:input.clientAddress,scope:'submission'})
    const sessionHash = await hashResumeValue(input.sessionToken)
    const context = await this.responses.findSubmissionContext(input.sessionId,sessionHash)
    if (!context || context.flow.slug!==input.slug) throw new SessionUnavailableError()
    await this.admission(context)
    let participantId: string | null = null
    if (context.session.source==='invitation') {
      const invitation = input.invitationToken && await this.repository.invitation(input.invitationToken)
      if (!invitation || invitation.revision_id!==context.revision.id || invitation.response_status==='completed' || !await this.repository.ownsInvitation(input.sessionId,invitation.collector_id)) throw new SessionUnavailableError()
      participantId=invitation.id
    } else if (input.invitationToken) throw new ValidationError('This response does not use an invitation.')
    const graph = await this.flows.getRevisionGraph(context.revision.id)
    const answers = validateSavedAnswers(graph,context.revision.policySnapshotJson,input.currentStepId,input.answers)
    const previous = await this.repository.bySession(input.sessionId)
    if (previous?.command_key===input.commandKey) {
      if (previous.answers_json!==JSON.stringify(answers) || previous.current_step_id!==input.currentStepId || previous.participant_id!==participantId || previous.delivery_email && previous.delivery_email!==input.email) throw new ValidationError('Use a new save command after changing saved answers or the delivery address.')
      if (previous.delivery_state==='sent') return { state:'saved' as const,expiresAt:previous.expires_at }
      if (previous.delivery_state==='sending' && Date.now()-Date.parse(previous.updated_at)<5*60_000) throw new PencilError('SAVE_IN_PROGRESS','This save is still sending. Please wait before trying again.')
    }
    const now = new Date().toISOString()
    const expiresAt = previous?.command_key===input.commandKey ? previous.expires_at : new Date(Date.parse(now)+manifest.limits.respondentSessions.retentionDays*86400000).toISOString()
    const token = await resumeBearer(this.mail.secret,input.sessionId,input.commandKey)
    const deliveryId=`resume:${input.sessionId}:${input.commandKey}`
    if (!await this.repository.save({sessionId:input.sessionId,sessionHash,revisionId:context.revision.id,tokenHash:await hashResumeValue(token),commandKey:input.commandKey,deliveryId,email:input.email,stepId:input.currentStepId,answers:JSON.stringify(answers),participantId,expiresAt,now})) throw new SessionUnavailableError()
    const link = new URL(`/f/${encodeURIComponent(input.slug)}`,this.mail.origin)
    link.searchParams.set('resume',token)
    let sent=false
    try {
      const outcome=await this.sender.send({deliveryId,from:this.mail.from,to:[input.email],...resumeMessage(context.revision.title,link.href,expiresAt),headers:{'Auto-Submitted':'auto-generated'}})
      sent=outcome.status==='accepted' || outcome.status==='development' && this.mail.local
    } catch { /* The recorded failed state permits an explicit retry of this delivery key. */ }
    const recorded=await this.repository.delivered(input.sessionId,deliveryId,sent,new Date().toISOString())
    if (!sent || !recorded) throw new PencilError('RESUME_MAIL_UNAVAILABLE','Your saved response could not be confirmed by email. Retry with the same answers and email address; a previous email may still arrive.')
    return {state:'saved' as const,expiresAt}
  }

  async resolve(slug: string, token: string) {
    const unavailable=()=>({state:'unavailable' as const,startAgain:`/f/${encodeURIComponent(slug)}`,message:'This saved response has expired or is no longer available. Start again to answer the current form.'})
    let row=await this.repository.byHash(await hashResumeValue(token))
    if (!row || row.expires_at<=new Date().toISOString()) return unavailable()
    const revision=await this.flows.findRevisionById(row.revision_id)
    const flow=revision && await this.flows.findFlow(revision.flowId)
    if (!revision || !flow || flow.slug!==slug) return unavailable()
    const graph=await this.flows.getRevisionGraph(revision.id)
    if (row.response_id && row.completion_step_id) {
      return {state:'completed' as const,flow:resumedPublicFlow(flow,revision,graph,!!row.participant_id,row.completion_step_id),completionStepId:row.completion_step_id}
    }
    const sessionToken=await resumedSessionToken(token)
    if (!await this.repository.activate(row,await hashResumeValue(sessionToken),new Date().toISOString())) {
      // A final submission can commit between resolution and activation. Read
      // its receipt rather than offering a fresh response for the completed one.
      row=await this.repository.byHash(await hashResumeValue(token))
      if (row?.response_id && row.completion_step_id && row.expires_at>new Date().toISOString()) return {state:'completed' as const,flow:resumedPublicFlow(flow,revision,graph,!!row.participant_id,row.completion_step_id),completionStepId:row.completion_step_id}
      return unavailable()
    }
    const context=await this.responses.findSubmissionContext(row.session_id,await hashResumeValue(sessionToken))
    if (!context) return unavailable()
    await this.admission(context)
    const invitation=row.participant_id ? await this.repository.invitationToken(row.participant_id) : undefined
    if (row.participant_id && !invitation) return unavailable()
    if (!row.answers_json || !row.current_step_id) return unavailable()
    return {state:'open' as const,flow:resumedPublicFlow(flow,revision,graph,!!row.participant_id),sessionId:row.session_id,sessionToken,revisionId:revision.id,answers:JSON.parse(row.answers_json) as Array<{stepId:string;value:unknown}>,currentStepId:row.current_step_id,...(invitation?{invitationToken:invitation.token}:{})}
  }
}
