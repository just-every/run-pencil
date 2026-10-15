import { AiError } from '../../../base/ai/index.mjs'
import type { AiProvider } from '../../platform/ai/provider'
import { AnalysisFailure } from './model'

type OnProvider = Extract<AiProvider, { state: 'on' }>
export type CallUsage = { inputTokens: number | null; outputTokens: number | null; costMicrousd: number | null; costSource: 'receipt' | 'rates' | 'not-reported'; receiptId: string | null }

/** Transport outcomes that may succeed on a later attempt (ANLY-016). Everything else is terminal. */
const transientCodes = new Set(['upstream_unavailable', 'upstream_limited', 'upstream_uncertain', 'ai_unavailable'])
const callTimeoutMilliseconds = 120_000

function usage(provider: OnProvider, body: any, headers: Headers): CallUsage {
  const input = Number.isSafeInteger(body?.usage?.input_tokens) ? body.usage.input_tokens : Number.isSafeInteger(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null
  const output = Number.isSafeInteger(body?.usage?.output_tokens) ? body.usage.output_tokens : Number.isSafeInteger(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null
  const receipt = headers.get('x-models-cost-microusd'), receiptId = headers.get('x-models-request')
  if (receipt !== null && /^\d+$/.test(receipt)) return { inputTokens: input, outputTokens: output, costMicrousd: Number(receipt), costSource: 'receipt', receiptId }
  if (provider.rates && input !== null && output !== null) return { inputTokens: input, outputTokens: output, costMicrousd: Math.round(input * provider.rates.inputPerMillion + output * provider.rates.outputPerMillion), costSource: 'rates', receiptId }
  return { inputTokens: input, outputTokens: output, costMicrousd: null, costSource: 'not-reported', receiptId }
}

/** The answer's text: one assistant message with output text and nothing else. A tool call or refusal is not an answer. */
function answerText(body: any): string {
  const items = Array.isArray(body?.output) ? body.output : []
  if (items.some((item: any) => item?.type !== 'message')) throw new AnalysisFailure('schema_invalid', 'The provider answered with a tool call or another action; analysis accepts only the reviewed JSON answer.')
  const parts = items.flatMap((item: any) => Array.isArray(item.content) ? item.content : [])
  if (parts.length !== 1 || parts[0]?.type !== 'output_text' || typeof parts[0].text !== 'string') throw new AnalysisFailure('schema_invalid', 'The provider did not answer with the required analysis schema.')
  return parts[0].text
}

/** One provider attempt. Never retried here; the run decides (ANLY-016). Usage is returned even when the answer fails. */
export async function callProvider(provider: OnProvider, request: Record<string, unknown>, feature = 'analysis', subject?: string): Promise<{ output: unknown; usage: CallUsage }> {
  let response: Response
  try { response = await provider.client.responses(request, { feature, subject, signal: AbortSignal.timeout(callTimeoutMilliseconds) }) }
  catch (error) {
    if (error instanceof AiError) throw new AnalysisFailure(error.code, error.message, transientCodes.has(error.code))
    throw new AnalysisFailure('upstream_uncertain', 'The AI provider did not answer.', true)
  }
  let body: any
  try { body = await response.json() } catch { throw Object.assign(new AnalysisFailure('schema_invalid', 'The provider did not answer with JSON.'), { usage: usage(provider, undefined, response.headers) }) }
  const recorded = usage(provider, body, response.headers)
  try { return { output: JSON.parse(answerText(body)), usage: recorded } }
  catch (error) {
    const failure = error instanceof AnalysisFailure ? error : new AnalysisFailure('schema_invalid', 'The provider did not answer with the required analysis schema.')
    throw Object.assign(failure, { usage: recorded })
  }
}
