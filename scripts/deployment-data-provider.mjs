import { Buffer } from 'node:buffer';
import { failure } from './deployment-data-errors.mjs';

// D1 documents 100 bindings and 100,000 SQL bytes per statement. Keep result
// pages and write batches small; the REST API has a 30-second whole-call limit.
export const queryLimits = { sqlBytes: 100_000, bindings: 100, statements: 16, pageRows: 512, pageBytes: 256 * 1024 };
export function assertQueryBudget(batch) {
  for (const statement of batch) if (Buffer.byteLength(statement.sql) > queryLimits.sqlBytes || (statement.params?.length ?? 0) > queryLimits.bindings) throw failure('QUERY_BUDGET', 'Generated SQL exceeds the documented D1 statement budget.');
}
export function cloudflareClient(env = process.env, fetcher = globalThis.fetch) {
  for (const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_DATABASE_ID','CLOUDFLARE_API_TOKEN']) if (typeof env[name] !== 'string' || !env[name].trim()) throw failure('CONFIGURATION_REQUIRED', `${name} is required for deployed data operations.`);
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID) || !/^[a-f0-9-]{36}$/i.test(env.CLOUDFLARE_DATABASE_ID)) throw failure('CONFIGURATION_INVALID', 'Cloudflare account or database identifier is invalid.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_DATABASE_ID}`;
  let nextRequestAt = 0;
  async function request(path, body) {
    // Stay below the account API limit of 1,200 requests per five minutes.
    const delay = nextRequestAt - Date.now();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + 300;
    let response, parsed;
    try {
      response = await fetcher(base + path, { method: body ? 'POST' : 'GET', redirect: 'error', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
      parsed = await response.json();
    } catch { throw failure('PROVIDER_UNCONFIRMED', 'Cloudflare request could not be confirmed. Keep the target stopped and inspect its restore state before retrying.'); }
    if (response.status >= 500) throw failure('PROVIDER_UNCONFIRMED', 'Cloudflare could not confirm the operation outcome. Keep the target stopped and inspect its restore state.');
    if (!response.ok || parsed.success !== true) throw failure('PROVIDER_FAILURE', 'Cloudflare did not confirm the D1 operation. Keep the target stopped and inspect its restore state.');
    return parsed.result;
  }
  const query = async batch => {
    assertQueryBudget(batch);
    const result = await request('/query', { batch });
    if (!Array.isArray(result) || result.length !== batch.length || result.some(row => row.success !== true || !Array.isArray(row.results))) throw failure('PROVIDER_UNCONFIRMED', 'Cloudflare returned an invalid D1 batch result; the operation outcome is unconfirmed.');
    return result;
  };
  query.bookmark = async () => {
    const result = await request('/time_travel/bookmark');
    if (typeof result?.bookmark !== 'string' || !result.bookmark) throw failure('PROVIDER_FAILURE', 'Cloudflare returned an invalid consistency bookmark.');
    return result.bookmark;
  };
  return query;
}
export async function primaryQuery(query, batch) {
  assertQueryBudget(batch);
  const result = await query(batch);
  if (result.some(row => row.meta?.served_by_primary !== true)) throw failure('CONSISTENCY_UNCONFIRMED', 'D1 did not confirm primary reads; no archive was published.');
  return result;
}
