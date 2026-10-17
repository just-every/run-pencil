export async function hashResumeValue(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

// The key stays in installation configuration. Neither a database dump nor an
// archive can reconstruct a bearer from the recorded save command.
export async function resumeBearer(secret: string, sessionId: string, commandKey: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(['respondent-resume.v1', sessionId, commandKey])))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
}

export const resumedSessionToken = (bearer: string) => hashResumeValue(`respondent-resume-session.v1:${bearer}`)
