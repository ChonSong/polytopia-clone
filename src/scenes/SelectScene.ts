import Phaser from 'phaser';
import { MAP_TYPES } from '../hex/MapGenerator';
import { TRIBE_CONFIGS } from '../entities/Tribe';
import SoundManager from '../audio/SoundManager';

export enum GameMode {
  DOMINATION = 'DOMINATION',
  PERFECTION = 'PERFECTION',
}

export class SelectScene extends Phaser.Scene {
  private soundManager = new SoundManager();

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
    const mapTypes = MAP_TYPES;
    let selectedMap = MAP_TYPES[0];
    const mapLabels: Phaser.GameObjects.Text[] = [];
    mapTypes.forEach((mt, i) => {
      const lbl = this.add.text(220 + i * 130, 80, mt, {
        fontSize: '14px', color: mt === selectedMap ? '#ff0' : '#888', fontFamily: 'monospace',
        backgroundColor: '#333', padding: { x: 6, y: 4 }
      }).setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => {
        this.soundManager.playUIclick();
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
        this.soundManager.playUIclick();
        selectedMode = mode;
        modeLabels.forEach(l => l.setStyle({ color: '#888' }));
        lbl.setStyle({ color: '#ff0' });
      });
      modeLabels.push(lbl);
    });

    // Speed selector
    type GameSpeed = 'normal' | 'fast' | 'blitz';
    const speeds: GameSpeed[] = ['normal', 'fast', 'blitz'];
    const speedDisplay: Record<GameSpeed, string> = { normal: 'Normal (×1.0)', fast: 'Fast (×0.75)', blitz: 'Blitz (×0.5)' };
    this.add.text(160, 150, 'Speed:', { fontSize: '16px', color: '#8af', fontFamily: 'monospace' });
    let selectedSpeed: GameSpeed = 'normal';
    const speedLabels: Phaser.GameObjects.Text[] = [];
    speeds.forEach((spd, i) => {
      const lbl = this.add.text(240 + i * 130, 150, speedDisplay[spd], {
        fontSize: '14px', color: spd === selectedSpeed ? '#ff0' : '#888', fontFamily: 'monospace',
        backgroundColor: '#333', padding: { x: 6, y: 4 }
      }).setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => {
        this.soundManager.playUIclick();
        selectedSpeed = spd;
        speedLabels.forEach(l => l.setStyle({ color: '#888' }));
        lbl.setStyle({ color: '#ff0' });
      });
      speedLabels.push(lbl);
    });

    // Difficulty selector
    type Difficulty = 'easy' | 'medium' | 'hard';
    const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    const diffDisplay: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
    this.add.text(160, 185, 'Difficulty:', { fontSize: '16px', color: '#8af', fontFamily: 'monospace' });
    let selectedDifficulty: Difficulty = 'medium';
    const diffLabels: Phaser.GameObjects.Text[] = [];
    difficulties.forEach((diff, i) => {
      const lbl = this.add.text(260 + i * 100, 185, diffDisplay[diff], {
        fontSize: '14px', color: diff === selectedDifficulty ? '#ff0' : '#888', fontFamily: 'monospace',
        backgroundColor: '#333', padding: { x: 6, y: 4 }
      }).setInteractive({ useHandCursor: true });
      lbl.on('pointerdown', () => {
        this.soundManager.playUIclick();
        selectedDifficulty = diff;
        diffLabels.forEach(l => l.setStyle({ color: '#888' }));
        lbl.setStyle({ color: '#ff0' });
      });
      diffLabels.push(lbl);
    });

    // Tribe cards — sorted alphabetically by name for easier browsing
    const cardW = 170, gap = 15;
    const sortedTribes = [...TRIBE_CONFIGS].sort((a, b) => a.name.localeCompare(b.name));
    const totalCards = sortedTribes.length;
    const startX = (width - (cardW * totalCards + gap * (totalCards - 1))) / 2;
    sortedTribes.forEach((cfg, i) => {
      const cx = startX + i * (cardW + gap);
      const bg = this.add.graphics();
      bg.fillStyle(cfg.color, 0.3);
      bg.fillRoundedRect(cx, 220, cardW, 220, 8);
      bg.lineStyle(2, cfg.color, 0.6);
      bg.strokeRoundedRect(cx, 220, cardW, 220, 8);

      this.add.text(cx + cardW / 2, 240, cfg.name, {
        fontSize: '20px', color: '#ffd', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const startTech = cfg.id === 'xin-xi' || cfg.id === 'oumaji' ? 'Riding' :
        cfg.id === 'bardur' ? 'Hunting' : cfg.id === 'polaris' ? 'Frostwork' :
        cfg.id === 'cymanti' ? 'Fungiculture' : cfg.id === 'elyrion' ? 'Ecology' : 'Fishing';
      this.add.text(cx + cardW / 2, 270, `Start: ${startTech}`, {
        fontSize: '12px', color: '#aaa', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Click handler
      const hitArea = this.add.rectangle(cx + cardW / 2, 220 + 110, cardW, 220, 0x000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.soundManager.playTribeSelect();
        this.scene.start('GameScene', {
          humanTribeId: cfg.id,
          mapType: selectedMap,
          gameMode: selectedMode,
          speed: selectedSpeed,
          difficulty: selectedDifficulty,
        });
      });
      hitArea.on('pointerover', () => bg.setAlpha(0.6));
      hitArea.on('pointerout', () => bg.setAlpha(1));
    });
  }
}
