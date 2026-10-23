const encoder = new TextEncoder()

/** `sha256=<hex>`: HMAC-SHA256 over the exact body bytes, keyed by the endpoint secret's UTF-8 bytes. */
export async function signBody(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `sha256=${[...mac].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `pwh_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}
