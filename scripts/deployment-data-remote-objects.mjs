import { getPlatformProxy } from 'wrangler';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failure } from './deployment-data-errors.mjs';

// Wrangler's remote binding proxy preserves R2 customMetadata through the
// binding API. The raw REST upload command cannot express that metadata.
// This opens a temporary preview session, never a persistent deployed Worker.
export async function openRemoteObjects(env = process.env) {
  const bucket = env.CLOUDFLARE_FORM_ASSETS_BUCKET;
  if (!bucket) return;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket)) throw failure('CONFIGURATION_INVALID','CLOUDFLARE_FORM_ASSETS_BUCKET must name the deployment’s existing FORM_ASSETS bucket.');
  if (env.CLOUDFLARE_API_TOKEN !== process.env.CLOUDFLARE_API_TOKEN) throw failure('CONFIGURATION_REQUIRED','Run recovery with CLOUDFLARE_API_TOKEN in the command environment so Wrangler uses the same held authorization as D1.');
  const directory = await mkdtemp(join(tmpdir(),'pencil-remote-assets-'));
  let proxy;
  try {
    const configPath = join(directory,'wrangler.json');
    await writeFile(configPath,JSON.stringify({name:'pencil-recovery-assets',account_id:env.CLOUDFLARE_ACCOUNT_ID,compatibility_date:'2026-09-08',r2_buckets:[{binding:'FORM_ASSETS',bucket_name:bucket,remote:true}]}),{mode:0o600});
    proxy = await getPlatformProxy({configPath,envFiles:[],persist:false,remoteBindings:true});
    return {bucket:proxy.env.FORM_ASSETS,async close(){try{await proxy.dispose();}finally{await rm(directory,{recursive:true});}}};
  } catch (error) {
    try { await proxy?.dispose(); } finally { await rm(directory,{recursive:true}); }
    throw error;
  }
}
