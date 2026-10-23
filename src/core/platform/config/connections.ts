import { z } from 'zod'
import { ValidationError } from '../../shared/errors'
import { readAiProvider } from '../ai/provider'
import type { PencilPlatform } from '../runtime'
import { readTaskDestination } from './task-destination'
import { sealValue, unsealValue } from './sealing'

const secret = z.string().trim().min(1).max(4096).regex(/^\S+$/)
const address = z.string().trim().url().max(2000)
export const analysisConnectionSchema = z.object({
  provider: z.enum(['openai', 'compatible', 'models']),
  model: z.string().trim().min(1).max(200),
  baseUrl: address,
  apiKey: secret,
  inputRate: z.number().finite().min(0).max(10000).optional(),
  outputRate: z.number().finite().min(0).max(10000).optional(),
}).strict()
export const taskConnectionSchema = z.object({ url: address, apiKey: secret }).strict()
// PAY-001: a Stripe restricted (rk_) or secret (sk_) key and the signing secret of the webhook endpoint the owner made.
export const paymentConnectionSchema = z.object({
  secretKey: z.string().trim().regex(/^(?:rk|sk)_(?:test|live)_[A-Za-z0-9]{8,240}$/, 'Use a Stripe restricted key (rk_test_ or rk_live_) or secret key.'),
  webhookSecret: z.string().trim().regex(/^whsec_[A-Za-z0-9+/=_-]{8,240}$/, 'Use the webhook signing secret that starts with whsec_.'),
}).strict()
type AnalysisConnection = z.infer<typeof analysisConnectionSchema>
type TaskConnection = z.infer<typeof taskConnectionSchema>
export type PaymentConnection = z.infer<typeof paymentConnectionSchema>
type Kind = 'analysis' | 'task' | 'payment'

function validateAddress(value: string, local: boolean) {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && loopback && url.protocol === 'http:'))) {
    throw new ValidationError('Use an HTTPS address without credentials, query or fragment. Local development also accepts a loopback HTTP address.')
  }
}

// Authenticated encryption binds the ciphertext to this setting's identity.
// SESSION_SECRET stays outside D1. Rotating it requires reconnecting integrations.
export class IntegrationConnections {
  constructor(private readonly platform: PencilPlatform) {}
  private async read<T>(kind: Kind): Promise<T | undefined> {
    const row = await this.platform.databaseBinding.prepare('SELECT sealed FROM integration_connections WHERE kind = ?').bind(kind).first<{ sealed: string }>()
    if (!row) return undefined
    try { return await unsealValue<T>(this.platform.configuration.sessionSecret, kind, row.sealed) }
    catch { throw new ValidationError('The saved connection cannot be unlocked. Restore the installation session secret or remove and reconnect this integration.') }
  }
  private async save(kind: Kind, value: unknown) {
    const sealed = await sealValue(this.platform.configuration.sessionSecret, kind, value)
    await this.platform.databaseBinding.prepare('INSERT INTO integration_connections (kind, sealed, updated_at) VALUES (?, ?, ?) ON CONFLICT(kind) DO UPDATE SET sealed=excluded.sealed, updated_at=excluded.updated_at').bind(kind, sealed, new Date().toISOString()).run()
  }
  async remove(kind: Kind) { await this.platform.databaseBinding.prepare('DELETE FROM integration_connections WHERE kind = ?').bind(kind).run() }
  async saveAnalysis(input: AnalysisConnection) {
    validateAddress(input.baseUrl, this.platform.configuration.isLocalDevelopment)
    if (input.provider === 'openai' && input.baseUrl !== 'https://api.openai.com/v1') throw new ValidationError('OpenAI uses https://api.openai.com/v1. Choose a compatible provider to use another address.')
    await this.save('analysis', input)
  }
  async saveTask(input: TaskConnection) {
    validateAddress(input.url, this.platform.configuration.isLocalDevelopment)
    await this.save('task', input)
  }
  async savePayment(input: PaymentConnection) {
    await this.save('payment', input)
  }
  /** The key is used only for Stripe calls; status reports its mode, never its value. */
  async payment() { return this.read<PaymentConnection>('payment') }
  async paymentStatus() {
    const saved = await this.read<PaymentConnection>('payment')
    return { saved: !!saved, mode: saved ? saved.secretKey.includes('_live_') ? 'live' as const : 'test' as const : null, restricted: saved ? saved.secretKey.startsWith('rk_') : null, webhookUrl: `${this.platform.configuration.appOrigin}/api/public/payments/stripe` }
  }
  async analysisStatus() {
    const saved = await this.read<AnalysisConnection>('analysis')
    const ai = this.platform.ai
    return { saved: !!saved, configured: !!saved, provider: saved?.provider ?? 'openai', model: saved?.model ?? 'gpt-4.1-mini', baseUrl: saved?.baseUrl ?? 'https://api.openai.com/v1', hasKey: !!saved || ai.state === 'on', inputRate: saved?.inputRate, outputRate: saved?.outputRate }
  }
  async taskStatus() {
    const saved = await this.read<TaskConnection>('task'), task = this.platform.configuration.task
    // An environment-supplied URL may contain credentials. Never reflect them.
    const url = saved?.url ?? (task.kind === 'webhook' ? task.url : undefined)
    const safe = url ? new URL(url) : undefined
    if (safe) { safe.username = ''; safe.password = ''; safe.search = ''; safe.hash = '' }
    return { saved: !!saved, configured: !!saved || task.kind === 'webhook', url: safe?.href, hasKey: !!saved || task.kind === 'webhook' }
  }
  async configured(): Promise<PencilPlatform> {
    const [analysisResult, taskResult] = await Promise.allSettled([this.read<AnalysisConnection>('analysis'), this.read<TaskConnection>('task')])
    for (const result of [analysisResult, taskResult]) if (result.status === 'rejected' && !(result.reason instanceof ValidationError)) throw result.reason
    const analysis = analysisResult.status === 'fulfilled' ? analysisResult.value : undefined
    const task = taskResult.status === 'fulfilled' ? taskResult.value : undefined
    const ai = analysis ? readAiProvider({ AI_ENABLED: 'true', AI_MODEL: analysis.model,
      ...(analysis.provider === 'models' ? { MODELS_SERVICE: analysis.baseUrl, MODELS_KEY: analysis.apiKey } : { AI_BASE_URL: analysis.baseUrl, AI_API_KEY: analysis.apiKey }),
      ...(analysis.inputRate !== undefined && analysis.outputRate !== undefined ? { AI_INPUT_USD_PER_MILLION_TOKENS: String(analysis.inputRate), AI_OUTPUT_USD_PER_MILLION_TOKENS: String(analysis.outputRate) } : {}),
    } as Parameters<typeof readAiProvider>[0], this.platform.configuration.isLocalDevelopment) : this.platform.ai
    const message = 'Saved connection cannot be unlocked. Remove it and reconnect, or restore the installation session secret.'
    return { ...this.platform, ai: analysisResult.status === 'rejected' ? { state: 'misconfigured', code: 'ai_misconfigured', setup: message } : ai,
      configuration: { ...this.platform.configuration, task: taskResult.status === 'rejected' ? { kind: 'unavailable', message } : task ? readTaskDestination({ TASK_PROVIDER: 'webhook', TASK_WEBHOOK_URL: task.url, TASK_API_KEY: task.apiKey }, this.platform.configuration.isLocalDevelopment) : this.platform.configuration.task } }
  }
}

export const configuredIntegrationPlatform = (platform: PencilPlatform) => new IntegrationConnections(platform).configured()
