/** Pure local deployment input validation. Never calls a provider or prints input values. */
export function validateConfiguration(environment) {
  const required = ['APP_ORIGIN', 'PENCIL_BUILD_ID', 'SEED_ADMIN_EMAIL', 'MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM', 'SESSION_SECRET']
  if (required.some((name) => !environment[name]?.trim())) throw new Error('Deployment inputs are incomplete.')
  const origin = new URL(environment.APP_ORIGIN)
  if ((environment.SETUP_TOKEN && (environment.SETUP_TOKEN.length < 32 || /[\r\n]/.test(environment.SETUP_TOKEN))) || environment.SESSION_SECRET.length < 32 || origin.protocol !== 'https:' || origin.origin !== environment.APP_ORIGIN || !['resend', 'sendgrid'].includes(environment.MAIL_PROVIDER) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.SEED_ADMIN_EMAIL) || required.some((name) => /[\r\n]/.test(environment[name]))) throw new Error('Deployment inputs are invalid.')
}
