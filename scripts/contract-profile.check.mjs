import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateProfile } from './contract-profile.mjs'
import { contractRegistry } from './contract-registry.mjs'
const profile = { schemaVersion: 1, id: 'first-release', authority: 'first-release', deferredFamilies: ['FUTURE'], deferredClauses: ['LATER-002'] }
const ids = ['FUTURE-001', 'FUTURE-002', 'LATER-001', 'LATER-002', 'BASE-ACCESS-001']
test('expands declared families and named clauses while retaining other obligations', () => {
  assert.deepEqual([...evaluateProfile(profile, ids)], ['FUTURE-001', 'FUTURE-002', 'LATER-002'])
  assert.deepEqual([...evaluateProfile(profile, ids, 'full')], [])
})
test('rejects unknown and repeated declarations, baseline waivers, invalid schemas and modes', () => {
  for (const deferredFamilies of [['UNKNOWN'], ['FUTURE', 'FUTURE'], ['BASE'], [null]]) assert.throws(() => evaluateProfile({ ...profile, deferredFamilies }, ids))
  for (const deferredClauses of [['UNKNOWN-001'], ['LATER-002','LATER-002'], ['FUTURE-001'], ['BASE-ACCESS-001'], [null], ['invalid']]) assert.throws(() => evaluateProfile({ ...profile, deferredClauses }, ids))
  for (const change of [{ schemaVersion: 2 }, { id: 'other' }, { authority: '' }, { deferredFamilies: null }, { deferredClauses: {} }, { excludes: [] }]) assert.throws(() => evaluateProfile({ ...profile, ...change }, ids))
  assert.throws(() => evaluateProfile(profile, ids, 'anything'))
})
test('every shipped deferral is declared and has no implementing test', async () => {
  const root = new URL('../', import.meta.url)
  const declared = [...(await readFile(new URL('CONTRACT.md', root),'utf8')).matchAll(/^- \*\*([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{3})/gm)].map(match => match[1])
  const shipped = JSON.parse(await readFile(new URL('contract-profile.json', root), 'utf8'))
  const registry = await contractRegistry(root.pathname)
  for (const id of evaluateProfile(shipped, declared)) {
    assert.ok(declared.includes(id), `${id} must be declared`)
    assert.equal(registry.get(id)?.covered.length ?? 0, 0, `${id} already has an implementing test`)
    assert.ok(registry.get(id)?.todo.length, `${id} must retain its TODO`)
  }
})
test('deployment validation requires a plain no-reply sender without restricting runtime sign-in configuration', async()=>{
  const {validateConfiguration}=await import('./operations-config.mjs')
  const environment={APP_ORIGIN:'https://forms.example.test',SEED_ADMIN_EMAIL:'operator@example.test',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic',SESSION_SECRET:'s'.repeat(32)}
  for(const MAIL_FROM of ['noreply@example.test','no-reply@example.test']) assert.doesNotThrow(()=>validateConfiguration({...environment,MAIL_FROM}))
  for(const MAIL_FROM of ['team@example.test','Name <noreply@example.test>','no-reply@example.test\r\nBcc: other@example.test','noreply@bad&.test']) assert.throws(()=>validateConfiguration({...environment,MAIL_FROM}),/MAIL_FROM/)
})
