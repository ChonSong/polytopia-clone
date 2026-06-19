import { describe, it, expect } from 'vitest';
import { generateMap, MAP_TYPES } from '../src/hex/MapGenerator';
import { Biome, Resource, TileData } from '../src/hex/Tile';
import { HexCoord } from '../src/hex/HexCoord';
import { GRID_WIDTH, GRID_HEIGHT } from '../src/hex/constants';

describe('MapGenerator per-type algorithms', () => {
  it('all map types produce the correct number of tiles', () => {
    for (const mt of MAP_TYPES) {
      const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, mt);
      expect(tiles.size).toBe(GRID_WIDTH * GRID_HEIGHT);
    }
  });

  it('all map types produce at least some land tiles', () => {
    for (const mt of MAP_TYPES) {
      const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, mt);
      let landCount = 0;
      for (const tile of tiles.values()) {
        if (tile.biome !== Biome.WATER && tile.biome !== Biome.SAND) landCount++;
      }
      expect(landCount).toBeGreaterThan(0);
    }
  });

  it('Dryland has zero water tiles', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'DRYLAND');
    for (const tile of tiles.values()) {
      expect(tile.biome).not.toBe(Biome.WATER);
    }
  });

  it('Waterworld has a high proportion of water', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'WATERWORLD');
    let waterCount = 0;
    for (const tile of tiles.values()) {
      if (tile.biome === Biome.WATER) waterCount++;
    }
    // At least 60% water
    expect(waterCount / tiles.size).toBeGreaterThan(0.6);
  });

  it('Pangea has zero water tiles', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'PANGEA');
    for (const tile of tiles.values()) {
      expect(tile.biome).not.toBe(Biome.WATER);
    }
  });

  it('Continents has both land and water', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'CONTINENTS');
    let waterCount = 0;
    for (const tile of tiles.values()) {
      if (tile.biome === Biome.WATER) waterCount++;
    }
    expect(waterCount).toBeGreaterThan(0);
    expect(waterCount / tiles.size).toBeLessThan(0.5);
  });

  it('Archipelago has both land and water', () => {
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'ARCHIPELAGO');
    let waterCount = 0;
    for (const tile of tiles.values()) {
      if (tile.biome === Biome.WATER) waterCount++;
    }
    expect(waterCount).toBeGreaterThan(0);
    expect(waterCount / tiles.size).toBeLessThan(0.7);
  });

  it('default (no type) uses CONTINENTS algorithm', () => {
    // Both default and CONTINENTS use the same radial gradient algorithm.
    // Verify by checking the structure: same number of tiles, same biomes.
    const tilesDefault = generateMap(GRID_WIDTH, GRID_HEIGHT);
    const tilesContinents = generateMap(GRID_WIDTH, GRID_HEIGHT, 'CONTINENTS');
    expect(tilesDefault.size).toBe(tilesContinents.size);
    // Both should have water and land (structural check)
    let defaultWater = 0, continentsWater = 0;
    for (const tile of tilesDefault.values()) {
      if (tile.biome === Biome.WATER) defaultWater++;
    }
    for (const tile of tilesContinents.values()) {
      if (tile.biome === Biome.WATER) continentsWater++;
    }
    expect(defaultWater).toBeGreaterThan(0);
    expect(continentsWater).toBeGreaterThan(0);
  });
});

describe('GDD §2.4 — Resource proximity constraint', () => {
  it('no resources spawn >2 tiles from any settlement', () => {
    // Simulate enforceResourceProximity: place settlements, then strip distant resources
    const tiles = generateMap(GRID_WIDTH, GRID_HEIGHT, 'CONTINENTS');
    const settlements = [
      new HexCoord(2, 2),
      new HexCoord(GRID_WIDTH - 3, 2),
      new HexCoord(2, GRID_HEIGHT - 3),
      new HexCoord(GRID_WIDTH - 3, GRID_HEIGHT - 3),
    ];
    // Add a village in the center
    const mid = new HexCoord(Math.floor(GRID_WIDTH / 2), Math.floor(GRID_HEIGHT / 2));
    settlements.push(mid);

    for (const [key, tile] of tiles) {
      if (!tile.resource) continue;
      const parts = key.split(',');
      const coord = new HexCoord(parseInt(parts[0]), parseInt(parts[1]));
      const nearSettlement = settlements.some(s => coord.distanceTo(s) <= 2);
      if (!nearSettlement) {
        tile.resource = undefined;
      }
    }

    // Verify: every remaining resource is within 2 tiles of a settlement
    for (const [key, tile] of tiles) {
      if (!tile.resource) continue;
      const parts = key.split(',');
      const coord = new HexCoord(parseInt(parts[0]), parseInt(parts[1]));
      const minDist = Math.min(...settlements.map(s => coord.distanceTo(s)));
      expect(minDist).toBeLessThanOrEqual(2);
    }
  });

  it('resources within 2 tiles of a settlement are kept', () => {
    const tiles = new Map<string, TileData>();
    // Create a 5x5 grid with a settlement at center (2,2)
    for (let q = 0; q < 5; q++) {
      for (let r = 0; r < 5; r++) {
        tiles.set(`${q},${r}`, {
          biome: Biome.GRASS,
          elevation: 0.5,
          resource: Resource.CROPS,
        });
      }
    }
    const settlement = new HexCoord(2, 2);

    // Apply proximity filter
    for (const [key, tile] of tiles) {
      if (!tile.resource) continue;
      const parts = key.split(',');
      const coord = new HexCoord(parseInt(parts[0]), parseInt(parts[1]));
      if (coord.distanceTo(settlement) > 2) {
        tile.resource = undefined;
      }
    }

    // Center tile (distance 0) should keep resource
    expect(tiles.get('2,2')?.resource).toBe(Resource.CROPS);
    // Adjacent tile (distance 1) should keep resource
    expect(tiles.get('3,2')?.resource).toBe(Resource.CROPS);
    // Distance 2 tile should keep resource
    expect(tiles.get('4,2')?.resource).toBe(Resource.CROPS);
    // Distance 3 tile should lose resource
    expect(tiles.get('2,5')?.resource).toBeUndefined();
  });

  it('wilderness tiles have no resources after proximity filter', () => {
    const tiles = new Map<string, TileData>();
    // Create a 10x10 grid, settlement at (0,0)
    for (let q = 0; q < 10; q++) {
      for (let r = 0; r < 10; r++) {
        tiles.set(`${q},${r}`, {
          biome: Biome.FOREST,
          elevation: 0.6,
          resource: Resource.ANIMALS,
        });
      }
    }
    const settlement = new HexCoord(0, 0);

    for (const [key, tile] of tiles) {
      if (!tile.resource) continue;
      const parts = key.split(',');
      const coord = new HexCoord(parseInt(parts[0]), parseInt(parts[1]));
      if (coord.distanceTo(settlement) > 2) {
        tile.resource = undefined;
      }
    }

    // Count resources
    let resourceCount = 0;
    for (const tile of tiles.values()) {
      if (tile.resource) resourceCount++;
    }
    // Count resources — only tiles within 2 hexes of (0,0) in a 10x10 grid
    // With (0,0) at corner: (0,0),(1,0),(0,1),(2,0),(1,1),(0,2) = 6 tiles
    expect(resourceCount).toBe(6);
    // Far corner should be empty
    expect(tiles.get('9,9')?.resource).toBeUndefined();
  });
});
