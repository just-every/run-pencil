import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig({ plugins: [
  cloudflare({ configPath: process.env.PENCIL_WRANGLER_CONFIG ?? './wrangler.toml', viteEnvironment: { name: 'ssr' }, inspectorPort: false, persistState: process.env.PENCIL_E2E_STATE ? { path: process.env.PENCIL_E2E_STATE } : true }),
  tanstackStart({ prerender: { enabled: false, autoStaticPathsDiscovery: false, crawlLinks: false } }),
  react(), tailwindcss(),
] })
