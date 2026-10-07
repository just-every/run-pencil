import { describe, expect, it, vi } from 'vitest'
import { WorkspaceService } from './service'

describe('workspace settings validation', () => {
  it('accepts a canonical IANA zone and daily sending window', async () => {
    const repository = { updateSettings: vi.fn().mockResolvedValue({ id: 'workspace', embedAllowedOriginsJson: '[]', name: 'Pencil workspace', timeZone: 'Australia/Brisbane', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' }) }
    const service = new WorkspaceService(repository as never)

    await expect(service.updateSettings({ workspaceId: 'workspace', timeZone: 'Australia/Brisbane', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' })).resolves.toMatchObject({ timeZone: 'Australia/Brisbane' })
  })

  it.each([
    { timeZone: 'GMT', sendingWindowStart: '09:00', sendingWindowEnd: '17:00' },
    { timeZone: 'UTC', sendingWindowStart: '17:00', sendingWindowEnd: '09:00' },
    { timeZone: 'UTC', sendingWindowStart: '24:00', sendingWindowEnd: '25:00' },
  ])('rejects an invalid workspace clock %#', async (input) => {
    const service = new WorkspaceService({ updateSettings: vi.fn() } as never)
    await expect(service.updateSettings({ workspaceId: 'workspace', ...input })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

it('rejects wildcard, path and insecure remote embed hosts without writing settings', async () => {
  const repository = { updateSettings: vi.fn() }
  const service = new WorkspaceService(repository as never)
  for (const origin of ['https://*.example.com', 'https://example.com/path', 'http://example.com', 'https://example.com?secret=x']) {
    await expect(service.updateSettings({ workspaceId: 'w', timeZone: 'UTC', sendingWindowStart: '09:00', sendingWindowEnd: '17:00', embedAllowedOrigins: [origin] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  }
  expect(repository.updateSettings).not.toHaveBeenCalled()
})
