import type { Hono } from 'hono'
import type { WorkerEnvironment } from '../../app/environment'
import { requireSameOriginRequest } from '../auth'
import { ForbiddenError, ValidationError } from '../../shared/errors'
import { backupBytes } from './model'
import { exportBackup } from './export'
import { checkBackup } from './check'

const privateHeaders = { 'cache-control': 'no-store, private', vary: 'Cookie' }
async function boundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new ValidationError('Choose a Pencil backup to check.')
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) {
    const {done,value} = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > backupBytes) { await reader.cancel(); throw new ValidationError('This archive exceeds the 8 MiB browser limit. Use the restore-test command on this page.') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)) as unknown }
  catch { throw new ValidationError('The file is not valid JSON. Choose the original .rer backup download.') }
}

export function registerBackupRoutes(app: Hono<WorkerEnvironment>) {
  app.use('/api/app/backup/*', async (c,next) => {
    c.header('Cache-Control', 'no-store, private'); c.header('Vary', 'Cookie')
    const auth = c.get('services').auth
    const native = await auth.native.getSession(c.req.raw)
    if (native?.operator.role !== 'owner' || !await auth.getSession(c.req.raw)) throw new ForbiddenError('Only the installation owner can download or check a complete backup.')
    requireSameOriginRequest(c.req.raw)
    await next()
  })
  app.post('/api/app/backup/export', async c => {
    const result = await exportBackup(c.get('platform').databaseBinding)
    return new Response(result.body, {headers: {...privateHeaders, 'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="pencil-backup.rer"', 'x-pencil-backup-sha256': result.summary.sha256}})
  })
  app.post('/api/app/backup/check', async c => {
    try {
      const { summary } = await checkBackup(await boundedBody(c.req.raw))
      return c.json(summary, 200, privateHeaders)
    } catch (error) {
      if (error instanceof ValidationError) throw error
      throw new ValidationError('The archive does not pass Pencil’s privacy or migration checks. Keep your deployment and download a new matching-version backup.')
    }
  })
}
