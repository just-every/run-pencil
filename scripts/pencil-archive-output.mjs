import { createReadStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Base's archiveOutputGuard knows .rer names and the runeditrun-portability
// manifest. Pencil's own export is one JSON object whose payload.format names
// Pencil's local data format, under any file name. Read JSON string tokens as
// a stream, decoding escapes, and keep no archive content beyond one short
// token; never put any of it in an error.
const pencilFormat = 'runeditrun/pencil-local-data.v1';
const tokenLimit = 256;

export async function isPencilArchive(file) {
 let started = false, quoted = false, escaped = false, raw = '', overflow = false, key, valueOf;
 for await (const chunk of createReadStream(file, { encoding: 'utf8' })) {
  for (const character of chunk) {
   if (!started) { if (/\s/.test(character)) continue; if (character !== '{') return false; started = true; continue; }
   if (quoted) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '"') {
     quoted = false;
     let text;
     if (!overflow) try { text = JSON.parse(`"${raw}"`); } catch { text = undefined; }
     raw = ''; overflow = false;
     if (valueOf === 'format' && text === pencilFormat) return true;
     valueOf = undefined; key = text;
     continue;
    }
    if (!overflow) { raw += character; if (raw.length > tokenLimit) { overflow = true; raw = ''; } }
    continue;
   }
   if (character === '"') quoted = true;
   else if (character === ':') { valueOf = key; key = undefined; }
   else if (!/\s/.test(character)) { key = undefined; valueOf = undefined; }
  }
 }
 return false;
}

export async function assertNoPencilArchive(path) {
 const status = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
 if (!status) return;
 if (status.isDirectory()) { for (const name of await readdir(path)) await assertNoPencilArchive(join(path, name)); return; }
 if (status.isFile() && await isPencilArchive(path)) throw new Error('Build output contains a Pencil export archive. Move archives to exports/ and build again.');
}

// Runs after Vite copies publicDir and writes each bundle, beside Base's guard.
export function pencilArchiveOutputGuard() {
 let root;
 return {
  name: 'pencil:export-archives', apply: 'build', enforce: 'post',
  configResolved(config) { root = config.root; },
  writeBundle: { order: 'post', async handler(options) {
   if (options.dir) await assertNoPencilArchive(resolve(root, options.dir));
   else if (options.file) await assertNoPencilArchive(resolve(root, options.file));
  } },
 };
}
