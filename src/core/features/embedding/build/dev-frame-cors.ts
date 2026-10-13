import type { Plugin } from 'vite'

// An embedded form runs sandboxed (allow-scripts allow-forms), so its document has an opaque origin and the browser
// fetches its module scripts and fonts with Origin: null. Vite's dev server answers only loopback origins, so the
// form would never hydrate in `vite dev`. Built output serves /assets/* with its own header and is untouched.
//
// Origin: null alone could come from any website's sandboxed frame, which must not read this checkout's files (for
// example `?raw` imports). An opaque document sends no Referer, so only the framework's client entry is answered
// without one. Every module it pulls in, and every font its stylesheets load, names a file of this dev server as
// Referer, and only those are answered. Answered modules keep a same-origin referrer for their own imports.
const clientEntry = '/@id/virtual:tanstack-start-dev-client-entry'

export function embedDevFrameCors(): Plugin {
  return {
    name: 'pencil-embed-dev-frame-cors',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const fromThisServer = () => { try { return new URL(request.headers.referer ?? '').host === request.headers.host } catch { return false } }
        const destination = request.headers['sec-fetch-dest']
        if ((request.method === 'GET' || request.method === 'HEAD') && request.headers.origin === 'null' && (destination === 'script' || destination === 'font')
          && (fromThisServer() || (destination === 'script' && request.url === clientEntry))) {
          response.setHeader('Access-Control-Allow-Origin', 'null')
          response.setHeader('Vary', 'Origin, Referer')
          response.setHeader('Referrer-Policy', 'same-origin')
        }
        next()
      })
    },
  }
}
