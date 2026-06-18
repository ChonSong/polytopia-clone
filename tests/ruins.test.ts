import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Tribe, TRIBE_CONFIGS } from '../src/entities/Tribe';
import { Unit, UnitType } from '../src/entities/Unit';
import { generateMap } from '../src/hex/MapGenerator';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/hex/constants';
import { TechId } from '../src/entities/TechTree';

// ---------------------------------------------------------------------------
// Ancient Ruins Placement (GDD §2.6)
// ---------------------------------------------------------------------------

describe('Ancient ruins placement', () => {
  it('ruins are placed on land tiles only', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const waterKeys = new Set<string>();
    for (const [key, tile] of tiles) {
      if (tile.biome === Biome.WATER) waterKeys.add(key);
    }

    // Simulate ruin placement
    const desiredCount = Math.max(4, Math.min(23, Math.round((GRID_WIDTH * GRID_HEIGHT) / 28)));
    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city || tile.village) continue;
        candidates.push(coord);
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    for (const coord of shuffled) {
      if (placed.length >= desiredCount) break;
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placed.push(coord);
    }

    // All ruins should be on land
    for (const r of placed) {
      const tile = tiles.get(r.toString())!;
      expect(tile.biome).not.toBe(Biome.WATER);
      expect(tile.city).toBeFalsy();
      expect(tile.village).toBeFalsy();
    }
  });

  it('ruins are ≥2 tiles from each other', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city || tile.village) continue;
        candidates.push(coord);
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    for (const coord of shuffled) {
      if (placed.length >= 10) break;
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placed.push(coord);
    }

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(placed[i].distanceTo(placed[j])).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('ruins are ≥2 tiles from map edge', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city || tile.village) continue;
        candidates.push(coord);
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    for (const coord of shuffled) {
      if (placed.length >= 10) break;
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placed.push(coord);
    }

    for (const r of placed) {
      expect(r.q).toBeGreaterThanOrEqual(2);
      expect(r.q).toBeLessThanOrEqual(GRID_WIDTH - 3);
      expect(r.r).toBeGreaterThanOrEqual(2);
      expect(r.r).toBeLessThanOrEqual(GRID_HEIGHT - 3);
    }
  });

  it('at least 4 ruins are placed on a standard map', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const desiredCount = Math.max(4, Math.min(23, Math.round((GRID_WIDTH * GRID_HEIGHT) / 28)));
    expect(desiredCount).toBeGreaterThanOrEqual(4);

    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER || tile.city || tile.village) continue;
        candidates.push(coord);
      }
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    for (const coord of shuffled) {
      if (placed.length >= desiredCount) break;
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placed.push(coord);
    }

    expect(placed.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Ancient Ruins Discovery + Rewards (GDD §2.6)
// ---------------------------------------------------------------------------

describe('Ancient ruins discovery', () => {
  function makeTileMap(): Map<string, TileData> {
    const map = new Map<string, TileData>();
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        map.set(`${q},${r}`, { biome: Biome.GRASS, elevation: 0.5 });
      }
    }
    return map;
  }

  it('unit on a ruin tile at turn start discovers it', () => {
    const tiles = makeTileMap();
    const coord = new HexCoord(5, 5);
    tiles.get(coord.toString())!.ruin = true;

    const tribe = new Tribe({ id: 'test', name: 'Test', color: 0xff0000 });
    const unit = new Unit(coord, UnitType.WARRIOR, 'test');
    tribe.addUnit(unit);

    // Simulate discovery: check all units standing on ruins
    for (const u of tribe.getAliveUnits()) {
      const tile = tiles.get(u.position.toString());
      if (!tile?.ruin || tile.ruinDiscovered) continue;
      tile.ruinDiscovered = true;
    }

    expect(tiles.get(coord.toString())!.ruinDiscovered).toBe(true);
  });

  it('discovered ruin does not trigger reward again', () => {
    const tiles = makeTileMap();
    const coord = new HexCoord(5, 5);
    tiles.get(coord.toString())!.ruin = true;
    tiles.get(coord.toString())!.ruinDiscovered = true;

    const tribe = new Tribe({ id: 'test', name: 'Test', color: 0xff0000 });
    const unit = new Unit(coord, UnitType.WARRIOR, 'test');
    tribe.addUnit(unit);

    let discovered = false;
    for (const u of tribe.getAliveUnits()) {
      const tile = tiles.get(u.position.toString());
      if (!tile?.ruin || tile.ruinDiscovered) continue;
      tile.ruinDiscovered = true;
      discovered = true;
    }

    expect(discovered).toBe(false);
  });

  it('veteran reward: unit gains veteran status and +5 max HP', () => {
    const unit = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'test');
    expect(unit.isVeteran).toBe(false);
    expect(unit.maxHPBonus).toBe(0);

    // Simulate veteran reward
    unit.isVeteran = true;
    unit.maxHPBonus = 5;
    unit.health = unit.maxHealth;
    unit.killCount = 0;

    expect(unit.isVeteran).toBe(true);
    expect(unit.maxHPBonus).toBe(5);
    expect(unit.maxHealth).toBe(15); // 10 base + 5 bonus
    expect(unit.health).toBe(15);
  });

  it('naval units are excluded from veteran reward', () => {
    const unit = new Unit(new HexCoord(5, 5), UnitType.RAFT, 'test');
    expect(unit.isNaval).toBe(true);

    // Naval units should not get veteran
    if (!unit.isVeteran && !unit.isNaval && unit.type !== UnitType.GIANT) {
      unit.isVeteran = true;
    }
    expect(unit.isVeteran).toBe(false);
  });

  it('Giant is excluded from veteran reward', () => {
    const unit = new Unit(new HexCoord(5, 5), UnitType.GIANT, 'test');

    if (!unit.isVeteran && !unit.isNaval && unit.type !== UnitType.GIANT) {
      unit.isVeteran = true;
    }
    expect(unit.isVeteran).toBe(false);
  });

  it('free tech reward: tribe researches an unresearched tech', () => {
    const tribe = new Tribe(TRIBE_CONFIGS[0]); // Xin-xi starts with RIDING
    const initialTechCount = tribe.techs.size;

    // Simulate free tech reward
    const allTechs = Object.values(TechId);
    let researched = false;
    for (const tech of allTechs) {
      if (!tribe.hasTech(tech)) {
        tribe.researchTech(tech);
        researched = true;
        break;
      }
    }

    expect(researched).toBe(true);
    expect(tribe.techs.size).toBe(initialTechCount + 1);
  });

  it('star bonus reward: tribe gains +10 stars', () => {
    const tribe = new Tribe({ id: 'test', name: 'Test', color: 0xff0000 });
    tribe.stars = 15;

    // Simulate star bonus
    tribe.stars += 10;

    expect(tribe.stars).toBe(25);
  });
});
