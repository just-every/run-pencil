import { useEffect } from 'react'

/** Completion is a client state; give that state its own nonindexable document address too. */
export function useCompletionPrivacy(completed: boolean) {
  useEffect(() => {
    if (!completed) return
    const url = new URL(window.location.href)
    url.searchParams.set('completed', '1')
    window.history.replaceState(window.history.state, '', url)
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    robots.content = 'noindex, nofollow'
  }, [completed])
}
