import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { expect, it } from 'vitest'
import { initializePencil } from '../../src/core/app/worker'
import { createPencilPlatform } from '../../src/core/platform/runtime'
declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]

it('fresh production initialization ignores sample seeding and leaves an empty dashboard', async () => {
  await applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__)
  const platform = createPencilPlatform('https://forms.example.test', { ...env, PENCIL_LOCAL_DEVELOPMENT: 'false', APP_ORIGIN: 'https://forms.example.test', PENCIL_BUILD_ID: 'synthetic-build', SEED_ADMIN_EMAIL: 'owner@example.test', MAIL_PROVIDER: 'sendgrid', MAIL_FROM: 'forms@example.test', MAIL_API_KEY: 'synthetic-mail-key', SETUP_TOKEN: 'synthetic-setup-token-at-least-32-characters', SEED_SAMPLE_DATA: 'true' })
  expect(platform.configuration.seedSampleData).toBe(false)
  const services = await initializePencil(platform)
  const workspace = await env.DB.prepare('SELECT id FROM workspaces').first<{ id: string }>()
  expect(workspace).not.toBeNull()
  expect(await services.flows.listDashboard(workspace!.id)).toEqual([])
  for (const table of ['flows', 'responses', 'local_fixture_initializations']) expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first()).toEqual({ n: 0 })
})
