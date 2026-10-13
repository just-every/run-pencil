// A synthetic checkout key for suites that run the local Worker without `rer`: the outbox answers only a request that
// presents it (the same gate `rer dev` closes with the real per-checkout key). Never a secret.
export const testDevKey = 'synthetic-test-dev-key-for-the-local-outbox-gate-0123456789'
export const devKeyHeaders = { 'x-rer-dev-key': testDevKey }
