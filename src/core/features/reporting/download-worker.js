/* The browser's download manager consumes this stream. Only one bounded server
 * part is in flight; no Blob, response buffer or complete record array exists. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
const pendingDownloads = new Map()
const notify = async (channel, message) => {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) client.postMessage({ kind: 'pencil-export', channel, ...message })
}
self.addEventListener('message', event => {
  const input = event.data
  if (input?.kind !== 'pencil-download-start' || !event.source || new URL(event.source.url).origin !== self.location.origin || typeof input.channel !== 'string') return
  // Keep the worker alive until the download navigation claims this channel.
  // Bound the wait so an abandoned page cannot retain an idle worker forever.
  event.waitUntil(new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingDownloads.delete(input.channel)
      event.source.postMessage({ kind:'pencil-export', channel:input.channel, error:'Download could not start. Try again.' })
      resolve()
    }, 30000)
    pendingDownloads.set(input.channel,{ input, release:() => { clearTimeout(timeout); resolve() } })
  }))
  event.ports[0]?.postMessage({ ready: true })
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || url.pathname !== '/app/exports/download') return
  const channel = url.searchParams.get('channel')
  const pending = pendingDownloads.get(channel)
  pendingDownloads.delete(channel)
  pending?.release()
  const { flowId, token, filename } = pending?.input ?? {}
  if (!flowId || !token || !filename || !/^pencil-responses-[\w.:-]+\.(json|csv)$/.test(filename)) {
    event.waitUntil(notify(channel,{ error:'Download could not start. Try again.' }))
    event.respondWith(new Response('Invalid export download.', { status: 400 })); return
  }
  const abort = new AbortController()
  let reader
  let nextToken = token
  let written = 0
  let done = false
  let settle
  event.waitUntil(new Promise(resolve => { settle = resolve }))
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (!done) {
          if (!reader) {
            if (!nextToken) {
              done = true; controller.close(); await notify(channel,{ complete: true, written }); settle(); return
            }
            const response = await fetch(`/api/app/flows/${encodeURIComponent(flowId)}/responses/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({token:nextToken}), credentials: 'same-origin', cache: 'no-store', signal: abort.signal })
            if (!response.ok || response.redirected || !response.body || response.headers.get('Content-Type') !== 'application/octet-stream' || !/^\d+$/.test(response.headers.get('X-Export-Written') ?? '')) throw new Error('Export failed. The evidence may have changed; refresh and try again.')
            nextToken = response.headers.get('X-Export-Next')
            written = Number(response.headers.get('X-Export-Written'))
            reader = response.body.getReader()
          }
          const chunk = await reader.read()
          if (chunk.done) { reader.releaseLock(); reader = undefined; continue }
          controller.enqueue(chunk.value); return
        }
      } catch (error) {
        done = true; abort.abort(); if (reader) await reader.cancel().catch(() => {})
        controller.error(error); await notify(channel,{ error: error instanceof Error ? error.message : 'Export failed.' }); settle()
      }
    },
    async cancel() { done = true; abort.abort(); if (reader) await reader.cancel().catch(() => {}); await notify(channel,{ error: 'Download cancelled.' }); settle() },
  }, { highWaterMark: 0 })
  event.respondWith(new Response(stream, { headers: {
    'Content-Type': filename.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/json',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  }}))
})
