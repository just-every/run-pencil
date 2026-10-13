import { ownerDeploy } from '@runeditrun/rer/deploy';

// The published deploy kit reads environment-backed bindings as secrets. Keep
// its planner, resource ownership, upload and health checks as the deploy path.
export function pencilDeploy(lifecycle) {
 const deploy = ownerDeploy('deploy.json', lifecycle);
 return Object.assign(async context => {
  const previous = process.env.PENCIL_MAIL_PROVIDER;
  const provider = previous ?? process.env.MAIL_PROVIDER ?? 'sendgrid';
  if (!['sendgrid', 'resend'].includes(provider)) throw Error('PENCIL_MAIL_PROVIDER must be sendgrid or resend.');
  if (previous !== undefined && process.env.MAIL_PROVIDER !== undefined && previous !== process.env.MAIL_PROVIDER) {
   throw Error('PENCIL_MAIL_PROVIDER and MAIL_PROVIDER disagree. Set one provider consistently.');
  }
  process.env.PENCIL_MAIL_PROVIDER = provider;
  try { return await deploy(context); }
  finally {
   if (previous === undefined) delete process.env.PENCIL_MAIL_PROVIDER;
   else process.env.PENCIL_MAIL_PROVIDER = previous;
  }
 }, { declaration: deploy.declaration });
}
