import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './api/tests',
  use: {
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  workers: 1,
  reporter: [
    ['list'],
    ['json'],
    ['junit', { outputFile: 'results.xml' }],
    ['html', { open: 'always' }]
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ]
});
