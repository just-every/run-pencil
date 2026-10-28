import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Base's copied node:test fixtures belong to its own checkout. Pencil's
    // production door is exercised by agent-surface.json in normal rer verify.
    exclude: ['src/base/agent-door/tests/**', 'src/base/mail/tests/**', 'src/base/operator-auth/tests/**', 'src/base/operator-auth/oidc/tests/**', 'src/base/operator-auth/conformance/tests/**', 'tests/local-access/**', 'scripts/base-onboarding/**', 'tests/local-cli/**', 'tests/local/**', 'node_modules/**', 'dist/**', 'tests/e2e/**', 'tests/runtime/**', 'tests/release/**', 'tests/admission/**', 'tests/release-browser/**', 'tests/docs/**'],
  },
})
