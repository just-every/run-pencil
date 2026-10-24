/** Slack signs the exact form body; stale requests and malformed signatures are refused before parsing. */
export async function validSlackSignature(secret: string, body: string, timestamp: string | null, signature: string | null, now: number) {
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^v0=[a-f0-9]{64}$/.test(signature) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const expected = 'v0=' + Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`v0:${timestamp}:${body}`))),byte=>byte.toString(16).padStart(2,'0')).join('')
  let mismatch = 0
  for (let index=0; index<expected.length; index++) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
  return mismatch === 0
}
