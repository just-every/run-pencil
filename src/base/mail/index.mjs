import { validateConfig, validateMessage, validateSendResult } from './src/core/validation.mjs';
import { fail } from './src/core/errors.mjs';
import { sendSendGrid } from './src/adapters/sendgrid/index.mjs';
import { sendResend } from './src/adapters/resend/index.mjs';
import { sendCloudflare } from './src/adapters/cloudflare/index.mjs';
import { sendDevelopment } from './src/development/index.mjs';
import { applyUnsubscribeHeaders } from './src/unsubscribe/index.mjs';

const transports = { sendgrid: sendSendGrid, resend: sendResend, cloudflare: sendCloudflare, development: sendDevelopment };

/** Explicit configuration; a missing/failed provider never selects another path. */
export function createMailSender(config, dependencies = {}) {
  validateConfig(config, dependencies);
  const configured = Object.freeze({ ...config });
  const host = Object.freeze({ ...dependencies });
  const transport = transports[configured.provider];
  return Object.freeze({
    async send(message) {
      validateMessage(message, configured.provider);
      let snapshot;
      try { snapshot = structuredClone(message); } catch { fail('invalid_message'); }
      const prepared = applyUnsubscribeHeaders(snapshot);
      validateMessage(prepared, configured.provider);
      return validateSendResult(await transport(configured, prepared, host), configured.provider);
    },
  });
}

export { MailValidationError } from './src/core/errors.mjs';
export { serializeSendGridMessage } from './src/adapters/sendgrid/index.mjs';
export { verifyWebhook, MAX_WEBHOOK_BYTES, createDeliveryEventIntake } from './src/events/index.mjs';
export { normalizeInbound, createResendAttachmentFetcher } from './src/inbound/index.mjs';
export { mailDoctor } from './src/doctor/index.mjs';
export { applyUnsubscribeHeaders } from './src/unsubscribe/index.mjs';
