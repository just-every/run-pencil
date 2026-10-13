import { defineConfig } from '@playwright/test'
import ordinary from './playwright.config'

export default defineConfig({ ...ordinary, testDir: './tests/release-browser', workers: 1 })
