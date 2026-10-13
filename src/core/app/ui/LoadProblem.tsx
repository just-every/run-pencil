import { Link } from '@tanstack/react-router'
import { NoteIllustration } from './NoteIllustration'

/**
 * A page that could not load: the snapped pencil, the API's message as the heading, then the way back and a retry.
 * `heading` is h2 where the page keeps its own title above.
 */
export function LoadProblem({ message, retryLabel, onRetry, heading: Heading = 'h1' }: { readonly message: string; readonly retryLabel: string; readonly onRetry: () => void; readonly heading?: 'h1' | 'h2' }) {
  return <div className="load-problem">
    <NoteIllustration className="load-problem__art" variant="snapped" />
    <Heading className="display load-problem__message"><span role="alert">{message}</span></Heading>
    <div className="load-problem__actions">
      <Link className="primary-button focus-ring" to="/app">All flows</Link>
      <button className="secondary-button focus-ring" onClick={onRetry} type="button">{retryLabel}</button>
    </div>
  </div>
}
