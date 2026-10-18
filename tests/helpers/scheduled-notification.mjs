import assert from 'node:assert/strict';

// The real public form commits its response; only rer's declared cron may send the mail.
export async function scheduledNotification({ request, publicRequest, email }) {
 const call = async (path, data) => {
  const response = await request(path, data === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  assert.ok(response.ok, `${path}: ${response.status}`); return response.json();
 };
 const slug = `scheduled-${Date.now()}`, title = `Scheduled response ${slug}`;
 const flow = await call('/api/app/flows', { title, slug }), path = `/api/app/flows/${flow.id}`;
 for (const step of [{ kind: 'question', questionType: 'short_text', prompt: 'What could improve?', required: true }, { kind: 'completion', questionType: null, prompt: 'Thank you' }]) {
  await call(`${path}/draft/steps`, { expectedVersion: (await call(`${path}/draft`)).flow.draftVersion, step });
 }
 const draft = await call(`${path}/draft`);
 await call(`${path}/publish`, { expectedVersion: draft.flow.draftVersion });
 const publicPost = async (suffix, data) => {
  const response = await publicRequest(`/api/public/flows/${slug}/${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  assert.ok(response.ok, `public ${suffix}: ${response.status}`); return response.json();
 };
 const session = await publicPost('sessions', { deviceClass: 'desktop', source: 'direct' });
 await new Promise(resolve => setTimeout(resolve, 4000));
 const answer = 'Synthetic private response must stay out of mail';
 const receipt = await publicPost('responses', { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: crypto.randomUUID(), answers: [{ stepId: draft.steps[0].id, value: answer }] });
 assert.equal(receipt.disposition, 'released');
 const submittedAt = Date.now(), deadline = submittedAt + 90_000;
 let message, deliveries;
 while (Date.now() < deadline) {
  deliveries = await call(`${path}/notifications`);
  if (deliveries.deliveries.length === 1 && deliveries.deliveries[0].status === 'sent') break;
  await new Promise(resolve => setTimeout(resolve, 1000));
 }
 assert.equal(deliveries.deliveries.length, 1); assert.equal(deliveries.deliveries[0].status, 'sent');
 assert.equal((await call(`${path}/results`)).completedResponses, 1);
 return { flow, slug, responseId: receipt.responseId, submittedAt: new Date(submittedAt).toISOString(), receivedAt: new Date().toISOString(), elapsedMs: Date.now() - submittedAt, deliveries, message };
}
