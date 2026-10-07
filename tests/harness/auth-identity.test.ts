import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Worker } from 'node:worker_threads'
import { afterEach, expect, test, vi } from 'vitest'
import { operatorEmail } from '../e2e/auth-identity'

vi.mock('@playwright/test', () => ({
  test: { info: () => ({ testId: 'sqlite-contention', project: { name: 'desktop' }, retry: 0 }) },
}))

const originalState = process.env.PENCIL_MIGRATION_STATE
const directories: string[] = []
afterEach(() => {
  if (originalState === undefined) delete process.env.PENCIL_MIGRATION_STATE
  else process.env.PENCIL_MIGRATION_STATE = originalState
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function identityDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'pencil-identity-lock-'))
  directories.push(directory)
  process.env.PENCIL_MIGRATION_STATE = directory
  const filename = join(directory, 'journey.sqlite')
  const db = new DatabaseSync(filename)
  db.exec(`
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, created_at TEXT);
    CREATE TABLE operators (id TEXT PRIMARY KEY, workspace_id TEXT, email TEXT UNIQUE, display_name TEXT,
      is_setup_operator INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO workspaces VALUES ('workspace', 'Existing business', '2026-10-07');
    INSERT INTO operators VALUES ('owner', 'workspace', 'owner@example.test', 'Existing owner', 1, '2026-10-07', '2026-10-07');
  `)
  db.close()
  return filename
}

async function lockedWriter(filename: string, holdMilliseconds: number) {
  const writer = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData.filename);
    db.exec('BEGIN IMMEDIATE');
    parentPort.postMessage('locked');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, workerData.holdMilliseconds);
    db.exec('COMMIT');
    db.close();
  `, { eval: true, workerData: { filename, holdMilliseconds } })
  await new Promise<void>((resolve, reject) => {
    writer.once('message', () => resolve())
    writer.once('error', reject)
  })
  return writer
}

test('synthetic operator setup waits for a live SQLite writer and preserves existing identities', async () => {
  const filename = identityDatabase()
  const writer = await lockedWriter(filename, 200)
  try {
    const email = operatorEmail()
    expect(operatorEmail()).toBe(email)
    const db = new DatabaseSync(filename)
    try {
      expect(db.prepare('SELECT email, is_setup_operator FROM operators ORDER BY is_setup_operator DESC').all()).toEqual([
        { email: 'owner@example.test', is_setup_operator: 1 },
        { email, is_setup_operator: 0 },
      ])
    } finally { db.close() }
  } finally { await writer.terminate() }
})

test('synthetic operator setup still fails when a SQLite writer does not release its lock', async () => {
  const filename = identityDatabase()
  const writer = await lockedWriter(filename, 10_000)
  try {
    expect(() => operatorEmail()).toThrow('database is locked')
    const db = new DatabaseSync(filename)
    try { expect(db.prepare('SELECT count(*) AS count FROM operators').get()).toEqual({ count: 1 }) }
    finally { db.close() }
  } finally { await writer.terminate() }
})
