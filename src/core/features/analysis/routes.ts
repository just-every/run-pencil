import { registerStudioRoutes } from '../studio'
import { rewriteSchema } from './rewrites'
import type { Hono } from 'hono'
import { z } from 'zod'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { policiesSchema, requestRunSchema } from './model'
import { providerStatus } from './service'
import { registerAnalysisConnectionRoutes } from './connection-routes'

const runParam = validateInput('param', z.object({ runId: resourceId }))

export function registerAnalysisRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  registerAnalysisConnectionRoutes(app)
  registerStudioRoutes(app,services)
  app.post('/api/app/flows/:flowId/rewrites', validateInput('param',z.object({flowId:resourceId})),validateInput('json',rewriteSchema),async c=>{
    const {workspaceId,operatorId}=c.get('operatorSession')
    return c.json(await services(c).rewrites.request(workspaceId,operatorId,c.req.param('flowId'),c.req.valid('json')),201)
  })
  app.get('/api/app/rewrites/:id',validateInput('param',z.object({id:resourceId})),async c=>{
    const {workspaceId,operatorId}=c.get('operatorSession');return c.json(await services(c).rewrites.get(workspaceId,operatorId,c.req.param('id')))
  })
  app.post('/api/app/rewrites/:id/decision',validateInput('param',z.object({id:resourceId})),validateInput('json',z.object({accept:z.boolean()}).strict()),async c=>{
    const {workspaceId,operatorId}=c.get('operatorSession');await services(c).rewrites.decide(workspaceId,operatorId,c.req.param('id'),c.req.valid('json').accept);return c.body(null,204)
  })
  app.get('/api/app/analysis-attention',async c=>{const s=c.get('operatorSession');return c.json(await services(c).attention.read(s.workspaceId,s.operatorId))})
  app.put('/api/app/analysis-attention/preference',validateInput('json',z.object({muted:z.boolean()}).strict()),async c=>{const s=c.get('operatorSession');await services(c).attention.mute(s.operatorId,c.req.valid('json').muted);return c.json(await services(c).attention.read(s.workspaceId,s.operatorId))})
  app.put('/api/app/analysis-attention/:id/read',validateInput('param',z.object({id:resourceId})),emptyMutationBody,async c=>{const s=c.get('operatorSession');await services(c).attention.acknowledge(s.workspaceId,s.operatorId,c.req.param('id'));return c.json(await services(c).attention.read(s.workspaceId,s.operatorId))})
  app.get('/api/app/analysis', async c => {
    const { workspaceId } = c.get('operatorSession'), analysis = services(c).analysis
    return c.json({ timeZone: await analysis.records.timeZone(workspaceId), provider: providerStatus(analysis.provider), policies: await analysis.records.policies(workspaceId), runs: await analysis.records.list(workspaceId), usage: await analysis.records.usage(workspaceId) })
  })
  app.get('/api/app/analysis/options', validateInput('query', z.object({ flowId: resourceId })), async c => c.json(await services(c).analysis.options(c.get('operatorSession').workspaceId, c.req.valid('query').flowId)))
  // The run is requested and started in this request; the answer is its final state (queued again only for a transport retry).
  app.post('/api/app/analysis', validateInput('json', requestRunSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), analysis = services(c).analysis
    const id = await analysis.request(workspaceId, operatorId, c.req.valid('json'))
    return c.json(await analysis.records.detail(workspaceId, id!), 201)
  })
  app.put('/api/app/analysis/policies', validateInput('json', policiesSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), analysis = services(c).analysis
    await analysis.setPolicies(workspaceId, operatorId, c.req.valid('json'))
    return c.json(await analysis.records.policies(workspaceId))
  })
  app.post('/api/app/analysis/:runId/findings/:findingId/decision',validateInput('param',z.object({runId:resourceId,findingId:resourceId})),validateInput('json',z.object({decision:z.enum(['accepted','dismissed'])}).strict()),async c=>{
    const {workspaceId,operatorId}=c.get('operatorSession'),{runId,findingId}=c.req.valid('param')
    return c.json(await services(c).analysis.records.decide(workspaceId,operatorId,runId,findingId,c.req.valid('json').decision))
  })
  app.get('/api/app/analysis/:runId', runParam, async c => c.json(await services(c).analysis.records.detail(c.get('operatorSession').workspaceId, c.req.valid('param').runId)))
  app.get('/api/app/analysis/:runId/themes/:themeId/responses', validateInput('param', z.object({ runId: resourceId, themeId: resourceId })), async c => {
    const { runId, themeId } = c.req.valid('param')
    return c.json(await services(c).analysis.records.themeResponses(c.get('operatorSession').workspaceId, runId, themeId))
  })
  app.post('/api/app/analysis/:runId/retry', runParam, emptyMutationBody, async c => {
    const { workspaceId } = c.get('operatorSession'), analysis = services(c).analysis
    await analysis.retry(workspaceId, c.req.valid('param').runId)
    return c.json(await analysis.records.detail(workspaceId, c.req.valid('param').runId))
  })
}
