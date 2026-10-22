import { z } from 'zod';

export const objectBytesLimit = 262_144;
const identifier = '[A-Za-z0-9_-]{1,200}';
const keyPattern = new RegExp(`^previews/(${identifier})/(${identifier})/([a-f0-9]{64})$`);
export const archiveObject = z.object({
  bucket: z.literal('FORM_ASSETS'), key: z.string().regex(keyPattern),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  customMetadata: z.object({ workspaceId: z.string(), flowId: z.string(), mime: z.enum(['image/png', 'image/jpeg', 'image/webp']) }).strict(),
  data: z.string().max(Math.ceil(objectBytesLimit / 3) * 4).regex(/^[A-Za-z0-9+/]*={0,2}$/),
}).strict();

export function objectBytes(object) {
  const parsed = archiveObject.parse(object), match = keyPattern.exec(parsed.key);
  const binary = atob(parsed.data), bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (!bytes.length || bytes.length > objectBytesLimit || btoa(binary) !== parsed.data || match[1] !== parsed.customMetadata.workspaceId || match[2] !== parsed.customMetadata.flowId || parsed.customMetadata.mime !== parsed.mime) throw Error('Invalid archive attachment custody.');
  const signature = parsed.mime === 'image/png' ? bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)
    : parsed.mime === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!signature) throw Error('Invalid archive attachment type.');
  return bytes;
}
export async function checkObject(object) {
  const bytes = objectBytes(object), prefix = new TextEncoder().encode(object.mime + '\0'), fingerprint = new Uint8Array(prefix.length + bytes.length);
  fingerprint.set(prefix); fingerprint.set(bytes,prefix.length);
  const digest = await crypto.subtle.digest('SHA-256', fingerprint);
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,'0')).join('');
  if (!object.key.endsWith('/' + hash)) throw Error('Archive attachment checksum mismatch.');
  return bytes;
}
export function* objectReferences(table, rows) {
  const names = ['form_settings_json', 'policy_snapshot_json', 'structure_json'];
  if (table.name?.startsWith('ik_')) names.push('plan_json','record_json','value_json','attachment_json');
  const columns = names.map(name => table.columns.indexOf(name)).filter(index => index >= 0);
  if (!columns.length) return;
  function* visit(value) {
    if (!value || typeof value !== 'object') return;
    const image = value.linkPreview?.image;
    if (image && typeof image.key === 'string' && image.key.startsWith('previews/')) yield image;
    for (const child of Object.values(value)) yield* visit(child);
  }
  for (const row of rows) for (const index of columns) {
    if (row[index]?.type !== 'text') continue;
    yield* visit(JSON.parse(row[index].value));
  }
}
export function requireObjectReferences(tables, objects) {
  for (const table of tables) for (const reference of objectReferences(table, table.rows)) {
    const object = objects.get(reference.key);
    if (!object || reference.mime !== object.mime) throw Error('Backup is missing a referenced form image. Preserve the deployment and export with FORM_ASSETS.');
  }
}
export async function* bucketObjects(bucket) {
  if (!bucket) throw Error('FORM_ASSETS is required for attachment backup.');
  let cursor;
  do {
    const page = await bucket.list({ limit: 100, ...(cursor ? { cursor } : {}) });
    for (const entry of page.objects) {
      const object = await bucket.get(entry.key);
      if (!object || object.size > objectBytesLimit) throw Error('A form image is missing or exceeds the attachment limit.');
      const bytes = new Uint8Array(await object.arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const record = archiveObject.parse({ bucket: 'FORM_ASSETS', key: object.key, mime: object.httpMetadata?.contentType, customMetadata: object.customMetadata, data: btoa(binary) });
      await checkObject(record);
      yield record;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
