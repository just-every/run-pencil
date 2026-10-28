// Disposable conformance only; every write uses a production person door.
export default async function initialize({ request, origin, claim, displayName }) {
  const bootstrap = await request(new URL(claim.path, origin).href, {
    method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: claim.token, displayName, returnTo: '/setup' }),
  });
  if (bootstrap.status !== 303) throw new Error('Native signed owner claim failed');
  const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
  const saved = await request(new URL('/api/app/connections/analysis', origin).href, {
    method: 'PUT', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', model: 'synthetic-pencil-study', baseUrl: 'https://api.openai.com/v1', apiKey: 'synthetic-pencil-provider-key' }),
  });
  if (!saved.ok) throw new Error('Native provider connection setup failed');
  await saved.body?.cancel();
  return bootstrap;
}
