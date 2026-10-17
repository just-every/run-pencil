import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/local', workers: 1, retries: 0, captureGitInfo: { commit: false, diff: false }, projects: [{ name: 'desktop' }, { name: 'mobile' }], use: { launchOptions: { headless: true, args: ['--use-mock-keychain', '--password-store=basic'] }, trace: 'retain-on-failure' } })
