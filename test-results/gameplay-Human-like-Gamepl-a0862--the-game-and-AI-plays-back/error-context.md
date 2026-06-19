# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay.spec.ts >> Human-like Gameplay (every interaction through canvas) >> END TURN advances the game and AI plays back
- Location: tests-e2e/gameplay.spec.ts:124:3

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Matcher error: received value must be a number or bigint

Received has value: null
```

# Test source

```ts
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
  125 |     await loadGame(page);
  126 | 
  127 |     // Pick a tribe through the UI
  128 |     const cardPos = await page.evaluate(() => {
  129 |       const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
  130 |       const rects = ss.children.list.filter(
  131 |         (c: any) => c.type === 'Rectangle' && c.input?.enabled,
  132 |       );
  133 |       return rects.length > 0 ? { x: rects[0].x, y: rects[0].y } : null;
  134 |     });
  135 |     expect(cardPos).not.toBeNull();
  136 |     await click(page, cardPos!.x, cardPos!.y);
  137 |     await page.waitForTimeout(2000);
  138 | 
  139 |     const turn0 = await evalGame<number>(
  140 |       page,
  141 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
  142 |     );
> 143 |     expect(turn0).toBeGreaterThanOrEqual(1);
      |                   ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  144 | 
  145 |     // --- Turn 1: click END TURN at (660, 10) ---
  146 |     await click(page, 660, 10);
  147 |     await page.waitForTimeout(6000); // AI tribes take turns
  148 | 
  149 |     const alive1 = await evalGame<boolean>(
  150 |       page,
  151 |       `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
  152 |     );
  153 |     expect(alive1).toBe(true);
  154 | 
  155 |     const turn1 = await evalGame<number>(
  156 |       page,
  157 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
  158 |     );
  159 |     expect(turn1).toBeGreaterThanOrEqual(turn0 + 1);
  160 | 
  161 |     // --- Turn 2: click END TURN again ---
  162 |     await click(page, 660, 10);
  163 |     await page.waitForTimeout(6000);
  164 | 
  165 |     const alive2 = await evalGame<boolean>(
  166 |       page,
  167 |       `!!((window as any).__PHASER_GAME__?.scene?.isActive('GameScene'))`,
  168 |     );
  169 |     expect(alive2).toBe(true);
  170 | 
  171 |     const turn2 = await evalGame<number>(
  172 |       page,
  173 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.turnNumber) ?? -1`,
  174 |     );
  175 |     expect(turn2).toBeGreaterThanOrEqual(turn1 + 1);
  176 |   });
  177 | 
  178 |   test('city tile opens and closes the city menu', async ({ page }) => {
  179 |     await loadGame(page);
  180 | 
  181 |     // Pick a tribe through the UI
  182 |     const cardPos = await page.evaluate(() => {
  183 |       const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
  184 |       const rects = ss.children.list.filter(
  185 |         (c: any) => c.type === 'Rectangle' && c.input?.enabled,
  186 |       );
  187 |       return rects.length > 0 ? { x: rects[0].x, y: rects[0].y } : null;
  188 |     });
  189 |     expect(cardPos).not.toBeNull();
  190 |     await click(page, cardPos!.x, cardPos!.y);
  191 |     await page.waitForTimeout(2000);
  192 | 
  193 |     // Find the human player's capital city screen position
  194 |     const cityScreenPos = await page.evaluate(() => {
  195 |       const gs = (window as any).__PHASER_GAME__?.scene?.getScene('GameScene');
  196 |       if (!gs?.state) return null;
  197 |       const tribe = gs.state.getCurrentTribe();
  198 |       if (!tribe?.cities?.length) return null;
  199 |       const city = tribe.cities[0];
  200 |       // Pixel position of the hex centre in world space
  201 |       const wp = city.position.toPixel(32);
  202 |       // Convert to screen space (the viewport the camera sees)
  203 |       return {
  204 |         x: wp.x - gs.cameras.main.scrollX,
  205 |         y: wp.y - gs.cameras.main.scrollY,
  206 |       };
  207 |     });
  208 |     expect(cityScreenPos).not.toBeNull();
  209 |     // City should be visible in the initial viewport (0..800 × 0..600)
  210 |     expect(cityScreenPos!.x).toBeGreaterThanOrEqual(0);
  211 |     expect(cityScreenPos!.x).toBeLessThanOrEqual(800);
  212 |     expect(cityScreenPos!.y).toBeGreaterThanOrEqual(0);
  213 |     expect(cityScreenPos!.y).toBeLessThanOrEqual(600);
  214 | 
  215 |     // Click the city hex through the canvas
  216 |     await click(page, cityScreenPos!.x, cityScreenPos!.y);
  217 |     await page.waitForTimeout(500);
  218 | 
  219 |     // Verify city menu opened
  220 |     const menuOpen = await evalGame<boolean>(
  221 |       page,
  222 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu) !== null`,
  223 |     );
  224 |     expect(menuOpen).toBe(true);
  225 | 
  226 |     // Click empty space (centered game coords, but avoid UI buttons)
  227 |     // The city menu should close when clicking elsewhere on the map
  228 |     await click(page, 400, 350);
  229 |     await page.waitForTimeout(400);
  230 | 
  231 |     const menuClosed = await evalGame<boolean>(
  232 |       page,
  233 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.cityMenu) === null`,
  234 |     );
  235 |     expect(menuClosed).toBe(true);
  236 |   });
  237 | 
  238 |   test('tech panel opens and closes via canvas button', async ({ page }) => {
  239 |     await loadGame(page);
  240 | 
  241 |     // Pick a tribe through the UI
  242 |     const cardPos = await page.evaluate(() => {
  243 |       const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
```