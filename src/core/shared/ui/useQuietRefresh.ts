import { useEffect, useRef } from 'react'

/** The quiet refresh interval: a view re-reads what it shows this often while the tab is visible. */
export const quietRefreshMs = 30_000

/**
 * Calls `refresh` every `ms` while the tab is visible, and once on return to a tab that has waited longer than that.
 * `refresh` must patch in place (no Loading state, no remount, nothing cleared first); a failed quiet read keeps what is shown and the next tick tries again.
 */
export function useQuietRefresh(refresh: () => unknown, ms = quietRefreshMs) {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    let last = Date.now()
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      last = Date.now()
      void Promise.resolve(latest.current()).catch(() => undefined)
    }
    const timer = setInterval(tick, ms)
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last >= ms) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [ms])
}

/** The next value to keep: the previous object when a re-read returned the same data (apart from `ignore`d keys such as a read timestamp), so nothing re-renders. */
export function keepIfSame<T>(previous: T, next: T, ignore: string[] = []): T {
  const text = (value: T) => JSON.stringify(value, (key, item) => ignore.includes(key) ? undefined : item)
  return text(previous) === text(next) ? previous : next
}
