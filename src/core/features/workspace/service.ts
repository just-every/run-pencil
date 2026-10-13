import type { WorkspaceRepository } from './repository'
import { NotFoundError, ValidationError } from '../../shared/errors'

export const primaryWorkspaceId = '01K4Y1NH8N5DGBZX7HBDV00PEN'

export type WorkspaceSettings = {
  readonly id: string
  readonly name: string
  readonly brandConfigured: boolean
  readonly timeZone: string
  readonly sendingWindowStart: string
  readonly embedAllowedOrigins: string[]
  readonly sendingWindowEnd: string
  readonly reminderDelayHours: number
}

function isIanaTimeZone(timeZone: string) {
  try {
    const canonical = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone
    return timeZone === 'UTC' || (timeZone.includes('/') && canonical === timeZone)
  } catch {
    return false
  }
}

function isDailyTime(value: string) {
  const parts = value.match(/^(\d{2}):(\d{2})$/)
  return !!parts && Number(parts[1]) <= 23 && Number(parts[2]) <= 59
}

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository, private readonly defaultReminderHours = 48) {}

  async checkHealth() {
    await this.repository.checkHealth()
  }

  async ensureSampleWorkspace(input: {
    workspace: { id: string; name: string; timeZone: string; createdAt: string; updatedAt: string }
    operator: { id: string; email: string; displayName: string; createdAt: string; updatedAt: string }
  }) {
    await this.repository.ensureWorkspace({ ...input.workspace, firstRunCompletedAt: input.workspace.updatedAt })
    await this.repository.ensureOperator({ ...input.operator, workspaceId: input.workspace.id, isSetupOperator: false })
  }

  async ensurePrimaryWorkspace() {
    const existing = await this.repository.getFirstWorkspace()
    if (existing) return existing.id

    const now = new Date().toISOString()
    await this.repository.ensureWorkspace({
      id: primaryWorkspaceId,
      name: 'Pencil workspace',
      timeZone: 'UTC',
      sendingWindowStart: '09:00',
      sendingWindowEnd: '17:00',
      createdAt: now,
      updatedAt: now,
    })
    return primaryWorkspaceId
  }

  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const workspace = await this.repository.getWorkspace(workspaceId)
    if (!workspace) throw new NotFoundError('The operator workspace no longer exists.')
    return { id: workspace.id, name: workspace.name, brandConfigured: workspace.brandConfigured, timeZone: workspace.timeZone, sendingWindowStart: workspace.sendingWindowStart, sendingWindowEnd: workspace.sendingWindowEnd, reminderDelayHours: (await this.repository.reminderDelay(workspaceId)) ?? this.defaultReminderHours, embedAllowedOrigins: JSON.parse(workspace.embedAllowedOriginsJson) as string[] }
  }

  async setupState(workspaceId: string) {
    const workspace = await this.repository.getWorkspace(workspaceId)
    if (!workspace) throw new NotFoundError('The operator workspace no longer exists.')
    return { complete: Boolean(workspace.firstRunCompletedAt), name: workspace.name, timeZone: workspace.timeZone }
  }

  async completeSetup(workspaceId: string, name: string, timeZone: string) {
    name = name.trim(); timeZone = timeZone.trim()
    if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) throw new ValidationError('Enter a business name of at most 100 characters.')
    if (!isIanaTimeZone(timeZone)) throw new ValidationError('Choose a valid IANA time zone, such as UTC or Australia/Brisbane.')
    if (!await this.repository.completeSetup(workspaceId, name, timeZone, new Date().toISOString())) throw new NotFoundError('The operator workspace no longer exists.')
  }

  async updateSettings(input: { workspaceId: string; timeZone: string; sendingWindowStart: string; sendingWindowEnd: string; embedAllowedOrigins?: string[]; reminderDelayHours?:number }) {
    if(input.reminderDelayHours!==undefined && (!Number.isFinite(input.reminderDelayHours)||input.reminderDelayHours<0||input.reminderDelayHours>8760)) throw new ValidationError('Reminder delay must be between zero and 8760 hours.')
    const timeZone = input.timeZone.trim()
    if (!isIanaTimeZone(timeZone)) throw new ValidationError('Choose a valid IANA time zone, such as UTC or Australia/Brisbane.')
    if (!isDailyTime(input.sendingWindowStart) || !isDailyTime(input.sendingWindowEnd)) {
      throw new ValidationError('Sending hours must use 24-hour HH:MM times.')
    }
    if (input.sendingWindowStart >= input.sendingWindowEnd) {
      throw new ValidationError('The sending window must end after it starts.')
    }
    const origins = input.embedAllowedOrigins?.map((value) => {
      let origin: URL
      try { origin = new URL(value) } catch { throw new ValidationError('Embed hosts must be complete HTTPS origins.') }
      if (origin.hostname.includes('*') || origin.origin !== value || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) throw new ValidationError('Embed hosts must use HTTPS with no path, query or fragment. HTTP is allowed only for loopback review.')
      return origin.origin
    })
    const workspace = await this.repository.updateSettings({
      id: input.workspaceId,
      timeZone,
      ...(origins ? { embedAllowedOriginsJson: JSON.stringify([...new Set(origins)]) } : {}),
      sendingWindowStart: input.sendingWindowStart,
      sendingWindowEnd: input.sendingWindowEnd,
      updatedAt: new Date().toISOString(),
    })
    if (!workspace) throw new NotFoundError('The operator workspace no longer exists.')
    if(input.reminderDelayHours!==undefined) await this.repository.setReminderDelay(input.workspaceId,input.reminderDelayHours)
    return { id: workspace.id, name: workspace.name, brandConfigured: workspace.brandConfigured, timeZone: workspace.timeZone, sendingWindowStart: workspace.sendingWindowStart, sendingWindowEnd: workspace.sendingWindowEnd, reminderDelayHours: (await this.repository.reminderDelay(input.workspaceId)) ?? this.defaultReminderHours, embedAllowedOrigins: JSON.parse(workspace.embedAllowedOriginsJson) as string[] }
  }
}
