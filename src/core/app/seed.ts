import { auroraCoffeeSample } from '../../../sample-data/auroraCoffee'
import type { PencilServices } from './services'

export async function seedSampleData(services: PencilServices) {
  const sample = auroraCoffeeSample
  await services.workspace.ensureSampleWorkspace({ workspace: sample.workspace, operator: sample.operator })
  await services.flows.ensureSampleFlow({
    workspaceId: sample.workspace.id,
    flow: sample.flow,
    revisions: [sample.revisions.published, sample.revisions.draft],
    steps: [
      ...sample.steps.published.map((step) => ({ ...step, revisionId: sample.revisions.published.id, createdAt: sample.revisions.published.createdAt, updatedAt: sample.revisions.published.updatedAt })),
      ...sample.steps.draft.map((step) => ({ ...step, revisionId: sample.revisions.draft.id, createdAt: sample.revisions.draft.createdAt, updatedAt: sample.revisions.draft.updatedAt })),
    ],
    choices: [
      ...sample.choiceOptions.published.map((choice) => ({ ...choice, createdAt: sample.revisions.published.createdAt, updatedAt: sample.revisions.published.updatedAt })),
      ...sample.choiceOptions.draft.map((choice) => ({ ...choice, createdAt: sample.revisions.draft.createdAt, updatedAt: sample.revisions.draft.updatedAt })),
    ],
  })
  const brand = await services.brand.get(sample.workspace.id)
  if (!brand.configured) await services.brand.save(sample.workspace.id, sample.brand)
  await services.responses.ensureSampleResponses({
    workspaceId: sample.workspace.id,
    flowId: sample.flow.id,
    revisionId: sample.revisions.published.id,
    sessions: [...sample.respondentSessions],
    responses: sample.responses.map((response) => ({ ...response, answers: [...response.answers] })),
    counter: sample.metricCounters,
  })
}
