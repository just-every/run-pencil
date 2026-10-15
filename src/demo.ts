import { auroraCoffeeSample as sample } from '../sample-data/auroraCoffee'
import { createPencilServices } from './core/app/services'
import type { WorkerBindings } from './core/app/environment'
import { createScheduledPencilPlatform } from './core/platform/runtime'
import { seedAurora } from './demo/seed-aurora'
import { seedWorkspaceFlows } from './demo/workspace'

export async function seedDemo(env: WorkerBindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  const services = createPencilServices(createScheduledPencilPlatform(env))
  const owner = await env.DB.prepare('SELECT id, workspace_id AS workspaceId FROM operators WHERE email = ? COLLATE NOCASE AND is_setup_operator = 1')
    .bind(ownerEmail).first<{ id: string; workspaceId: string }>()
  if (!owner) throw new Error('The demo owner has no Pencil workspace yet.')
  const workspaceId = owner.workspaceId
  // Each flow owns separate records; keep its own ordered writes while the independent flows seed together.
  await Promise.all([
    seedAurora(services, env.DB, workspaceId, owner.id, now),
    seedWorkspaceFlows(services, env.DB, workspaceId, owner.id, now),
  ])
  await services.brand.save(workspaceId, sample.brand)
  await services.workspace.completeSetup(workspaceId, sample.workspace.name, sample.workspace.timeZone)
  // A response a visitor submits notifies the owner, with mail silently suppressed.
  await services.notifications.preferences.set(workspaceId, sample.flow.id, owner.id, 'immediately')
}
