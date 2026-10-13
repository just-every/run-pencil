import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrate } from '@runeditrun/rer/internal/modules/deploy-kit/migrations.mjs';
import { metadata, migrations } from './deployment-data-core.mjs';
import { sqliteTransport } from './deployment-data-test-helpers.mjs';

export async function kitDatabase(path) {
  const db = new DatabaseSync(path);
  // Only the provider edge is replaced. The installed deploy kit creates and
  // completes its own permanent ledger, using the committed migration bytes.
  await migrate({ async request(_path, {body}) {
    if (/^SELECT\b/.test(body.sql)) return [{success:true,results:db.prepare(body.sql).all()}];
    db.exec('BEGIN');
    try { db.exec(body.sql); db.exec('COMMIT'); return [{success:true,results:[]}]; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } }, 'local-stand-in', migrations().map((row,index)=>({...row,sha256:metadata()[index].sha256})));
  db.exec('PRAGMA foreign_keys=ON');
  return db;
}
export function providerFetch(db) {
  const transport = sqliteTransport(db);
  const fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.cloudflare.com/client/v4/accounts/')) throw new Error('Unexpected outbound call');
    const result = String(url).endsWith('/time_travel/bookmark') ? {bookmark:await transport.query.bookmark()} : await transport.query(JSON.parse(options.body).batch);
    return Response.json({success:true,result});
  };
  return {...transport, fetch};
}
export const providerEnv = { CLOUDFLARE_ACCOUNT_ID:'0'.repeat(32), CLOUDFLARE_DATABASE_ID:'00000000-0000-0000-0000-000000000000', CLOUDFLARE_API_TOKEN:'synthetic-provider-edge-only' };
export async function application(directory, db) {
  const require = createRequire(import.meta.resolve('wrangler/package.json'));
  const {build} = require('esbuild');
  const output = resolve(directory, 'app.mjs');
  await build({entryPoints:[resolve('src/core/app/worker.ts')], bundle:true, platform:'node', format:'esm', outfile:output, logLevel:'silent', plugins:[{
    name:'vite-raw', setup(build) {
      build.onResolve({filter:/\?raw$/}, args=>({path:resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw'}));
      build.onLoad({filter:/.*/,namespace:'raw'}, args=>({contents:readFileSync(args.path,'utf8'),loader:'text'}));
    },
  }]});
  const worker = (await import(pathToFileURL(output))).default;
  const statements = new WeakMap();
  const execute = (sql, params, raw=false) => {
    const statement = db.prepare(sql); if(raw) statement.setReturnArrays(true);
    const before = db.prepare('SELECT total_changes() n').get().n;
    const results = statement.all(...params);
    return {results,success:true,meta:{changes:db.prepare('SELECT total_changes() n').get().n-before,last_row_id:Number(db.prepare('SELECT last_insert_rowid() n').get().n)}};
  };
  const prepare = (sql, params=[]) => {
    const statement = {bind:(...values)=>prepare(sql,values), first:async column=>{const row=execute(sql,params).results[0]??null;return column?row?.[column]??null:row;}, all:async()=>execute(sql,params), run:async()=>execute(sql,params), raw:async()=>execute(sql,params,true).results};
    statements.set(statement,{sql,params}); return statement;
  };
  const DB = {prepare, async batch(batch) {
    db.exec('BEGIN');try {const result=batch.map(statement=>{const {sql,params}=statements.get(statement);return execute(sql,params);});db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}
  }};
  const origin='https://recovery.example.test';
  const bindings={DB,APP_ORIGIN:origin,SESSION_SECRET:'synthetic-restoration-secret-at-least-32-characters',SETUP_TOKEN:'synthetic-restoration-setup-at-least-32-characters',SEED_ADMIN_EMAIL:'owner@example.test',MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-mail-edge-only',MAIL_FROM:'sender@example.test',PENCIL_LOCAL_DEVELOPMENT:'false',SEED_SAMPLE_DATA:'false'};
  let cookie;
  return {bindings,worker, cookie:()=>cookie, setCookie(value){cookie=value;}, async request(path, body, method=body===undefined?'GET':'POST') {
    const requestOrigin=bindings.APP_ORIGIN;
    const response=await worker.fetch(new Request(requestOrigin+path,{method,headers:{Host:new URL(requestOrigin).host,Origin:requestOrigin,'CF-Connecting-IP':'192.0.2.55','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings,{waitUntil:promise=>promise});
    if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  }};
}
