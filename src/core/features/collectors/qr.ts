import type { Context, Hono } from 'hono'
import { z } from 'zod'
// The package's root server entry loads Node PNG dependencies; its matrix core is portable.
// @ts-expect-error qrcode publishes no declaration for its pure matrix entry point.
import qrCore from 'qrcode/lib/core/qrcode.js'
import type { WorkerEnvironment } from '../../app/environment'
import { ValidationError } from '../../shared/errors'
import { resourceId, validateInput } from '../../shared/validation'
import { collectorId } from './model'
import { qrPng } from './qr-png'
import type { CollectorRequestServices } from './routes'

const encoder = qrCore as Pick<typeof import('qrcode'), 'create'>
const flowParams = z.object({ flowId: resourceId })
const collectorParams = flowParams.extend({ collectorId })
const downloadQuery = z.object({ format: z.enum(['svg', 'png']).default('svg') }).strict()

function xml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

function filename(slug: string, label: string, format: 'svg' | 'png') {
  const safe = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return `qr-${safe(slug)}-${safe(label)}.${format}`
}

function download(context: Context<WorkerEnvironment>, path: string, slug: string, label: string, format: 'svg' | 'png') {
  const url = new URL(path, context.get('platform').configuration.appOrigin).href
  const matrix = encoder.create(url, { errorCorrectionLevel: 'M' }).modules
  const headers = {
    'Content-Type': format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png',
    'Content-Disposition': `attachment; filename="${filename(slug, label, format)}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  if (format === 'png') return new Response(qrPng(matrix, label, url), { headers })
  const side = matrix.size + 8
  const modules: string[] = []
  for (let row = 0; row < matrix.size; row++) for (let column = 0; column < matrix.size; column++) {
    if (matrix.get(row, column)) modules.push(`M${column + 4} ${row + 4}h1v1h-1z`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side + 10}" width="${side * 8}" height="${(side + 10) * 8}" role="img" aria-labelledby="title description"><title id="title">${xml(label)}</title><desc id="description">${xml(url)}</desc><metadata>${xml(JSON.stringify({ source: label, url }))}</metadata><path fill="#fff" d="M0 0h${side}v${side + 10}H0z"/><path fill="#000" shape-rendering="crispEdges" d="${modules.join('')}"/><text x="4" y="${side + 5}" font-family="sans-serif" font-size="3" textLength="${side - 8}" lengthAdjust="spacingAndGlyphs">${xml(label)}</text></svg>`
  return new Response(svg, { headers })
}

/** Mount after the app's /api/app/* operator-session middleware. */
export function registerQrRoutes(app: Hono<WorkerEnvironment>, services: CollectorRequestServices) {
  app.get('/api/app/flows/:flowId/qr', validateInput('param', flowParams), validateInput('query', downloadQuery), async context => {
    const { workspaceId } = context.get('operatorSession')
    const { flow } = await services(context).flows.getBuilderDraft(workspaceId, context.req.valid('param').flowId)
    return download(context, `/f/${encodeURIComponent(flow.slug)}`, flow.slug, 'Direct link', context.req.valid('query').format)
  })
  app.get('/api/app/flows/:flowId/collectors/:collectorId/qr', validateInput('param', collectorParams), validateInput('query', downloadQuery), async context => {
    const { flowId, collectorId: id } = context.req.valid('param')
    const collector = await services(context).collectors.get(context.get('operatorSession').workspaceId, flowId, id)
    if (!collector.publicPath) throw new ValidationError('This source has no public collection link. Choose a direct-link, embed or named collector.')
    return download(context, collector.publicPath, flowId, collector.name, context.req.valid('query').format)
  })
}
