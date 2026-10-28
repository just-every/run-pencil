export class PencilError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export class NotFoundError extends PencilError {
  constructor(message: string) {
    super('NOT_FOUND', message)
  }
}

export type ClosedFlow = { title: string; slug: string; collectionClosed?: boolean; message?: string }
export class FlowClosedError extends PencilError {
  constructor(readonly flow: ClosedFlow) {
    super('FLOW_CLOSED', 'This feedback flow is no longer accepting responses.')
  }
}

export class ValidationError extends PencilError {
  constructor(message: string, readonly details?: Array<{ stepId: string; reason: string }>) {
    super('VALIDATION_ERROR', message)
  }
}

export class RateLimitError extends PencilError {
  constructor(message = 'Too many requests. Please wait a minute and try again.', readonly retryAfterSeconds?: number) {
    super('RATE_LIMITED', message)
  }
}

export class SessionUnavailableError extends PencilError {
  constructor() {
    super('SESSION_UNAVAILABLE', 'This response session has expired or is no longer available. Start again to answer the current form.')
  }
}

export class ConflictError extends PencilError {
  constructor(message: string) {
    super('CONFLICT', message)
  }
}

export class ForbiddenError extends PencilError {
  constructor(message: string) {
    super('FORBIDDEN', message)
  }
}
