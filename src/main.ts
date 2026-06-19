import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SelectScene } from './scenes/SelectScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [BootScene, SelectScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
// Expose for Playwright E2E tests
(window as any).__PHASER_GAME__ = game;
