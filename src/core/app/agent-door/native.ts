import { ToolRefusal, type ToolContext } from '../../../base/agent-door/index.ts'
import { PencilError } from '../../shared/errors'
import type { PencilServices } from '../services'
import { pencilPeople } from './people'

export async function nativeScope(db: D1Database, services: PencilServices, personId: string) {
  const person = await pencilPeople(db, services.auth).read(personId)
  if (!person) throw new ToolRefusal('unauthenticated')
  return { workspaceId: person.workspaceId, operatorId: person.id }
}

export async function nativeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn()
    if (result && typeof result === 'object' && 'kind' in result && result.kind === 'conflict') throw new ToolRefusal('revision_conflict')
    return result
  } catch (error) {
    if (error instanceof PencilError) throw new ToolRefusal(error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN' ? 'not_found' : error.code === 'CONFLICT' ? 'revision_conflict' : 'invalid_arguments')
    throw error
  }
}

export function nativeActor(ctx: ToolContext) {
  return { prepared_by: ctx.actor, approvers: ctx.approvers }
}
