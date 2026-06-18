import { HexCoord } from './HexCoord';
import { TileData, Biome, Resource } from './Tile';

export type MapType = 'CONTINENTS' | 'LAKES' | 'DRYLAND' | 'ARCHIPELAGO' | 'WATERWORLD' | 'PANGEA';

/** Runtime map of MapType values for iteration. */
export const MAP_TYPES: MapType[] = ['CONTINENTS', 'LAKES', 'DRYLAND', 'ARCHIPELAGO', 'WATERWORLD', 'PANGEA'];

/** Simple seeded PRNG so maps are reproducible per seed. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a hex tile map.
 * `mapType` selects the terrain algorithm. Falls back to CONTINENTS when omitted
 * so existing callers (tests, etc.) keep working.
 */
export function generateMap(
  width: number,
  height: number,
  mapType: MapType = 'CONTINENTS',
): Map<string, TileData> {
  switch (mapType) {
    case 'WATERWORLD':
      return generateWaterworld(width, height);
    case 'PANGEA':
      return generatePangea(width, height);
    case 'DRYLAND':
      return generateDryland(width, height);
    case 'ARCHIPELAGO':
      return generateArchipelago(width, height);
    case 'LAKES':
      return generateLakes(width, height);
    case 'CONTINENTS':
    default:
      return generateContinents(width, height);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeTile(rng: () => number, elevation: number): TileData {
  let biome: Biome;
  if (elevation < 0.2) biome = Biome.WATER;
  else if (elevation < 0.3) biome = Biome.SAND;
  else if (elevation < 0.5) biome = Biome.GRASS;
  else if (elevation < 0.7) biome = Biome.FOREST;
  else if (elevation < 0.85) biome = Biome.MOUNTAIN;
  else biome = Biome.SNOW;

  const resource = rng() < 0.35 ? resourceForBiome(biome) : undefined;
  return { biome, elevation, resource };
}

function resourceForBiome(biome: Biome): Resource | undefined {
  switch (biome) {
    case Biome.FOREST:   return Resource.ANIMALS;
    case Biome.WATER:    return Resource.FISH;
    case Biome.GRASS:    return Math.random() < 0.5 ? Resource.FRUIT : Resource.CROPS;
    case Biome.MOUNTAIN: return Resource.METAL;
    default:             return undefined;
  }
}

/** Radial distance normalised to 0..1 (used by several algorithms). */
function radialDist(q: number, r: number, cx: number, cy: number, maxDim: number): number {
  return new HexCoord(q, r).distanceTo(new HexCoord(cx, cy)) / maxDim;
}

// ---------------------------------------------------------------------------
// 1. CONTINENTS — large landmasses separated by water
// ---------------------------------------------------------------------------

function generateContinents(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const cx = width / 2, cy = height / 2;
  const maxDim = Math.max(width, height);

  // Two "continent centres" offset from map centre
  const c1x = cx + width * 0.25, c1y = cy - height * 0.15;
  const c2x = cx - width * 0.2, c2y = cy + height * 0.2;

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      const d1 = h.distanceTo(new HexCoord(c1x, c1y)) / maxDim;
      const d2 = h.distanceTo(new HexCoord(c2x, c2y)) / maxDim;
      const dist = Math.min(d1, d2);
      const noise = (rng() - 0.5) * 0.25;
      const val = 0.55 - dist * 0.8 + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0, Math.min(1, val))));
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 2. LAKES — single landmass with scattered water tiles
// ---------------------------------------------------------------------------

function generateLakes(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const cx = width / 2, cy = height / 2;
  const maxDim = Math.max(width, height);

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      const dist = h.distanceTo(new HexCoord(cx, cy)) / maxDim;
      const noise = (rng() - 0.5) * 0.15;
      // Mostly land, water only near centre (lake) and edges
      const val = 0.3 + dist * 0.5 + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0, Math.min(1, val))));
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 3. DRYLAND — no water tiles at all
// ---------------------------------------------------------------------------

function generateDryland(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const cx = width / 2, cy = height / 2;
  const maxDim = Math.max(width, height);

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      const dist = h.distanceTo(new HexCoord(cx, cy)) / maxDim;
      const noise = (rng() - 0.5) * 0.2;
      // Elevation 0.35–0.95, never water
      const val = 0.35 + dist * 0.6 + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0.35, Math.min(1, val))));
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 4. ARCHIPELAGO — many small islands
// ---------------------------------------------------------------------------

function generateArchipelago(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const maxDim = Math.max(width, height);

  // Scatter several island centres
  const numIslands = 6;
  const islandCentres: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < numIslands; i++) {
    islandCentres.push({
      x: rng() * width * 0.8 + width * 0.1,
      y: rng() * height * 0.8 + height * 0.1,
      r: rng() * 2 + 1.5, // island radius in hexes
    });
  }

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      // Find distance to nearest island centre
      let minDist = Infinity;
      for (const ic of islandCentres) {
        const d = h.distanceTo(new HexCoord(ic.x, ic.y));
        if (d < minDist) minDist = d;
      }
      const noise = (rng() - 0.5) * 0.15;
      // Land only near island centres
      const val = 0.6 - (minDist / maxDim) * 1.5 + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0, Math.min(1, val))));
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 5. WATERWORLD — vast ocean with sparse islands
// ---------------------------------------------------------------------------

function generateWaterworld(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const maxDim = Math.max(width, height);

  // Few island centres — small islands in a vast ocean
  const numIslands = 4;
  const islandCentres: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < numIslands; i++) {
    islandCentres.push({
      x: rng() * width * 0.6 + width * 0.2,
      y: rng() * height * 0.6 + height * 0.2,
      r: rng() * 1.5 + 1.5, // island radius in hexes
    });
  }

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      let minDist = Infinity;
      for (const ic of islandCentres) {
        const d = h.distanceTo(new HexCoord(ic.x, ic.y));
        if (d < minDist) minDist = d;
      }
      const noise = (rng() - 0.5) * 0.06;
      // Vast ocean, small islands — base elevation very low
      const islandBoost = minDist < 3 ? Math.max(0, 0.7 - minDist * 0.25) : 0;
      const val = 0.08 + islandBoost + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0, Math.min(1, val))));
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 6. PANGEA — one massive continent, all players on same landmass
// ---------------------------------------------------------------------------

function generatePangea(width: number, height: number): Map<string, TileData> {
  const tiles = new Map<string, TileData>();
  const seed = Date.now();
  const rng = mulberry32(seed);
  const cx = width / 2, cy = height / 2;
  const maxDim = Math.max(width, height);

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const h = new HexCoord(q, r);
      const dist = h.distanceTo(new HexCoord(cx, cy)) / maxDim;
      const noise = (rng() - 0.5) * 0.15;
      // High elevation everywhere, water only at extreme edge
      const val = 0.7 - dist * 0.45 + noise;
      tiles.set(h.toString(), makeTile(rng, Math.max(0.25, Math.min(1, val))));
    }
  }
  return tiles;
}
