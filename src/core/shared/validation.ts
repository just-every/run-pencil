import { contactAnswerObject } from './contactAnswers'
import { zValidator } from '@hono/zod-validator'
import type { Context, MiddlewareHandler, ValidationTargets } from 'hono'
import { z } from 'zod'
import manifest from '../../../seed.json' with { type: 'json' }

export const resourceId = z.string().min(1).max(200).refine(value => !/[\u0000-\u001f\u007f]/.test(value))
export const flowSlug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const answerValue = z.union([z.object({ choiceIds: z.array(resourceId).min(1).max(manifest.limits.steps.choiceOptionsPerStep), otherText: z.string().max(manifest.limits.responses.shortTextCharactersPerAnswer) }).strict(), contactAnswerObject, z.string().max(manifest.limits.responses.openTextCharactersPerAnswer), z.number().finite(), z.boolean(), z.array(resourceId).max(manifest.limits.steps.choiceOptionsPerStep), z.null()])

export function invalidInput(context: Context, target: string) {
  return context.json({ error: 'VALIDATION_ERROR', message: `Invalid request ${target === 'json' ? 'body' : target === 'param' ? 'path parameters' : target}.` }, 400)
}

export function validateInput<Schema extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, context) => {
    if (!result.success) return invalidInput(context, target)
  })
}

// Actions with no payload accept absent/empty JSON objects; other input is refused.
export const emptyMutationBody: MiddlewareHandler = async (context, next) => {
  const body = await context.req.text()
  if (body.length) {
    const contentType = context.req.header('Content-Type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!/^application\/(?:[a-z0-9.-]+\+)?json$/.test(contentType)) return invalidInput(context, 'json')
    let value: unknown
    try { value = JSON.parse(body) } catch { return invalidInput(context, 'json') }
    if (!z.object({}).strict().safeParse(value).success) return invalidInput(context, 'json')
  }
  await next()
}
