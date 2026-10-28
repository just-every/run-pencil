// Disposable conformance only; every write uses a production person door.
export default async function initialize({ request, origin, claim, displayName, fixtures }) {
  const bootstrap = await request(new URL(claim.path, origin).href, {
    method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: claim.token, displayName, returnTo: '/setup' }),
  });
  if (bootstrap.status !== 303) throw new Error('Native signed owner claim failed');
  const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
  const apiKey = crypto.randomUUID();
  const saved = await request(new URL('/api/app/connections/analysis', origin).href, {
    method: 'PUT', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', model: 'synthetic-pencil-study', baseUrl: 'https://api.openai.com/v1', apiKey }),
  });
  if (!saved.ok) throw new Error('Native provider connection setup failed');
  await saved.body?.cancel();
  const contact = await request(new URL('/api/app/distribution/contacts', origin).href, {
    method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Morgan Lee', email: 'synthetic-visitor@example.com', fields: { cohort: 'Recent visitors' } }),
  });
  if (contact.status !== 201) throw new Error('Native audience fixture setup failed');
  const { id } = await contact.json();
  fixtures.set('https://api.openai.com', { keys: [apiKey, id] });
  return bootstrap;
}
