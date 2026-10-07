import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateProfile } from './contract-profile.mjs'
const profile = { schemaVersion: 1, id: 'first-release', authority: 'first-release', deferredFamilies: ['AUD', 'ANLY', 'ACT', 'NOTIFY'] }
const ids = ['AUD-001', 'ANLY-001', 'ACT-001', 'NOTIFY-001', 'DIST-003', 'RESP-008', 'WS-002', 'DATA-001', 'BASE-ACCESS-001']
test('defers exactly the four authorized families and keeps cross-family obligations active', () => {
  assert.deepEqual([...evaluateProfile(profile, ids)], ids.slice(0, 4))
  assert.deepEqual([...evaluateProfile(profile, ids, 'full')], [])
})
test('rejects extra, missing, repeated families, hidden exclusions and unknown modes', () => {
  for (const deferredFamilies of [['AUD'], [...profile.deferredFamilies, 'DIST'], [...profile.deferredFamilies, 'AUD']]) {
    assert.throws(() => evaluateProfile({ ...profile, deferredFamilies }, ids))
  }
  assert.throws(() => evaluateProfile({ ...profile, excludes: ['BASE-ACCESS-001'] }, ids))
  assert.throws(() => evaluateProfile(profile, ids, 'anything'))
})
