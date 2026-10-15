import { auroraCoffeeSample as sample } from '../../sample-data/auroraCoffee'
import type { PencilServices } from '../core/app/services'
import { auroraCoffeeDemo, demoId, feedbackStep, feedbackStepId } from './aurora'
import { ensureDemoAnalysis } from './workspace'

export async function seedAurora(services: PencilServices, db: D1Database, workspaceId: string, operatorId: string, now: Date) {
  const demo = auroraCoffeeDemo(now), { revisions } = demo
  const stamp = (revision: { id: string; createdAt: string; updatedAt: string }) => ({ revisionId: revision.id, createdAt: revision.createdAt, updatedAt: revision.updatedAt })
  await services.flows.ensureSampleFlow({
    workspaceId,
    flow: { ...sample.flow, lastActivityAt: demo.lastActivityAt, createdAt: revisions.published.createdAt, updatedAt: demo.lastActivityAt },
    revisions: [revisions.published, revisions.draft],
    steps: [
      ...sample.steps.published.map(step => ({ ...step, position: step.kind === 'completion' ? 4 : step.position, ...stamp(revisions.published) })),
      { ...feedbackStep, id: feedbackStepId, ...stamp(revisions.published) },
      ...sample.steps.draft.map(step => ({ ...step, position: step.kind === 'completion' ? 4 : step.position, ...stamp(revisions.draft) })),
      { ...feedbackStep, id: demoId('DD', 0), ...stamp(revisions.draft) },
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
  await ensureDemoAnalysis(services, db, workspaceId, operatorId, sample.flow.id, revisions.published.id, now)
}
