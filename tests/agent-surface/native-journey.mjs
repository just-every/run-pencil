import assert from 'node:assert/strict';

export default async function journey({ request, origin, cookie, tool }) {
  const response = await request(new URL('/api/app/flows', origin).href, {
    method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Person prepared follow-up', slug: 'person-' + crypto.randomUUID(), template: 'feedback' }),
  });
  assert.equal(response.status, 201);
  const form = await response.json();
  const events = await tool('pencil.events.list', { limit: 200 });
  const native = events.result?.structuredContent?.events.find(event => event.uri === `pencil://forms/${form.id}`);
  assert.equal(native?.type, 'form.draft-changed');
  assert.equal(native?.actor.kind, 'person');
  assert.ok(native.actor.person.id);

  // The native audit is paginated. Inspect every page independently of Base's
  // target fixture helper, which currently reads only the first 200 rows.
  const rows = [];
  let after = '';
  for (let page = 0; page < 30; page++) {
    const response = await request(new URL('/agents/api/audit' + (after ? '?after=' + encodeURIComponent(after) : ''), origin).href, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const audit = await response.json();
    assert.equal(audit.differs_from_policy, 0);
    rows.push(...audit.rows);
    if (!audit.rows.length) break;
    assert.notEqual(audit.cursor, after);
    after = audit.cursor;
    assert.ok(page < 29, 'Native audit exceeded the bounded conformance pagination');
  }
  const connections = rows.filter(row => row.tool.startsWith('pencil.connections.') && !row.tool.includes('.read_'));
  assert.ok(connections.some(row => row.outcome === 'done'));
  assert.ok(connections.some(row => row.approval?.by.length));
  for (const row of connections) {
    if (row.resource === null) continue; // Invalid input has no resolved target.
    assert.deepEqual(row.resource, { kind: 'connection', id: row.tool.endsWith('_analysis') ? 'analysis' : 'task' });
    assert.equal(row.authority, 'none');
    assert.ok(row.label.includes(' for '));
  }
  const activity = await request(new URL('/api/app/audit?kind=connection.saved&limit=100', origin).href, { headers: { Cookie: cookie } });
  assert.equal(activity.status, 200);
  const nativeAudit = await activity.json();
  assert.ok(nativeAudit.rows.some(row => row.actor?.name.includes('Agent door conformance for ')));
  console.log(`Native connection attribution: ${connections.length} decisions checked across ${rows.length} paginated audit rows; differs_from_policy=0.`);
}
