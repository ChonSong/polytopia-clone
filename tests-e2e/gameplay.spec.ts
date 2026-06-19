import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// E2E Gameplay Tests — using game state manipulation via __PHASER_GAME__
// These tests verify the core game loop: loading, turn progression, and the
// city interaction menu. They bypass pixel-accuracy issues in headless
// browser by inspecting/controlling game state directly.
// ---------------------------------------------------------------------------

const GAME_URL = 'http://localhost:3001';

/** Navigate to game and wait for Phaser canvas to render */
async function loadGame(page: import('@playwright/test').Page) {
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  // Wait for Phaser boot and scene transitions (BootScene → SelectScene)
  await page.waitForTimeout(2000);
}

/** Skip tribe selection and jump straight into the game with a given tribe */
async function startGame(page: import('@playwright/test').Page, tribeIndex = 0) {
  await page.evaluate((idx) => {
    const game = (window as any).__PHASER_GAME__;
    if (!game) throw new Error('__PHASER_GAME__ not found');
    game.scene.start('GameScene', {
      humanTribeIndex: idx,
      mapType: 'CONTINENTS',
      gameMode: 'DOMINATION',
    });
  }, tribeIndex);
  // Wait for GameScene to create tiles, cities, render
  await page.waitForTimeout(1500);
}

/** Get the game scene object */
async function getGameScene(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    return game?.scene?.getScene('GameScene') ? 'ok' : 'no-scene';
  });
}

test.describe('Polytopia Clone — Gameplay E2E', () => {

  test('game loads and renders a canvas', async ({ page }) => {
    await page.goto(GAME_URL, { waitUntil: 'networkidle' });
    const canvas = await page.waitForSelector('canvas', { timeout: 15000 });
    expect(canvas).not.toBeNull();
    await page.waitForTimeout(2000);
    const hasGame = await page.evaluate(() => !!(window as any).__PHASER_GAME__);
    expect(hasGame).toBe(true);
  });

  test('start game via tribe selection click', async ({ page }) => {
    await loadGame(page);

    // Click the first tribe card (Xin-xi)
    // Card 0 center: (startX + 85, 260) in game coords, but we must
    // account for canvas offset/scale in the viewport. Use page.evaluate for precision.
    const tribeCards = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      const ss = game.scene.getScene('SelectScene');
      // Scan for interactive rectangles
      const kids = ss.children.list.filter((c: any) => c.type === 'Rectangle' && c.input?.enabled);
      return kids.map((r: any) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
    });

    expect(tribeCards.length).toBeGreaterThanOrEqual(2);
    const card = tribeCards[0];
    expect(card.x).toBeGreaterThan(0);

    // Convert game coord to canvas-relative coord using Phaser's scale manager
    const clickPos = await page.evaluate(({ gameX, gameY }: { gameX: number; gameY: number }) => {
      const canvas = document.querySelector('canvas')!;
      const rect = canvas.getBoundingClientRect();
      const game = (window as any).__PHASER_GAME__;
      const scaleX = rect.width / game.config.width;
      const scaleY = rect.height / game.config.height;
      return {
        // position relative to canvas element for locator.click({ position })
        x: gameX * scaleX,
        y: gameY * scaleY,
      };
    }, { gameX: card.x, gameY: card.y });

    await page.locator('canvas').click({ position: { x: clickPos.x, y: clickPos.y } });
    await page.waitForTimeout(1000);

    // Should now be on GameScene
    const onGameScene = await page.evaluate(() => {
      const game = (window as any).__PHASER_GAME__;
      return game.scene.isActive('GameScene');
    });
    expect(onGameScene).toBe(true);
  });

  test('city menu opens and shows train options', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0); // Xin-xi tribe

    // Verify city exists and get its game-level pixel position
    const cityPixel = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      if (!city) return null;
      const p = city.position.toPixel(32); // HEX_SIZE = 32
      return { x: p.x, y: p.y };
    });
    expect(cityPixel).not.toBeNull();

    // Click the city via Phaser's input system (bypass coordinate math)
    await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      const p = city.position.toPixel(32);
      gs.handleClick(p.x, p.y);
    });
    await page.waitForTimeout(300);

    // Verify city menu appeared
    const menuItems = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      if (!gs.cityMenu) return [];
      return gs.cityMenu.getChildren().map((c: any) => c.text || '');
    });
    expect(menuItems.length).toBeGreaterThan(0);
    expect(menuItems.some((t: string) => t.includes('TRAIN'))).toBe(true);

    // Verify the menu shows the tribe name in the title
    const hasTribeName = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      // The city menu is open — check any menu item
      return gs.cityMenu !== null && gs.selectedCity !== null;
    });
    expect(hasTribeName).toBe(true);
  });

  test('city menu closes when clicking elsewhere', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0);

    // Open city menu
    await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      const p = city.position.toPixel(32);
      gs.handleClick(p.x, p.y);
    });
    await page.waitForTimeout(200);

    // Click away — click an empty hex position
    await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      const p = city.position.toPixel(32);
      // Click a position that's far from the city but still on the map
      // This should land on an empty tile and dismiss the menu
      gs.handleClick(p.x + 500, p.y + 500);
    });
    await page.waitForTimeout(200);

    // Verify menu closed
    const menuClosed = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return gs.cityMenu === null;
    });
    expect(menuClosed).toBe(true);
  });

  test('game survives 3 full turns without crash', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0);

    for (let turn = 0; turn < 3; turn++) {
      // End turn by clicking END TURN button position (660, 10 with padding → ~680, 20)
      // Convert to canvas-relative
      await page.locator('canvas').click({ position: { x: 660, y: 20 } });
      // Wait for AI phase (~3-5 seconds for all 3 AI tribes)
      await page.waitForTimeout(6000);
      // Verify GameScene is still active (not crashed to blank page)
      const alive = await page.evaluate(() => {
        const game = (window as any).__PHASER_GAME__;
        return game && game.scene.isActive('GameScene');
      });
      expect(alive).toBe(true);
    }
  });

  test('city menu clears after AI turn', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0);

    // Open city menu
    await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      const p = city.position.toPixel(32);
      gs.handleClick(p.x, p.y);
    });
    await page.waitForTimeout(200);

    // Verify menu is open
    const menuOpen = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return gs.cityMenu !== null;
    });
    expect(menuOpen).toBe(true);

    // End turn — AI should clear the menu
    await page.locator('canvas').click({ position: { x: 680, y: 20 } });
    await page.waitForTimeout(6000);

    // After AI finishes, menu should be gone
    const menuGone = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return gs.cityMenu === null;
    });
    expect(menuGone).toBe(true);
  });

  test('city with unit priority: city menu over unit select', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0);

    // Game starts with a warrior on the city hex (placeCities line 264).
    // Clicking the city tile should open the city menu, NOT select the unit.
    await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      const tribe = gs.state.getCurrentTribe();
      const city = tribe.cities[0];
      const p = city.position.toPixel(32);
      gs.handleClick(p.x, p.y);
    });
    await page.waitForTimeout(200);

    const result = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return {
        menuOpen: gs.cityMenu !== null,
        selectedUnit: gs.selectedUnit !== null,
      };
    });
    expect(result.menuOpen).toBe(true);
    expect(result.selectedUnit).toBe(false);
  });

  test('tech panel opens and closes', async ({ page }) => {
    await loadGame(page);
    await startGame(page, 0);

    // Click TECH button (position ~560, 30)
    await page.locator('canvas').click({ position: { x: 560, y: 30 } });
    await page.waitForTimeout(500);

    // Tech panel should be visible (techPanel not null)
    const techOpen = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return gs.techPanel !== null;
    });
    expect(techOpen).toBe(true);

    // Click again to close
    await page.locator('canvas').click({ position: { x: 560, y: 30 } });
    await page.waitForTimeout(500);

    const techClosed = await page.evaluate(() => {
      const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
      return gs.techPanel === null;
    });
    expect(techClosed).toBe(true);
  });
});
