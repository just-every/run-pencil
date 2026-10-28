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
}
