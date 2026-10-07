import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const loadPublicConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { mountServerExtensions } = await import('./mountExtensions.server')
  return mountServerExtensions().publicSeedConfig
})

export const loadPublicFlow = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const { requestServices } = await import('../platform/request.server')
    const { services } = await requestServices()
    try {
      return { state: 'open' as const, flow: await services.flows.getPublicFlow(data.slug) }
    } catch (error) {
      const { FlowClosedError, PencilError } = await import('../shared/errors')
      if (error instanceof PencilError && error.code === 'NOT_FOUND') throw notFound()
      if (error instanceof FlowClosedError) {
        return { state: 'closed' as const, flow: error.flow }
      }
      throw error
    }
  })

export const requireOperator = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ requestServices }] = await Promise.all([
    import('../platform/request.server'), import('../features/auth'),
  ])
  const { services, request } = await requestServices()
  const session = await services.auth.getSession(request)
  if (!session) throw redirect({ to: '/signin' })
  return session
})

export const requireLocalInbox = createServerFn({ method: 'GET' }).handler(async () => {
  const { requestServices } = await import('../platform/request.server')
  const { platform } = await requestServices()
  if (!platform.configuration.isLocalDevelopment) throw notFound()
  return true
})

export const loadPrivateDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ requestServices }] = await Promise.all([
    import('../platform/request.server'), import('../features/auth'),
  ])
  const { services, request } = await requestServices()
  const session = await services.auth.getSession(request)
  if (!session) throw redirect({ to: '/signin' })
  const [flows, workspace] = await Promise.all([services.flows.listDashboard(session.workspaceId), services.workspace.getSettings(session.workspaceId)])
  const hasFlows = flows.length > 0 || (await services.flows.listDashboard(session.workspaceId, 'archived')).length > 0
  return { flows, workspace, hasFlows }
})

export const loadInvitation = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }))
  .handler(async ({ data }) => {
    const { requestServices } = await import('../platform/request.server')
    const { services } = await requestServices()
    try {
      const context = await services.responses.invitationFlow(data.token)
      return { state: 'open' as const, flow: context.publicFlow }
    } catch (error) {
      const { FlowClosedError, PencilError } = await import('../shared/errors')
      if (error instanceof PencilError && error.code === 'NOT_FOUND') throw notFound()
      if (error instanceof FlowClosedError) return { state: 'closed' as const, flow: error.flow }
      throw error
    }
  })
