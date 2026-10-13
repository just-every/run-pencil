import { checkNotificationConfigurationHistory } from '../../../../tests/helpers/notification-preparation-configuration'
import { checkNotificationPreparationHistory } from '../../../../tests/helpers/notification-preparation-history'
import { contract } from '../../../test/contract'
import { afterEach } from 'vitest'
import { brandMailFixture, now } from './brand-mail-fixture'
import { checkNotificationPreparation, checkNotificationErasure } from '../../../../tests/helpers/notification-preparation-contract'

const fixtures: ReturnType<typeof brandMailFixture>[] = []
afterEach(() => { for (const f of fixtures.splice(0)) f.sql.close() })
async function fixture(name: string) {
  const f = brandMailFixture()
  fixtures.push(f)
  f.workspace()
  f.response(name)
  // The shared SQLite fixture predates Base's D1 success metadata check.
  // Its batch resolves only after the real transaction commits; mirror D1 here.
  const db = { ...f.db, async batch<T = unknown>(statements: D1PreparedStatement[]) {
    return (await f.db.batch<T>(statements)).map(result => ({ ...result, success: true }))
  } } as D1Database
  return { db, workspaceId: 'business', flowId: 'business', operatorId: 'business', responseId: name, now,
    erase: () => f.services.responses.eraseReleasedResponse({ workspaceId: 'business', operatorId: 'business', responseId: name }) }
}

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','BASE-SECRET-001'], 'brand retains the safe delivery state and only an explicit retry uses its original key', () => checkNotificationPreparation(fixture, 'brand'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','BASE-SECRET-001'], 'composition retains the safe delivery state and only an explicit retry uses its original key', () => checkNotificationPreparation(fixture, 'composition'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','BASE-SECRET-001'], 'eligibility retains the safe delivery state and only an explicit retry uses its original key', () => checkNotificationPreparation(fixture, 'eligibility'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','BASE-SECRET-001'], 'thrown sender retains the safe delivery state and only an explicit retry uses its original key', () => checkNotificationPreparation(fixture, 'thrown sender'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','BASE-SECRET-001'], 'uncertain sender retains the safe delivery state and only an explicit retry uses its original key', () => checkNotificationPreparation(fixture, 'uncertain sender'))

contract(['NOTIFY-002','DATA-002'], 'erasure during preparation removes the started claim before any sender is entered', () => checkNotificationErasure(fixture))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','DATA-002','BASE-SECRET-001'], 'brand failure after a confirmed resend retains earlier uncertainty until explicit recovery and erasure', () => checkNotificationPreparationHistory(fixture, 'brand'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','DATA-002','BASE-SECRET-001'], 'composition failure after a confirmed resend retains earlier uncertainty until explicit recovery and erasure', () => checkNotificationPreparationHistory(fixture, 'composition'))

contract(['NOTIFY-002','NOTIFY-004','BRAND-001','DIST-010','DATA-002','BASE-SECRET-001'], 'eligibility failure after a confirmed resend retains earlier uncertainty until explicit recovery and erasure', () => checkNotificationPreparationHistory(fixture, 'eligibility'))

contract(['NOTIFY-002','NOTIFY-004','DIST-007','DIST-010','DATA-002'], 'configuration failure after confirmed resend retains uncertainty and requires renewed confirmation after repair', () => checkNotificationConfigurationHistory(fixture))
