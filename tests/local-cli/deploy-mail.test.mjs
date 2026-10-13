import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mailDeclaration } from '../../scripts/installer/deploy.mjs';

const declaration = JSON.parse(await readFile(new URL('../../deploy.json', import.meta.url), 'utf8'));
const planned = env => { const result = mailDeclaration(declaration, env); return [result.declaration.vars.MAIL_PROVIDER, result.declaration.secrets.find(item => item.binding === 'MAIL_API_KEY').environment]; };

test('a deployment sends sign-in mail through the provider the owner configured', () => {
 assert.deepEqual(planned({ SENDGRID_API_KEY: 'k' }), ['sendgrid', 'SENDGRID_API_KEY']);
 assert.deepEqual(planned({ RESEND_API_KEY: 'k' }), ['resend', 'RESEND_API_KEY']);
 assert.deepEqual(planned({ MAIL_PROVIDER: 'sendgrid', MAIL_API_KEY: 'k' }), ['sendgrid', 'MAIL_API_KEY']);
 assert.deepEqual(planned({ MAIL_PROVIDER: 'resend', SENDGRID_API_KEY: 'k', MAIL_API_KEY: 'k' }), ['resend', 'MAIL_API_KEY'], 'an explicit provider wins');
 assert.deepEqual(planned({ MAIL_API_KEY: 'k' }), ['resend', 'MAIL_API_KEY']);
 assert.throws(() => planned({ SENDGRID_API_KEY: 'k', RESEND_API_KEY: 'k' }), /MAIL_PROVIDER/);
 assert.throws(() => planned({ MAIL_PROVIDER: 'local' }), /sendgrid or resend/);
});
