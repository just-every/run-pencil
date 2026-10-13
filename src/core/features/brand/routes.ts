import type { Hono } from 'hono'
import { z } from 'zod'
import type { WorkerEnvironment } from '../../app/environment'
import type { RequestServices } from '../../app/request-context'
import { validateInput, emptyMutationBody } from '../../shared/validation'
import { ValidationError } from '../../shared/errors'
import { logoByteLimit } from './logo'
const brandSchema = z.object({ name: z.string().trim().min(1).max(100), supportingLine: z.string().trim().max(240), accent: z.string().regex(/^#[0-9a-f]{6}$/i), publicFlowSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).nullable() }).strict()

export function registerBrandRoutes(app: Hono<WorkerEnvironment>, services: RequestServices) {
  app.get('/api/app/brand', async c => c.json(await services(c).brand.get(c.get('operatorSession').workspaceId)))
  app.put('/api/app/brand', validateInput('json', brandSchema), async c => c.json(await services(c).brand.save(c.get('operatorSession').workspaceId, c.req.valid('json'))))
  app.put('/api/app/brand/logo', async c => {
    const mime = c.req.header('Content-Type') ?? ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw new ValidationError('Choose a PNG, JPEG or WebP logo. SVG is not accepted.')
    const declared = c.req.header('Content-Length')
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > logoByteLimit)) throw new ValidationError(`The logo must not exceed ${logoByteLimit} bytes.`)
    const reader = c.req.raw.body?.getReader()
    if (!reader) throw new ValidationError('Choose an image to upload.')
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > logoByteLimit) { await reader.cancel(); throw new ValidationError(`The logo must not exceed ${logoByteLimit} bytes.`) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return c.json(await services(c).brand.saveLogo(c.get('operatorSession').workspaceId, bytes, mime))
  })
  app.delete('/api/app/brand/logo', emptyMutationBody, async c => c.json(await services(c).brand.removeLogo(c.get('operatorSession').workspaceId)))
  app.get('/api/public/brand/logo', validateInput('query', z.object({ v: z.string().uuid() }).strict()), async c => services(c).brand.logoResponse(c.req.valid('query').v))
}
