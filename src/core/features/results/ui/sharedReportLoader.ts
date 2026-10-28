import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

export const loadSharedReport = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }))
  .handler(async ({ data }) => {
    const { requestServices } = await import('../../../platform/request.server')
    const { readSharedReport } = await import('../../reporting/sharedAccess')
    const { NotFoundError } = await import('../../../shared/errors')
    const { platform } = await requestServices()
    try { return await readSharedReport(platform.databaseBinding, data.token) }
    catch (error) { if (error instanceof NotFoundError) throw notFound(); throw error }
  })
