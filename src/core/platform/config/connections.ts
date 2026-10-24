import { z } from 'zod'
import { type SlackConnection, type TeamsConnection } from '../../features/chat-integrations/model'
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
export const smsConnectionSchema = z.object({accountId:secret,authToken:secret,fromNumber:z.string().regex(/^\+[1-9][0-9]{7,14}$/),a2pState:z.enum(['unregistered','pending','approved','rejected']),apiOrigin:address.default('https://api.twilio.com')}).strict()
export type SmsConnection = z.infer<typeof smsConnectionSchema>
export const googleConnectionSchema=z.object({clientId:secret,clientSecret:secret,authOrigin:address.default('https://accounts.google.com'),tokenOrigin:address.default('https://oauth2.googleapis.com'),apiOrigin:address.default('https://sheets.googleapis.com')}).strict()
export type GoogleConnection=z.infer<typeof googleConnectionSchema>&{accessToken?:string;refreshToken?:string;expiresAt?:number}
type AnalysisConnection = z.infer<typeof analysisConnectionSchema>
type TaskConnection = z.infer<typeof taskConnectionSchema>
export type PaymentConnection = z.infer<typeof paymentConnectionSchema>
type Kind = 'analysis' | 'task' | 'payment' | 'sms' | 'google' | 'slack' | 'teams'

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
  async saveSms(input:SmsConnection) {
    validateAddress(input.apiOrigin,this.platform.configuration.isLocalDevelopment)
    if(input.apiOrigin!=='https://api.twilio.com' && !(this.platform.configuration.isLocalDevelopment && ['localhost','127.0.0.1','[::1]'].includes(new URL(input.apiOrigin).hostname)))throw new ValidationError('Twilio uses https://api.twilio.com.')
    if(new URL(input.apiOrigin).origin!==input.apiOrigin)throw new ValidationError('Use the Twilio API origin without a path.')
    await this.save('sms',input)
  }
  async sms(){return this.read<SmsConnection>('sms')}
  async smsStatus(){const saved=await this.sms();return {saved:!!saved,a2pState:saved?.a2pState??null,fromNumber:saved?.fromNumber??null,webhookUrl:this.platform.configuration.appOrigin+'/api/public/sms/twilio'}}
  validateGoogle(input:GoogleConnection){
    for(const [name,expected] of [['authOrigin','https://accounts.google.com'],['tokenOrigin','https://oauth2.googleapis.com'],['apiOrigin','https://sheets.googleapis.com']] as const){const value=input[name];validateAddress(value,this.platform.configuration.isLocalDevelopment);if(new URL(value).origin!==value||value!==expected&&!(this.platform.configuration.isLocalDevelopment&&['localhost','127.0.0.1','[::1]'].includes(new URL(value).hostname)))throw new ValidationError('Use the Google service origins.')}
  }
  async saveGoogle(input:GoogleConnection){this.validateGoogle(input);await this.save('google',input)}
  async google(){return this.read<GoogleConnection>('google')}
  async googleStatus(){const saved=await this.google();return {connected:!!saved?.accessToken,configured:!!saved,callbackUrl:this.platform.configuration.appOrigin+'/api/app/connections/google/callback'}}
  async saveSlack(input: SlackConnection) {
    validateAddress(input.apiOrigin, this.platform.configuration.isLocalDevelopment)
    const url = new URL(input.apiOrigin)
    if (input.apiOrigin !== 'https://slack.com/api' && !(this.platform.configuration.isLocalDevelopment && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new ValidationError('Slack uses https://slack.com/api.')
    await this.save('slack', input)
  }
  async slack() { return this.read<SlackConnection>('slack') }
  async slackStatus() { return { saved: !!await this.slack(), interactionUrl: this.platform.configuration.appOrigin + '/api/public/chat/slack/interactions' } }
  async saveTeams(input: TeamsConnection) {
    const url = new URL(input.webhookUrl)
    if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(this.platform.configuration.isLocalDevelopment && url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new ValidationError('Use an HTTPS Teams incoming-webhook address. Local development accepts loopback HTTP.')
    const host = url.hostname.toLowerCase(), loopback = this.platform.configuration.isLocalDevelopment && ['localhost','127.0.0.1','[::1]'].includes(host)
    if (!loopback && host !== 'outlook.office.com' && !['.webhook.office.com','.webhook.office365.com','.logic.azure.com','.api.powerplatform.com'].some(suffix => host.endsWith(suffix))) throw new ValidationError('Use the incoming-webhook URL supplied by Microsoft Teams.')
    await this.save('teams', input)
  }
  async teams() { return this.read<TeamsConnection>('teams') }
  async teamsStatus() { return { saved: !!await this.teams() } }
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
