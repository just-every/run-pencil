import { z } from 'zod'
import { ValidationError } from '../../shared/errors'

const identifier = /^[a-zA-Z0-9_-]{1,128}$/
export function typeformId(value: string): string {
  if (identifier.test(value)) return value
  let url: URL
  try { url = new URL(value) } catch { throw new ValidationError('Enter a Typeform form link or form ID. For a custom domain, use the form ID from its Typeform edit link.') }
  const match = url.pathname.match(/^\/(?:to|form|forms|create)\/([a-zA-Z0-9_-]{1,128})(?:\/|$)/)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'typeform.com' || url.hostname.endsWith('.typeform.com')) || !match) {
    throw new ValidationError('Use a link from typeform.com, or paste just the form ID from its Typeform edit link.')
  }
  return match[1]
}

export const typeformRequest = z.object({
  form: z.string().trim().min(1).max(2048),
  token: z.string().trim().min(1).max(1024).regex(/^[a-zA-Z0-9_.-]+$/),
}).strict()

const maxBytes = 8 * 1024 * 1024
async function readDefinition(response: Response): Promise<string> {
  if (Number(response.headers.get('Content-Length')) > maxBytes) throw new ValidationError('The Typeform definition exceeds the 8 MiB import limit.')
  if (!response.body) throw new ValidationError('Typeform returned an empty definition. Try again from your form’s edit link.')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new ValidationError('The Typeform definition exceeds the 8 MiB import limit.')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

/** One read-only request. The credential never enters import plans, settings or logs. */
export async function retrieveTypeformDefinition(input: z.infer<typeof typeformRequest>) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const id = typeformId(input.form)
    if (id === input.token) throw new ValidationError('The form ID and personal token must be different. Put your Typeform link in the form field and the token in the token field.')
    const response = await fetch(`https://api.typeform.com/forms/${id}`, {
      headers: { Authorization: `Bearer ${input.token}`, Accept: 'application/json' },
      redirect: 'manual', signal: controller.signal,
    })
    if (!response.ok) {
      await response.body?.cancel()
      const message = response.status === 401 ? 'Typeform did not accept the token. Generate a new personal token and paste it again.'
        : response.status === 403 ? 'This token cannot read the form. Enable the forms:read permission and use an account with access to this form.'
        : response.status === 404 ? 'Typeform could not find this form for your account. Check its link and that the token belongs to an account with access.'
        : response.status === 429 ? 'Typeform is receiving too many requests. Wait a minute, then paste your token and try again.'
        : 'Typeform could not return the form. Try again later; no import was created.'
      throw new ValidationError(message)
    }
    const definition = await readDefinition(response)
    // Do not return even a successful provider body if it echoes the credential.
    if (definition.includes(input.token)) throw new ValidationError('Typeform returned an unsafe definition. No definition was loaded; generate a new token before trying again.')
    let value: unknown
    try { value = JSON.parse(definition) } catch { throw new ValidationError('Typeform did not return a readable form definition. Try again later.') }
    const parsed = z.object({ id: z.literal(id), title: z.string().min(1), fields: z.array(z.unknown()) }).safeParse(value)
    if (!parsed.success) throw new ValidationError('Typeform returned an incomplete or different form definition. Check the form link and try again.')
    return { definition, title: parsed.data.title, formId: id }
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw new ValidationError(controller.signal.aborted ? 'Typeform took too long to respond. Paste your token again and retry.' : 'Pencil could not reach Typeform securely. Check your connection, then paste your token again and retry.')
  } finally { clearTimeout(timeout); input.token = '' }
}
