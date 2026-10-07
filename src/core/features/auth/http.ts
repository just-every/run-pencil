import { ForbiddenError } from '../../shared/errors'

export function requireSameOriginRequest(request: Request) {
  const supplied = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!supplied || supplied !== expected) {
    throw new ForbiddenError('This operator action must come from the configured Pencil origin.')
  }
}
