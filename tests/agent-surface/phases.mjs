import assert from 'node:assert/strict';

/** Fresh real respondent and form records for each conformance policy phase. */
export default async function prepare({ phase, request, origin, cookie }) {
  if (phase === 'initial') return { values: {} };
  const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' };
  const call = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await request(new URL(path, origin).href, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, 'Native phase preparation request was refused');
    return response.status === 204 ? null : response.json();
  };
  const slug = 'triage-' + crypto.randomUUID();
  const form = await call('/api/app/flows', { title: 'Visitor follow-up', slug, template: 'nps' });
  const draft = await call(`/api/app/flows/${form.id}/draft`);
  const published = await call(`/api/app/flows/${form.id}/publish`, { expectedVersion: draft.flow.draftVersion });
  const session = await call(`/api/public/flows/${slug}/sessions`, { source: 'direct', deviceClass: 'desktop' });
  // Respect the production anti-abuse load-time admission; no clock or database adapter.
  await new Promise(resolve => setTimeout(resolve, 3100));
  const receipt = await call(`/api/public/flows/${slug}/responses`, { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: crypto.randomUUID(), answers: [{ stepId: draft.steps[0].id, value: 9 }] });
  assert.equal(receipt.disposition, 'released');
  const operators = await call('/api/app/operators');
  const owner = operators.find(person => person.isSetupOperator);
  assert.ok(owner);
  return { values: { response: { formId: form.id, revisionId: published.revision.id, id: receipt.responseId, ownerId: owner.id } } };
}
