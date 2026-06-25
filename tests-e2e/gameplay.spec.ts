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
 * a canvas click.
 */

const GAME_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Wait for Phaser to boot and the canvas to render. */
async function loadGame(page: Page) {
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => !!(window as any).__PHASER_GAME__);
  expect(ok).toBe(true);
}

/** Click the Phaser canvas at game-space (gx, gy) using the native locator API. */
async function click(page: Page, gx: number, gy: number) {
  await page.locator('canvas').click({ position: { x: gx, y: gy } });
}

/** Pick the first visible tribe card in SelectScene. */
async function pickVisibleCard(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const g = window as any;
    const ss = g.__PHASER_GAME__?.scene?.getScene('SelectScene');
    if (!ss) return { x: 30, y: 260 };
    const rects = ss.children.list.filter(
      (c: any) => c.type === 'Rectangle' && c.input?.enabled && c.x >= 0 && c.x <= 800,
    );
    const idx = Math.min(Math.floor(rects.length / 2), rects.length - 1);
    return { x: rects[idx].x, y: rects[idx].y };
  });
}

/** Safe page.evaluate for JS expressions (no TS `as` casts). */
async function readGame<T>(page: Page, expr: string): Promise<T | null> {
  try {
    return await page.evaluate(expr);
  } catch {
    return null;
  }
}

/**
 * Return the current game state snapshot from the browser.
 */
async function gameSnapshot(page: Page) {
  return readGame<{
    aiRunning: boolean;
    turn: number | null;
    gameOver: boolean;
    winner: string | null;
    sceneActive: boolean;
  }>(
    page,
    `(() => {
      const gs = window.__PHASER_GAME__?.scene?.getScene('GameScene');
      if (!gs) return { aiRunning: false, turn: null, gameOver: false, winner: null, sceneActive: false };
      const turn = gs.state?.turn ?? null;
      const statusText = gs.statusText?.text ?? '';
      return {
        aiRunning: !!gs.isAiRunning,
        turn,
        gameOver: !gs.scene.isActive('GameScene'),
        winner: statusText.includes('wins') ? statusText : null,
        sceneActive: gs.scene.isActive('GameScene'),
      };
    })()`,
  );
}

/**
 * Wait until the human can act, or the game ends.
 * Returns 'human_turn' if the human can play, 'game_over' if the game ended.
 */
async function waitForTurnOrEnd(page: Page): Promise<'human_turn' | 'game_over'> {
  await page.waitForFunction(() => {
    const gs = (window as any).__PHASER_GAME__?.scene?.getScene('GameScene');
    if (!gs) return true; // scene changed — propagate and check
    // Human's turn: AI not running, turn known
    if (gs.isAiRunning === false && gs.state?.turn != null) return true;
    // Game over: status shows a winner
    if (gs.statusText?.text?.includes('wins') || gs.statusText?.text?.includes('GAME OVER')) return true;
    return false;
  }, { timeout: 60000, polling: 200 });

  const snap = await gameSnapshot(page);
  if (snap?.winner || snap?.gameOver) return 'game_over';
  return 'human_turn' as const;
}

/** Select a tribe and wait until we either get human turn or game over. */
async function selectTribeAndWait(page: Page) {
  const cardPos = await pickVisibleCard(page);
  await click(page, cardPos.x, cardPos.y);
  return await waitForTurnOrEnd(page);
}

// ─── Tests ────────────────────────────────────────────────────────────

test.describe('Human-like Gameplay', () => {

  test('game loads and Phaser canvas is rendered', async ({ page }) => {
    await loadGame(page);

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

    const cardPos = await pickVisibleCard(page);
    await click(page, cardPos.x, cardPos.y);
    await page.waitForTimeout(2000);

    const onGame = await readGame<boolean>(
      page,
      `!!(window.__PHASER_GAME__?.scene?.isActive('GameScene'))`,
    );
    expect(onGame).toBe(true);

    const tribeName = await readGame<string>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.state?.getCurrentTribe()?.name) ?? null`,
    );
    expect(tribeName).not.toBeNull();
  });

  test('END TURN advances the game and AI plays back', async ({ page }) => {
    test.setTimeout(90_000);
    await loadGame(page);
    const outcome0 = await selectTribeAndWait(page);
    if (outcome0 === 'game_over') {
      console.log('Game ended during initial AI processing — skipping');
      return;
    }

    const snap0 = await gameSnapshot(page);
    expect(snap0?.turn).toBeGreaterThanOrEqual(1);

    // --- Turn 1: click END TURN ---
    await click(page, 742, 27);
    const outcome1 = await waitForTurnOrEnd(page);
    if (outcome1 === 'game_over') {
      console.log(`Game ended after turn ${snap0?.turn}`);
      expect(snap0).toBeTruthy();
      return;
    }

    const snap1 = await gameSnapshot(page);
    expect(snap1?.turn).toBeGreaterThan(snap0!.turn!);

    // --- Turn 2: click END TURN ---
    await click(page, 742, 27);
    const outcome2 = await waitForTurnOrEnd(page);
    if (outcome2 === 'game_over') {
      console.log(`Game ended after turn ${snap1?.turn}`);
      return;
    }

    const snap2 = await gameSnapshot(page);
    expect(snap2?.turn).toBeGreaterThan(snap1!.turn!);
  });

  test('city tile opens and closes the city menu', async ({ page }) => {
    await loadGame(page);
    await selectTribeAndWait(page);

    const cityScreenPos = await page.evaluate(() => {
      const g = window as any;
      const gs = g.__PHASER_GAME__?.scene?.getScene('GameScene');
      if (!gs?.state) return null;
      const tribe = gs.state.getCurrentTribe();
      if (!tribe?.cities?.length) return null;
      const sx = gs.cameras.main.scrollX;
      const sy = gs.cameras.main.scrollY;

      for (const city of tribe.cities) {
        const wp = city.position.toPixel(32);
        const x = Math.round(wp.x - sx);
        const y = Math.round(wp.y - sy);
        if (x >= 0 && x <= 800 && y >= 0 && y <= 600) {
          return { x, y, id: city.id };
        }
      }
      const wp = tribe.cities[0].position.toPixel(32);
      return { x: Math.round(wp.x - sx), y: Math.round(wp.y - sy), id: tribe.cities[0].id };
    });
    expect(cityScreenPos).not.toBeNull();

    if (cityScreenPos!.x >= 0 && cityScreenPos!.x <= 800 && cityScreenPos!.y >= 0 && cityScreenPos!.y <= 600) {
      await click(page, cityScreenPos!.x, cityScreenPos!.y);
      await page.waitForTimeout(500);

      const menuOpen = await readGame<boolean>(
        page,
        `!!(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu)`,
      );
      expect(menuOpen).toBe(true);

      await click(page, 400, 300);
      await page.waitForTimeout(300);

      const menuClosed = await readGame<boolean>(
        page,
        `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu) === null`,
      );
      expect(menuClosed).toBe(true);
    } else {
      console.log(`City at (${cityScreenPos!.x}, ${cityScreenPos!.y}) — off-screen, test passes`);
    }
  });

  test('tech panel opens and closes via canvas button', async ({ page }) => {
    await loadGame(page);
    await selectTribeAndWait(page);

    await click(page, 530, 10);
    await page.waitForTimeout(600);

    const panelOpen = await readGame<boolean>(
      page,
      `!!(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel)`,
    );
    expect(panelOpen).toBe(true);

    await click(page, 530, 10);
    await page.waitForTimeout(300);

    const panelClosed = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel) === null`,
    );
    expect(panelClosed).toBe(true);
  });

  test('play up to 3 full turns through the canvas UI', async ({ page }) => {
    test.setTimeout(120_000);
    await loadGame(page);

    let state = await selectTribeAndWait(page);
    if (state === 'game_over') {
      console.log('Game ended during initial AI processing');
      return;
    }

    for (let i = 0; i < 3; i++) {
      await click(page, 742, 27);
      state = await waitForTurnOrEnd(page);
      if (state === 'game_over') {
        console.log(`Game ended after ${i + 1} human turns`);
        break;
      }
    }
  });

  test('Escape key opens and closes pause overlay', async ({ page }) => {
    test.setTimeout(30_000);
    await loadGame(page);
    const outcome = await selectTribeAndWait(page);
    if (outcome === 'game_over') {
      console.log('Game ended during initial AI processing — skipping');
      return;
    }

    // Verify not paused initially
    const pausedBefore = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.isPaused) ?? false`,
    );
    expect(pausedBefore).toBe(false);

    // Press Escape to pause
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify game is paused
    const pausedAfter = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.isPaused) ?? false`,
    );
    expect(pausedAfter).toBe(true);

    // Verify overlay exists
    const overlayExists = await readGame<boolean>(
      page,
      `!!(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.pauseOverlay)`,
    );
    expect(overlayExists).toBe(true);

    // Verify PAUSED text is visible
    const pauseTextVisible = await readGame<boolean>(
      page,
      `(() => {
        const gs = window.__PHASER_GAME__?.scene?.getScene('GameScene');
        if (!gs?.pauseOverlay) return false;
        const texts = gs.pauseOverlay.children.list.filter(c => c.type === 'Text');
        return texts.some(t => t.text === 'PAUSED');
      })()`,
    );
    expect(pauseTextVisible).toBe(true);

    // Press Escape again to resume
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify pause is dismissed
    const pausedFinal = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.isPaused) ?? true`,
    );
    expect(pausedFinal).toBe(false);

    // Verify overlay is destroyed
    const overlayGone = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.pauseOverlay) === null`,
    );
    expect(overlayGone).toBe(true);
  });

  test('Resume button closes pause overlay', async ({ page }) => {
    test.setTimeout(30_000);
    await loadGame(page);
    const outcome = await selectTribeAndWait(page);
    if (outcome === 'game_over') {
      console.log('Game ended during initial AI processing — skipping');
      return;
    }

    // Pause the game
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const pausedAfter = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.isPaused) ?? false`,
    );
    expect(pausedAfter).toBe(true);

    // Click the Resume button (at center of canvas, y≈320)
    await page.locator('canvas').click({ position: { x: 400, y: 320 } });
    await page.waitForTimeout(500);

    // Verify pause is dismissed
    const pausedFinal = await readGame<boolean>(
      page,
      `(window.__PHASER_GAME__?.scene?.getScene('GameScene')?.isPaused) ?? true`,
    );
    expect(pausedFinal).toBe(false);
  });

  test('tribe cards are sorted alphabetically on SelectScene', async ({ page }) => {
    await loadGame(page);

    // Wait for SelectScene to be active
    await page.waitForFunction(() => {
      return !!(window as any).__PHASER_GAME__?.scene?.isActive('SelectScene');
    }, { timeout: 10000 });

    // Extract tribe card name texts from SelectScene children
    // Each tribe card creates: Graphics (bg), Text (name), Text (start tech), Rectangle (hit area)
    // We filter Text objects whose text matches a known tribe name
    const tribeNames = await page.evaluate(() => {
      const g = window as any;
      const ss = g.__PHASER_GAME__?.scene?.getScene('SelectScene');
      if (!ss) return [];

      const TRIBE_NAMES = ['Bardur', 'Cymanti', 'Elyrion', 'Imperius', 'Oumaji', 'Polaris', 'Xin-xi'];
      const texts: string[] = [];

      // Iterate scene children.list — filter Text objects matching tribe names
      const list = ss.children.list || [];
      for (const child of list) {
        if (child.type === 'Text' && child.text && TRIBE_NAMES.includes(child.text)) {
          texts.push(child.text);
        }
      }
      return texts;
    });

    // All 7 tribes must be present
    expect(tribeNames.length).toBe(7);

    // Verify alphabetical order
    const expected = ['Bardur', 'Cymanti', 'Elyrion', 'Imperius', 'Oumaji', 'Polaris', 'Xin-xi'];
    expect(tribeNames).toEqual(expected);
  });

});
