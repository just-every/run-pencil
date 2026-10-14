import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defaultAllowedOrigins, defineConfig } from 'vite'
import { docsSite } from './src/core/features/docs/build/plugin.ts'
import { embedDevFrameCors } from './src/core/features/embedding/build/dev-frame-cors.ts'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'
import { pencilArchiveOutputGuard } from './scripts/pencil-archive-output.mjs'
// The Worker runs first for every deployed path. Under the dev server, Vite's own module, client-entry and file paths, and the one
// root file browser code imports (seed.json), must reach Vite, or no page hydrates. Every other root file stays behind the Worker.
const devServedByVite = ['/*', '!/@*', '!/src/*', '!/node_modules/*', '!/seed.json']
// Only `vite dev` loads the local-only entry and the checkout's dev key; a build keeps src/server.ts and never sees either
// (rer build checks its output).
const local = (name: string): Record<string, string> => process.env[name] ? { [name]: process.env[name]! } : {}
const origin: Record<string, string> = process.env.RER_DEV_ORIGIN ? { APP_ORIGIN: process.env.RER_DEV_ORIGIN } : {}
const serve = { main: './src/server.dev.ts', vars: { ...origin, ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY'), ...local('RER_MODELS_SERVICE'), ...local('RER_MODELS_KEY') }, assets: { run_worker_first: devServedByVite } }
// Separate checkouts can share a linked dependency install. Their optimized modules must keep their own Worker/Vite paths.
const cacheDir = `node_modules/.vite/${createHash('sha256').update(realpathSync(process.cwd())).digest('hex').slice(0, 16)}`
export default defineConfig(({ command, isPreview }) => ({ cacheDir, plugins: [
  cloudflare({ configPath: process.env.PENCIL_WRANGLER_CONFIG ?? './wrangler.jsonc', config: () => command === 'serve' && !isPreview ? serve : Object.keys(origin).length ? { vars: origin } : {}, viteEnvironment: { name: 'ssr' }, inspectorPort: false, persistState: process.env.PENCIL_E2E_STATE ? { path: process.env.PENCIL_E2E_STATE } : true }),
  // /docs: the repository's Markdown rendered when Vite loads it (DOCS-001), never in the Worker or the browser.
  docsSite(),
  tanstackStart({ prerender: { enabled: false, autoStaticPathsDiscovery: false, crawlLinks: false } }),
  react(), tailwindcss(), embedDevFrameCors(), archiveOutputGuard(), pencilArchiveOutputGuard(),
],
  // The Worker imports the optional bundled sample-data module; seed.json is the browser's manifest import.
  // The product pages import their fonts from node_modules by URL. When that folder is a link to an install elsewhere, its real location must be served too.
  // Preflights belong to the Worker, as deployed: the embedded form's public API calls (Origin: null) are answered by its opaque-embed CORS.
  server: { cors: { origin: defaultAllowedOrigins, preflightContinue: true }, fs: { strict: true, allow: ['src', 'public', 'node_modules', 'seed.json', 'sample-data', realpathSync('node_modules')], deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/.rer/**', '**/.seed/**', '**/exports/**', '**/*.rer'] } },
}))
