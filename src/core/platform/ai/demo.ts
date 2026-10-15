import type { AiClient, AiRequest } from '../../../base/ai/index.mjs'
import { demoEffect } from '../../../base/demo/index.mjs'

// Only selected by RER_DEMO. These provider-shaped successes use the submitted evidence,
// so normal provenance checks, draft acceptance and action flows still run.
export function demoAiClient(real: () => AiClient): AiClient {
  const responses = (request: AiRequest) => demoEffect(
    () => real().responses(request),
    () => {
      const input = request.input as Array<{ role: string; content: Array<{ text: string }> }>
      const data = JSON.parse(input.find(message => message.role === 'user')!.content[0].text)
      const format = (request.text as { format: { name: string } }).format.name
      const output = format === 'draft_rewrite'
        ? { proposal: `Thinking about your experience, ${String(data.source).replace(/^./, letter => letter.toLowerCase())}`.slice(0, 1000) }
        : analysis(data)
      return Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] })
    },
  )
  const unused = async () => { throw new Error('Pencil uses the Responses API for analysis and rewrites.') }
  return { responses, chat: unused, embeddings: unused, receipt: unused }
}

type Evidence = { responses: Array<{ id: string; answers: Record<string, string> }>; minimumThemeResponses: number }
function analysis(data: Evidence) {
  const responses = data.responses.filter(response => Object.values(response.answers).some(Boolean))
  if (responses.length < data.minimumThemeResponses) return { outcome: 'insufficient_evidence', reason: 'Too few responses for a finding.', themes: [], recommendations: [] }
  const topics = [
    { match: /queue|pickup|wait/i, title: 'Make morning pickup easier', summary: 'Customers value the coffee but describe queues and uncertainty at pickup during busy mornings.', action: 'Trial a dedicated takeaway pickup point', rationale: 'Separate ordering from collection during the morning rush, then compare feedback after two weeks.' },
    { match: /seating|shade|outside/i, title: 'Create more comfortable places to stay', summary: 'Customers want more seating, especially shaded outdoor places and space for small groups.', action: 'Test a shaded outdoor seating area', rationale: 'Rearrange a small section for groups and ask weekend visitors whether finding a seat is easier.' },
    { match: /coffee|service|friendly/i, title: 'Keep the coffee and personal service consistent', summary: 'Customers repeatedly mention the quality of the coffee and friendly, familiar service as reasons to return.', action: 'Share the positive feedback at the next team check-in', rationale: 'Keep the service habits customers appreciate while testing one improvement from their feedback.' },
  ]
  const selected = topics.map(topic => ({ ...topic, members: responses.filter(response => Object.values(response.answers).some(answer => topic.match.test(answer))) }))
    .filter(topic => topic.members.length >= data.minimumThemeResponses)
  if (!selected.length) selected.push({ ...topics[2], title: 'Review the feedback together', summary: 'The selected responses offer concrete experiences for the team to review.', action: 'Choose one improvement from the cited feedback', rationale: 'Discuss these responses with the team and measure a small change.', members: responses })
  return {
    outcome: 'findings', reason: '',
    themes: selected.map(topic => ({ title: topic.title, summary: topic.summary, responseIds: topic.members.map(response => response.id), count: topic.members.length,
      quotes: topic.members.slice(0, 2).map(response => {
        const [questionId, text] = Object.entries(response.answers).find(([, value]) => topic.match.test(value)) ?? Object.entries(response.answers).find(([, value]) => !!value)!
        return { responseId: response.id, questionId, start: 0, end: Math.min(text.length, 2000), text: text.slice(0, 2000) }
      }) })),
    recommendations: selected.map((topic, index) => ({ title: topic.action, rationale: topic.rationale, themeIndexes: [index], confidence: 'medium', expectedImpact: 'medium', effort: 'low' })),
  }
}
