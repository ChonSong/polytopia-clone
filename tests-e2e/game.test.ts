import { test, expect } from '@playwright/test';

test('game loads and renders hex grid', async ({ page }) => {
  await page.goto('http://localhost:3001');
  const canvas = await page.waitForSelector('canvas', { timeout: 5000 });
  expect(canvas).not.toBeNull();
  const size = await canvas!.boundingBox();
  expect(size!.width).toBeGreaterThan(0);
  expect(size!.height).toBeGreaterThan(0);
});
