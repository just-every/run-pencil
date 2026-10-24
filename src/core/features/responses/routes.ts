import { downloadResponseVersions } from './version-download'
import { recordOperatorAudit } from '../audit'
import { ResponseEdits } from './edits'
import { formLimits } from '../../shared/formLimits'
import { collectorKey, CollectorClosedError } from '../collectors'
import { validateInput as zValidator, resourceId, flowSlug, emptyMutationBody, answerValue } from '../../shared/validation'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { FlowClosedError, PencilError, RateLimitError, ValidationError } from '../../shared/errors'
import { requireSameOriginRequest } from '../auth'

const orderMap=z.record(resourceId,z.array(resourceId).max(1000)).refine(value=>Object.keys(value).length<=250)
const startSessionSchema = z.object({
  presentation:z.object({choices:orderMap,blocks:orderMap}).strict().optional(),
  accessToken:z.string().max(8192).optional(),
  deviceClass: z.enum(['mobile', 'tablet', 'desktop']),
  source: z.enum(['direct', 'embed']).default('direct'),
  collectorKey: collectorKey.optional(),
  invitationToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
})

const sessionCredentials = z.object({
  sessionId: resourceId,
  sessionToken: z.string().min(32).max(200),
})

const submitResponseSchema = sessionCredentials.extend({
  hidden:z.record(z.string().max(64),z.union([z.string().max(1000),z.number(),z.boolean()])).refine(value=>Object.keys(value).length<=100).optional(),
  // Missing credentials reach the named session refusal; present credentials
  // retain their original format bounds and never bypass service admission.
  sessionToken: z.string().min(32).max(200).optional(),
  idempotencyKey: z.string().min(12).max(200),
  answers: z.array(z.object({ stepId: resourceId, value: answerValue })).max(formLimits.questions.perRevision),
  invitationToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  prefillProof:z.string().max(200000).optional(),
  honeypot: z.string().max(500).optional(),
  loadTime: z.string().max(84).optional(),
  // PAY-001: never trusted. Pencil recomputes every amount from the published revision; a supplied one is refused.
  amount: z.unknown().optional(),
  payment: z.unknown().optional(),
})

function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if (error instanceof CollectorClosedError) return context.json({ error: error.code, message: error.message, ...(error.flow ? { closedFlow: error.flow } : {}) }, 409)
  if (error instanceof FlowClosedError) return context.json({ error: error.code, message: error.message, closedFlow: error.flow }, 409)
  if (error instanceof PencilError) {
    return context.json({ error: error.code, message: error.message, ...(error instanceof ValidationError && error.details ? { details: error.details } : {}) }, error instanceof RateLimitError ? 429 : error.code === 'NOT_FOUND' ? 404 : 400)
  }
  throw error
}

export function registerResponseRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  const editToken=z.string().regex(/^[a-f0-9]{64}$/)
  app.get('/api/public/flows/:slug/edit',zValidator('param',z.object({slug:flowSlug})),zValidator('query',z.object({token:editToken})),async context=>{
    try{return context.json(await new ResponseEdits(context.get('platform').databaseBinding).read(context.req.param('slug'),context.req.valid('query').token))}catch(error){return failure(context,error)}
  })
  app.post('/api/public/flows/:slug/edit',zValidator('param',z.object({slug:flowSlug})),zValidator('json',z.object({token:editToken,answers:z.array(z.object({stepId:resourceId,value:answerValue})).max(formLimits.questions.perRevision)}).strict()),async context=>{
    try{requireSameOriginRequest(context.req.raw);await services(context).responses.enforcePublicRequestRateLimit({clientAddress:context.req.header('CF-Connecting-IP'),scope:'submission'});const input=context.req.valid('json');return context.json(await new ResponseEdits(context.get('platform').databaseBinding).submit(context.req.param('slug'),input.token,input.answers))}catch(error){return failure(context,error)}
  })
  app.get('/api/app/responses/:responseId/versions/download',zValidator('param',z.object({responseId:resourceId})),async context=>{
    try{
      const responseId=context.req.param('responseId')
      const stream=await downloadResponseVersions(context.get('platform').databaseBinding,context.get('operatorSession').workspaceId,responseId,context.req.raw.signal)
      await recordOperatorAudit(context,'export.created',{type:'response',id:responseId},{export:'response-versions'})
      return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="pencil-response-${responseId}-versions.jsonl"`}})
    }catch(error){return failure(context,error)}
  })
  app.get('/api/app/responses/:responseId/versions',zValidator('param',z.object({responseId:resourceId})),async context=>{
    try{return context.json(await new ResponseEdits(context.get('platform').databaseBinding).versions(context.get('operatorSession').workspaceId,context.req.param('responseId')))}catch(error){return failure(context,error)}
  })

  app.post('/api/public/flows/:slug/views',zValidator('param',z.object({slug:flowSlug})),zValidator('json',z.object({revisionId:resourceId,source:z.enum(['direct','embed']),accessToken:z.string().max(8192).optional(),collectorKey:collectorKey.optional(),invitationToken:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict()),async context=>{
    try {
      if(/prefetch/i.test(context.req.header('Sec-Purpose')??context.req.header('Purpose')??''))return context.body(null,204)
      return context.json(await services(context).traffic.view({slug:context.req.param('slug'),...context.req.valid('json')}))
    }catch(error){return failure(context,error)}
  })
  app.get('/api/app/flows/:flowId/traffic',zValidator('param',z.object({flowId:resourceId})),zValidator('query',z.object({revisionId:resourceId,from:z.iso.date().optional(),to:z.iso.date().optional()})),async context=>{
    try {const {revisionId,from,to}=context.req.valid('query');return context.json(await services(context).traffic.report(context.get('operatorSession').workspaceId,context.req.param('flowId'),revisionId,from,to))}catch(error){return failure(context,error)}
  })

  app.post('/api/public/flows/:slug/sessions', zValidator('param', z.object({ slug: flowSlug })), zValidator('json', startSessionSchema), async (context) => {
    try {
      return context.json(await services(context).responses.startPublicSession({ slug: context.req.param('slug'), clientAddress: context.req.header('CF-Connecting-IP'), ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/public/flows/:slug/sessions/advance', zValidator('param', z.object({ slug: flowSlug })), zValidator('json', sessionCredentials.extend({ stepId: resourceId })), async (context) => {
    try {
      await services(context).responses.advancePublicSession({ slug: context.req.param('slug'), ...context.req.valid('json') })
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/public/flows/:slug/responses', zValidator('param', z.object({ slug: flowSlug })), zValidator('json', submitResponseSchema), async (context) => {
    try {
      const { amount, payment, ...input } = context.req.valid('json')
      if (amount !== undefined || payment !== undefined) throw new ValidationError('Pencil calculates the payment amount from the published form. A submitted amount is refused.')
      return context.json(await services(context).responses.submitPublicResponse({ slug: context.req.param('slug'), clientAddress: context.req.header('CF-Connecting-IP'), ...input, sessionToken: input.sessionToken ?? '' }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/app/revisions/:revisionId/quarantine', zValidator('param', z.object({ revisionId: resourceId })), async (context) => {
    try {
      return context.json(await services(context).responses.listQuarantinedResponses({ workspaceId: context.get('operatorSession').workspaceId, revisionId: context.req.param('revisionId') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/responses/:responseId/release', zValidator('param', z.object({ responseId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).responses.releaseQuarantinedResponse({ workspaceId: context.get('operatorSession').workspaceId, responseId: context.req.param('responseId'), operatorId: context.get('operatorSession').operatorId })
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.delete('/api/app/responses/:responseId/quarantine', zValidator('param', z.object({ responseId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).responses.deleteQuarantinedResponse({ workspaceId: context.get('operatorSession').workspaceId, responseId: context.req.param('responseId'), operatorId: context.get('operatorSession').operatorId })
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.delete('/api/app/responses/:responseId', zValidator('param', z.object({ responseId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).responses.eraseReleasedResponse({ workspaceId: context.get('operatorSession').workspaceId, responseId: context.req.param('responseId'), operatorId: context.get('operatorSession').operatorId, sessionId: context.get('operatorSession').id })
      return context.body(null, 204)
    } catch (error) { return failure(context, error) }
  })
}
