// Pencil's rer-signin adapter imports the pinned implementation in place.
// The existing copied auth foundation stays on its original single Base pin.
import { AuthError, securityHeaders } from '@runeditrun/rer/modules/operator-auth';
import { configure } from '@runeditrun/rer/internal/modules/operator-auth/config.mjs';
import { AuthStore } from '@runeditrun/rer/internal/modules/operator-auth/accounts/store.mjs';
import { oaSessions } from '@runeditrun/rer/internal/modules/operator-auth/accounts/oa.mjs';
import { ownerSignIn } from '@runeditrun/rer/internal/modules/operator-auth/accounts/owner-signin.mjs';
import { confirmationResponse } from '@runeditrun/rer/internal/modules/operator-auth/identity/email-link/confirmation.mjs';
import { readInput, readParameters } from '@runeditrun/rer/internal/modules/operator-auth/input.mjs';

export async function ownerSignInResponse(request, db, input) {
  const config = configure(input), clock = Date.now, store = new AuthStore(db);
  const sessions = oaSessions({ config, store, clock });
  // Use the native email-proof limiter's keyed IP and token buckets and limits.
  const limit = async (request, identity, scope) => {
    const ip = config.local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '';
    if (!ip || ip.length > 128) throw new AuthError('client_ip_unavailable', 503);
    const keys = await Promise.all([sessions.hash('rate', `${scope}:ip:${ip}`), sessions.hash('rate', `${scope}:email:${identity}`)]);
    const counts = await store.limits(keys, clock(), config.limitWindowSeconds * 1000);
    if (!Array.isArray(counts) || counts.length !== keys.length || counts.some(value => !Number.isSafeInteger(value) || value < 0)) throw new AuthError('invalid_proof_persistence', 503);
    if (counts[0] > config.ipLimit || counts[1] > config.emailLimit) throw new AuthError('rate_limited', 429);
  };
  const auth = ownerSignIn({ config, store, clock, sessions, limit });
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const token = readParameters(new URL(request.url).searchParams).token ?? null;
      const preview = await auth.previewOwnerSignIn(request, token);
      return await confirmationResponse({ branding: config.branding, preview, token, method: request.method, action: '/auth/owner-signin' });
    }
    if (request.method !== 'POST') throw new AuthError('method_not_allowed', 405);
    const result = await auth.confirmOwnerSignIn(request, await readInput(request));
    return new Response(null, { status: 303, headers: { ...securityHeaders(), 'Set-Cookie': result.cookie, Location: result.returnTo } });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error('Owner sign-in unavailable.');
    return Response.json({ error: error instanceof AuthError ? error.code : 'auth_unavailable' }, { status: error instanceof AuthError ? error.status : 503, headers: securityHeaders() });
  }
}
