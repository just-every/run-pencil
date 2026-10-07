/// <reference types="node" />
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../audit'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { sqliteD1 } from '../../../../tests/helpers/sqlite-d1'
import { createOperatorAuth } from '../../../base/operator-auth/index.mjs'
import { createPencilPlatform } from '../../platform/runtime'
import { AuthService } from './service'

function platform() {
  return createPencilPlatform('http://localhost', { DB: {} as D1Database, ASSETS: {} as Fetcher, SESSION_SECRET: 'synthetic-unit-session-secret-at-least-32-characters', MAIL_PROVIDER: 'local', PENCIL_LOCAL_DEVELOPMENT: 'true' })
}

function audit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as Pick<AuditService, 'record'>
}

describe('magic-link redemption', () => {
  it('creates exactly one session when concurrent redeemers race the same one-time link', async () => {
    const database = new DatabaseSync(':memory:')
    database.exec(readFileSync('src/base/operator-auth/schema/operator-auth.sql', 'utf8'))
    database.prepare("INSERT INTO oa_operators VALUES ('operator','owner@example.com','Owner','owner','active',1,?)").run(Date.now())
    let token = ''
    const db = sqliteD1(database)
    const auth = createOperatorAuth({ db: db as never,
      config: { origin: 'http://localhost', OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'synthetic-unit-session-key-at-least-32-characters', MAIL_FROM: 'no-reply@example.com', local: true },
      clientIp: () => '127.0.0.1', mailSender: { async send(message) {
        token = new URL(message.text.match(/http[^\s]+/)![0]).searchParams.get('token')!
        return { status: 'development', provider: 'development', providerMessageId: null }
      } },
    })
    const request = new Request('http://localhost/auth/confirm', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost' } })
    await auth.requestMagicLink(request, { email: 'owner@example.com' })
    // SQLite's one connection cannot enter simultaneous BEGINs. Queue each batch
    // as D1 does while both callers perform their preview reads concurrently.
    let tail = Promise.resolve() as Promise<unknown>
    const batch = db.batch.bind(db)
    db.batch = statements => { const next = tail.then(() => batch(statements)); tail = next.catch(() => {}); return next }
    const attempts = await Promise.allSettled([auth.confirmLink(request, { token }), auth.confirmLink(request, { token })])
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter(attempt => attempt.status === 'rejected')).toHaveLength(1)
    expect(database.prepare('SELECT count(*) n FROM oa_sessions').get()!.n).toBe(1)
    expect(database.prepare('SELECT count(*) n FROM oa_tokens WHERE consumed_at IS NOT NULL').get()!.n).toBe(1)
    database.close()
  })
})

describe('operator removal protections', () => {
  it.each([
    ['last-operator'],
    ['setup-protected'],
  ] as const)('does not write an audit success record when removal is rejected as %s', async (result) => {
    const repository = { removeOperator: vi.fn().mockResolvedValue(result) }
    const records = audit()
    const service = new AuthService(repository as never, platform(), records)

    await expect(service.removeOperator({
      workspaceId: '01K4Y1NH8N5DGBZX7HBDV00PEN',
      actorOperatorId: '01K4Y1NH8N5DGBZX7HBDV00PEP',
      targetOperatorId: '01K4Y1NH8N5DGBZX7HBDV00PEQ',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(records.record).not.toHaveBeenCalled()
  })
})

describe('setup operator bootstrap', () => {
  it('does not recreate a removed setup operator after the workspace has been initialized', async () => {
    const repository = { initializeSetupOperator: vi.fn().mockResolvedValue({ kind: 'already-initialized' }) }
    const records = audit()
    const service = new AuthService(repository as never, platform(), records)

    await expect(service.ensureSetupOperator({ workspaceId: '01K4Y1NH8N5DGBZX7HBDV00PEN', email: 'owner@example.com' })).resolves.toBeUndefined()
    expect(repository.initializeSetupOperator).toHaveBeenCalledTimes(1)
    expect(records.record).not.toHaveBeenCalled()
  })
})
