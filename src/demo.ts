import { auroraCoffeeSample } from '../sample-data/auroraCoffee'
import { createPencilServices } from './core/app/services'
import type { WorkerBindings } from './core/app/environment'
import { createScheduledPencilPlatform } from './core/platform/runtime'

// The demo's lived-in Aurora Coffee workspace (`rer demo` and the hosted demo; Base modules/demo runs it once after the owner
// exists). It is the seed's Aurora Coffee sample placed in the signed-in owner's own workspace: the finished first run, the brand
// with the post-visit form as the public landing, the published form and its draft, and four weeks of responses ending today.
// Every row has a fixed ID and is written through Pencil's own idempotent sample services. Nothing here sends.

const DAY = 86_400_000
const sample = auroraCoffeeSample
const [ratingStep, choiceStep] = [sample.steps.published[1].id, sample.steps.published[2].id]
const choices = sample.choiceOptions.published.map(choice => choice.id)
const id = (kind: string, n: number) => `01J000000000000000${kind}${String(n).padStart(6, '0')}`

// 44 visits: 38 finished, 6 left after the rating question. A cafe's spread: mostly fours and fives, a few poor visits.
const RATINGS = [5, 4, 5, 5, 3, 4, 5, 4, 2, 5, 4, 5, 3, 5, 4, 4, 5, 1, 5, 4, 5, 4, 3, 5, 5, 4, 2, 5, 4, 5, 4, 5, 3, 4, 5, 5, 4, 5]
const STOOD_OUT = [0, 1, 0, 2, 1, 0, 1, 0, 1, 2, 0, 1, 2, 0, 0, 1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 0, 2, 1]
const DEVICES = ['mobile', 'mobile', 'desktop', 'mobile', 'tablet', 'mobile', 'desktop', 'mobile'] as const
const ABANDONED = 6

/** The sample's form and responses with dates moved into the four weeks before `now`. */
export function auroraCoffeeDemo(now: Date) {
  const at = (ms: number) => new Date(ms).toISOString()
  const created = now.getTime() - 28 * DAY, published = created + 5 * 60_000
  const visits = RATINGS.length + ABANDONED
  const sessions = Array.from({ length: visits }, (_, n) => {
    // Spread across the weeks, newest about an hour ago, at varied times of day.
    const started = now.getTime() - 3_600_000 - Math.round((n * 26.5 * DAY) / visits) - ((n * 7919) % 360) * 60_000
    const finished = n < RATINGS.length ? started + (90 + ((n * 37) % 150)) * 1000 : null
    return {
      id: id('DS', n + 1), source: n % 5 === 3 ? 'embed' as const : 'direct' as const, deviceClass: DEVICES[n % DEVICES.length],
      furthestStepId: finished ? choiceStep : ratingStep, completedAt: finished ? at(finished) : null,
      expiresAt: at(started + 30 * DAY), createdAt: at(started), updatedAt: at(finished ?? started + 40_000),
    }
  })
  const responses = RATINGS.map((rating, n) => ({
    id: id('DR', n + 1), sessionId: sessions[n].id, idempotencyKey: `demo-aurora-response-${n + 1}`, completedAt: sessions[n].completedAt!,
    answers: [{ id: id('DA', 2 * n + 1), stepId: ratingStep, value: rating }, { id: id('DA', 2 * n + 2), stepId: choiceStep, value: choices[STOOD_OUT[n]] }],
  }))
  const completed = sessions.filter(session => session.completedAt)
  const counter = {
    ...sample.metricCounters, starts: visits, completions: completed.length,
    totalCompletionMilliseconds: completed.reduce((sum, session) => sum + Date.parse(session.completedAt!) - Date.parse(session.createdAt), 0),
    mobileStarts: sessions.filter(session => session.deviceClass === 'mobile').length,
    tabletStarts: sessions.filter(session => session.deviceClass === 'tablet').length,
    desktopStarts: sessions.filter(session => session.deviceClass === 'desktop').length,
    createdAt: at(created), updatedAt: sessions[0].updatedAt,
  }
  const revisions = {
    published: { ...sample.revisions.published, publishedAt: at(published), createdAt: at(created), updatedAt: at(published) },
    draft: { ...sample.revisions.draft, createdAt: at(published), updatedAt: at(now.getTime() - 2 * DAY) },
  }
  return { created, published, revisions, sessions, responses, counter, lastActivityAt: sessions[0].updatedAt }
}

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
      ...sample.steps.published.map(step => ({ ...step, ...stamp(revisions.published) })),
      ...sample.steps.draft.map(step => ({ ...step, ...stamp(revisions.draft) })),
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
  await services.brand.save(workspaceId, sample.brand)
  await services.workspace.completeSetup(workspaceId, sample.workspace.name, sample.workspace.timeZone)
  // A response a visitor submits notifies the owner, so its mail shows up captured in the Demo bar.
  await services.notifications.preferences.set(workspaceId, sample.flow.id, owner.id, 'immediately')
}
