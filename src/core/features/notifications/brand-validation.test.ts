import { afterEach, expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
import { brandMailFixture, now, png } from './brand-mail-fixture'
import { encodeLogo, logoByteLimit } from '../brand'
import { readNotificationBrand } from './brand.server'

const fixtures: ReturnType<typeof brandMailFixture>[] = []
function fixture() { const f = brandMailFixture(); fixtures.push(f); f.workspace(); return f }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); for (const f of fixtures.splice(0)) f.sql.close() })
function stored(f: ReturnType<typeof fixture>, content: string | null, mime: string | null = 'image/png', version: string | null = 'saved-logo') {
  f.sql.prepare('UPDATE workspaces SET brand_logo_base64=?,brand_logo_mime=?,brand_logo_version=? WHERE id=?').run(content, mime, version, 'business')
}
async function refusesInvalidLogo(content: string | null, mime: string | null = 'image/png', version: string | null = 'saved-logo') {
  const f = fixture(), fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  // Deliberately corrupt an owned fixture to exercise defense after a damaged restore.
  if (mime === 'image/svg+xml') f.sql.exec('PRAGMA ignore_check_constraints=ON')
  stored(f, content, mime, version)
  await expect(readNotificationBrand(f.db, 'business')).rejects.toThrow()
  f.response('invalid-logo')
  expect(await f.services.notifications.dispatcher.run(now)).toEqual({ attempted: 1, senderError: null })
  expect(fetch).not.toHaveBeenCalled()
  expect(f.sql.prepare('SELECT failure_reason FROM notification_preferences').get()).toEqual({ failure_reason: 'Notification not sent: business branding could not be read or validated.' })
  expect(f.sql.prepare('SELECT status,attempts FROM notification_deliveries').get()).toEqual({ status: 'failed', attempts: 1 })
  expect(f.sql.prepare('SELECT event FROM notification_attempts ORDER BY rowid').all()).toEqual([{ event: 'started' }, { event: 'preparation-brand-failed' }])
}

contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: unsupported MIME', () =>
  refusesInvalidLogo(encodeLogo(png), 'image/svg+xml'))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: mismatched MIME', () =>
  refusesInvalidLogo(encodeLogo(png), 'image/jpeg'))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: invalid content', () =>
  refusesInvalidLogo(btoa('not an image')))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: invalid base64 alphabet', () =>
  refusesInvalidLogo('*==='))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: base64 whitespace', () =>
  refusesInvalidLogo(`${encodeLogo(png)}\n`))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: base64 padding', () =>
  refusesInvalidLogo('AA=A'))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: noncanonical pad bits', () =>
  refusesInvalidLogo('Zh=='))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: missing bytes', () =>
  refusesInvalidLogo(null))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: empty bytes', () =>
  refusesInvalidLogo(''))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: missing MIME', () =>
  refusesInvalidLogo(encodeLogo(png), null))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: missing version', () =>
  refusesInvalidLogo(encodeLogo(png), undefined, null))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: oversized version', () =>
  refusesInvalidLogo(encodeLogo(png), undefined, 'v'.repeat(129)))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: oversized encoded bytes', () =>
  refusesInvalidLogo('A'.repeat(4 * Math.ceil(logoByteLimit / 3) + 4)))
contract(['BRAND-001','NOTIFY-002'], 'invalid stored logo refuses sending: oversized decoded bytes within encoded ceiling', () =>
  refusesInvalidLogo(encodeLogo(new Uint8Array(logoByteLimit + 1))))

contract(['BRAND-001','NOTIFY-002'], 'encoded size is refused before decoding and the exact byte boundary remains supported', async () => {
  const f = fixture(), decode = vi.spyOn(globalThis, 'atob')
  stored(f, 'A'.repeat(4 * Math.ceil(logoByteLimit / 3) + 4))
  await expect(readNotificationBrand(f.db, 'business')).rejects.toThrow('encoding')
  expect(decode).not.toHaveBeenCalled()
  const maximum = new Uint8Array(logoByteLimit)
  maximum.set(png.subarray(0, png.length - 12))
  maximum.set(png.subarray(png.length - 12), maximum.length - 12)
  await f.services.brand.saveLogo('business', maximum, 'image/png')
  expect((await readNotificationBrand(f.db, 'business')).logo!.content).toEqual(maximum)
  expect(decode).toHaveBeenCalledTimes(1)
})
