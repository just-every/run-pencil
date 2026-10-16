import type { Hono } from 'hono'
import { ulid } from 'ulid'
import type { WorkerEnvironment } from '../../app/environment'
import { requireConnectionOwner } from '../../app/connection-owner'
import { analysisConnectionSchema } from '../../platform/config/connections'
import { emptyMutationBody, validateInput } from '../../shared/validation'
import { ValidationError } from '../../shared/errors'
import { AnalysisFailure } from './model'
import { callProvider, type CallUsage } from './provider-call'

export function registerAnalysisConnectionRoutes(app: Hono<WorkerEnvironment>) {
  const path = '/api/app/connections/analysis'
  app.get(path, async c => c.json(await c.get('services').connections.analysisStatus()))
  app.put(path, validateInput('json', analysisConnectionSchema), async c => {
    await requireConnectionOwner(c)
    await c.get('services').connections.saveAnalysis(c.req.valid('json'))
    return c.json({ message: 'Provider saved. Test the connection before requesting analysis.' })
  })
  app.delete(path, emptyMutationBody, async c => {
    await requireConnectionOwner(c); await c.get('services').connections.remove('analysis')
    return c.json({ message: 'Using deployment settings.' })
  })
  app.post(`${path}/test`, emptyMutationBody, async c => {
    await requireConnectionOwner(c)
    const services = c.get('services'), provider = services.analysis.provider
    if (provider.state !== 'on') throw new ValidationError(provider.setup)
    if (provider.transport === 'dev' || provider.transport === 'demo') throw new ValidationError('This is a local simulation. Save a real provider and key above to test a live connection.')
    const { workspaceId } = c.get('operatorSession'), id = ulid(), at = new Date().toISOString()
    let usage: CallUsage | undefined, failure: string | undefined
    try {
      const result = await callProvider(provider, { model: provider.model, store: false, max_output_tokens: 64,
        input: [{ role: 'user', content: 'Connection test. Return ready as true.' }],
        text: { format: { type: 'json_schema', name: 'connection_test', strict: true, schema: { type: 'object', additionalProperties: false, required: ['ready'], properties: { ready: { type: 'boolean' } } } } },
      }, 'connection-test', id)
      usage = result.usage
      if (!result.output || typeof result.output !== 'object' || (result.output as { ready?: unknown }).ready !== true) failure = 'schema_invalid'
    } catch (error) {
      failure = error instanceof AnalysisFailure ? error.code : 'upstream_uncertain'
      usage = (error as { usage?: CallUsage }).usage
    }
    await c.get('platform').databaseBinding.prepare(`INSERT INTO analysis_calls (id, workspace_id, run_id, feature, provider, provider_origin, model, attempt, outcome, error_code, input_tokens, output_tokens, cost_microusd, cost_source, receipt_id, day, created_at)
      VALUES (?, ?, ?, 'connection-test', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, workspaceId, `connection-test-${id}`, provider.transport, provider.origin, provider.model, failure ? 'failed' : 'answered', failure ?? null, usage?.inputTokens ?? null, usage?.outputTokens ?? null, usage?.costMicrousd ?? null, usage?.costSource ?? 'not-reported', usage?.receiptId ?? null, at.slice(0, 10), at).run()
    if (failure) throw new ValidationError(failure === 'upstream_auth' ? 'The provider refused the key. Create an API key with Responses access and check the provider account billing.' : `Connection test failed (${failure}). Check the API address, model access, billing and structured Responses API support; then test again.`)
    return c.json({ message: 'Connection passed: the model returned the required structured answer. No respondent data was sent. Usage is recorded below.' })
  })
}
