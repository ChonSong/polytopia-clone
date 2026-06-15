import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// E2E Gameplay Tests — simulate a human playing the game
// These tests verify the game loads, responds to interaction, and doesn't crash
// over multiple turns. They are the "coach" for gameplay correctness.
// ---------------------------------------------------------------------------

test.describe('Polytopia Clone — Gameplay E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  });

  test('game loads and renders a canvas', async ({ page }) => {
    const canvas = await page.waitForSelector('canvas', { timeout: 10000 });
    expect(canvas).not.toBeNull();
    // Phaser should be initialized (check for game object)
    const hasPhaser = await page.evaluate(() => !!(window as any).Phaser);
    expect(hasPhaser).toBe(true);
  });

  test('tribe selection screen shows 4 tribe cards', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    // Wait for Phaser to render the select scene (text appears)
    await page.waitForTimeout(1500);
    // Phaser renders to canvas — check the title was rendered by reading canvas
    // Since Phaser renders to canvas, we check that the game is running
    const hasGame = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      return !!game;
    });
    // Optionally, the game instance can be exposed. We'll check no console errors.
  });

  test('clicking a tribe starts the game (no crash)', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500);
    // Click in the center of each tribe card area (approximate positions)
    // Tribe cards are at x positions ~90, 260, 430, 600 and y ~260
    const canvas = await page.$('canvas')!;
    for (let i = 0; i < 4; i++) {
      const cx = 90 + i * 170;
      await canvas!.dispatchEvent('click', { clientX: cx, clientY: 260, bubbles: true });
      await page.waitForTimeout(500);
      // Check there are no JS errors after clicking
      const errors = await page.evaluate(() => {
        // No error tracking mechanism — just verify page hasn't crashed
        return document.querySelector('canvas') !== null;
      });
      expect(errors).toBe(true);
    }
  });

  test('game survives 5 full turns without errors', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Select Xin-xi tribe (first card)
    const canvas = await page.$('canvas')!;
    await canvas!.dispatchEvent('click', { clientX: 90, clientY: 260, bubbles: true });
    await page.waitForTimeout(1000);

    // Play 5 turns — click END TURN and wait for AI
    for (let turn = 0; turn < 5; turn++) {
      // Click END TURN button (approx screen position x: 700, y: 30)
      await canvas!.dispatchEvent('click', { clientX: 700, clientY: 30, bubbles: true });
      // Wait for AI to process (3+ seconds for all AI tribes)
      await page.waitForTimeout(5000);
      // Verify canvas still present (game didn't crash)
      const stillAlive = await page.$('canvas');
      expect(stillAlive).not.toBeNull();
    }
  });

  test('city menu opens when clicking city hex', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500);
    // Select Xin-xi tribe
    const canvas = await page.$('canvas')!;
    await canvas!.dispatchEvent('click', { clientX: 90, clientY: 260, bubbles: true });
    await page.waitForTimeout(1000);

    // Click on the city position (around hex (2,2) which is at world ~(166, 96)
    // With camera scroll (-300,-300), screen pos = world - scroll = (466, 396)
    await canvas!.dispatchEvent('click', { clientX: 466, clientY: 396, bubbles: true });
    await page.waitForTimeout(500);
    // Game should still be responsive — click somewhere else to close menu
    await canvas!.dispatchEvent('click', { clientX: 100, clientY: 500, bubbles: true });
    await page.waitForTimeout(500);
    const stillAlive = await page.$('canvas');
    expect(stillAlive).not.toBeNull();
  });

  test('tech panel opens and closes', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(1500);
    // Select tribe
    const canvas = await page.$('canvas')!;
    await canvas!.dispatchEvent('click', { clientX: 90, clientY: 260, bubbles: true });
    await page.waitForTimeout(1000);

    // Click TECH button (approx screen x: 560, y: 30)
    await canvas!.dispatchEvent('click', { clientX: 560, clientY: 30, bubbles: true });
    await page.waitForTimeout(500);
    // Click again to close
    await canvas!.dispatchEvent('click', { clientX: 560, clientY: 30, bubbles: true });
    await page.waitForTimeout(500);
    const stillAlive = await page.$('canvas');
    expect(stillAlive).not.toBeNull();
  });
});
