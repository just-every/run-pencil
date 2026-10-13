import type { Hono } from 'hono'
import { z } from 'zod'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { policiesSchema, requestRunSchema } from './model'
import { providerStatus } from './service'

const runParam = validateInput('param', z.object({ runId: resourceId }))

export function registerAnalysisRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/analysis', async c => {
    const { workspaceId } = c.get('operatorSession'), analysis = services(c).analysis
    return c.json({ provider: providerStatus(analysis.provider), policies: await analysis.records.policies(workspaceId), runs: await analysis.records.list(workspaceId), usage: await analysis.records.usage(workspaceId) })
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
