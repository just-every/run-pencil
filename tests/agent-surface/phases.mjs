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
  const text = 'Clearer arrival instructions would improve the visit.';
  const receipt = await call(`/api/public/flows/${slug}/responses`, { sessionId: session.sessionId, sessionToken: session.sessionToken, loadTime: session.loadTime, idempotencyKey: crypto.randomUUID(), answers: [{ stepId: draft.steps[0].id, value: 9 }, { stepId: draft.steps[1].id, value: text }] });
  assert.equal(receipt.disposition, 'released');
  await call('/api/app/analysis/policies', { autorunEnabled: false, autorunMinimum: 5, disclosureThreshold: 1, selection: 'highest-impact' }, 'PUT');
  const analysis = await call('/api/app/analysis', { flowId: form.id, revisionId: published.revision.id, questionIds: [draft.steps[1].id] });
  assert.equal(analysis.state, 'completed');
  const finding = analysis.themes.find(theme => !theme.withheld && theme.quotes.length);
  assert.ok(finding);
  const operators = await call('/api/app/operators');
  const owner = operators.find(person => person.isSetupOperator);
  assert.ok(owner);
  const trendFrom = new Date().toISOString().slice(0, 10), trendTo = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { values: { response: { formId: form.id, revisionId: published.revision.id, id: receipt.responseId, questionId: draft.steps[1].id, textQuestionId: draft.steps[1].id, scoreQuestionId: draft.steps[0].id, codeLabel: 'arrival-' + crypto.randomUUID(), otherCodeLabel: 'service-' + crypto.randomUUID(), templateSlug: 'team-' + crypto.randomUUID(), scoreDimension: 'question:' + draft.steps[0].id, trendFrom, trendTo, text, analysisId: analysis.id, findingId: finding.id, quoteId: finding.quotes[0].id, ownerId: owner.id, embeddingOrigin: `https://${crypto.randomUUID()}.example.invalid`, contactEmail: `visitor-${crypto.randomUUID()}@example.invalid` } } };
}
