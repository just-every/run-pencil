/** Pure local deployment input validation. Never calls a provider or prints input values. */
export function validateConfiguration(environment) {
  const required = ['APP_ORIGIN', 'SEED_ADMIN_EMAIL', 'MAIL_PROVIDER', 'MAIL_API_KEY', 'MAIL_FROM', 'SESSION_SECRET']
  if (required.some((name) => !environment[name]?.trim())) throw new Error('Deployment inputs are incomplete.')
  if (environment.MAIL_PROVIDER === 'rer') {
    const mailbox = environment.MAIL_FROM.match(/<([^<>]+)>$/)?.[1] ?? environment.MAIL_FROM
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox.trim())) throw new Error('MAIL_FROM must be a sender email address.')
    let relay
    try { relay = new URL(environment.MAIL_RELAY_URL) } catch { throw new Error('MAIL_RELAY_URL must be an absolute HTTPS URL.') }
    if (relay.protocol !== 'https:' || relay.username || relay.password || relay.search || relay.hash || relay.href !== environment.MAIL_RELAY_URL) throw new Error('MAIL_RELAY_URL must be an absolute HTTPS URL without credentials, query or fragment.')
  } else if (environment.MAIL_FROM.length > 254 || !/^(?:noreply|no-reply)@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(environment.MAIL_FROM)) throw new Error('MAIL_FROM must be a plain noreply@ or no-reply@ address.')
  const origin = new URL(environment.APP_ORIGIN)
  if ((environment.SETUP_TOKEN && (environment.SETUP_TOKEN.length < 32 || /[\r\n]/.test(environment.SETUP_TOKEN))) || environment.SESSION_SECRET.length < 32 || origin.protocol !== 'https:' || origin.origin !== environment.APP_ORIGIN || !['rer', 'resend', 'sendgrid'].includes(environment.MAIL_PROVIDER) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environment.SEED_ADMIN_EMAIL) || required.some((name) => /[\r\n]/.test(environment[name]))) throw new Error('Deployment inputs are invalid.')
}
