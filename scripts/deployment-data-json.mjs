import { hashedLedger } from './deployment-data-ledger.mjs';
import { openSync, closeSync, readSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { failure } from './deployment-data-core.mjs';

// Consume JSON a token at a time. Only one table row is materialized; the caller
// stores rows on disk. UTF-8 characters and escaped strings may cross reads.
export function readArchiveJSON(path, consumeRow, limits) {
  const fd = openSync(path, 'r'), buffer = Buffer.alloc(64 * 1024), decoder = new StringDecoder('utf8');
  let text = '', position = 0, ended = false;
  const invalid = () => { throw failure('INVALID_ARCHIVE', 'Archive format is invalid.'); };
  function peek() {
    if (position === text.length && !ended) {
      const size = readSync(fd, buffer);
      text = size ? decoder.write(buffer.subarray(0, size)) : decoder.end();
      position = 0; ended = size === 0;
      if (!text.length && !ended) return peek();
    }
    return text[position];
  }
  function take() { const character = peek(); if (character !== undefined) position++; return character; }
  function space() { while (/^[ \r\n\t]$/.test(peek() ?? '')) take(); }
  function string() {
    if (take() !== '"') invalid();
    const parts = ['"']; let part = '', escaped = false;
    for (;;) {
      const character = take(); if (character === undefined) invalid();
      part += character;
      if (character === '"' && !escaped) { parts.push(part); return JSON.parse(parts.join('')); }
      escaped = character === '\\' && !escaped;
      if (part.length >= 65536) { parts.push(part); part = ''; }
    }
  }
  function value(path = [], depth = 0) {
    // The archive schema has a fixed depth. This also makes malicious nesting
    // fail predictably instead of overflowing the JavaScript call stack.
    if (depth > 12) invalid();
    space(); const first = peek();
    if (first === '"') return string();
    if (first === '{') {
      take(); const result = Object.create(null); space();
      if (peek() === '}') { take(); return result; }
      for (;;) {
        space(); if (peek() !== '"') invalid(); const key = string();
        if (Object.hasOwn(result, key)) invalid();
        space(); if (take() !== ':') invalid();
        result[key] = value([...path, key], depth + 1); space();
        const separator = take(); if (separator === '}') return result; if (separator !== ',') invalid();
      }
    }
    if (first === '[') {
      take(); const result = []; let index = 0; space();
      const streamed = path.length === 4 && path[0] === 'payload' && path[1] === 'tables' && path[3] === 'rows';
      if (peek() === ']') { take(); return result; }
      for (;;) {
        if (!streamed && limits) {
          let maximum;
          if (path.join('.') === 'payload.migrations' || path.join('.') === 'payload.d1Migrations.rows') maximum = limits.migrations;
          else if (path.join('.') === 'payload.tables') maximum = limits.columns.length;
          else if (path.join('.') === 'payload.d1Migrations.columns' || path.length === 4 && path[1] === 'd1Migrations' && path[2] === 'rows') maximum = hashedLedger.columns.length;
          else if (path.length === 4 && path[1] === 'tables' && path[3] === 'columns' || path.length === 5 && path[1] === 'tables' && path[3] === 'rows') maximum = limits.columns[path[2]];
          if (maximum === undefined || index >= maximum) {
            if (path.includes('d1Migrations')) throw failure('MIGRATION_MISMATCH', 'D1 migration ledger differs from the committed migration history.');
            throw failure('INVENTORY_MISMATCH', 'Archive table/column inventory differs from the committed Pencil schema.');
          }
        }
        const item = value([...path, index], depth + 1);
        if (streamed) consumeRow(path[2], index, item); else result.push(item);
        index++; space(); const separator = take();
        if (separator === ']') return result; if (separator !== ',') invalid();
      }
    }
    let token = '';
    while (peek() !== undefined && !/[\s,\]}]/.test(peek())) token += take();
    if (!/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(token)) invalid();
    return JSON.parse(token);
  }
  try { const result = value(); space(); if (peek() !== undefined) invalid(); return result; }
  finally { closeSync(fd); }
}
