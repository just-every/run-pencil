import { createRequire } from 'node:module'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { unstable_splitSqlQuery } from 'wrangler'

const require = createRequire(import.meta.url)
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare')

// Load production modules unchanged. Observe fetch options without altering
// them or its result; only the external relay returns a test response.
export async function emittedWorker(bindings, outbound) {
  const root = resolve('dist/server')
  const config = JSON.parse(await readFile(join(root, 'wrangler.json'), 'utf8'))
  const modules = {}
  for (const name of await readdir(root, { recursive: true })) {
    if (name.endsWith('.js')) modules[name] = { type: 'esm', contents: await readFile(join(root, name), 'utf8') }
  }
  modules['mail-observer.mjs'] = { type: 'esm', contents: `
    import worker from './${config.main}';
    const realFetch = globalThis.fetch.bind(globalThis), redirects = [];
    globalThis.fetch = (input, init) => {
      redirects.push(init?.redirect ?? null);
      return realFetch(input, init);
    };
    export default { ...worker, async fetch(request, env, execution) {
      if (new URL(request.url).pathname === '/__test/fetch-options') return Response.json(redirects);
      // Let each request's real background dispatch finish before the caller
      // changes the relay response for the next scenario.
      const pending = [];
      const response = await worker.fetch(request, env, {
        waitUntil(promise) { pending.push(promise); execution.waitUntil(promise); },
        passThroughOnException() { execution.passThroughOnException(); },
        props: execution.props,
      });
      await Promise.all(pending);
      return response;
    } };
  ` }
  const state = await mkdtemp(join(tmpdir(), 'pencil-managed-mail-'))
  const runtime = new Miniflare({ cf: false, upstream: bindings.APP_ORIGIN, resourcePersistencePath: state, workers: [{
    config: { type: 'worker', name: 'pencil-managed-mail', compatibilityDate: config.compatibility_date,
      compatibilityFlags: config.compatibility_flags,
      manifest: { mainModule: 'mail-observer.mjs', modulesRoot: root, modules },
      env: { ...Object.fromEntries(Object.entries(bindings).map(([name, value]) => [name, { type: 'text', value }])),
        DB: { type: 'd1', id: 'pencil-managed-mail' }, FORM_ASSETS: { type: 'r2', name: 'pencil-managed-form-assets' }, ASSETS: { type: 'assets' } },
      assets: { directory: resolve('dist/client'), runWorkerFirst: true, hasUserWorker: true },
    },
    dev: { outboundService: { type: 'fetcher', handler: outbound } },
  }] })
  const dispose = runtime.dispose.bind(runtime)
  runtime.dispose = async () => { try { await dispose() } finally { await rm(state, { recursive: true, force: true }) } }
  try {
    const db = await runtime.getD1Database('DB')
    for (const name of (await readdir('migrations/core')).filter(name => name.endsWith('.sql')).sort()) {
      const queries = unstable_splitSqlQuery(await readFile(join('migrations/core', name), 'utf8'))
      await db.batch(queries.map(query => db.prepare(query)))
    }
    return runtime
  } catch (error) { await runtime.dispose(); throw error }
}
