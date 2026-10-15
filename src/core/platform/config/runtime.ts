import type { WorkerBindings } from '../../app/environment'
import type { MailConfiguration } from '../mail'
import { readTaskDestination, type TaskDestinationConfiguration } from './task-destination'

const loopbackHostnames = new Set(['127.0.0.1', '[::1]', 'localhost'])

export class DeploymentConfigurationError extends Error {}

export type RuntimeConfiguration = {
  readonly appOrigin: string
  readonly sessionSecret: string
  readonly setupToken?: string
  readonly bootstrapAdminEmail?: string
  readonly mail: MailConfiguration
  readonly task: TaskDestinationConfiguration
  readonly isLocalDevelopment: boolean
  readonly seedSampleData: boolean
}

export function isLoopbackRequest(requestUrl: string) {
  return loopbackHostnames.has(new URL(requestUrl).hostname)
}

export function isLocalDevelopmentRequest(requestUrl: string, environment: WorkerBindings) {
  return isLoopbackRequest(requestUrl)
    && environment.PENCIL_LOCAL_DEVELOPMENT === 'true'
    && environment.MAIL_PROVIDER === 'local'
}

/** A hosted demo container (Base demo host): RER_DEMO=1 behind its https origin, with mail silently suppressed.
 * The front supplies the origin, the demo owner (OWNER_EMAIL) and fresh secrets; effects are mocked. */
export function isHostedDemoRequest(requestUrl: string, environment: WorkerBindings) {
  return environment.RER_DEMO === '1' && environment.MAIL_PROVIDER === 'local' && !isLoopbackRequest(requestUrl)
}

function hasLineBreak(value: string) {
  return /[\r\n]/.test(value)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidMailFrom(value: string) {
  if (hasLineBreak(value)) return false
  const email = value.match(/<([^<>]+)>$/)?.[1] ?? value
  return isEmail(email.trim())
}

export function deploymentConfigurationErrors(requestUrl: string, environment: WorkerBindings) {
  if (isLocalDevelopmentRequest(requestUrl, environment)) return environment.SESSION_SECRET && environment.SESSION_SECRET.length >= 32 ? [] : ['SESSION_SECRET must contain at least 32 characters']

  const demo = isHostedDemoRequest(requestUrl, environment)
  const errors: string[] = []
  for (const name of demo ? ['APP_ORIGIN', 'OWNER_EMAIL', 'SESSION_SECRET'] as const : ['APP_ORIGIN', 'SEED_ADMIN_EMAIL', 'MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM', 'SESSION_SECRET'] as const) {
    if (!environment[name]?.trim()) errors.push(`${name} is required`)
  }
  if (demo && environment.OWNER_EMAIL && !isEmail(environment.OWNER_EMAIL.trim())) errors.push('OWNER_EMAIL must be an email address')
  if (!demo && environment.MAIL_PROVIDER && !['resend','sendgrid'].includes(environment.MAIL_PROVIDER)) {
    errors.push('MAIL_PROVIDER must be resend or sendgrid outside explicit loopback development')
  }
  if (environment.SESSION_SECRET && environment.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET must contain at least 32 characters')
  if (environment.SESSION_SECRET && hasLineBreak(environment.SESSION_SECRET)) errors.push('SESSION_SECRET must not contain line breaks')
  if (environment.SETUP_TOKEN && (environment.SETUP_TOKEN.length < 32 || hasLineBreak(environment.SETUP_TOKEN))) errors.push('SETUP_TOKEN must contain at least 32 characters with no line breaks')
  if (environment.APP_ORIGIN) {
    try {
      const origin = new URL(environment.APP_ORIGIN)
      if (origin.protocol !== 'https:') errors.push('APP_ORIGIN must use HTTPS outside local development')
      if (origin.origin !== environment.APP_ORIGIN.replace(/\/$/, '')) errors.push('APP_ORIGIN must be an origin without a path, query, or fragment')
    } catch {
      errors.push('APP_ORIGIN must be an absolute URL')
    }
  }
  if (environment.SEED_ADMIN_EMAIL && !isEmail(environment.SEED_ADMIN_EMAIL.trim())) errors.push('SEED_ADMIN_EMAIL must be an email address')
  if (environment.MAIL_FROM && !isValidMailFrom(environment.MAIL_FROM.trim())) errors.push('MAIL_FROM must be a sender email address')
  if (environment.MAIL_API_KEY && hasLineBreak(environment.MAIL_API_KEY)) errors.push('MAIL_API_KEY must not contain line breaks')
  if (errors.length === 0 && new URL(requestUrl).origin !== new URL(environment.APP_ORIGIN!).origin) {
    errors.push('This address does not match APP_ORIGIN. Set APP_ORIGIN to the exact HTTPS origin people open, then deploy again')
  }
  return errors
}

export function readRuntimeConfiguration(requestUrl: string, environment: WorkerBindings): RuntimeConfiguration {
  const errors = deploymentConfigurationErrors(requestUrl, environment)
  if (errors.length > 0) throw new DeploymentConfigurationError(`Invalid deployment configuration: ${errors.join('; ')}.`)
  if (isLocalDevelopmentRequest(requestUrl, environment)) {
    return {
      appOrigin: new URL(requestUrl).origin,
      sessionSecret: environment.SESSION_SECRET!,
      setupToken: environment.SETUP_TOKEN,
      bootstrapAdminEmail: environment.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
      mail: { kind: 'local-development' },
      task: readTaskDestination(environment, true),
      isLocalDevelopment: true,
      seedSampleData: environment.SEED_SAMPLE_DATA === 'true',
    }
  }
  if (isHostedDemoRequest(requestUrl, environment)) {
    return {
      appOrigin: new URL(environment.APP_ORIGIN!).origin,
      sessionSecret: environment.SESSION_SECRET!,
      setupToken: environment.SETUP_TOKEN,
      bootstrapAdminEmail: environment.OWNER_EMAIL!.trim().toLowerCase(),
      mail: { kind: 'local-development' },
      // Demo settings never carry keys; the task adapter returns provider success without sending.
      task: readTaskDestination({ ...environment, TASK_API_KEY: environment.TASK_API_KEY ?? 'demo-stand-in-never-sent' }, false),
      isLocalDevelopment: false,
      seedSampleData: false,
    }
  }
  return {
    appOrigin: new URL(environment.APP_ORIGIN!).origin,
    sessionSecret: environment.SESSION_SECRET!,
    setupToken: environment.SETUP_TOKEN,
    bootstrapAdminEmail: environment.SEED_ADMIN_EMAIL!.trim().toLowerCase(),
    mail: { kind: environment.MAIL_PROVIDER as 'resend' | 'sendgrid', apiKey: environment.MAIL_API_KEY!.trim(), from: environment.MAIL_FROM!.trim() },
    task: readTaskDestination(environment, false),
    isLocalDevelopment: false,
    seedSampleData: false,
  }
}
