import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 600;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, SelectScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  input: {
    activePointers: 3, // support multi-touch
  },
};

const game = new Phaser.Game(config);
// Expose for Playwright E2E tests
(window as any).__PHASER_GAME__ = game;
// Expose design dimensions for responsive HUD calculations
(window as any).__GAME_DESIGN_W__ = DESIGN_WIDTH;
(window as any).__GAME_DESIGN_H__ = DESIGN_HEIGHT;
