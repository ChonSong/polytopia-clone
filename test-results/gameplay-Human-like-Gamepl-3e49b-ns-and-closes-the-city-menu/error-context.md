# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gameplay.spec.ts >> Human-like Gameplay (every interaction through canvas) >> city tile opens and closes the city menu
- Location: tests-e2e/gameplay.spec.ts:178:3

# Error details

```
Error: expect(received).not.toBeNull()

Received: null
```

# Test source

```ts
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
  143 |     expect(turn0).toBeGreaterThanOrEqual(1);
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
> 208 |     expect(cityScreenPos).not.toBeNull();
      |                               ^ Error: expect(received).not.toBeNull()
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
  244 |       const rects = ss.children.list.filter(
  245 |         (c: any) => c.type === 'Rectangle' && c.input?.enabled,
  246 |       );
  247 |       return rects.length > 0 ? { x: rects[0].x, y: rects[0].y } : null;
  248 |     });
  249 |     expect(cardPos).not.toBeNull();
  250 |     await click(page, cardPos!.x, cardPos!.y);
  251 |     await page.waitForTimeout(2000);
  252 | 
  253 |     // TECH button at game coords (530, 10), scrollFactor(0), depth 20
  254 |     await click(page, 530, 10);
  255 |     await page.waitForTimeout(600);
  256 | 
  257 |     const panelOpen = await evalGame<boolean>(
  258 |       page,
  259 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel) !== null`,
  260 |     );
  261 |     expect(panelOpen).toBe(true);
  262 | 
  263 |     // Click the same button again to close
  264 |     await click(page, 530, 10);
  265 |     await page.waitForTimeout(400);
  266 | 
  267 |     const panelClosed = await evalGame<boolean>(
  268 |       page,
  269 |       `((window as any).__PHASER_GAME__?.scene?.getScene('GameScene')?.techPanel) === null`,
  270 |     );
  271 |     expect(panelClosed).toBe(true);
  272 |   });
  273 | 
  274 |   test('play 3 full turns through the canvas UI', async ({ page }) => {
  275 |     await loadGame(page);
  276 | 
  277 |     // Pick Xin-xi through the UI
  278 |     const cardPos = await page.evaluate(() => {
  279 |       const ss = (window as any).__PHASER_GAME__.scene.getScene('SelectScene');
  280 |       const rects = ss.children.list.filter(
  281 |         (c: any) => c.type === 'Rectangle' && c.input?.enabled,
  282 |       );
  283 |       return rects.length > 0 ? { x: rects[0].x, y: rects[0].y } : null;
  284 |     });
  285 |     expect(cardPos).not.toBeNull();
  286 |     await click(page, cardPos!.x, cardPos!.y);
  287 |     await page.waitForTimeout(2000);
  288 | 
  289 |     // Play 3 turns — every interaction is a canvas pixel click
  290 |     for (let i = 0; i < 3; i++) {
  291 |       // Open city menu to verify interactivity this turn
  292 |       if (i === 0) {
  293 |         // First turn: click capital city, close it, then end turn
  294 |         const cityPos = await page.evaluate(() => {
  295 |           const gs = (window as any).__PHASER_GAME__?.scene?.getScene('GameScene');
  296 |           if (!gs?.state) return null;
  297 |           const tribe = gs.state.getCurrentTribe();
  298 |           const city = tribe?.cities?.[0];
  299 |           if (!city) return null;
  300 |           const wp = city.position.toPixel(32);
  301 |           return {
  302 |             x: wp.x - gs.cameras.main.scrollX,
  303 |             y: wp.y - gs.cameras.main.scrollY,
  304 |           };
  305 |         });
  306 | 
  307 |         if (cityPos) {
  308 |           await click(page, cityPos.x, cityPos.y);
```