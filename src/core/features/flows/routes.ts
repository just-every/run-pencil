import { AccessRequiredError } from '../restricted-access'
import { hiddenSettingsIssue, type FormSettings } from '../../shared/hiddenFields'
import { conditionShape } from '../../shared/conditionValidation'
import type { Condition } from '../../shared/conditions'
import { formLimits } from '../../shared/formLimits'
import { questionTypes } from '../../shared/questionKinds'
import { validateInput as zValidator, resourceId, flowSlug, emptyMutationBody, answerValue } from '../../shared/validation'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { FlowClosedError, PencilError, RateLimitError } from '../../shared/errors'
import { requireSameOriginRequest } from '../auth'

const questionType = z.enum(questionTypes)
const stepSchema = z.object({
  kind: z.enum(['welcome', 'question', 'payment', 'completion']),
  questionType: questionType.nullable(),
  prompt: z.string().trim().max(1000),
  helperText: z.string().trim().max(1000).nullable().optional(),
  required: z.boolean().optional(),
  nextStepId: resourceId.nullable().optional(),
  questionSettings: z.record(z.string(), z.unknown()).nullable().optional(),
  choices: z.array(z.object({ value: z.string().trim().min(1).max(200), label: z.string().trim().min(1).max(300) })).max(formLimits.questions.dropdownChoices).optional(),
})

const branchesSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  rules: z.array(z.object({
    id: resourceId.optional(),
    sourceStepId: resourceId,
    predicateKind: z.enum(['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'any_of', 'all_of']),
    expectedValue: z.unknown(),
    condition: z.custom<Condition>(conditionShape).nullable().optional(),
    destinationStepId: resourceId,
    position: z.number().int().nonnegative(),
  })).max(100),
})

const updateDraftSchema = z.object({
  rules: branchesSchema.shape.rules.optional(),
  stepId: resourceId,
  prompt: z.string().trim().min(1).max(1000),
  required: z.boolean(),
  expectedVersion: z.number().int().nonnegative(),
  helperText: z.string().trim().max(1000).nullable().optional(),
  nextStepId: resourceId.nullable().optional(),
  questionSettings: z.record(z.string(), z.unknown()).nullable().optional(),
  questionType: questionType.nullable().optional(),
  choices: z.array(z.object({ id: resourceId.optional(), newId: resourceId.optional(), value: z.string().trim().max(200), label: z.string().trim().max(300) })).max(formLimits.questions.dropdownChoices).optional(),
})

function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if(error instanceof AccessRequiredError)return context.json({error:error.code,message:error.message,restriction:error.requirement},403)
  if (error instanceof PencilError) {
    if (error instanceof FlowClosedError) return context.json({ error: error.code, message: error.message, closedFlow: error.flow }, 409)
    const status = error instanceof RateLimitError ? 429 : error.code === 'NOT_FOUND' ? 404 : 400
    return context.json({ error: error.code, message: error.message, ...(error instanceof Error && 'details' in error && error.details ? { details: error.details } : {}) }, status)
  }
  throw error
}

export function registerFlowRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/dashboard', zValidator('query', z.object({ status: z.enum(['draft', 'open', 'closed', 'archived']).optional() })), async (context) => {
    try {
      return context.json(await services(context).flows.listDashboard(context.get('operatorSession').workspaceId, context.req.valid('query').status))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/app/templates', async context => context.json(await services(context).templates.list(context.get('operatorSession').workspaceId)))
  app.post('/api/app/flows/:flowId/templates', zValidator('param', z.object({flowId:resourceId})), zValidator('json', z.object({name:z.string().trim().min(1).max(100),source:z.enum(['draft','published']),expectedVersion:z.number().int().nonnegative()})), async context => {
    try { requireSameOriginRequest(context.req.raw); return context.json(await services(context).templates.save({...context.req.valid('json'),flowId:context.req.param('flowId'),...context.get('operatorSession')}),201) } catch(error) { return failure(context,error) }
  })
  app.delete('/api/app/templates/:templateId', zValidator('param', z.object({templateId:resourceId})), async context => {
    try { requireSameOriginRequest(context.req.raw); await services(context).templates.retire(context.get('operatorSession').workspaceId,context.req.param('templateId')); return context.body(null,204) } catch(error) { return failure(context,error) }
  })
  app.post('/api/app/templates/:templateId/flows', zValidator('param', z.object({templateId:resourceId})), zValidator('json', z.object({title:z.string().trim().min(1).max(200),slug:z.string().trim().min(1).max(120)})), async context => {
    try { requireSameOriginRequest(context.req.raw); return context.json(await services(context).templates.create({...context.req.valid('json'),templateId:context.req.param('templateId'),workspaceId:context.get('operatorSession').workspaceId}),201) } catch(error) { return failure(context,error) }
  })

  app.post('/api/app/flows', zValidator('json', z.object({ title: z.string().trim().min(1).max(200), slug: z.string().trim().min(1).max(120), template: z.enum(['feedback', 'nps', 'lead']).optional() })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.createDraftFlow({ workspaceId: context.get('operatorSession').workspaceId, ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/duplicate', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ title: z.string().trim().min(1).max(200), slug: z.string().trim().min(1).max(120) })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.duplicateFlow({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/app/flows/:flowId/draft', zValidator('param', z.object({ flowId: resourceId })), async (context) => {
    try {
      return context.json(await services(context).flows.getBuilderDraft(context.get('operatorSession').workspaceId, context.req.param('flowId')))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/app/flows/:flowId/results', zValidator('param', z.object({ flowId: resourceId })), zValidator('query', z.object({ revisionId: resourceId.optional() })), async (context) => {
    try {
      return context.json(await services(context).flows.getFlowResults(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.req.valid('query').revisionId))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.put('/api/app/flows/:flowId/draft', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', updateDraftSchema), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.updateBuilderDraft({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/draft/steps', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ expectedVersion: z.number().int().nonnegative(), step: stepSchema })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.addDraftStep({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/draft/steps/:stepId/duplicate', zValidator('param', z.object({ flowId: resourceId, stepId: resourceId })), zValidator('json', z.object({ expectedVersion: z.number().int().nonnegative() })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.duplicateDraftStep({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), stepId: context.req.param('stepId'), ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.delete('/api/app/flows/:flowId/draft/steps/:stepId', zValidator('param', z.object({ flowId: resourceId, stepId: resourceId })), zValidator('json', z.object({ expectedVersion: z.number().int().nonnegative() })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.deleteDraftStep({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), stepId: context.req.param('stepId'), ...context.req.valid('json') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.put('/api/app/flows/:flowId/draft/settings', zValidator('param',z.object({flowId:resourceId})), zValidator('json',z.object({expectedVersion:z.number().int().nonnegative(),settings:z.custom<FormSettings>(value=>!hiddenSettingsIssue(value))})), async context => {
    try { requireSameOriginRequest(context.req.raw); return context.json(await services(context).flows.updateFormSettings({...context.req.valid('json'),flowId:context.req.param('flowId'),...context.get('operatorSession')})) } catch(error) {return failure(context,error)}
  })

  app.put('/api/app/flows/:flowId/draft/screen' , zValidator('param',z.object({flowId:resourceId})), zValidator('json',z.object({stepId:resourceId,expectedVersion:z.number().int().nonnegative(),layout:z.object({kind:z.enum(['page','group']),title:z.string().trim().min(1).max(200),description:z.string().max(1000).optional(),randomize:z.boolean().optional(),questionIds:z.array(resourceId).min(1).max(formLimits.questions.perRevision)}).nullable()})), async context => {
    try { requireSameOriginRequest(context.req.raw); return context.json(await services(context).flows.updateScreen({...context.req.valid('json'),flowId:context.req.param('flowId'),...context.get('operatorSession')})) } catch(error) {return failure(context,error)}
  })

  app.put('/api/app/flows/:flowId/draft/order', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ expectedVersion: z.number().int().nonnegative(), orderedStepIds: z.array(resourceId).max(formLimits.steps.perRevision) })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.reorderDraftSteps({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.put('/api/app/flows/:flowId/draft/branches', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', branchesSchema), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.replaceDraftBranchRules({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/draft/preview', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ hidden:z.record(z.string().max(64),z.union([z.string().max(1000),z.number(),z.boolean()])).refine(value=>Object.keys(value).length<=100).optional(), answers: z.record(resourceId, answerValue).refine(answers => Object.keys(answers).length <= formLimits.questions.perRevision) })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.previewDraft({ workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/publish', zValidator('param', z.object({ flowId: resourceId })), zValidator('json', z.object({ expectedVersion: z.number().int().nonnegative(), deadlineAt: z.string().datetime().nullable().optional(), targetCompletedResponses: z.number().int().positive().nullable().optional() })), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).flows.publishDraft({ operatorId: context.get('operatorSession').operatorId, workspaceId: context.get('operatorSession').workspaceId, flowId: context.req.param('flowId'), ...context.req.valid('json') }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/close', zValidator('param', z.object({ flowId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).flows.closeFlow(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.get('operatorSession').operatorId)
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/reopen', zValidator('param', z.object({ flowId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).flows.reopenFlow(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.get('operatorSession').operatorId)
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/flows/:flowId/archive', zValidator('param', z.object({ flowId: resourceId })), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).flows.archiveFlow(context.get('operatorSession').workspaceId, context.req.param('flowId'), context.get('operatorSession').operatorId)
      return context.body(null, 204)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/public/flows/:slug', zValidator('param', z.object({ slug: flowSlug })), zValidator('query',z.object({collector:z.string().regex(/^[a-f0-9]{32}$/).optional(),source:z.enum(['direct','embed']).default('direct')})), async (context) => {
    try {
      const flow=await services(context).flows.getPublicFlow(context.req.param('slug'),context.req.header('x-pencil-access'))
      const {source,collector}=context.req.valid('query')
      await services(context).collectors.requireOpen(flow.flow.id,source,collector)
      return context.json(flow)
    } catch (error) {
      return failure(context, error)
    }
  })
}
