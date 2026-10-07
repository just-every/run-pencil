import { AuthError } from './errors.mjs';
import { securityHeaders, escapeHtml, requireLoopback } from './http.mjs';
import { readInput, readParameters } from './input.mjs';
function json(value, status = 200) { return Response.json(value, { status, headers: securityHeaders() }); }
function signedIn(value) { return new Response(null, { status: 303, headers: { ...securityHeaders(), 'Set-Cookie': value.cookie, Location: value.returnTo } }); }

/** Fetch-compatible optional HTTP adapter. Returns null for paths it does not own. */
export function createAuthHandler(auth) {
  return async function handleAuth(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/auth/')) return null;
    try {
      if (path === '/auth/review-session') requireLoopback(request);
      if (path === '/auth/confirm' && ['GET', 'HEAD'].includes(request.method)) {
        const token = readParameters(url.searchParams).token ?? null;
        const preview = await auth.previewLink(request, token);
        const html = preview ? `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Confirm sign-in</title><main><h1>Confirm ${preview.kind === 'invite' ? 'invitation' : 'sign-in'}</h1><p>Press Confirm to continue.</p><form method="post" action="/auth/confirm"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Confirm</button></form></main></html>` : '<!doctype html><html lang="en"><title>Link unavailable</title><main><h1>This link is invalid or expired</h1><p>Request another sign-in link.</p></main></html>';
        const headers = { ...securityHeaders(), 'Content-Type': 'text/html; charset=utf-8' };
        // no-referrer makes native form POSTs send Origin: null. Preserve their
        // origin without ever sending the token-bearing path/query as Referer;
        // strict-origin also suppresses Referer on an HTTPS-to-HTTP downgrade.
        if (preview) headers['Referrer-Policy'] = 'strict-origin';
        return new Response(request.method === 'HEAD' ? null : html, { status: preview ? 200 : 400, headers });
      }
      if (path === '/auth/session' && request.method === 'GET') {
        const session = await auth.getSession(request);
        return session ? json(session) : json({ error: 'unauthenticated' }, 401);
      }
      if (path === '/auth/operators' && request.method === 'GET') return json(await auth.listOperators(request));
      if (path === '/auth/sessions' && request.method === 'GET') return json(await auth.listSessions(request, readParameters(url.searchParams).operatorId));
      const posts = new Set(['/auth/bootstrap', '/auth/magic-link', '/auth/confirm', '/auth/signout', '/auth/invite', '/auth/review-session', '/auth/operator/status', '/auth/operator/role', '/auth/session/revoke']);
      if (!posts.has(path)) return json({ error: 'not_found' }, 404);
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      const query = readParameters(url.searchParams);
      // POST credentials belong only in the body. Refuse a second credential
      // source even if a proxy or caller would choose one of the two values.
      if (Object.hasOwn(query, 'token')) throw new AuthError('invalid_input');
      const input = await readInput(request);
      switch (path) {
        case '/auth/bootstrap': return signedIn(await auth.bootstrap(request, input));
        case '/auth/magic-link': return json(await auth.requestMagicLink(request, input), 202);
        case '/auth/confirm': return signedIn(await auth.confirmLink(request, input));
        case '/auth/review-session': return signedIn(await auth.issueReviewSession(request, input));
        case '/auth/invite': return json(await auth.invite(request, input), 202);
        case '/auth/signout': {
          const result = await auth.signOut(request);
          return new Response(null, { status: 204, headers: { ...securityHeaders(), 'Set-Cookie': result.cookie } });
        }
        case '/auth/operator/status': return json(await auth.setOperatorStatus(request, input.operatorId, input.status));
        case '/auth/operator/role': return json(await auth.setRole(request, input.operatorId, input.role));
        case '/auth/session/revoke': await auth.revokeSession(request, input.sessionId); return new Response(null, { status: 204, headers: securityHeaders() });
      }
    } catch (error) {
      if (error instanceof AuthError) return json({ error: error.code }, error.status);
      // Do not put SQL, email addresses, setup tokens or provider exceptions on the wire.
      return json({ error: 'auth_unavailable' }, 503);
    }
  };
}
