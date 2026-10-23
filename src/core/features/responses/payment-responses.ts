import { closedFlowFor } from './closed'
import { ulid } from 'ulid'
import { evaluateCalculations } from '../../shared/calculations'
import { completionRedirect } from '../../shared/completionRedirect'
import { FlowClosedError, NotFoundError, ValidationError } from '../../shared/errors'
import { revisionBranchSelection, revisionReviewEnabled } from '../../shared/flowPolicies'
import { formSettings, hiddenAnswers, normalizeHidden, type ResponseContext } from '../../shared/hiddenFields'
import type { PaymentState } from '../../shared/payments'
import { presentationOrder, presentFlow } from '../../shared/presentationOrder'
import { publicChoices, publicRules, publicSteps, type FlowRepository, type StoredChoice, type StoredStep } from '../flows'
import type { PaymentAttempt, PaymentRow, PaymentService } from '../payments'
import { issueLoadTime } from '../traffic'
import { runtimeAnswerValue, storedAnswerValue } from './answerStorage'
import { validatePathAnswers, type AnswerInput } from './path'
import { completionReceipt } from './receipt'
import type { ResponseRepository } from './repository'

type ResponseRow = NonNullable<Awaited<ReturnType<ResponseRepository['findResponseBySession']>>>
export type PaymentSubmission = { slug: string; idempotencyKey: string; answers: AnswerInput[]; hidden?: Record<string, unknown> }
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
const unpaidEnd = (payment: PaymentRow) => payment.state === 'cancelled' || payment.state === 'expired'
  || ((payment.state === 'pending' || payment.state === 'failed') && !!payment.checkoutExpiresAt && payment.checkoutExpiresAt <= new Date().toISOString())

/** PAY-001's respondent side of RESP-007, RESP-011 and RESP-012: commit pending, pay on Stripe Checkout, come back,
 * or replace an unpaid attempt so that one session (or one invitation) keeps one response. */
export class PaymentResponses {
  constructor(private readonly flows: FlowRepository, private readonly responses: ResponseRepository, readonly payments: PaymentService, private readonly loadTimeSecret: string) {}

  /** Recomputed from the published revision before anything commits: no connection, or a total outside the step's limits, refuses. */
  async attempt(responseId: string, attempt: number, steps: StoredStep[], choices: StoredChoice[], path: { paymentStepId: string; completionStepId: string; accepted: AnswerInput[] }, calculations: Record<string, unknown>): Promise<PaymentAttempt> {
    const connection = await this.payments.connection()
    const graph = { steps: publicSteps(steps), choices: publicChoices(steps, choices) }
    const quote = this.payments.quote(graph.steps.find(step => step.id === path.paymentStepId)!, graph, Object.fromEntries(path.accepted.map(answer => [answer.stepId, answer.value])), calculations)
    return this.payments.attempt({ responseId, attempt, stepId: path.paymentStepId, completionStepId: path.completionStepId, quote, connection })
  }

  async checkoutReceipt(response: { id: string; state: 'released' | 'quarantined' }, slug: string, idempotent: boolean) {
    const payment = await this.payments.forResponse(response.id)
    if (!payment) throw new NotFoundError('This payment is no longer available.')
    return { responseId: response.id, idempotent, disposition: response.state, completionStepId: null, redirectUrl: null, payment: await this.payments.checkout(payment, slug) }
  }

  /** A retry under the response's key: a paid order keeps its completion, an open checkout resumes, an unpaid end is replaced. */
  async settle(response: ResponseRow, input: PaymentSubmission) {
    const payment = await this.payments.forResponse(response.id)
    if (!payment) return completionReceipt(this.flows, this.responses, response)
    if (payment.state === 'paid' || payment.state === 'processing' || payment.state === 'partially_refunded' || payment.state === 'refunded') return { ...await completionReceipt(this.flows, this.responses, response), payment: { state: payment.state } }
    if (!unpaidEnd(payment)) return this.checkoutReceipt(response, input.slug, true)
    return this.replace(response, payment, input)
  }

  /** The next attempt replaces a cancelled or expired one. Stripe ends any open checkout first, so it can never be paid
   * afterwards; final admission is rechecked as for a first submission. */
  async replace(response: ResponseRow, payment: PaymentRow, input: PaymentSubmission, rebind?: { sessionId: string; sessionTokenHash: string }) {
    if ((payment.state === 'pending' || payment.state === 'failed') && !await this.payments.cancel(payment)) return { ...await completionReceipt(this.flows, this.responses, response), payment: { state: payment.state } }
    const current = await this.payments.forResponse(response.id)
    const [{ steps, choices, rules }, revision, flow] = await Promise.all([this.flows.getRevisionGraph(response.revisionId), this.flows.findRevisionById(response.revisionId), this.flows.findFlow(response.flowId)])
    if (!current || !revision || !flow || flow.slug !== input.slug) throw new NotFoundError('This response does not belong to the requested flow.')
    const settings = formSettings(revision.formSettingsJson), previous = JSON.parse(response.contextJson ?? '{}') as ResponseContext
    const context: ResponseContext = { ...normalizeHidden(settings, input.hidden ?? {}), identityMode: previous.identityMode ?? settings.identityMode }
    if (previous.verifiedEmail) context.verifiedEmail = previous.verifiedEmail
    if (previous.verifiedSubject) context.verifiedSubject = previous.verifiedSubject
    if (previous.presentedOrder) context.presentedOrder = previous.presentedOrder
    const path = validatePathAnswers(steps, choices, rules, input.answers, revisionBranchSelection(revision.policySnapshotJson), hiddenAnswers(context), settings)
    if (settings.calculations?.length) context.calculations = evaluateCalculations(settings.calculations, Object.fromEntries(path.accepted.map(answer => [answer.stepId, answer.value])), context.hidden)
    const next = path.paymentStepId ? await this.attempt(response.id, current.attempt + 1, steps, choices, { ...path, paymentStepId: path.paymentStepId }, context.calculations ?? {}) : undefined
    const now = new Date().toISOString()
    const replaced = await this.responses.replaceUnpaidResponse({
      response, attempt: current.attempt, contextJson: JSON.stringify(context), completionStepId: path.completionStepId, payment: next, now,
      answers: path.accepted.map(answer => ({ id: ulid(), responseId: response.id, stepId: answer.stepId, valueJson: JSON.stringify(storedAnswerValue(steps.find(step => step.stableId === answer.stepId)!, answer.value)), createdAt: now, updatedAt: now })),
      ...(rebind ? { rebind: { ...rebind, idempotencyKey: input.idempotencyKey, reachedStepIds: path.reachedStepIds } } : {}),
    })
    if (!replaced) {
      const latestFlow = await this.flows.findFlow(flow.id), latestRevision = await this.flows.findRevisionById(revision.id)
      if (!latestFlow || !['open', 'closed'].includes(latestFlow.status) || latestRevision?.admissionClosedAt || (latestRevision?.deadlineAt && Date.parse(latestRevision.deadlineAt) <= Date.now())
        || (latestRevision?.targetCompletedResponses != null && await this.responses.countAdmittedResponses(revision.id) >= latestRevision.targetCompletedResponses)) throw new FlowClosedError(closedFlowFor(revision, flow.slug))
      throw new ValidationError('This response changed while it was being sent. Retry with the same answers.')
    }
    if (next) return this.checkoutReceipt(response, flow.slug, false)
    const redirectUrl = completionRedirect({ steps: publicSteps(steps), choices: publicChoices(steps, choices), branchRules: publicRules(rules), formSettings: settings, hiddenContext: context }, path.completionStepId, Object.fromEntries(path.accepted.map(answer => [answer.stepId, answer.value])))
    return { responseId: response.id, idempotent: false, disposition: response.state, completionStepId: path.completionStepId, redirectUrl: response.state === 'released' ? redirectUrl : null }
  }

  /** Stripe's success and cancel links. Success shows the completion screen the path reached (RESP-011). Cancel ends the
   * checkout at Stripe, marks it cancelled and reopens the payment step with every answer, under a fresh session token
   * and the response's own key. */
  async returnFromCheckout(input: { slug: string; token: string; outcome: 'success' | 'cancel' }) {
    const payment = await this.payments.byReturnToken(await this.payments.returnTokenHash(input.token))
    if (!payment || payment.slug !== input.slug) throw new NotFoundError('This payment link is no longer available. Open the form again to answer it.')
    const response = await this.responses.findResponse(payment.responseId)
    if (!response) throw new NotFoundError('This response is no longer available.')
    let state: PaymentState = payment.state
    if (input.outcome === 'cancel' && (state === 'pending' || state === 'failed') && await this.payments.cancel(payment)) state = 'cancelled'
    const [{ steps, choices, rules }, revision, flow, answers] = await Promise.all([this.flows.getRevisionGraph(response.revisionId), this.flows.findRevisionById(response.revisionId), this.flows.findFlow(response.flowId), this.responses.getRetainedResponseAnswers(response.id)])
    if (!revision || !flow || !answers) throw new NotFoundError('This response is no longer available.')
    const settings = formSettings(revision.formSettingsJson), context = JSON.parse(response.contextJson ?? '{}') as ResponseContext
    const graph = { steps: publicSteps(steps), choices: publicChoices(steps, choices) }, fresh = presentationOrder(graph)
    const flowView = { ...presentFlow({ formSettings: settings, reviewBeforeSubmit: revisionReviewEnabled(revision.policySnapshotJson), branchSelection: revisionBranchSelection(revision.policySnapshotJson), flow: { id: flow.id, slug: flow.slug, title: revision.title },
      revision: { id: revision.id, number: revision.number, publishedAt: revision.publishedAt, deadlineAt: revision.deadlineAt, targetCompletedResponses: revision.targetCompletedResponses }, ...graph, branchRules: publicRules(rules) },
      { choices: { ...fresh.choices, ...context.presentedOrder?.choices }, blocks: { ...fresh.blocks, ...context.presentedOrder?.blocks } }), hiddenContext: context }
    const values = answers.map(answer => ({ stepId: answer.stepId, value: runtimeAnswerValue(steps.find(step => step.stableId === answer.stepId), JSON.parse(answer.valueJson)) }))
    if (state === 'cancelled' || state === 'expired') {
      const sessionToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
      await this.responses.rotateSessionToken(response.id, hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionToken))))
      return { state: 'open' as const, payment: { state }, flow: flowView, sessionId: response.sessionId, sessionToken, revisionId: revision.id, answers: values, currentStepId: payment.stepId, idempotencyKey: response.idempotencyKey, loadTime: await issueLoadTime(this.loadTimeSecret, revision.id) }
    }
    const receipt = await completionReceipt(this.flows, this.responses, response)
    return { state: 'completed' as const, payment: { state }, flow: flowView, answers: values, completionStepId: receipt.completionStepId, redirectUrl: receipt.redirectUrl }
  }
}
