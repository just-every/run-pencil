/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
contract(['DATA-001','BASE-DATA-001','FLOW-015'], 'whole-data CLI export/import/export preserves every actual table, auth mapping, delivery fact and stable graph and refuses unsafe archives', () => {
  const result=execFileSync(process.execPath,['--test','scripts/deployment-data.check.mjs','scripts/distribution-data.check.mjs'],{encoding:'utf8'})
  expect(result).toContain('pass 7')
  expect(result).toContain('fail 0')
}, 30_000)
contract('BASE-OPS-002', 'every applied migration0000 through0009 retains its exact reviewed bytes', () => {
  const approved=JSON.parse(readFileSync('docs/IMMUTABLE-MIGRATIONS.json','utf8')) as Array<{name:string;sha256:string}>
  expect(approved).toHaveLength(10)
  for(const file of approved) expect(createHash('sha256').update(readFileSync(`migrations/core/${file.name}`)).digest('hex'),file.name).toBe(file.sha256)
})
