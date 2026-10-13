import { NotFoundError } from '../../shared/errors'
import type { PencilServices } from '../../app/services'
import type { EvidenceFigures } from './model'

/**
 * Freezes the unfiltered results figures for a revision, and a question in it when one is named,
 * as they are at this moment. Only counts with their denominators are kept: never answer text,
 * numeric or date answers, response identifiers or a cohort filter.
 */
export async function freezeEvidence(flows: PencilServices['flows'], reporting: PencilServices['reporting'], workspaceId: string, evidence: { flowId: string; revisionId: string; questionId?: string }): Promise<EvidenceFigures> {
  const results = await flows.getFlowResults(workspaceId, evidence.flowId, evidence.revisionId)
  const figures: EvidenceFigures = { flowTitle: results.flow.title, revisionNumber: results.revision.number, completedResponses: results.completedResponses, starts: results.starts }
  if (!evidence.questionId) return figures
  const question = (await reporting.questions(workspaceId, evidence.flowId, evidence.revisionId)).find(item => item.id === evidence.questionId && item.questionType)
  if (!question) throw new NotFoundError('This question is not part of the selected revision.')
  const counts = question.summary.promoters !== undefined
    ? [{ label: 'Promoters (9–10)', count: question.summary.promoters }, { label: 'Passives (7–8)', count: question.summary.passives ?? 0 }, { label: 'Detractors (0–6)', count: question.summary.detractors ?? 0 }]
    : question.distribution.map(bucket => ({ label: bucket.label, count: bucket.count }))
  figures.question = {
    prompt: question.prompt, questionType: question.questionType!, reached: question.reached, answered: question.answered,
    counts: counts.map(item => ({ ...item, of: question.answered })),
    countLabel: question.summary.promoters !== undefined ? 'NPS groups; each answer counts once.' : question.distributionLabel,
  }
  return figures
}
