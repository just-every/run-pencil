import type { Hono } from 'hono'
import { z } from 'zod'
import { emptyMutationBody, resourceId, validateInput } from '../../shared/validation'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { freezeEvidence } from './evidence'
import { ValidationError } from '../../shared/errors'
import { createActionSchema, editActionSchema, measurementSchema, transitionSchema } from './model'
import { registerTaskConnectionRoutes } from './connection-routes'

const actionParam = validateInput('param', z.object({ actionId: resourceId }))

export function registerActionRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  registerTaskConnectionRoutes(app)
  const detail = async (context: Parameters<RequestServices>[0], actionId: string) => {
    const { workspaceId } = context.get('operatorSession'), actions = services(context).actions
    return { ...await actions.records.get(workspaceId, actionId), task: await actions.tasks.status(workspaceId, actionId) }
  }
  app.get('/api/app/actions', async c => c.json(await services(c).actions.records.list(c.get('operatorSession').workspaceId)))
  app.post('/api/app/actions', validateInput('json', createActionSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), input = c.req.valid('json'), all = services(c)
    // The figures are read here, on the server, as results show them now; the browser cannot supply them.
    const figures = await freezeEvidence(all.flows, all.reporting, workspaceId, input.evidence)
    if (input.analysisId) {
      // The analysis must be this workspace's, show a recommendation, and rest on the same flow revision as the action.
      const analysis = await all.analysis.records.detail(workspaceId, input.analysisId)
      if (!analysis.recommendation || analysis.flowId !== input.evidence.flowId || analysis.revisionId !== input.evidence.revisionId) throw new ValidationError('This analysis has no recommendation for that flow revision.')
    }
    const id = await all.actions.records.create(workspaceId, operatorId, input, figures)
    return c.json(await detail(c, id), 201)
  })
  app.get('/api/app/actions/:actionId', actionParam, async c => c.json(await detail(c, c.req.valid('param').actionId)))
  app.patch('/api/app/actions/:actionId', actionParam, validateInput('json', editActionSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), { actionId } = c.req.valid('param')
    await services(c).actions.records.edit(workspaceId, operatorId, actionId, c.req.valid('json'))
    return c.json(await detail(c, actionId))
  })
  app.post('/api/app/actions/:actionId/transitions', actionParam, validateInput('json', transitionSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), { actionId } = c.req.valid('param'), input = c.req.valid('json')
    await services(c).actions.records.transition(workspaceId, operatorId, actionId, input.to, input.note, input.expectedVersion)
    return c.json(await detail(c, actionId))
  })
  app.post('/api/app/actions/:actionId/measurements', actionParam, validateInput('json', measurementSchema), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), { actionId } = c.req.valid('param')
    await services(c).actions.records.measure(workspaceId, operatorId, actionId, c.req.valid('json'))
    return c.json(await detail(c, actionId), 201)
  })
  app.get('/api/app/actions/:actionId/task', actionParam, async c => {
    const { workspaceId } = c.get('operatorSession'), { actionId } = c.req.valid('param'), tasks = services(c).actions.tasks
    const status = await tasks.status(workspaceId, actionId)
    return c.json({ ...status, ...(status.available ? await tasks.preview(workspaceId, actionId) : {}) })
  })
  app.post('/api/app/actions/:actionId/task/confirm', actionParam, validateInput('json', z.object({ payloadSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()), async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), { actionId } = c.req.valid('param')
    return c.json(await services(c).actions.tasks.confirm(workspaceId, operatorId, actionId, c.req.valid('json').payloadSha256))
  })
  app.post('/api/app/actions/:actionId/task/retry', actionParam, emptyMutationBody, async c => {
    const { workspaceId, operatorId } = c.get('operatorSession'), { actionId } = c.req.valid('param')
    return c.json(await services(c).actions.tasks.deliver(workspaceId, operatorId, actionId))
  })
}
