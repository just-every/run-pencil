import { checkNotificationConfigurationHistory } from '../helpers/notification-preparation-configuration'
import { checkNotificationPreparationHistory } from '../helpers/notification-preparation-history'
import { contract } from '../../src/test/contract'
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'
import { afterEach, beforeAll } from 'vitest'
import { notificationFixture } from './notifications-fixture'
import { clearOwnedNotificationWork, ownNotificationFixture } from './notification-test-scope'
import { checkNotificationPreparation, checkNotificationErasure } from '../helpers/notification-preparation-contract'

declare const __PENCIL_CORE_MIGRATIONS__: D1Migration[]
beforeAll(() => applyD1Migrations(env.DB, __PENCIL_CORE_MIGRATIONS__))
afterEach(clearOwnedNotificationWork)
async function fixture(name: string) {
  const f = ownNotificationFixture(await notificationFixture(`notification-${name}`)), submitted = await f.submit()
  return { db: env.DB, workspaceId: f.scope.workspaceId, flowId: f.flow.flowId, operatorId: f.operatorId, responseId: submitted.response.id, now: new Date().toISOString(),
    erase: () => f.services.responses.eraseReleasedResponse({ ...f.scope, operatorId: f.operatorId, responseId: submitted.response.id }) }
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
