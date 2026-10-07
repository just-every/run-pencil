import { contract } from '../../test/contract'
import { describe, expect, it } from 'vitest'
import type { WorkerBindings } from './environment'
import { deploymentConfigurationErrors, isLocalDevelopmentRequest, readRuntimeConfiguration } from '../platform/config/runtime'

function environment(overrides: Partial<WorkerBindings> = {}) {
  return overrides as WorkerBindings
}

describe('deployment configuration boundary', () => {
  it('allows the explicit local transport only on a loopback request', () => {
    const local = environment({ MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true' })
    expect(isLocalDevelopmentRequest('http://127.0.0.1:4173/health', local)).toBe(true)
    expect(isLocalDevelopmentRequest('https://pencil.example/health', local)).toBe(false)
  })

  contract(['WS-003', 'OPER-003'], 'names missing production values and rejects the local provider', () => {
    const errors = deploymentConfigurationErrors('https://pencil.example/health', environment({ MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true' }))
    expect(errors).toContain('APP_ORIGIN is required')
    expect(errors).toContain('MAIL_PROVIDER must be resend or sendgrid outside explicit loopback development')
  })

  contract(['WS-003'], 'accepts a complete production configuration', () => {
    const errors = deploymentConfigurationErrors('https://pencil.example/health', environment({
      APP_ORIGIN: 'https://pencil.example',
      PENCIL_BUILD_ID: 'pencil-0.0.0+abc123',
      SEED_ADMIN_EMAIL: 'owner@example.com',
      SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', MAIL_PROVIDER: 'resend',
      MAIL_API_KEY: 'configured',
      MAIL_FROM: 'no-reply@example.com',
    }))
    expect(errors).toEqual([])
  })

  it('does not bootstrap or serve a configured deployment on an arbitrary host', () => {
    const errors = deploymentConfigurationErrors('https://untrusted.workers.dev/health', environment({
      APP_ORIGIN: 'https://pencil.example',
      PENCIL_BUILD_ID: 'pencil-0.0.0+abc123',
      SEED_ADMIN_EMAIL: 'owner@example.com',
      SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', MAIL_PROVIDER: 'resend',
      MAIL_API_KEY: 'configured',
      MAIL_FROM: 'no-reply@example.com',
    }))
    expect(errors).toEqual(['The request host must match APP_ORIGIN'])
  })

  contract(['BASE-SECRET-001'], 'creates an explicit production mail configuration without exposing its values', () => {
    const configuration = readRuntimeConfiguration('https://pencil.example/health', environment({
      APP_ORIGIN: 'https://pencil.example',
      PENCIL_BUILD_ID: 'pencil-0.0.0+abc123',
      SEED_ADMIN_EMAIL: 'OWNER@example.com',
      SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', MAIL_PROVIDER: 'resend',
      MAIL_API_KEY: 'configured',
      MAIL_FROM: 'Pencil <no-reply@example.com>',
    }))
    expect(configuration).toMatchObject({
      appOrigin: 'https://pencil.example',
      buildId: 'pencil-0.0.0+abc123',
      bootstrapAdminEmail: 'owner@example.com',
      mail: { kind: 'resend' },
      isLocalDevelopment: false,
    })
  })
})
