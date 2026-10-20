import { testDevKey } from './tests/helpers/dev-key.mjs'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { backupManifest } from './scripts/deployment-data-browser-manifest.mjs'
import { defineConfig } from 'vitest/config'
import { unstable_splitSqlQuery } from 'wrangler'

const migrations = await readD1Migrations('./migrations/core')
const previousMigrations = process.env.PENCIL_PREVIOUS_MIGRATIONS_DIR
  ? await readD1Migrations(process.env.PENCIL_PREVIOUS_MIGRATIONS_DIR)
  : []
const upgradeFixture = process.env.PENCIL_UPGRADE_FIXTURE_PATH
  ? await readFile(process.env.PENCIL_UPGRADE_FIXTURE_PATH, 'utf8')
  : ''
const upgradeChecks = process.env.PENCIL_UPGRADE_CHECKS_JSON
  ? JSON.parse(process.env.PENCIL_UPGRADE_CHECKS_JSON)
  : []

export default defineConfig({
  resolve: { alias: [{ find: /(?:.*\/)?platform\/mail\/(?:base|development)\.server(?:\.ts)?$/, replacement: fileURLToPath(new URL('./tests/helpers/captured-mail.server.ts', import.meta.url)) }] },
  define: {
    __PENCIL_CORE_MIGRATIONS__: JSON.stringify(migrations),
    __PENCIL_PREVIOUS_CORE_MIGRATIONS__: JSON.stringify(previousMigrations),
    __PENCIL_UPGRADE_FIXTURE_QUERIES__: JSON.stringify(upgradeFixture ? unstable_splitSqlQuery(upgradeFixture) : []),
    __PENCIL_UPGRADE_CHECKS__: JSON.stringify(upgradeChecks),
    __PENCIL_RUN_LOAD__: JSON.stringify(process.env.PENCIL_RUN_LOAD === '1'),
  },
  plugins: [backupManifest(),
    cloudflareTest(({ inject }) => ({
      main: './tests/helpers/mail-worker.ts',
      miniflare: {
        d1Databases: ['DB', 'IMPORT_SECOND'],
        bindings: {
          // The loopback task receiver from the global setup; tests opt in to task delivery with their own bindings.
          TASK_RECEIVER_ORIGIN: inject('taskReceiverOrigin'),
          // The loopback AI provider edge; analysis tests opt in with their own AI bindings.
          AI_RECEIVER_ORIGIN: inject('aiReceiverOrigin'),
          // The loopback independent XLSX and SAV readers (exceljs, sav-reader) for LEDG-005 exports.
          EXPORT_READER_ORIGIN: inject('exportReaderOrigin'),
          MAIL_PROVIDER: 'local',
          SESSION_SECRET: 'synthetic-worker-session-secret-at-least-32-characters',
          PENCIL_LOCAL_DEVELOPMENT: 'true',
          RER_DEV_KEY: testDevKey,
          SEED_SAMPLE_DATA: process.env.PENCIL_LOAD_MODE === '1' ? 'false' : 'true',
        },
      },
    })),
  ],
  test: {
    // Native D1 journeys run serially on shared and cold CI workers.
    testTimeout: 30_000,
    include: ['tests/runtime/**/*.worker.test.ts'],
    globalSetup: ['tests/runtime/task-receiver.global.ts', 'tests/runtime/ai-receiver.global.ts', 'tests/runtime/export-reader.global.ts'],
    fileParallelism: false,
  },
})
