import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE_ERROR] ${err.message}`));

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(3000);

  const gameInfo = await page.evaluate(() => {
    const g = window.__PHASER_GAME__;
    if (!g) return { error: 'no game' };
    const active = g.scene.getScenes(true).map(s => s.scene.key);
    const all = g.scene.getScenes(false).map(s => s.scene.key);
    // Check SelectScene children for interactive elements
    const ss = g.scene.getScene('SelectScene');
    let cardInfo = null;
    if (ss) {
      const kids = ss.children.list;
      const interactive = kids.filter(c => c.input && c.input.enabled).map(c => ({
        type: c.type,
        x: c.x, y: c.y,
        w: c.width, h: c.height,
        alpha: c.alpha,
        visible: c.visible,
      }));
      cardInfo = {
        interactiveCount: interactive.length,
        interactive,
        childCount: kids.length,
        allTypes: [...new Set(kids.map(c => c.type))],
      };
    }
    return { running: g.isRunning, active, all, cardInfo, w: 800, h: 600 };
  });
  console.log('GAME:', JSON.stringify(gameInfo));

  const box = await page.locator('canvas').boundingBox();
  console.log('CANVAS BOX:', JSON.stringify(box));

  // Try click at (30, 260) in game coords using page.mouse
  const sx = box.width / 800;
  const sy = box.height / 600;
  const px = box.x + 30 * sx;
  const py = box.y + 260 * sy;
  console.log(`mouse.click at (${px}, ${py})`);

  // Click via mouse
  await page.mouse.click(px, py);
  await page.waitForTimeout(3000);

  const afterMouse = await page.evaluate(() => {
    const g = window.__PHASER_GAME__;
    if (!g) return { activeScenes: [] };
    return { activeScenes: g.scene.getScenes(true).map(s => s.scene.key) };
  });
  console.log('AFTER MOUSE CLICK:', JSON.stringify(afterMouse));

  // If that failed, try locator click
  if (!afterMouse.activeScenes.includes('GameScene')) {
    console.log('Mouse click failed, trying locator click...');
    // First reload
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Use locator click with position only (no force)
    await page.locator('canvas').click({ position: { x: 30 * sx, y: 260 * sy } });
    await page.waitForTimeout(3000);

    const afterLocator = await page.evaluate(() => {
      const g = window.__PHASER_GAME__;
      if (!g) return { activeScenes: [] };
      return { activeScenes: g.scene.getScenes(true).map(s => s.scene.key) };
    });
    console.log('AFTER LOCATOR CLICK:', JSON.stringify(afterLocator));
  }

  await browser.close();
})();
