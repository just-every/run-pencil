import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import appConfig from '../../vite.config'
// Only the test server builds this entry/config. Ordinary builds cannot select a fake mail transport.
export default defineConfig(env => mergeConfig(typeof appConfig === 'function' ? appConfig(env) : appConfig, {
  resolve: { alias: [{ find: /(?:.*\/)?platform\/mail\/base\.server(?:\.ts)?$/, replacement: fileURLToPath(new URL('./captured-mail.server.ts', import.meta.url)) }] },
}))
