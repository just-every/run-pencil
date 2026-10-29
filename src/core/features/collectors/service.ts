import { ulid } from 'ulid'
import { ConflictError, NotFoundError, PencilError, ValidationError } from '../../shared/errors'
import { zonedInstant } from '../../shared/timeZone'
import { collectorInput, collectorKey, collectorState, systemCollectorId, type CollectorInput, type CollectorRow, type CollectorSettings, type CollectorSource } from './model'
import type { CollectorRepository } from './repository'

export class CollectorClosedError extends PencilError {
  constructor(readonly flow?: { title: string; slug: string; collectionClosed?: boolean }) {
    super('COLLECTOR_CLOSED', 'This collection link is no longer accepting responses.')
  }
}
type Identity = { workspaceId: string; flowId: string; operatorId: string }
export class CollectorService {
  constructor(private readonly repository: CollectorRepository) {}
  attributed(attribution: Record<string, unknown>) { return new CollectorService(this.repository.attributed(attribution)) }
  private async flow(workspaceId: string, flowId: string) {
    const flow = await this.repository.flow(workspaceId, flowId)
    if (!flow) throw new NotFoundError('This flow is not available in your workspace.')
    return flow
  }
  private async actor(identity: Identity) {
    await this.flow(identity.workspaceId, identity.flowId)
    if (!await this.repository.actor(identity.workspaceId, identity.operatorId)) throw new NotFoundError('This operator is not in your workspace.')
  }
  private present(row: CollectorRow, slug: string, now = new Date().toISOString()) {
    const query = `?collector=${encodeURIComponent(row.publicKey)}`
    const directPath = `/f/${encodeURIComponent(slug)}${query}`
    const embedPath = `/embed/${encodeURIComponent(slug)}${query}`
    const publicPath = row.systemSource === null || row.systemSource === 'direct' || row.systemSource === 'embed' ? directPath : null
    return { ...collectorState(row, now), publicPath, embedPath: row.systemSource === null || row.systemSource === 'embed' ? embedPath : null }
  }
  async list(workspaceId: string, flowId: string) {
    const flow = await this.flow(workspaceId, flowId)
    const now = new Date().toISOString()
    return (await this.repository.list(workspaceId, flowId)).map(row => this.present(row, flow.slug, now))
  }
  async get(workspaceId: string, flowId: string, id: string) {
    const flow = await this.flow(workspaceId, flowId)
    const row = await this.repository.get(workspaceId, flowId, id)
    if (!row) throw new NotFoundError('This collector is not part of the selected flow.')
    return this.present(row, flow.slug)
  }
  private async editable(identity: Identity, id: string) {
    await this.actor(identity)
    const row = await this.repository.get(identity.workspaceId, identity.flowId, id)
    if (!row) throw new NotFoundError('This collector is not part of the selected flow.')
    if (row.systemSource !== null) throw new ValidationError('System source collectors cannot be changed or deleted. Create a named collector instead.')
    return row
  }
  private async settings(identity: Identity, raw: CollectorInput, previous?: CollectorRow): Promise<CollectorSettings> {
    const parsed = collectorInput.safeParse(raw)
    if (!parsed.success) throw new ValidationError('Check the collector name, channel, close date and response limit.')
    const input = parsed.data
    const flow = await this.flow(identity.workspaceId, identity.flowId)
    let deadlineAt = previous?.deadlineAt ?? null
    let deadlineTimeZone = previous?.deadlineTimeZone ?? null
    if (input.closeAt !== undefined) {
      try { deadlineAt = input.closeAt === null ? null : zonedInstant(input.closeAt, flow.timeZone) }
      catch (error) { throw new ValidationError(error instanceof Error ? error.message : 'Choose a valid close date in the workspace time zone.') }
      deadlineTimeZone = deadlineAt === null ? null : flow.timeZone
    } else if (input.deadlineAt !== undefined) {
      deadlineAt = input.deadlineAt === null ? null : new Date(input.deadlineAt).toISOString()
      deadlineTimeZone = deadlineAt === null ? null : flow.timeZone
    }
    return { name: input.name, channel: input.channel, deadlineAt, deadlineTimeZone,
      responseLimit: input.responseLimit === undefined ? previous?.responseLimit ?? null : input.responseLimit }
  }
  async create(identity: Identity, input: CollectorInput) {
    await this.actor(identity)
    const settings = await this.settings(identity, input)
    const id = ulid(), now = new Date().toISOString()
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
    if (!await this.repository.create({ ...identity, ...settings, id, publicKey: key, now })) throw new ConflictError('The collector limit for this flow has been reached.')
    return this.get(identity.workspaceId, identity.flowId, id)
  }
  async update(identity: Identity, id: string, input: CollectorInput) {
    const previous = await this.editable(identity, id)
    const settings = await this.settings(identity, input, previous)
    if (!await this.repository.update({ ...identity, ...settings, id, now: new Date().toISOString() })) throw new ConflictError('This collector changed or was deleted. Reload and try again.')
    return this.get(identity.workspaceId, identity.flowId, id)
  }
  async setClosed(identity: Identity, id: string, closed: boolean) {
    await this.editable(identity, id)
    if (!await this.repository.setClosed({ ...identity, id, now: new Date().toISOString() }, closed)) throw new ConflictError('This collector changed or was deleted. Reload and try again.')
    return this.get(identity.workspaceId, identity.flowId, id)
  }
  async erase(identity: Identity, id: string) {
    await this.editable(identity, id)
    if (!await this.repository.erase({ ...identity, id, now: new Date().toISOString() })) throw new ConflictError('This collector has responses, active sessions or invitation history. Close it to stop collection while retaining attribution.')
  }
  async resolve(flowId: string, source: CollectorSource, key?: string) {
    if (key !== undefined && !collectorKey.safeParse(key).success) throw new ValidationError('Choose a valid collection link.')
    const row = key === undefined
      ? await this.repository.publicDefault(flowId, systemCollectorId(flowId, source))
      : await this.repository.publicKey(flowId, key)
    // An explicit public collector link retains its declared source even when
    // scanned outside an iframe. The /embed document still checks its host.
    const publicLink = key !== undefined && ['direct','embed'].includes(source) && row && ['direct','embed'].includes(row.systemSource ?? '')
    if (!row || row.systemSource !== null && row.systemSource !== source && !publicLink) throw new NotFoundError('This collection link is not part of the requested flow.')
    return collectorState(row, new Date().toISOString())
  }
  async requireOpen(flowId: string, source: CollectorSource, key?: string) {
    const row = await this.resolve(flowId, source, key)
    if (row.state !== 'open') throw new CollectorClosedError()
    return row
  }
  async requireInvitationOpen(flowId: string, token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ValidationError('Choose a valid invitation link.')
    const row = await this.repository.publicInvitation(flowId, token)
    if (!row || row.systemSource !== null && row.systemSource !== 'invitation') throw new NotFoundError('This invitation collector is not part of the requested flow.')
    const current = collectorState(row, new Date().toISOString())
    if (current.state !== 'open') throw new CollectorClosedError()
    return current
  }
  async requireByIdOpen(workspaceId: string, flowId: string, id: string, source: CollectorSource) {
    await this.flow(workspaceId, flowId)
    const row = await this.repository.get(workspaceId, flowId, id)
    if (!row || row.systemSource !== null && row.systemSource !== source) throw new NotFoundError('This collector is not available for the selected flow and source.')
    const current = collectorState(row, new Date().toISOString())
    if (current.state !== 'open') throw new CollectorClosedError()
    return current
  }
  async requireSessionOpen(flowId: string, sessionId: string, source: CollectorSource) {
    const row = await this.repository.publicSession(flowId, sessionId)
    if (!row || row.systemSource !== null && row.systemSource !== source) throw new NotFoundError('This session has no valid collector for the requested flow.')
    const current = collectorState(row, new Date().toISOString())
    if (current.state !== 'open') throw new CollectorClosedError()
    return current
  }
}

