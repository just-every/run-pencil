import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { installation } from '../helpers/rer-installation.mjs';

test('real rer setup, one-click sign-in, preserved owner/settings, confirmed reset and complete local archive round trip', { timeout: 600_000 }, async () => {
 const app = await installation(); const email = 'synthetic-rer-owner@example.test';
 const setup = ['setup', '--owner-email', email, '--owner-name', 'Synthetic owner', '--port', String(app.port)];
 let cookie = '';
 // The outbox answers only a request that holds this checkout's key (rer setup writes it); the CLI and harnesses send it in a header.
 const devKey = async () => /^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(app.root, '.rer/local/dev-key.env'), 'utf8').catch(() => ''))?.[1];
 const request = async (path, { keyless, ...options } = {}) => fetch(new URL(path, app.origin), { redirect: 'manual', ...options, headers: { Origin: app.origin, ...(!keyless && await devKey() ? { 'x-rer-dev-key': await devKey() } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
 const post = (path, data) => request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
 try {
  assert.equal((await app.run(setup)).code, 0, 'fresh public setup succeeds');
  await assert.rejects(fetch(app.origin + '/health'), 'setup leaves no server');
  const settings = await readFile(join(app.root, '.dev.vars'));
  assert.equal((await stat(join(app.root, '.dev.vars'))).mode & 0o777, 0o600);
  assert.equal((await app.run(setup)).code, 0, 'rerun keeps its owner');
  assert.equal(Buffer.compare(await readFile(join(app.root, '.dev.vars')), settings), 0, 'private settings bytes stay exact');
  assert.notEqual((await app.run(['setup', '--owner-email', 'synthetic-other@example.test', '--port', String(app.port)])).code, 0);
  assert.equal(Buffer.compare(await readFile(join(app.root, '.dev.vars')), settings), 0, 'private settings bytes stay exact');
  const runtime = app.start(['dev', '--port', String(app.port)]); await app.wait(runtime);
  const confirm = await request('/auth/dev/enter?as=owner');
  assert.equal(confirm.status, 303); cookie = confirm.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.equal((await request('/app')).status, 302);
  assert.equal((await post('/setup', { name: 'Synthetic business', timeZone: 'Australia/Brisbane' })).status, 303);
  const created = await post('/api/app/flows', { title: 'Retained via rer', slug: 'retained-via-rer' }); assert.equal(created.status, 201);
  const flow = await created.json();
  assert.notEqual((await app.run(['reset', '--yes'])).code, 0, 'active runtime blocks reset');
  assert.equal((await request('/api/app/dashboard')).status, 200);
  await app.stop(runtime); await assert.rejects(fetch(app.origin + '/health'));
  await mkdir(join(app.root, 'exports'), { mode: 0o700 });
  await mkdir(join(app.root, '.rer/deploy'), { recursive: true });
  await writeFile(join(app.root, '.rer/deploy/receipt.json'), 'Synthetic deployment receipt');
  assert.equal((await app.run(['export', '--output', 'exports/before.rer'])).code, 0);
  const before = JSON.parse(await readFile(join(app.root, 'exports/before.rer'), 'utf8'));
  assert.equal((await app.run(['reset', '--yes'])).code, 0);
  assert.equal(await readFile(join(app.root, '.rer/deploy/receipt.json'), 'utf8'), 'Synthetic deployment receipt');
  assert.notEqual((await app.run(['import', '--input', 'exports/before.rer'])).code, 0, 'import requires confirmation');
  await writeFile(join(app.root, 'exports/corrupt.rer'), '{"private":"SYNTHETIC-private-archived-answer"}', { mode: 0o600 });
  const refused = await app.run(['import', '--input', 'exports/corrupt.rer', '--yes']);
  assert.notEqual(refused.code, 0); assert.equal(refused.output.includes('SYNTHETIC-private-archived-answer'), false);
  await assert.rejects(stat(join(app.root, '.wrangler/state/v3')), { code: 'ENOENT' }, 'invalid archive creates no destination');
  assert.equal((await app.run(['import', '--input', 'exports/before.rer', '--yes'])).code, 0);
  assert.equal((await app.run(['export', '--output', 'exports/after.rer'])).code, 0);
  const after = JSON.parse(await readFile(join(app.root, 'exports/after.rer'), 'utf8'));
  assert.deepEqual(after.payload, before.payload, 'complete retained payload round trips');
  assert.equal((await app.run(setup)).code, 0, 'restored owner signs in with fresh private settings');
  const restored = app.start(['dev', '--port', String(app.port)]); await app.wait(restored);
  cookie = ''; const signedIn = await request('/auth/dev/enter?as=owner'); cookie = signedIn.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  const flows = await request('/api/app/dashboard'); assert.equal(flows.status, 200); assert.ok((await flows.json()).some(item => item.id === flow.id));
  assert.equal((await request('/__dev/outbox', { keyless: true })).status, 404, 'a forwarded request without the key finds no outbox');
  // Node's fetch rewrites supplied Host. Use actual HTTP ingress for this guard.
  const remoteStatus = await new Promise((resolve, reject) => {
   const probe = httpRequest(app.origin + '/__dev/outbox', { headers: { Host: 'remote.example.test' } }, response => {
    response.resume(); response.once('end', () => resolve(response.statusCode)); response.once('error', reject);
   });
   probe.once('error', reject); probe.setTimeout(10_000, () => probe.destroy(Error('Outbox HTTP probe timed out'))); probe.end();
  });
  // rer's local server answers only its own host: another Host is refused (421) before the app or its outbox sees it.
  assert.equal(remoteStatus, 421);
  await app.stop(restored);
  assert.equal((await app.run(['reset', '--yes'])).code, 0);
  assert.equal((await app.run(setup)).code, 0, 'reset enables fresh empty setup');
  await assert.rejects(fetch(app.origin + '/health'));
  const empty = app.start(['dev', '--port', String(app.port)]); await app.wait(empty);
  cookie = '';
  const emptySignIn = await request('/auth/dev/enter?as=owner');
  assert.equal(emptySignIn.status, 303); cookie = emptySignIn.headers.getSetCookie().map(line => line.split(';')[0]).join('; ');
  assert.equal((await post('/setup', { name: 'Fresh business', timeZone: 'Australia/Brisbane' })).status, 303);
  const emptyFlows = await request('/api/app/dashboard'); assert.equal(emptyFlows.status, 200);
  assert.deepEqual(await emptyFlows.json(), [], 'confirmed reset leaves the fresh installation empty');
  await app.stop(empty); await assert.rejects(fetch(app.origin + '/health'));
  // A Platform-installed local database: export preserves its validated ledger without replaying it through Wrangler.
  const { DatabaseSync } = await import('node:sqlite');
  const { databasePath } = await import('../../scripts/local/state.mjs');
  const { metadata } = await import('../../scripts/deployment-data-core.mjs');
  const { platformLedgerSQL } = await import('../../scripts/deployment-data-ledger.mjs');
  const local = new DatabaseSync(await databasePath(app.root));
  try {
   local.exec(platformLedgerSQL);
   for (const { name, sha256 } of metadata()) local.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').run(name, sha256);
   local.exec('DROP TABLE d1_migrations');
   const ledger = () => local.prepare('SELECT name,sha256,applied_at FROM rer_migrations ORDER BY name').all();
   const native = () => local.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='d1_migrations'").get().n;
   const kept = ledger();
   assert.equal((await app.run(['export', '--output', 'exports/platform.rer'])).code, 0, 'a complete Platform ledger exports');
   assert.deepEqual(ledger(), kept); assert.equal(native(), 0, 'Wrangler created no competing ledger');
   local.exec("UPDATE rer_migrations SET sha256='altered' WHERE name=(SELECT min(name) FROM rer_migrations)");
   assert.notEqual((await app.run(['export', '--output', 'exports/altered.rer'])).code, 0, 'an altered Platform ledger is refused');
   assert.equal(native(), 0);
  } finally { local.close(); }
 } finally { await app.close(); }
});
