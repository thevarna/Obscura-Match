import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  retries: 1,
  fullyParallel: false,  // sequential for deterministic demo flows
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  // Start the Vite dev server automatically
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
