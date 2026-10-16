import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { realpathSync } from 'node:fs'
import { defaultAllowedOrigins, defineConfig } from 'vite'
import { docsSite } from './src/core/features/docs/build/plugin.ts'
import { embedDevFrameCors } from './src/core/features/embedding/build/dev-frame-cors.ts'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'
import { pencilArchiveOutputGuard } from './scripts/pencil-archive-output.mjs'
import { backupManifest } from './scripts/deployment-data-browser-manifest.mjs'
import { demoSockets } from './src/base/demo/vite.mjs'
// The Worker runs first for every deployed path. Under the dev server, Vite's own module, client-entry and file paths, and the one
// root file browser code imports (seed.json), must reach Vite, or no page hydrates. Every other root file stays behind the Worker.
const backupSharedFiles = ['browser-shared', 'policy', 'dev', 'sql', 'ledger', 'schema', 'errors', 'initialized', 'journal'].map(name => `scripts/deployment-data-${name}.mjs`)
const devServedByVite = ['/*', '!/@*', '!/src/*', '!/node_modules/*', '!/seed.json', ...backupSharedFiles.map(path => `!/${path}`)]
// Only `vite dev` loads the local-only entry and the checkout's dev key; a build keeps src/server.ts and never sees either
// (rer build checks its output).
const local = (name: string): Record<string, string> => process.env[name] ? { [name]: process.env[name]! } : {}
const origin: Record<string, string> = process.env.RER_DEV_ORIGIN ? { APP_ORIGIN: process.env.RER_DEV_ORIGIN } : {}
const serve = { main: './src/server.dev.ts', vars: { ...origin, ...local('RER_DEV_ORIGIN'), ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY'), ...local('RER_MODELS_SERVICE'), ...local('RER_MODELS_KEY'), ...local('RER_DEMO'), ...local('RER_DEMO_EXPIRES') }, assets: { run_worker_first: devServedByVite } }
export default defineConfig(({ command, isPreview }) => ({
  define: { __PENCIL_MANAGED_SOURCE_SHA__: JSON.stringify(process.env.PENCIL_MANAGED_SOURCE_SHA ?? null) },
  plugins: [
  // `rer demo`: the Worker's cloudflare:sockets imports get demo mode's guarded connect (Base modules/demo).
  demoSockets(),
  cloudflare({ configPath: process.env.PENCIL_WRANGLER_CONFIG ?? './wrangler.jsonc', config: () => command === 'serve' && !isPreview ? serve : Object.keys(origin).length ? { vars: origin } : {}, viteEnvironment: { name: 'ssr' }, inspectorPort: false, persistState: { path: process.env.PENCIL_E2E_STATE ?? process.env.RER_STATE_DIR ?? '.wrangler/state' } }),
  // /docs: the repository's Markdown rendered when Vite loads it (DOCS-001), never in the Worker or the browser.
  docsSite(), backupManifest(),
  tanstackStart({ prerender: { enabled: false, autoStaticPathsDiscovery: false, crawlLinks: false } }),
  react(), tailwindcss(), embedDevFrameCors(), archiveOutputGuard(), pencilArchiveOutputGuard(),
],
  // The Worker imports the optional bundled sample-data module; seed.json is the browser's manifest import.
  // The product pages import their fonts from node_modules by URL. When that folder is a link to an install elsewhere, its real location must be served too.
  // Preflights belong to the Worker, as deployed: the embedded form's public API calls (Origin: null) are answered by its opaque-embed CORS.
  // The bundled watcher selects FSEvents before reading CHOKIDAR_USEPOLLING.
  // Pass a requested polling backend explicitly so it takes effect on macOS.
  server: { watch: process.env.CHOKIDAR_USEPOLLING === 'true' ? { usePolling: true } : undefined, cors: { origin: defaultAllowedOrigins, preflightContinue: true }, fs: { strict: true, allow: ['src', 'public', 'node_modules', 'seed.json', ...backupSharedFiles, 'sample-data', realpathSync('node_modules')], deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/.rer/**', '**/.seed/**', '**/exports/**', '**/*.rer'] } },
}))
