import type { Hono } from 'hono'
import { z } from 'zod'
import { workflowTag } from '../submissions'
import { searchPhrase } from '../reporting'
import type { WorkerEnvironment } from '../../app/environment'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import { listCodes, createCode } from './catalog'
import { listAnswers } from './answers'
import { assignManually, removeAssignment } from './assignments'
import { suggestions, decideSuggestion } from './suggestions'
import { codingCounts, codingCrosstab } from './metrics'

const flowParams=validateInput('param',z.object({flowId:resourceId}))
const assignmentParams=validateInput('param',z.object({responseId:resourceId,questionId:resourceId,codeId:resourceId}))
const filter=z.object({codeId:resourceId.optional(),search:searchPhrase.optional(),revisionId:resourceId.optional(),collectorId:resourceId.optional(),
  source:z.enum(['direct','embed','invitation','unknown','imported']).optional(),participantStatus:z.enum(['eligible','opted-out','bounced']).optional(),
  from:z.string().datetime().optional(),to:z.string().datetime().optional(),answerStepId:resourceId.optional(),answerValue:z.string().max(5000).optional(),
  workflowStatus:resourceId.optional(),workflowAssignee:resourceId.optional(),workflowTag:workflowTag.optional()})
export function registerCodingRoutes(app:Hono<WorkerEnvironment>) {
  app.get('/api/app/codes',validateInput('query',z.object({after:resourceId.optional()})),async c=>c.json(await listCodes(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.valid('query').after)))
  app.post('/api/app/codes',validateInput('json',z.object({label:z.string().trim().min(1).max(100).refine(value=>!/\p{Cc}/u.test(value))}).strict()),async c=>{
    const session=c.get('operatorSession');return c.json(await createCode(c.get('platform').databaseBinding,session.workspaceId,session.operatorId,c.req.valid('json').label),201)
  })
  app.get('/api/app/flows/:flowId/coding/answers',flowParams,validateInput('query',filter.extend({questionId:resourceId.optional(),after:resourceId.optional()})),async c=>c.json(await listAnswers(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),c.req.valid('query'))))
  app.put('/api/app/responses/:responseId/answers/:questionId/codes/:codeId',assignmentParams,emptyMutationBody,async c=>{
    const session=c.get('operatorSession'),p=c.req.valid('param');return c.json(await assignManually(c.get('platform').databaseBinding,session.workspaceId,session.operatorId,p.responseId,p.questionId,p.codeId))
  })
  app.delete('/api/app/responses/:responseId/answers/:questionId/codes/:codeId',assignmentParams,emptyMutationBody,async c=>{
    const p=c.req.valid('param');await removeAssignment(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,p.responseId,p.questionId,p.codeId);return c.body(null,204)
  })
  app.get('/api/app/flows/:flowId/coding/suggestions',flowParams,validateInput('query',z.object({after:resourceId.optional()})),async c=>c.json(await suggestions(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),c.req.valid('query').after)))
  app.put('/api/app/coding/suggestions/:quoteId',validateInput('param',z.object({quoteId:resourceId})),validateInput('json',z.object({decision:z.enum(['accepted','rejected']),codeId:resourceId.optional()}).strict()),async c=>{
    const session=c.get('operatorSession');return c.json(await decideSuggestion(c.get('platform').databaseBinding,session.workspaceId,session.operatorId,c.req.param('quoteId'),c.req.valid('json')))
  })
  app.get('/api/app/flows/:flowId/coding/counts',flowParams,validateInput('query',filter.extend({after:resourceId.optional()})),async c=>{
    const {after,...selected}=c.req.valid('query');return c.json(await codingCounts(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),selected,after))
  })
  app.get('/api/app/flows/:flowId/coding/crosstab',flowParams,validateInput('query',filter.extend({rowCodeId:resourceId,columnCodeId:resourceId})),async c=>{
    const {rowCodeId,columnCodeId,...selected}=c.req.valid('query');return c.json(await codingCrosstab(c.get('platform').databaseBinding,c.get('operatorSession').workspaceId,c.req.param('flowId'),selected,rowCodeId,columnCodeId))
  })
}
