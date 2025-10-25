import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'bash -lc "source ~/.bashrc && bun ../../packages/backend/src/index.ts"',
      port: 3000,
      reuseExistingServer: !!process.env.CI ? false : true,
      timeout: 120_000,
    },
    {
      command: 'bash -lc "source ~/.bashrc && bun run dev"',
      port: 5173,
      reuseExistingServer: !!process.env.CI ? false : true,
      timeout: 120_000,
    },
  ],
});
