import { registerSmsRoutes } from '../features/sms'
import { registerAddressRoutes } from '../features/addresses/routes'
import { registerPreviewRoutes } from '../features/link-preview/routes'
import { registerPaymentConnectionRoutes, registerPaymentRoutes } from '../features/payments'
import { registerRetentionRoutes } from '../features/retention/routes'
import { registerResumeRoutes } from '../features/resuming'
import { registerAuditRoutes } from '../features/audit'
import { registerSubmissionRoutes } from '../features/submissions/routes'
import { SubmissionService } from '../features/submissions/service'
import { registerAccessRoutes } from '../features/restricted-access/routes'
import { registerQrRoutes } from '../features/collectors/qr'
import { registerCollectorRoutes } from '../features/collectors'
import { registerBackupRoutes } from '../features/backup/routes'
import { registerManagementRoutes } from '../features/management/routes'
import { registerActionRoutes } from '../features/actions'
import { registerAnalysisRoutes } from '../features/analysis'
import { registerWebhookRoutes } from '../features/webhooks'
import { registerNotificationRoutes } from '../features/notifications/routes'
import { registerEmbeddingRoutes } from '../features/embedding/script'
import { registerBrandRoutes } from '../features/brand/routes'
import { registerImportRoutes } from '../features/importing/routes'
import { AuthError } from '../../base/operator-auth/index.mjs'
import { opaqueEmbedCors } from './public-cors'
import { registerDistributionRoutes } from '../features/distribution/routes'
import { DeploymentConfigurationError } from '../platform/config/runtime'
import { runScheduledMaintenance } from './maintenance'
import { publicRequestRateLimitResponse } from './public-paths'
import { registerCodingRoutes } from '../features/coding'
import { registerReportingRoutes } from '../features/reporting/routes'
import { Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import manifest from '../../../seed.json'
import { registerAuthRoutes } from '../features/auth/routes'
import { requireSameOriginRequest } from '../features/auth'
import { registerFlowRoutes } from '../features/flows/routes'
import { registerResponseRoutes } from '../features/responses/routes'
import { registerWorkspaceRoutes } from '../features/workspace/routes'
import { registerSetupRoutes, unfinishedOwnerSetup } from '../features/workspace/setup'
import { createRequestPlatform, type PencilPlatform } from '../platform/runtime'
import { ForbiddenError, PencilError } from '../shared/errors'
import { invalidInput } from '../shared/validation'
import type { WorkerBindings, WorkerEnvironment } from './environment'
import { mountServerExtensions } from './mountExtensions.server'
import { seedSampleData } from './seed'
import { createPencilServices, type PencilServices } from './services'
import { configuredIntegrationPlatform } from '../platform/config/connections'

function unauthenticatedResponse() {
  return Response.json(
    {
      error: 'AUTHENTICATION_REQUIRED',
      message: 'A valid operator session is required before the operator workspace can be served.',
    },
    { status: 401 },
  )
}

function signInRedirect(request: Request) {
  const current = new URL(request.url)
  const redirect = new URL('/signin', current)
  redirect.searchParams.set('returnTo', `${current.pathname}${current.search}`)
  return Response.redirect(redirect, 302)
}

function isCookieMutation(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

export function createWorkerApp(services?: PencilServices, platform?: PencilPlatform) {
  const app = new Hono<WorkerEnvironment>()

  app.use('*', async (context, next) => {
    try {
      const requestPlatform = platform ?? createRequestPlatform(context)
      context.set('platform', requestPlatform)
      context.set('services', services ?? await initializePencil(requestPlatform))
    } catch (error) {
      return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'The deployment could not initialize.' }, { status: 503 })
    }
    await next()
  })

  const enforcePublicRateLimit: MiddlewareHandler<WorkerEnvironment> = async (context, next) => {
    const denied = await publicRequestRateLimitResponse(context.req.raw, context.get('services').responses)
    if (denied) return denied
    await next()
  }

  app.use('*', enforcePublicRateLimit)
  app.use('/api/public/*', opaqueEmbedCors)


  app.get('/health', async (context) => {
    try {
      await context.get('services').workspace.checkHealth()
      return context.json({ status: 'ok', product: manifest.id, version: manifest.version, ...context.get('platform').deployment })
    } catch (error) {
      console.error('D1 health check failed.')
      return context.json({ status: 'not-ready', message: 'The D1 database is unavailable.' }, 503)
    }
  })

  const requireOperator: MiddlewareHandler<WorkerEnvironment> = async (context, next) => {
    const session = await context.get('services').auth.getSession(context.req.raw)
    if (!session) {
      return context.req.path === '/app' || context.req.path.startsWith('/app/')
        ? signInRedirect(context.req.raw)
        : unauthenticatedResponse()
    }
    context.set('operatorSession', session)
    if ((context.req.path === '/app' || context.req.path.startsWith('/app/')) && await unfinishedOwnerSetup(context.get('services'), context.req.raw)) return context.redirect('/setup', 302)
    await next()
  }

  const requireOperatorMutationOrigin: MiddlewareHandler<WorkerEnvironment> = async (context, next) => {
    if (!isCookieMutation(context.req.method)) return next()
    try {
      requireSameOriginRequest(context.req.raw)
    } catch (error) {
      if (error instanceof ForbiddenError) return context.json({ error: error.code, message: error.message }, 403)
      throw error
    }
    await next()
  }

  app.use('/api/app', requireOperator)
  app.use('/api/app/*', requireOperator)
  app.use('/api/app', requireOperatorMutationOrigin)
  app.use('/api/app/*', requireOperatorMutationOrigin)
  app.use('/app', requireOperator)
  app.use('/app/*', requireOperator)

  registerSmsRoutes(app)
  registerAddressRoutes(app)
  registerRetentionRoutes(app)
  registerBackupRoutes(app)
  registerManagementRoutes(app)
  registerAuthRoutes(app, context => context.get('services'), context => context.get('platform').configuration)
  registerEmbeddingRoutes(app, context => context.get('services'))
  registerPreviewRoutes(app)
  registerBrandRoutes(app, context => context.get('services'))
  registerWorkspaceRoutes(app, context => context.get('services'))
  registerSetupRoutes(app)
  registerFlowRoutes(app, context => context.get('services'))
  registerImportRoutes(app)
  registerResponseRoutes(app, context => context.get('services'))
  registerResumeRoutes(app, context => context.get('services'))
  registerAuditRoutes(app)
  registerSubmissionRoutes(app, context => new SubmissionService(context.get('platform').databaseBinding))
  registerCodingRoutes(app)
  registerReportingRoutes(app, context => context.get('services'))
  registerCollectorRoutes(app, context => context.get('services'))
  registerQrRoutes(app, context => context.get('services'))
  registerAccessRoutes(app, context => context.get('services'))
  registerDistributionRoutes(app, context => context.get('services'))
  registerNotificationRoutes(app, context => context.get('services'))
  registerActionRoutes(app, context => context.get('services'))
  registerPaymentConnectionRoutes(app)
  registerPaymentRoutes(app)
  registerWebhookRoutes(app)
  registerAnalysisRoutes(app, context => context.get('services'))

  app.onError((error, context) => {
    if (error instanceof AuthError) return context.json({ error: error.code }, error.status as 403)
    if (error instanceof HTTPException && error.status === 400) return invalidInput(context, 'json')
    if (error instanceof PencilError) return context.json({ error: error.code, message: error.message }, error.code === 'NOT_FOUND' ? 404 : error.code === 'RATE_LIMITED' ? 429 : error.code === 'FORBIDDEN' ? 403 : error.code === 'CONFLICT' ? 409 : 400)
    return context.json({ error: 'INTERNAL_ERROR', message: 'The request could not be completed. Retry or inspect deployment health.' }, 500)
  })

  app.notFound((context) => context.json({ error: 'NOT_FOUND', message: 'This path is not available in Pencil.' }, 404))

  return app
}

const fixtureInitializations = new WeakMap<D1Database, Promise<void>>()
export async function initializePencil(platform: PencilPlatform) {
  void mountServerExtensions()
  const services = createPencilServices(await configuredIntegrationPlatform(platform))
  if (platform.configuration.seedSampleData) {
    const binding = platform.databaseBinding
    let initialization = fixtureInitializations.get(binding)
    if (!initialization) {
      initialization = (async () => {
        const marker = await binding.prepare("SELECT id FROM local_fixture_initializations WHERE id = 'aurora-coffee-v1'").first()
        if (!marker) {
          await seedSampleData(services)
          await binding.prepare("INSERT OR IGNORE INTO local_fixture_initializations (id, initialized_at) VALUES ('aurora-coffee-v1', ?)").bind(new Date().toISOString()).run()
        }
      })().catch((error) => { fixtureInitializations.delete(binding); throw error })
      fixtureInitializations.set(binding, initialization)
    }
    await initialization
  }
  if (platform.configuration.bootstrapAdminEmail) {
    await services.workspace.ensurePrimaryWorkspace()
    // Base owns admission; fresh installations must have a viable bootstrap path.
    if (!platform.configuration.setupToken && !await platform.databaseBinding.prepare("SELECT id FROM oa_operators WHERE status IN ('active','invited') LIMIT 1").first()) {
      throw new DeploymentConfigurationError('SETUP_TOKEN is required until the first operator is established.')
    }
  }
  return services
}

// Routes and validators are immutable; each dispatch receives fresh request context.
export const workerApp = createWorkerApp()

// Hono-only runtime for domain tests. The emitted application's dispatcher is src/server.ts.
export default {
  scheduled: runScheduledMaintenance,
  async fetch(request: Request, environment: WorkerBindings, executionContext: ExecutionContext) {
    try {
      return workerApp.fetch(request, environment, executionContext)
    } catch (error) {
      return Response.json({ status: 'not-ready', message: error instanceof DeploymentConfigurationError ? error.message : 'The deployment could not initialize.' }, { status: 503 })
    }
  },
} satisfies ExportedHandler<WorkerBindings>
