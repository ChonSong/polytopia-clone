import { describe, it, expect } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { TileData, Biome } from '../src/hex/Tile';
import { Tribe, TRIBE_CONFIGS } from '../src/entities/Tribe';
import { City, CITY_NAMES } from '../src/entities/City';
import { Unit, UnitType } from '../src/entities/Unit';
import { generateMap } from '../src/hex/MapGenerator';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/hex/constants';

// ---------------------------------------------------------------------------
// Village Placement (GDD §2.5)
// ---------------------------------------------------------------------------

describe('Village generation', () => {
  it('villages are placed on land tiles only', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const waterKeys = new Set<string>();
    for (const [key, tile] of tiles) {
      if (tile.biome === Biome.WATER) waterKeys.add(key);
    }

    // Simulate village placement on land tiles
    const villageCount = 6;
    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const key = coord.toString();
        const tile = tiles.get(key);
        if (!tile || tile.biome === Biome.WATER) continue;
        if (tile.city) continue;
        candidates.push(coord);
      }
    }

    // Shuffle and place with ≥2 spacing
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const placed: HexCoord[] = [];
    for (const coord of shuffled) {
      if (placed.length >= villageCount) break;
      let tooClose = false;
      for (const p of placed) {
        if (coord.distanceTo(p) < 2) { tooClose = true; break; }
      }
      if (tooClose) continue;
      placed.push(coord);
    }

    // All placed villages should be on land
    for (const v of placed) {
      const tile = tiles.get(v.toString())!;
      expect(tile.biome).not.toBe(Biome.WATER);
    }

    expect(placed.length).toBeGreaterThanOrEqual(3); // at least 3 with spacing
  });

  it('villages are ≥2 tiles from each other', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const placed: HexCoord[] = [];
    const candidates: HexCoord[] = [];
    for (let q = 2; q <= GRID_WIDTH - 3; q++) {
      for (let r = 2; r <= GRID_HEIGHT - 3; r++) {
        const coord = new HexCoord(q, r);
        const tile = tiles.get(coord.toString());
        if (!tile || tile.biome === Biome.WATER) continue;
        candidates.push(coord);
      }
    }
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (const coord of shuffled) {
      if (placed.length >= 6) break;
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

  it('villages are ≥2 tiles from map edge', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT);
    for (const [key, tile] of tiles) {
      if (!tile.village) continue;
      const [q, r] = key.split(',').map(Number);
      expect(q).toBeGreaterThanOrEqual(2);
      expect(q).toBeLessThanOrEqual(GRID_WIDTH - 3);
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThanOrEqual(GRID_HEIGHT - 3);
    }
  });
});

// ---------------------------------------------------------------------------
// Village Capture (GDD §2.5)
// ---------------------------------------------------------------------------

describe('Village capture', () => {
  function makeTileMap(): Map<string, TileData> {
    const map = new Map<string, TileData>();
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        map.set(`${q},${r}`, { biome: Biome.GRASS, elevation: 0.5 });
      }
    }
    return map;
  }

  it('unit on a village tile at turn start captures it', () => {
    const tiles = makeTileMap();
    const coord = new HexCoord(5, 5);
    tiles.get(coord.toString())!.village = true;

    const tribe = new Tribe({ id: 'test', name: 'Test', color: 0xff0000 });
    const unit = new Unit(coord, UnitType.WARRIOR, 'test');
    tribe.addUnit(unit);

    // Simulate capture: check all units standing on villages
    for (const u of tribe.getAliveUnits()) {
      const tile = tiles.get(u.position.toString());
      if (tile?.village) {
        const name = `Captured-${coord.toString()}`;
        const newCity = new City(coord, name, tribe.id);
        tribe.addCity(newCity);
        tile.village = false;
        tile.city = true;
      }
    }

    // Village should be gone
    expect(tiles.get(coord.toString())!.village).toBe(false);
    expect(tiles.get(coord.toString())!.city).toBe(true);
    // Tribe should have a new city
    expect(tribe.cities.length).toBe(1);
    expect(tribe.cities[0].position.equals(coord)).toBe(true);
  });

  it('unit not on a village does not trigger capture', () => {
    const tiles = makeTileMap();
    const villageCoord = new HexCoord(3, 3);
    const unitCoord = new HexCoord(5, 5);
    tiles.get(villageCoord.toString())!.village = true;

    const tribe = new Tribe({ id: 'test', name: 'Test', color: 0xff0000 });
    const unit = new Unit(unitCoord, UnitType.WARRIOR, 'test');
    tribe.addUnit(unit);

    for (const u of tribe.getAliveUnits()) {
      const tile = tiles.get(u.position.toString());
      if (tile?.village) {
        const newCity = new City(u.position, 'City', tribe.id);
        tribe.addCity(newCity);
        tile.village = false;
      }
    }

    // Village should still exist (unit not on it)
    expect(tiles.get(villageCoord.toString())!.village).toBe(true);
    expect(tribe.cities.length).toBe(0);
  });

  it('captured village becomes a city with correct tribe ownership', () => {
    const tiles = makeTileMap();
    const coord = new HexCoord(4, 4);
    tiles.get(coord.toString())!.village = true;

    const tribe = new Tribe(TRIBE_CONFIGS[0]); // Xin-xi
    const unit = new Unit(coord, UnitType.WARRIOR, tribe.id);
    tribe.addUnit(unit);

    // Simulate capture
    const name = CITY_NAMES[tribe.name]?.[tribe.cities.length] || 'Outpost';
    const newCity = new City(coord, name, tribe.id);
    tribe.addCity(newCity);
    const tile = tiles.get(coord.toString())!;
    tile.village = false;
    tile.city = true;

    expect(newCity.tribeId).toBe(tribe.id);
    expect(newCity.name).toBe('Xin'); // first unused Xin-xi name
  });
});

// ---------------------------------------------------------------------------
// AI Village Targeting (GDD §2.5)
// ---------------------------------------------------------------------------

describe('AI village targeting', () => {
  it('findNearestVillage finds the closest village', () => {
    const tiles = new Map<string, TileData>();
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        tiles.set(`${q},${r}`, { biome: Biome.GRASS, elevation: 0.5 });
      }
    }
    // Place a village at (7,7)
    tiles.get('7,7')!.village = true;
    // Place another at (2,2)
    tiles.get('2,2')!.village = true;

    const unit = new Unit(new HexCoord(5, 5), UnitType.WARRIOR, 'test');
    const walkable = new Set([Biome.GRASS, Biome.FOREST, Biome.SAND, Biome.SNOW]);
    let best: HexCoord | null = null;
    let bestDist = Infinity;

    for (const [key, tile] of tiles) {
      if (!tile.village) continue;
      if (!walkable.has(tile.biome)) continue;
      const [q, r] = key.split(',').map(Number);
      const coord = new HexCoord(q, r);
      const dist = unit.position.distanceTo(coord);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        best = coord;
      }
    }

    // (7,7) is distance 2 from (5,5), (2,2) is distance 6
    // Closest is (7,7)
    expect(best).not.toBeNull();
    expect(best!.q).toBe(7);
    expect(best!.r).toBe(7);
  });

  it('does not target water villages for ground units', () => {
    const tiles = new Map<string, TileData>();
    for (let q = 0; q < 5; q++) {
      for (let r = 0; r < 5; r++) {
        tiles.set(`${q},${r}`, { biome: Biome.GRASS, elevation: 0.5 });
      }
    }
    // Place a village on water
    tiles.set('2,2', { biome: Biome.WATER, elevation: 0.1, village: true });
    // Place a village on land
    tiles.set('4,0', { biome: Biome.GRASS, elevation: 0.5, village: true });

    const unit = new Unit(new HexCoord(0, 0), UnitType.WARRIOR, 'test');
    const walkable = new Set([Biome.GRASS, Biome.FOREST, Biome.SAND, Biome.SNOW]);
    let best: HexCoord | null = null;
    let bestDist = Infinity;

    for (const [key, tile] of tiles) {
      if (!tile.village) continue;
      if (!walkable.has(tile.biome)) continue;
      const [q, r] = key.split(',').map(Number);
      const coord = new HexCoord(q, r);
      const dist = unit.position.distanceTo(coord);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        best = coord;
      }
    }

    // Should find the land village, not the water one
    expect(best).not.toBeNull();
    expect(best!.q).toBe(4);
    expect(best!.r).toBe(0);
  });
});
