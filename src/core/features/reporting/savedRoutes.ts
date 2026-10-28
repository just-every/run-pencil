import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import { resourceId, validateInput } from '../../shared/validation'
import { recordOperatorAudit } from '../audit'
import { ReportingRepository } from './repository'
import { NotFoundError } from '../../shared/errors'
import { savedViewInput, dashboardInput, shareInput } from './savedValidation'
import { createSavedView, savedViewDetail } from './savedService'
import { listSavedViews, listDashboards } from './savedRepository'
import { writeDashboard, dashboardDetail } from './savedDashboards'
import { createReportShare, listReportShares, readSharedReport, revokeReportShare } from './sharedAccess'

const flowParam = validateInput('param', z.object({ flowId: resourceId }))
const viewParam = validateInput('param', z.object({ viewId: resourceId }))
const dashboardParam = validateInput('param', z.object({ dashboardId: resourceId }))
const tokenParam = validateInput('param', z.object({ token: z.string().min(1).max(256) }))

export function registerSavedReportRoutes(app: Hono<WorkerEnvironment>) {
  app.get('/api/app/saved-views', async context => context.json(await listSavedViews(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId)))
  app.get('/api/app/flows/:flowId/saved-views', flowParam, async context => {
    const db = context.get('platform').databaseBinding, workspaceId = context.get('operatorSession').workspaceId, flowId = context.req.param('flowId')
    if (!await new ReportingRepository(db).flow(workspaceId, flowId)) throw new NotFoundError('This form is unavailable.')
    return context.json(await listSavedViews(db, workspaceId, flowId))
  })
  app.post('/api/app/flows/:flowId/saved-views', flowParam, validateInput('json', savedViewInput), async context => context.json(await createSavedView(context.get('platform').databaseBinding, context.get('operatorSession'), context.req.param('flowId'), context.req.valid('json')), 201))
  app.get('/api/app/saved-views/:viewId', viewParam, async context => context.json(await savedViewDetail(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId, context.req.param('viewId'))))
  app.get('/api/app/saved-views/:viewId/shares', viewParam, async context => context.json(await listReportShares(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId, context.req.param('viewId'))))
  app.post('/api/app/saved-views/:viewId/shares', viewParam, validateInput('json', shareInput), async context => {
    const result = await createReportShare(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId, context.req.param('viewId'), context.req.valid('json'))
    await recordOperatorAudit(context, 'report.shared', { type: 'saved-view', id: context.req.param('viewId') }, { passwordRequired: Number(result.share.passwordRequired) })
    return context.json(result, 201)
  })
  app.delete('/api/app/report-shares/:shareId', validateInput('param', z.object({ shareId: resourceId })), async context => {
    await revokeReportShare(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId, context.req.param('shareId'))
    await recordOperatorAudit(context, 'report.revoked', { type: 'report-share', id: context.req.param('shareId') })
    return context.body(null, 204)
  })
  app.get('/api/app/report-dashboards', async context => context.json(await listDashboards(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId)))
  app.post('/api/app/report-dashboards', validateInput('json', dashboardInput), async context => context.json(await writeDashboard(context.get('platform').databaseBinding, context.get('operatorSession'), context.req.valid('json')), 201))
  app.get('/api/app/report-dashboards/:dashboardId', dashboardParam, async context => context.json(await dashboardDetail(context.get('platform').databaseBinding, context.get('operatorSession').workspaceId, context.req.param('dashboardId'))))
  app.put('/api/app/report-dashboards/:dashboardId', dashboardParam, validateInput('json', dashboardInput), async context => context.json(await writeDashboard(context.get('platform').databaseBinding, context.get('operatorSession'), context.req.valid('json'), context.req.param('dashboardId'))))
  app.use('/api/public/reports/*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    context.header('Referrer-Policy', 'no-referrer')
    context.header('X-Robots-Tag', 'noindex')
    context.header('X-Content-Type-Options', 'nosniff')
    await next()
  })
  app.get('/api/public/reports/:token', tokenParam, async context => {
    const result = await readSharedReport(context.get('platform').databaseBinding, context.req.param('token'))
    return context.json(result, 'passwordRequired' in result ? 401 : 200)
  })
  app.post('/api/public/reports/:token', tokenParam, validateInput('json', z.object({ password: z.string().min(1).max(4096) })), async context => {
    const result = await readSharedReport(context.get('platform').databaseBinding, context.req.param('token'), context.req.valid('json').password)
    return context.json(result, 'passwordRequired' in result ? 401 : 200)
  })
}
