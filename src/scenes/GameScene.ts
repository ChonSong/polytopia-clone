import Phaser from 'phaser';
import { HexCoord } from '../hex/HexCoord';
import { HEX_SIZE, GRID_WIDTH, GRID_HEIGHT } from '../hex/constants';
import { TileData, Biome, BiomeColors } from '../hex/Tile';
import { generateMap } from '../hex/MapGenerator';
import { GameState } from '../entities/GameState';
import { Tribe, TRIBE_CONFIGS } from '../entities/Tribe';
import { Unit, UnitType } from '../entities/Unit';
import { City } from '../entities/City';
import { TurnManager, TurnPhase } from '../entities/TurnManager';
import { BasicAI } from '../ai/BasicAI';
import { CombatSystem } from '../entities/CombatSystem';
import { createCity } from '../entities/CityData';

const COLORS: Record<string, number> = {
  'xin-xi': 0xd4a017,
  'imperius': 0x3b7dbd,
  'bardur': 0x5a8f3c,
  'oumaji': 0xc0392b,
};

export class GameScene extends Phaser.Scene {
  private hexGraphics!: Phaser.GameObjects.Graphics;
  private entityGraphics!: Phaser.GameObjects.Graphics;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private tiles!: Map<string, TileData>;
  private state!: GameState;
  private tribes!: Tribe[];
  private humanTribe!: Tribe;
  private turnManager!: TurnManager;
  private ais: Map<string, BasicAI> = new Map();
  private selectedUnit: Unit | null = null;
  private selectedHex: HexCoord | null = null;
  private isAiRunning = false;
  private currentPhase = 0; // index into PHASE_ORDER
  private skipPhase = false;
  private cityMenu: Phaser.GameObjects.Group | null = null;
  private selectedCity: City | null = null;

  private tribeText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;

  private readonly PHASE_ORDER = [
    TurnPhase.EXPLORE,
    TurnPhase.BUILD,
    TurnPhase.MOVE,
    TurnPhase.ATTACK,
    TurnPhase.END,
  ];

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    this.tribes = TRIBE_CONFIGS.map(c => new Tribe(c));
    this.humanTribe = this.tribes[0];
    this.humanTribe.stars = 15;

    this.placeCities();
    this.state = new GameState(this.tribes);
    // Share tile map with AI via GameState (BasicAI accesses it via cast)
    (this.state as any).tileMap = this.tiles;
    this.turnManager = new TurnManager();
    // Create AI for non-human tribes
    for (const t of this.tribes) {
      if (t !== this.humanTribe) this.ais.set(t.id, new BasicAI(t));
    }

    // Graphics
    this.hexGraphics = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.rangeGraphics = this.add.graphics().setDepth(5);

    this.cameras.main.setBounds(-300, -300, 2000, 1600);

    // Input: pan with drag (mouse + touch)
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        const dx = p.x - p.prevPosition.x;
        const dy = p.y - p.prevPosition.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) { // dead zone to avoid interfering with clicks
          this.cameras.main.scrollX -= dx;
          this.cameras.main.scrollY -= dy;
        }
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.isAiRunning) this.handleClick(p.x, p.y);
    });

    // HUD — fixed to camera, high-contrast
    const s = { fontSize: '16px', color: '#eee', fontFamily: 'monospace' };
    const bg = this.add.graphics().setScrollFactor(0).setDepth(19);
    bg.fillStyle(0x000, 0.65);
    bg.fillRoundedRect(4, 4, 320, 72, 6);

    this.tribeText = this.add.text(12, 10, '', { ...s, fontSize: '20px', color: '#ffd' })
      .setScrollFactor(0).setDepth(20);
    this.phaseText = this.add.text(12, 36, '', s)
      .setScrollFactor(0).setDepth(20);
    this.infoText = this.add.text(12, 58, '', { ...s, fontSize: '13px', color: '#ccc' })
      .setScrollFactor(0).setDepth(20);

    // End Turn (camera-fixed)
    const btn = this.add.text(660, 10, '[ END TURN ]', {
      fontSize: '20px', color: '#ffd', fontFamily: 'monospace',
      backgroundColor: '#333', padding: { x: 10, y: 6 }
    }).setScrollFactor(0).setDepth(20).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => { if (!this.isAiRunning) this.endTurn(); });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#555' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#333' }));

    this.renderAll();
    this.updateUI();
    this.startTurn();
  }

  private placeCities(): void {
    const pos = [
      new HexCoord(2, 2), new HexCoord(GRID_WIDTH - 3, 2),
      new HexCoord(2, GRID_HEIGHT - 3), new HexCoord(GRID_WIDTH - 3, GRID_HEIGHT - 3),
    ];
    for (let i = 0; i < this.tribes.length; i++) {
      const p = pos[i];
      const cfg = TRIBE_CONFIGS[i];
      this.tribes[i].addCity(new City(p, cfg.name, cfg.id));
      this.tribes[i].addUnit(new Unit(p, UnitType.WARRIOR, cfg.id));
    }
  }

  private startTurn(): void {
    const cur = this.state.getCurrentTribe();
    for (const u of cur.getAliveUnits()) u.resetTurn();

    if (cur.isDefeated()) { this.advanceTurn(); return; }

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
        const city = tribe.cities.find(c => c.id === p.cityId);
        if (city && tribe.stars >= 5) {
          tribe.addUnit(new Unit(city.position, (p.unitType as UnitType) || UnitType.WARRIOR, tribe.id));
          tribe.stars -= 5;
        }
        break;
      }
      case 'UPGRADE': {
        const city = tribe.cities.find(c => c.id === p.cityId);
        if (city && city.canGrow() && tribe.stars >= 3) {
          city.grow();
          tribe.stars -= 3;
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
          const r = CombatSystem.executeAttack(unit, target, this.tiles);
          unit.takeDamage(r.attackerDamage);
          target.takeDamage(r.defenderDamage);
          if (r.defenderKilled) {
            const owner = this.findTribeForUnit(target.id);
            if (owner) owner.removeUnit(target.id);
            unit.position = targetPos;
          }
          if (r.attackerKilled) tribe.removeUnit(unit.id);
        } else if (unit && p.targetType === 'city') {
          const city = this.findCity(targetPos);
          if (city) {
            const cd = createCity(city.tribeId, targetPos.q, targetPos.r);
            if (CombatSystem.canAttackCity(unit, cd)) {
              const r = CombatSystem.executeCityAttack(unit, cd, this.tiles);
              if (r.cityCaptured) {
                city.captured = true;
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
    }
  }

  private collectAiResources(tribe: Tribe): void {
    let stars = 0;
    for (const city of tribe.cities) {
      const biomes: Biome[] = [];
      for (const n of city.position.neighbors()) {
        const t = this.tiles.get(n.toString());
        if (t) biomes.push(t.biome);
      }
      stars += city.produceResources(biomes).stars;
    }
    tribe.stars += stars + tribe.starsPerTurn;
  }

  private endTurn(): void {
    if (this.isAiRunning) return;
    this.collectHumanResources();
    this.advanceTurn();
  }

  private collectHumanResources(): void {
    let stars = 0;
    for (const city of this.humanTribe.cities) {
      const biomes: Biome[] = [];
      for (const n of city.position.neighbors()) {
        const t = this.tiles.get(n.toString());
        if (t) biomes.push(t.biome);
      }
      stars += city.produceResources(biomes).stars;
    }
    this.humanTribe.stars += stars + this.humanTribe.starsPerTurn;
  }

  private advanceTurn(): void {
    const winner = this.turnManager.checkWinCondition(this.tribes);
    if (winner) {
      this.setStatus(`🏆 ${winner.name} wins!`);
      this.isAiRunning = true;
      return;
    }
    this.state.nextTurn();
    this.startTurn();
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
          const r = CombatSystem.executeAttack(this.selectedUnit, cu, this.tiles);
          this.selectedUnit.takeDamage(r.attackerDamage);
          cu.takeDamage(r.defenderDamage);
          if (r.defenderKilled) {
            const owner = this.findTribeForUnit(cu.id);
            if (owner) owner.removeUnit(cu.id);
            this.selectedUnit.position = coord;
          }
          if (r.attackerKilled) this.humanTribe.removeUnit(this.selectedUnit.id);
          this.selectedUnit = null;
          this.selectedHex = null;
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

      // Move
      if (this.selectedUnit.position.distanceTo(coord) <= this.selectedUnit.movementRange) {
        this.selectedUnit.position = coord;
        this.selectedUnit.hasActed = true;
        this.selectedUnit = null;
        this.selectedHex = null;
        this.renderAll(); this.updateUI();
        return;
      }
    }

    // Select own unit
    if (cu && cu.owner === this.humanTribe.id && !cu.hasActed) {
      this.selectedUnit = cu;
      this.selectedHex = coord;
      this.hideCityMenu();
      this.renderAll(); this.updateUI();
      return;
    }

    // Click on own city — show build menu
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

  private showCityMenu(city: City, coord: HexCoord): void {
    this.hideCityMenu();
    this.selectedCity = city;
    const p = coord.toPixel(HEX_SIZE);
    const sx = p.x + this.cameras.main.scrollX + 40;
    const sy = p.y + this.cameras.main.scrollY - 20;

    const style = { fontSize: '14px', color: '#ffd', fontFamily: 'monospace',
      backgroundColor: '#222', padding: { x: 8, y: 4 } as const };
    const disabledStyle = { ...style, color: '#555' };

    // Only show menu on human's turn
    if (this.state.getCurrentTribe() !== this.humanTribe) return;

    const items: string[] = [];
    const handlers: (() => void)[] = [];

    // Train Warrior
    if (this.humanTribe.stars >= 5) {
      items.push('TRAIN WARRIOR (5⭐)');
      handlers.push(() => {
        this.humanTribe.addUnit(new Unit(city.position, UnitType.WARRIOR, this.humanTribe.id));
        this.humanTribe.stars -= 5;
        this.hideCityMenu();
        this.renderAll(); this.updateUI();
      });
    } else {
      items.push('TRAIN WARRIOR (5⭐)');
      handlers.push(() => {}); // no-op
    }

    // Upgrade city
    const upgradeCost = city.level * 5;
    if (city.canGrow() && this.humanTribe.stars >= upgradeCost) {
      items.push(`UPGRADE Lv${city.level}→${city.level + 1} (${upgradeCost}⭐)`);
      handlers.push(() => {
        city.grow();
        this.humanTribe.stars -= upgradeCost;
        this.hideCityMenu();
        this.renderAll(); this.updateUI();
      });
    } else {
      items.push(`UPGRADE Lv${city.level}→${city.level + 1} (${upgradeCost}⭐)`);
      handlers.push(() => {}); // no-op
    }

    this.cityMenu = this.add.group();
    items.forEach((text, i) => {
      const canAfford = (i === 0 && this.humanTribe.stars >= 5) ||
        (i === 1 && city.canGrow() && this.humanTribe.stars >= city.level * 5);
      const lbl = this.add.text(sx, sy + i * 24, text, canAfford ? style : disabledStyle)
        .setDepth(25).setInteractive({ useHandCursor: canAfford });
      if (canAfford) {
        lbl.on('pointerdown', handlers[i]);
        lbl.on('pointerover', () => lbl.setStyle({ backgroundColor: '#444' }));
        lbl.on('pointerout', () => lbl.setStyle({ backgroundColor: '#222' }));
      }
      this.cityMenu!.add(lbl);
    });

    // "Close" hint
    const hint = this.add.text(sx, sy + items.length * 24 + 4, '[click elsewhere to close]', {
      fontSize: '11px', color: '#888', fontFamily: 'monospace'
    }).setDepth(25);
    this.cityMenu.add(hint);
  }

  private hideCityMenu(): void {
    if (this.cityMenu) {
      this.cityMenu.destroy(true);
      this.cityMenu = null;
    }
    this.selectedCity = null;
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

    for (const [key, tile] of this.tiles) {
      const [q, r] = key.split(',').map(Number);
      const c = new HexCoord(q, r);
      const pos = c.toPixel(HEX_SIZE);
      const sel = this.selectedHex && this.selectedHex.equals(c);
      this.drawHex(this.hexGraphics, pos.x, pos.y, HEX_SIZE, BiomeColors[tile.biome], sel ? 0xffff00 : undefined);
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
        const p = city.position.toPixel(HEX_SIZE);
        const cl = COLORS[city.tribeId] || 0x888;
        this.entityGraphics.fillStyle(cl, 1);
        this.entityGraphics.fillCircle(p.x, p.y, HEX_SIZE * 0.38);
        this.entityGraphics.lineStyle(2, 0x000, 0.4);
        this.entityGraphics.strokeCircle(p.x, p.y, HEX_SIZE * 0.38);
        for (let i = 0; i < city.level; i++) {
          this.entityGraphics.fillStyle(0x000, 0.5);
          this.entityGraphics.fillCircle(p.x - 5 + i * 5, p.y + 5, 2);
        }
      }
    }

    // Units
    for (const t of this.tribes) {
      for (const u of t.getAliveUnits()) {
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
        this.entityGraphics.fillRect(p.x - bw / 2, p.y - r - 5, bw * (u.health / 10), bh);
      }
    }
  }

  private updateUI(): void {
    const cur = this.state.getCurrentTribe();
    this.tribeText.setText(`${cur?.name ?? '?'}  Turn ${this.state.turn}`);
    this.phaseText.setText(`Stars: ${cur?.stars ?? 0}  Cities: ${this.humanTribe.cities.filter(c => !c.captured).length}`);
    let info = '';
    if (this.selectedHex) {
      const tile = this.tiles.get(this.selectedHex.toString());
      const u = this.findUnit(this.selectedHex);
      const c = this.findCity(this.selectedHex);
      if (tile) info += `[${this.selectedHex.q},${this.selectedHex.r}] ${tile.biome}`;
      if (c) info += ` 🏘 ${c.name} Lv${c.level}`;
      if (u) info += ` ⚔ ${u.type} HP:${u.health}/10`;
    }
    this.infoText.setText(info);
  }

  private setStatus(m: string): void { this.phaseText.setText(m); }

  private delay(ms: number): Promise<void> {
    return new Promise(r => this.time.delayedCall(ms, r));
  }

  private drawHex(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, color: number, highlight?: number): void {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (Math.PI / 3) * i;
      pts.push({ x: cx + size * Math.cos(a), y: cy + size * Math.sin(a) });
    }
    g.lineStyle(1, 0x000, 0.15);
    g.fillStyle(color, 1);
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
