import type { Context } from 'hono'
import type { WorkerEnvironment } from './environment'
import { ForbiddenError } from '../shared/errors'

export async function requireConnectionOwner(context: Context<WorkerEnvironment>) {
  const session = await context.get('services').auth.native.getSession(context.req.raw)
  if (session?.operator.role !== 'owner') throw new ForbiddenError('Only the installation owner can change or test connections.')
}
