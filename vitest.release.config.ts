import { defineConfig } from 'vitest/config'
import worker from './vitest.worker.config'

export default defineConfig({
  ...worker,
  test: {
    ...worker.test,
    include: ['tests/release/**/*.worker.test.ts'],
    reporters: process.env.PENCIL_RELEASE_REPORT ? ['verbose', 'json'] : ['verbose'],
    outputFile: process.env.PENCIL_RELEASE_REPORT,
  },
})
