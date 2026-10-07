import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect } from 'vitest'
import { contract } from '../../src/test/contract'
contract(['OPER-003','BASE-SECRET-001'], 'explicit setup finds or creates exactly one named D1, preserves existing target configuration and never writes secret values', () => {
  const directory=mkdtempSync(join(tmpdir(),'pencil-setup-check-'))
  try {
    mkdirSync(join(directory,'deploy')); mkdirSync(join(directory,'bin'))
    copyFileSync('deploy/wrangler.template.toml',join(directory,'deploy/wrangler.template.toml'))
    // Test-only provider executable; setup itself uses its normal subprocess and filesystem.
    writeFileSync(join(directory,'bin/pnpm'),`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync('calls.jsonl',JSON.stringify(args)+'\\n');if(args[3]==='list'){console.log(fs.existsSync('provider.json')?fs.readFileSync('provider.json','utf8'):'[]')}else if(args[3]==='create'){fs.writeFileSync('provider.json',JSON.stringify([{name:args[4],uuid:'11111111-2222-3333-4444-555555555555'}]))}else process.exit(9)`,{mode:0o700})
    const env={...process.env,PATH:`${directory}/bin:${process.env.PATH}`,PENCIL_WORKER_NAME:'pencil-synthetic-proof',PENCIL_DATABASE_NAME:'pencil-synthetic-proof-db',PENCIL_WRANGLER_CONFIG:'deploy/synthetic-proof.toml',APP_ORIGIN:'https://pencil-synthetic-proof.example.test',PENCIL_BUILD_ID:'synthetic',SEED_ADMIN_EMAIL:'synthetic@example.test',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'no-reply@example.test',MAIL_API_KEY:'synthetic-mail-key-do-not-write',SESSION_SECRET:'synthetic-session-secret-with-32-characters',SETUP_TOKEN:'synthetic-setup-secret-with-32-characters'}
    const run=(extra={})=>spawnSync(process.execPath,[resolve('scripts/setup.mjs'),'--remote'],{cwd:directory,env:{...env,...extra},encoding:'utf8'})
    expect(run().status).toBe(0)
    const path=join(directory,'deploy/synthetic-proof.toml'), first=readFileSync(path,'utf8')
    expect(first).toContain('workers_dev = true'); expect(first).toContain('database_id = "11111111-2222-3333-4444-555555555555"')
    for(const secret of [env.MAIL_API_KEY,env.SESSION_SECRET,env.SETUP_TOKEN]) expect(first).not.toContain(secret)
    expect(run().status).toBe(0); expect(readFileSync(path,'utf8')).toBe(first)
    const calls=readFileSync(join(directory,'calls.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line))
    expect(calls).toEqual([['exec','wrangler','d1','list','--json'],['exec','wrangler','d1','create','pencil-synthetic-proof-db'],['exec','wrangler','d1','list','--json'],['exec','wrangler','d1','list','--json']])
    expect(run({PENCIL_BUILD_ID:'changed-owner-value'}).status).toBe(1); expect(readFileSync(path,'utf8')).toBe(first)
    expect(run({PENCIL_WORKER_NAME:'../unsafe'}).status).toBe(1); expect(readFileSync(path,'utf8')).toBe(first)
  } finally {rmSync(directory,{recursive:true,force:true})}
})
