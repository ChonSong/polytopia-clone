import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // no webServer — server already running at localhost:3001
});
