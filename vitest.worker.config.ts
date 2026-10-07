import { readFile } from 'node:fs/promises'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

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
  define: {
    __PENCIL_CORE_MIGRATIONS__: JSON.stringify(migrations),
    __PENCIL_PREVIOUS_CORE_MIGRATIONS__: JSON.stringify(previousMigrations),
    __PENCIL_UPGRADE_FIXTURE_SQL__: JSON.stringify(upgradeFixture),
    __PENCIL_UPGRADE_CHECKS__: JSON.stringify(upgradeChecks),
    __PENCIL_RUN_LOAD__: JSON.stringify(process.env.PENCIL_RUN_LOAD === '1'),
  },
  plugins: [
    cloudflareTest({
      main: './src/core/app/worker.ts',
      miniflare: {
        d1Databases: ['DB'],
        bindings: {
          MAIL_PROVIDER: 'local',
          SESSION_SECRET: 'synthetic-worker-session-secret-at-least-32-characters',
          PENCIL_LOCAL_DEVELOPMENT: 'true',
          SEED_SAMPLE_DATA: process.env.PENCIL_LOAD_MODE === '1' ? 'false' : 'true',
        },
      },
    }),
  ],
  test: {
    // Native D1 journeys run serially on shared and cold CI workers.
    testTimeout: 30_000,
    include: ['tests/runtime/**/*.worker.test.ts'],
    fileParallelism: false,
  },
})
