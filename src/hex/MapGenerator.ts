import { HexCoord } from './HexCoord';
import { TileData, Biome } from './Tile';

// Simple pseudo-random map generator (no noise dependency)
export function generateMap(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      // Simple noise: distance from center + pseudo-random
      const cx = width / 2, cy = height / 2;
      const dist = h.distanceTo(new HexCoord(cx, cy));
      const rand = ((seed + q * 31 + r * 17) % 100) / 100;
      const val = dist / Math.max(width, height) + rand * 0.3;

      let biome: Biome;
      if (val < 0.2) biome = Biome.WATER;
      else if (val < 0.3) biome = Biome.SAND;
      else if (val < 0.5) biome = Biome.GRASS;
      else if (val < 0.7) biome = Biome.FOREST;
      else if (val < 0.85) biome = Biome.MOUNTAIN;
      else biome = Biome.SNOW;

      tiles.set(h.toString(), { biome, elevation: val });
    }
  }
  return tiles;
}
