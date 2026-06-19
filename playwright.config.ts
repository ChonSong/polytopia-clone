import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  webServer: {
    command: 'npm run dev',
    port: 3001,
    timeout: 10000,
    reuseExistingServer: !process.env.CI,
  },
});
