import { validateInput as zValidator, emptyMutationBody } from '../../shared/validation'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { PencilError } from '../../shared/errors'
import { requireSameOriginRequest } from '../auth'

const workspaceSettingsSchema = z.object({
  reminderDelayHours:z.number().min(0).max(8760).optional(),
  embedAllowedOrigins: z.array(z.string().trim().max(300)).max(30).optional(),
  timeZone: z.string().trim().min(1).max(100),
  sendingWindowStart: z.string().regex(/^\d{2}:\d{2}$/),
  sendingWindowEnd: z.string().regex(/^\d{2}:\d{2}$/),
})

const inviteOperatorSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(100),
})

const operatorPathSchema = z.object({ operatorId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i) })

function failure(context: Context<WorkerEnvironment>, error: unknown) {
  if (error instanceof PencilError) {
    const status = error.code === 'NOT_FOUND' ? 404
      : error.code === 'FORBIDDEN' ? 403
        : error.code === 'CONFLICT' ? 409
          : 400
    return context.json({ error: error.code, message: error.message }, status)
  }
  throw error
}

export function registerWorkspaceRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/workspace', async (context) => {
    try {
      return context.json(await services(context).workspace.getSettings(context.get('operatorSession').workspaceId))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.put('/api/app/workspace', zValidator('json', workspaceSettingsSchema), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).workspace.updateSettings({
        workspaceId: context.get('operatorSession').workspaceId,
        ...context.req.valid('json'),
      }))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.get('/api/app/operators', async (context) => {
    try {
      return context.json(await services(context).auth.listOperators(context.get('operatorSession').workspaceId))
    } catch (error) {
      return failure(context, error)
    }
  })

  app.post('/api/app/operators', zValidator('json', inviteOperatorSchema), async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      return context.json(await services(context).auth.inviteOperator({
        workspaceId: context.get('operatorSession').workspaceId,
        actorOperatorId: context.get('operatorSession').operatorId,
        ...context.req.valid('json'),
        runtime: { appOrigin: context.get('platform').configuration.appOrigin },
        request: context.req.raw,
      }), 201)
    } catch (error) {
      return failure(context, error)
    }
  })

  app.delete('/api/app/operators/:operatorId', zValidator('param', operatorPathSchema), emptyMutationBody, async (context) => {
    try {
      requireSameOriginRequest(context.req.raw)
      await services(context).auth.removeOperator({
        workspaceId: context.get('operatorSession').workspaceId,
        actorOperatorId: context.get('operatorSession').operatorId,
        targetOperatorId: context.req.valid('param').operatorId,
      })
      return new Response(null, { status: 204 })
    } catch (error) {
      return failure(context, error)
    }
  })
}
