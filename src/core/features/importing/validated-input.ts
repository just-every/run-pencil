import type { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { invalidInput, type validateInput } from '../../shared/validation'

/** The native Request JSON reader releases its intermediate body text. Keep
 * the same schema, MIME admission and malformed-body response while retaining
 * only validated file fields for the import route. */
export function validateImportInput<Schema extends z.ZodObject>(schema: Schema): ReturnType<typeof validateInput<Schema, 'json'>> {
  return async (context, next) => {
    const contentType = context.req.header('Content-Type')
    let value: unknown = {}
    if (contentType && /^application\/([a-z-.]+\+)?json(;\s*[a-zA-Z0-9-]+=([^;]+))*$/i.test(contentType)) {
      try { value = await context.req.raw.json() }
      catch { throw new HTTPException(400, { message: 'Malformed JSON in request body' }) }
    }
    const result = await schema.safeParseAsync(value)
    if (!result.success) return invalidInput(context, 'json')
    context.req.addValidatedData('json', result.data)
    value = undefined
    return next()
  }
}
