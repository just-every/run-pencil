import type { PencilServices } from '../core/app/services'
import { DAY, demoId, visitFeedback } from './aurora'

// Fixed identities and the same idempotent domain doors as the installable sample.
const flows = [
  { number: 1, title: 'Weekend brunch ideas', slug: 'weekend-brunch-ideas', status: 'draft' as const, age: 2, count: 0,
    prompt: 'What would you like to see on our weekend brunch menu?' },
  { number: 2, title: 'Morning pickup experience', slug: 'morning-pickup-experience', status: 'closed' as const, age: 8, count: 18,
    prompt: 'How could we improve your morning pickup?' },
  { number: 3, title: 'Winter menu feedback', slug: 'winter-menu-feedback', status: 'archived' as const, age: 42, count: 12,
    prompt: 'What worked well on your last visit, and what could improve?' },
]

export async function ensureDemoAnalysis(services: PencilServices, db: D1Database, workspaceId: string, operatorId: string, flowId: string, revisionId: string, now: Date) {
  const existing = await db.prepare('SELECT id FROM analysis_runs WHERE workspace_id = ? AND revision_id = ? LIMIT 1').bind(workspaceId, revisionId).first()
  if (!existing) await services.analysis.request(workspaceId, operatorId, { flowId, revisionId }, now)
}

export async function seedWorkspaceFlows(services: PencilServices, db: D1Database, workspaceId: string, operatorId: string, now: Date) {
  await Promise.all(flows.map(async flow => {
    const key = flow.number * 1000
    const flowId = demoId('DF', key), revisionId = demoId('DV', key), questionId = demoId('DQ', key)
    const at = (days: number) => new Date(now.getTime() - days * DAY).toISOString()
    const createdAt = at(flow.age + 10), updatedAt = at(flow.age)
    await services.flows.ensureSampleFlow({
      workspaceId, flow: { id: flowId, slug: flow.slug, title: flow.title, status: flow.status, draftVersion: 1, createdAt, updatedAt, lastActivityAt: updatedAt },
      revisions: [
        { id: revisionId, number: 1, state: flow.status === 'draft' ? 'draft' : 'published', title: flow.title, publishedAt: flow.status === 'draft' ? null : createdAt, createdAt, updatedAt },
        ...(flow.status === 'draft' ? [] : [{ id: demoId('DV', key + 100), number: 2, state: 'draft' as const, title: flow.title, publishedAt: null, createdAt, updatedAt }]),
      ],
      steps: [
        { id: demoId('DW', key), position: 0, kind: 'welcome' as const, questionType: null, prompt: 'Help shape your next visit to Aurora Coffee.', helperText: 'A minute of feedback helps our cafe team.', required: false },
        { id: questionId, position: 1, kind: 'question' as const, questionType: 'long_text' as const, prompt: flow.prompt, helperText: null, required: true },
        { id: demoId('DC', key), position: 2, kind: 'completion' as const, questionType: null, prompt: 'Thank you. We look forward to seeing you again.', helperText: null, required: false },
      ].flatMap(step => [
        { ...step, revisionId, createdAt, updatedAt },
        ...(flow.status === 'draft' ? [] : [{ ...step, id: `${step.id.slice(0, -3)}100`, revisionId: demoId('DV', key + 100), createdAt, updatedAt }]),
      ]), choices: [],
    })
    if (!flow.count) return
    const sessions = Array.from({ length: flow.count }, (_, n) => ({
      id: demoId('DX', key + n), source: 'direct' as const, deviceClass: n % 3 ? 'mobile' as const : 'desktop' as const,
      furthestStepId: questionId, completedAt: at(flow.age + n / 3), expiresAt: at(flow.age + n / 3 - 30),
      createdAt: new Date(Date.parse(at(flow.age + n / 3)) - 120_000).toISOString(), updatedAt: at(flow.age + n / 3),
    }))
    await services.responses.ensureSampleResponses({
      workspaceId, flowId, revisionId, sessions,
      responses: sessions.map((session, n) => ({ id: demoId('DY', key + n), sessionId: session.id, idempotencyKey: `demo-${flow.slug}-${n}`, completedAt: session.completedAt,
        answers: [{ id: demoId('DZ', key + n), stepId: questionId, value: visitFeedback[n % visitFeedback.length] }] })),
      counter: { id: demoId('DM', key), starts: flow.count, completions: flow.count, totalCompletionMilliseconds: flow.count * 120_000,
        mobileStarts: sessions.filter(s => s.deviceClass === 'mobile').length, tabletStarts: 0, desktopStarts: sessions.filter(s => s.deviceClass === 'desktop').length, createdAt, updatedAt },
    })
    await ensureDemoAnalysis(services, db, workspaceId, operatorId, flowId, revisionId, new Date(updatedAt))
  }))
}
