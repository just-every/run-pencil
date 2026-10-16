import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scheduledNotification } from '../helpers/scheduled-notification.mjs';
import { installation } from '../helpers/rer-installation.mjs';

test('rer dev opens signed in as the owner, a persona really works as an operator, and no dev surface answers without the key', { timeout: 600_000 }, async () => {
 const app = await installation(); const email = 'synthetic-dev-owner@example.test';
 const cookies = new Map();
 const get = (path, { key, ...init } = {}) => fetch(new URL(path, app.origin), { redirect: 'manual', ...init, headers: { Origin: app.origin, ...(key ? { 'x-rer-dev-key': key } : {}), ...(cookies.size ? { Cookie: [...cookies].map(entry => entry.join('=')).join('; ') } : {}), ...init.headers } });
 const keep = response => { for (const line of response.headers.getSetCookie()) { const [pair] = line.split(';'), [name, ...value] = pair.split('='); if (/Max-Age=0/i.test(line)) cookies.delete(name); else cookies.set(name, value.join('=')); } return response; };
 try {
  assert.equal((await app.run(['setup', '--owner-email', email, '--owner-name', 'Synthetic owner', '--port', String(app.port)])).code, 0);
  const runtime = app.start(['dev', '--port', String(app.port)]); await app.wait(runtime);
  assert.ok(runtime.output().includes(`RER_SIGNED_IN ${email}`), 'dev says whom the browser will hold');
  const open = new URL(runtime.output().split('\n').find(line => line.startsWith('RER_OPEN ')).slice('RER_OPEN '.length));
  assert.equal(open.origin, app.origin);
  const identity = new URLSearchParams(open.hash.slice(1));
  assert.equal(identity.get('as'), 'owner');
  const key = /^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(app.root, '.rer/local/dev-key.env'), 'utf8'))[1];
  assert.ok(identity.get('rer-dev') === key, 'dev entry carries this installation key');
  // A request that reaches the app without the key (a tunnel or a local proxy) finds nothing.
  for (const path of ['/__dev/outbox', '/__dev/personas', '/auth/dev/enter?as=owner', '/auth/dev/enter?as=operator']) assert.equal((await get(path)).status, 404, path);
  assert.equal((await get('/__dev/outbox', { key: key.replace(/.$/, key.endsWith('A') ? 'B' : 'A') })).status, 404, 'a wrong key opens nothing');
  // The owner rer setup claimed lands on first-run setup, finishes it, and works.
  assert.equal(keep(await get('/auth/dev/enter?as=owner', { key })).status, 303);
  assert.equal((await get('/app')).headers.get('location'), new URL('/setup', app.origin).href);
  assert.equal((await get('/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Synthetic business', timeZone: 'Australia/Brisbane' }) })).status, 303);
  assert.equal((await get('/api/app/workspace')).status, 200);
  await scheduledNotification({ request: (path, options) => get(path, { ...options, key }), publicRequest: (path, options) => fetch(new URL(path, app.origin), { ...options, headers: { Origin: app.origin, ...options.headers } }), email });
  // The delivery commits inside the scheduled run; rer reports the run once it has answered.
  for (const deadline = Date.now() + 60_000; !/RER_SCHEDULED .* ok /.test(runtime.output()) && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 500));
  assert.match(runtime.output(), /RER_SCHEDULED .* ok /);
  // The persona is an invited colleague: its own operator, listed beside the owner, never the protected setup operator.
  assert.equal(keep(await get('/auth/dev/enter?as=operator', { key })).status, 303);
  assert.equal((await get('/api/app/workspace')).status, 200);
  const operators = await (await get('/api/app/operators')).json();
  assert.deepEqual(operators.map(operator => operator.email).sort(), ['operator@dev.localhost', email]);
  // Signing out ends the dev session; the same cookie no longer reaches an operator page.
  // Base names each local checkout's session cookie by its port.
  const sessionCookie = `operator_session_local_${new URL(app.origin).port}`;
  const session = cookies.get(sessionCookie);
  assert.equal(keep(await get('/auth/dev/enter?as=signed-out', { key })).status, 303);
  assert.equal((await get('/api/app/workspace')).status, 401);
  cookies.set(sessionCookie, session);
  assert.equal((await get('/api/app/workspace')).status, 401, 'the revoked dev session stays revoked');
  await app.stop(runtime);
 } finally { await app.close(); }
});
