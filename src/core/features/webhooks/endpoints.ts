import { ulid } from 'ulid'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { sealValue } from '../../platform/config/sealing'
import { validateEndpointAddress } from './address'
import { newSecret } from './sign'
import type { EndpointSummary } from './model'

const endpointLimit = 20
export type WebhookAlert = { endpointId: string; kind: 'disabled' | 'failed' | 'failing'; message: string }

/** The endpoints an owner registers (INTEG-010). The signing secret is created here, sealed, returned once and never read back. */
export class ResponseWebhooks {
  constructor(private readonly db: D1Database, private readonly sessionSecret: string, private readonly allowLoopbackHttp: boolean) {}

  async list(workspaceId: string, endpointId?: string): Promise<EndpointSummary[]> {
    const rows = await this.db.prepare(`SELECT e.id, e.url, e.flow_id AS flowId, f.title AS flowTitle, e.state, e.disabled_reason AS disabledReason, e.disabled_at AS disabledAt,
      e.failure_streak AS failureStreak, e.sealed_secret IS NOT NULL AS secretSet, e.secret_version AS secretVersion, e.created_at AS createdAt,
      (SELECT count(*) FROM response_event_deliveries d WHERE d.endpoint_id = e.id AND d.status IN ('pending','sending')) AS pending,
      (SELECT count(*) FROM response_event_deliveries d WHERE d.endpoint_id = e.id AND d.status = 'failed') AS failed,
      (SELECT max(a.created_at) FROM response_event_attempts a JOIN response_event_deliveries d ON d.id = a.delivery_id WHERE d.endpoint_id = e.id AND a.event = 'confirmed') AS lastConfirmedAt
      FROM response_webhook_endpoints e LEFT JOIN flows f ON f.id = e.flow_id WHERE e.workspace_id = ? AND (? IS NULL OR e.id = ?) ORDER BY e.created_at, e.id`).bind(workspaceId, endpointId ?? null, endpointId ?? null).all<Omit<EndpointSummary, 'secretSet'> & { secretSet: number }>()
    return rows.results.map(row => ({ ...row, secretSet: !!row.secretSet }))
  }

  async create(workspaceId: string, operatorId: string, input: { url: string; flowId?: string }) {
    const url = validateEndpointAddress(input.url, this.allowLoopbackHttp)
    if (input.flowId && !await this.db.prepare('SELECT 1 FROM flows WHERE id = ? AND workspace_id = ?').bind(input.flowId, workspaceId).first()) throw new NotFoundError('This form is not in your workspace.')
    const count = await this.db.prepare('SELECT count(*) AS n FROM response_webhook_endpoints WHERE workspace_id = ?').bind(workspaceId).first<{ n: number }>()
    if ((count?.n ?? 0) >= endpointLimit) throw new ConflictError(`A workspace can register up to ${endpointLimit} webhook endpoints. Remove one first.`)
    const id = ulid(), secret = newSecret(), now = new Date().toISOString()
    await this.db.prepare(`INSERT INTO response_webhook_endpoints (id, workspace_id, flow_id, url, sealed_secret, secret_version, state, created_by_operator_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 'active', (SELECT id FROM operators WHERE id = ? AND workspace_id = ?), ?, ?)`)
      .bind(id, workspaceId, input.flowId ?? null, url.href, await sealValue(this.sessionSecret, `webhook:${id}`, secret), operatorId, workspaceId, now, now).run()
    return { endpoint: (await this.list(workspaceId, id))[0], secret }
  }

  async rotate(workspaceId: string, id: string) {
    await this.require(workspaceId, id)
    const secret = newSecret()
    await this.db.prepare('UPDATE response_webhook_endpoints SET sealed_secret = ?, secret_version = secret_version + 1, updated_at = ? WHERE id = ? AND workspace_id = ?')
      .bind(await sealValue(this.sessionSecret, `webhook:${id}`, secret), new Date().toISOString(), id, workspaceId).run()
    return { endpoint: (await this.list(workspaceId, id))[0], secret }
  }

  /** Pausing keeps queued events; resuming (also after a disable) clears the failure streak so the endpoint is tried again. */
  async setActive(workspaceId: string, id: string, active: boolean) {
    const endpoint = await this.require(workspaceId, id)
    if (active && !endpoint.secretSet) throw new ConflictError('This endpoint has no signing secret (it was restored from a backup). Rotate its secret first.')
    await this.db.prepare(`UPDATE response_webhook_endpoints SET state = ?, disabled_reason = NULL, disabled_at = NULL, failure_streak = 0, failure_streak_started_at = NULL, updated_at = ? WHERE id = ? AND workspace_id = ?`)
      .bind(active ? 'active' : 'paused', new Date().toISOString(), id, workspaceId).run()
    return (await this.list(workspaceId, id))[0]
  }

  async remove(workspaceId: string, id: string) {
    await this.require(workspaceId, id)
    await this.db.prepare('DELETE FROM response_webhook_endpoints WHERE id = ? AND workspace_id = ?').bind(id, workspaceId).run()
  }

  async require(workspaceId: string, id: string) {
    const [endpoint] = await this.list(workspaceId, id)
    if (!endpoint) throw new NotFoundError('This webhook endpoint is not in your workspace.')
    return endpoint
  }

  /** What an operator must act on: an endpoint that stopped, is failing, or holds events that were not delivered. */
  async alerts(workspaceId: string) {
    return (await this.list(workspaceId)).flatMap((endpoint): WebhookAlert[] => {
      const where = endpoint.flowTitle ? `for ${endpoint.flowTitle}` : 'for all forms'
      if (endpoint.state === 'disabled') return [{ endpointId: endpoint.id, kind: 'disabled', message: `Webhook endpoint ${endpoint.url} ${where} is disabled: ${endpoint.disabledReason ?? 'repeated failures'}.` }]
      if (endpoint.failed > 0) return [{ endpointId: endpoint.id, kind: 'failed', message: `Webhook endpoint ${endpoint.url} ${where} has ${endpoint.failed} event${endpoint.failed === 1 ? '' : 's'} that could not be delivered. Replay them once the receiver works.` }]
      if (endpoint.failureStreak > 0) return [{ endpointId: endpoint.id, kind: 'failing', message: `Webhook endpoint ${endpoint.url} ${where} is failing (${endpoint.failureStreak} failed attempt${endpoint.failureStreak === 1 ? '' : 's'} in a row). Pencil keeps retrying for 24 hours.` }]
      return []
    })
  }
}
