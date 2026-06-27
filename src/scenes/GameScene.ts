import Phaser from 'phaser';
import { HexCoord } from '../hex/HexCoord';
import { HEX_SIZE, GRID_WIDTH, GRID_HEIGHT } from '../hex/constants';
import { TileData, Biome, BiomeColors, ResourceColors } from '../hex/Tile';
import { generateMap, MapType } from '../hex/MapGenerator';
import { GameState } from '../entities/GameState';
import { Tribe, TRIBE_CONFIGS } from '../entities/Tribe';
import { Unit, UnitType, UNIT_COSTS, UNIT_MAX_HEALTH } from '../entities/Unit';
import { City, CITY_NAMES } from '../entities/City';
import { TurnManager, TurnPhase } from '../entities/TurnManager';
import { BasicAI, DifficultyLevel, DIFFICULTY_PRESETS } from '../ai/BasicAI';
import { CombatSystem } from '../entities/CombatSystem';
import { createCity } from '../entities/CityData';
import { TECH_DEFS, TECH_SERIES_ORDER, TechId, techCost, UNIT_TECH_GATES } from '../entities/TechTree';
import { BUILDING_DEFS, BuildingType } from '../entities/Building';
import { Resource } from '../hex/Tile';
import { runExplorerPathfinding } from '../entities/Explorer';
import { TradeRouteSystem } from '../entities/TradeRouteSystem';
import { computeTribeScore, ScoreBreakdown } from '../entities/ScoreCalculator';
import { SPEED_MULTIPLIERS, speedAdjustedCost as applySpeedMultiplier } from '../entities/SpeedUtils';
import SoundManager from '../audio/SoundManager';
import { SaveManager } from '../entities/SaveManager';

const COLORS: Record<string, number> = {
  'xin-xi': 0xd4a017,
  'imperius': 0x3b7dbd,
  'bardur': 0x5a8f3c,
  'oumaji': 0xc0392b,
  'polaris': 0x87ceeb,
  'cymanti': 0x9b59b6,
  'elyrion': 0x27ae60,
};

export class GameScene extends Phaser.Scene {
  private hexGraphics!: Phaser.GameObjects.Graphics;
  private entityGraphics!: Phaser.GameObjects.Graphics;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private fogGraphics!: Phaser.GameObjects.Graphics;
  private tiles!: Map<string, TileData>;
  private state!: GameState;
  private tribes!: Tribe[];
  private humanTribe!: Tribe;
  private humanTribeIndex = 0;
  private gameMode = 'DOMINATION';
  private difficulty: DifficultyLevel = 'medium';
  private speedMultiplier = 1.0;
  private mapType: MapType = 'CONTINENTS';
  private turnLimit = 99;
  private turnManager!: TurnManager;
  private tradeRoutes!: TradeRouteSystem;
  private ais: Map<string, BasicAI> = new Map();
  private selectedUnit: Unit | null = null;
  private selectedHex: HexCoord | null = null;
  private waitBtn: Phaser.GameObjects.Text | null = null;
  private convertBtn: Phaser.GameObjects.Text | null = null;
  private healBtn: Phaser.GameObjects.Text | null = null;
  private submergeBtn: Phaser.GameObjects.Text | null = null;
  private emergeBtn: Phaser.GameObjects.Text | null = null;
  private infiltrateBtn: Phaser.GameObjects.Text | null = null;
  private enchantBtn: Phaser.GameObjects.Text | null = null;
  private isAiRunning = false;
  private currentPhase = 0; // index into PHASE_ORDER
  private skipPhase = false;
  private cityMenu: Phaser.GameObjects.Group | null = null;
  private selectedCity: City | null = null;
  private techPanel: Phaser.GameObjects.Group | null = null;
  private muteBtn!: Phaser.GameObjects.Text;
  private soundManager = new SoundManager();

  private tribeText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private battlePreviewGraphics!: Phaser.GameObjects.Graphics;
  private hoveredEnemy: Unit | null = null;

  // Combat animation state
  private isAnimating = false;
  private animatingUnitId: string | null = null;
  private damageTexts: Phaser.GameObjects.Text[] = [];

  // Border expansion animation state
  private borderPulses: { x: number; y: number; progress: number; tribeColor: number }[] = [];

  // Pause overlay state
  private isPaused = false;
  private pauseOverlay: Phaser.GameObjects.Group | null = null;
  private pauseBg: Phaser.GameObjects.Graphics | null = null;
  private pauseText: Phaser.GameObjects.Text | null = null;
  private pauseResumeBtn: Phaser.GameObjects.Text | null = null;

  private loadedSave: {
    state: GameState;
    tiles: Map<string, import('../hex/Tile').TileData>;
    gameMode: string;
    difficulty: string;
    speedMultiplier: number;
    mapType: string;
    turnLimit: number;
  } | null = null;

  private readonly PHASE_ORDER = [
    TurnPhase.EXPLORE,
    TurnPhase.BUILD,
    TurnPhase.MOVE,
    TurnPhase.ATTACK,
    TurnPhase.END,
  ];

  // Responsive HUD: store references and reposition on resize
  private hudElements: {
    bg: Phaser.GameObjects.Graphics;
    tribeText: Phaser.GameObjects.Text;
    phaseText: Phaser.GameObjects.Text;
    infoText: Phaser.GameObjects.Text;
    waitBtn: Phaser.GameObjects.Text;
    convertBtn: Phaser.GameObjects.Text;
    healBtn: Phaser.GameObjects.Text;
    submergeBtn: Phaser.GameObjects.Text;
    emergeBtn: Phaser.GameObjects.Text;
    infiltrateBtn: Phaser.GameObjects.Text;
    enchantBtn: Phaser.GameObjects.Text;
    endTurnBtn: Phaser.GameObjects.Text;
    techBtn: Phaser.GameObjects.Text;
    muteBtn: Phaser.GameObjects.Text;
  } | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: {
    humanTribeId?: string;
    mapType?: string;
    gameMode?: string;
    difficulty?: string;
    speed?: string;
    loadSave?: boolean;
    saveData?: {
      state: GameState;
      tiles: Map<string, import('../hex/Tile').TileData>;
      gameMode: string;
      difficulty: string;
      speedMultiplier: number;
      mapType: string;
      turnLimit: number;
    };
  }): void {
    if (data.loadSave && data.saveData) {
      this.loadedSave = data.saveData;
      this.humanTribeIndex = data.saveData.state.currentTribeIndex;
    } else {
      this.humanTribeIndex = data.humanTribeId
        ? TRIBE_CONFIGS.findIndex(c => c.id === data.humanTribeId)
        : 0;
      if (this.humanTribeIndex < 0) this.humanTribeIndex = 0;
    }
    this.gameMode = data.gameMode ?? 'DOMINATION';
    this.mapType = (data.mapType as MapType) ?? 'CONTINENTS';
    this.difficulty = (data.difficulty as DifficultyLevel) ?? 'medium';
    this.speedMultiplier = SPEED_MULTIPLIERS[data.speed ?? 'normal'] ?? 1.0;
    this.turnLimit = this.gameMode === 'PERFECTION' ? 30 : 99;
  }

  /** Apply game speed multiplier to a base cost, always rounding up to ensure costs ≥ 1. */
  private speedAdjustedCost(baseCost: number): number {
    return applySpeedMultiplier(baseCost, this.speedMultiplier);
  }

  create(): void {
    if (this.loadedSave) {
      // Restore from save
      this.tiles = this.loadedSave.tiles;
      this.state = this.loadedSave.state;
      this.tribes = this.state.tribes;
      this.humanTribe = this.tribes[this.humanTribeIndex];
      this.gameMode = this.loadedSave.gameMode;
      this.difficulty = this.loadedSave.difficulty as DifficultyLevel;
      this.speedMultiplier = this.loadedSave.speedMultiplier;
      this.turnLimit = this.loadedSave.turnLimit;
      this.turnManager = new TurnManager();
      this.tradeRoutes = new TradeRouteSystem();
      for (const t of this.tribes) {
        if (t !== this.humanTribe) this.ais.set(t.id, new BasicAI(t, { ...DIFFICULTY_PRESETS[this.difficulty], speedMultiplier: this.speedMultiplier }));
      }
      this.loadedSave = null;
    } else {
      // Fresh game
      this.tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, this.mapType);
      this.tribes = TRIBE_CONFIGS.map(c => new Tribe(c));
      this.humanTribe = this.tribes[this.humanTribeIndex];
      this.humanTribe.stars = 15;
      this.placeCities();
      this.placeVillages();
      this.enforceResourceProximity();
      this.placeRuins();
      this.state = new GameState(this.tribes);
      this.turnManager = new TurnManager();
      this.tradeRoutes = new TradeRouteSystem();
      for (const t of this.tribes) {
        if (t !== this.humanTribe) this.ais.set(t.id, new BasicAI(t, { ...DIFFICULTY_PRESETS[this.difficulty], speedMultiplier: this.speedMultiplier }));
      }
    }

    // Share tile map with AI via GameState (BasicAI accesses it via cast)
    (this.state as any).tileMap = this.tiles;

    // Graphics
    this.hexGraphics = this.add.graphics();

    // Auto-center camera on the human player's starting city
    const startCity = this.humanTribe.cities[0];
    if (startCity) {
      const cp = startCity.position.toPixel(HEX_SIZE);
      this.cameras.main.setScroll(cp.x - this.scale.width / 2, cp.y - this.scale.height / 2);
    }
    this.entityGraphics = this.add.graphics();
    this.rangeGraphics = this.add.graphics().setDepth(5);
    this.fogGraphics = this.add.graphics().setDepth(10);
    this.battlePreviewGraphics = this.add.graphics().setDepth(15);

    this.cameras.main.setBounds(-300, -300, 2000, 1600);

    // Input: pan with drag (mouse + touch)
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isPaused) return;
      if (p.isDown) {
        const dx = p.x - p.prevPosition.x;
        const dy = p.y - p.prevPosition.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { // dead zone to avoid interfering with clicks
          this.cameras.main.scrollX -= dx;
          this.cameras.main.scrollY -= dy;
        }
      }
      // GDD §4.7 — Battle preview on hover when a unit is selected
      if (!p.isDown && this.selectedUnit && !this.selectedUnit.hasActed && !this.isAiRunning) {
        this.updateBattlePreview(p.x, p.y);
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isPaused || this.isAiRunning) return;
      this.handleClick(p.x, p.y);
    });

    // HUD — fixed to camera, high-contrast (positions set by layoutHUD)
    const s = { fontSize: '16px', color: '#eee', fontFamily: 'monospace' };
    const bg = this.add.graphics().setScrollFactor(0).setDepth(19);

    this.tribeText = this.add.text(38, 10, '', { ...s, fontSize: '20px', color: '#ffd' })
      .setScrollFactor(0).setDepth(20);
    this.phaseText = this.add.text(12, 36, '', s)
      .setScrollFactor(0).setDepth(20);
    this.infoText = this.add.text(12, 58, '', { ...s, fontSize: '13px', color: '#ccc' })
      .setScrollFactor(0).setDepth(20);

    // Wait button (camera-fixed) — appears when a unit is selected
    this.waitBtn = this.add.text(440, 10, '[ WAIT ]', {
      fontSize: '16px', color: '#8f8', fontFamily: 'monospace',
      backgroundColor: '#232', padding: { x: 8, y: 6 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.waitBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && !this.selectedUnit.hasActed) {
        this.selectedUnit = null;
        this.selectedHex = null;
        this.renderAll();
        this.updateUI();
      }
    });
    this.waitBtn.on('pointerover', () => this.waitBtn!.setStyle({ backgroundColor: '#353' }));
    this.waitBtn.on('pointerout', () => this.waitBtn!.setStyle({ backgroundColor: '#232' }));
    this.waitBtn.setVisible(false);

    // Convert button (Mind Bender) — camera-fixed
    this.convertBtn = this.add.text(440, 40, '[ CONVERT ]', {
      fontSize: '14px', color: '#f8f', fontFamily: 'monospace',
      backgroundColor: '#323', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.convertBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.hasConvert && !this.selectedUnit.hasActed) {
        this.performConvert(this.selectedUnit);
      }
    });
    this.convertBtn.on('pointerover', () => this.convertBtn!.setStyle({ backgroundColor: '#535' }));
    this.convertBtn.on('pointerout', () => this.convertBtn!.setStyle({ backgroundColor: '#323' }));
    this.convertBtn.setVisible(false);

    // Heal button (Mind Bender) — camera-fixed
    this.healBtn = this.add.text(560, 40, '[ HEAL ]', {
      fontSize: '14px', color: '#8f8', fontFamily: 'monospace',
      backgroundColor: '#232', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.healBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.hasHeal && !this.selectedUnit.hasActed) {
        this.performHeal(this.selectedUnit);
      }
    });
    this.healBtn.on('pointerover', () => this.healBtn!.setStyle({ backgroundColor: '#353' }));
    this.healBtn.on('pointerout', () => this.healBtn!.setStyle({ backgroundColor: '#232' }));
    this.healBtn.setVisible(false);

    // Submerge button (Cloak) — camera-fixed
    this.submergeBtn = this.add.text(440, 70, '[ SUBMERGE ]', {
      fontSize: '14px', color: '#88f', fontFamily: 'monospace',
      backgroundColor: '#223', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.submergeBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.hasHide && !this.selectedUnit.hasActed && !this.selectedUnit.isSubmerged) {
        this.state.submergeCloak(this.selectedUnit);
        this.renderAll(); this.updateUI();
      }
    });
    this.submergeBtn.on('pointerover', () => this.submergeBtn!.setStyle({ backgroundColor: '#335' }));
    this.submergeBtn.on('pointerout', () => this.submergeBtn!.setStyle({ backgroundColor: '#223' }));
    this.submergeBtn.setVisible(false);

    // Emerge button (Cloak) — camera-fixed
    this.emergeBtn = this.add.text(560, 70, '[ EMERGE ]', {
      fontSize: '14px', color: '#8cf', fontFamily: 'monospace',
      backgroundColor: '#233', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.emergeBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.hasHide && !this.selectedUnit.hasActed && this.selectedUnit.isSubmerged) {
        this.state.emergeCloak(this.selectedUnit);
        this.renderAll(); this.updateUI();
      }
    });
    this.emergeBtn.on('pointerover', () => this.emergeBtn!.setStyle({ backgroundColor: '#355' }));
    this.emergeBtn.on('pointerout', () => this.emergeBtn!.setStyle({ backgroundColor: '#233' }));
    this.emergeBtn.setVisible(false);

    // GDD §3.5 — Infiltrate button (Cloak) — camera-fixed
    this.infiltrateBtn = this.add.text(440, 100, '[ INFILTRATE ]', {
      fontSize: '14px', color: '#f88', fontFamily: 'monospace',
      backgroundColor: '#332', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.infiltrateBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.hasInfiltrate && !this.selectedUnit.hasActed && this.selectedUnit.isSubmerged && this.selectedUnit.primedForInfiltrate) {
        this.performInfiltrate(this.selectedUnit);
      }
    });
    this.infiltrateBtn.on('pointerover', () => this.infiltrateBtn!.setStyle({ backgroundColor: '#533' }));
    this.infiltrateBtn.on('pointerout', () => this.infiltrateBtn!.setStyle({ backgroundColor: '#332' }));
    this.infiltrateBtn.setVisible(false);

    // GDD §7.3 — Enchantment button (Elyrion) — camera-fixed
    this.enchantBtn = this.add.text(560, 10, '[ ENCHANT ]', {
      fontSize: '14px', color: '#f8f', fontFamily: 'monospace',
      backgroundColor: '#232', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.enchantBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.selectedUnit && this.selectedUnit.type === UnitType.POLYTAUR && !this.selectedUnit.hasActed) {
        this.performEnchantment(this.selectedUnit);
      }
    });
    this.enchantBtn.on('pointerover', () => this.enchantBtn!.setStyle({ backgroundColor: '#535' }));
    this.enchantBtn.on('pointerout', () => this.enchantBtn!.setStyle({ backgroundColor: '#232' }));
    this.enchantBtn.setVisible(false);

    // End Turn (camera-fixed)
    const btn = this.add.text(660, 10, '[ END TURN ]', {
      fontSize: '20px', color: '#ffd', fontFamily: 'monospace',
      backgroundColor: '#333', padding: { x: 10, y: 6 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => { this.soundManager.playUIclick(); if (!this.isPaused && !this.isAiRunning) this.endTurn(); });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#333' }));

    // Tech button
    const techBtn = this.add.text(530, 10, '[ TECH ]', {
      fontSize: '16px', color: '#adf', fontFamily: 'monospace',
      backgroundColor: '#224', padding: { x: 8, y: 6 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    techBtn.on('pointerdown', () => {
      this.soundManager.playUIclick();
      if (!this.isPaused && !this.isAiRunning && this.state.getCurrentTribe() === this.humanTribe) {
        this.toggleTechPanel();
      }
    });
    techBtn.on('pointerover', () => techBtn.setStyle({ backgroundColor: '#336' }));
    techBtn.on('pointerout', () => techBtn.setStyle({ backgroundColor: '#224' }));

    // Sound toggle (camera-fixed) — top-left HUD (away from end turn button)
    const savedMute = typeof localStorage !== 'undefined' && localStorage.getItem('polytopia_mute') === 'true';
    this.sound.mute = savedMute;
    this.muteBtn = this.add.text(10, 10, savedMute ? '🔇' : '🔊', {
      fontSize: '22px',
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      if (this.isPaused) return;
      this.sound.mute = !this.sound.mute;
      this.muteBtn.setText(this.sound.mute ? '🔇' : '🔊');
      this.soundManager.mute = this.sound.mute;
      try { localStorage.setItem('polytopia_mute', String(this.sound.mute)); } catch { /* localStorage unavailable */ }
    });
    this.muteBtn.on('pointerover', () => this.muteBtn.setAlpha(0.8));
    this.muteBtn.on('pointerout', () => this.muteBtn.setAlpha(1));
    this.soundManager.mute = this.sound.mute;

    // Store HUD element references for responsive layout
    this.hudElements = {
      bg,
      tribeText: this.tribeText,
      phaseText: this.phaseText,
      infoText: this.infoText,
      waitBtn: this.waitBtn,
      convertBtn: this.convertBtn,
      healBtn: this.healBtn,
      submergeBtn: this.submergeBtn,
      emergeBtn: this.emergeBtn,
      infiltrateBtn: this.infiltrateBtn,
      enchantBtn: this.enchantBtn,
      endTurnBtn: btn,
      techBtn,
      muteBtn: this.muteBtn,
    };

    // Apply responsive layout (repositions based on actual canvas size)
    this.layoutHUD();

    // Listen for resize events
    this.scale.on('resize', () => this.layoutHUD());

    this.renderAll();
    this.updateUI();
    this.startTurn();
    this.soundManager.startMusic();

    // Keyboard: W = Wait (skip selected unit's turn)
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-W', () => {
        if (!this.isAiRunning && this.selectedUnit && !this.selectedUnit.hasActed) {
          // Deselect without marking hasActed → eligible for end-of-turn heal
          this.selectedUnit = null;
          this.selectedHex = null;
          this.renderAll();
          this.updateUI();
        }
      });

      // Keyboard: Escape = Pause/Resume overlay (human turn only)
      this.input.keyboard.on('keydown-ESC', () => {
        if (this.isAiRunning) return; // Don't pause during AI processing
        this.togglePause();
      });
    }
  }

  /**
   * Responsive HUD layout — repositions all HUD elements based on actual canvas size.
   * Design basis: 800×600. On smaller canvases, elements scale down and shift to stay visible.
   */
  private layoutHUD(): void {
    if (!this.hudElements) return;
    const h = this.hudElements;
    const cw = this.scale.width;   // actual canvas width in px
    const ch = this.scale.height;  // actual canvas height in px
    const designW = 800;
    const designH = 600;
    // Use the smaller of the two scale factors to keep everything visible
    const sx = cw / designW;
    const sy = ch / designH;
    const s = Math.min(sx, sy); // uniform scale factor
    // Center offset (when aspect ratio doesn't match, Phaser FIT centers with letterboxing)
    const offX = (cw - designW * s) / 2;
    const offY = (ch - designH * s) / 2;

    // Helper: scale a design-coordinate position to actual canvas position
    const px = (x: number) => offX + x * s;
    const py = (y: number) => offY + y * s;
    const fs = (size: number) => Math.max(10, Math.round(size * s)); // font size, min 10px

    // Top-left info panel (tribe/phase/info)
    const panelW = 320 * s;
    const panelH = 72 * s;
    h.bg.clear();
    h.bg.fillStyle(0x000, 0.65);
    h.bg.fillRoundedRect(px(4), py(4), panelW, panelH, 6 * s);

    h.tribeText.setPosition(px(38), py(10)).setFontSize(fs(20));
    h.phaseText.setPosition(px(12), py(36)).setFontSize(fs(16));
    h.infoText.setPosition(px(12), py(58)).setFontSize(fs(13));

    // Top-right action buttons — stack vertically on small screens
    const btnFontSize = fs(14);
    const mainBtnFontSize = fs(16);
    const bigBtnFontSize = fs(20);

    // End Turn — always top-right
    h.endTurnBtn.setPosition(px(660), py(10)).setFontSize(bigBtnFontSize);
    // Tech — left of End Turn
    h.techBtn.setPosition(px(530), py(10)).setFontSize(mainBtnFontSize);
    // Wait — below End Turn
    h.waitBtn.setPosition(px(660), py(10 + 32)).setFontSize(mainBtnFontSize);
    // Convert — below Wait
    h.convertBtn.setPosition(px(440), py(40)).setFontSize(btnFontSize);
    // Heal — below Convert
    h.healBtn.setPosition(px(560), py(40)).setFontSize(btnFontSize);
    // Submerge/Emerge — lower row
    h.submergeBtn.setPosition(px(440), py(70)).setFontSize(btnFontSize);
    h.emergeBtn.setPosition(px(560), py(70)).setFontSize(btnFontSize);
    // Infiltrate — lower
    h.infiltrateBtn.setPosition(px(440), py(100)).setFontSize(btnFontSize);
    // Enchant — top row right area
    h.enchantBtn.setPosition(px(560), py(10)).setFontSize(btnFontSize);

    // Sound toggle — always top-left corner
    h.muteBtn.setPosition(px(10), py(10)).setFontSize(fs(22));

    // Pause overlay — fill entire canvas
    if (this.pauseBg) {
      this.pauseBg.clear();
      this.pauseBg.fillStyle(0x000000, 0.55);
      this.pauseBg.fillRect(0, 0, cw, ch);
    }
    if (this.pauseText) {
      this.pauseText.setPosition(cw / 2, ch / 2 - 40).setFontSize(Math.max(24, Math.round(48 * s)));
    }
    if (this.pauseResumeBtn) {
      this.pauseResumeBtn.setPosition(cw / 2, ch / 2 + 40).setFontSize(Math.max(14, Math.round(20 * s)));
    }
  }

  private togglePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    if (this.isPaused || this.isAiRunning) return;
    this.isPaused = true;

    // Create overlay group (camera-fixed, high depth)
    this.pauseOverlay = this.add.group();

    // Semi-transparent backdrop covering the full viewport
    this.pauseBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.pauseBg.fillStyle(0x000000, 0.55);
    this.pauseBg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.pauseOverlay.add(this.pauseBg);

    // PAUSED title text — center of canvas
    this.pauseText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'PAUSED', {
      fontSize: '48px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.pauseOverlay.add(this.pauseText);

    // Resume button — center below title
    this.pauseResumeBtn = this.add.text(this.scale.width / 2, this.scale.height / 2 + 40, '[ Resume (ESC) ]', {
      fontSize: '20px', color: '#ffd', fontFamily: 'monospace',
      backgroundColor: '#333', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101)
      .setInteractive({ useHandCursor: true });
    this.pauseResumeBtn.on('pointerdown', () => this.resumeGame());
    this.pauseResumeBtn.on('pointerover', () => this.pauseResumeBtn!.setStyle({ backgroundColor: '#555' }));
    this.pauseResumeBtn.on('pointerout', () => this.pauseResumeBtn!.setStyle({ backgroundColor: '#333' }));
    this.pauseOverlay.add(this.pauseResumeBtn);
  }

  private resumeGame(): void {
    if (!this.isPaused || !this.pauseOverlay) return;
    this.isPaused = false;

    this.pauseOverlay.destroy(true);
    this.pauseOverlay = null;
    this.pauseBg = null;
    this.pauseText = null;
    this.pauseResumeBtn = null;
  }

  private placeCities(): void {
    const pos = [
      new HexCoord(2, 2),                         // Xin-xi   — top-left
      new HexCoord(GRID_WIDTH - 3, 2),             // Imperius — top-right
      new HexCoord(2, GRID_HEIGHT - 3),            // Bardur   — bottom-left
      new HexCoord(GRID_WIDTH - 3, GRID_HEIGHT - 3), // Oumaji  — bottom-right
      new HexCoord(Math.floor(GRID_WIDTH / 2), 3), // Polaris  — top-center
      new HexCoord(3, Math.floor(GRID_HEIGHT / 2)), // Cymanti — left-center
      new HexCoord(GRID_WIDTH - 4, Math.floor(GRID_HEIGHT / 2)), // Elyrion — right-center
    ];
    for (let i = 0; i < this.tribes.length; i++) {
      const p = pos[i];
      const cfg = TRIBE_CONFIGS[i];
      this.tribes[i].addCity(new City(p, cfg.name, cfg.id));
      // GDD §5.1 — Place starting warrior on adjacent empty tile, not on city tile,
      // so clicking the city opens the menu instead of selecting the unit
      const city = this.tribes[i].cities[0];
      const spawn = this.findSpawnPosition(city);
      this.tribes[i].addUnit(new Unit(spawn, UnitType.WARRIOR, cfg.id));
      // Mark the city tile for defense bonus calculations
      const tile = this.tiles.get(p.toString());
      if (tile) tile.city = true;
    }
  }

  /** GDD §2.5 — Spawn neutral villages on the map. */
  private placeVillages(): void {
    const desiredCount = 6;
    const candidates: HexCoord[] = [];

    // Collect eligible tiles: land, not edge (≥2 from edge), ≥2 from capitals
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = this.tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city) continue;

        // ≥2 tiles from any capital
        let tooClose = false;
        for (const tribe of this.tribes) {
          for (const city of tribe.cities) {
            if (coord.distanceTo(city.position) < 2) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) break;
        }
        if (tooClose) continue;

        candidates.push(coord);
      }
    }

    // Shuffle and place with mutual ≥2 spacing
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];

    for (const coord of shuffled) {
      if (placed.length >= desiredCount) break;

      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      placed.push(coord);
      const tile = this.tiles.get(coord.toString())!;
      tile.village = true;
    }
  }

  /** GDD §2.4 — Enforce resource proximity constraint. Resources only spawn
   * within a 2-tile radius of a city or neutral village. */
  private enforceResourceProximity(): void {
    // Collect all city and village positions
    const settlementPositions: HexCoord[] = [];
    for (const tribe of this.tribes) {
      for (const city of tribe.cities) {
        settlementPositions.push(city.position);
      }
    }
    for (const [key, tile] of this.tiles) {
      if (tile.village) {
        const parts = key.split(',');
        settlementPositions.push(new HexCoord(parseInt(parts[0]), parseInt(parts[1])));
      }
    }

    // Remove resources from tiles >2 hexes from any settlement
    for (const [key, tile] of this.tiles) {
      if (!tile.resource) continue;
      const parts = key.split(',');
      const coord = new HexCoord(parseInt(parts[0]), parseInt(parts[1]));
      let nearSettlement = false;
      for (const sp of settlementPositions) {
        if (coord.distanceTo(sp) <= 2) {
          nearSettlement = true;
          break;
        }
      }
      if (!nearSettlement) {
        tile.resource = undefined;
      }
    }
  }

  /** GDD §2.6 — Spawn ancient ruins on the map at game start. */
  private placeRuins(): void {
    const gridSize = GRID_WIDTH * GRID_HEIGHT;
    // Scale ruin count by map size: ~1 per 28 tiles, min 4, max 23
    const desiredCount = Math.max(4, Math.min(23, Math.round(gridSize / 28)));
    const candidates: HexCoord[] = [];

    // Collect eligible tiles: land, not edge (≥2 from edge), not city/village/water
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = this.tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city || tile.village) continue;
        candidates.push(coord);
      }
    }

    // Shuffle and place with mutual ≥2 spacing and ≥2 from villages
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    const villageCoords: HexCoord[] = [];
    for (const t of this.tiles) {
      if (t[1].village) villageCoords.push(new HexCoord(...t[0].split(',').map(Number) as [number, number]));
    }

    for (const coord of shuffled) {
      if (placed.length >= desiredCount) break;

      // ≥2 from other ruins
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // ≥2 from villages
      for (const v of villageCoords) {
        if (coord.distanceTo(v) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;

      placed.push(coord);
      const tile = this.tiles.get(coord.toString())!;
      tile.ruin = true;
    }
  }

  /** GDD §2.6 — Discover ancient ruins where the tribe has a unit standing. */
  private discoverRuins(tribe: Tribe): void {
    for (const unit of tribe.getAliveUnits()) {
      const tile = this.tiles.get(unit.position.toString());
      if (!tile?.ruin || tile.ruinDiscovered) continue;

      tile.ruinDiscovered = true;
      // Random reward: 0 = veteran unit, 1 = free tech, 2 = star bonus
      const reward = Math.floor(Math.random() * 3);
      switch (reward) {
        case 0: {
          // Veteran unit: promote the unit if eligible, or give +5 max HP
          if (!unit.isVeteran && !unit.isNaval && unit.type !== UnitType.GIANT) {
            unit.isVeteran = true;
            unit.maxHPBonus = 5;
            unit.health = unit.maxHealth; // full heal to new max
            unit.killCount = 0;
          }
          this.setStatus(`${tribe.name} discovered ancient ruins! ${unit.type} gained veteran status (+5 HP, full heal).`);
          break;
        }
        case 1: {
          // Free tech: research the first unresearched tech in any series
          const allTechs = Object.values(TechId);
          for (const tech of allTechs) {
            if (!tribe.hasTech(tech)) {
              tribe.researchTech(tech);
              this.setStatus(`${tribe.name} discovered ancient ruins! Free tech: ${tech}.`);
              break;
            }
          }
          break;
        }
        case 2: {
          // Star bonus: +10 stars
          tribe.stars += 10;
          this.setStatus(`${tribe.name} discovered ancient ruins! +10⭐ bonus.`);
          break;
        }
      }
    }
  }
  private captureVillages(tribe: Tribe): void {
    for (const unit of tribe.getAliveUnits()) {
      const tile = this.tiles.get(unit.position.toString());
      if (!tile?.village) continue;

      // Pick the next unused city name for this tribe
      const namePool = CITY_NAMES[tribe.name] || ['Outpost'];
      const name = namePool[tribe.cities.length] || `Outpost-${tribe.cities.length}`;

      const newCity = new City(unit.position, name, tribe.id);
      tribe.addCity(newCity);
      tile.village = false;
      tile.city = true;
    }
  }

  private startTurn(): void {
    const cur = this.state.getCurrentTribe();
    for (const u of cur.getAliveUnits()) u.resetTurn();

    // GDD §4.2 — Process poison damage at start of turn (before other turn-start logic)
    for (const u of cur.getAliveUnits()) {
      if (u.isPoisoned && u.isAlive) {
        const died = u.processPoison();
        if (died) {
          cur.removeUnit(u.id);
        }
      }
    }

    // GDD §3.5 — Process pending Dagger spawns before priming
    const spawned = this.state.processDaggerSpawns(cur.id);
    if (spawned.length > 0) {
      this.setStatus(`⚔ ${spawned.length} Dagger(s) spawned inside infiltrated cities!`);
    }

    // GDD §3.5 — Prime Cloaks that have been submerged adjacent to an enemy city
    this.state.primeCloaksForInfiltrate(cur.id);

    // GDD §7.1 — Polaris freeze mechanic: Mooni auto-freezes adjacent tiles, Gaami mass-freeze
    this.applyPolarisFreeze(cur);

    // GDD §7.3 — Elyrion: Sanctuary income (+1⭐/turn per adjacent animal) + animal spawning
    this.applyElyrionSanctuary(cur);

    // GDD §2.5 — Capture villages: units that START their turn on a village tile capture it
    this.captureVillages(cur);
    // GDD §2.6 — Discover ancient ruins: unit starting turn on a ruin triggers reward
    this.discoverRuins(cur);

    if (cur.isDefeated()) { this.advanceTurn(); return; }

    // GDD §8 — Reveal tiles visible to this tribe's units and cities
    this.revealTribeVision(cur);

    // Clean up any stale UI from previous turn
    this.hideCityMenu();
    this.selectedCity = null;

    if (cur !== this.humanTribe) {
      this.isAiRunning = true;
      this.currentPhase = 0;
      this.setStatus('AI thinking...');
      this.time.delayedCall(300, () => this.runAiPhase(cur));
    } else {
      this.isAiRunning = false;
      this.currentPhase = 0;
      this.selectedUnit = null;
      this.selectedHex = null;
    }
    this.renderAll();
    this.updateUI();
  }

  private async runAiPhase(tribe: Tribe): Promise<void> {
    const phase = this.PHASE_ORDER[this.currentPhase];
    if (phase === TurnPhase.END) {
      this.collectAiResources(tribe);
      this.isAiRunning = false;
      this.advanceTurn();
      return;
    }

    const ai = this.ais.get(tribe.id);
    if (!ai) { this.isAiRunning = false; this.advanceTurn(); return; }
    const actions = ai.decide(this.state, phase);
    for (const action of actions) {
      this.executeAiAction(tribe, action);
      this.renderAll();
      this.updateUI();
      await this.delay(120);
    }

    this.currentPhase++;
    this.time.delayedCall(100, () => this.runAiPhase(tribe));
  }

  private executeAiAction(tribe: Tribe, action: any): void {
    const p = action.params;
    switch (action.type) {
      case 'TRAIN': {
        const unitType = (p.unitType as UnitType) || UnitType.WARRIOR;
        const cost = this.speedAdjustedCost(UNIT_COSTS[unitType]);
        const city = tribe.cities.find(c => c.id === p.cityId);
        if (city && tribe.stars >= cost) {
          tribe.addUnit(new Unit(city.position, unitType, tribe.id));
          tribe.stars -= cost;
        }
        break;
      }
      case 'UPGRADE': {
        const city = tribe.cities.find(c => c.id === p.cityId);
        if (!city) break;
        const upgradeCost = this.speedAdjustedCost((p.cost as number) || city.level * 5);
        if (city.canGrow() && tribe.stars >= upgradeCost) {
          const choice = (p.choice as 'A' | 'B') || (Math.random() < 0.5 ? 'A' : 'B');
          city.applyLevelUp(choice);
          tribe.stars -= upgradeCost;
          // Apply instant effects for AI
          const level = city.level;
          if (level === 2 && choice === 'B') {
            // GDD §5.6 — Explorer: spawn a scout that moves autonomously
            const pos = this.findNearbyEmptyTile(city.position);
            if (pos) {
              const explorer = new Unit(pos, UnitType.SCOUT, tribe.id);
              tribe.addUnit(explorer);
              this.time.delayedCall(300, () => {
                this.runExplorerAutonomous(explorer);
              });
            }
          } else if (level === 3 && choice === 'B') {
            tribe.stars += 5; // Resources
          } else if (level === 4 && choice === 'A') {
            city.population += 3; // Population Growth
            city.food = 0;
          }
        }
        break;
      }
      case 'MOVE': {
        const unit = tribe.getAliveUnits().find(u => u.id === p.unitId);
        if (unit) {
          unit.position = new HexCoord(p.q, p.r);
          unit.hasActed = true;
        }
        break;
      }
      case 'ATTACK': {
        const unit = tribe.getAliveUnits().find(u => u.id === p.unitId);
        const targetPos = new HexCoord(p.targetQ, p.targetR);
        const target = this.findUnit(targetPos);
        if (unit && target && CombatSystem.canAttack(unit, target, this.tiles)) {
          const r = CombatSystem.executeAttack(unit, target, this.tiles, this.state);
          // Start combat animation (non-blocking — game logic proceeds underneath)
          this.animateAttack(unit, target, r.attackerDamage, r.defenderDamage, r.defenderKilled);
          unit.takeDamage(r.attackerDamage);
          target.takeDamage(r.defenderDamage);

          // GDD §3.3 — Splash: Bomber deals half damage to all adjacent enemies
          if (unit.hasSplash && r.defenderDamage > 0) {
            const splashDmg = CombatSystem.calculateSplashDamage(r.defenderDamage);
            for (const adj of target.position.neighbors()) {
              const adjUnit = this.findUnit(adj);
              if (adjUnit && adjUnit.owner !== unit.owner && adjUnit.isAlive && adjUnit.id !== target.id) {
                adjUnit.takeDamage(splashDmg);
                if (!adjUnit.isAlive) {
                  const adjOwner = this.findTribeForUnit(adjUnit.id);
                  if (adjOwner) adjOwner.removeUnit(adjUnit.id);
                }
              }
            }
          }

          // GDD §3.3 — Escape: defender (Rider) retreats 1 tile when hit in melee
          if (target.hasEscape && target.isAlive) {
            const retreatDir = this.findRetreatDirection(target, unit);
            if (retreatDir) {
              target.position = retreatDir;
            }
          }

          if (r.defenderKilled) {
            const owner = this.findTribeForUnit(target.id);
            if (owner) owner.removeUnit(target.id);
            // Only melee units advance into the defender's tile on kill
            if (!unit.ranged) {
              unit.position = targetPos;
            }
            // GDD §3.3 — Persist: Knight refreshes action on kill
            if (unit.hasPersist) {
              unit.hasAttacked = false;
              // hasActed stays false so Knight can act again this turn
            }
            // GDD §4.4 — Track kills for veteran system
            if (!unit.isNaval && unit.type !== UnitType.GIANT) {
              unit.killCount++;
              if (unit.isEligibleForVeteran) unit.promoteVeteran();
            }
          }
          if (r.attackerKilled) tribe.removeUnit(unit.id);
          // GDD §3.3 — Stiff: unit cannot move after attacking
          if (unit.hasStiff) {
            unit.hasActed = true;
          }
        } else if (unit && p.targetType === 'city') {
          const city = this.findCity(targetPos);
          if (city) {
            const cd = createCity(city.tribeId, targetPos.q, targetPos.r);
            if (CombatSystem.canAttackCity(unit, cd)) {
              const r = CombatSystem.executeCityAttack(unit, cd, this.tiles);
              if (r.cityCaptured) {
                city.captured = true;
                this.soundManager.playCityCapture();
                // Remove from original owner's list
                for (const t of this.tribes) {
                  if (t !== tribe) {
                    const idx = t.cities.indexOf(city);
                    if (idx !== -1) { t.cities.splice(idx, 1); break; }
                  }
                }
                city.tribeId = tribe.id;
                tribe.addCity(city);
              }
            }
          }
        }
        break;
      }
      case 'RESEARCH': {
        const techId = p.techId as TechId;
        const cost = this.speedAdjustedCost((p.cost as number) || 5);
        if (tribe.stars >= cost) {
          tribe.researchTech(techId);
          tribe.stars -= cost;
        }
        break;
      }
    }
  }

  /** GDD §5.2 — Collect biomes from all tiles within the city's territory radius. */
  private getTerritoryBiomes(city: City): Biome[] {
    const biomes: Biome[] = [];
    const radius = city.territoryRadius;
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const ds = -dq - dr;
        if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds)) <= radius) {
          const t = this.tiles.get(new HexCoord(city.position.q + dq, city.position.r + dr).toString());
          if (t) biomes.push(t.biome);
        }
      }
    }
    return biomes;
  }

  /** GDD §5.8 — Check all cities for siege state based on unit positions. */
  private updateSiegeState(): void {
    for (const tribe of this.tribes) {
      for (const city of tribe.cities) {
        if (city.captured) continue;
        // Check if any enemy unit is on this city's tile
        let enemyOnTile = false;
        for (const otherTribe of this.tribes) {
          if (otherTribe.id === tribe.id) continue;
          for (const unit of otherTribe.getAliveUnits()) {
            if (unit.position.equals(city.position)) {
              enemyOnTile = true;
              break;
            }
          }
          if (enemyOnTile) break;
        }
        city.isBesieged = enemyOnTile;
      }
    }
  }

  private collectAiResources(tribe: Tribe): void {
    this.updateSiegeState();
    let stars = 0;
    for (const city of tribe.cities) {
      const biomes = this.getTerritoryBiomes(city);
      stars += city.getStarsPerTurn(biomes);
      city.processFood(biomes);
    }
    // GDD §7.1 — Ice Bank income for Polaris AI
    if (tribe.id === 'polaris') {
      stars += this.countFrozenTiles();
    }
    tribe.stars += stars + tribe.starsPerTurn;
    this.healInactiveUnits(tribe);
  }

  private endTurn(): void {
    if (this.isAiRunning) return;
    this.collectHumanResources();
    this.advanceTurn();
  }

  /** Heal units that did not act this turn: +4 in friendly territory, +2 otherwise. Also fortifies them. */
  private healInactiveUnits(tribe: Tribe): void {
    for (const unit of tribe.getAliveUnits()) {
      if (unit.hasActed) continue; // only heal/fortify units that skipped their turn
      // Friendly territory = on or adjacent to any own city
      const inFriendlyTerritory = tribe.cities.some(city =>
        unit.position.distanceTo(city.position) <= 1,
      );
      unit.heal(inFriendlyTerritory ? 4 : 2);
      // GDD §4.2 — Units that skip their turn become fortified
      unit.fortified = true;
    }
  }

  private collectHumanResources(): void {
    this.updateSiegeState();
    let stars = 0;
    for (const city of this.humanTribe.cities) {
      const biomes = this.getTerritoryBiomes(city);
      stars += city.getStarsPerTurn(biomes);
      city.processFood(biomes);
    }
    // GDD §7.1 — Ice Bank income: +1 star per frozen tile on map
    const frozenTiles = this.countFrozenTiles();
    if (frozenTiles > 0) {
      stars += frozenTiles;
    }
    this.humanTribe.stars += stars + this.humanTribe.starsPerTurn;
    this.healInactiveUnits(this.humanTribe);
  }

  /** GDD §7.1 — Count frozen tiles (ICE biome) on the map. */
  private countFrozenTiles(): number {
    let count = 0;
    for (const tile of this.tiles.values()) {
      if (tile.biome === Biome.ICE || tile.biome === Biome.TUNDRA) count++;
    }
    return count;
  }

  /** GDD §7.1 — Polaris freeze mechanic: Mooni auto-freezes adjacent tiles, Gaami mass-freeze. */
  private applyPolarisFreeze(tribe: Tribe): void {
    if (tribe.id !== 'polaris') return;
    for (const unit of tribe.getAliveUnits()) {
      if (unit.hasFreeze || unit.hasMassFreeze) {
        const range = unit.hasMassFreeze ? 2 : 1;
        // Get all tiles within range using hex distance
        for (const [key, tile] of this.tiles) {
          const [q, r] = key.split(',').map(Number);
          const coord = new HexCoord(q, r);
          const dist = unit.position.distanceTo(coord);
          if (dist > 0 && dist <= range) {
            const biome = tile.biome as Biome;
            if (biome === Biome.WATER) {
              tile.biome = Biome.ICE;
            } else if (biome !== Biome.ICE && biome !== Biome.TUNDRA) {
              tile.biome = Biome.TUNDRA;
            }
          }
        }
      }
    }
  }

  /** GDD §7.3 — Elyrion: Sanctuary income (+1⭐/turn per adjacent animal)
   *  and spawn new animal every 3 turns near Sanctuary. */
  private applyElyrionSanctuary(tribe: Tribe): void {
    if (tribe.id !== 'elyrion') return;
    let sanctuaryCount = 0;
    for (const city of tribe.cities) {
      if (city.buildings.includes(BuildingType.SANCTUARY)) {
        sanctuaryCount++;
        // Count adjacent animal tiles
        let animalCount = 0;
        for (const dir of HexCoord.DIRECTIONS) {
          const adj = new HexCoord(city.position.q + dir.q, city.position.r + dir.r);
          const tile = this.tiles.get(adj.toString());
          if (tile && tile.resource === Resource.ANIMALS) animalCount++;
        }
        if (animalCount > 0) {
          tribe.stars += animalCount;
          this.setStatus(`${tribe.name} Sanctuary: +${animalCount}⭐ (${animalCount} adjacent animals)`);
        }

        // Spawn new animal every 3 turns
        if (this.state.turn % 3 === 0) {
          const emptyAdj = HexCoord.DIRECTIONS
            .map(d => new HexCoord(city.position.q + d.q, city.position.r + d.r))
            .find(adj => {
              const tile = this.tiles.get(adj.toString());
              return tile && tile.biome === Biome.FOREST && !tile.resource;
            });
          if (emptyAdj) {
            const tile = this.tiles.get(emptyAdj.toString())!;
            tile.resource = Resource.ANIMALS;
          }
        }
      }
    }
  }

  private advanceTurn(): void {
    const winner = this.turnManager.checkWinCondition(this.tribes);
    if (winner) {
      this.setStatus(`🏆 ${winner.name} wins!`);
      this.isAiRunning = true;
      return;
    }
    // Perfection mode turn limit
    if (this.gameMode === 'PERFECTION' && this.state.turn >= this.turnLimit) {
      this.showFinalScore();
      return;
    }
    this.state.nextTurn();
    // Auto-save after each turn (slot 0 = auto-save slot)
    try {
      SaveManager.save(0, this.state, this.tiles, this.gameMode, this.difficulty, this.speedMultiplier, this.mapType, this.turnLimit);
    } catch (e) {
      // Non-fatal: game continues even if save fails
      console.warn('Auto-save failed:', e);
    }
    this.startTurn();
  }

  private showFinalScore(): void {
    this.isAiRunning = true;
    const sorted = [...this.tribes].sort((a, b) => this.calcScore(b) - this.calcScore(a));

    // Build plain-text fallback for setStatus
    let msg = '🏁 GAME OVER — SCORES\n\n';
    for (const t of sorted) {
      const s = this.calcScore(t);
      msg += `${t.name}: ${s} pts${t === this.humanTribe ? ' (YOU)' : ''}\n`;
    }

    // Render breakdown panel for the human tribe (or first tribe if none)
    const humanTribe = this.humanTribe ?? sorted[0];
    if (humanTribe) {
      this.renderScoreBreakdown(humanTribe, sorted);
    }

    this.setStatus(msg);
  }

  private calcScore(tribe: Tribe): number {
    return this.calcScoreBreakdown(tribe).getTotal();
  }

  private calcScoreBreakdown(tribe: Tribe): ScoreBreakdown {
    const allCoords = Array.from(this.tiles.keys()).map(k => {
      const [q, r] = k.split(',').map(Number);
      return new HexCoord(q, r);
    });
    const exploredCount = this.state.tribeVisibility.get(tribe.id)?.size ?? 0;
    return computeTribeScore(tribe, allCoords, exploredCount);
  }

  /**
   * Render a visual score breakdown panel using Phaser text objects.
   * Shows each scoring category with count, per-unit value, and subtotal.
   */
  private renderScoreBreakdown(tribe: Tribe, _sorted: Tribe[]): void {
    const breakdown = this.calcScoreBreakdown(tribe);
    const panelX = 120;
    const panelY = 80;
    const lineH = 22;
    const colName = panelX;
    const colCount = panelX + 180;
    const colPer = panelX + 240;
    const colSub = panelX + 330;
    const headerStyle = { fontSize: '13px', color: '#8af', fontFamily: 'monospace' };
    const rowStyle = { fontSize: '13px', color: '#eee', fontFamily: 'monospace' };
    const totalStyle = { fontSize: '14px', color: '#ffd700', fontFamily: 'monospace' };

    // Background panel
    const panelWidth = 420;
    const panelHeight = 80 + breakdown.categories.length * lineH + 40;
    this.add.rectangle(panelX - 10, panelY - 30, panelWidth, panelHeight, 0x1a1a2e, 0.9)
      .setScrollFactor(0).setDepth(50);

    // Title
    this.add.text(panelX, panelY - 20, `🏁 ${tribe.name} — Score Breakdown`, {
      fontSize: '16px', color: '#ffd700', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(51);

    // Header row
    let y = panelY + 10;
    this.add.text(colName, y, 'Category', headerStyle).setScrollFactor(0).setDepth(51);
    this.add.text(colCount, y, 'Count', headerStyle).setScrollFactor(0).setDepth(51);
    this.add.text(colPer, y, '× Each', headerStyle).setScrollFactor(0).setDepth(51);
    this.add.text(colSub, y, '= Subtotal', headerStyle).setScrollFactor(0).setDepth(51);

    y += lineH;

    // Category rows
    for (const cat of breakdown.categories) {
      this.add.text(colName, y, cat.name, rowStyle).setScrollFactor(0).setDepth(51);
      this.add.text(colCount, y, `${cat.count}`, rowStyle).setScrollFactor(0).setDepth(51);
      this.add.text(colPer, y, `×${cat.perUnit}`, rowStyle).setScrollFactor(0).setDepth(51);
      this.add.text(colSub, y, `= ${cat.subtotal}`, rowStyle).setScrollFactor(0).setDepth(51);
      y += lineH;
    }

    // Total row
    y += 4;
    this.add.text(colName, y, 'TOTAL', totalStyle).setScrollFactor(0).setDepth(51);
    this.add.text(colSub, y, `${breakdown.getTotal()} pts`, totalStyle).setScrollFactor(0).setDepth(51);
  }

  /** GDD §8 — Reveal tiles within vision range of all units and cities of a tribe. */
  private revealTribeVision(tribe: Tribe): void {
    const allCoords = Array.from(this.tiles.keys()).map(k => {
      const [q, r] = k.split(',').map(Number);
      return new HexCoord(q, r);
    });
    // Units reveal tiles
    for (const unit of tribe.getAliveUnits()) {
      this.state.revealVision(tribe.id, unit.position, unit.visionRange, allCoords);
    }
    // Cities reveal tiles within 2-tile radius
    for (const city of tribe.cities) {
      if (!city.captured) {
        this.state.revealVision(tribe.id, city.position, 2, allCoords);
      }
    }
  }

  /** GDD §5.3 — Returns the two binary upgrade choices for a given level. */
  private getUpgradeChoices(level: number): { id: 'A' | 'B'; label: string }[] {
    switch (level) {
      case 2: return [
        { id: 'A', label: 'Workshop (+1⭐/turn)' },
        { id: 'B', label: 'Explorer (spawn 2 Scouts)' },
      ];
      case 3: return [
        { id: 'A', label: 'City Wall (×4 defense)' },
        { id: 'B', label: 'Resources (+5⭐ now)' },
      ];
      case 4: return [
        { id: 'A', label: 'Population Growth (+3 pop)' },
        { id: 'B', label: 'Border Growth (expand territory)' },
      ];
      case 5: return [
        { id: 'A', label: 'Park (+250 score)' },
        { id: 'B', label: 'Super Unit (Giant)' },
      ];
      default: return [];
    }
  }

  /** GDD §5.3 — Apply instant effects of a level-up choice. */
  private applyUpgradeEffect(city: City, choice: 'A' | 'B'): void {
    const level = city.level;
    if (level === 2 && choice === 'B') {
      // GDD §5.6 — Explorer: spawn a scout that moves autonomously
      const pos = this.findNearbyEmptyTile(city.position);
      if (pos) {
        const explorer = new Unit(pos, UnitType.SCOUT, this.humanTribe.id);
        this.humanTribe.addUnit(explorer);
        // Run autonomous pathfinding after a short delay for visual effect
        this.time.delayedCall(300, () => {
          this.runExplorerAutonomous(explorer);
        });
      }
    } else if (level === 3 && choice === 'B') {
      // Resources — +5⭐ now
      this.humanTribe.stars += 5;
    } else if (level === 4 && choice === 'A') {
      // Population Growth — +3 pop
      city.population += 3;
      // Reset food toward next pop threshold to avoid immediate double-growth
      city.food = 0;
    }
    // City Wall, Workshop, Border Growth, Park, Giant are passive flags
    // handled by the upgrade choice tracking on the City object
  }

  /** GDD §5.6 — Run autonomous explorer movement sequence. */
  private runExplorerAutonomous(explorer: Unit): void {
    if (!explorer.isAlive) return;

    const path = runExplorerPathfinding(
      explorer.position,
      this.state,
      explorer.owner,
      this.tiles,
      15,
    );

    if (path.length === 0) {
      explorer.hasActed = true;
      return;
    }

    // Execute moves with visual delay
    let stepIndex = 0;
    const moveNext = () => {
      if (stepIndex >= path.length || !explorer.isAlive) {
        explorer.hasActed = true;
        this.renderAll();
        this.updateUI();
        return;
      }
      const target = path[stepIndex];
      // only move to empty tiles (don't walk into units/cities)
      if (!this.findUnit(target) && !this.findCity(target)) {
        explorer.position = target;
        // Reveal vision from new position
        this.state.revealVision(explorer.owner, target, explorer.visionRange, this.getAllTileCoords());
      }
      stepIndex++;
      this.renderAll();
      this.updateUI();
      if (stepIndex < path.length) {
        this.time.delayedCall(150, moveNext);
      } else {
        explorer.hasActed = true;
      }
    };
    moveNext();
  }

  /** Get all tile coordinates from the tile map. */
  private getAllTileCoords(): HexCoord[] {
    const coords: HexCoord[] = [];
    for (const key of this.tiles.keys()) {
      const [q, r] = key.split(',').map(Number);
      coords.push(new HexCoord(q, r));
    }
    return coords;
  }

  /** Find an empty tile adjacent to center (for Explorer spawns). */
  private findNearbyEmptyTile(center: HexCoord): HexCoord | null {
    // Try distance 1
    for (const dir of HexCoord.DIRECTIONS) {
      const pos = new HexCoord(center.q + dir.q, center.r + dir.r);
      if (this.tiles.has(pos.toString())) {
        if (!this.findUnit(pos) && !this.findCity(pos)) {
          return pos;
        }
      }
    }
    // Try distance 2
    for (const d1 of HexCoord.DIRECTIONS) {
      for (const d2 of HexCoord.DIRECTIONS) {
        const pos = new HexCoord(center.q + d1.q + d2.q, center.r + d1.r + d2.r);
        if (this.tiles.has(pos.toString())) {
          if (!this.findUnit(pos) && !this.findCity(pos)) {
            return pos;
          }
        }
      }
    }
    return center; // fallback — place on the city itself
  }

  private handleClick(px: number, py: number): void {
    const worldX = px + this.cameras.main.scrollX;
    const worldY = py + this.cameras.main.scrollY;
    const coord = HexCoord.fromPixel(worldX, worldY, HEX_SIZE);
    if (!this.tiles.has(coord.toString())) return;

    const cur = this.state.getCurrentTribe();
    if (cur !== this.humanTribe || cur.isDefeated()) return;

    const cu = this.findUnit(coord);
    const cc = this.findCity(coord);

    // Selected unit attacks enemy
    if (this.selectedUnit && !this.selectedUnit.hasActed) {
      if (cu && cu.owner !== this.humanTribe.id) {
        if (CombatSystem.canAttack(this.selectedUnit, cu, this.tiles)) {
          const r = CombatSystem.executeAttack(this.selectedUnit, cu, this.tiles, this.state);

          // Start combat animation (non-blocking — game logic proceeds underneath)
          this.animateAttack(this.selectedUnit, cu, r.attackerDamage, r.defenderDamage, r.defenderKilled);

          this.selectedUnit.takeDamage(r.attackerDamage);
          cu.takeDamage(r.defenderDamage);

          // GDD §3.3 — Splash: Bomber deals half damage to all adjacent enemies
          if (this.selectedUnit.hasSplash && r.defenderDamage > 0) {
            const splashDmg = CombatSystem.calculateSplashDamage(r.defenderDamage);
            for (const adj of cu.position.neighbors()) {
              const adjUnit = this.findUnit(adj);
              if (adjUnit && adjUnit.owner !== this.selectedUnit.owner && adjUnit.isAlive && adjUnit.id !== cu.id) {
                adjUnit.takeDamage(splashDmg);
                if (!adjUnit.isAlive) {
                  const adjOwner = this.findTribeForUnit(adjUnit.id);
                  if (adjOwner) adjOwner.removeUnit(adjUnit.id);
                }
              }
            }
          }

          // GDD §3.3 — Escape: defender (Rider) retreats 1 tile when hit in melee
          if (cu.hasEscape && cu.isAlive) {
            const retreatDir = this.findRetreatDirection(cu, this.selectedUnit);
            if (retreatDir) {
              cu.position = retreatDir;
            }
          }

          if (r.defenderKilled) {
            const owner = this.findTribeForUnit(cu.id);
            if (owner) owner.removeUnit(cu.id);
            // Only melee units advance into the defender's tile on kill
            if (!this.selectedUnit.ranged) {
              this.selectedUnit.position = coord;
            }
            // GDD §4.4 — Track kills for veteran system
            if (!this.selectedUnit.isNaval && this.selectedUnit.type !== UnitType.GIANT) {
              this.selectedUnit.killCount++;
              if (this.selectedUnit.isEligibleForVeteran) this.selectedUnit.promoteVeteran();
            }
          }

          if (r.attackerKilled) {
            this.humanTribe.removeUnit(this.selectedUnit.id);
            this.selectedUnit = null;
          } else if (this.selectedUnit.hasStiff) {
            // GDD §3.3 — Stiff: unit cannot move after attacking
            this.selectedUnit.hasActed = true;
            this.selectedUnit = null;
            this.selectedHex = null;
          } else if (r.defenderKilled && this.selectedUnit.hasPersist) {
            // GDD §3.3 — Persist: Knight refreshes action on kill
            this.selectedUnit.hasAttacked = false;
            // Keep selected so player can attack another enemy
            this.selectedHex = coord;
          } else if (this.selectedUnit.hasEscape && this.selectedUnit.isAlive) {
            // GDD §3.3 — Escape: Rider can move after attacking
            this.selectedUnit.hasAttacked = true;
            // Keep selected so player can move remaining distance
            this.selectedHex = coord;
          } else {
            // Normal unit — done for the turn
            this.selectedUnit.hasActed = true;
            this.selectedUnit = null;
            this.selectedHex = null;
          }
          this.renderAll(); this.updateUI();
          return;
        }
      }

      // Attack city
      if (cc && cc.tribeId !== this.humanTribe.id) {
        const cd = createCity(cc.tribeId, coord.q, coord.r);
        if (CombatSystem.canAttackCity(this.selectedUnit, cd)) {
          const r = CombatSystem.executeCityAttack(this.selectedUnit, cd, this.tiles);
          if (r.cityCaptured) {
            cc.captured = true;
            // Remove from original owner's list so isDefeated() works
            for (const t of this.tribes) {
              if (t !== this.humanTribe) {
                const idx = t.cities.indexOf(cc);
                if (idx !== -1) { t.cities.splice(idx, 1); break; }
              }
            }
            cc.tribeId = this.humanTribe.id;
            this.humanTribe.addCity(cc);
          }
          this.selectedUnit.hasActed = true;
          this.selectedUnit = null;
          this.selectedHex = null;
          this.renderAll(); this.updateUI();
          return;
        }
      }

      // Move (GDD §3.2 — water movement + disembark)
      if (this.selectedUnit.position.distanceTo(coord) <= this.selectedUnit.movementRange) {
        const targetTile = this.tiles.get(coord.toString());
        const isWater = targetTile?.biome === Biome.WATER;

        // Block ground units from entering water
        if (isWater && !this.selectedUnit.isNaval) {
          // Not allowed — ignore click
          return;
        }

        // RAFT moving to land → disembark to original unit type
        if (!isWater && this.selectedUnit.type === UnitType.RAFT && this.selectedUnit.originalType) {
          const original = this.selectedUnit.originalType;
          this.humanTribe.removeUnit(this.selectedUnit.id);
          const newUnit = new Unit(coord, original, this.humanTribe.id, this.selectedUnit.health);
          newUnit.hasActed = true;
          this.humanTribe.addUnit(newUnit);
          this.selectedUnit = null;
          this.selectedHex = null;
          this.renderAll(); this.updateUI();
          return;
        }

        // GDD §3.2 — Scout 5×5 vision reveal on disembark (water → land)
        const wasOnWater = this.selectedUnit.isNaval && !isWater;
        const isScoutDisembark = wasOnWater && this.selectedUnit.type === UnitType.SCOUT;

        this.selectedUnit.position = coord;
        this.selectedUnit.hasActed = true;
        this.selectedUnit = null;
        this.selectedHex = null;

        if (isScoutDisembark) {
          // Reveal 5×5 area (hex range 2 ≈ diameter 5) around disembark point
          this.state.revealVision(this.humanTribe.id, coord, 2, this.getAllTileCoords());
        }

        this.renderAll(); this.updateUI();
        return;
      }
    }

    // Select own unit that hasn't acted yet — takes priority over city menu
    // so starting warriors (placed on the city tile) can be selected and moved.
    if (cu && cu.owner === this.humanTribe.id && !cu.hasActed) {
      this.selectedUnit = cu;
      this.selectedHex = coord;
      this.hideCityMenu();
      this.renderAll(); this.updateUI();
      return;
    }

    // Click on own city — show build menu (only after any unit on the tile has acted)
    if (cc && cc.tribeId === this.humanTribe.id) {
      this.selectedUnit = null;
      this.selectedHex = coord;
      this.showCityMenu(cc, coord);
      this.renderAll(); this.updateUI();
      return;
    }

    // Show info (dismiss city menu)
    this.selectedUnit = null;
    this.selectedHex = coord;
    this.hideCityMenu();
    this.renderAll(); this.updateUI();
  }

  private toggleTechPanel(): void {
    if (this.techPanel) { this.hideTechPanel(); return; }
    this.showTechPanel();
  }

  private showTechPanel(): void {
    this.hideTechPanel();
    if (this.state.getCurrentTribe() !== this.humanTribe) return;

    const cur = this.humanTribe;
    const numCities = cur.cities.filter(c => !c.captured).length;
    const techGroup = this.add.group();

    // Category definitions for filtering
    const SERIES_CATEGORY: Record<string, string> = {
      hunting: 'military', riding: 'military', frostwork: 'military', fungiculture: 'military',
      fishing: 'naval', aquaculture: 'naval',
      climbing: 'economic', organization: 'economic', farming: 'economic', ecology: 'economic',
    };
    const CATEGORY_LABELS: Record<string, string> = { all: 'ALL', military: 'MILITARY', economic: 'ECONOMIC', naval: 'NAVAL' };
    let activeFilter = 'all';

    // Filter series based on current tribe — exclude tribe-specific series that don't match
    const BASE_SERIES = new Set(['hunting', 'riding', 'fishing', 'climbing', 'organization', 'farming', 'aquaculture']);
    const TRIBE_EXTRA: Record<string, string[]> = {
      polaris: ['frostwork'],
      cymanti: ['fungiculture'],
      elyrion: ['ecology'],
    };
    const extra = TRIBE_EXTRA[cur.id] ?? [];
    const allSeries = TECH_SERIES_ORDER.filter(s => BASE_SERIES.has(s) || extra.includes(s));

    const getFilteredSeries = () => {
      if (activeFilter === 'all') return allSeries;
      return allSeries.filter(s => SERIES_CATEGORY[s] === activeFilter);
    };

    // Layout: split into 2 rows when >5 series so each column is ≥120px
    const filteredSeries = getFilteredSeries();
    const total = filteredSeries.length;
    const twoRows = total > 5;
    const colsPerRow = twoRows ? Math.ceil(total / 2) : total;
    const colW = Math.min(220, Math.floor(600 / colsPerRow));
    const startX = Math.max(80, Math.floor((720 - colsPerRow * colW) / 2));
    const rowGap = 230;
    const filterBarH = 32;
    const panelH = filterBarH + (twoRows ? 540 : 340);

    // Background panel
    const bg = this.add.graphics().setScrollFactor(0).setDepth(28);
    bg.fillStyle(0x111, 0.92);
    bg.fillRoundedRect(60, 40, 680, panelH, 8);
    techGroup.add(bg);

    const style = { fontSize: '14px', color: '#eee', fontFamily: 'monospace' };
    const titleStyle = { fontSize: '18px', color: '#ffd', fontFamily: 'monospace' };
    const headerStyle = { fontSize: '13px', color: '#8af', fontFamily: 'monospace' };
    const disabledStyle = { ...style, color: '#444' };
    const ownedStyle = { ...style, color: '#4c4' };

    // Title
    const title = this.add.text(300, 48, '— RESEARCH —', titleStyle).setScrollFactor(0).setDepth(29);
    techGroup.add(title);

    // Star balance display
    const starBalance = this.add.text(660, 48, `★ ${this.humanTribe.stars}`, {
      fontSize: '16px', color: '#ffd', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(29);
    techGroup.add(starBalance);

    // Filter tabs
    const filterKeys = ['all', 'military', 'economic', 'naval'];
    const filterStartX = 80;
    const filterY = 72;
    const filterTabW = 80;
    const filterTabH = 22;
    const filterTabs: Phaser.GameObjects.Text[] = [];
    const filterBgGraphics: Phaser.GameObjects.Graphics[] = [];

    filterKeys.forEach((cat, ci) => {
      const fx = filterStartX + ci * (filterTabW + 8);
      const fbg = this.add.graphics().setScrollFactor(0).setDepth(28);
      fbg.fillStyle(cat === activeFilter ? 0x335 : 0x222, 0.9);
      fbg.fillRoundedRect(fx, filterY, filterTabW, filterTabH, 4);
      techGroup.add(fbg);
      filterBgGraphics.push(fbg);

      const ftxt = this.add.text(fx + filterTabW / 2, filterY + 3, CATEGORY_LABELS[cat], {
        fontSize: '11px', color: cat === activeFilter ? '#ffd' : '#888', fontFamily: 'monospace'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(29);
      ftxt.setInteractive({ useHandCursor: true });
      ftxt.on('pointerdown', () => {
        activeFilter = cat;
        this.hideTechPanel();
        this.showTechPanel();
      });
      techGroup.add(ftxt);
      filterTabs.push(ftxt);
    });

    // Store node positions for dependency line drawing
    const nodePositions = new Map<TechId, { x: number; y: number }>();

    // Render series — each at its row/column position
    const seriesKeys = getFilteredSeries();
    seriesKeys.forEach((series, si) => {
      const rowIdx = twoRows ? Math.floor(si / colsPerRow) : 0;
      const colIdx = si % colsPerRow;
      const yBase = rowIdx * rowGap + filterBarH;

      // Series header
      const header = this.add.text(startX + colIdx * colW, 80 + yBase, series.toUpperCase(), headerStyle)
        .setScrollFactor(0).setDepth(29);
      techGroup.add(header);

      // Gather techs in this series, sorted by tier
      const tierIds: TechId[] = [];
      for (const def of Object.values(TECH_DEFS)) {
        if (def.series === series) tierIds.push(def.id);
      }
      tierIds.sort((a, b) => TECH_DEFS[a].tier - TECH_DEFS[b].tier);

      // Tiers
      tierIds.forEach((techId, tierIdx) => {
        const def = TECH_DEFS[techId];
        const owned = cur.hasTech(techId);
        const prereqs = def.prerequisites.every(p => cur.hasTech(p));
        const canResearch = !owned && prereqs;

        const y = 108 + yBase + tierIdx * 50;
        const cost = this.speedAdjustedCost(techCost(def.tier, numCities));

        const textStyle = owned ? ownedStyle : (canResearch ? style : disabledStyle);
        const label = owned
          ? `✓ ${def.name}`
          : `${def.name} (${cost}⭐)`;
        const txt = this.add.text(startX + colIdx * colW, y, label, textStyle)
          .setScrollFactor(0).setDepth(29);
        techGroup.add(txt);

        // Store center position for dependency lines
        nodePositions.set(techId, { x: startX + colIdx * colW, y: y + 7 });

        // Description
        const desc = this.add.text(startX + colIdx * colW, y + 18, def.description, {
          fontSize: '11px', color: owned ? '#484' : '#888', fontFamily: 'monospace'
        }).setScrollFactor(0).setDepth(29);
        techGroup.add(desc);

        // Progress bar for available techs (shows star accumulation toward cost)
        if (canResearch && !owned) {
          const barW = 80;
          const barH = 4;
          const barX = startX + colIdx * colW;
          const barY = y + 34;
          const progress = Math.min(1, this.humanTribe.stars / cost);

          const barBg = this.add.graphics().setScrollFactor(0).setDepth(29);
          barBg.fillStyle(0x333, 0.8);
          barBg.fillRect(barX, barY, barW, barH);
          techGroup.add(barBg);

          const barFill = this.add.graphics().setScrollFactor(0).setDepth(30);
          const fillColor = progress >= 1 ? 0x4c4 : 0x8af;
          barFill.fillStyle(fillColor, 0.9);
          barFill.fillRect(barX, barY, barW * progress, barH);
          techGroup.add(barFill);
        }

        if (canResearch && this.humanTribe.stars >= cost) {
          txt.setInteractive({ useHandCursor: true });
          txt.on('pointerover', () => txt.setStyle({ color: '#ff0' }));
          txt.on('pointerout', () => txt.setStyle({ color: '#eee' }));
          txt.on('pointerdown', () => {
            if (this.humanTribe.stars >= cost) {
              cur.researchTech(techId);
              this.humanTribe.stars -= cost;
              this.hideTechPanel();
              this.renderAll(); this.updateUI();
            }
          });
        }
      });
    });

    // Draw dependency edges (after all nodes positioned)
    const lineGfx = this.add.graphics().setScrollFactor(0).setDepth(27);
    for (const techId of nodePositions.keys()) {
      const def = TECH_DEFS[techId];
      const targetPos = nodePositions.get(techId)!;
      for (const prereqId of def.prerequisites) {
        const prereqPos = nodePositions.get(prereqId);
        if (!prereqPos) continue;

        const owned = cur.hasTech(techId);
        const prereqOwned = cur.hasTech(prereqId);
        const lineColor = owned ? 0x262 : (prereqOwned ? 0x468 : 0x335);
        const lineAlpha = owned ? 0.3 : (prereqOwned ? 0.7 : 0.4);

        lineGfx.lineStyle(2, lineColor, lineAlpha);
        // Draw from prereq bottom-center to target top-center with a midpoint bend
        const midY = (prereqPos.y + targetPos.y) / 2;
        lineGfx.beginPath();
        lineGfx.moveTo(prereqPos.x + 20, prereqPos.y + 12);
        lineGfx.lineTo(prereqPos.x + 20, midY);
        lineGfx.lineTo(targetPos.x + 20, midY);
        lineGfx.lineTo(targetPos.x + 20, targetPos.y - 2);
        lineGfx.strokePath();

        // Arrow head
        lineGfx.fillStyle(lineColor, lineAlpha);
        lineGfx.fillTriangle(
          targetPos.x + 20, targetPos.y - 2,
          targetPos.x + 16, targetPos.y + 4,
          targetPos.x + 24, targetPos.y + 4
        );
      }
    }
    techGroup.add(lineGfx);

    // Close hint
    const hintPosY = panelH - 16;
    const hint = this.add.text(300, hintPosY, '[ click TECH or elsewhere to close ]', {
      fontSize: '12px', color: '#888', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(29);
    techGroup.add(hint);

    this.techPanel = techGroup;
  }

  private hideTechPanel(): void {
    if (this.techPanel) {
      this.techPanel.destroy(true);
      this.techPanel = null;
    }
  }

  private showCityMenu(city: City, coord: HexCoord): void {
    this.hideCityMenu();
    this.selectedCity = city;
    const p = coord.toPixel(HEX_SIZE);
    // Menu position in SCREEN coordinates (text uses setScrollFactor(0)):
    // worldX - scrollX converts world coords to screen coords; the menu offset
    // is relative to the city's screen position
    const sx = p.x - this.cameras.main.scrollX + 40;
    const sy = p.y - this.cameras.main.scrollY - 20;

    const style = { fontSize: '14px', color: '#ffd', fontFamily: 'monospace',
      backgroundColor: '#222', padding: { x: 8, y: 4 } as const };
    const disabledStyle = { ...style, color: '#555' };

    // Only show menu on human's turn
    if (this.state.getCurrentTribe() !== this.humanTribe) return;

    // --- CITY INFO HEADER (GDD §5 city info display) ---
    const headerStyle = { fontSize: '15px', color: '#fff', fontFamily: 'monospace',
      backgroundColor: '#333', padding: { x: 8, y: 6 } as const };

    // Production indicator: show food progress toward next population
    const foodThreshold = city.population * 10;
    const productionText = foodThreshold > 0
      ? `Food: ${city.food}/${foodThreshold}`
      : 'Max Population';

    const headerItems: string[] = [
      `◆ ${city.name} (Lv${city.level})`,
      `Pop: ${city.population}  ${productionText}`,
    ];
    const headerCount = headerItems.length;

    const items: string[] = [];
    const handlers: (() => void)[] = [];

    // GDD §5.8 — Siege lock: besieged cities cannot build or train
    if (city.isBesieged) {
      items.push('⚔️ UNDER SIEGE — City locked!');
      handlers.push(() => {});
    }

    // --- TRAINABLE UNITS (filtered by tech) ---
    const trainableTypes = this.humanTribe.getTrainableUnitTypes();
    const trainableUnits: { type: UnitType; label: string }[] = trainableTypes.map(t => ({
      type: t, label: UnitType[t] || t
    }));

    for (const ut of trainableUnits) {
      const cost = this.speedAdjustedCost(UNIT_COSTS[ut.type]);
      const affordable = this.humanTribe.stars >= cost;
      const label = `TRAIN ${ut.label} (${cost}⭐)`;
      items.push(label);
      if (affordable) {
        handlers.push(() => {
          const spawnPos = this.findSpawnPosition(city);
          this.humanTribe.addUnit(new Unit(spawnPos, ut.type, this.humanTribe.id));
          this.humanTribe.stars -= cost;
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        });
      } else {
        handlers.push(() => {});
      }
    }

    // --- LEVEL UP CHOICES (GDD §5.3) ---
    if (city.canGrow()) {
      const upgradeCost = this.speedAdjustedCost(city.level * 5);
      const canAfford = this.humanTribe.stars >= upgradeCost;
      const nextLv = city.level + 1;

      items.push(`── LEVEL UP Lv${city.level}→${nextLv} (${upgradeCost}⭐) ──`);
      handlers.push(() => {});

      const choices = this.getUpgradeChoices(nextLv);
      for (const ch of choices) {
        items.push(`  [${ch.id}] ${ch.label}`);
        if (canAfford) {
          handlers.push(() => {
            city.applyLevelUp(ch.id);
            this.humanTribe.stars -= upgradeCost;
            this.applyUpgradeEffect(city, ch.id);
            // Border expansion pulse animation
            this.triggerBorderPulse(city);
            this.hideCityMenu();
            this.renderAll(); this.updateUI();
          });
        } else {
          handlers.push(() => {});
        }
      }
    }

    // --- GIANT (if Super Unit chosen at L5 and not yet summoned) ---
    if (city.level >= 5 && city.upgradeChoices[5] === 'B' && !city.giantSpawned) {
      items.push('SUMMON GIANT (0⭐)  40HP 5⚔ 4🛡');
      handlers.push(() => {
        city.giantSpawned = true;
        const spawnPos = this.findSpawnPosition(city);
        this.humanTribe.addUnit(new Unit(spawnPos, UnitType.GIANT, this.humanTribe.id));
        this.hideCityMenu();
        this.renderAll(); this.updateUI();
      });
    }

    // --- GDD §7.1 GAAMI (Polaris super unit at L5, replaces Giant for Polaris) ---
    if (city.level >= 5 && city.upgradeChoices[5] === 'B' && !city.giantSpawned && this.humanTribe.id === 'polaris') {
      items.push('SUMMON GAAMI (0⭐)  30HP 5⚔ 3🛡 Mass Freeze');
      handlers.push(() => {
        city.giantSpawned = true;
        const spawnPos = this.findSpawnPosition(city);
        this.humanTribe.addUnit(new Unit(spawnPos, UnitType.GAAMI, this.humanTribe.id));
        this.hideCityMenu();
        this.renderAll(); this.updateUI();
      });
    }

    // --- GDD §7.3 DRAGON MATURATION (Elyrion) ---
    if (this.humanTribe.id === 'elyrion' && this.humanTribe.hasTech(TechId.DRACONIC)) {
      const adjacentEggs = this.humanTribe.getAliveUnits().filter(u =>
        u.position.distanceTo(city.position) <= 1 && u.type === UnitType.EGG && !u.hasActed,
      );
      for (const egg of adjacentEggs) {
        items.push('MATURE EGG → BABY DRAGON (0⭐)');
        handlers.push(() => {
          const hp = egg.health;
          this.humanTribe.removeUnit(egg.id);
          const baby = new Unit(egg.position, UnitType.BABY_DRAGON, this.humanTribe.id, hp);
          baby.hasActed = true;
          this.humanTribe.addUnit(baby);
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        });
      }
      const adjacentBabies = this.humanTribe.getAliveUnits().filter(u =>
        u.position.distanceTo(city.position) <= 1 && u.type === UnitType.BABY_DRAGON && !u.hasActed,
      );
      for (const baby of adjacentBabies) {
        items.push('MATURE BABY DRAGON → FIRE DRAGON (0⭐)');
        handlers.push(() => {
          const hp = baby.health;
          this.humanTribe.removeUnit(baby.id);
          const fire = new Unit(baby.position, UnitType.FIRE_DRAGON, this.humanTribe.id, hp);
          fire.hasActed = true;
          this.humanTribe.addUnit(fire);
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        });
      }
    }

    // --- GDD §1.2 MONUMENT BUILDING (×30 scoring) ---
    // Monuments are city-level structures (not placed on tiles), cost 15⭐
    const monumentCost = this.speedAdjustedCost(15);
    if (this.humanTribe.stars >= monumentCost) {
      items.push(`BUILD MONUMENT (${monumentCost}⭐)  +30pts`);
      handlers.push(() => {
        city.monumentCount++;
        this.humanTribe.stars -= monumentCost;
        this.hideCityMenu();
        this.renderAll(); this.updateUI();
      });
    }

    // --- RENAME CITY (free) ---
    items.push('RENAME CITY (free)');
    handlers.push(() => {
      // Cycle through predefined names from the city name pool
      const namePool = CITY_NAMES[city.tribeId] || CITY_NAMES['Imperius'] || ['City'];
      const currentIdx = namePool.indexOf(city.name);
      const nextIdx = (currentIdx + 1) % namePool.length;
      city.name = namePool[nextIdx];
      this.hideCityMenu();
      this.renderAll(); this.updateUI();
    });

    // --- BUILDINGS ON ADJACENT TILES (GDD §5.2) ---
    const buildingMenuItems: { label: string; tileCoord: HexCoord; bt: BuildingType }[] = [];
    for (const n of city.position.neighbors()) {
      const t = this.tiles.get(n.toString());
      if (!t || !t.resource || t.building) continue;
      for (const bt of Object.values(BuildingType)) {
        const def = BUILDING_DEFS[bt];
        // Roads/bridges handled in trade routes section below
        if (bt === BuildingType.ROAD || bt === BuildingType.BRIDGE) continue;
        // Tribe-specific restrictions
        if (bt === BuildingType.ICE_BANK && this.humanTribe.id !== 'polaris') continue;
        if (bt === BuildingType.SANCTUARY && this.humanTribe.id !== 'elyrion') continue;
        if (bt === BuildingType.FUNGI_FARM && this.humanTribe.id !== 'cymanti') continue;
        if (bt === BuildingType.MYCELIUM_NETWORK && this.humanTribe.id !== 'cymanti') continue;
        if (bt === BuildingType.ALGAE_BRIDGE && this.humanTribe.id !== 'cymanti') continue;
        // Must match the tile's resource, not yet built, and affordable
        if (def.requiresResource !== t.resource) continue;
        if (city.buildings.includes(bt)) continue;
        if (this.humanTribe.stars < this.speedAdjustedCost(def.cost)) continue;
        buildingMenuItems.push({
          label: `${def.name} on ${t.resource} (${n.q},${n.r}) — ${this.speedAdjustedCost(def.cost)}⭐ +${def.popBonus}pop${def.starsBonus > 0 ? ` +${def.starsBonus}⭐/t` : ''}`,
          tileCoord: n,
          bt,
        });
      }
    }
    if (buildingMenuItems.length > 0) {
      items.push('── BUILDINGS ON ADJACENT TILES ──');
      handlers.push(() => {}); // separator
      for (const bi of buildingMenuItems) {
        items.push(bi.label);
        handlers.push(() => {
          const tile = this.tiles.get(bi.tileCoord.toString());
          if (tile) tile.building = bi.bt;
          city.buildings.push(bi.bt);
          const bdef = BUILDING_DEFS[bi.bt];
          city.population += bdef.popBonus;
          this.humanTribe.stars -= this.speedAdjustedCost(bdef.cost);
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        });
      }
    }

    // --- GDD §5.7 TRADE ROUTES: ROAD / BRIDGE ---
    const hasRoadTech = true; // Roads available from start
    if (hasRoadTech) {
      // Check for buildable road tiles (adjacent land without road)
      const roadTiles: HexCoord[] = [];
      const bridgeTiles: HexCoord[] = [];
      for (const n of city.position.neighbors()) {
        const t = this.tiles.get(n.toString());
        if (this.tradeRoutes.canBuildRoad(t)) roadTiles.push(n);
        if (this.tradeRoutes.canBuildBridge(t)) bridgeTiles.push(n);
      }
      if (roadTiles.length > 0 && this.humanTribe.stars >= this.speedAdjustedCost(BUILDING_DEFS[BuildingType.ROAD].cost)) {
        for (const rt of roadTiles) {
          const roadCost = this.speedAdjustedCost(BUILDING_DEFS[BuildingType.ROAD].cost);
          items.push(`  ROAD (${roadCost}⭐) → (${rt.q},${rt.r})`);
          handlers.push(() => {
            const tile = this.tiles.get(rt.toString());
            if (tile) tile.road = true;
            this.humanTribe.stars -= roadCost;
            // Re-detect connections
            const allCities = this.tribes.flatMap(t => t.cities);
            this.tradeRoutes.applyConnectionBonuses(allCities, this.tiles);
            this.hideCityMenu();
            this.renderAll(); this.updateUI();
          });
        }
      }
      if (bridgeTiles.length > 0 && this.humanTribe.stars >= this.speedAdjustedCost(BUILDING_DEFS[BuildingType.BRIDGE].cost)) {
        for (const bt of bridgeTiles) {
          const bridgeCost = this.speedAdjustedCost(BUILDING_DEFS[BuildingType.BRIDGE].cost);
          items.push(`  BRIDGE (${bridgeCost}⭐) → (${bt.q},${bt.r})`);
          handlers.push(() => {
            const tile = this.tiles.get(bt.toString());
            if (tile) tile.bridge = true;
            this.humanTribe.stars -= bridgeCost;
            // Re-detect connections
            const allCities = this.tribes.flatMap(t => t.cities);
            this.tradeRoutes.applyConnectionBonuses(allCities, this.tiles);
            this.hideCityMenu();
            this.renderAll(); this.updateUI();
          });
        }
      }
    }

    // --- GDD §3.2 NAVAL: EMBARK (if city has Port) ---
    const hasPort = city.buildings.includes(BuildingType.PORT);
    if (hasPort) {
      const adjacentUnits = this.humanTribe.getAliveUnits().filter(u =>
        u.position.distanceTo(city.position) <= 1 && !u.hasActed,
      );
      const embarkCandidates = adjacentUnits.filter(u => !u.isNaval && u.type !== UnitType.GIANT);
      if (embarkCandidates.length > 0) {
        items.push('── EMBARK ──');
        handlers.push(() => {});
        for (const eu of embarkCandidates) {
          items.push(`  EMBARK ${eu.type} → RAFT (free)`);
          handlers.push(() => {
            const hp = eu.health;
            this.humanTribe.removeUnit(eu.id);
            const raft = new Unit(eu.position, UnitType.RAFT, this.humanTribe.id, hp, eu.type);
            raft.hasActed = true;
            this.humanTribe.addUnit(raft);
            this.hideCityMenu();
            this.renderAll(); this.updateUI();
          });
        }
      }
    }

    // --- GDD §3.2 NAVAL: UPGRADE RAFT/RAMMER (if city has Port) ---
    if (hasPort) {
      const adjacentNaval = this.humanTribe.getAliveUnits().filter(u =>
        u.position.distanceTo(city.position) <= 1 && u.isNaval && !u.hasActed,
      );
      const raftUpgrade = adjacentNaval.find(u => u.type === UnitType.RAFT);
      const rammerUpgrade = adjacentNaval.find(u => u.type === UnitType.RAMMER);

      if (raftUpgrade || rammerUpgrade) {
        items.push('── NAVAL UPGRADE ──');
        handlers.push(() => {});
      }

      // RAFT → SCOUT (requires Sailing)
      if (raftUpgrade && this.humanTribe.hasTech(TechId.SAILING)) {
        const scoutCost = this.speedAdjustedCost(UNIT_COSTS[UnitType.SCOUT]);
        const canAfford = this.humanTribe.stars >= scoutCost;
        items.push(`  → SCOUT (${scoutCost}⭐)  2⚔ 1🛡 3🚶 Ranged`);
        handlers.push(canAfford ? () => {
          const hp = raftUpgrade.health;
          this.humanTribe.removeUnit(raftUpgrade.id);
          this.humanTribe.addUnit(new Unit(raftUpgrade.position, UnitType.SCOUT, this.humanTribe.id, hp));
          this.humanTribe.stars -= scoutCost;
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        } : () => {});
      }

      // RAFT → RAMMER (requires Navigation)
      if (raftUpgrade && this.humanTribe.hasTech(TechId.NAVIGATION)) {
        const rammerCost = this.speedAdjustedCost(UNIT_COSTS[UnitType.RAMMER]);
        const canAfford = this.humanTribe.stars >= rammerCost;
        items.push(`  → RAMMER (${rammerCost}⭐)  3⚔ 3🛡 3🚶`);
        handlers.push(canAfford ? () => {
          const hp = raftUpgrade.health;
          this.humanTribe.removeUnit(raftUpgrade.id);
          this.humanTribe.addUnit(new Unit(raftUpgrade.position, UnitType.RAMMER, this.humanTribe.id, hp));
          this.humanTribe.stars -= rammerCost;
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        } : () => {});
      }

      // RAMMER → BOMBER (requires Navigation)
      if (rammerUpgrade && this.humanTribe.hasTech(TechId.NAVIGATION)) {
        const bomberCost = this.speedAdjustedCost(UNIT_COSTS[UnitType.BOMBER]);
        const canAfford = this.humanTribe.stars >= bomberCost;
        items.push(`  → BOMBER (${bomberCost}⭐)  3⚔ 2🛡 2🚶 Splash`);
        handlers.push(canAfford ? () => {
          const hp = rammerUpgrade.health;
          this.humanTribe.removeUnit(rammerUpgrade.id);
          this.humanTribe.addUnit(new Unit(rammerUpgrade.position, UnitType.BOMBER, this.humanTribe.id, hp));
          this.humanTribe.stars -= bomberCost;
          this.hideCityMenu();
          this.renderAll(); this.updateUI();
        } : () => {});
      }
    }

    this.cityMenu = this.add.group();

    // Render city info header (non-interactive)
    headerItems.forEach((text, i) => {
      const hdr = this.add.text(sx, sy + i * 24, text, headerStyle)
        .setScrollFactor(0).setDepth(25);
      this.cityMenu!.add(hdr);
    });

    // Render menu items, offset below the header
    const itemOffsetY = headerCount * 24 + 8; // gap between header and items
    items.forEach((text, i) => {
      // Items are interactive unless they're a separator/header or locked
      const isSeparator = text.startsWith('──');
      const isClickable = handlers[i].toString().length > 15; // non-empty handler
      const canAfford = !isSeparator && isClickable;
      const lbl = this.add.text(sx, sy + itemOffsetY + i * 24, text, canAfford ? style : disabledStyle)
        .setScrollFactor(0).setDepth(25).setInteractive({ useHandCursor: canAfford });
      if (canAfford) {
        lbl.on('pointerdown', handlers[i]);
        lbl.on('pointerover', () => lbl.setStyle({ backgroundColor: '#444' }));
        lbl.on('pointerout', () => lbl.setStyle({ backgroundColor: '#222' }));
      }
      this.cityMenu!.add(lbl);
    });

    // "Close" hint
    const hint = this.add.text(sx, sy + itemOffsetY + items.length * 24 + 4, '[click elsewhere to close]', {
      fontSize: '11px', color: '#888', fontFamily: 'monospace'
    }).setScrollFactor(0).setDepth(25);
    this.cityMenu.add(hint);
  }

  private hideCityMenu(): void {
    if (this.cityMenu) {
      this.cityMenu.destroy(true);
      this.cityMenu = null;
    }
    this.selectedCity = null;
  }

  /** Trigger a border expansion pulse animation from the city center. */
  private triggerBorderPulse(city: City): void {
    const p = city.position.toPixel(HEX_SIZE);
    const cl = COLORS[city.tribeId] || 0x888;
    this.borderPulses.push({ x: p.x, y: p.y, progress: 0, tribeColor: cl });
  }

  /** Phaser update loop — animate border pulses and other visual effects. */
  update(_time: number, delta: number): void {
    // Animate border expansion pulses
    if (this.borderPulses.length > 0) {
      const dt = delta / 1000; // seconds
      for (const pulse of this.borderPulses) {
        pulse.progress += dt * 0.8; // ~1.25s animation
      }
      // Remove completed pulses
      this.borderPulses = this.borderPulses.filter(p => p.progress < 1);
      // Re-render to show pulse overlay
      this.renderAll();
    }
  }

  /** Find the best adjacent tile to spawn a unit from a city. Returns the city position as fallback. */
  private findSpawnPosition(city: City): HexCoord {
    for (const n of city.position.neighbors()) {
      const tile = this.tiles.get(n.toString());
      if (!tile || tile.biome === Biome.WATER) continue;
      const cc = this.findCity(n);
      if (cc) continue;
      const occupant = this.findUnit(n);
      if (occupant) continue;
      return n;
    }
    return city.position;
  }

  private findUnit(c: HexCoord): Unit | null {
    for (const t of this.tribes) {
      for (const u of t.getAliveUnits()) {
        if (u.position.equals(c)) return u;
      }
    }
    return null;
  }

  private findCity(c: HexCoord): City | null {
    for (const t of this.tribes) {
      for (const ct of t.cities) {
        if (ct.position.equals(c) && !ct.captured) return ct;
      }
    }
    return null;
  }

  private findTribeForUnit(unitId: string): Tribe | null {
    return this.tribes.find(t => t.getAliveUnits().some(u => u.id === unitId)) || null;
  }

  private renderAll(): void {
    this.hexGraphics.clear();
    this.entityGraphics.clear();
    this.rangeGraphics.clear();
    this.fogGraphics.clear();
    this.battlePreviewGraphics.clear();

    const humanTribeId = this.humanTribe.id;

    for (const [key, tile] of this.tiles) {
      const [q, r] = key.split(',').map(Number);
      const c = new HexCoord(q, r);
      const pos = c.toPixel(HEX_SIZE);
      const sel = this.selectedHex && this.selectedHex.equals(c);
      // GDD §5.2 — Territory boundary highlight (subtle colored border on edge tiles)
      let territoryHighlight: number | undefined;
      if (!sel) {
        for (const tribe of this.tribes) {
          for (const city of tribe.cities) {
            const dist = c.distanceTo(city.position);
            if (dist === city.territoryRadius) {
              territoryHighlight = 0x4488ff;
              break;
            }
          }
          if (territoryHighlight) break;
        }
      }
      this.drawHex(this.hexGraphics, pos.x, pos.y, HEX_SIZE, BiomeColors[tile.biome], sel ? 0xffff00 : territoryHighlight);
      // Resource dot
      if (tile.resource) {
        this.entityGraphics.fillStyle(ResourceColors[tile.resource], 0.9);
        this.entityGraphics.fillCircle(pos.x, pos.y - 2, 4);
      }
      // GDD §2.5 — Village marker
      if (tile.village) {
        this.entityGraphics.fillStyle(0xffffff, 0.85);
        this.entityGraphics.fillCircle(pos.x, pos.y - 2, 3);
        this.entityGraphics.lineStyle(1, 0x666, 0.5);
        this.entityGraphics.strokeCircle(pos.x, pos.y - 2, 3);
      }
      // GDD §5.7 — Road indicator (brown dashes on land)
      if (tile.road) {
        this.entityGraphics.lineStyle(2, 0x8B4513, 0.8);
        this.entityGraphics.lineBetween(pos.x - 5, pos.y + 4, pos.x + 5, pos.y + 4);
      }
      // GDD §5.7 — Bridge indicator (blue-gray dashes on water)
      if (tile.bridge) {
        this.entityGraphics.lineStyle(2, 0x708090, 0.9);
        this.entityGraphics.lineBetween(pos.x - 5, pos.y + 4, pos.x + 5, pos.y + 4);
      }
      // GDD §5.2 — Building icon on the tile (small filled square)
      if (tile.building) {
        const buildingColors: Record<string, number> = {
          [BuildingType.LUMBER_HUT]: 0x8B4513,
          [BuildingType.MINE]: 0x708090,
          [BuildingType.FARM]: 0xdaa520,
          [BuildingType.PORT]: 0x3b7dbd,
          [BuildingType.ICE_BANK]: 0xb0e0e6,
          [BuildingType.FUNGI_FARM]: 0x9b59b6,
          [BuildingType.MYCELIUM_NETWORK]: 0x7d3c98,
          [BuildingType.ALGAE_BRIDGE]: 0x2ecc71,
          [BuildingType.SANCTUARY]: 0x27ae60,
        };
        const bcolor = buildingColors[tile.building] ?? 0x888;
        this.entityGraphics.fillStyle(bcolor, 0.9);
        this.entityGraphics.fillRect(pos.x - 3, pos.y + 3, 6, 6);
        this.entityGraphics.lineStyle(1, 0x000, 0.5);
        this.entityGraphics.strokeRect(pos.x - 3, pos.y + 3, 6, 6);
      }
    }

    // GDD §8 — Fog of war overlay
    for (const [key, tile] of this.tiles) {
      const [q, r] = key.split(',').map(Number);
      const c = new HexCoord(q, r);
      const pos = c.toPixel(HEX_SIZE);
      const isVisible = this.state.isTileVisibleToTribe(c, humanTribeId);
      const isExplored = this.state.isTileExploredByTribe(c, humanTribeId);
      if (!isVisible && !isExplored) {
        // Black fog — unrevealed
        this.drawHex(this.fogGraphics, pos.x, pos.y, HEX_SIZE, 0x000000, undefined, 0.92);
      } else if (!isVisible && isExplored) {
        // Dimmed — explored but out of vision range
        this.drawHex(this.fogGraphics, pos.x, pos.y, HEX_SIZE, 0x000000, undefined, 0.55);
      }
    }

    // GDD §7.3 — Prophetic Vision: Elyrion can see unrevealed ruins through fog (rainbow flames)
    if (this.state.canSeeRuinsThroughFog(humanTribeId)) {
      for (const [key, tile] of this.tiles) {
        if (!tile.ruin || tile.ruinDiscovered) continue;
        const [q, r] = key.split(',').map(Number);
        const c = new HexCoord(q, r);
        const isVisible = this.state.isTileVisibleToTribe(c, humanTribeId);
        if (!isVisible) {
          const pos = c.toPixel(HEX_SIZE);
          // Rainbow flame indicator (cycling colors)
          const colors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x0088ff, 0x8800ff];
          const color = colors[Math.floor(this.time.now / 200) % colors.length];
          this.fogGraphics.fillStyle(color, 0.6);
          this.fogGraphics.fillCircle(pos.x, pos.y - 2, 4);
          this.fogGraphics.fillStyle(0xffffff, 0.8);
          this.fogGraphics.fillCircle(pos.x, pos.y - 2, 2);
        }
      }
    }

    // Range indicator
    if (this.selectedUnit && !this.selectedUnit.hasActed) {
      const p = this.selectedUnit.position.toPixel(HEX_SIZE);
      this.rangeGraphics.lineStyle(1, 0xffff00, 0.1);
      this.rangeGraphics.fillStyle(0xffff00, 0.05);
      this.rangeGraphics.fillCircle(p.x, p.y, this.selectedUnit.movementRange * HEX_SIZE * 2.3);
    }

    // Cities
    for (const t of this.tribes) {
      for (const city of t.cities) {
        if (city.captured) continue;
        // Sync city/cityWall flags onto the tile for combat defense bonus
        const tile = this.tiles.get(city.position.toString());
        if (tile) {
          tile.city = true;
          tile.cityWall = city.hasCityWall;
        }
        const p = city.position.toPixel(HEX_SIZE);
        const cl = COLORS[city.tribeId] || 0x888;
        const cityR = HEX_SIZE * 0.38;

        // GDD §5.3 — City wall outer ring (thick stone wall for L3+ with City Wall upgrade)
        if (city.hasCityWall) {
          this.entityGraphics.lineStyle(4, 0xc0c0c0, 0.85);
          this.entityGraphics.strokeCircle(p.x, p.y, cityR + 4);
          // Crenellation dots around the wall
          for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2 - Math.PI / 2;
            const wx = p.x + Math.cos(angle) * (cityR + 4);
            const wy = p.y + Math.sin(angle) * (cityR + 4);
            this.entityGraphics.fillStyle(0xa0a0a0, 0.9);
            this.entityGraphics.fillCircle(wx, wy, 2);
          }
        }

        // Main city circle
        this.entityGraphics.fillStyle(cl, 1);
        this.entityGraphics.fillCircle(p.x, p.y, cityR);

        // GDD §5.8 — Siege indicator: red border on besieged cities
        if (city.isBesieged) {
          this.entityGraphics.lineStyle(3, 0xe53935, 0.9);
        } else {
          this.entityGraphics.lineStyle(2, 0x000, 0.4);
        }
        this.entityGraphics.strokeCircle(p.x, p.y, cityR);

        // Level pips (bottom of city circle)
        for (let i = 0; i < city.level; i++) {
          this.entityGraphics.fillStyle(0xfff, 0.8);
          this.entityGraphics.fillCircle(p.x - 5 + i * 5, p.y + cityR - 3, 2);
        }

        // GDD §1.2 — Temple icon (gold triangle on top of city)
        if (city.templeCount > 0) {
          const ty = p.y - cityR - 6;
          for (let ti = 0; ti < Math.min(city.templeCount, 3); ti++) {
            const tx = p.x - 6 + ti * 6;
            this.entityGraphics.fillStyle(0xffd700, 0.95);
            this.entityGraphics.fillTriangle(tx, ty - 5, tx - 3, ty + 2, tx + 3, ty + 2);
          }
        }

        // GDD §1.2 — Monument icon (blue diamond on right side of city)
        if (city.monumentCount > 0) {
          const mx = p.x + cityR + 4;
          const my = p.y - 2;
          for (let mi = 0; mi < Math.min(city.monumentCount, 2); mi++) {
            const dy = my + mi * 7;
            this.entityGraphics.fillStyle(0x4fc3f7, 0.95);
            this.entityGraphics.fillTriangle(mx, dy - 4, mx - 3, dy, mx, dy + 4);
            this.entityGraphics.fillTriangle(mx, dy - 4, mx + 3, dy, mx, dy + 4);
          }
        }

        // Population growth bar (green progress bar below city circle)
        // Shows food progress toward next population threshold
        const popThreshold = city.population * 10;
        if (popThreshold > 0 && city.population < 10) {
          const barW = cityR * 1.6;
          const barH = 3;
          const barX = p.x - barW / 2;
          const barY = p.y + cityR + 3;
          // Background
          this.entityGraphics.fillStyle(0x333, 0.7);
          this.entityGraphics.fillRect(barX, barY, barW, barH);
          // Fill (green if >50%, yellow if >25%, red otherwise)
          const ratio = city.food / popThreshold;
          const fillColor = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffc107 : 0xf44336;
          this.entityGraphics.fillStyle(fillColor, 0.9);
          this.entityGraphics.fillRect(barX, barY, barW * Math.min(ratio, 1), barH);
          // Border
          this.entityGraphics.lineStyle(1, 0x000, 0.4);
          this.entityGraphics.strokeRect(barX, barY, barW, barH);
        }
      }
    }

    // Border expansion pulse animations
    for (const pulse of this.borderPulses) {
      const alpha = 1 - pulse.progress; // fade out
      const radius = HEX_SIZE * 0.38 + pulse.progress * HEX_SIZE * 2.5;
      this.entityGraphics.lineStyle(3 * (1 - pulse.progress), pulse.tribeColor, alpha * 0.6);
      this.entityGraphics.strokeCircle(pulse.x, pulse.y, radius);
    }

    // Units
    for (const t of this.tribes) {
      for (const u of t.getAliveUnits()) {
        // GDD §8 — Enemy units in fog are not visible to the human player
        if (t.id !== humanTribeId && !this.state.isTileVisibleToTribe(u.position, humanTribeId)) {
          continue;
        }
        const p = u.position.toPixel(HEX_SIZE);
        const sel = this.selectedUnit === u;
        const cl = COLORS[u.owner] || 0x888;
        const r = sel ? HEX_SIZE * 0.33 : HEX_SIZE * 0.28;
        this.entityGraphics.fillStyle(cl, 1);
        this.entityGraphics.fillCircle(p.x, p.y, r);
        this.entityGraphics.lineStyle(sel ? 3 : 1, 0x000, 0.6);
        this.entityGraphics.strokeCircle(p.x, p.y, r);
        this.entityGraphics.fillStyle(0x000, 0.6);
        this.entityGraphics.fillCircle(p.x, p.y, r * 0.85);
        this.entityGraphics.fillStyle(cl, 1);
        this.entityGraphics.fillCircle(p.x, p.y, r * 0.65);
        // Health
        const bw = r * 1.4, bh = 3;
        this.entityGraphics.fillStyle(0x000, 0.7);
        this.entityGraphics.fillRect(p.x - bw / 2, p.y - r - 5, bw, bh);
        this.entityGraphics.fillStyle(u.health > 3 ? 0x4c4 : 0xc44, 1);
        this.entityGraphics.fillRect(p.x - bw / 2, p.y - r - 5, bw * (u.health / UNIT_MAX_HEALTH[u.type]), bh);
        // GDD §4.2 — Shield indicator for fortified units
        if (u.isFortified) {
          const tile = this.tiles.get(u.position.toString());
          const hasCityWall = tile?.cityWall ?? false;
          const shieldY = p.y + r + 4;
          if (hasCityWall) {
            // Double shield (×4.0 defense) — gold
            this.entityGraphics.lineStyle(2, 0xffd700, 0.9);
            this.entityGraphics.strokeCircle(p.x - 3, shieldY, 4);
            this.entityGraphics.strokeCircle(p.x + 3, shieldY, 4);
          } else {
            // Single shield (×1.5 defense) — light blue
            this.entityGraphics.lineStyle(2, 0x87ceeb, 0.9);
            this.entityGraphics.strokeCircle(p.x, shieldY, 4);
          }
        }
      }
    }
  }

  private updateUI(): void {
    const cur = this.state.getCurrentTribe();
    this.tribeText.setText(`${cur?.name ?? '?'}  Turn ${this.state.turn}`);
    const foodInfo = this.humanTribe.cities.length > 0
      ? ` 🍖${this.humanTribe.cities[0].food}/${this.humanTribe.cities[0].population * 10}`
      : '';
    this.phaseText.setText(`Stars: ${cur?.stars ?? 0}  ⭐+${this.getHumanStarIncome()}/turn${foodInfo}  Cities: ${this.humanTribe.cities.filter(c => !c.captured).length}`);
    // GDD §4.7 — Don't overwrite battle preview text
    if (!this.hoveredEnemy) {
    let info = '';
    if (this.selectedHex) {
      const tile = this.tiles.get(this.selectedHex.toString());
      const u = this.findUnit(this.selectedHex);
      const c = this.findCity(this.selectedHex);
      if (tile) info += `[${this.selectedHex.q},${this.selectedHex.r}] ${tile.biome}`;
      if (c) info += ` 🏘 ${c.name} Lv${c.level}`;
      if (!c && tile?.village) info += ` 🏕 Village`;
      if (u) info += ` ⚔ ${u.type} HP:${u.health}/10`;
    }
    this.infoText.setText(info);
    }
    // Wait button visibility: show when a unit is selected and hasn't acted
    if (this.waitBtn) {
      this.waitBtn.setVisible(!!this.selectedUnit && !this.selectedUnit.hasActed);
    }
    // Convert button: show when a Mind Bender is selected and hasn't acted
    if (this.convertBtn) {
      this.convertBtn.setVisible(!!this.selectedUnit && this.selectedUnit.hasConvert && !this.selectedUnit.hasActed);
    }
    // Heal button: show when a Mind Bender is selected and hasn't acted
    if (this.healBtn) {
      this.healBtn.setVisible(!!this.selectedUnit && this.selectedUnit.hasHeal && !this.selectedUnit.hasActed);
    }
    // Submerge button: show when a Cloak is selected, hasn't acted, and is not submerged
    if (this.submergeBtn) {
      this.submergeBtn.setVisible(!!this.selectedUnit && this.selectedUnit.hasHide && !this.selectedUnit.hasActed && !this.selectedUnit.isSubmerged);
    }
    // Emerge button: show when a Cloak is selected, hasn't acted, and is submerged
    if (this.emergeBtn) {
      this.emergeBtn.setVisible(!!this.selectedUnit && this.selectedUnit.hasHide && !this.selectedUnit.hasActed && this.selectedUnit.isSubmerged);
    }
    // Infiltrate button: show when a Cloak is selected, hasn't acted, submerged, and primed
    if (this.infiltrateBtn) {
      this.infiltrateBtn.setVisible(!!this.selectedUnit && this.selectedUnit.hasInfiltrate && !this.selectedUnit.hasActed && this.selectedUnit.isSubmerged && this.selectedUnit.primedForInfiltrate);
    }
    // Enchantment button: show when a Polytaur is selected and hasn't acted
    if (this.enchantBtn) {
      const showEnchant = !!this.selectedUnit && this.selectedUnit.type === UnitType.POLYTAUR && !this.selectedUnit.hasActed;
      this.enchantBtn.setVisible(showEnchant);
      if (showEnchant) {
        const enchantCost = this.speedAdjustedCost(3);
        const canAfford = this.humanTribe.stars >= enchantCost;
        this.enchantBtn.setStyle({ color: canAfford ? '#f8f' : '#888' });
      }
    }
  }

  private setStatus(m: string): void { this.phaseText.setText(m); }

  private getHumanStarIncome(): number {
    let income = this.humanTribe.starsPerTurn;
    for (const city of this.humanTribe.cities) {
      const biomes = this.getTerritoryBiomes(city);
      income += city.getStarsPerTurn(biomes);
    }
    return income;
  }

  /**
   * GDD §3.4 — Convert: Mind Bender converts an adjacent enemy unit to your tribe.
   * Cannot convert naval units or Giants.
   */
  private performConvert(mindBender: Unit): void {
    const cur = this.state.getCurrentTribe();
    if (cur.id !== mindBender.owner) return;

    // Find adjacent enemy unit
    let target: Unit | null = null;
    for (const dir of HexCoord.DIRECTIONS) {
      const adj = new HexCoord(mindBender.position.q + dir.q, mindBender.position.r + dir.r);
      const unit = this.findUnit(adj);
      if (unit && unit.owner !== mindBender.owner) {
        // GDD §3.4 — Cannot convert naval units or Giants
        if (unit.isNaval || unit.type === UnitType.GIANT) {
          this.setStatus('Cannot convert naval units or Giants.');
          return;
        }
        target = unit;
        break;
      }
    }

    if (!target) {
      this.setStatus('No adjacent enemy unit to convert.');
      return;
    }

    this.state.convertUnit(target, mindBender.owner);
    this.setStatus(`Converted ${target.type} to ${cur.name}!`);
    this.renderAll();
    this.updateUI();
  }

  /**
   * GDD §3.4 — Heal: Mind Bender restores 4 HP to all adjacent friendly units.
   */
  private performHeal(mindBender: Unit): void {
    const cur = this.state.getCurrentTribe();
    if (cur.id !== mindBender.owner) return;

    let healed = 0;
    for (const dir of HexCoord.DIRECTIONS) {
      const adj = new HexCoord(mindBender.position.q + dir.q, mindBender.position.r + dir.r);
      const unit = this.findUnit(adj);
      if (unit && unit.owner === mindBender.owner && unit.health < unit.maxHealth) {
        unit.heal(4);
        healed++;
      }
    }

    mindBender.hasActed = true;
    this.setStatus(`Healed ${healed} adjacent friendly unit(s) for +4 HP.`);
    this.selectedUnit = null;
    this.selectedHex = null;
    this.renderAll();
    this.updateUI();
  }

  /**
   * GDD §3.5 — Infiltrate: Cloak infiltrates an adjacent enemy city.
   * The Cloak is consumed, and a Dagger spawns inside the city on the next turn.
   */
  private performInfiltrate(cloak: Unit): void {
    const cur = this.state.getCurrentTribe();
    if (cur.id !== cloak.owner) return;
    const city = this.state.performInfiltrate(cloak);
    if (!city) {
      this.setStatus('No adjacent enemy city to infiltrate.');
      return;
    }
    this.setStatus(`Infiltrated ${city.name}! Dagger will spawn next turn.`);
    this.selectedUnit = null;
    this.selectedHex = null;
    this.renderAll();
    this.updateUI();
  }

  /** GDD §7.3 — Enchantment: Polytaur converts an adjacent wild animal into Polytaur form.
   *  Costs 3⭐. The animal tile becomes empty and a Polytaur unit appears. */
  private performEnchantment(polytaur: Unit): void {
    const cur = this.state.getCurrentTribe();
    if (cur.id !== polytaur.owner) return;
    const enchantCost = this.speedAdjustedCost(3);
    if (cur.stars < enchantCost) {
      this.setStatus(`Not enough stars for Enchantment (need ${enchantCost}⭐).`);
      return;
    }

    // Find adjacent animal tile
    let targetTile: HexCoord | null = null;
    for (const dir of HexCoord.DIRECTIONS) {
      const adj = new HexCoord(polytaur.position.q + dir.q, polytaur.position.r + dir.r);
      const tile = this.tiles.get(adj.toString());
      if (tile && tile.resource === Resource.ANIMALS) {
        targetTile = adj;
        break;
      }
    }

    if (!targetTile) {
      this.setStatus('No adjacent wild animal to enchant.');
      return;
    }

    // Remove the animal resource and spawn Polytaur
    const tile = this.tiles.get(targetTile.toString())!;
    tile.resource = undefined;
    cur.stars -= enchantCost;
    const newPolytaur = new Unit(targetTile, UnitType.POLYTAUR, cur.id);
    newPolytaur.hasActed = true;
    cur.addUnit(newPolytaur);

    polytaur.hasActed = true;
    this.setStatus('Enchanted wild animal into Polytaur! (3⭐)');
    this.selectedUnit = null;
    this.selectedHex = null;
    this.renderAll();
    this.updateUI();
  }

  /**
   * GDD §3.3 — Escape: find a tile for `defender` to retreat to, away from `attacker`.
   * Tries to move 1 tile in the direction opposite the attacker.
   * Falls back to any walkable unoccupied adjacent tile, then null.
   */
  /**
   * Animate a combat attack sequence: attacker lunges toward target,
   * damage numbers float up, destroyed units fade out.
   * Returns a promise that resolves when the animation completes (~400-500ms).
   * Game logic (damage application, death checks) must be handled separately;
   * this only produces visual feedback.
   *
   * This is deliberately decoupled from the CombatSystem pure-logic layer
   * so animations never block or modify game state.
   */
  private animateAttack(attacker: Unit, defender: Unit, attackerDamage: number, defenderDamage: number, defenderDies: boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      this.soundManager.playAttackHit();
      const attackerPos = attacker.position;
      const defenderPos = defender.position;
      const startPixel = attackerPos.toPixel(HEX_SIZE);
      const targetPixel = defenderPos.toPixel(HEX_SIZE);

      // Compute lunge direction (normalized to ~12px) — used only for melee
      const dx = targetPixel.x - startPixel.x;
      const dy = targetPixel.y - startPixel.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const lungeDist = Math.min(12, HEX_SIZE * 0.3);
      const lungeX = (dx / dist) * lungeDist;
      const lungeY = (dy / dist) * lungeDist;

      this.isAnimating = true;
      this.animatingUnitId = attacker.id;

      const totalDuration = defenderDies ? 450 : 350;
      let elapsed = 0;

      // Floating damage texts
      const dmgTexts: Phaser.GameObjects.Text[] = [];

      const dmgToDef = this.add.text(targetPixel.x, targetPixel.y - 15, `-${defenderDamage}`, {
        fontSize: '14px', color: '#ff6666', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(50);
      dmgTexts.push(dmgToDef);

      if (attackerDamage > 0) {
        const dmgToAtk = this.add.text(startPixel.x + 10, startPixel.y - 15, `-${attackerDamage}`, {
          fontSize: '12px', color: '#ffaa44', fontFamily: 'monospace', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);
        dmgTexts.push(dmgToAtk);
      }

      if (defenderDies) {
        this.soundManager.playUnitDeath();
        const skull = this.add.text(targetPixel.x, targetPixel.y + 10, '�', {
          fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(50);
        dmgTexts.push(skull);
      }

      // Suppress base rendering of the attacker/defender during animation
      // by temporarily hiding their positions (set to null-equivalent)
      const origAtkPos = attacker.position;
      const origDefPos = defender.position;

      // Ranged units fire a projectile instead of lunging
      const isRanged = attacker.ranged;

      const tickFn = (_time: number, delta: number) => {
        elapsed += delta;
        const t = Math.min(elapsed / totalDuration, 1);

        // Clear and redraw everything except the animating units
        this.entityGraphics.clear();

        // Redraw all entities except the ones being animated
        const humanTribeId = this.humanTribe.id;
        for (const tribe of this.tribes) {
          if (tribe.isDefeated()) continue;
          // Cities
          for (const city of tribe.cities) {
            if (city.captured) continue;
            if (city.position.equals(origDefPos) && defenderDies) {
              // Still draw city under fading defender
            }
            const p = city.position.toPixel(HEX_SIZE);
            const cl = COLORS[city.tribeId] || 0x888;
            this.entityGraphics.fillStyle(cl, 1);
            this.entityGraphics.fillCircle(p.x, p.y, HEX_SIZE * 0.38);
            this.entityGraphics.lineStyle(city.isBesieged ? 3 : 2, city.isBesieged ? 0xe53935 : 0x000, city.isBesieged ? 0.9 : 0.4);
            this.entityGraphics.strokeCircle(p.x, p.y, HEX_SIZE * 0.38);
          }
          // Units — skip the animating ones
          for (const u of tribe.getAliveUnits()) {
            // Skip attacker and defender (drawn separately below with animation)
            if (u.id === attacker.id || u.id === defender.id) continue;
            if (tribe.id !== humanTribeId && !this.state.isTileVisibleToTribe(u.position, humanTribeId)) continue;
            const p = u.position.toPixel(HEX_SIZE);
            const cl = COLORS[u.owner] || 0x888;
            const r = HEX_SIZE * 0.28;
            this.entityGraphics.fillStyle(cl, 1);
            this.entityGraphics.fillCircle(p.x, p.y, r);
            this.entityGraphics.lineStyle(1, 0x000, 0.6);
            this.entityGraphics.strokeCircle(p.x, p.y, r);
            this.entityGraphics.fillStyle(0x000, 0.6);
            this.entityGraphics.fillCircle(p.x, p.y, r * 0.85);
            this.entityGraphics.fillStyle(cl, 1);
            this.entityGraphics.fillCircle(p.x, p.y, r * 0.65);
          }
        }

        // Attacker rendering: lunge for melee, stationary for ranged
        const c = COLORS[attacker.owner] || 0x888;
        const ar = HEX_SIZE * 0.33;

        if (isRanged) {
          // Ranged: attacker stays at origin, projectile travels to target
          // Projectile position: ease from start to target over first 40% of animation
          const projT = Math.min(1, t / 0.4);
          const projX = startPixel.x + dx * projT;
          const projY = startPixel.y + dy * projT;

          // Draw projectile (arrow/bomb sprite as a small bright circle with trail)
          const projColor = attacker.type === UnitType.CATAPULT ? 0x553311 : 0xccddff;
          const projSize = attacker.type === UnitType.CATAPULT ? 5 : 3;
          this.entityGraphics.fillStyle(projColor, 1);
          this.entityGraphics.fillCircle(projX, projY, projSize);
          // Trail
          this.entityGraphics.fillStyle(projColor, 0.3);
          this.entityGraphics.fillCircle(projX - dx * 0.02, projY - dy * 0.02, projSize + 1);

          // Draw attacker at origin (stationary)
          this.entityGraphics.fillStyle(c, 1);
          this.entityGraphics.fillCircle(startPixel.x, startPixel.y, ar);
          this.entityGraphics.lineStyle(3, 0x000, 0.6);
          this.entityGraphics.strokeCircle(startPixel.x, startPixel.y, ar);
          this.entityGraphics.fillStyle(0x000, 0.6);
          this.entityGraphics.fillCircle(startPixel.x, startPixel.y, ar * 0.85);
          this.entityGraphics.fillStyle(c, 1);
          this.entityGraphics.fillCircle(startPixel.x, startPixel.y, ar * 0.65);
          // Health bar
          const bw = ar * 1.4, bh = 3;
          this.entityGraphics.fillStyle(0x000, 0.7);
          this.entityGraphics.fillRect(startPixel.x - bw / 2, startPixel.y - ar - 5, bw, bh);
          this.entityGraphics.fillStyle(attacker.health > 3 ? 0x4c4 : 0xc44, 1);
          this.entityGraphics.fillRect(startPixel.x - bw / 2, startPixel.y - ar - 5, bw * (attacker.health / UNIT_MAX_HEALTH[attacker.type]), bh);
        } else {
          // Melee: lunge ease — forward then back
          const lungeT = t < 0.4
            ? Math.sin((t / 0.4) * Math.PI)       // 0→1→0 over first 40%
            : Math.max(0, 1 - (t - 0.4) / 0.6);   // 1→0 over last 60%
          const currentX = startPixel.x + lungeX * lungeT;
          const currentY = startPixel.y + lungeY * lungeT;

          // Draw attacker at lunged position
          this.entityGraphics.fillStyle(c, 1);
          this.entityGraphics.fillCircle(currentX, currentY, ar);
          this.entityGraphics.lineStyle(3, 0x000, 0.6);
          this.entityGraphics.strokeCircle(currentX, currentY, ar);
          this.entityGraphics.fillStyle(0x000, 0.6);
          this.entityGraphics.fillCircle(currentX, currentY, ar * 0.85);
          this.entityGraphics.fillStyle(c, 1);
          this.entityGraphics.fillCircle(currentX, currentY, ar * 0.65);
          // Health bar
          const bw = ar * 1.4, bh = 3;
          this.entityGraphics.fillStyle(0x000, 0.7);
          this.entityGraphics.fillRect(currentX - bw / 2, currentY - ar - 5, bw, bh);
          this.entityGraphics.fillStyle(attacker.health > 3 ? 0x4c4 : 0xc44, 1);
          this.entityGraphics.fillRect(currentX - bw / 2, currentY - ar - 5, bw * (attacker.health / UNIT_MAX_HEALTH[attacker.type]), bh);
        }

        // Impact flash (t: 0.3–0.45)
        if (t > 0.3 && t < 0.45) {
          const flashAlpha = (1 - (t - 0.3) / 0.15) * 0.3;
          this.entityGraphics.fillStyle(0xff4444, flashAlpha);
          this.entityGraphics.fillCircle(targetPixel.x, targetPixel.y, HEX_SIZE * 0.5);
        }

        // Defender: fade out if dying
        if (defenderDies && t > 0.5) {
          const fadeT = (t - 0.5) / 0.5;
          const fadeAlpha = 1 - fadeT;
          const fadeR = HEX_SIZE * 0.3 * (1 - fadeT * 0.5);
          const dc = COLORS[defender.owner] || 0x888;
          this.entityGraphics.fillStyle(dc, fadeAlpha);
          this.entityGraphics.fillCircle(targetPixel.x, targetPixel.y, fadeR);
          this.entityGraphics.lineStyle(1, 0x000, fadeAlpha * 0.6);
          this.entityGraphics.strokeCircle(targetPixel.x, targetPixel.y, fadeR);
        }

        // Damage text float-up (t: 0.2 to 0.8)
        if (t > 0.15) {
          const textT = Math.min(1, (t - 0.15) / 0.65);
          const yOffset = textT * 22;
          dmgTexts[0].setAlpha(1 - textT).setY(targetPixel.y - 15 - yOffset);
          if (dmgTexts[1]) dmgTexts[1].setAlpha(1 - textT).setY(startPixel.y - 15 - yOffset);
          if (dmgTexts[2]) dmgTexts[2].setAlpha(1 - textT).setY(targetPixel.y + 10 - yOffset);
        }

        if (t >= 1) {
          this.time.removeEvent(timer);
          for (const txt of dmgTexts) txt.destroy();
          this.entityGraphics.clear();
          this.isAnimating = false;
          this.animatingUnitId = null;
          resolve();
        }
      };

      const timer = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: tickFn,
      });
    });
  }

  private findRetreatDirection(defender: Unit, attacker: Unit): HexCoord | null {
    const defPos = defender.position;
    const atkPos = attacker.position;

    // Direction vector from attacker to defender (axial)
    const dq = Math.sign(defPos.q - atkPos.q);
    const dr = Math.sign(defPos.r - atkPos.r);

    // Try opposite direction first
    const opposite = new HexCoord(defPos.q + dq, defPos.r + dr);
    const oppKey = opposite.toString();
    const oppTile = this.tiles.get(oppKey);
    if (oppTile && oppTile.biome !== Biome.WATER && !this.findUnit(opposite) && !this.findCity(opposite)) {
      return opposite;
    }

    // Fall back to any walkable unoccupied adjacent tile
    for (const dir of HexCoord.DIRECTIONS) {
      const nb = new HexCoord(defPos.q + dir.q, defPos.r + dir.r);
      const nbKey = nb.toString();
      const nbTile = this.tiles.get(nbKey);
      if (nbTile && nbTile.biome !== Biome.WATER && !this.findUnit(nb) && !this.findCity(nb)) {
        return nb;
      }
    }

    return null; // nowhere to retreat
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r));
  }

  /**
   * GDD §4.7 — Battle preview: calculate and display predicted combat results
   * when hovering over an enemy unit with a selected friendly unit.
   */
  private updateBattlePreview(px: number, py: number): void {
    this.battlePreviewGraphics.clear();
    this.hoveredEnemy = null;

    const worldX = px + this.cameras.main.scrollX;
    const worldY = py + this.cameras.main.scrollY;
    const coord = HexCoord.fromPixel(worldX, worldY, HEX_SIZE);
    if (!this.tiles.has(coord.toString())) return;

    const selected = this.selectedUnit;
    if (!selected) return;

    const target = this.findUnit(coord);
    if (!target || target.owner === this.humanTribe.id || !target.isAlive) return;
    if (!CombatSystem.canAttack(selected, target, this.tiles)) return;

    this.hoveredEnemy = target;
    const result = CombatSystem.executeAttack(selected, target, this.tiles, this.state);

    // Build preview text
    const atkDmg = result.defenderDamage;
    const counterDmg = result.attackerDamage;
    const guaranteedKill = atkDmg >= target.health;
    const lethalCounter = counterDmg >= selected.health;

    let preview = `⚔ ${selected.type} → ${target.type}: ${atkDmg} dmg`;
    if (guaranteedKill) preview += ' 💀';
    preview += ` | ↩ ${counterDmg} dmg`;
    if (lethalCounter) preview += ' ⚠️';

    this.infoText.setText(preview);

    // Visual indicators on the map
    const targetPos = target.position.toPixel(HEX_SIZE);
    const attackerPos = selected.position.toPixel(HEX_SIZE);

    if (guaranteedKill) {
      // Sweating indicator: pulsing red circle on target
      this.battlePreviewGraphics.lineStyle(3, 0xff4444, 0.9);
      this.battlePreviewGraphics.strokeCircle(targetPos.x, targetPos.y, HEX_SIZE * 0.45);
    }

    if (lethalCounter) {
      // Warning ring: black/red on attacker
      this.battlePreviewGraphics.lineStyle(3, 0x880000, 0.9);
      this.battlePreviewGraphics.strokeCircle(attackerPos.x, attackerPos.y, HEX_SIZE * 0.45);
      this.battlePreviewGraphics.lineStyle(1, 0xff0000, 0.7);
      this.battlePreviewGraphics.strokeCircle(attackerPos.x, attackerPos.y, HEX_SIZE * 0.52);
    }
  }

  private drawHex(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, color: number, highlight?: number, alpha?: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (Math.PI / 3) * i;
      pts.push({ x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) });
    }
    g.lineStyle(1, 0x000, 0.15);
    g.fillStyle(color, alpha ?? 1);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
    g.strokePath();
    if (highlight) {
      g.lineStyle(2, highlight, 0.6);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 6; i++) g.lineTo(pts[i].x, pts[i].y);
      g.closePath();
      g.strokePath();
    }
  }
}
