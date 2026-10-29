import assert from 'node:assert/strict';

export default async function journey({ request, origin, cookie, tool }) {
  const response = await request(new URL('/api/app/flows', origin).href, {
    method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Person prepared follow-up', slug: 'person-' + crypto.randomUUID(), template: 'feedback' }),
  });
  assert.equal(response.status, 201);
  const form = await response.json();
  let native, eventCursor, eventPages = 0, eventCount = 0;
  // The standard phases retain earlier events. Locate this new native effect
  // through the public cursor instead of assuming it belongs to the first page.
  for (; eventPages < 100; eventPages++) {
    const events = await tool('pencil.events.list', { limit: 200, ...(eventCursor ? { after: eventCursor } : {}) });
    const page = events.result?.structuredContent;
    assert.ok(Array.isArray(page?.events), 'Native event page must contain events');
    eventCount += page.events.length;
    native = page.events.find(event => event.uri === `pencil://forms/${form.id}`);
    if (native || page.events.length < 200) break;
    assert.ok(page.cursor, 'A full native event page must have a cursor');
    assert.notEqual(page.cursor, eventCursor, 'Native event pagination must advance');
    eventCursor = page.cursor;
  }
  assert.equal(native?.type, 'form.draft-changed');
  assert.equal(native?.actor.kind, 'person');
  assert.ok(native.actor.person.id);
  console.log(`Native person event attribution: ${eventCount} retained events inspected across ${eventPages + 1} pages.`);

  // Inspect every native audit page independently of Base's target fixture.
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
