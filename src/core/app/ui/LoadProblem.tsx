import { Link } from '@tanstack/react-router'
import { ApiError } from '../api'
import { NoteIllustration } from './NoteIllustration'

/** A failed read, as a page keeps it: the API's message, and whether it said the record does not exist. */
export type LoadFailure = { readonly message: string; readonly notFound: boolean }

export function loadFailure(reason: unknown, fallback: string): LoadFailure {
  return { message: reason instanceof Error ? reason.message : fallback, notFound: reason instanceof ApiError && reason.code === 'NOT_FOUND' }
}

/**
 * A page that could not load: the snapped pencil, the API's message as the heading, then the way back and a retry.
 * `heading` is h2 where the page keeps its own title above. A record that does not exist is always "Not found" with the way back and no retry;
 * `message` alone (no retry) is a page the app has no route for.
 */
export function LoadProblem({ message, notFound = false, retryLabel, onRetry, heading: Heading = 'h1' }: { readonly message: string; readonly notFound?: boolean; readonly retryLabel?: string; readonly onRetry?: () => void; readonly heading?: 'h1' | 'h2' }) {
  return <div className="load-problem">
    <NoteIllustration className="load-problem__art" variant="snapped" />
    <Heading className="display load-problem__message"><span role="alert">{notFound ? 'Not found' : message}</span></Heading>
    <div className="load-problem__actions">
      <Link className="primary-button focus-ring" to="/app">All flows</Link>
      {!notFound && onRetry && retryLabel ? <button className="secondary-button focus-ring" onClick={onRetry} type="button">{retryLabel}</button> : null}
    </div>
  </div>
}
