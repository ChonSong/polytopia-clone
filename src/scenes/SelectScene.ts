import Phaser from 'phaser';
import { TRIBE_CONFIGS } from '../entities/Tribe';

export enum GameMode {
  DOMINATION = 'DOMINATION',
  PERFECTION = 'PERFECTION',
}

export enum MapType {
  CONTINENTS = 'CONTINENTS',
  LAKES = 'LAKES',
  DRYLAND = 'DRYLAND',
  ARCHIPELAGO = 'ARCHIPELAGO',
}

export class SelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SelectScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.add.text(width / 2, 40, 'SELECT YOUR TRIBE', {
      fontSize: '28px', color: '#ffd', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const humanTribeIdx = 0; // will be set by click handler

    // Map type selector
    this.add.text(160, 80, 'Map:', { fontSize: '16px', color: '#8af', fontFamily: 'monospace' });
    const mapTypes = [MapType.CONTINENTS, MapType.LAKES, MapType.DRYLAND, MapType.ARCHIPELAGO];
    let selectedMap = MapType.CONTINENTS;
    const mapLabels: Phaser.GameObjects.Text[] = [];
    mapTypes.forEach((mt, i) => {
      const lbl = this.add.text(220 + i * 130, 80, mt, {
        fontSize: '14px', color: mt === selectedMap ? '#ff0' : '#888', fontFamily: 'monospace',
        backgroundColor: '#333', padding: { x: 6, y: 4 }
      }).setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => {
        selectedMap = mt;
        mapLabels.forEach(l => l.setStyle({ color: '#888' }));
        lbl.setStyle({ color: '#ff0' });
      });
      mapLabels.push(lbl);
    });

    // Game mode
    this.add.text(160, 115, 'Mode:', { fontSize: '16px', color: '#8af', fontFamily: 'monospace' });
    let selectedMode = GameMode.DOMINATION;
    const modeLabels: Phaser.GameObjects.Text[] = [];
    [GameMode.DOMINATION, GameMode.PERFECTION].forEach((mode, i) => {
      const lbl = this.add.text(230 + i * 160, 115, mode, {
        fontSize: '14px', color: mode === selectedMode ? '#ff0' : '#888', fontFamily: 'monospace',
        backgroundColor: '#333', padding: { x: 6, y: 4 }
      }).setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => {
        selectedMode = mode;
        modeLabels.forEach(l => l.setStyle({ color: '#888' }));
        lbl.setStyle({ color: '#ff0' });
      });
      modeLabels.push(lbl);
    });

    // Tribe cards
    const cardW = 170, gap = 15, startX = (width - (cardW * 4 + gap * 3)) / 2;
    TRIBE_CONFIGS.forEach((cfg, i) => {
      const cx = startX + i * (cardW + gap);
      const bg = this.add.graphics();
      bg.fillStyle(cfg.color, 0.3);
      bg.fillRoundedRect(cx, 150, cardW, 220, 8);
      bg.lineStyle(2, cfg.color, 0.6);
      bg.strokeRoundedRect(cx, 150, cardW, 220, 8);

      this.add.text(cx + cardW / 2, 170, cfg.name, {
        fontSize: '20px', color: '#ffd', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const startTech = cfg.id === 'xin-xi' || cfg.id === 'oumaji' ? 'Riding' :
        cfg.id === 'bardur' ? 'Hunting' : 'Fishing';
      this.add.text(cx + cardW / 2, 200, `Start: ${startTech}`, {
        fontSize: '12px', color: '#aaa', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Click handler
      const hitArea = this.add.rectangle(cx + cardW / 2, 150 + 110, cardW, 220, 0x000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.scene.start('GameScene', {
          humanTribeIndex: i,
          mapType: selectedMap,
          gameMode: selectedMode,
        });
      });
      hitArea.on('pointerover', () => bg.setAlpha(0.6));
      hitArea.on('pointerout', () => bg.setAlpha(1));
    });
  }
}
