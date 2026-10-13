import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { build, type Plugin } from 'vite'

const id = 'virtual:pencil-site-client'
const resolved = `\0${id}`

/**
 * `virtual:pencil-site-client`: the site path of the run site's client script. `rer build --site` renders the pages in
 * Node and bundles no browser code, so this builds `entry` for the browser and emits its chunks under site-assets/,
 * which rer copies into the site beside the compiled styles. The images the card uses are the same Vite assets, with
 * the same content-hashed names, that the page build already emits.
 */
export function siteClient(entry: string): Plugin {
  let root = process.cwd()
  return {
    name: 'pencil-site-client',
    configResolved(config) { root = config.root },
    resolveId: source => (source === id ? resolved : undefined),
    async load(source) {
      if (source !== resolved) return
      const result = await build({
        root, configFile: false, envFile: false, logLevel: 'error', mode: 'production', plugins: [react()],
        build: {
          write: false, copyPublicDir: false, assetsDir: 'site-assets', modulePreload: false, sourcemap: false, reportCompressedSize: false,
          rollupOptions: {
            input: resolve(root, entry),
            output: { entryFileNames: 'site-assets/[name]-[hash].js', chunkFileNames: 'site-assets/[name]-[hash].js' },
            // The card reaches feature indexes whose head helpers load the deployment's origin lazily, through
            // TanStack Start (bundled only by its own Vite plugin) and the Worker's platform. The card never calls
            // them, so those imports stay external, and the chunk that holds them is never loaded or shipped.
            external: [/^@tanstack\/react-start(?:\/|$)/, /^cloudflare:/],
          },
        },
      })
      const output = (Array.isArray(result) ? result : [result]).flatMap(item => ('output' in item ? item.output : []))
      const chunks = new Map(output.flatMap(item => (item.type === 'chunk' ? [[item.fileName, item] as const] : [])))
      const main = [...chunks.values()].find(chunk => chunk.isEntry)
      if (!main) throw new Error(`The run site client ${entry} built no entry chunk.`)
      // Only what the entry loads ships: a chunk left behind by code tree-shaking dropped (the platform) never does.
      const shipped = new Set<string>()
      const visit = (fileName: string) => {
        const chunk = chunks.get(fileName)
        if (!chunk) throw new Error(`The run site client loads ${fileName}, which is not part of its build.`)
        if (shipped.has(fileName)) return
        shipped.add(fileName)
        for (const next of [...chunk.imports, ...chunk.dynamicImports]) visit(next)
      }
      visit(main.fileName)
      for (const fileName of shipped) this.emitFile({ type: 'asset', fileName, source: chunks.get(fileName)!.code })
      return `export default ${JSON.stringify(`/${main.fileName}`)}`
    },
  }
}
