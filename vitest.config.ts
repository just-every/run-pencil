import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    exclude: ['src/base/mail/tests/**', 'src/base/operator-auth/tests/**', 'src/base/operator-auth/oidc/tests/**', 'src/base/operator-auth/conformance/tests/**', 'tests/local-access/**', 'scripts/base-onboarding/**', 'tests/local-cli/**', 'tests/local/**', 'node_modules/**', 'dist/**', 'tests/e2e/**', 'tests/runtime/**', 'tests/release/**', 'tests/admission/**', 'tests/release-browser/**', 'tests/docs/**'],
  },
})
