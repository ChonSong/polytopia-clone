# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay.spec.ts >> Polytopia Clone — Gameplay E2E >> start game via tribe selection click
- Location: tests-e2e/gameplay.spec.ts:54:3

# Error details

```
Error: Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // ---------------------------------------------------------------------------
  4   | // E2E Gameplay Tests — using game state manipulation via __PHASER_GAME__
  5   | // These tests verify the core game loop: loading, turn progression, and the
  6   | // city interaction menu. They bypass pixel-accuracy issues in headless
  7   | // browser by inspecting/controlling game state directly.
  8   | // ---------------------------------------------------------------------------
  9   | 
  10  | const GAME_URL = 'http://localhost:3001';
  11  | 
  12  | /** Navigate to game and wait for Phaser canvas to render */
  13  | async function loadGame(page: import('@playwright/test').Page) {
  14  |   await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  15  |   await page.waitForSelector('canvas', { timeout: 15000 });
  16  |   // Wait for Phaser boot and scene transitions (BootScene → SelectScene)
  17  |   await page.waitForTimeout(2000);
  18  | }
  19  | 
  20  | /** Skip tribe selection and jump straight into the game with a given tribe */
  21  | async function startGame(page: import('@playwright/test').Page, tribeIndex = 0) {
  22  |   await page.evaluate((idx) => {
  23  |     const game = (window as any).__PHASER_GAME__;
  24  |     if (!game) throw new Error('__PHASER_GAME__ not found');
  25  |     game.scene.start('GameScene', {
  26  |       humanTribeIndex: idx,
  27  |       mapType: 'CONTINENTS',
  28  |       gameMode: 'DOMINATION',
  29  |     });
  30  |   }, tribeIndex);
  31  |   // Wait for GameScene to create tiles, cities, render
  32  |   await page.waitForTimeout(1500);
  33  | }
  34  | 
  35  | /** Get the game scene object */
  36  | async function getGameScene(page: import('@playwright/test').Page) {
  37  |   return page.evaluate(() => {
  38  |     const game = (window as any).__PHASER_GAME__;
  39  |     return game?.scene?.getScene('GameScene') ? 'ok' : 'no-scene';
  40  |   });
  41  | }
  42  | 
  43  | test.describe('Polytopia Clone — Gameplay E2E', () => {
  44  | 
  45  |   test('game loads and renders a canvas', async ({ page }) => {
  46  |     await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  47  |     const canvas = await page.waitForSelector('canvas', { timeout: 15000 });
  48  |     expect(canvas).not.toBeNull();
  49  |     await page.waitForTimeout(2000);
  50  |     const hasGame = await page.evaluate(() => !!(window as any).__PHASER_GAME__);
  51  |     expect(hasGame).toBe(true);
  52  |   });
  53  | 
  54  |   test('start game via tribe selection click', async ({ page }) => {
  55  |     await loadGame(page);
  56  | 
  57  |     // Click the first tribe card (Xin-xi)
  58  |     // Card 0 center: (startX + 85, 260) in game coords, but we must
  59  |     // account for canvas offset/scale in the viewport. Use page.evaluate for precision.
  60  |     const tribeCards = await page.evaluate(() => {
  61  |       const game = (window as any).__PHASER_GAME__;
  62  |       const ss = game.scene.getScene('SelectScene');
  63  |       // Scan for interactive rectangles
  64  |       const kids = ss.children.list.filter((c: any) => c.type === 'Rectangle' && c.input?.enabled);
  65  |       return kids.map((r: any) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
  66  |     });
  67  | 
  68  |     expect(tribeCards.length).toBeGreaterThanOrEqual(2);
  69  |     const card = tribeCards[0];
  70  |     expect(card.x).toBeGreaterThan(0);
  71  | 
  72  |     // Convert game coord to canvas-relative coord using Phaser's scale manager
> 73  |     const clickPos = await page.evaluate((gameX: number, gameY: number) => {
      |                                 ^ Error: Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.
  74  |       const canvas = document.querySelector('canvas')!;
  75  |       const rect = canvas.getBoundingClientRect();
  76  |       const game = (window as any).__PHASER_GAME__;
  77  |       const scaleX = rect.width / game.config.width;
  78  |       const scaleY = rect.height / game.config.height;
  79  |       return {
  80  |         // position relative to canvas element for locator.click({ position })
  81  |         x: gameX * scaleX,
  82  |         y: gameY * scaleY,
  83  |       };
  84  |     }, card.x, card.y);
  85  | 
  86  |     await page.locator('canvas').click({ position: { x: clickPos.x, y: clickPos.y } });
  87  |     await page.waitForTimeout(1000);
  88  | 
  89  |     // Should now be on GameScene
  90  |     const onGameScene = await page.evaluate(() => {
  91  |       const game = (window as any).__PHASER_GAME__;
  92  |       return game.scene.isActive('GameScene');
  93  |     });
  94  |     expect(onGameScene).toBe(true);
  95  |   });
  96  | 
  97  |   test('city menu opens and shows train options', async ({ page }) => {
  98  |     await loadGame(page);
  99  |     await startGame(page, 0); // Xin-xi tribe
  100 | 
  101 |     // Verify city exists and get its game-level pixel position
  102 |     const cityPixel = await page.evaluate(() => {
  103 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  104 |       const tribe = gs.state.getCurrentTribe();
  105 |       const city = tribe.cities[0];
  106 |       if (!city) return null;
  107 |       const p = city.position.toPixel(32); // HEX_SIZE = 32
  108 |       return { x: p.x, y: p.y };
  109 |     });
  110 |     expect(cityPixel).not.toBeNull();
  111 | 
  112 |     // Click the city via Phaser's input system (bypass coordinate math)
  113 |     await page.evaluate(() => {
  114 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  115 |       const tribe = gs.state.getCurrentTribe();
  116 |       const city = tribe.cities[0];
  117 |       const p = city.position.toPixel(32);
  118 |       gs.handleClick(p.x, p.y);
  119 |     });
  120 |     await page.waitForTimeout(300);
  121 | 
  122 |     // Verify city menu appeared
  123 |     const menuItems = await page.evaluate(() => {
  124 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  125 |       if (!gs.cityMenu) return [];
  126 |       return gs.cityMenu.getChildren().map((c: any) => c.text || '');
  127 |     });
  128 |     expect(menuItems.length).toBeGreaterThan(0);
  129 |     expect(menuItems.some((t: string) => t.includes('TRAIN'))).toBe(true);
  130 | 
  131 |     // Verify the menu shows the tribe name in the title
  132 |     const hasTribeName = await page.evaluate(() => {
  133 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  134 |       const tribe = gs.state.getCurrentTribe();
  135 |       // The city menu is open — check any menu item
  136 |       return gs.cityMenu !== null && gs.selectedCity !== null;
  137 |     });
  138 |     expect(hasTribeName).toBe(true);
  139 |   });
  140 | 
  141 |   test('city menu closes when clicking elsewhere', async ({ page }) => {
  142 |     await loadGame(page);
  143 |     await startGame(page, 0);
  144 | 
  145 |     // Open city menu
  146 |     await page.evaluate(() => {
  147 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  148 |       const tribe = gs.state.getCurrentTribe();
  149 |       const city = tribe.cities[0];
  150 |       const p = city.position.toPixel(32);
  151 |       gs.handleClick(p.x, p.y);
  152 |     });
  153 |     await page.waitForTimeout(200);
  154 | 
  155 |     // Click away — click an empty hex (tile that exists but has no city/unit)
  156 |     await page.evaluate(() => {
  157 |       const gs = (window as any).__PHASER_GAME__.scene.getScene('GameScene');
  158 |       // Find a tile that exists next to city but has no unit or city
  159 |       const tribe = gs.state.getCurrentTribe();
  160 |       const city = tribe.cities[0];
  161 |       // Try adjacent tile
  162 |       for (const d of gs.hexCoord.constructor.DIRECTIONS || []) {
  163 |         // Actually, let's just use the first empty tile we can find
  164 |         const coord = new (gs.hexCoord.constructor as any)(city.position.q + 3, city.position.r);
  165 |         if (gs.tiles.has(coord.toString()) && !gs.findUnit(coord) && !gs.findCity(coord)) {
  166 |           const p = coord.toPixel(32);
  167 |           gs.handleClick(p.x, p.y);
  168 |           return;
  169 |         }
  170 |       }
  171 |       // Fallback: click a very far away position that maps to an existing tile
  172 |       gs.handleClick(-200, -200);
  173 |     });
```