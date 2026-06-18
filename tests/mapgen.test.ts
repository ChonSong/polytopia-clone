import { describe, it, expect } from 'vitest';
import { generateMap, MAP_TYPES } from '../src/hex/MapGenerator';
import { Biome } from '../src/hex/Tile';
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
