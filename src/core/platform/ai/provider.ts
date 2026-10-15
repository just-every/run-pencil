import { aiConfig, aiDiagnostics, createAiClient, type AiClient } from '../../../base/ai/index.mjs'
import type { WorkerBindings } from '../../app/environment'

/** USD per million tokens, supplied by the owner for a direct key; without it a direct call's cost is not reported. */
export type AiRates = { inputPerMillion: number; outputPerMillion: number }
export type AiProvider =
  | { state: 'off'; setup: string }
  | { state: 'misconfigured'; setup: string; code: string }
  | { state: 'on'; client: AiClient; transport: 'direct' | 'models' | 'dev'; origin: string; model: string; rates: AiRates | null }

/** A local-only client (server.dev.ts): Base's dev double, or a capped Models dev app under `rer dev --models live`. */
export type DevAiClient = { client: AiClient; transport: 'dev' | 'models'; origin: string }
export type DevAiFactory = (environment: WorkerBindings) => DevAiClient

export const aiSetupText = 'AI is off. To analyse responses, set AI_ENABLED=true and AI_MODEL, then either AI_API_KEY (with AI_BASE_URL for a provider other than OpenAI) or MODELS_SERVICE and MODELS_KEY for a linked Models service.'

export const demoAiText = 'AI is off in this demo, so nothing is sent to an AI provider. An installation analyses responses once AI_ENABLED, AI_MODEL and one AI transport are set.'

function rates(environment: WorkerBindings): AiRates | null {
  const input = Number(environment.AI_INPUT_USD_PER_MILLION_TOKENS), output = Number(environment.AI_OUTPUT_USD_PER_MILLION_TOKENS)
  return environment.AI_INPUT_USD_PER_MILLION_TOKENS && environment.AI_OUTPUT_USD_PER_MILLION_TOKENS && Number.isFinite(input) && Number.isFinite(output) && input >= 0 && output >= 0
    ? { inputPerMillion: input, outputPerMillion: output } : null
}

/** ai.provider.v1 for this request or tick. Configuration problems are reported here; nothing is sent until a run calls it. */
export function readAiProvider(environment: WorkerBindings, local: boolean): AiProvider {
  // A demo never calls an AI provider, whatever the checkout's private settings hold.
  if (environment.RER_DEMO === '1') return { state: 'off', setup: demoAiText }
  const config = aiConfig({ ...environment })
  if (!config.enabled) return { state: 'off', setup: aiSetupText }
  const model = environment.AI_MODEL?.trim()
  if (!model) return { state: 'misconfigured', code: 'ai_misconfigured', setup: 'AI_ENABLED is true but AI_MODEL is not set. Set the exact model name your provider serves.' }
  if (local && environment.PENCIL_DEV_AI) {
    const dev = environment.PENCIL_DEV_AI(environment)
    return { state: 'on', client: dev.client, transport: dev.transport, origin: dev.origin, model, rates: null }
  }
  const [problem] = aiDiagnostics(config)
  if (problem) return { state: 'misconfigured', code: problem.code, setup: 'Configure exactly one AI transport: AI_API_KEY (and AI_BASE_URL if not OpenAI), or MODELS_SERVICE and MODELS_KEY. Base URLs must be https.' }
  const transport = config.models ? 'models' : 'direct'
  const origin = new URL((transport === 'models' ? config.models!.baseUrl : config.direct!.baseUrl)!).origin
  return { state: 'on', client: createAiClient(config), transport, origin, model, rates: transport === 'direct' ? rates(environment) : null }
}
