import type { EvidenceResponse } from './evidence'
import { AnalysisFailure, providerOutputSchema, type Contradiction, type Level, type ProviderOutput } from './model'

export type ValidatedQuote = { responseId: string; questionId: string; start: number; end: number; text: string }
export type ValidatedTheme = { rank: number; title: string; summary: string; members: string[]; quotes: ValidatedQuote[]; eligible: boolean; primary: boolean }
export type ValidatedRecommendation = { title: string; rationale: string; themeRanks: number[]; confidence: Level; expectedImpact: Level; effort: Level }
export type ValidatedResult =
  | { outcome: 'insufficient_evidence'; reason: string }
  | { outcome: 'completed'; themes: ValidatedTheme[]; contradictions?: Array<Contradiction | null>; recommendation: ValidatedRecommendation | null }

const fail = (code: string, message: string) => { throw new AnalysisFailure(code, message) }

/** ANLY-012: nothing the provider says is shown until it is checked against the run's own evidence set. Counts and
 * percentages are recomputed from the cited IDs; a quote must equal its stored answer over the exact range. */
export function validateOutput(raw: unknown, evidence: EvidenceResponse[], questionIds: string[], threshold: number): ValidatedResult {
  const parsed = providerOutputSchema.safeParse(raw)
  if (!parsed.success) fail('schema_invalid', 'The provider did not answer with the required analysis schema.')
  const output = parsed.data as ProviderOutput
  if (output.outcome === 'insufficient_evidence') {
    if (output.themes.length || output.recommendations.length || output.contradictions?.length) fail('schema_invalid', 'An insufficient-evidence answer cannot carry themes or recommendations.')
    return { outcome: 'insufficient_evidence', reason: 'The provider found that this evidence cannot support a finding.' }
  }
  const byId = new Map(evidence.map(response => [response.id, response])), questions = new Set(questionIds)
  const contradictions = output.contradictions?.map(contradiction => {
    for (const side of contradiction.sides) {
      if (new Set(side.responseIds).size !== side.responseIds.length) fail('count_mismatch', 'A contradiction cites a response twice on one side.')
      if (side.responseIds.some(id => !byId.has(id))) fail('unknown_response', 'A contradiction cites a response outside this analysis evidence set.')
      for (const quote of side.quotes) {
        if (!side.responseIds.includes(quote.responseId)) fail('quote_provenance', 'A contradiction excerpt must cite a response on its own side.')
        const answer = questions.has(quote.questionId) ? byId.get(quote.responseId)?.answers[quote.questionId] : undefined
        if (answer === undefined || quote.start >= quote.end || quote.end > answer.length || answer.slice(quote.start,quote.end) !== quote.text) fail('quote_mismatch', 'A contradiction excerpt does not match its retained answer.')
      }
    }
    // Withhold the entire finding, including prose describing a small cohort.
    return contradiction.sides.some(side => side.responseIds.length < threshold) ? null : contradiction
  })
  const themes = output.themes.map((theme, index) => {
    const members = [...new Set(theme.responseIds)]
    if (!members.length) fail('count_mismatch', 'A theme cites no responses.')
    if (members.some(id => !byId.has(id))) fail('unknown_response', 'The provider cited a response outside this analysis\'s evidence set.')
    if (theme.count !== members.length || members.length !== theme.responseIds.length) fail('count_mismatch', 'A theme\'s stated count differs from the responses it cites.')
    const quotes = theme.quotes.map(quote => {
      if (!members.includes(quote.responseId)) fail('quote_provenance', 'A quote comes from a response the theme does not cite.')
      const answer = questions.has(quote.questionId) ? byId.get(quote.responseId)!.answers[quote.questionId] : undefined
      if (answer === undefined || quote.end > answer.length || quote.start >= quote.end || answer.slice(quote.start, quote.end) !== quote.text) fail('quote_mismatch', 'A quote is not an exact excerpt of the stored answer it names.')
      return { responseId: quote.responseId, questionId: quote.questionId, start: quote.start, end: quote.end, text: quote.text }
    })
    return { index, title: theme.title, summary: theme.summary, members, quotes }
  })
  for (const recommendation of output.recommendations) if (!recommendation.themeIndexes.length || recommendation.themeIndexes.some(index => index >= themes.length)) fail('unknown_theme', 'A recommendation links a theme the answer does not contain.')
  // Ranking is Pencil's: most supporting responses first, then the provider's order.
  const ranked = [...themes].sort((left, right) => right.members.length - left.members.length || left.index - right.index)
  const rankOf = new Map(ranked.map((theme, rank) => [theme.index, rank + 1]))
  const eligible = ranked.filter(theme => theme.members.length >= threshold)
  if (!eligible.length && !contradictions?.length) return { outcome: 'insufficient_evidence', reason: `No theme is supported by at least ${threshold} responses, the disclosure threshold.` }
  // recommendation.selection.v1 (highest-impact): the action linked to the highest-ranked eligible finding.
  let recommendation: ValidatedRecommendation | null = null
  for (const theme of eligible) {
    const match = output.recommendations.find(candidate => candidate.themeIndexes.includes(theme.index))
    if (match) {
      recommendation = { title: match.title, rationale: match.rationale, themeRanks: [...new Set(match.themeIndexes.map(index => rankOf.get(index)!))].sort((a, b) => a - b), confidence: match.confidence, expectedImpact: match.expectedImpact, effort: match.effort }
      break
    }
  }
  return {
    outcome: 'completed',
    themes: ranked.map((theme, i) => ({ rank: i + 1, title: theme.title, summary: theme.summary, members: theme.members, quotes: theme.quotes, eligible: theme.members.length >= threshold, primary: theme === eligible[0] })),
    ...(contradictions === undefined ? {} : { contradictions }),
    recommendation,
  }
}
