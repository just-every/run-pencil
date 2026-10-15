import type { AiClient, AiRequest } from '../../../base/ai/index.mjs'
import { demoEffect } from '../../../base/demo/index.mjs'

// Only selected by RER_DEMO. These provider-shaped successes use the submitted evidence,
// so normal provenance checks, draft acceptance and action flows still run.
export function demoAiClient(): AiClient {
  const responses = (request: AiRequest) => demoEffect(
    () => { throw new Error('The demo AI client requires demo mode.') },
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
  const quote = responses[0], [questionId, text] = Object.entries(quote.answers).find(([, value]) => !!value)!
  return {
    outcome: 'findings', reason: '',
    themes: [{ title: 'Review the feedback together', summary: 'These responses provide a starting point for a team review.', responseIds: responses.map(response => response.id), count: responses.length,
      quotes: [{ responseId: quote.id, questionId, start: 0, end: Math.min(text.length, 2000), text: text.slice(0, 2000) }] }],
    recommendations: [{ title: 'Discuss one improvement with the team', rationale: 'Review the cited feedback and choose a small change to measure.', themeIndexes: [0], confidence: 'medium', expectedImpact: 'medium', effort: 'low' }],
  }
}
