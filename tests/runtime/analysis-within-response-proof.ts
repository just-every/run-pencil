import { env } from 'cloudflare:test'
import { expect } from 'vitest'
import { ai, answer, withinResponseFixture } from './analysis-fixture'

/** Run through the existing AGENT-002 journey; the provider edge proposes, Pencil validates and stores. */
export async function proveWithinResponseEvidence() {
  await ai.reset()
  const { f, responses } = await withinResponseFixture()
  const scoreId = f.questions.score!, textId = f.questions.improve
  const ids = responses.map(response => response.id)
  const scoreQuotes = responses.map(response => ({ responseId: response.id, questionId: scoreId, start: 0, end: String(response.score).length, text: String(response.score) }))
  const textQuotes = responses.map(response => ({ responseId: response.id, questionId: textId, start: 0, end: response.text.length, text: response.text }))
  const contradiction = {
    kind: 'within_response', summary: 'The same respondents give high scores but explicitly advise against recommending the shop.',
    sides: [
      { cohort: 'High recommendation scores', responseIds: ids, quotes: scoreQuotes },
      { cohort: 'Explicit negative recommendations', responseIds: ids, quotes: textQuotes },
    ],
  }
  const output = (finding: typeof contradiction) => ({ outcome: 'findings', reason: '', themes: [], recommendations: [], contradictions: [finding] })
  const selection = { questionIds: [scoreId, textId] }
  await ai.script(answer(output(contradiction)))
  const run = await f.request(selection)

  // Independently check the native answers that actually crossed the provider boundary, paired by response.
  const requests = await ai.requests()
  expect(requests).toHaveLength(1)
  const sent = JSON.parse(JSON.parse(requests[0].body).input[1].content[0].text)
  expect(sent.minimumThemeResponses).toBe(5)
  expect(sent.questions).toEqual([
    { id: textId, prompt: 'What could we improve?' },
    { id: scoreId, prompt: 'Would you recommend us?', questionType: 'nps' },
  ])
  expect(sent.responses).toHaveLength(5)
  expect(new Set(sent.responses.map((response: { id: string }) => response.id))).toEqual(new Set(ids))
  for (const response of responses) {
    expect(sent.responses.find((item: { id: string }) => item.id === response.id)).toEqual({
      id: response.id, answers: { [scoreId]: String(response.score), [textId]: response.text },
    })
  }

  // A separate authenticated read must show the complete retained finding, rather than only the POST result.
  const read = await f.call(`/api/app/analysis/${run.id}`)
  expect(read.status).toBe(200)
  const detail = await read.json() as any
  for (const result of [run, detail]) {
    expect(result).toMatchObject({ state: 'completed', evidenceCount: 5, errorCode: null, themes: [], recommendation: null, suppressedContradictions: 0 })
    expect(result.questions).toEqual([{ id: scoreId, prompt: 'Would you recommend us?' }, { id: textId, prompt: 'What could we improve?' }])
    expect(result.contradictions).toHaveLength(1)
    const finding = result.contradictions[0]
    expect(finding).toMatchObject({ kind: 'within_response', summary: contradiction.summary })
    expect(finding.id).toEqual(expect.any(String))
    expect(finding.sides).toHaveLength(2)
    expect(finding.sides[0].responseIds).toEqual(ids)
    expect(finding.sides[1].responseIds).toEqual(ids)
    for (const [index, response] of responses.entries()) {
      expect(finding.sides[0].quotes[index]).toEqual({ responseId: response.id, questionId: scoreId, start: 0, end: String(response.score).length, text: String(response.score) })
      expect(finding.sides[1].quotes[index]).toEqual({ responseId: response.id, questionId: textId, start: 0, end: response.text.length, text: response.text })
    }
  }
  expect(detail.contradictions[0].id).toBe(run.contradictions[0].id)

  // Remove the complete fifth ID and excerpt together: a valid four-response side must be withheld.
  const belowFloor = { ...contradiction, sides: [
    contradiction.sides[0],
    { ...contradiction.sides[1], responseIds: ids.slice(0, 4), quotes: textQuotes.slice(0, 4) },
  ] }
  await ai.script(answer(output(belowFloor)))
  const withheld = await f.request(selection)
  const withheldRead = await f.call(`/api/app/analysis/${withheld.id}`)
  expect(withheldRead.status).toBe(200)
  for (const result of [withheld, await withheldRead.json()]) {
    expect(result).toMatchObject({ state: 'completed', evidenceCount: 5, errorCode: null, contradictions: [], suppressedContradictions: 1, themes: [], recommendation: null, insufficientReason: null })
    const serialized = JSON.stringify(result)
    for (const prose of [contradiction.summary, ...contradiction.sides.map(side => side.cohort), ...responses.map(response => response.text), ...ids]) expect(serialized).not.toContain(prose)
  }
  const persisted = await env.DB.prepare('SELECT payload_json FROM analysis_contradictions WHERE run_id = ?').bind(withheld.id).all()
  expect(persisted.results).toEqual([{ payload_json: null }])
}
