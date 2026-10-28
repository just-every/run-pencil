import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let runtime;
async function reportRuntime() {
  if (!runtime) {
    const require = createRequire(import.meta.resolve('vite/package.json'));
    const { build } = require('esbuild');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const bundled = await build({ stdin: { contents: `
      export { Hono } from 'hono';
      export { drizzle } from 'drizzle-orm/d1';
      export { AuditService, AuditRepository } from './src/core/features/audit';
      export { registerSavedReportRoutes } from './src/core/features/reporting/savedRoutes';
    `, resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node' });
    runtime = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  }
  return runtime;
}

// Add D1's single-statement write door to the existing real SQLite transport.
function writable(database) {
  const wrap = statement => ({ ...statement,
    bind(...values) { return wrap(statement.bind(...values)); },
    async run() { return (await database.batch([statement]))[0]; },
  });
  return { ...database, prepare: sql => wrap(database.prepare(sql)) };
}

export async function savedReportCustody(database, actor) {
  const { Hono, drizzle, AuditService, AuditRepository, registerSavedReportRoutes } = await reportRuntime();
  const appFor = transport => {
    const db = writable(transport), app = new Hono();
    app.use('*', async (context, next) => {
      context.set('platform', { databaseBinding: db });
      context.set('operatorSession', { ...actor, displayName: 'Synthetic recovery operator' });
      context.set('services', { audit: new AuditService(new AuditRepository(drizzle(db))) });
      await next();
    });
    app.onError((error, context) => {
      if (error.code === 'NOT_FOUND') return context.json({ error: error.code }, 404);
      throw error;
    });
    registerSavedReportRoutes(app);
    return app;
  };
  const app = appFor(database), flowId = crypto.randomUUID(), revisionId = crypto.randomUUID(), now = new Date().toISOString();
  await database.batch([
    database.prepare('INSERT INTO flows(id,workspace_id,slug,title,status,draft_version,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(flowId, actor.workspaceId, `synthetic-${flowId}`, 'Synthetic retained report', 'open', 1, now, now, now),
    database.prepare('INSERT INTO flow_revisions(id,flow_id,number,state,title,is_current,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(revisionId, flowId, 1, 'published', 'Synthetic retained report', 1, now, now),
  ]);
  const request = (target, path, method = 'GET', body) => target.request(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const create = async (path, body) => {
    const response = await request(app, path, 'POST', body);
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  const views = [];
  for (const name of ['Synthetic first selection', 'Synthetic second selection']) views.push(await create(`/api/app/flows/${flowId}/saved-views`, { name, revisionId, filter: { search: 'synthetic private identity search' } }));
  const dashboard = await create('/api/app/report-dashboards', { name: 'Synthetic retained order', scope: 'form', flowId, viewIds: views.map(item => item.view.id).reverse() });
  const shares = [];
  for (const body of [{}, { password: 'synthetic-private-report-password' }]) shares.push(await create(`/api/app/saved-views/${views[0].view.id}/shares`, body));
  assert.equal((await request(app, `/api/public/reports/${shares[0].token}`)).status, 200);
  const protectedReport = await request(app, `/api/public/reports/${shares[1].token}`, 'POST', { password: 'synthetic-private-report-password' });
  assert.equal(protectedReport.status, 200);
  assert.equal((await protectedReport.text()).includes('synthetic private identity search'), false);
  const shareRows = (await database.prepare('SELECT token_hash,password_verifier FROM saved_report_shares WHERE workspace_id=?').bind(actor.workspaceId).all()).results;
  return {
    secrets: [...shares.map(share => share.token), ...shareRows.flatMap(row => [row.token_hash, row.password_verifier].filter(Boolean)), 'synthetic-private-report-password'],
    async revoke() {
      for (const share of shares) {
        assert.equal((await request(app, `/api/app/report-shares/${share.share.id}`, 'DELETE')).status, 204);
        assert.equal((await request(app, `/api/public/reports/${share.token}`)).status, 404);
      }
    },
    async readback(transport) {
      const restored = appFor(transport);
      for (const expected of views) {
        const response = await request(restored, `/api/app/saved-views/${expected.view.id}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), expected);
      }
      const response = await request(restored, `/api/app/report-dashboards/${dashboard.id}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { dashboard, views: [...views].reverse() });
      for (const share of shares) {
        assert.equal((await request(restored, `/api/public/reports/${share.token}`)).status, 404);
        assert.equal((await request(restored, `/api/public/reports/${share.token}`, 'POST', { password: 'synthetic-private-report-password' })).status, 404);
      }
      assert.equal((await transport.prepare('SELECT count(*) n FROM saved_report_shares').first()).n, 0);
    },
  };
}
