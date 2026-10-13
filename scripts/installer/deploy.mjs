import { readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { privateDirectory, writePrivateFile } from '@runeditrun/rer/private-files';
import { ownerDeploy } from '@runeditrun/rer/deploy';
import { invalid } from '@runeditrun/rer/errors';

const providers = { sendgrid: 'SENDGRID_API_KEY', resend: 'RESEND_API_KEY' };
const given = (env, name) => typeof env[name] === 'string' && env[name].trim() !== '';

// The deployed mail provider: an explicit MAIL_PROVIDER wins; otherwise the one provider whose key is set;
// with neither (or only MAIL_API_KEY) the declaration's default stays.
export function mailProvider(env, fallback) {
 if (given(env, 'MAIL_PROVIDER')) {
  const provider = env.MAIL_PROVIDER.trim();
  if (!Object.hasOwn(providers, provider)) throw invalid('MAIL_PROVIDER must be sendgrid or resend for a deployment.');
  return provider;
 }
 const configured = Object.keys(providers).filter(name => given(env, providers[name]));
 if (configured.length > 1) throw invalid('Both SENDGRID_API_KEY and RESEND_API_KEY are set. Set MAIL_PROVIDER to sendgrid or resend.');
 return configured[0] ?? fallback;
}

// MAIL_API_KEY when set; otherwise the selected provider's own key variable.
export function mailDeclaration(declaration, env) {
 const provider = mailProvider(env, declaration.vars.MAIL_PROVIDER);
 const environment = given(env, 'MAIL_API_KEY') || !given(env, providers[provider]) ? 'MAIL_API_KEY' : providers[provider];
 return { provider, declaration: { ...declaration, vars: { ...declaration.vars, MAIL_PROVIDER: provider },
  secrets: declaration.secrets.map(item => item.binding === 'MAIL_API_KEY' ? { ...item, environment } : item) } };
}

// Hosted sign-in mail goes through the provider the owner configured; execution and resource custody stay Base-owned.
export const deploy = lifecycle => async context => {
 const { provider, declaration } = mailDeclaration(JSON.parse(await readFile(join(context.root, 'deploy.json'), 'utf8')), process.env);
 context.store.report(`deploy: sign-in mail goes through ${provider}.`);
 const directory = await privateDirectory(context.root, ['.seed', 'installer']);
 const path = join(directory, 'owner-deploy.json');
 await writePrivateFile(path, JSON.stringify(declaration) + '\n');
 try { return await ownerDeploy(relative(context.root, path), lifecycle)(context); }
 finally { await rm(path, { force: true }); }
};
