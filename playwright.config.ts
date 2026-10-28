import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './utils/auth';

export default defineConfig({
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./reporters/failure-reporter.ts'],
  ],
  outputDir: './test-results',
  use: {
    baseURL: process.env.BASE_URL || 'https://beta.replyn.dev',
    headless: !!process.env.CI,
    permissions: [],

    // Slow actions down only locally, so you can watch the browser; CI runs at full speed.
    launchOptions: {
      slowMo: process.env.CI ? 0 : 500,
    },

    screenshot: { mode: 'only-on-failure', fullPage: true },
    trace: 'retain-on-failure',
  },
  projects: [
    // Logs in once and saves the session for the regression tests.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
      grepInvert: /@smoke/,
    },
    {
      name: 'smoke',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
