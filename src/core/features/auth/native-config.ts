import type { AuthConfig } from '../../../base/operator-auth/index.mjs'
import type { RuntimeConfiguration } from '../../platform/config/runtime'

/** Ordinary sign-in and managed admission share the existing Pencil policy. */
export function nativeAuthConfiguration(config: RuntimeConfiguration): AuthConfig {
  return {
    origin: config.appOrigin, OWNER_EMAIL: config.bootstrapAdminEmail ?? 'owner@aurora-coffee.test',
    SESSION_SECRET: config.sessionSecret, SETUP_TOKEN: config.setupToken,
    MAIL_FROM: config.mail.kind === 'local-development' ? 'no-reply@pencil.test' : config.mail.from,
    // The confirmation page wears Pencil's landing look: the same public/rer-theme.css the installer declares.
    branding: { productName: 'Pencil', accentColor: '#c89cf5', signInPath: '/signin', theme: '/rer-theme.css' },
    local: config.isLocalDevelopment, sessionSeconds: 30 * 86400,
  }
}
