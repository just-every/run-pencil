import { auroraCoffeeSample } from '../../sample-data/auroraCoffee'

// The demo's lived-in Aurora Coffee workspace (`rer demo` and the hosted demo; Base modules/demo runs it once after the owner
// exists). It is the seed's Aurora Coffee sample placed in the signed-in owner's own workspace: the finished first run, the brand
// with the post-visit form as the public landing, the published form and its draft, and four weeks of responses ending today.
// Every row has a fixed ID and is written through Pencil's own idempotent sample services. Nothing here sends.

export const DAY = 86_400_000
const sample = auroraCoffeeSample
const [ratingStep, choiceStep] = [sample.steps.published[1].id, sample.steps.published[2].id]
const choices = sample.choiceOptions.published.map(choice => choice.id)
export const demoId = (kind: string, n: number) => `01J000000000000000${kind}${String(n).padStart(6, '0')}`

export const feedbackStepId = demoId('DT', 0)
export const feedbackStep = {
  position: 3, kind: 'question' as const, questionType: 'long_text' as const,
  prompt: 'What could we do to make your next visit better?', helperText: 'Tell us what worked and what we could improve.', required: false,
}
export const visitFeedback = [
  'The coffee was excellent, but the morning queue took ten minutes. A separate pickup spot would help.',
  'Friendly service every time. The queue gets slow before work, so clearer pickup signs would be welcome.',
  'Love the coffee and the team. I waited a while in the queue for my takeaway order today.',
  'A lovely place to catch up. More seating outside would make weekend visits easier.',
  'Great coffee. The morning queue moves slowly when takeaway pickups and new orders mix together.',
  'The team remembered my order. A little more seating in the shade would be perfect.',
  'The coffee is consistently good. Please make the pickup queue easier to follow during the morning rush.',
  'Warm service and a great flat white. I would come more often if there were more outdoor seating.',
  'The morning queue was long, although my coffee was worth it. A dedicated pickup counter could help.',
  'Really friendly service. More seating for small groups would make this our regular weekend spot.',
]

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
      id: demoId('DS', n + 1), source: n % 5 === 3 ? 'embed' as const : 'direct' as const, deviceClass: DEVICES[n % DEVICES.length],
      furthestStepId: finished ? choiceStep : ratingStep, completedAt: finished ? at(finished) : null,
      expiresAt: at(started + 30 * DAY), createdAt: at(started), updatedAt: at(finished ?? started + 40_000),
    }
  })
  const responses = RATINGS.map((rating, n) => ({
    id: demoId('DR', n + 1), sessionId: sessions[n].id, idempotencyKey: `demo-aurora-response-${n + 1}`, completedAt: sessions[n].completedAt!,
    answers: [{ id: demoId('DA', 2 * n + 1), stepId: ratingStep, value: rating }, { id: demoId('DA', 2 * n + 2), stepId: choiceStep, value: choices[STOOD_OUT[n]] }, { id: demoId('DT', n + 1), stepId: feedbackStepId, value: visitFeedback[n % visitFeedback.length] }],
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
