import { createIsomorphicFn } from '@tanstack/react-start'

/**
 * The deployment's origin, for the head tags that must be absolute URLs. On the server it is the platform's
 * configured origin: APP_ORIGIN in a deployment, the local origin in local development. In the browser it is the
 * page's own origin, which is the same one: the Worker answers no request for another host (server.ts).
 */
export const siteOrigin = createIsomorphicFn()
  .server(async () => {
    const { requestServices } = await import('../../platform/request.server')
    return (await requestServices()).platform.configuration.appOrigin
  })
  .client(() => window.location.origin)
