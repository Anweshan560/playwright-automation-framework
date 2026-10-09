import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  outputDir: './test-results',
  use: {
    headless: false,

    launchOptions: {
      slowMo: 500,
    },

    screenshot: { mode: 'only-on-failure', fullPage: true },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@smoke/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: /@smoke/,
    },
    {
      name: 'smoke',
      grep: /@smoke/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],


});
