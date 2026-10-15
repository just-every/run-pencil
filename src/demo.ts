import { auroraCoffeeSample as sample } from '../sample-data/auroraCoffee'
import { createPencilServices } from './core/app/services'
import type { WorkerBindings } from './core/app/environment'
import { createScheduledPencilPlatform } from './core/platform/runtime'
import { auroraCoffeeDemo, feedbackStep, feedbackStepId } from './demo/aurora'
import { seedWorkspaceFlows, ensureDemoAnalysis } from './demo/workspace'

export async function seedDemo(env: WorkerBindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
  const services = createPencilServices(createScheduledPencilPlatform(env))
  const owner = await env.DB.prepare('SELECT id, workspace_id AS workspaceId FROM operators WHERE email = ? COLLATE NOCASE AND is_setup_operator = 1')
    .bind(ownerEmail).first<{ id: string; workspaceId: string }>()
  if (!owner) throw new Error('The demo owner has no Pencil workspace yet.')
  const demo = auroraCoffeeDemo(now), { revisions } = demo, workspaceId = owner.workspaceId
  const stamp = (revision: { id: string; createdAt: string; updatedAt: string }) => ({ revisionId: revision.id, createdAt: revision.createdAt, updatedAt: revision.updatedAt })
  await services.flows.ensureSampleFlow({
    workspaceId,
    flow: { ...sample.flow, lastActivityAt: demo.lastActivityAt, createdAt: revisions.published.createdAt, updatedAt: demo.lastActivityAt },
    revisions: [revisions.published, revisions.draft],
    steps: [
      ...sample.steps.published.map(step => ({ ...step, position: step.kind === 'completion' ? 4 : step.position, ...stamp(revisions.published) })),
      { ...feedbackStep, id: feedbackStepId, ...stamp(revisions.published) },
      ...sample.steps.draft.map(step => ({ ...step, position: step.kind === 'completion' ? 4 : step.position, ...stamp(revisions.draft) })),
      { ...feedbackStep, id: '01J000000000000000DT000000', ...stamp(revisions.draft) },
    ],
    choices: [
      ...sample.choiceOptions.published.map(choice => ({ ...choice, createdAt: revisions.published.createdAt, updatedAt: revisions.published.updatedAt })),
      ...sample.choiceOptions.draft.map(choice => ({ ...choice, createdAt: revisions.draft.createdAt, updatedAt: revisions.draft.updatedAt })),
    ],
  })
  await services.responses.ensureSampleResponses({
    workspaceId, flowId: sample.flow.id, revisionId: revisions.published.id,
    sessions: demo.sessions, responses: demo.responses, counter: demo.counter,
  })
  await ensureDemoAnalysis(services, env.DB, workspaceId, owner.id, sample.flow.id, revisions.published.id, now)
  await seedWorkspaceFlows(services, env.DB, workspaceId, owner.id, now)
  await services.brand.save(workspaceId, sample.brand)
  await services.workspace.completeSetup(workspaceId, sample.workspace.name, sample.workspace.timeZone)
  // A response a visitor submits notifies the owner, with mail silently suppressed.
  await services.notifications.preferences.set(workspaceId, sample.flow.id, owner.id, 'immediately')
}
