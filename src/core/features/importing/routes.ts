import { z } from 'zod'
import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import { validateInput, resourceId } from '../../shared/validation'
import { FormImports } from './service'
import { reviewResponse } from './review-response'
import { reviewMediaType, reviewStream } from './review-stream'
import { validateImportInput } from './validated-input'
import type { ImportInput } from './model'
import { importFiles as files, sourceInputIssue } from './input-schema'
import { retrieveTypeformDefinition, typeformRequest } from './typeform-definition'
export function registerImportRoutes(app: Hono<WorkerEnvironment>) {
  const service = (context: any) => new FormImports(context.get('platform').databaseBinding, context.get('operatorSession'))
  // This value is owned by one decoded HTTP request. Release its consumed
  // uploads only after normalization; reusable service inputs stay untouched.
  const releaseUpload = (input: ImportInput) => () => { input.definition = ''; input.csv = '' }
  app.post('/api/app/imports/typeform/definition', validateImportInput(typeformRequest), async c => {
    c.header('Cache-Control', 'no-store')
    return c.json(await retrieveTypeformDefinition(c.req.valid('json')))
  })
  app.post('/api/app/imports/review', validateImportInput(files.superRefine(sourceInputIssue)), async c => {
    const input = c.req.valid('json')
    const review = await service(c).review(input, releaseUpload(input)), paged = c.req.header('Accept') === reviewMediaType
    return c.newResponse(paged ? reviewStream(review) : reviewResponse(review), { headers: { 'Content-Type': `${paged ? reviewMediaType : 'application/json'}; charset=UTF-8`, Vary: 'Accept' } })
  })
  app.post('/api/app/imports/commit', validateImportInput(files.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), acknowledged: z.boolean() }).superRefine(sourceInputIssue)), async c => {
    const input = c.req.valid('json')
    return c.json(await service(c).commit(input, input.fingerprint, input.acknowledged, releaseUpload(input)))
  })
  app.post('/api/app/imports/erasure-index', validateInput('json', z.object({})), async c => c.json(await service(c).upgradeErasureIndex()))
  app.post('/api/app/imports/cancel-staging', validateInput('json', z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })), async c => c.json(await service(c).cancelStaging(c.req.valid('json').fingerprint)))
  app.get('/api/app/imports', async c => c.json(await service(c).list()))
  app.get('/api/app/imports/:id', validateInput('param', z.object({ id: resourceId })), async c => c.json(await service(c).status(c.req.param('id'))))
  for (const action of ['resume', 'undo'] as const) app.post(`/api/app/imports/:id/${action}`, validateInput('param', z.object({ id: resourceId })), validateInput('json', z.object({})), async c => {
    try { return c.json(await service(c)[action](c.req.param('id'))) }
    catch (error) {
      if (error instanceof Error && /NATIVE_EDIT_CONFLICT|IMPORT_ATOMIC_GUARD/.test(error.message)) return c.json({ error: 'IMPORT_EDIT_CONFLICT', message: 'A later native edit was preserved. Undo stopped at its exact snapshot guard; earlier reversed batches remain reversed. Inspect the flow and import progress before continuing.' }, 409)
      throw error
    }
  })
}
