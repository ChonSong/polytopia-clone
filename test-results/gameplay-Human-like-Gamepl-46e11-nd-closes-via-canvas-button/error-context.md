# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay.spec.ts >> Human-like Gameplay (every interaction through canvas) >> tech panel opens and closes via canvas button
- Location: tests-e2e/gameplay.spec.ts:238:3

# Error details

```
Error: page.waitForSelector: Target page, context or browser has been closed
Call log:
  - waiting for locator('canvas') to be visible

```

```
Error: write EPIPE
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Human-like interaction contract:
  5   |  *
  6   |  * Every interaction goes through the Phaser canvas at real pixel positions,
  7   |  * exactly as a player clicking in the browser would. We NEVER:
  8   |  *   - Call gs.handleClick() directly (bypasses UI)
  9   |  *   - Teleport between scenes via game.scene.start()
  10  |  *   - Set game state variables directly
  11  |  *
  12  |  * The only page.evaluate calls are READs — verifying what changed after
  13  |  * a canvas click.  The game is always played at hex.codeovertcp.com's
  14  |  * deployed resolution (game config: 800×600, Phaser.Scale.FIT).
  15  |  */
  16  | 
  17  | const GAME_URL = 'http://localhost:3001';
  18  | 
  19  | // ─── Helpers ──────────────────────────────────────────────────────────
  20  | 
  21  | /** Wait for Phaser to boot and the canvas to render. */
  22  | async function loadGame(page: Page) {
  23  |   await page.goto(GAME_URL, { waitUntil: 'networkidle' });
> 24  |   await page.waitForSelector('canvas', { timeout: 15000 });
      |   ^ Error: write EPIPE
  25  |   // Allow BootScene → SelectScene transition
  26  |   await page.waitForTimeout(2500);
  27  |   const ok = await page.evaluate(() => !!(window as any).__PHASER_GAME__);
  28  |   expect(ok).toBe(true);
  29  | }
  30  | 
  31  | /**
  32  |  * Convert a game-space coordinate (Phaser 800×600 space) into a
  33  |  * viewport-relative pixel position for Playwright's canvas click.
  34  |  *
  35  |  * Phaser.Scale.FIT + CENTER_BOTH means the canvas element may be
  36  |  * displayed at a different resolution than 800×600.  We divide by the
  37  |  * actual-to-nominal ratio so the pixel we click maps to the correct
  38  |  * game coordinate through Phaser's built-in pointer → game-coord
  39  |  * pipeline.
  40  |  */
  41  | async function g(page: Page, gameX: number, gameY: number) {
  42  |   return page.evaluate(
  43  |     ({ gx, gy }) => {
  44  |       const c = document.querySelector('canvas')!;
  45  |       const r = c.getBoundingClientRect();
  46  |       return { x: gx * (r.width / 800), y: gy * (r.height / 600) };
  47  |     },
  48  |     { gx: gameX, gy: gameY },
  49  |   );
  50  | }
  51  | 
  52  | /** Click the Phaser canvas at game-space (gx, gy). */
  53  | async function click(page: Page, gameX: number, gameY: number) {
  54  |   const { x, y } = await g(page, gameX, gameY);
  55  |   await page.locator('canvas').click({ position: { x, y }, force: true });
  56  | }
  57  | 
  58  | /** Evaluate game code that throws but returns a fallback. */
  59  | async function evalGame<T>(page: Page, fn: string): Promise<T | null> {
  60  |   try {
  61  |     return await page.evaluate(fn);
  62  |   } catch {
  63  |     return null;
  64  |   }
  65  | }
  66  | 
  67  | // ─── Tests ────────────────────────────────────────────────────────────
  68  | 
  69  | test.describe('Human-like Gameplay (every interaction through canvas)', () => {
  70  | 
  71  |   test('game loads and Phaser canvas is rendered', async ({ page }) => {
  72  |     await loadGame(page);
  73  |     // Confirm the canvas has content (not a blank page)
  74  |     const canvas = page.locator('canvas');
  75  |     const box = await canvas.boundingBox();
  76  |     expect(box).not.toBeNull();
  77  |     expect(box!.width).toBeGreaterThan(100);
  78  |     expect(box!.height).toBeGreaterThan(100);
  79  | 
  80  |     const booted = await page.evaluate(() => {
  81  |       const g = (window as any).__PHASER_GAME__;
  82  |       return g?.isRunning ?? false;
  83  |     });
  84  |     expect(booted).toBe(true);
  85  |   });
  86  | 
  87  |   test('select Xin-xi tribe through the card UI', async ({ page }) => {
  88  |     await loadGame(page);
  89  | 
  90  |     // Tribe cards are interactive Rectangles in SelectScene.
  91  |     // With 5 tribes (xin-xi, imperius, bardur, oumaji, polaris):
  92  |     //   cardW=170, gap=15, startX = (800 - (170*5 + 15*4))/2 = -55
  93  |     //   Card 0 (Xin-xi) centre: (-55 + 85, 150 + 110) = (30, 260)
  94  |     //
  95  |     // We find position from the scene itself for robustness.
  96  |     const cardPos = await page.evaluate(() => {
  97  |       const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
  98  |       if (!ss) return null;
  99  |       const rects = ss.children.list.filter(
  100 |         (c: any) => c.type === 'Rectangle' && c.input?.enabled,
  101 |       );
  102 |       if (rects.length < 1) return null;
  103 |       return { x: rects[0].x, y: rects[0].y };
  104 |     });
  105 |     expect(cardPos).not.toBeNull();
  106 | 
  107 |     // Click — goes through the canvas, through Phaser's input pipeline
  108 |     await click(page, cardPos!.x, cardPos!.y);
  109 |     await page.waitForTimeout(2000);
  110 | 
  111 |     const onGame = await evalGame<boolean>(
  112 |       page,
  113 |       `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
  114 |     );
  115 |     expect(onGame).toBe(true);
  116 | 
  117 |     const tribeName = await evalGame<string>(
  118 |       page,
  119 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.state?.getCurrentTribe()?.name) ?? null`,
  120 |     );
  121 |     expect(tribeName).toBe('Xin-xi');
  122 |   });
  123 | 
  124 |   test('END TURN advances the game and AI plays back', async ({ page }) => {
```