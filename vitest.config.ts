import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**', 'tests/runtime/**'],
  },
})
