import { test, expect, Page } from '@playwright/test';

/**
 * Human-like interaction contract:
 *
 * Every interaction goes through the Phaser canvas at real pixel positions,
 * exactly as a player clicking in the browser would. We NEVER:
 *   - Call gs.handleClick() directly (bypasses UI)
 *   - Teleport between scenes via game.scene.start()
 *   - Set game state variables directly
 *
 * The only page.evaluate calls are READs — verifying what changed after
 * a canvas click.  The game is always played at hex.codeovertcp.com's
 * deployed resolution (game config: 800×600, Phaser.Scale.FIT).
 */

const GAME_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Wait for Phaser to boot and the canvas to render. */
async function loadGame(page: Page) {
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  // Allow BootScene → SelectScene transition
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => !!(window as any).__PHASER_GAME__);
  expect(ok).toBe(true);
}

/**
 * Convert a game-space coordinate (Phaser 800×600 space) into a
 * viewport-relative pixel position for Playwright's canvas click.
 *
 * Phaser.Scale.FIT + CENTER_BOTH means the canvas element may be
 * displayed at a different resolution than 800×600.  We divide by the
 * actual-to-nominal ratio so the pixel we click maps to the correct
 * game coordinate through Phaser's built-in pointer → game-coord
 * pipeline.
 */
async function g(page: Page, gameX: number, gameY: number) {
  return page.evaluate(
    ({ gx, gy }) => {
      const c = document.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: gx * (r.width / 800), y: gy * (r.height / 600) };
    },
    { gx: gameX, gy: gameY },
  );
}

/** Click the Phaser canvas at game-space (gx, gy) using page-level mouse clicks. */
async function click(page: Page, gameX: number, gameY: number) {
  const { x, y } = await g(page, gameX, gameY);
  // Use page.mouse.click to ensure native pointer events reach Phaser's input pipeline.
  // We convert canvas-relative → page-absolute so the click lands in the right spot.
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + x, box!.y + y);
}

/** Pick the first tribe card that is within the visible viewport (not off-screen). */
async function pickVisibleCard(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
    if (!ss) return { x: 30, y: 260 }; // fallback — Xin-xi position
    const rects = ss.children.list.filter(
      (c: any) =>
        c.type === 'Rectangle' &&
        c.input?.enabled &&
        c.x >= 0 &&
        c.x <= 800,
    );
    // Pick a middle card for reliability
    const idx = Math.min(Math.floor(rects.length / 2), rects.length - 1);
    return { x: rects[idx].x, y: rects[idx].y };
  });
}

/** Evaluate game code that throws but returns a fallback. */
async function evalGame<T>(page: Page, fn: string): Promise<T | null> {
  try {
    return await page.evaluate(fn);
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────

test.describe('Human-like Gameplay (every interaction through canvas)', () => {

  test('game loads and Phaser canvas is rendered', async ({ page }) => {
    await loadGame(page);
    // Confirm the canvas has content (not a blank page)
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    const booted = await page.evaluate(() => {
      const g = (window as any).__PHASER_GAME__;
      return g?.isRunning ?? false;
    });
    expect(booted).toBe(true);
  });

  test('select tribe through the card UI', async ({ page }) => {
    await loadGame(page);

    // Pick a visible tribe card through the canvas UI
    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    const onGame = await evalGame<boolean>(
      page,
      `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
    );
    expect(onGame).toBe(true);

    const tribeName = await evalGame<string>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.state?.getCurrentTribe()?.name) ?? null`,
    );
    expect(tribeName).not.toBeNull();
  });

  test('END TURN advances the game and AI plays back', async ({ page }) => {
    await loadGame(page);

    // Pick a visible tribe card through the canvas UI
    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    const turn0 = await evalGame<number>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
    );
    expect(turn0).toBeGreaterThanOrEqual(1);

    // --- Turn 1: click END TURN at (660, 10) ---
    await click(page, 660, 10);
    await page.waitForTimeout(6000); // AI tribes take turns

    const alive1 = await evalGame<boolean>(
      page,
      `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
    );
    expect(alive1).toBe(true);

    const turn1 = await evalGame<number>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
    );
    expect(turn1).toBeGreaterThanOrEqual(turn0 + 1);

    // --- Turn 2: click END TURN again ---
    await click(page, 660, 10);
    await page.waitForTimeout(6000);

    const alive2 = await evalGame<boolean>(
      page,
      `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
    );
    expect(alive2).toBe(true);

    const turn2 = await evalGame<number>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
    );
    expect(turn2).toBeGreaterThanOrEqual(turn1 + 1);
  });

  test('city tile opens and closes the city menu', async ({ page }) => {
    await loadGame(page);

    // Pick a visible tribe card through the canvas UI
    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    // Find the human player's capital city screen position
    const cityScreenPos = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__?.scene?.getScene('GameScene');
      if (!gs?.state) return null;
      const tribe = gs.state.getCurrentTribe();
      if (!tribe?.cities?.length) return null;
      const city = tribe.cities[0];
      // Pixel position of the hex centre in world space
      const wp = city.position.toPixel(32);
      // Convert to screen space (the viewport the camera sees)
      return {
        x: wp.x - gs.cameras.main.scrollX,
        y: wp.y - gs.cameras.main.scrollY,
      };
    });
    expect(cityScreenPos).not.toBeNull();
    // City should be visible in the initial viewport (0..800 × 0..600)
    expect(cityScreenPos!.x).toBeGreaterThanOrEqual(0);
    expect(cityScreenPos!.x).toBeLessThanOrEqual(800);
    expect(cityScreenPos!.y).toBeGreaterThanOrEqual(0);
    expect(cityScreenPos!.y).toBeLessThanOrEqual(600);

    // Click the city hex through the canvas
    await click(page, cityScreenPos!.x, cityScreenPos!.y);
    await page.waitForTimeout(500);

    // Verify city menu opened
    const menuOpen = await evalGame<boolean>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu) !== null`,
    );
    expect(menuOpen).toBe(true);

    // Click empty space (centered game coords, but avoid UI buttons)
    // The city menu should close when clicking elsewhere on the map
    await click(page, 400, 350);
    await page.waitForTimeout(400);

    const menuClosed = await evalGame<boolean>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu) === null`,
    );
    expect(menuClosed).toBe(true);
  });

  test('tech panel opens and closes via canvas button', async ({ page }) => {
    await loadGame(page);

    // Pick a visible tribe card through the canvas UI
    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    // TECH button at game coords (530, 10), scrollFactor(0), depth 20
    await click(page, 530, 10);
    await page.waitForTimeout(600);

    const panelOpen = await evalGame<boolean>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel) !== null`,
    );
    expect(panelOpen).toBe(true);

    // Click the same button again to close
    await click(page, 530, 10);
    await page.waitForTimeout(400);

    const panelClosed = await evalGame<boolean>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel) === null`,
    );
    expect(panelClosed).toBe(true);
  });

  test('play 3 full turns through the canvas UI', async ({ page }) => {
    await loadGame(page);

    // Pick Xin-xi through the UI
    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    // Play 3 turns — every interaction is a canvas pixel click
    for (let i = 0; i < 3; i++) {
      // Open city menu to verify interactivity this turn
      if (i === 0) {
        // First turn: click capital city, close it, then end turn
        const cityPos = await page.evaluate(() => {
          const gs = (window as any).__PHASER_GAME__?.scene?.getScene('GameScene');
          if (!gs?.state) return null;
          const tribe = gs.state.getCurrentTribe();
          const city = tribe?.cities?.[0];
          if (!city) return null;
          const wp = city.position.toPixel(32);
          return {
            x: wp.x - gs.cameras.main.scrollX,
            y: wp.y - gs.cameras.main.scrollY,
          };
        });

        if (cityPos) {
          await click(page, cityPos.x, cityPos.y);
          await page.waitForTimeout(300);
          // Click empty space to close menu
          await click(page, 400, 350);
          await page.waitForTimeout(300);
        }
      }

      // END TURN at game coords (660, 10)
      await click(page, 660, 10);
      // Wait for all AI tribes to play
      await page.waitForTimeout(6000);

      const alive = await evalGame<boolean>(
        page,
        `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
      );
      expect(alive).toBe(true);
    }

    // After 3+ turns, the game should have progressed significantly
    const finalTurn = await evalGame<number>(
      page,
      `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
    );
    expect(finalTurn).toBeGreaterThanOrEqual(4);
  });
});
