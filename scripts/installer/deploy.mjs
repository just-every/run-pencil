import { ownerDeploy } from '@runeditrun/rer/deploy';
import { ownerWorkerName, workerSettings } from '@runeditrun/rer/modules/deploy-kit/owner';
import { cloudflare } from '@runeditrun/rer/modules/deploy-kit/provider';

// The published deploy kit reads environment-backed bindings as secrets. Keep
// its planner, resource ownership, upload and health checks as the deploy path.
export function pencilDeploy(lifecycle) {
 const deploy = ownerDeploy('deploy.json', lifecycle);
 return Object.assign(async context => {
  if (context.options.dryRun) {
   const worker = ownerWorkerName('just-every/pencil', context.options.environment ?? 'production');
   context.store.report(`Worker: ${worker}. Address: https://${worker}.<your-workers.dev-subdomain>.workers.dev. Deploy looks up your account's subdomain and sets APP_ORIGIN to that exact address.`);
  }
  const previous = process.env.PENCIL_MAIL_PROVIDER;
  const selected = previous ?? process.env.MAIL_PROVIDER;
  if (selected !== undefined && !['sendgrid', 'resend'].includes(selected)) throw Error('PENCIL_MAIL_PROVIDER must be sendgrid or resend.');
  if (previous !== undefined && process.env.MAIL_PROVIDER !== undefined && previous !== process.env.MAIL_PROVIDER) {
   throw Error('PENCIL_MAIL_PROVIDER and MAIL_PROVIDER disagree. Set one provider consistently.');
  }
  let provider = selected ?? 'sendgrid';
  if (!context.options.dryRun && process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim()) {
   const api = cloudflare({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN });
   const settings = await workerSettings(api, ownerWorkerName('just-every/pencil', context.options.environment ?? 'production'));
   // Released installs used a plain variable. The kit inherits only secrets,
   // so preserve that provider while it inherits the existing opaque API key.
   const inherited = settings?.bindings?.find(binding => binding.name === 'MAIL_PROVIDER' && binding.type === 'plain_text')?.text;
   if (inherited !== undefined) {
    if (!['sendgrid', 'resend'].includes(inherited)) throw Error('The deployed MAIL_PROVIDER is unsupported. Resolve its provider configuration before deploying.');
    if (selected !== undefined && selected !== inherited) throw Error('The selected mail provider differs from the deployed MAIL_PROVIDER. Keep the existing provider: deployment inherits its MAIL_API_KEY and does not rotate it.');
    provider = inherited;
   }
  }
  process.env.PENCIL_MAIL_PROVIDER = provider;
  try { return await deploy(context); }
  finally {
   if (previous === undefined) delete process.env.PENCIL_MAIL_PROVIDER;
   else process.env.PENCIL_MAIL_PROVIDER = previous;
  }
 }, { declaration: deploy.declaration, managesHostedOwner: deploy.managesHostedOwner });
}
