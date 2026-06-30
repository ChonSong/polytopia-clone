import Phaser from 'phaser';
import { MAP_TYPES } from '../hex/MapGenerator';
import { TRIBE_CONFIGS } from '../entities/Tribe';
import SoundManager from '../audio/SoundManager';
import { SaveManager } from '../entities/SaveManager';

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

    // Tribe cards — responsive grid layout
    const sortedTribes = [...TRIBE_CONFIGS].sort((a, b) => a.name.localeCompare(b.name));
    const gap = Math.min(15, width * 0.02);
    const cardW = Math.min(170, Math.max(80, (width - 32) / Math.min(sortedTribes.length, 6) - gap));
    const cardH = Math.min(220, cardW * 1.3);
    const cols = Math.min(sortedTribes.length, Math.floor((width - 16) / (cardW + gap)));
    const totalCards = sortedTribes.length;
    const rows = Math.ceil(totalCards / cols);
    const gridW = cols * (cardW + gap) - gap;
    const startX = (width - gridW) / 2;
    const cardStartY = 220;
    // Center orphan cards in the last row when it's incomplete
    const cardsInLastRow = totalCards % cols || cols;
    const lastRowWidth = cardsInLastRow * (cardW + gap) - gap;
    const lastRowStartX = (width - lastRowWidth) / 2;
    sortedTribes.forEach((cfg, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowStartX = row === rows - 1 ? lastRowStartX : startX;
      const cx = rowStartX + col * (cardW + gap);
      const cy = cardStartY + row * (cardH + gap);
      const bg = this.add.graphics();
      bg.fillStyle(cfg.color, 0.3);
      bg.fillRoundedRect(cx, cy, cardW, cardH, 8);
      bg.lineStyle(2, cfg.color, 0.6);
      bg.strokeRoundedRect(cx, cy, cardW, cardH, 8);

      this.add.text(cx + cardW / 2, cy + 20, cfg.name, {
        fontSize: Math.max(14, Math.round(cardW * 0.12)) + 'px', color: '#ffd', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const startTech = cfg.id === 'xin-xi' || cfg.id === 'oumaji' ? 'Riding' :
        cfg.id === 'bardur' ? 'Hunting' : cfg.id === 'polaris' ? 'Frostwork' :
        cfg.id === 'cymanti' ? 'Fungiculture' : cfg.id === 'elyrion' ? 'Ecology' : 'Fishing';
      this.add.text(cx + cardW / 2, cy + 50, `Start: ${startTech}`, {
        fontSize: Math.max(10, Math.round(cardW * 0.07)) + 'px', color: '#aaa', fontFamily: 'monospace',
      }).setOrigin(0.5);

      // Click handler
      const hitArea = this.add.rectangle(cx + cardW / 2, cy + cardH / 2, cardW, cardH, 0x000, 0)
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

    // Load Game button — responsive positioning at bottom
    const loadY = cardStartY + rows * (cardH + gap) + 20;
    const hasSave = SaveManager.hasSave(0) || SaveManager.hasSave(1) || SaveManager.hasSave(2);
    if (hasSave && loadY < height - 20) {
      const loadBtn = this.add.text(width / 2, height - 40, '📂 LOAD GAME', {
        fontSize: '18px', color: '#8af', fontFamily: 'monospace',
        backgroundColor: '#222', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      loadBtn.on('pointerdown', () => {
        this.soundManager.playUIclick();
        // Load from the most recent slot
        const slots = SaveManager.getSlotInfo();
        const newest = slots
          .filter(s => s.savedAt !== null)
          .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))[0];
        if (newest) {
          const data = SaveManager.load(newest.slot);
          if (data) {
            this.scene.start('GameScene', {
              loadSave: true,
              saveData: data,
            });
          }
        }
      });
      loadBtn.on('pointerover', () => loadBtn.setStyle({ color: '#fff' }));
      loadBtn.on('pointerout', () => loadBtn.setStyle({ color: '#8af' }));
    }
  }
}
