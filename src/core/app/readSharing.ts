/**
 * One read per endpoint per load: identical reads of the operator API that overlap, or follow within a moment of each other, share one request.
 * Components that read the same endpoint on mount (and React's development double mount) no longer repeat it. Any write clears what is held, so a read after a change is fresh.
 */
const settledMs = 1500
const held = new Map<string, Promise<Response>>()

/** POSTs that only read (their body is the query), so they share like a GET and do not count as a change. */
const readOnlyPosts = [/\/questions\/text$/, /\/submissions\/read$/]

/** The caller's own abort still ends its wait; the shared request itself is never cancelled for the others. */
function waitFor(shared: Promise<Response>, signal?: AbortSignal | null) {
  const copy = shared.then(response => response.clone())
  if (!signal) return copy
  return new Promise<Response>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    copy.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export function installReadSharing(target: Window = window) {
  const send = target.fetch.bind(target)
  target.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== 'string' && !(input instanceof URL)) return send(input, init)
    const url = new URL(String(input), window.location.href)
    const method = (init?.method ?? 'GET').toUpperCase()
    const read = method === 'GET' || (method === 'POST' && readOnlyPosts.some(pattern => pattern.test(url.pathname)))
    if (!read) { if (method !== 'HEAD') held.clear(); return send(input, init) }
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/app/') || init?.cache || (init?.body !== undefined && typeof init.body !== 'string')) return send(input, init)
    const key = `${method} ${url.pathname}${url.search} ${init?.body ?? ''}`
    let shared = held.get(key)
    if (!shared) {
      const { signal: _signal, ...rest } = init ?? {}
      const request = send(input, rest)
      shared = request
      held.set(key, request)
      request.then(() => setTimeout(() => { if (held.get(key) === request) held.delete(key) }, settledMs), () => { if (held.get(key) === request) held.delete(key) })
    }
    return waitFor(shared, init?.signal)
  }
}
