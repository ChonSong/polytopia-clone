import { describe, it, expect, beforeEach } from 'vitest';
import { HexCoord } from '../src/hex/HexCoord';
import { Biome, TileData } from '../src/hex/Tile';
import { Tribe } from '../src/entities/Tribe';
import { Unit, UnitType } from '../src/entities/Unit';
import { GameState } from '../src/entities/GameState';
import { runExplorerPathfinding } from '../src/entities/Explorer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTileMap(width: number, height: number, biome: Biome = Biome.GRASS): Map<string, TileData> {
  const map = new Map<string, TileData>();
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      map.set(`${q},${r}`, { biome, elevation: 0.5 });
    }
  }
  return map;
}

function makeTribeWithVisibility(id: string, tiles: Map<string, TileData>): Tribe {
  const tribe = new Tribe({ id, name: id, color: 0xffffff });
  return tribe;
}

function makeStateWithVisibility(tribeId: string, tiles: Map<string, TileData>, revealedKeys: string[]): GameState {
  const tribe = new Tribe({ id: tribeId, name: 'Test', color: 0xff0000 });
  const state = new GameState([tribe]);
  for (const key of revealedKeys) {
    state.tribeVisibility.get(tribeId)?.add(key);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Explorer pathfinding
// ---------------------------------------------------------------------------

describe('runExplorerPathfinding', () => {
  it('returns a path of tiles for the explorer to traverse', () => {
    // 10x10 grass map — all unexplored
    const tiles = makeTileMap(10, 10, Biome.GRASS);
    const state = makeStateWithVisibility('t1', tiles, []);

    const start = new HexCoord(5, 5);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // Explorer should move to reveal fog — path should not be empty
    // (all tiles are unexplored, so every move reveals new tiles)
    expect(path.length).toBeGreaterThan(0);
    // Max 15 steps
    expect(path.length).toBeLessThanOrEqual(15);
  });

  it('returns empty path when all tiles are already revealed', () => {
    const tiles = makeTileMap(5, 5, Biome.GRASS);
    // Reveal all tiles
    const allKeys: string[] = [];
    for (const key of tiles.keys()) {
      allKeys.push(key);
    }
    const state = makeStateWithVisibility('t1', tiles, allKeys);

    const start = new HexCoord(2, 2);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // No fog to reveal — no beneficial moves
    expect(path.length).toBe(0);
  });

  it('does not walk into water or mountains', () => {
    const tiles = makeTileMap(10, 10, Biome.GRASS);
    // Add water tiles around the start
    tiles.set('6,5', { biome: Biome.WATER, elevation: 0.1 });
    tiles.set('5,6', { biome: Biome.WATER, elevation: 0.1 });
    tiles.set('4,5', { biome: Biome.MOUNTAIN, elevation: 0.8 });

    const state = makeStateWithVisibility('t1', tiles, []);
    const start = new HexCoord(5, 5);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // Path should not contain water or mountain tiles
    for (const pos of path) {
      const tile = tiles.get(pos.toString());
      expect(tile).toBeDefined();
      expect(tile!.biome).not.toBe(Biome.WATER);
      expect(tile!.biome).not.toBe(Biome.MOUNTAIN);
    }
  });

  it('does not revisit recently traversed tiles (anti-backtracking)', () => {
    const tiles = makeTileMap(10, 10, Biome.GRASS);
    const state = makeStateWithVisibility('t1', tiles, []);

    const start = new HexCoord(5, 5);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // No tile should appear twice in the path
    const seen = new Set<string>();
    for (const pos of path) {
      const key = pos.toString();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('stops after maxSteps even if fog remains', () => {
    const tiles = makeTileMap(20, 20, Biome.GRASS);
    const state = makeStateWithVisibility('t1', tiles, []);

    const start = new HexCoord(10, 10);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 5);

    expect(path.length).toBeLessThanOrEqual(5);
  });

  it('prioritizes tiles that reveal the most fog', () => {
    // Create a map where one direction has more unexplored tiles
    const tiles = makeTileMap(10, 10, Biome.GRASS);
    // Reveal everything except a cluster to the east
    const revealed: string[] = [];
    for (const key of tiles.keys()) {
      const [q, r] = key.split(',').map(Number);
      if (q < 7) revealed.push(key);
    }
    const state = makeStateWithVisibility('t1', tiles, revealed);

    const start = new HexCoord(5, 5);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // Explorer should move east toward unexplored area
    if (path.length > 0) {
      const firstStep = path[0];
      // First step should be toward higher q (east) to reach fog
      expect(firstStep.q).toBeGreaterThanOrEqual(start.q);
    }
  });

  it('handles map edge correctly (no crash)', () => {
    const tiles = makeTileMap(5, 5, Biome.GRASS);
    const state = makeStateWithVisibility('t1', tiles, []);

    // Start at corner
    const start = new HexCoord(0, 0);
    const path = runExplorerPathfinding(start, state, 't1', tiles, 15);

    // All path positions should be within the map
    for (const pos of path) {
      expect(tiles.has(pos.toString())).toBe(true);
    }
  });
});
