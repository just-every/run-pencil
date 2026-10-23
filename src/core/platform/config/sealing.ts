// Authenticated encryption for values the installation keeps for its operators (outside connections, webhook secrets).
// The ciphertext is bound to the setting's identity; SESSION_SECRET stays outside D1.
async function sealingKey(sessionSecret: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pencil-connections-v1:${sessionSecret}`))
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function sealValue(sessionSecret: string, identity: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(identity) }, await sealingKey(sessionSecret), new TextEncoder().encode(JSON.stringify(value))))
  const bytes = new Uint8Array(iv.length + sealed.length); bytes.set(iv); bytes.set(sealed, iv.length)
  return btoa(String.fromCharCode(...bytes))
}

export async function unsealValue<T>(sessionSecret: string, identity: string, sealed: string): Promise<T> {
  const bytes = Uint8Array.from(atob(sealed), char => char.charCodeAt(0))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(identity) }, await sealingKey(sessionSecret), bytes.slice(12))
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
