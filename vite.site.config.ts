// The plugins the run site's pages need when `rer build --site` renders src/site/pages.tsx in Node: the docs virtual
// module, React, Tailwind for the product stylesheet every Pencil document links, and the hero card's client script.
// Never the app's vite.config.ts, whose Cloudflare and TanStack Start plugins run the Worker.
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { docsSite } from './src/core/features/docs/build/plugin.ts'
import { siteClient } from './src/site/client-plugin.ts'

export default defineConfig({
  plugins: [docsSite(), react(), tailwindcss(), siteClient('src/site/client.tsx')],
  // The site head names run-pencil.com itself, so the Worker's origin lookup (site/origin.ts, which reaches the
  // platform through cloudflare:workers) is bundled but never called in Node.
  build: { rollupOptions: { external: ['cloudflare:workers'] } },
})
