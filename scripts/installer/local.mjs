import { localInstaller } from '@runeditrun/rer/local-installer';
import { developmentTarget, previewTarget } from '@runeditrun/rer/operator-installer';
import { commandAdapter as createCommandAdapter } from '@runeditrun/rer/adapter';
import { pencilDeploy } from './deploy.mjs';
import { features, product } from './ui/seed.mjs';
import { portability } from '../local/portability.mjs';
import { localOwners, prepare } from '../local/state.mjs';
import { applyPendingMigrations } from '../local/migrations.mjs';

const production = context => {
 if (!Number.isInteger(context.runtimePort) || context.runtimePort < 1) throw Error('The local production runtime requires its internal port.');
 const target = previewTarget(context);
 target[2].env.RER_ORIGIN_KEY = 'APP_ORIGIN';
 return target;
};
export const lifecycle = localInstaller({
 features, node: '22.20.0', tools: ['node', 'pnpm'], prepare, localOwner: localOwners,
 secrets: { file: '.dev.vars', originKey: 'APP_ORIGIN', keepExisting: true,
  values: ({ input, origin }) => ({ APP_ORIGIN: origin, SEED_ADMIN_EMAIL: input.SEED_ADMIN_EMAIL, PENCIL_LOCAL_DEVELOPMENT: 'true', SEED_SAMPLE_DATA: 'false', MAIL_PROVIDER: 'local', MAIL_FROM: 'auth@localhost.test' }) },
 build: ['pnpm', ['run', 'build:app']],
 // `rer demo` migrates its own fresh state folder, never the checkout's .wrangler/state.
 migrate: ({ demo }) => ['pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', demo?.state ?? '.wrangler/state', '--config', 'dist/server/wrangler.json']],
 start: production,
 owner: { existingOwnerViaSignIn: true, returnTo: '/setup' },
 signIn: { emailKey: 'SEED_ADMIN_EMAIL', returnTo: '/setup' },
});
export const { install } = lifecycle;
export const commandAdapter = createCommandAdapter(lifecycle, {
 product: product.name, setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs',
 dev: developmentTarget, preview: production, verify: ['pnpm', ['run', 'verify:app']],
 // rer dev skips setup on an existing install: a pulled source's new migrations are applied before it serves.
 localPrerequisites: applyPendingMigrations,
 deploy: pencilDeploy(lifecycle), portability,
 // Local dev identity: the local-only Worker entry, the build output rer build scans for the dev layer, and the kept
 // local owner-entry test.
 devIdentity: { entry: 'src/server.dev.ts', output: ['dist'] },
 // The run site (run-pencil.com): the approved homepage, /run and /docs, written by rer build --site.
 site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
 localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
 input: { names: { email: 'SEED_ADMIN_EMAIL', name: 'displayName' }, defaults: async () => ({ MAIL_PROVIDER: 'local', MAIL_FROM: 'auth@localhost.test' }) },
});
