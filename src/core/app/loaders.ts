import { decodePublicSlug } from './public-slug'
import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const loadPublicConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { mountServerExtensions } = await import('./mountExtensions.server')
  const { requestServices } = await import('../platform/request.server')
  const { publicBrandConfig } = await import('../features/brand/brand')
  const { services, request } = await requestServices()
  const publicPath = /^\/(?:f|embed)\/([^/]+)$/.exec(new URL(request.url).pathname)
  const slug = publicPath ? decodePublicSlug(publicPath[1]) : undefined
  if (publicPath && !slug) throw notFound()
  const brandWorkspace = slug ? await services.flows.getFlowWorkspaceId(slug) : undefined
  const config = publicBrandConfig(await services.brand.get(brandWorkspace), mountServerExtensions().publicSeedConfig)
  if (new URL(request.url).pathname.startsWith('/embed/')) {
    let host: string | undefined
    try { host = new URL(request.headers.get('Referer') ?? '').origin } catch { /* no parent protocol */ }
    const workspaceId = brandWorkspace
    if (workspaceId && host && (await services.workspace.getSettings(workspaceId)).embedAllowedOrigins.includes(host)) config.embedHostOrigin = host
  }
  return config
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
  const { services, platform, request } = await requestServices()
  const session = await services.auth.getSession(request)
  if (!session) throw redirect({ to: '/signin' })
  const { unfinishedOwnerSetup } = await import('../features/workspace/setup')
  if (await unfinishedOwnerSetup(services, request)) throw redirect({ to: '/setup' })
  return { ...session, editorEnabled: Boolean(platform.management.editor.managementOrigin || platform.management.editor.installationId) }
})

export const loadSignIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requestServices } = await import('../platform/request.server')
  const { services, platform } = await requestServices()
  const { mountServerExtensions } = await import('./mountExtensions.server')
  if (await services.auth.needsBootstrap()) throw redirect({ to: '/setup' })
  return { config: mountServerExtensions().publicSeedConfig, local: platform.configuration.isLocalDevelopment }
})

export const loadSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const { requestServices } = await import('../platform/request.server')
  const { services, platform, request } = await requestServices()
  if (await services.auth.needsBootstrap()) return { bootstrap: true, local: platform.configuration.isLocalDevelopment }
  const session = await services.auth.getSession(request)
  if (!session) throw redirect({ to: '/signin' })
  const native = await services.auth.native.getSession(request)
  if (!native || native.operator.role !== 'owner') throw redirect({ to: '/app' })
  const state = await services.workspace.setupState(session.workspaceId)
  if (state.complete) throw redirect({ to: '/app' })
  return { bootstrap: false, local: platform.configuration.isLocalDevelopment, name: state.name, timeZone: state.timeZone }
})

export const loadPrivateDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ requestServices }] = await Promise.all([
    import('../platform/request.server'), import('../features/auth'),
  ])
  const { services, request } = await requestServices()
  const session = await services.auth.getSession(request)
  if (!session) throw redirect({ to: '/signin' })
  const { unfinishedOwnerSetup } = await import('../features/workspace/setup')
  if (await unfinishedOwnerSetup(services, request)) throw redirect({ to: '/setup' })
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
